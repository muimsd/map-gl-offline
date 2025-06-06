import { dbPromise } from '../storage/indexedDbManager';
import type { StoredRegion } from '../types';

export class RegionCleanupManager {
  private deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>;

  constructor(deleteRegionCallback: (regionId: string, styleId?: string) => Promise<void>) {
    this.deleteRegionCallback = deleteRegionCallback;
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
   * Start automatic cleanup of expired regions
   * @param intervalMs How often to run cleanup (default: 1 hour)
   * @returns Cleanup interval ID that can be used with clearInterval()
   */
  startAutoCleanup(
    intervalMs: number = 1000 * 60 * 60,
  ): ReturnType<typeof setInterval> {
    const intervalId = setInterval(async () => {
      try {
        const cleanedCount = await this.cleanupExpiredRegions();
        if (cleanedCount > 0) {
          console.log(`Auto-cleanup: Removed ${cleanedCount} expired regions`);
        }
      } catch (error) {
        console.error('Auto-cleanup failed:', error);
      }
    }, intervalMs);

    console.log(`Started auto-cleanup with interval: ${intervalMs}ms`);
    return intervalId;
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(intervalId: ReturnType<typeof setInterval>): void {
    clearInterval(intervalId);
    console.log('Stopped auto-cleanup');
  }
}
