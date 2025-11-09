import type { CleanupResult, RegionAnalytics, RegionCleanupOptions } from '../../types';
import type { OfflineManagerServices } from './base';

export interface CleanupManagement {
  getRegionSize(regionId: string): Promise<number>;
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
  getRegionSize: async (regionId: string) => services.cleanupService.getRegionSize(regionId),
  cleanupExpiredRegions: async () => {
    const result = await services.cleanupService.performCleanup({ maxAge: 30 });
    return result.deletedRegions;
  },
  forceCleanupExpiredRegions: async () => {
    const result = await services.cleanupService.performCleanup({ maxAge: 0 });
    return result.deletedRegions;
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
