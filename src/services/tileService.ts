import { dbPromise } from '@/storage/indexedDbManager';
import * as tilebelt from '@mapbox/tilebelt';
import {
  fetchResourceWithRetry,
  processBatch,
  createProgressTracker,
  validateResource,
  logger,
  createTileKey,
} from '@/utils';
import {
  isMapboxProtocol,
  resolveMapboxUrl,
  rewriteMapboxCdnTileUrl,
} from '@/utils/styleProviderUtils';
import type { FetchResourceResult } from '@/utils';
import type {
  TileDownloadOptions,
  TileDownloadResult,
  TileStats,
  OfflineRegionOptions,
  MapboxStyle,
  TileEntry,
} from '@/types';

const tileLogger = logger.scope('TileService');

/**
 * Service for managing offline map tiles
 * Handles downloading, storing, and retrieving map tiles from IndexedDB
 */
export class TileService {
  private db = dbPromise;

  /**
   * Downloads map tiles for a specified region and style
   * @param region - The geographic region to download tiles for
   * @param style - The MapLibre/Mapbox style containing tile sources
   * @param styleId - Unique identifier for the style
   * @param options - Download configuration options
   * @returns Promise resolving to download result with statistics
   * @throws Error if style has no valid tile sources
   */
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
      probeSourcesBeforeDownload = true,
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

    // Inject extra sources from the region into the style for downloading
    if (region.extraSources && region.extraSources.length > 0) {
      for (const extra of region.extraSources) {
        if (!style.sources[extra.id]) {
          style.sources[extra.id] = {
            type: extra.type || 'vector',
            tiles: extra.tiles,
            ...(extra.minzoom !== undefined ? { minzoom: extra.minzoom } : {}),
            ...(extra.maxzoom !== undefined ? { maxzoom: extra.maxzoom } : {}),
            ...(extra.attribution ? { attribution: extra.attribution } : {}),
          };
          tileLogger.debug(`Injected extra source: ${extra.id}`, extra.tiles);
        }
      }
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

    // Some sources have zoom ranges outside the user's region (e.g. procedural-buildings
    // at z15 when the user requested z0-z14). Generate additional tile coordinates so
    // these sources aren't silently skipped.
    for (const [sourceId, sourceConfig] of tileSources) {
      const srcMin = sourceConfig.minzoom;
      const srcMax = sourceConfig.maxzoom;
      if (srcMin === undefined && srcMax === undefined) continue;

      const extraMinZ = srcMin !== undefined && srcMin > region.maxZoom ? srcMin : null;
      const extraMaxZ = srcMax !== undefined && srcMax < region.minZoom ? srcMax : null;
      // Only extend upward (higher zoom) — sources that need zooms above region.maxZoom
      if (extraMinZ !== null) {
        const upperBound = srcMax !== undefined ? srcMax : extraMinZ;
        tileLogger.debug(
          `Source ${sourceId} needs zoom ${extraMinZ}-${upperBound} beyond region max ${region.maxZoom}, generating extra tiles`
        );
        const extraRegion = { ...region, minZoom: extraMinZ, maxZoom: upperBound };
        const extraCoords = this.generateTileCoordinates(extraRegion);
        tileCoords.push(...extraCoords);
      }
      // Extend downward (lower zoom) — sources that need zooms below region.minZoom
      if (extraMaxZ !== null) {
        const lowerBound = srcMin !== undefined ? srcMin : extraMaxZ;
        tileLogger.debug(
          `Source ${sourceId} needs zoom ${lowerBound}-${extraMaxZ} below region min ${region.minZoom}, generating extra tiles`
        );
        const extraRegion = { ...region, minZoom: lowerBound, maxZoom: extraMaxZ };
        const extraCoords = this.generateTileCoordinates(extraRegion);
        tileCoords.push(...extraCoords);
      }
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
          const key = createTileKey(coord.x, coord.y, coord.z, styleId, sourceId, extension);
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

      // Before committing to download a source's full tile plan, probe
      // a few representative tiles. If the MAJORITY return 404, the
      // source is sparse-for-this-region and we skip it entirely rather
      // than pepper the network with 404s across every planned coord.
      //
      // Why multi-probe: some sources are locally-dense-but-regionally-
      // sparse (e.g. `mapbox.mapbox-landmark-pois-v1` has tiles at a few
      // landmark locations per region but 404 for every other coord).
      // A single probe on the wrong coord would false-pass and cause a
      // flood of 404s during the download. Probing start/middle/end of
      // the plan catches this case.
      if (probeSourcesBeforeDownload) {
        const picks = [
          coordsForSource[0],
          coordsForSource[Math.floor(coordsForSource.length / 2)],
          coordsForSource[coordsForSource.length - 1],
        ];
        // De-dup for tiny plans where start/middle/end collapse to one.
        const probeCoords = Array.from(
          new Map(picks.map(c => [`${c.z}/${c.x}/${c.y}`, c])).values()
        );

        const probeResults = await Promise.all(
          probeCoords.map(async coord => {
            const url = this.populateTemplate(this.selectTileTemplate(tiles, coord), coord);
            try {
              const res = await fetch(url);
              return res.status !== 404;
            } catch {
              // Network error — treat as "has data" so we don't skip the
              // source due to a transient hiccup.
              return true;
            }
          })
        );

        const successes = probeResults.filter(Boolean).length;
        const failures = probeResults.length - successes;
        // Majority-404: more probes failed than succeeded. Skip.
        if (failures > successes) {
          tileLogger.info(
            `Skipping source "${sourceId}" — ${failures}/${probeResults.length} probe tiles returned 404 (sparse for this region)`
          );
          continue;
        }
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
      tileLogger.debug(
        `Source ${plan.sourceId} tile distribution:`,
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
            const tileKey = createTileKey(x, y, z, styleId, plan.sourceId, plan.ext);

            // Enhanced logging for zoom 12
            if (z === 12) {
              tileLogger.debug(
                `Downloading Z12 tile: ${label}, URL: ${tileUrl.substring(0, 100)}...`
              );
            }

            if (bandwidthLimit) {
              await this.rateLimitDelay(bandwidthLimit);
            }

            const response = await fetchResourceWithRetry(tileUrl, {
              retries: maxRetries,
              retryDelay,
              timeout,
              proxyType: 'tiles',
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

              // Check for HTML/XML signatures — any tag starting with <
              if (
                view[0] === 0x3c && // '<'
                (view[1] === 0x21 || // <!
                  view[1] === 0x3f || // <?
                  (view[1] >= 0x41 && view[1] <= 0x5a) || // <A-Z
                  (view[1] >= 0x61 && view[1] <= 0x7a)) // <a-z
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
              expires: response.expires,
            };

            await db.put('tiles', tileEntry);

            totalSize += tileData.byteLength;
            downloadedTiles++;

            // Enhanced logging for zoom 12 successful downloads
            if (z === 12) {
              tileLogger.debug(
                `✓ Successfully stored Z12 tile: ${label}, size: ${tileData.byteLength} bytes, type: ${contentType}`
              );
            }
          } catch (_error) {
            const errorObject = _error as unknown;
            errorMessage = errorObject instanceof Error ? errorObject.message : String(errorObject);

            // 404s on sparse tilesets (landmarks, POIs) are expected — don't count as failures
            const is404 = errorMessage.includes('404') || errorMessage.includes('not found');
            const isExpected = errorMessage.includes('NonRetryableError');

            if (is404) {
              skippedTiles++;
              // Clear errorMessage so progressTracker doesn't report it as an error
              errorMessage = undefined;
              tileLogger.debug(
                `Tile ${z}/${x}/${y} not found on ${plan.sourceId} (sparse tileset)`
              );
            } else {
              failedTiles++;
              errors.push({
                url: tileUrl || label,
                error: errorMessage,
              });

              if (z === 12 && !isExpected) {
                tileLogger.error(`Failed to download Z12 tile ${label}:`, errorObject);
              }

              const logFn = isExpected
                ? tileLogger.warn.bind(tileLogger)
                : tileLogger.error.bind(tileLogger);
              logFn(`Failed to download tile ${z}/${x}/${y} from ${plan.sourceId}:`, errorObject);
            }
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

  /**
   * Retrieves statistics about stored tiles
   * @param styleId - Optional style ID to filter statistics
   * @returns Promise resolving to tile statistics including count, size, and zoom level breakdown
   */
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

  /**
   * Removes tiles older than the specified age
   * @param maxAge - Maximum age in days (default: 30)
   * @param styleId - Optional style ID to limit cleanup scope
   * @returns Promise resolving to number of deleted tiles
   */
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

  /**
   * Generates detailed analytics about stored tiles
   * @param styleId - Optional style ID to filter analytics
   * @returns Promise resolving to analytics object with basic stats, distribution, and temporal data
   */
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
        __originalTilesetUrl?: string;
      };

      tileLogger.debug(`Source ${sourceId} RAW DATA:`, JSON.stringify(config, null, 2));

      tileLogger.debug(`Processing source ${sourceId}:`, {
        type: config.type,
        hasTiles: !!config.tiles,
        hasUrl: !!config.url,
        tilesLength: config.tiles ? config.tiles.length : 0,
        url: config.url,
      });

      // Handle tile-based sources (vector, raster, raster-dem, batched-model,
      // raster-array). `raster-array` is used by Mapbox Standard for layers
      // like `mapbox-landmarks` (mapbox.mapbox-landmark-icons-v1) — the tiles
      // are fetched from the same /v4/ endpoint as other tilesets, so the
      // TileJSON resolution path below handles them uniformly.
      if (
        config.type === 'vector' ||
        config.type === 'raster' ||
        config.type === 'raster-dem' ||
        config.type === 'raster-array' ||
        config.type === 'batched-model'
      ) {
        // Handle direct tile URLs in the source config
        if (config.tiles && Array.isArray(config.tiles) && config.tiles.length > 0) {
          // Resolve mapbox:// tile URLs to HTTPS, then filter for HTTP(S) URLs
          const resolvedTiles = config.tiles.map((tile: string) => {
            if (isMapboxProtocol(tile)) {
              // Try to find an access token from the style or source URL
              const accessToken = this.extractAccessTokenFromStyle(style);
              if (accessToken) {
                return resolveMapboxUrl(tile, accessToken);
              }
              tileLogger.warn(`Cannot resolve mapbox:// tile URL without access token: ${tile}`);
            }
            return tile;
          });

          // Filter out idb:// URLs and relative paths - we only want absolute HTTP(S) URLs
          // Also upgrade http:// to https:// (TileJSON responses often use http://)
          const httpTiles = resolvedTiles
            .filter((tile: string) => tile.startsWith('http://') || tile.startsWith('https://'))
            .map((tile: string) =>
              tile.startsWith('http://') ? tile.replace('http://', 'https://') : tile
            )
            .map((tile: string) => rewriteMapboxCdnTileUrl(tile));
          if (httpTiles.length > 0) {
            tileSources.set(sourceId, { ...config, tiles: httpTiles });
            tileLogger.debug(
              `Found tile source: ${sourceId} with direct tiles URLs:`,
              httpTiles[0]
            );
          } else {
            tileLogger.debug(
              `Source ${sourceId} has no absolute HTTP tile URLs, will try to fetch from TileJSON URL if available`
            );
            // Don't continue here - fall through to try fetching from TileJSON URL
          }

          // Only continue (skip TileJSON fetch) if we found valid HTTP tiles
          if (httpTiles.length > 0) {
            continue;
          }
        }

        // Handle TileJSON URL sources
        // Check both config.url and __originalTilesetUrl (set by patchStyleForOffline
        // when the style was patched for offline use — url is deleted but original is preserved)
        const tileJsonSourceUrl = config.url || config.__originalTilesetUrl;
        if (tileJsonSourceUrl) {
          tileLogger.debug(`Processing TileJSON URL for source ${sourceId}:`, tileJsonSourceUrl);

          let urlToFetch = tileJsonSourceUrl;

          // Resolve mapbox:// source URLs to HTTPS TileJSON URLs
          if (isMapboxProtocol(urlToFetch)) {
            const accessToken = this.extractAccessTokenFromStyle(style);
            if (accessToken) {
              urlToFetch = resolveMapboxUrl(urlToFetch, accessToken);
              tileLogger.debug(`Resolved mapbox:// source URL for ${sourceId}:`, urlToFetch);
            } else {
              tileLogger.warn(
                `Cannot resolve mapbox:// source URL without access token: ${urlToFetch}`
              );
              continue;
            }
          }

          // Filter out idb:// URLs if we don't have an original URL
          if (urlToFetch.startsWith('idb://')) {
            tileLogger.debug(
              `Source ${sourceId} has idb:// URL and no original URL, skipping for download:`,
              tileJsonSourceUrl
            );
            continue;
          }

          try {
            // For TileJSON URLs, fetch the actual TileJSON to get real tile URLs
            let tileUrlPattern: string = '';
            let tiles: string[] = [];

            // Always try to fetch TileJSON first, regardless of URL extension
            // Many providers (like OpenFreeMap) serve TileJSON from URLs without .json extension
            const tilejsonUrl = urlToFetch.replace('tilejson+', '');
            let tilejsonFetched = false;
            let tilejsonMinzoom: number | undefined;
            let tilejsonMaxzoom: number | undefined;

            try {
              tileLogger.debug(`Attempting to fetch TileJSON from: ${tilejsonUrl}`);

              const response = await fetchResourceWithRetry(tilejsonUrl, {
                timeout: 10000,
                retries: 2,
              });

              tileLogger.debug(`TileJSON fetch response type: ${response.type}`);

              if (response.type === 'json') {
                const jsonData = response.data as Record<string, unknown> | null;
                tileLogger.debug(`TileJSON data keys: ${Object.keys(jsonData || {}).join(', ')}`);

                if (
                  jsonData &&
                  typeof jsonData === 'object' &&
                  'tiles' in jsonData &&
                  Array.isArray(jsonData.tiles)
                ) {
                  tiles = ((jsonData.tiles as string[]) ?? [])
                    .map(u => (u.startsWith('http://') ? u.replace('http://', 'https://') : u))
                    .map(u => rewriteMapboxCdnTileUrl(u));
                  tileLogger.debug(`Extracted ${tiles.length} tile URLs from TileJSON`);

                  // Capture minzoom/maxzoom from TileJSON if available
                  if (typeof jsonData.minzoom === 'number') {
                    tilejsonMinzoom = jsonData.minzoom;
                  }
                  if (typeof jsonData.maxzoom === 'number') {
                    tilejsonMaxzoom = jsonData.maxzoom;
                  }

                  if (tiles.length > 0) {
                    tileUrlPattern = tiles[0];
                    tilejsonFetched = true;
                    tileLogger.debug(
                      `TileJSON: ${tiles.length} tile URLs, minzoom: ${tilejsonMinzoom}, maxzoom: ${tilejsonMaxzoom}, first URL: ${tiles[0]}`
                    );
                  }
                }
              }
            } catch (tilejsonError) {
              tileLogger.debug(
                `TileJSON fetch failed for ${urlToFetch}, will fall back to pattern generation:`,
                tilejsonError
              );
            }

            // Fallback to pattern generation if TileJSON fetch didn't work
            if (!tilejsonFetched) {
              tileLogger.debug(`Falling back to pattern generation for ${urlToFetch}`);

              // Check if URL points to a JSON file (before query params)
              const urlWithoutQuery = urlToFetch.split('?')[0];
              const isJsonUrl =
                urlWithoutQuery.endsWith('.json') || urlToFetch.includes('tilejson');

              if (urlToFetch.includes('tilejson+')) {
                tileUrlPattern = urlToFetch
                  .replace('tilejson+', '')
                  .replace('.json', '/{z}/{x}/{y}.pbf');
              } else if (
                urlToFetch.includes('/tiles.json') ||
                (isJsonUrl && urlToFetch.endsWith('.json'))
              ) {
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

            // Create a config with the actual tiles array and TileJSON zoom limits
            const enhancedConfig = {
              ...config,
              tiles: tiles,
              // Use TileJSON minzoom/maxzoom if the source config doesn't already have them
              ...(tilejsonMinzoom !== undefined && config.minzoom === undefined
                ? { minzoom: tilejsonMinzoom }
                : {}),
              ...(tilejsonMaxzoom !== undefined && config.maxzoom === undefined
                ? { maxzoom: tilejsonMaxzoom }
                : {}),
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
        tileLogger.debug(`Ignoring non-tile source ${sourceId} of type ${config.type}`);
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
    if (bandwidthLimit <= 0) return;
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

  private extractAccessTokenFromStyle(style: MapboxStyle): string | null {
    // Check for accessToken stored on the style entry (set during download)
    const storedToken = (style as Record<string, unknown>).accessToken;
    if (typeof storedToken === 'string' && storedToken) {
      return storedToken;
    }

    // Check for access_token in source URLs
    if (style.sources) {
      for (const sourceConfig of Object.values(style.sources)) {
        const source = sourceConfig as { url?: string; tiles?: string[] };
        if (source.url && typeof source.url === 'string') {
          try {
            const url = new URL(source.url);
            const token = url.searchParams.get('access_token');
            if (token) return token;
          } catch {
            // Not a valid URL, skip
          }
        }
        if (source.tiles && Array.isArray(source.tiles)) {
          for (const tileUrl of source.tiles) {
            try {
              const url = new URL(tileUrl);
              const token = url.searchParams.get('access_token');
              if (token) return token;
            } catch {
              // Not a valid URL, skip
            }
          }
        }
      }
    }
    // Check glyphs and sprite URLs (sprite may be string or array)
    const urlsToCheck: string[] = [];
    if (typeof style.glyphs === 'string') urlsToCheck.push(style.glyphs);
    if (typeof style.sprite === 'string') {
      urlsToCheck.push(style.sprite);
    } else if (Array.isArray(style.sprite)) {
      for (const entry of style.sprite as unknown as Array<{ url?: string }>) {
        if (typeof entry.url === 'string') urlsToCheck.push(entry.url);
      }
    }
    for (const field of urlsToCheck) {
      try {
        const url = new URL(field);
        const token = url.searchParams.get('access_token');
        if (token) return token;
      } catch {
        // Not a valid URL, skip
      }
    }
    return null;
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
