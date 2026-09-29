import { dbPromise } from '@/storage/indexedDbManager';
import { logger } from '@/utils';
import { parseTileKey } from '@/utils/tileKey';
import { loadAllStoredRegions, resourceKeyBelongsToStyle } from '@/services/regionService';
import { tileBelongsToRegion, type SourceZoomConfig } from '@/utils/tileRange';
import type {
  StoredRegion,
  RegionCleanupOptions,
  CleanupResult,
  RegionAnalytics,
  OfflineRegionOptions,
} from '@/types';

const cleanupLogger = logger.scope('CleanupService');

export class CleanupService {
  private db = dbPromise;
  private deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>;
  private autoCleanupIntervals: Set<ReturnType<typeof setInterval>> = new Set();
  private autoCleanupIdMap: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>) {
    this.deleteRegionCallback = deleteRegionCallback;
  }

  async runCleanup(options: RegionCleanupOptions = {}): Promise<CleanupResult> {
    const { onProgress, maxAge, maxStorageSize, maxRegions, priorityPatterns = [] } = options;

    const result: CleanupResult = {
      scannedRegions: 0,
      expiredRegions: 0,
      deletedRegions: 0,
      preservedRegions: 0,
      freedSpace: 0,
      errors: [],
      recommendations: [],
    };

    try {
      // Phase 1: Scanning regions
      onProgress?.({
        phase: 'scanning',
        completed: 0,
        total: 100,
        message: 'Scanning offline regions...',
      });

      const regions = await this.getAllRegions();
      result.scannedRegions = regions.length;

      if (regions.length === 0) {
        return result;
      }

      // Phase 2: Analyzing regions
      onProgress?.({
        phase: 'analyzing',
        completed: 30,
        total: 100,
        message: 'Analyzing region data...',
      });

      const currentTime = Date.now();
      const cutoffTime = currentTime - (maxAge ?? 30) * 24 * 60 * 60 * 1000;

      // Categorize regions
      const expiredRegions: StoredRegion[] = [];
      const priorityRegions: StoredRegion[] = [];
      const regularRegions: StoredRegion[] = [];

      for (const region of regions) {
        const isExpired = region.lastModified < cutoffTime;
        const isPriority = priorityPatterns.some(
          pattern => region.id.includes(pattern) || (region.name && region.name.includes(pattern))
        );

        if (isExpired) {
          result.expiredRegions++;
          if (!isPriority) {
            expiredRegions.push(region);
          } else {
            priorityRegions.push(region);
          }
        } else {
          if (isPriority) {
            priorityRegions.push(region);
          } else {
            regularRegions.push(region);
          }
        }
      }

      // Phase 3: Cleanup based on criteria
      onProgress?.({
        phase: 'cleaning',
        completed: 60,
        total: 100,
        message: 'Cleaning up regions...',
      });

      const regionsToDelete: StoredRegion[] = [...expiredRegions];

      // Apply storage size limit
      if (maxStorageSize) {
        const currentSize = await this.calculateTotalStorageSize();
        if (currentSize > maxStorageSize) {
          const excessSize = currentSize - maxStorageSize;
          const additionalRegions = await this.selectRegionsForDeletion(
            regularRegions,
            excessSize,
            priorityPatterns
          );
          regionsToDelete.push(...additionalRegions);
        }
      }

      // Apply region count limit
      if (maxRegions && regions.length > maxRegions) {
        const excessCount = regions.length - maxRegions;
        const additionalRegions = regularRegions
          .sort((a, b) => a.lastModified - b.lastModified) // Oldest first
          .slice(0, Math.max(0, excessCount - regionsToDelete.length));
        regionsToDelete.push(...additionalRegions);
      }

      // Remove duplicates
      const uniqueRegionsToDelete = Array.from(
        new Map(regionsToDelete.map(r => [r.id, r])).values()
      );

      // Delete regions
      let deletedCount = 0;
      for (const region of uniqueRegionsToDelete) {
        try {
          const bytesBefore = await this.getStyleStoredBytes(region.styleId);
          await this.deleteRegionCallback(region.id, region.styleId);
          result.freedSpace += Math.max(
            0,
            bytesBefore - (await this.getStyleStoredBytes(region.styleId))
          );
          deletedCount++;

          onProgress?.({
            phase: 'cleaning',
            completed: 60 + Math.floor((deletedCount / uniqueRegionsToDelete.length) * 30),
            total: 100,
            message: `Deleted region: ${region.name || region.id}`,
          });
        } catch (error) {
          result.errors.push(`Failed to delete region ${region.id}: ${error}`);
        }
      }

      result.deletedRegions = deletedCount;
      result.preservedRegions = regions.length - deletedCount;

      // Generate recommendations
      result.recommendations = await this.generateRecommendations(regions, options);

      onProgress?.({
        phase: 'cleaning',
        completed: 100,
        total: 100,
        message: 'Cleanup completed',
      });
    } catch (error) {
      result.errors.push(`Cleanup failed: ${error}`);
    }

    return result;
  }

  async performCleanup(options: RegionCleanupOptions = {}): Promise<CleanupResult> {
    return this.runCleanup(options);
  }

  async getRegionAnalytics(): Promise<RegionAnalytics> {
    const regions = await this.getAllRegions();

    if (regions.length === 0) {
      return {
        totalRegions: 0,
        totalSize: 0,
        averageSize: 0,
        regionsByStyle: {},
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 0,
        },
      };
    }

    let totalSize = 0;
    const regionsByStyle: Record<string, number> = {};
    let oldestRegion: { id: string; created: number } | undefined;
    let newestRegion: { id: string; created: number } | undefined;
    let largestRegion: { id: string; size: number } | undefined;
    let smallestRegion: { id: string; size: number } | undefined;

    const currentTime = Date.now();
    const day24h = 24 * 60 * 60 * 1000;
    const day7d = 7 * day24h;
    const expiryDistribution = {
      expired: 0,
      expiringWithin24h: 0,
      expiringWithin7d: 0,
      neverExpiring: 0,
    };

    for (const region of regions) {
      const regionSize = await this.getRegionSize(region.id, region.styleId);
      totalSize += regionSize;

      // Track by style
      const styleId = region.styleId || 'unknown';
      regionsByStyle[styleId] = (regionsByStyle[styleId] || 0) + 1;

      // Track oldest and newest
      if (!oldestRegion || region.created < oldestRegion.created) {
        oldestRegion = { id: region.id, created: region.created };
      }
      if (!newestRegion || region.created > newestRegion.created) {
        newestRegion = { id: region.id, created: region.created };
      }

      // Track largest and smallest
      if (!largestRegion || regionSize > largestRegion.size) {
        largestRegion = { id: region.id, size: regionSize };
      }
      if (!smallestRegion || regionSize < smallestRegion.size) {
        smallestRegion = { id: region.id, size: regionSize };
      }

      // Track expiry distribution using the actual expiry timestamp
      if (region.expiry) {
        const timeUntilExpiry = region.expiry - currentTime;
        if (timeUntilExpiry <= 0) {
          expiryDistribution.expired++;
        } else if (timeUntilExpiry <= day24h) {
          expiryDistribution.expiringWithin24h++;
        } else if (timeUntilExpiry <= day7d) {
          expiryDistribution.expiringWithin7d++;
        } else {
          expiryDistribution.neverExpiring++;
        }
      } else {
        expiryDistribution.neverExpiring++;
      }
    }

    return {
      totalRegions: regions.length,
      totalSize,
      averageSize: totalSize / regions.length,
      oldestRegion,
      newestRegion,
      largestRegion,
      smallestRegion,
      regionsByStyle,
      expiryDistribution,
    };
  }

  async setupAutoCleanup(
    options: RegionCleanupOptions & { intervalHours?: number } = {}
  ): Promise<string> {
    const { intervalHours = 24, ...cleanupOptions } = options;

    const intervalId = setInterval(
      async () => {
        try {
          cleanupLogger.info('Running automatic cleanup...');
          const result = await this.performCleanup(cleanupOptions);
          cleanupLogger.info('Auto cleanup completed:', result);
        } catch (error) {
          cleanupLogger.error('Auto cleanup failed:', error);
        }
      },
      intervalHours * 60 * 60 * 1000
    );

    this.autoCleanupIntervals.add(intervalId);

    const cleanupId = `auto_cleanup_${Date.now()}`;
    this.autoCleanupIdMap.set(cleanupId, intervalId);

    return cleanupId;
  }

  async stopAutoCleanup(cleanupId?: string): Promise<void> {
    if (cleanupId) {
      const intervalId = this.autoCleanupIdMap.get(cleanupId);
      if (intervalId) {
        clearInterval(intervalId);
        this.autoCleanupIntervals.delete(intervalId);
        this.autoCleanupIdMap.delete(cleanupId);
        cleanupLogger.debug(`Stopped cleanup ${cleanupId}`);
      }
    } else {
      // Stop all auto cleanups
      for (const intervalId of this.autoCleanupIntervals) {
        clearInterval(intervalId);
      }
      this.autoCleanupIntervals.clear();
      this.autoCleanupIdMap.clear();
    }
  }

  async optimizeStorage(): Promise<{ compactedSize: number; freedSpace: number }> {
    // This would implement storage optimization like compacting databases
    // For now, return placeholder values
    return {
      compactedSize: 0,
      freedSpace: 0,
    };
  }

  /**
   * Count expired resources across all stores based on their `expires` field.
   * Returns a breakdown by store and the total count.
   */
  async getExpiredResourceCount(): Promise<{
    tiles: number;
    fonts: number;
    sprites: number;
    glyphs: number;
    models: number;
    total: number;
  }> {
    const db = await this.db;
    const now = Date.now();
    const counts = { tiles: 0, fonts: 0, sprites: 0, glyphs: 0, models: 0, total: 0 };

    const stores = ['tiles', 'fonts', 'sprites', 'glyphs', 'models'] as const;

    for (const storeName of stores) {
      try {
        const tx = db.transaction([storeName], 'readonly');
        for await (const cursor of tx.objectStore(storeName)) {
          const entry = cursor.value as { expires?: number };
          if (entry.expires && entry.expires < now) {
            counts[storeName]++;
            counts.total++;
          }
        }
      } catch (error) {
        cleanupLogger.warn(`Could not scan expired resources in ${storeName}:`, error);
      }
    }

    return counts;
  }

  /**
   * Delete expired tiles for a given style, prioritizing them for eviction.
   * Returns the number of tiles deleted and space freed.
   */
  async cleanupExpiredTiles(styleId?: string): Promise<{ deleted: number; freedSpace: number }> {
    const db = await this.db;
    const now = Date.now();
    let deleted = 0;
    let freedSpace = 0;

    const tx = db.transaction('tiles', 'readwrite');
    for await (const cursor of tx.objectStore('tiles')) {
      const tile = cursor.value as { expires?: number; size?: number; styleId?: string };
      if (styleId && tile.styleId !== styleId) continue;
      if (tile.expires && tile.expires < now) {
        freedSpace += tile.size || 0;
        await cursor.delete();
        deleted++;
      }
    }

    if (deleted > 0) {
      cleanupLogger.info(
        `Cleaned up ${deleted} expired tiles, freed ${(freedSpace / 1024).toFixed(1)}KB`
      );
    }

    return { deleted, freedSpace };
  }

  async getAllRegions(): Promise<StoredRegion[]> {
    return loadAllStoredRegions();
  }

  /**
   * Bytes of the tiles stored for a region: tiles on its style inside its
   * bounds, at the zooms the download pipeline fetched for each source. Tiles
   * are stored per style, so regions that overlap share (and both count)
   * their common tiles; shared style resources are not included.
   */
  async getRegionSize(regionId: string, styleIdParam?: string): Promise<number> {
    const db = await this.db;

    const candidates = styleIdParam
      ? [await db.get('styles', styleIdParam)]
      : await db.getAll('styles');
    let styleEntry: (typeof candidates)[number];
    let region: OfflineRegionOptions | undefined;
    for (const entry of candidates) {
      region = entry?.regions?.find(
        (r: OfflineRegionOptions & { regionId?: string }) =>
          r.id === regionId || r.regionId === regionId
      );
      if (region) {
        styleEntry = entry;
        break;
      }
    }
    if (!styleEntry || !region) {
      return 0;
    }

    const styleId = styleEntry.key;
    const sources = (styleEntry.style?.sources ?? {}) as Record<
      string,
      SourceZoomConfig | undefined
    >;
    let totalSize = 0;
    const tx = db.transaction(['tiles'], 'readonly');
    for await (const cursor of tx.objectStore('tiles')) {
      const tile = cursor.value;
      if (tile.styleId !== styleId) continue;
      const parsed = parseTileKey(tile.key);
      if (!parsed) continue;
      const coords = {
        sourceId: tile.sourceId ?? parsed.sourceId,
        z: parsed.z,
        x: parsed.x,
        y: parsed.y,
      };
      if (tileBelongsToRegion(coords, region, sources)) {
        totalSize += tile.size || 0;
      }
    }

    return totalSize;
  }

  /**
   * Bytes stored for a style: its tiles plus the fonts, glyphs, sprites and
   * models keyed to it. Measured before and after a deletion to report the
   * space actually freed (a region's own size over-counts tiles it shares).
   */
  private async getStyleStoredBytes(styleId: string | undefined): Promise<number> {
    if (!styleId) return 0;
    const db = await this.db;
    let total = 0;

    const tx = db.transaction(['tiles'], 'readonly');
    for await (const cursor of tx.objectStore('tiles')) {
      if (cursor.value.styleId === styleId) total += cursor.value.size || 0;
    }

    for (const storeName of ['fonts', 'glyphs', 'sprites', 'models'] as const) {
      const storeTx = db.transaction([storeName], 'readonly');
      for await (const cursor of storeTx.objectStore(storeName)) {
        const entry = cursor.value as { key: string; size?: number };
        if (resourceKeyBelongsToStyle(entry.key, styleId)) total += entry.size || 0;
      }
    }

    return total;
  }

  private async calculateTotalStorageSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }

    // Fallback: calculate from database
    const db = await this.db;
    let totalSize = 0;

    const stores: Array<'tiles' | 'fonts' | 'sprites' | 'glyphs' | 'models' | 'styles'> = [
      'tiles',
      'fonts',
      'sprites',
      'glyphs',
      'models',
      'styles',
    ];

    for (const storeName of stores) {
      try {
        const tx = db.transaction([storeName], 'readonly');
        let cursor = await tx.objectStore(storeName).openCursor();

        while (cursor) {
          const entry = cursor.value;
          // Only some entry types have size property
          if ('size' in entry && typeof entry.size === 'number') {
            totalSize += entry.size;
          }
          cursor = await cursor.continue();
        }
      } catch (error) {
        cleanupLogger.warn(`Could not calculate size for store ${storeName}:`, error);
      }
    }

    return totalSize;
  }

  private async selectRegionsForDeletion(
    regions: StoredRegion[],
    targetSize: number,
    priorityPatterns: string[]
  ): Promise<StoredRegion[]> {
    // Sort by priority (non-priority first) and then by last modified (oldest first)
    const sortedRegions = regions
      .map(region => ({
        region,
        isPriority: priorityPatterns.some(
          pattern => region.id.includes(pattern) || (region.name && region.name.includes(pattern))
        ),
      }))
      .sort((a, b) => {
        if (a.isPriority !== b.isPriority) {
          return a.isPriority ? 1 : -1; // Non-priority first
        }
        return a.region.lastModified - b.region.lastModified; // Oldest first
      })
      .map(item => item.region);

    const selected: StoredRegion[] = [];
    let currentSize = 0;

    for (const region of sortedRegions) {
      if (currentSize >= targetSize) break;
      selected.push(region);
      const regionSize = await this.getRegionSize(region.id, region.styleId);
      currentSize += regionSize > 0 ? regionSize : 10 * 1024 * 1024; // Fallback to 10MB if size unknown
    }

    return selected;
  }

  private async generateRecommendations(
    regions: StoredRegion[],
    options: RegionCleanupOptions
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (regions.length === 0) {
      recommendations.push(
        'No offline regions found. Consider downloading some maps for offline use.'
      );
      return recommendations;
    }

    const analytics = await this.getRegionAnalytics();

    // Storage recommendations
    if (analytics.totalSize > 1024 * 1024 * 1024) {
      // > 1GB
      recommendations.push('Consider cleaning up old regions to free up storage space.');
    }

    // Expiry recommendations
    if (analytics.expiryDistribution.expired > 0) {
      recommendations.push(
        `${analytics.expiryDistribution.expired} regions have expired and can be safely deleted.`
      );
    }

    if (analytics.expiryDistribution.expiringWithin7d > 0) {
      recommendations.push(
        `${analytics.expiryDistribution.expiringWithin7d} regions will expire within 7 days.`
      );
    }

    // Size recommendations
    if (analytics.largestRegion && analytics.smallestRegion) {
      const sizeDiff =
        analytics.smallestRegion.size > 0
          ? analytics.largestRegion.size / analytics.smallestRegion.size
          : 0;
      if (sizeDiff > 100) {
        recommendations.push(
          'Consider reviewing large regions that may contain unnecessary detail levels.'
        );
      }
    }

    // Auto-cleanup recommendations
    if (!options.maxAge && !options.maxStorageSize) {
      recommendations.push('Consider setting up automatic cleanup with age or size limits.');
    }

    return recommendations;
  }
}

// Export functions for backward compatibility
export const cleanupService = new CleanupService(async (_regionId: string, _styleId?: string) => {
  // This will be implemented by RegionService
  cleanupLogger.warn('CleanupService: Region deletion not implemented');
});

export const performCleanup = (options?: RegionCleanupOptions) =>
  cleanupService.performCleanup(options);

export const getRegionAnalytics = () => cleanupService.getRegionAnalytics();
export const setupAutoCleanup = (options?: RegionCleanupOptions & { intervalHours?: number }) =>
  cleanupService.setupAutoCleanup(options);
export const stopAutoCleanup = (cleanupId?: string) => cleanupService.stopAutoCleanup(cleanupId);
export const optimizeStorage = () => cleanupService.optimizeStorage();
export const getExpiredResourceCount = () => cleanupService.getExpiredResourceCount();
export const cleanupExpiredTiles = (styleId?: string) =>
  cleanupService.cleanupExpiredTiles(styleId);
