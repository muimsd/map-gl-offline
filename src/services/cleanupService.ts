import { dbPromise } from '../storage/indexedDbManager';
import { logger } from '../utils';
import type { StoredRegion, RegionCleanupOptions, CleanupResult, RegionAnalytics } from '../types';

const cleanupLogger = logger.scope('CleanupService');

export class CleanupService {
  private db = dbPromise;
  private deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>;
  private autoCleanupIntervals: Set<ReturnType<typeof setInterval>> = new Set();

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
          const additionalRegions = this.selectRegionsForDeletion(
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
          const regionSize = await this.getRegionSize(region.id);
          await this.deleteRegionCallback(region.id, region.styleId);
          result.freedSpace += regionSize;
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
      const regionSize = await this.getRegionSize(region.id);
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

      // Track expiry distribution
      const timeSinceModified = currentTime - region.lastModified;
      if (timeSinceModified > 30 * day24h) {
        expiryDistribution.expired++;
      } else if (timeSinceModified > 30 * day24h - day24h) {
        expiryDistribution.expiringWithin24h++;
      } else if (timeSinceModified > 30 * day24h - day7d) {
        expiryDistribution.expiringWithin7d++;
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

    return `auto_cleanup_${Date.now()}`;
  }

  async stopAutoCleanup(cleanupId?: string): Promise<void> {
    if (cleanupId) {
      // Stop specific cleanup - would need to track IDs
      cleanupLogger.debug(`Stopping cleanup ${cleanupId}`);
    } else {
      // Stop all auto cleanups
      for (const intervalId of this.autoCleanupIntervals) {
        clearInterval(intervalId);
      }
      this.autoCleanupIntervals.clear();
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

  async getAllRegions(): Promise<StoredRegion[]> {
    const db = await this.db;
    return await db.getAll('regions');
  }

  async getRegionSize(regionId: string): Promise<number> {
    const db = await this.db;
    let totalSize = 0;

    // First, get the region to find its styleId
    const region = await db.get('regions', regionId);
    if (!region) {
      return 0;
    }

    const styleId = region.styleId;
    if (!styleId) {
      return 0;
    }

    // Calculate size from tiles that belong to this style
    // Tile keys are formatted as: styleId:sourceId:z:x:y.ext
    const tx = db.transaction(['tiles'], 'readonly');
    let cursor = await tx.objectStore('tiles').openCursor();

    while (cursor) {
      const tile = cursor.value;
      // Check if the tile key starts with the styleId
      if (tile.key && tile.key.startsWith(`${styleId}:`)) {
        totalSize += tile.size || 0;
      }
      cursor = await cursor.continue();
    }

    return totalSize;
  }

  private async calculateTotalStorageSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }

    // Fallback: calculate from database
    const db = await this.db;
    let totalSize = 0;

    const stores: Array<'regions' | 'tiles' | 'fonts' | 'sprites' | 'glyphs' | 'styles'> = [
      'regions',
      'tiles',
      'fonts',
      'sprites',
      'glyphs',
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

  private selectRegionsForDeletion(
    regions: StoredRegion[],
    targetSize: number,
    priorityPatterns: string[]
  ): StoredRegion[] {
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
      // Estimate region size (would be more accurate with actual calculation)
      currentSize += 10 * 1024 * 1024; // 10MB estimate per region
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
      const sizeDiff = analytics.largestRegion.size / analytics.smallestRegion.size;
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
