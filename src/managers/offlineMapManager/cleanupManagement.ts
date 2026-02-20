import type { CleanupResult, RegionAnalytics, RegionCleanupOptions } from '@/types';
import type { OfflineManagerServices } from './base';

export interface CleanupManagement {
  getRegionSize(regionId: string, styleId?: string): Promise<number>;
  cleanupExpiredRegions(): Promise<number>;
  forceCleanupExpiredRegions(): Promise<number>;
  setupAutoCleanup(options?: RegionCleanupOptions & { intervalHours?: number }): Promise<string>;
  stopAutoCleanup(cleanupId?: string): Promise<void>;
  getRegionAnalytics(): Promise<RegionAnalytics>;
  performSmartCleanup(options?: RegionCleanupOptions): Promise<CleanupResult>;
  startEnhancedAutoCleanup(intervalHours?: number, options?: RegionCleanupOptions): Promise<string>;
  stopAllAutoCleanup(): Promise<void>;
}

export const createCleanupManagement = (services: OfflineManagerServices): CleanupManagement => ({
  getRegionSize: async (regionId: string, styleId?: string) =>
    services.cleanupService.getRegionSize(regionId, styleId),
  cleanupExpiredRegions: async () => {
    const result = await services.cleanupService.performCleanup({ maxAge: 30 });
    return result.deletedRegions;
  },
  forceCleanupExpiredRegions: async () => {
    // Clean up regions that have actually passed their expiry date
    const allRegions = await services.cleanupService.getAllRegions();
    const now = Date.now();
    let deletedCount = 0;
    for (const region of allRegions) {
      if (region.expiry && region.expiry < now) {
        await services.regionService.deleteRegion(region.id);
        deletedCount++;
      }
    }
    return deletedCount;
  },
  setupAutoCleanup: async (options: RegionCleanupOptions & { intervalHours?: number } = {}) =>
    services.cleanupService.setupAutoCleanup(options),
  stopAutoCleanup: async (cleanupId?: string) => services.cleanupService.stopAutoCleanup(cleanupId),
  getRegionAnalytics: async () => services.cleanupService.getRegionAnalytics(),
  performSmartCleanup: async (options: RegionCleanupOptions = {}) =>
    services.cleanupService.performCleanup(options),
  startEnhancedAutoCleanup: async (
    intervalHours: number = 24,
    options: RegionCleanupOptions = {}
  ) => services.cleanupService.setupAutoCleanup({ ...options, intervalHours }),
  stopAllAutoCleanup: async () => services.cleanupService.stopAutoCleanup(),
});
