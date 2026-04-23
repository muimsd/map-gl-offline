import type {
  ExportResult,
  ImportExportOptions,
  ImportResult,
  MBTilesExportOptions,
  RegionImportData,
} from '@/types';
import type { OfflineManagerServices } from './base';

/**
 * MBTiles-only import/export surface. Regions are exchanged as real
 * binary SQLite MBTiles archives.
 */
export interface ImportExportManagement {
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
