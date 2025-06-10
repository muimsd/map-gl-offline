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
      onProgress,
      batchSize = 20,
      maxRetries = 3,
      skipExisting = true,
      maxConcurrency = 10,
      retryDelay = 1000,
      timeout = 15000,
      validateTiles = true,
      compressTiles = false,
      priorityZoomLevels = [],
      bandwidthLimit,
      storageQuotaCheck = true,
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedTiles = 0;
    let skippedTiles = 0;
    let failedTiles = 0;
    const errors: Array<{ url: string; error: string }> = [];

    // Generate tile coordinates
    const tileCoords = this.generateTileCoordinates(region);
    console.warn(`Generated ${tileCoords.length} tile coordinates for region:`, region.id);

    // Create progress tracker
    const progressTracker = createProgressTracker(tileCoords.length);

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

    // Get tile sources from style
    const tileSources = this.extractTileSources(style);
    console.warn(`Found ${tileSources.size} tile sources:`, Array.from(tileSources.keys()));

    // Process tiles for each source
    for (const [sourceId, sourceConfig] of tileSources) {
      if (!sourceConfig.tiles || sourceConfig.tiles.length === 0) continue;

      const tileUrlTemplate = sourceConfig.tiles[0];

      // Filter existing tiles if skipExisting is true
      let coordsToDownload = tileCoords;
      if (skipExisting) {
        const existingTiles = await this.getExistingTileKeys(styleId, sourceId);
        coordsToDownload = tileCoords.filter(coord => {
          const key = this.createTileKey(coord.x, coord.y, coord.z, styleId, sourceId);
          return !existingTiles.has(key);
        });
        skippedTiles += tileCoords.length - coordsToDownload.length;
      }

      // Process tiles in batches with concurrency control
      await processBatch(
        coordsToDownload,
        async coord => {
          try {
            const { x, y, z } = coord;
            const tileUrl = tileUrlTemplate
              .replace('{x}', x.toString())
              .replace('{y}', y.toString())
              .replace('{z}', z.toString());

            const tileKey = this.createTileKey(x, y, z, styleId, sourceId);

            progressTracker.update(1, `Downloading tile ${z}/${x}/${y}`);

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
              styleId,
              sourceId,
            };

            // Store tile in database
            await db.put('tiles', tileEntry);

            totalSize += tileData.byteLength;
            downloadedTiles++;
          } catch (error) {
            failedTiles++;
            const tileUrl = tileUrlTemplate
              .replace('{x}', coord.x.toString())
              .replace('{y}', coord.y.toString())
              .replace('{z}', coord.z.toString());

            errors.push({
              url: tileUrl,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(`Failed to download tile ${coord.z}/${coord.x}/${coord.y}:`, error);
          }
        },
        { batchSize }
      );
    }

    const downloadTime = Date.now() - startTime;
    const averageSpeed = downloadTime > 0 ? (totalSize / 1024 / downloadTime) * 1000 : 0;

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

    for (let z = region.minZoom; z <= region.maxZoom; z++) {
      const bounds = region.bounds;
      const minTile = tilebelt.pointToTile(bounds[0][0], bounds[0][1], z);
      const maxTile = tilebelt.pointToTile(bounds[1][0], bounds[1][1], z);

      for (let x = Math.min(minTile[0], maxTile[0]); x <= Math.max(minTile[0], maxTile[0]); x++) {
        for (let y = Math.min(minTile[1], maxTile[1]); y <= Math.max(minTile[1], maxTile[1]); y++) {
          tiles.push({ x, y, z });
        }
      }
    }

    return tiles;
  }

  private extractTileSources(style: MapboxStyle): Map<string, any> {
    const tileSources = new Map();

    if (style.sources) {
      for (const [sourceId, sourceConfig] of Object.entries(style.sources)) {
        const config = sourceConfig as any;
        if (config.type === 'vector' || config.type === 'raster') {
          tileSources.set(sourceId, config);
        }
      }
    }

    return tileSources;
  }

  private createTileKey(
    x: number,
    y: number,
    z: number,
    styleId: string,
    sourceId: string
  ): string {
    return `${styleId}:${sourceId}:${z}:${x}:${y}`;
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

  private async compressTile(data: ArrayBuffer, contentType: string): Promise<ArrayBuffer> {
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
