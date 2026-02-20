import { CleanupService } from '@/services/cleanupService';
import { RegionService } from '@/services/regionService';
import { ResourceService } from '@/services/resourceService';
import { AnalyticsService } from '@/services/analyticsService';
import { ImportExportService } from '@/services/importExportService';

export interface OfflineManagerServices {
  regionService: RegionService;
  cleanupService: CleanupService;
  resourceService: ResourceService;
  analyticsService: AnalyticsService;
  importExportService: ImportExportService;
}

export type OfflineManagerServiceOverrides = Partial<OfflineManagerServices>;

export const createManagerServices = (
  overrides: OfflineManagerServiceOverrides = {}
): OfflineManagerServices => {
  const regionService = overrides.regionService ?? new RegionService();
  const cleanupService =
    overrides.cleanupService ?? new CleanupService(regionService.deleteRegion.bind(regionService));
  const resourceService = overrides.resourceService ?? new ResourceService();
  const analyticsService = overrides.analyticsService ?? new AnalyticsService();
  const importExportService = overrides.importExportService ?? new ImportExportService();

  return {
    regionService,
    cleanupService,
    resourceService,
    analyticsService,
    importExportService,
  };
};
