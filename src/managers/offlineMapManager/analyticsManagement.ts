import type { StorageAnalyticsReport } from '@/types';
import type { OfflineManagerServices } from './base';
import type { CleanupManagement } from './cleanupManagement';

export interface AnalyticsManagement {
  getComprehensiveStorageAnalytics(): Promise<StorageAnalyticsReport>;
}

export const createAnalyticsManagement = (
  services: OfflineManagerServices,
  deps: Pick<CleanupManagement, 'getRegionAnalytics'>
): AnalyticsManagement => ({
  getComprehensiveStorageAnalytics: async () =>
    services.analyticsService.getComprehensiveStorageAnalytics(deps.getRegionAnalytics),
});
