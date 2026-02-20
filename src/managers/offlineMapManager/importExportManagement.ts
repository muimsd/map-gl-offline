import type {
  ExportResult,
  ImportExportOptions,
  ImportResult,
  PMTilesExportOptions,
  MBTilesExportOptions,
  RegionImportData,
} from '@/types';
import type { OfflineManagerServices } from './base';

export interface ImportExportManagement {
  exportRegionAsJSON(regionId: string, options?: ImportExportOptions): Promise<ExportResult>;
  exportRegionAsPMTiles(
    regionId: string,
    options?: ImportExportOptions & PMTilesExportOptions
  ): Promise<ExportResult>;
  exportRegionAsMBTiles(
    regionId: string,
    options?: ImportExportOptions & MBTilesExportOptions
  ): Promise<ExportResult>;
  importRegion(importData: RegionImportData): Promise<ImportResult>;
  downloadExportedRegion(exportResult: ExportResult): void;
}

export const createImportExportManagement = (
  services: OfflineManagerServices
): ImportExportManagement => ({
  exportRegionAsJSON: async (regionId: string, options: ImportExportOptions = {}) =>
    services.importExportService.exportRegionAsJSON(regionId, options),
  exportRegionAsPMTiles: async (
    regionId: string,
    options: ImportExportOptions & PMTilesExportOptions = {}
  ) => services.importExportService.exportRegionAsPMTiles(regionId, options),
  exportRegionAsMBTiles: async (
    regionId: string,
    options: ImportExportOptions & MBTilesExportOptions = {}
  ) => services.importExportService.exportRegionAsMBTiles(regionId, options),
  importRegion: async (importData: RegionImportData) =>
    services.importExportService.importRegion(importData),
  downloadExportedRegion: (exportResult: ExportResult) => {
    const url = URL.createObjectURL(exportResult.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
});
