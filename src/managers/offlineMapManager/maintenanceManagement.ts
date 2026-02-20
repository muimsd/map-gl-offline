import { MaintenanceService } from '@/services/maintenanceService';
import type { MaintenanceOptions, MaintenanceResults } from '@/types';
import type { StoredRegion } from '@/types/region';
import type { OfflineManagerServices } from './base';
import type { CleanupManagement } from './cleanupManagement';
import type { RegionManagement } from './regionManagement';
import type { AnalyticsManagement } from './analyticsManagement';

export interface MaintenanceManagement {
  performCompleteMaintenance(options?: MaintenanceOptions): Promise<MaintenanceResults>;
}

export const createMaintenanceManagement = (
  services: OfflineManagerServices,
  deps: {
    performSmartCleanup: CleanupManagement['performSmartCleanup'];
    listStoredRegions: RegionManagement['listStoredRegions'];
    getComprehensiveStorageAnalytics: AnalyticsManagement['getComprehensiveStorageAnalytics'];
  }
): MaintenanceManagement => {
  const maintenanceService = new MaintenanceService(
    deps.performSmartCleanup,
    // Use listStoredRegions so each region includes its styleId
    deps.listStoredRegions as () => Promise<StoredRegion[]>,
    services.resourceService.verifyAndRepairFonts.bind(services.resourceService),
    services.resourceService.verifyAndRepairSprites.bind(services.resourceService),
    services.resourceService.verifyAndRepairGlyphs.bind(services.resourceService),
    (options?: Record<string, unknown>) =>
      services.resourceService.cleanupOldFonts(undefined, options as { maxAge?: number }),
    (options?: Record<string, unknown>) =>
      services.resourceService.cleanupOldSprites(undefined, options as { maxAge?: number }),
    (options?: Record<string, unknown>) =>
      services.resourceService.cleanupOldGlyphs(undefined, options as { maxAge?: number }),
    deps.getComprehensiveStorageAnalytics
  );

  return {
    performCompleteMaintenance: (options: MaintenanceOptions = {}) =>
      maintenanceService.performCompleteMaintenance(options),
  };
};
