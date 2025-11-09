import { dbPromise } from '../storage/indexedDbManager';
import * as tilebelt from '@mapbox/tilebelt';
import {
  fetchResourceWithRetry,
  processBatch,
  createProgressTracker,
  validateResource,
  logger,
} from '../utils';
import type { FetchResourceResult } from '../utils';
import type {
  TileDownloadOptions,
  TileDownloadResult,
  TileStats,
  OfflineRegionOptions,
  MapboxStyle,
  TileEntry,
} from '../types';

const tileLogger = logger.scope('TileService');

export class TileService {
  private db = dbPromise;

  async downloadTiles(
    region: OfflineRegionOptions,
    style: MapboxStyle,
    styleId: string,
    options: TileDownloadOptions = {}
  ): Promise<TileDownloadResult> {
    const db = await this.db;
    const {
      onProgress,
      batchSize = 10,
      maxRetries = 3,
      skipExisting = true,
      timeout = 10000,
      retryDelay = 1000,
      priorityZoomLevels = [],
      storageQuotaCheck = true,
      validateTiles = false,
      compressTiles = false,
      bandwidthLimit,
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedTiles = 0;
    let skippedTiles = 0;
    let failedTiles = 0;
    const errors: Array<{ url: string; error: string }> = [];

    if (!style?.sources || Object.keys(style.sources).length === 0) {
      throw new Error('Style does not contain any sources to download tiles from');
    }

    // Generate tile coordinates once for the region
    const tileCoords = this.generateTileCoordinates(region);
    
    tileLogger.debug('🔍 ABOUT TO CALL extractTileSources with style:', {
      hasStyle: !!style,
      hasSources: !!(style && style.sources),
      sourceKeys: style && style.sources ? Object.keys(style.sources) : [],
      sourceCount: style && style.sources ? Object.keys(style.sources).length : 0,
    });
    
    const tileSources = await this.extractTileSources(style);
    
    tileLogger.debug('🔍 extractTileSources RETURNED:', {
      sourceCount: tileSources.size,
      sourceIds: Array.from(tileSources.keys()),
    });

    if (tileSources.size === 0) {
      throw new Error('No valid tile sources found in style definition');
    }

    // Sort by priority zoom levels if requested (lower zoom first)
    if (priorityZoomLevels.length > 0) {
      tileCoords.sort((a, b) => {
        const aPriority = priorityZoomLevels.includes(a.z);
        const bPriority = priorityZoomLevels.includes(b.z);
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return a.z - b.z;
      });
    }

    // Check storage quota if enabled
    if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedSpace = estimate.usage || 0;
      const availableSpace = (estimate.quota || 0) - usedSpace;

      if (availableSpace < 500 * 1024 * 1024) {
        throw new Error('Insufficient storage space for tile download');
      }
    }

    type TileDownloadPlan = {
      sourceId: string;
      templates: readonly string[];
      coords: Array<{ x: number; y: number; z: number }>;
      ext: string;
    };

    const downloadPlans: TileDownloadPlan[] = [];
    let totalTilesToDownload = 0;

    tileLogger.debug(`Processing ${tileSources.size} tile sources for download planning`);

    for (const [sourceId, sourceConfig] of tileSources) {
      tileLogger.debug(`Checking source ${sourceId}:`, {
        hasTiles: !!sourceConfig.tiles,
        tilesLength: sourceConfig.tiles?.length || 0,
        minzoom: sourceConfig.minzoom,
        maxzoom: sourceConfig.maxzoom,
      });

      const tiles = sourceConfig.tiles;

      if (!tiles || tiles.length === 0) {
        tileLogger.debug(`Skipping source ${sourceId}: no tiles array`);
        continue;
      }

      const sourceMinZ = Math.ceil(sourceConfig.minzoom ?? region.minZoom);
      const sourceMaxZ = Math.floor(sourceConfig.maxzoom ?? region.maxZoom);

      let coordsForSource = tileCoords.filter(
        coord => coord.z >= sourceMinZ && coord.z <= sourceMaxZ
      );

      tileLogger.debug(
        `After zoom filter (${sourceMinZ}-${sourceMaxZ}): ${coordsForSource.length} tiles`
      );

      if (coordsForSource.length === 0) {
        tileLogger.debug(`Skipping source ${sourceId}: no tiles in zoom range`);
        continue;
      }

      const extension = this.extractExtension(tiles[0]);
      tileLogger.debug(`Extension extracted: ${extension}`);

      if (skipExisting) {
        const existingTiles = await this.getExistingTileKeys(styleId, sourceId);
        const originalCount = coordsForSource.length;
        coordsForSource = coordsForSource.filter(coord => {
          const key = this.createTileKey(coord.x, coord.y, coord.z, styleId, sourceId, extension);
          return !existingTiles.has(key);
        });
        skippedTiles += originalCount - coordsForSource.length;
        tileLogger.debug(
          `After skipExisting filter: ${coordsForSource.length} tiles (${originalCount - coordsForSource.length} skipped)`
        );
      }

      if (coordsForSource.length === 0) {
        tileLogger.debug(`Skipping source ${sourceId}: all tiles already exist`);
        continue;
      }

      const ext = extension;

      downloadPlans.push({
        sourceId,
        templates: tiles,
        coords: coordsForSource,
        ext,
      });

      totalTilesToDownload += coordsForSource.length;
    }

    tileLogger.info(
      `Download plan summary: ${downloadPlans.length} plans, ${totalTilesToDownload} total tiles`
    );
    for (const plan of downloadPlans) {
      tileLogger.debug(
        `- ${plan.sourceId}: ${plan.coords.length} tiles, ${plan.templates.length} templates`
      );
    }

    const progressTracker = createProgressTracker(totalTilesToDownload);
    const emitProgress = () => {
      if (onProgress) {
        onProgress(progressTracker.getProgress());
      }
    };
    emitProgress();

    for (const plan of downloadPlans) {
      // Log zoom level distribution for this source
      const zoomLevels = new Map<number, number>();
      plan.coords.forEach(coord => {
        zoomLevels.set(coord.z, (zoomLevels.get(coord.z) || 0) + 1);
      });
      tileLogger.debug(`Source ${plan.sourceId} tile distribution:`, 
        Array.from(zoomLevels.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([z, count]) => `Z${z}: ${count} tiles`)
          .join(', ')
      );

      await processBatch(
        plan.coords,
        async coord => {
          const { x, y, z } = coord;
          const label = `${plan.sourceId}:${z}/${x}/${y}`;
          let tileUrl = '';
          let errorMessage: string | undefined;

          try {
            const template = this.selectTileTemplate(plan.templates, coord);
            tileUrl = this.populateTemplate(template, coord);
            const tileKey = this.createTileKey(x, y, z, styleId, plan.sourceId, plan.ext);

            // Enhanced logging for zoom 12
            if (z === 12) {
              tileLogger.debug(`Downloading Z12 tile: ${label}, URL: ${tileUrl.substring(0, 100)}...`);
            }

            if (bandwidthLimit) {
              await this.rateLimitDelay(bandwidthLimit);
            }

            const response = await fetchResourceWithRetry(tileUrl, {
              retries: maxRetries,
              retryDelay,
              timeout,
            });

            if (response.type === 'json') {
              throw new Error('Unexpected JSON response while downloading tile');
            }

            let tileData = response.data;
            const contentType = this.resolveTileContentType(response);
            const contentEncoding = response.contentEncoding;

            // Validate that we got actual tile data, not HTML error pages
            let view: Uint8Array | null = null;
            if (tileData.byteLength > 0) {
              view = new Uint8Array(tileData);

              // Check for HTML/XML signatures
              if (
                (view[0] === 0x3c && view[1] === 0x21) || // <!
                (view[0] === 0x3c && view[1] === 0x3f) || // <?
                (view[0] === 0x3c && view[1] === 0x68) || // <h (html)
                (view[0] === 0x3c && view[1] === 0x48) // <H (HTML)
              ) {
                const textDecoder = new TextDecoder();
                const preview = textDecoder.decode(
                  tileData.slice(0, Math.min(200, tileData.byteLength))
                );
                throw new Error(
                  `Received HTML/XML instead of tile data. Preview: ${preview.substring(0, 100)}...`
                );
              }

              // For vector tiles (PBF), expect valid protobuf magic bytes
              if (contentType.includes('pbf') || contentType.includes('vector')) {
                // PBF tiles should not start with common text/HTML bytes
                if (view[0] < 0x08) {
                  // Valid protobuf field numbers are 1-15 in first byte (0x08-0x78 range typically)
                  tileLogger.warn(
                    `Suspicious vector tile format for ${label}, first bytes: [${view[0]}, ${view[1]}]`
                  );
                }
              }

              // Decompress gzipped tiles before storage for reliable offline serving
              // Check both content-encoding header AND gzip magic bytes
              const isGzipped =
                (view[0] === 0x1f && view[1] === 0x8b) || contentEncoding === 'gzip';

              if (isGzipped) {
                try {
                  const decompressedStream = new Response(tileData).body?.pipeThrough(
                    new DecompressionStream('gzip')
                  );
                  if (decompressedStream) {
                    const decompressed = await new Response(decompressedStream).arrayBuffer();
                    tileData = decompressed;
                  } else {
                    tileLogger.warn(`Response body is null for tile ${label}, storing as-is`);
                  }
                } catch (decompressError) {
                  tileLogger.warn(
                    `Failed to decompress tile ${label}, storing as-is:`,
                    decompressError
                  );
                }
              }
            }

            if (validateTiles) {
              const isValid = validateResource(tileData, response.type);
              if (!isValid) {
                throw new Error(`Tile validation failed for ${label}`);
              }
            }

            if (compressTiles && contentType.startsWith('image/')) {
              tileData = await this.compressTile(tileData, contentType);
            }

            const tileEntry: TileEntry = {
              key: tileKey,
              url: tileUrl,
              data: tileData,
              contentType,
              size: tileData.byteLength,
              lastModified: Date.now(),
              downloadedAt: new Date().toISOString(),
              type: contentType.startsWith('image') ? 'raster' : 'vector',
              format: plan.ext, // Store the format separately (pbf, mvt, png, jpg, etc.)
              // Don't store contentEncoding if we decompressed
              contentEncoding: contentEncoding === 'gzip' ? undefined : contentEncoding,
              x,
              y,
              z,
              styleId,
              sourceId: plan.sourceId,
            };

            await db.put('tiles', tileEntry);

            totalSize += tileData.byteLength;
            downloadedTiles++;
            
            // Enhanced logging for zoom 12 successful downloads
            if (z === 12) {
              tileLogger.debug(`✓ Successfully stored Z12 tile: ${label}, size: ${tileData.byteLength} bytes, type: ${contentType}`);
            }
          } catch (_error) {
            failedTiles++;
            const errorObject = _error as unknown;
            errorMessage = errorObject instanceof Error ? errorObject.message : String(errorObject);

            errors.push({
              url: tileUrl || label,
              error: errorMessage,
            });

            // Enhanced logging for zoom 12 failures
            if (z === 12) {
              tileLogger.error(`✗ Failed to download Z12 tile ${label}:`, errorObject);
            }

            tileLogger.error(
              `Failed to download tile ${z}/${x}/${y} from ${plan.sourceId}:`,
              errorObject
            );
          } finally {
            progressTracker.update(1, label, errorMessage);
            emitProgress();
          }
        },
        { batchSize }
      );
    }

    const downloadTime = Date.now() - startTime;
    const averageSpeed = downloadTime > 0 ? (totalSize / 1024 / downloadTime) * 1000 : 0;

    if (totalTilesToDownload === 0) {
      emitProgress();
    }

    // Log download summary by zoom level
    tileLogger.debug(`Download Summary:
      Total tiles planned: ${totalTilesToDownload}
      Downloaded: ${downloadedTiles}
      Skipped: ${skippedTiles}
      Failed: ${failedTiles}
      Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB
      Time: ${(downloadTime / 1000).toFixed(2)}s
      Speed: ${averageSpeed.toFixed(2)} KB/s
    `);

    // Get the tile extension from the first download plan
    const tileExtension = downloadPlans.length > 0 ? downloadPlans[0].ext : undefined;

    return {
      totalTiles: totalTilesToDownload + skippedTiles,
      downloadedTiles,
      skippedTiles,
      failedTiles,
      totalSize,
      downloadTime,
      averageSpeed,
      errors,
      tileExtension, // Return the extension used for tiles
    };
  }

  async getTileStats(styleId?: string): Promise<TileStats> {
    const db = await this.db;

    let count = 0;
    let totalSize = 0;
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;
    const zoomLevelStats = new Map<number, { count: number; size: number }>();

    const tx = db.transaction('tiles', 'readonly');
    for await (const cursor of tx.store) {
      const tileEntry: TileEntry = cursor.value;

      // Filter by styleId if provided
      if (styleId && tileEntry.styleId !== styleId) {
        continue;
      }

      count++;
      totalSize += tileEntry.size;

      // Track oldest and newest tiles
      const tileDate = new Date(tileEntry.lastModified);
      if (!oldestTile || tileDate < oldestTile) {
        oldestTile = tileDate;
      }
      if (!newestTile || tileDate > newestTile) {
        newestTile = tileDate;
      }

      // Track zoom level statistics - handle optional z property
      const zoomLevel = tileEntry.z ?? 0;
      const zoomStats = zoomLevelStats.get(zoomLevel) || { count: 0, size: 0 };
      zoomStats.count++;
      zoomStats.size += tileEntry.size;
      zoomLevelStats.set(zoomLevel, zoomStats);
    }

    return {
      count,
      totalSize,
      averageSize: count > 0 ? totalSize / count : 0,
      oldestTile,
      newestTile,
      zoomLevelStats,
    };
  }

  async cleanupOldTiles(maxAge: number = 30, styleId?: string): Promise<number> {
    const db = await this.db;
    const cutoffTime = Date.now() - maxAge * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    const tx = db.transaction('tiles', 'readwrite');
    for await (const cursor of tx.store) {
      const tileEntry: TileEntry = cursor.value;

      // Filter by styleId if provided
      if (styleId && tileEntry.styleId !== styleId) {
        continue;
      }

      if (tileEntry.lastModified < cutoffTime) {
        await cursor.delete();
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getTileAnalytics(styleId?: string): Promise<Record<string, unknown>> {
    const stats = await this.getTileStats(styleId);

    const zoomDistribution: Record<string, number> = {};
    const sizeByZoom: Record<string, number> = {};

    for (const [zoom, zoomStats] of stats.zoomLevelStats) {
      zoomDistribution[zoom.toString()] = zoomStats.count;
      sizeByZoom[zoom.toString()] = zoomStats.size;
    }

    return {
      basic: {
        totalTiles: stats.count,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
      },
      distribution: {
        tilesByZoom: zoomDistribution,
        sizeByZoom,
      },
      temporal: {
        oldestTile: stats.oldestTile?.getTime(),
        newestTile: stats.newestTile?.getTime(),
        ageSpan:
          stats.oldestTile && stats.newestTile
            ? stats.newestTile.getTime() - stats.oldestTile.getTime()
            : 0,
      },
    };
  }

  private generateTileCoordinates(
    region: OfflineRegionOptions
  ): Array<{ x: number; y: number; z: number }> {
    const tiles: Array<{ x: number; y: number; z: number }> = [];
    const tilesByZoom: Record<number, number> = {};

    tileLogger.debug('=== TILE COORDINATE GENERATION DEBUG ===');
    tileLogger.debug('Region bounds:', region.bounds);
    tileLogger.debug('Zoom range:', region.minZoom, 'to', region.maxZoom);

    // Calculate area for reference - more accurate calculation
    const [[west, south], [east, north]] = region.bounds;
    const widthDeg = Math.abs(east - west);
    const heightDeg = Math.abs(north - south);

    // More accurate area calculation considering latitude
    const avgLat = (south + north) / 2;
    const latCorrectionFactor = Math.cos((avgLat * Math.PI) / 180);
    const widthKm = widthDeg * 111.32 * latCorrectionFactor; // 111.32 km per degree at equator
    const heightKm = heightDeg * 110.54; // 110.54 km per degree of latitude
    const areaApproxKm2 = widthKm * heightKm;

    tileLogger.debug(`Approximate area: ${areaApproxKm2.toFixed(2)} km² (improved calculation)`);
    tileLogger.debug(`Region dimensions: ${widthKm.toFixed(1)}km × ${heightKm.toFixed(1)}km`);

    for (let z = region.minZoom; z <= region.maxZoom; z++) {
      const bounds = region.bounds;
      const minTile = tilebelt.pointToTile(bounds[0][0], bounds[0][1], z);
      const maxTile = tilebelt.pointToTile(bounds[1][0], bounds[1][1], z);

      const minX = Math.min(minTile[0], maxTile[0]);
      const maxX = Math.max(minTile[0], maxTile[0]);
      const minY = Math.min(minTile[1], maxTile[1]);
      const maxY = Math.max(minTile[1], maxTile[1]);

      const tilesAtZoom = (maxX - minX + 1) * (maxY - minY + 1);
      tilesByZoom[z] = tilesAtZoom;

      tileLogger.debug(`Zoom ${z}: ${tilesAtZoom} tiles (X: ${minX}-${maxX}, Y: ${minY}-${maxY})`);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ x, y, z });
        }
      }
    }

    const totalTiles = tiles.length;
    tileLogger.debug('=== TILE COUNT SUMMARY ===');
    tileLogger.debug('Tiles by zoom level:', tilesByZoom);
    tileLogger.debug(`Total tile coordinates generated: ${totalTiles}`);
    tileLogger.debug('=============================');

    return tiles;
  }

  private async extractTileSources(
    style: MapboxStyle
  ): Promise<Map<string, { tiles: string[]; minzoom?: number; maxzoom?: number }>> {
    tileLogger.debug('🚀 extractTileSources CALLED with style:', {
      hasStyle: !!style,
      hasSources: !!(style && style.sources),
      sourceKeys: style && style.sources ? Object.keys(style.sources) : [],
    });
    
    const tileSources = new Map();

    if (!style || !style.sources) {
      tileLogger.warn('Style or sources missing in extractTileSources', {
        hasStyle: !!style,
        hasSources: !!(style && style.sources),
        sourceKeys: style && style.sources ? Object.keys(style.sources) : [],
      });
      return tileSources;
    }

    tileLogger.debug('Processing sources in extractTileSources:', Object.keys(style.sources));

    for (const [sourceId, sourceConfig] of Object.entries(style.sources)) {
      const config = sourceConfig as {
        type?: string;
        url?: string;
        tiles?: string[];
        minzoom?: number;
        maxzoom?: number;
      };

      tileLogger.debug(`Source ${sourceId} RAW DATA:`, JSON.stringify(config, null, 2));

      tileLogger.debug(`Processing source ${sourceId}:`, {
        type: config.type,
        hasTiles: !!config.tiles,
        hasUrl: !!config.url,
        tilesLength: config.tiles ? config.tiles.length : 0,
        url: config.url,
      });

      // Handle vector and raster tile sources
      if (config.type === 'vector' || config.type === 'raster') {
        // Handle direct tile URLs in the source config
        if (config.tiles && Array.isArray(config.tiles) && config.tiles.length > 0) {
          // Filter out idb:// URLs and relative paths - we only want absolute HTTP(S) URLs
          const httpTiles = config.tiles.filter((tile: string) => 
            tile.startsWith('http://') || tile.startsWith('https://')
          );
          if (httpTiles.length > 0) {
            tileSources.set(sourceId, { ...config, tiles: httpTiles });
            tileLogger.debug(
              `Found tile source: ${sourceId} with direct tiles URLs:`,
              httpTiles[0]
            );
          } else {
            tileLogger.debug(`Source ${sourceId} has no absolute HTTP tile URLs, will try to fetch from TileJSON URL if available`);
            // Don't continue here - fall through to try fetching from TileJSON URL
          }
          
          // Only continue (skip TileJSON fetch) if we found valid HTTP tiles
          if (httpTiles.length > 0) {
            continue;
          }
        }

        // Handle TileJSON URL sources
        if (config.url) {
          tileLogger.debug(`Processing TileJSON URL for source ${sourceId}:`, config.url);

          // Check if we have the original URL stored (from patched styles)
          let urlToFetch = config.url;
          if (config.url.startsWith('idb://') && '__originalTilesetUrl' in config) {
            urlToFetch =
              (config as { __originalTilesetUrl?: string }).__originalTilesetUrl || config.url;
            tileLogger.debug(`Found original URL for patched source ${sourceId}:`, urlToFetch);
          }

          // Filter out idb:// URLs if we don't have an original URL
          if (urlToFetch.startsWith('idb://')) {
            tileLogger.debug(
              `Source ${sourceId} has idb:// URL and no original URL, skipping for download:`,
              config.url
            );
            continue;
          }

          try {
            // For TileJSON URLs, fetch the actual TileJSON to get real tile URLs
            let tileUrlPattern: string;
            let tiles: string[] = [];

            // Check if URL points to a JSON file (before query params)
            const urlWithoutQuery = urlToFetch.split('?')[0];
            const isTileJsonUrl = urlWithoutQuery.endsWith('.json') || urlToFetch.includes('tilejson');
            
            if (isTileJsonUrl) {
              try {
                // Fetch the TileJSON
                const tilejsonUrl = urlToFetch.replace('tilejson+', '');
                tileLogger.debug(`🌐 Fetching TileJSON from: ${tilejsonUrl}`);

                const response = await fetchResourceWithRetry(tilejsonUrl, {
                  timeout: 10000,
                  retries: 2,
                });

                tileLogger.debug(`TileJSON fetch response type: ${response.type}`);

                if (response.type === 'json') {
                  const jsonData = response.data;
                  tileLogger.debug(`TileJSON data keys: ${Object.keys(jsonData || {}).join(', ')}`);
                  
                  if (
                    jsonData &&
                    typeof jsonData === 'object' &&
                    'tiles' in jsonData &&
                    Array.isArray((jsonData as { tiles?: unknown }).tiles)
                  ) {
                    tiles = (jsonData as { tiles?: string[] }).tiles ?? [];
                    tileLogger.debug(`Extracted ${tiles.length} tile URLs from TileJSON`);
                  }

                  if (tiles.length === 0) {
                    tileLogger.error('TileJSON does not contain any tile templates!', jsonData);
                    throw new Error('TileJSON does not contain any tile templates');
                  }

                  tileUrlPattern = tiles[0];
                  tileLogger.debug(`✅ SUCCESS: Got ${tiles.length} tile URLs from TileJSON. First URL: ${tiles[0]}`);
                } else {
                  tileLogger.error(`Invalid TileJSON response type: ${response.type}`);
                  throw new Error('Invalid TileJSON response');
                }
              } catch (tilejsonError) {
                tileLogger.warn(
                  `Failed to fetch TileJSON from ${urlToFetch}, falling back to pattern generation:`,
                  tilejsonError
                );

                // Fallback to pattern generation
                if (urlToFetch.includes('tilejson+')) {
                  tileUrlPattern = urlToFetch
                    .replace('tilejson+', '')
                    .replace('.json', '/{z}/{x}/{y}.pbf');
                } else if (urlToFetch.includes('/tiles.json') || urlToFetch.endsWith('.json')) {
                  // Handle Maptiler-style TileJSON URLs that end with /tiles.json or /style.json
                  // Remove the JSON filename and query params, then append tile pattern
                  let baseUrl = urlToFetch;
                  
                  // Extract query params if present
                  let queryParams = '';
                  const queryIndex = baseUrl.indexOf('?');
                  if (queryIndex !== -1) {
                    queryParams = baseUrl.substring(queryIndex);
                    baseUrl = baseUrl.substring(0, queryIndex);
                  }
                  
                  // Remove .json filename
                  if (baseUrl.includes('/tiles.json')) {
                    // For URLs like: https://api.maptiler.com/tiles/v3/tiles.json
                    // Extract base path before /tiles.json
                    const tilesJsonIndex = baseUrl.lastIndexOf('/tiles.json');
                    baseUrl = baseUrl.substring(0, tilesJsonIndex);
                  } else {
                    // For other .json files, remove from last /
                    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
                  }
                  
                  tileUrlPattern = `${baseUrl}/{z}/{x}/{y}.pbf${queryParams}`;
                } else {
                  tileUrlPattern = `${urlToFetch}/{z}/{x}/{y}.pbf`;
                }
                tiles = [tileUrlPattern];
              }
            } else {
              // Handle non-JSON URLs
              tileUrlPattern = `${urlToFetch}/{z}/{x}/{y}.pbf`;
              tiles = [tileUrlPattern];
            }

            // Create a config with the actual tiles array
            const enhancedConfig = {
              ...config,
              tiles: tiles,
            };

            tileSources.set(sourceId, enhancedConfig);
            tileLogger.debug(
              `Enhanced tile source: ${sourceId} with tile URL pattern: ${tileUrlPattern}`
            );
          } catch (_error) {
            tileLogger.warn(`Failed to process TileJSON URL for source ${sourceId}:`, _error);

            // Fallback to a simple placeholder
            const placeholderConfig = {
              ...config,
              tiles: [urlToFetch.replace('tilejson+', '').replace('.json', '/{z}/{x}/{y}.pbf')],
            };
            tileSources.set(sourceId, placeholderConfig);
            tileLogger.debug(`Using placeholder tile URL for source ${sourceId}`);
          }
        } else {
          tileLogger.debug(`Source ${sourceId} has no tiles or URL property`);
        }
      } else {
        tileLogger.debug(`Ignoring non-vector/raster source ${sourceId} of type ${config.type}`);
      }
    }

    if (tileSources.size === 0) {
      tileLogger.warn('No valid tile sources found in style', Object.keys(style.sources));
      // As a last resort, try to use a common vector tile source pattern if we can't extract any
      if (style.sources && Object.keys(style.sources).length > 0) {
        const firstSourceId = Object.keys(style.sources)[0];
        tileLogger.debug(`Attempting to create fallback source from ${firstSourceId}`);

        tileSources.set(firstSourceId, {
          type: 'vector',
          tiles: ['{z}/{x}/{y}.pbf'],
        });
      }
    }

    return tileSources;
  }

  // Create tile key including file extension
  private createTileKey(
    x: number,
    y: number,
    z: number,
    styleId: string,
    sourceId: string,
    ext: string // Extension included in key
  ): string {
    // Store keys WITH extension for consistent lookup
    return `${styleId}:${sourceId}:${z}:${x}:${y}.${ext}`;
  }

  private async getExistingTileKeys(styleId: string, sourceId: string): Promise<Set<string>> {
    const db = await this.db;
    const existingKeys = new Set<string>();

    const tx = db.transaction('tiles', 'readonly');
    for await (const cursor of tx.store) {
      const tileEntry: TileEntry = cursor.value;
      if (tileEntry.styleId === styleId && tileEntry.sourceId === sourceId) {
        existingKeys.add(tileEntry.key);
        continue;
      }

      const parsedKey = this.parseTileKey(tileEntry.key);
      if (parsedKey && parsedKey.styleId === styleId && parsedKey.sourceId === sourceId) {
        existingKeys.add(tileEntry.key);
      }
    }

    return existingKeys;
  }

  private async compressTile(data: ArrayBuffer, _contentType: string): Promise<ArrayBuffer> {
    // Simple compression placeholder - in practice, you might use a compression library
    // For now, just return the original data
    return data;
  }

  private async rateLimitDelay(bandwidthLimit: number): Promise<void> {
    // Simple rate limiting implementation
    const delay = Math.max(0, 1000 / bandwidthLimit); // Convert KB/s to delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private extractExtension(template: string): string {
    const extMatch = template.match(/\.([\w]+)(?:\?|$)/i);
    return extMatch ? extMatch[1] : 'pbf';
  }

  private selectTileTemplate(
    templates: readonly string[],
    coord: { x: number; y: number; z: number }
  ): string {
    if (templates.length === 1) {
      return templates[0];
    }

    const index = Math.abs((coord.x + coord.y + coord.z) % templates.length);
    return templates[index];
  }

  private populateTemplate(template: string, coord: { x: number; y: number; z: number }): string {
    return template
      .replace('{x}', coord.x.toString())
      .replace('{y}', coord.y.toString())
      .replace('{z}', coord.z.toString());
  }

  private resolveTileContentType(result: FetchResourceResult): string {
    if ('contentType' in result && result.contentType) {
      return result.contentType;
    }

    if (result.type === 'image') {
      return 'image/png';
    }

    if (result.type === 'pbf') {
      return 'application/x-protobuf';
    }

    return 'application/octet-stream';
  }

  private parseTileKey(key: string): { styleId: string; sourceId: string } | null {
    const match = key.match(/^([^:]+):([^:]+):\d+:\d+:[^:]+$/);
    if (!match) {
      return null;
    }

    return {
      styleId: match[1],
      sourceId: match[2],
    };
  }
}

// Export singleton instance and functions for backward compatibility
export const tileService = new TileService();

export const downloadTiles = (
  region: OfflineRegionOptions,
  style: MapboxStyle,
  styleId: string,
  options?: TileDownloadOptions
) => tileService.downloadTiles(region, style, styleId, options);

export const getTileStats = (styleId?: string) => tileService.getTileStats(styleId);
export const getTileAnalytics = (styleId?: string) => tileService.getTileAnalytics(styleId);
export const cleanupOldTiles = (maxAge?: number, styleId?: string) =>
  tileService.cleanupOldTiles(maxAge, styleId);
