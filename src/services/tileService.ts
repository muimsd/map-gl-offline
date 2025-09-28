import { dbPromise } from '../storage/indexedDbManager';
import * as tilebelt from '@mapbox/tilebelt';
import {
  fetchResourceWithRetry,
  processBatch,
  createProgressTracker,
  validateResource,
} from '../utils';
import type {
  TileDownloadOptions,
  TileDownloadResult,
  TileStats,
  OfflineRegionOptions,
  MapboxStyle,
  TileEntry,
} from '../types';
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
      batchSize = 10,
      maxRetries = 3,
      skipExisting = true,
      timeout = 10000,
      retryDelay = 1000,
      priorityZoomLevels = [],
      storageQuotaCheck = true,
      validateTiles = false,
      compressTiles = false,
      bandwidthLimit
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedTiles = 0;
    let skippedTiles = 0;
    let failedTiles = 0;
    const errors: Array<{ url: string; error: string }> = [];

    // Generate tile coordinates
    console.warn('=== REGION PARAMETERS ===');
    console.warn('Region ID:', region.id);
    console.warn('Region name:', region.name);
    console.warn('Min zoom:', region.minZoom);
    console.warn('Max zoom:', region.maxZoom);
    console.warn('Bounds:', region.bounds);
    console.warn('========================');
    const tileCoords = this.generateTileCoordinates(region);
    console.warn(`Generated ${tileCoords.length} tile coordinates for region:`, region.id);

    // Get tile sources from style
    const tileSources = await this.extractTileSources(style);
    console.warn(`Found ${tileSources.size} tile sources:`, Array.from(tileSources.keys()));

    // Calculate expected total downloads
    const expectedTotalDownloads = tileCoords.length * tileSources.size;
    console.warn(
      `Expected total tile downloads: ${tileCoords.length} coords × ${tileSources.size} sources = ${expectedTotalDownloads}`
    );

    // Create progress tracker
    const progressTracker = createProgressTracker(expectedTotalDownloads);

    // Sort tiles by priority zoom levels
    if (priorityZoomLevels.length > 0) {
      tileCoords.sort((a, b) => {
        const aPriority = priorityZoomLevels.includes(a.z);
        const bPriority = priorityZoomLevels.includes(b.z);
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return a.z - b.z; // Secondary sort by zoom level
      });
    }

    // Check storage quota if enabled
    if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedSpace = estimate.usage || 0;
      const availableSpace = (estimate.quota || 0) - usedSpace;

      if (availableSpace < 500 * 1024 * 1024) {
        // Less than 500MB
        throw new Error('Insufficient storage space for tile download');
      }
    }

    // Debug: Log all sources in the style
    if (style.sources) {
      console.warn('All sources in style:', Object.keys(style.sources));
      for (const [sourceId, sourceConfig] of Object.entries(style.sources)) {
        console.warn(`Source ${sourceId}:`, sourceConfig);
      }
    } else {
      console.warn('No sources found in style');
    }

    // Process tiles for each source
    for (const [sourceId, sourceConfig] of tileSources) {
      console.warn(`\n=== PROCESSING SOURCE: ${sourceId} ===`);
      // Respect source zoom range
      const sourceMinZ = Math.ceil(sourceConfig.minzoom ?? region.minZoom);
      const sourceMaxZ = Math.floor(sourceConfig.maxzoom ?? region.maxZoom);
      console.warn(`Region zoom range: ${region.minZoom} to ${region.maxZoom}`);
      console.warn(
        `Source "${sourceId}" zoom constraints: minzoom=${sourceConfig.minzoom}, maxzoom=${sourceConfig.maxzoom}`
      );
      console.warn(`Effective zoom range for source: ${sourceMinZ} to ${sourceMaxZ}`);

      let coordsToDownload = tileCoords.filter(
        coord => coord.z >= sourceMinZ && coord.z <= sourceMaxZ
      );
      console.warn(`Total tile coords generated: ${tileCoords.length}`);
      console.warn(
        `Filtered to ${coordsToDownload.length} coords for source ${sourceId} (after zoom filtering)`
      );

      // Debug: show tile distribution by zoom level
      const tilesByZoom: Record<number, number> = {};
      coordsToDownload.forEach(coord => {
        tilesByZoom[coord.z] = (tilesByZoom[coord.z] || 0) + 1;
      });
      console.warn(`Tiles per zoom level for source ${sourceId}:`, tilesByZoom);

      // Show what was filtered out
      const filteredOutCount = tileCoords.length - coordsToDownload.length;
      if (filteredOutCount > 0) {
        console.warn(
          `⚠️  ${filteredOutCount} tiles filtered out due to source zoom constraints (${sourceMinZ}-${sourceMaxZ})`
        );
      }

      if (!sourceConfig.tiles || sourceConfig.tiles.length === 0) {
        console.warn(`Source ${sourceId} has no tiles array, skipping`);
        continue;
      }

      const tileUrlTemplate = sourceConfig.tiles[0];
      console.warn(`Tile URL template: ${tileUrlTemplate}`);

      // Derive file extension for tile key from URL template
      const extMatch = tileUrlTemplate.match(/\.(\w+)(?:\?|$)/);
      const ext = extMatch ? extMatch[1] : 'pbf';
      console.warn(`Using file extension "${ext}" for tile keys`);

      // Filter existing tiles if skipExisting is true
      // coordsToDownload already generated per-source
      if (skipExisting) {
        console.warn(`Checking for existing tiles for source ${sourceId}...`);
        const existingTiles = await this.getExistingTileKeys(styleId, sourceId);
        console.warn(`Found ${existingTiles.size} existing tiles for source ${sourceId}`);

        const originalCount = coordsToDownload.length;
        coordsToDownload = coordsToDownload.filter(coord => {
          const key = this.createTileKey(coord.x, coord.y, coord.z, styleId, sourceId, ext);
          return !existingTiles.has(key);
        });

        const skippedForThisSource = originalCount - coordsToDownload.length;
        skippedTiles += skippedForThisSource;

        console.warn(
          `Source ${sourceId}: ${coordsToDownload.length} to download, ${skippedForThisSource} skipped (already exist)`
        );
      } else {
        console.warn(
          `Source ${sourceId}: ${coordsToDownload.length} to download (skipExisting disabled)`
        );
      }

      // Process tiles in batches with concurrency control
      console.warn(
        `Starting batch download of ${coordsToDownload.length} tiles for source ${sourceId}...`
      );

      let sourceDownloadedTiles = 0;
      let sourceFailedTiles = 0;

      await processBatch(
        coordsToDownload,
        async coord => {
          try {
            const { x, y, z } = coord;
            const tileUrl = tileUrlTemplate
              .replace('{x}', x.toString())
              .replace('{y}', y.toString())
              .replace('{z}', z.toString());

            // Create tile key including extension
            const tileKey = this.createTileKey(x, y, z, styleId, sourceId, ext);

            progressTracker.update(1, `Downloading tile ${z}/${x}/${y} from ${sourceId}`);

            // Apply bandwidth limiting if specified
            if (bandwidthLimit) {
              await this.rateLimitDelay(bandwidthLimit);
            }

            const response = await fetchResourceWithRetry(tileUrl, {
              retries: maxRetries,
              retryDelay,
              timeout,
            });

            let tileData = response.data;
            const contentType =
              response.type === 'image'
                ? 'image/png'
                : response.type === 'pbf'
                  ? 'application/x-protobuf'
                  : 'application/octet-stream';

            // Validate tile if enabled
            if (validateTiles) {
              await validateResource(tileData, contentType);
            }

            // Compress tile if enabled
            if (compressTiles && contentType.includes('image')) {
              tileData = await this.compressTile(tileData, contentType);
            }

            // Create tile entry
            const tileEntry: TileEntry = {
              key: tileKey,
              url: tileUrl,
              data: tileData,
              contentType,
              size: tileData.byteLength,
              lastModified: Date.now(),
              downloadedAt: new Date().toISOString(),
              type: contentType.includes('image') ? 'raster' : 'vector',
              x,
              y,
              z,
            };

            // Store tile in database
            await db.put('tiles', tileEntry);

            totalSize += tileData.byteLength;
            downloadedTiles++;
            sourceDownloadedTiles++;

            if (sourceDownloadedTiles % 10 === 0) {
              console.warn(
                `Source ${sourceId}: Downloaded ${sourceDownloadedTiles}/${coordsToDownload.length} tiles`
              );
            }
          } catch (_error) {
            failedTiles++;
            sourceFailedTiles++;
            const tileUrl = tileUrlTemplate
              .replace('{x}', coord.x.toString())
              .replace('{y}', coord.y.toString())
              .replace('{z}', coord.z.toString());

            errors.push({
              url: tileUrl,
              error: _error instanceof Error ? _error.message : String(_error),
            });
            console.error(
              `Failed to download tile ${coord.z}/${coord.x}/${coord.y} from ${sourceId}:`,
              _error
            );
          }
        },
        { batchSize }
      );

      console.warn(
        `Source ${sourceId} completed: ${sourceDownloadedTiles} downloaded, ${sourceFailedTiles} failed`
      );
    }

    const downloadTime = Date.now() - startTime;
    const averageSpeed = downloadTime > 0 ? (totalSize / 1024 / downloadTime) * 1000 : 0;

    // Final summary
    console.warn('\n=== DOWNLOAD SUMMARY ===');
    console.warn(`Total tile coordinates: ${tileCoords.length}`);
    console.warn(`Tile sources processed: ${tileSources.size}`);
    console.warn(`Expected total downloads: ${tileCoords.length * tileSources.size}`);
    console.warn(`Actually downloaded: ${downloadedTiles}`);
    console.warn(`Skipped (existing): ${skippedTiles}`);
    console.warn(`Failed: ${failedTiles}`);
    console.warn(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.warn(`Download time: ${(downloadTime / 1000).toFixed(1)}s`);
    console.warn(`Average speed: ${averageSpeed.toFixed(1)} KB/s`);
    console.warn('========================');

    return {
      totalTiles: tileCoords.length * tileSources.size,
      downloadedTiles,
      skippedTiles,
      failedTiles,
      totalSize,
      downloadTime,
      averageSpeed,
      errors,
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

    console.warn('=== TILE COORDINATE GENERATION DEBUG ===');
    console.warn('Region bounds:', region.bounds);
    console.warn('Zoom range:', region.minZoom, 'to', region.maxZoom);

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

    console.warn(`Approximate area: ${areaApproxKm2.toFixed(2)} km² (improved calculation)`);
    console.warn(`Region dimensions: ${widthKm.toFixed(1)}km × ${heightKm.toFixed(1)}km`);

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

      console.warn(`Zoom ${z}: ${tilesAtZoom} tiles (X: ${minX}-${maxX}, Y: ${minY}-${maxY})`);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ x, y, z });
        }
      }
    }

    const totalTiles = tiles.length;
    console.warn('=== TILE COUNT SUMMARY ===');
    console.warn('Tiles by zoom level:', tilesByZoom);
    console.warn(`Total tile coordinates generated: ${totalTiles}`);
    console.warn('=============================');

    return tiles;
  }

  private async extractTileSources(style: MapboxStyle): Promise<Map<string, { tiles: string[]; minzoom?: number; maxzoom?: number }>> {
    const tileSources = new Map();

    if (!style || !style.sources) {
      console.warn('Style or sources missing in extractTileSources', {
        hasStyle: !!style,
        hasSources: !!(style && style.sources),
        sourceKeys: style && style.sources ? Object.keys(style.sources) : [],
      });
      return tileSources;
    }

    console.warn('Processing sources in extractTileSources:', Object.keys(style.sources));

    for (const [sourceId, sourceConfig] of Object.entries(style.sources)) {
      const config = sourceConfig as {
        type?: string;
        url?: string;
        tiles?: string[];
        minzoom?: number;
        maxzoom?: number;
      };

      console.warn(`Processing source ${sourceId}:`, {
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
          // Filter out any idb:// URLs in case somehow a patched style was passed
          const httpTiles = config.tiles.filter((tile: string) => !tile.startsWith('idb://'));
          if (httpTiles.length > 0) {
            tileSources.set(sourceId, { ...config, tiles: httpTiles });
            console.warn(`Found tile source: ${sourceId} with direct tiles URLs:`, httpTiles[0]);
          } else {
            console.warn(`Source ${sourceId} has only idb:// URLs, skipping for download`);
          }
          continue;
        }

        // Handle TileJSON URL sources
        if (config.url) {
          console.warn(`Processing TileJSON URL for source ${sourceId}:`, config.url);

          // Filter out idb:// URLs in case somehow a patched style was passed
          if (config.url.startsWith('idb://')) {
            console.warn(`Source ${sourceId} has idb:// URL, skipping for download:`, config.url);
            continue;
          }

          try {
            // For TileJSON URLs, fetch the actual TileJSON to get real tile URLs
            let tileUrlPattern: string;
            let tiles: string[] = [];

            if (config.url.endsWith('.json') || config.url.includes('tilejson')) {
              try {
                // Fetch the TileJSON
                const tilejsonUrl = config.url.replace('tilejson+', '');
                console.warn(`Fetching TileJSON from: ${tilejsonUrl}`);
                
                const response = await fetchResourceWithRetry(tilejsonUrl, {
                  timeout: 10000,
                  retries: 2
                });
                
                if (response.type === 'json') {
                  const jsonData = response.data as unknown as { tiles?: string[] };
                  if (jsonData.tiles) {
                    tiles = jsonData.tiles;
                  }
                  tileUrlPattern = tiles[0]; // Use the first tile URL as the pattern
                  console.warn(`Got ${tiles.length} tile URLs from TileJSON:`, tiles[0]);
                } else {
                  throw new Error('Invalid TileJSON response');
                }
              } catch (tilejsonError) {
                console.warn(`Failed to fetch TileJSON from ${config.url}, falling back to pattern generation:`, tilejsonError);
                
                // Fallback to pattern generation
                if (config.url.includes('tilejson+')) {
                  tileUrlPattern = config.url
                    .replace('tilejson+', '')
                    .replace('.json', '/{z}/{x}/{y}.pbf');
                } else if (config.url.endsWith('.json')) {
                  const urlBase = config.url.substring(0, config.url.lastIndexOf('/'));
                  tileUrlPattern = `${urlBase}/{z}/{x}/{y}.pbf`;
                } else {
                  tileUrlPattern = `${config.url}/{z}/{x}/{y}.pbf`;
                }
                tiles = [tileUrlPattern];
              }
            } else {
              // Handle non-JSON URLs
              tileUrlPattern = `${config.url}/{z}/{x}/{y}.pbf`;
              tiles = [tileUrlPattern];
            }

            // Create a config with the actual tiles array
            const enhancedConfig = {
              ...config,
              tiles: tiles,
            };

            tileSources.set(sourceId, enhancedConfig);
            console.warn(
              `Enhanced tile source: ${sourceId} with tile URL pattern: ${tileUrlPattern}`
            );
          } catch (_error) {
            console.warn(`Failed to process TileJSON URL for source ${sourceId}:`, _error);

            // Fallback to a simple placeholder
            const placeholderConfig = {
              ...config,
              tiles: [config.url.replace('tilejson+', '').replace('.json', '/{z}/{x}/{y}.pbf')],
            };
            tileSources.set(sourceId, placeholderConfig);
            console.warn(`Using placeholder tile URL for source ${sourceId}`);
          }
        } else {
          console.warn(`Source ${sourceId} has no tiles or URL property`);
        }
      } else {
        console.warn(`Ignoring non-vector/raster source ${sourceId} of type ${config.type}`);
      }
    }

    if (tileSources.size === 0) {
      console.warn('No valid tile sources found in style', Object.keys(style.sources));
      // As a last resort, try to use a common vector tile source pattern if we can't extract any
      if (style.sources && Object.keys(style.sources).length > 0) {
        const firstSourceId = Object.keys(style.sources)[0];
        console.warn(`Attempting to create fallback source from ${firstSourceId}`);

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
    ext: string
  ): string {
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
