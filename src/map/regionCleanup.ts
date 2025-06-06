import { dbPromise } from '../storage/indexedDbManager';
import type { StoredRegion } from '../types';

export interface RegionCleanupOptions {
  maxAge?: number;           // Days
  maxStorageSize?: number;   // Bytes
  maxRegions?: number;       // Maximum number of regions to keep
  priorityPatterns?: string[]; // Region ID patterns to preserve
  onProgress?: (progress: { 
    phase: 'scanning' | 'analyzing' | 'cleaning';
    completed: number; 
    total: number; 
    message: string;
  }) => void;
}

export interface CleanupResult {
  scannedRegions: number;
  expiredRegions: number;
  deletedRegions: number;
  preservedRegions: number;
  freedSpace: number;
  errors: string[];
  recommendations: string[];
}

export interface RegionAnalytics {
  totalRegions: number;
  totalSize: number;
  averageSize: number;
  oldestRegion?: { id: string; created: number };
  newestRegion?: { id: string; created: number };
  largestRegion?: { id: string; size: number };
  smallestRegion?: { id: string; size: number };
  regionsByStyle: Record<string, number>;
  expiryDistribution: {
    expired: number;
    expiringWithin24h: number;
    expiringWithin7d: number;
    neverExpiring: number;
  };
}

export class RegionCleanupManager {
  private deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>;
  private autoCleanupIntervals: Set<ReturnType<typeof setInterval>> = new Set();

  constructor(deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>) {
    this.deleteRegionCallback = deleteRegionCallback;
  }

  /**
   * Get comprehensive analytics about stored regions
   */
  async getRegionAnalytics(): Promise<RegionAnalytics> {
    const db = await dbPromise;
    const allRegions = await db.getAll('regions') as StoredRegion[];
    const now = Date.now();
    
    if (allRegions.length === 0) {
      return {
        totalRegions: 0,
        totalSize: 0,
        averageSize: 0,
        regionsByStyle: {},
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 0
        }
      };
    }

    let totalSize = 0;
    const regionsByStyle: Record<string, number> = {};
    let oldestRegion: { id: string; created: number } | undefined;
    let newestRegion: { id: string; created: number } | undefined;
    let largestRegion: { id: string; size: number } | undefined;
    let smallestRegion: { id: string; size: number } | undefined;
    
    const expiryDistribution = {
      expired: 0,
      expiringWithin24h: 0,
      expiringWithin7d: 0,
      neverExpiring: 0
    };

    for (const region of allRegions) {
      // Calculate estimated region size (this is an approximation)
      const estimatedSize = this.estimateRegionSize(region);
      totalSize += estimatedSize;

      // Track by style
      const styleId = region.styleId || 'unknown';
      regionsByStyle[styleId] = (regionsByStyle[styleId] || 0) + 1;

      // Track oldest/newest
      if (!oldestRegion || region.created < oldestRegion.created) {
        oldestRegion = { id: region.key, created: region.created };
      }
      if (!newestRegion || region.created > newestRegion.created) {
        newestRegion = { id: region.key, created: region.created };
      }

      // Track largest/smallest
      if (!largestRegion || estimatedSize > largestRegion.size) {
        largestRegion = { id: region.key, size: estimatedSize };
      }
      if (!smallestRegion || estimatedSize < smallestRegion.size) {
        smallestRegion = { id: region.key, size: estimatedSize };
      }

      // Analyze expiry
      if (region.expiry) {
        const timeToExpiry = region.expiry - now;
        if (timeToExpiry <= 0) {
          expiryDistribution.expired++;
        } else if (timeToExpiry <= 24 * 60 * 60 * 1000) {
          expiryDistribution.expiringWithin24h++;
        } else if (timeToExpiry <= 7 * 24 * 60 * 60 * 1000) {
          expiryDistribution.expiringWithin7d++;
        }
      } else {
        expiryDistribution.neverExpiring++;
      }
    }

    return {
      totalRegions: allRegions.length,
      totalSize,
      averageSize: allRegions.length > 0 ? totalSize / allRegions.length : 0,
      oldestRegion,
      newestRegion,
      largestRegion,
      smallestRegion,
      regionsByStyle,
      expiryDistribution
    };
  }

  /**
   * Enhanced cleanup with comprehensive options
   */
  async smartCleanup(options: RegionCleanupOptions = {}): Promise<CleanupResult> {
    const {
      maxAge = 30,
      maxStorageSize,
      maxRegions,
      priorityPatterns = [],
      onProgress
    } = options;

    const result: CleanupResult = {
      scannedRegions: 0,
      expiredRegions: 0,
      deletedRegions: 0,
      preservedRegions: 0,
      freedSpace: 0,
      errors: [],
      recommendations: []
    };

    try {
      // Phase 1: Scan and analyze
      onProgress?.({ phase: 'scanning', completed: 0, total: 1, message: 'Scanning regions...' });
      
      const db = await dbPromise;
      const allRegions = await db.getAll('regions') as StoredRegion[];
      result.scannedRegions = allRegions.length;

      if (allRegions.length === 0) {
        return result;
      }

      onProgress?.({ phase: 'analyzing', completed: 0, total: allRegions.length, message: 'Analyzing regions...' });

      const now = Date.now();
      const cutoffTime = now - (maxAge * 24 * 60 * 60 * 1000);
      
      // Categorize regions
      const expiredRegions: StoredRegion[] = [];
      const oldRegions: StoredRegion[] = [];
      const priorityRegions: StoredRegion[] = [];
      const normalRegions: StoredRegion[] = [];

      for (const region of allRegions) {
        // Check if expired
        if (region.expiry && region.expiry < now) {
          expiredRegions.push(region);
          result.expiredRegions++;
        }
        // Check if old by age
        else if (region.created < cutoffTime) {
          oldRegions.push(region);
        }
        // Check if priority
        else if (priorityPatterns.some(pattern => region.key.includes(pattern))) {
          priorityRegions.push(region);
        }
        else {
          normalRegions.push(region);
        }
      }

      // Phase 2: Determine what to delete
      const regionsToDelete: StoredRegion[] = [];

      // Always delete expired regions with deleteOnExpiry=true
      regionsToDelete.push(...expiredRegions.filter(r => r.deleteOnExpiry === true));

      // Delete old regions if over limits
      if (maxRegions && allRegions.length > maxRegions) {
        const excessCount = allRegions.length - maxRegions;
        const candidates = [...oldRegions, ...normalRegions]
          .sort((a, b) => a.created - b.created); // Oldest first
        regionsToDelete.push(...candidates.slice(0, excessCount));
      }

      // Delete by storage size if over limit
      if (maxStorageSize) {
        const totalSize = allRegions.reduce((sum, region) => sum + this.estimateRegionSize(region), 0);
        if (totalSize > maxStorageSize) {
          let currentSize = totalSize;
          const candidates = [...oldRegions, ...normalRegions]
            .sort((a, b) => this.estimateRegionSize(b) - this.estimateRegionSize(a)); // Largest first
          
          for (const region of candidates) {
            if (currentSize <= maxStorageSize) break;
            if (!regionsToDelete.includes(region)) {
              regionsToDelete.push(region);
              currentSize -= this.estimateRegionSize(region);
            }
          }
        }
      }

      // Remove duplicates and preserve priority regions
      const uniqueRegionsToDelete = regionsToDelete
        .filter((region, index, array) => 
          array.findIndex(r => r.key === region.key) === index
        )
        .filter(region => !priorityPatterns.some(pattern => region.key.includes(pattern)));

      // Phase 3: Delete regions
      onProgress?.({ phase: 'cleaning', completed: 0, total: uniqueRegionsToDelete.length, message: 'Deleting regions...' });

      for (let i = 0; i < uniqueRegionsToDelete.length; i++) {
        const region = uniqueRegionsToDelete[i];
        try {
          await this.deleteRegionCallback(region.key, region.styleId);
          await db.delete('regions', region.key);
          
          result.deletedRegions++;
          result.freedSpace += this.estimateRegionSize(region);
          
          onProgress?.({
            phase: 'cleaning',
            completed: i + 1,
            total: uniqueRegionsToDelete.length,
            message: `Deleted region ${region.key}`
          });
        } catch (error) {
          result.errors.push(`Failed to delete region ${region.key}: ${error}`);
        }
      }

      result.preservedRegions = result.scannedRegions - result.deletedRegions;

      // Generate recommendations
      this.generateRecommendations(result, allRegions, options);

      return result;
    } catch (error) {
      result.errors.push(`Cleanup failed: ${error}`);
      return result;
    }
  }

  /**
   * Clean up expired regions automatically
   * Only deletes regions that have deleteOnExpiry set to true
   * Should be called periodically by the application
   */
  async cleanupExpiredRegions(): Promise<number> {
    const db = await dbPromise;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Get all regions from the regions table
      const allRegions = await db.getAll('regions');

      for (const region of allRegions) {
        // Only delete if the region is expired AND deleteOnExpiry is true
        if (
          region.expiry &&
          region.expiry < now &&
          region.deleteOnExpiry === true
        ) {
          console.log(
            `Auto-cleaning expired region: ${region.key} (deleteOnExpiry: true)`,
          );

          // Delete the region and its associated resources
          await this.deleteRegionCallback(region.key, region.styleId);
          await db.delete('regions', region.key);
          cleanedCount++;
        } else if (region.expiry && region.expiry < now) {
          console.log(
            `Expired region ${region.key} found but deleteOnExpiry is false - skipping auto-deletion`,
          );
        }
      }

      console.log(`Auto-cleanup: Removed ${cleanedCount} expired regions`);
      return cleanedCount;
    } catch (error) {
      console.error('Error during cleanup of expired regions:', error);
      return 0;
    }
  }

  /**
   * Manually clean up expired regions regardless of deleteOnExpiry setting
   * Useful for manual cleanup operations
   */
  async forceCleanupExpiredRegions(): Promise<number> {
    const db = await dbPromise;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Get all regions from the regions table
      const allRegions = await db.getAll('regions');

      for (const region of allRegions) {
        if (region.expiry && region.expiry < now) {
          console.log(`Force-cleaning expired region: ${region.key}`);

          // Delete the region and its associated resources
          await this.deleteRegionCallback(region.key, region.styleId);
          await db.delete('regions', region.key);
          cleanedCount++;
        }
      }

      console.log(`Force cleanup: Removed ${cleanedCount} expired regions`);
      return cleanedCount;
    } catch (error) {
      console.error('Error during force cleanup of expired regions:', error);
      return 0;
    }
  }

  /**
   * Get all expired regions (both auto-deletable and manual-only)
   */
  async getExpiredRegions(): Promise<{
    autoDelete: StoredRegion[];
    manualOnly: StoredRegion[];
  }> {
    const db = await dbPromise;
    const now = Date.now();
    const allRegions = await db.getAll('regions');

    const autoDelete: StoredRegion[] = [];
    const manualOnly: StoredRegion[] = [];

    for (const region of allRegions) {
      if (region.expiry && region.expiry < now) {
        if (region.deleteOnExpiry === true) {
          autoDelete.push(region);
        } else {
          manualOnly.push(region);
        }
      }
    }

    return { autoDelete, manualOnly };
  }

  /**
   * Get region expiry information
   */
  async getRegionExpiry(
    regionId: string,
  ): Promise<{ expiry: number; expired: boolean } | null> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);

    if (!region || !region.expiry) {
      return null;
    }

    return {
      expiry: region.expiry,
      expired: region.expiry < Date.now(),
    };
  }

  /**
   * Extend region expiry by the default expiry time
   */
  async extendRegionExpiry(regionId: string, newExpiry: number): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);

    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    const updatedExpiry = Date.now() + newExpiry;

    // Update the region in the regions table
    await db.put('regions', { ...region, expiry: updatedExpiry });

    // Also update the region in the style's regions array
    if (region.styleId) {
      const styleEntry = await db.get('styles', region.styleId);
      if (
        styleEntry &&
        typeof styleEntry === 'object' &&
        'regions' in styleEntry
      ) {
        const regions = styleEntry.regions || [];
        const regionIndex = regions.findIndex(
          (r: any) => r.regionId === regionId,
        );
        if (regionIndex !== -1) {
          regions[regionIndex].expiry = newExpiry;
          await db.put('styles', { ...styleEntry, regions });
        }
      }
    }

    console.log(
      `Extended expiry for region ${regionId} to ${new Date(newExpiry).toISOString()}`,
    );
  }

  /**
   * Start automatic cleanup of expired regions with enhanced options
   * @param intervalMs How often to run cleanup (default: 1 hour)
   * @param options Additional cleanup options
   * @returns Cleanup interval ID that can be used with clearInterval()
   */
  startAutoCleanup(
    intervalMs: number = 1000 * 60 * 60,
    options: RegionCleanupOptions = {}
  ): ReturnType<typeof setInterval> {
    const intervalId = setInterval(async () => {
      try {
        const result = await this.smartCleanup(options);
        if (result.deletedRegions > 0) {
          console.log(`Auto-cleanup: Removed ${result.deletedRegions} regions, freed ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB`);
        }
        if (result.errors.length > 0) {
          console.warn(`Auto-cleanup encountered ${result.errors.length} errors`);
        }
      } catch (error) {
        console.error('Auto-cleanup failed:', error);
      }
    }, intervalMs);

    this.autoCleanupIntervals.add(intervalId);
    console.log(`Started enhanced auto-cleanup with interval: ${intervalMs}ms`);
    return intervalId;
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(intervalId: ReturnType<typeof setInterval>): void {
    clearInterval(intervalId);
    this.autoCleanupIntervals.delete(intervalId);
    console.log('Stopped auto-cleanup');
  }

  /**
   * Stop all automatic cleanup intervals
   */
  stopAllAutoCleanup(): void {
    for (const intervalId of this.autoCleanupIntervals) {
      clearInterval(intervalId);
    }
    this.autoCleanupIntervals.clear();
    console.log('Stopped all auto-cleanup intervals');
  }

  /**
   * Estimate region size based on bounds and zoom levels
   */
  private estimateRegionSize(region: StoredRegion): number {
    if (!region.bounds || !region.minZoom || !region.maxZoom) {
      return 10 * 1024 * 1024; // 10MB default estimate
    }

    const [[west, south], [east, north]] = region.bounds;
    const latRange = north - south;
    const lngRange = east - west;
    const area = latRange * lngRange;
    
    // Estimate based on area and zoom levels
    const zoomRange = region.maxZoom - region.minZoom + 1;
    const tileCount = Math.pow(4, zoomRange) * area / 360; // Rough approximation
    const avgTileSize = 20 * 1024; // 20KB average tile size
    
    return Math.max(tileCount * avgTileSize, 1024 * 1024); // Minimum 1MB
  }

  /**
   * Generate cleanup recommendations
   */
  private generateRecommendations(
    result: CleanupResult, 
    allRegions: StoredRegion[], 
    options: RegionCleanupOptions
  ): void {
    const now = Date.now();
    
    // Check for regions expiring soon
    const soonToExpire = allRegions.filter(region => 
      region.expiry && region.expiry - now < 24 * 60 * 60 * 1000 && region.expiry > now
    );
    
    if (soonToExpire.length > 0) {
      result.recommendations.push(`${soonToExpire.length} regions will expire within 24 hours`);
    }

    // Check for old regions without expiry
    const oldWithoutExpiry = allRegions.filter(region => 
      !region.expiry && region.created < now - 30 * 24 * 60 * 60 * 1000
    );
    
    if (oldWithoutExpiry.length > 0) {
      result.recommendations.push(`${oldWithoutExpiry.length} old regions have no expiry date set`);
    }

    // Check storage usage
    const totalEstimatedSize = allRegions.reduce((sum, region) => sum + this.estimateRegionSize(region), 0);
    if (totalEstimatedSize > 500 * 1024 * 1024) { // > 500MB
      result.recommendations.push(`Total estimated storage usage is high: ${(totalEstimatedSize / 1024 / 1024).toFixed(1)}MB`);
    }

    // Check for duplicate regions
    const regionKeys = new Set();
    const duplicates = allRegions.filter(region => {
      const boundsKey = JSON.stringify(region.bounds);
      if (regionKeys.has(boundsKey)) {
        return true;
      }
      regionKeys.add(boundsKey);
      return false;
    });
    
    if (duplicates.length > 0) {
      result.recommendations.push(`${duplicates.length} potentially duplicate regions found`);
    }

    // Performance recommendations
    if (allRegions.length > 50) {
      result.recommendations.push('Consider setting up automatic cleanup for better performance');
    }
  }
}
