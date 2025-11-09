import type { OfflineManagerServices } from './base';
import { createRegionManagement, type RegionManagement } from './regionManagement';
import { createCleanupManagement, type CleanupManagement } from './cleanupManagement';
import { createResourceManagement, type ResourceManagement } from './resourceManagement';
import { createAnalyticsManagement, type AnalyticsManagement } from './analyticsManagement';
import { createMaintenanceManagement, type MaintenanceManagement } from './maintenanceManagement';
import {
  createImportExportManagement,
  type ImportExportManagement,
} from './importExportManagement';
import { createStyleManagement, type StyleManagement } from './styleManagement';

export type OfflineMapManagerModules = RegionManagement &
  CleanupManagement &
  ResourceManagement &
  AnalyticsManagement &
  MaintenanceManagement &
  ImportExportManagement &
  StyleManagement;

export const createOfflineMapManagerModules = (
  services: OfflineManagerServices
): OfflineMapManagerModules => {
  const region = createRegionManagement(services);
  const cleanup = createCleanupManagement(services);
  const resource = createResourceManagement(services);
  const analytics = createAnalyticsManagement(services, {
    getRegionAnalytics: cleanup.getRegionAnalytics,
  });
  const maintenance = createMaintenanceManagement(services, {
    performSmartCleanup: cleanup.performSmartCleanup,
    listRegions: region.listRegions,
    getComprehensiveStorageAnalytics: analytics.getComprehensiveStorageAnalytics,
  });
  const importExport = createImportExportManagement(services);
  const style = createStyleManagement();

  return {
    ...region,
    ...cleanup,
    ...resource,
    ...analytics,
    ...maintenance,
    ...importExport,
    ...style,
  };
};
