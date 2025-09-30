import {
  createManagerServices,
  type OfflineManagerServiceOverrides,
  type OfflineManagerServices,
} from './base';
import {
  createOfflineMapManagerModules,
  type OfflineMapManagerModules,
} from './modules';
import type { RegionManagement } from './regionManagement';
import type { CleanupManagement } from './cleanupManagement';
import type { ResourceManagement } from './resourceManagement';
import type { AnalyticsManagement } from './analyticsManagement';
import type { MaintenanceManagement } from './maintenanceManagement';
import type { ImportExportManagement } from './importExportManagement';
import type { StyleManagement } from './styleManagement';

export class OfflineMapManager implements OfflineMapManagerModules {
  private readonly services: OfflineManagerServices;
  private readonly modules: OfflineMapManagerModules;

  // Region management
  declare public addRegion: RegionManagement['addRegion'];
  declare public loadRegion: RegionManagement['loadRegion'];
  declare public deleteRegion: RegionManagement['deleteRegion'];
  declare public listRegions: RegionManagement['listRegions'];
  declare public listStoredRegions: RegionManagement['listStoredRegions'];
  declare public getStoredRegion: RegionManagement['getStoredRegion'];

  // Cleanup management
  declare public getRegionSize: CleanupManagement['getRegionSize'];
  declare public cleanupExpiredRegions: CleanupManagement['cleanupExpiredRegions'];
  declare public forceCleanupExpiredRegions: CleanupManagement['forceCleanupExpiredRegions'];
  declare public setupAutoCleanup: CleanupManagement['setupAutoCleanup'];
  declare public stopAutoCleanup: CleanupManagement['stopAutoCleanup'];
  declare public getRegionAnalytics: CleanupManagement['getRegionAnalytics'];
  declare public performSmartCleanup: CleanupManagement['performSmartCleanup'];
  declare public startEnhancedAutoCleanup: CleanupManagement['startEnhancedAutoCleanup'];
  declare public stopAllAutoCleanup: CleanupManagement['stopAllAutoCleanup'];

  // Resource management
  declare public downloadTilesWithOptions: ResourceManagement['downloadTilesWithOptions'];
  declare public getTileStatistics: ResourceManagement['getTileStatistics'];
  declare public downloadFontsWithOptions: ResourceManagement['downloadFontsWithOptions'];
  declare public getFontStatistics: ResourceManagement['getFontStatistics'];
  declare public getFontAnalytics: ResourceManagement['getFontAnalytics'];
  declare public cleanupOldFonts: ResourceManagement['cleanupOldFonts'];
  declare public verifyAndRepairFonts: ResourceManagement['verifyAndRepairFonts'];
  declare public downloadSpritesWithOptions: ResourceManagement['downloadSpritesWithOptions'];
  declare public getSpriteStatistics: ResourceManagement['getSpriteStatistics'];
  declare public cleanupOldSprites: ResourceManagement['cleanupOldSprites'];
  declare public verifyAndRepairSprites: ResourceManagement['verifyAndRepairSprites'];
  declare public getSpriteAnalytics: ResourceManagement['getSpriteAnalytics'];
  declare public downloadGlyphsWithOptions: ResourceManagement['downloadGlyphsWithOptions'];
  declare public getGlyphStatistics: ResourceManagement['getGlyphStatistics'];
  declare public getGlyphAnalytics: ResourceManagement['getGlyphAnalytics'];
  declare public loadGlyphsForStyle: ResourceManagement['loadGlyphsForStyle'];
  declare public cleanupOldGlyphs: ResourceManagement['cleanupOldGlyphs'];
  declare public verifyAndRepairGlyphs: ResourceManagement['verifyAndRepairGlyphs'];

  // Analytics management
  declare public getComprehensiveStorageAnalytics: AnalyticsManagement['getComprehensiveStorageAnalytics'];

  // Maintenance management
  declare public performCompleteMaintenance: MaintenanceManagement['performCompleteMaintenance'];

  // Import/export management
  declare public exportRegionAsJSON: ImportExportManagement['exportRegionAsJSON'];
  declare public exportRegionAsPMTiles: ImportExportManagement['exportRegionAsPMTiles'];
  declare public exportRegionAsMBTiles: ImportExportManagement['exportRegionAsMBTiles'];
  declare public importRegion: ImportExportManagement['importRegion'];
  declare public downloadExportedRegion: ImportExportManagement['downloadExportedRegion'];

  // Style management
  declare public downloadStyle: StyleManagement['downloadStyle'];
  declare public loadStyleById: StyleManagement['loadStyleById'];
  declare public listStyles: StyleManagement['listStyles'];
  declare public deleteStyle: StyleManagement['deleteStyle'];
  declare public getStyleStats: StyleManagement['getStyleStats'];
  declare public downloadMapboxStyle: StyleManagement['downloadMapboxStyle'];
  declare public downloadMapLibreStyle: StyleManagement['downloadMapLibreStyle'];
  declare public downloadStyleWithAutoDetection: StyleManagement['downloadStyleWithAutoDetection'];
  declare public cleanupOldStyles: StyleManagement['cleanupOldStyles'];

  constructor(overrides: OfflineManagerServiceOverrides = {}) {
    this.services = createManagerServices(overrides);
    this.modules = createOfflineMapManagerModules(this.services);
    Object.assign(this, this.modules);
  }

  getServices(): OfflineManagerServices {
    return this.services;
  }

  getModules(): OfflineMapManagerModules {
    return this.modules;
  }
}

export const createOfflineMapManager = (overrides: OfflineManagerServiceOverrides = {}) => {
  const services = createManagerServices(overrides);
  const modules = createOfflineMapManagerModules(services);
  return { services, modules };
};

export type { OfflineManagerServices, OfflineManagerServiceOverrides } from './base';
export type { OfflineMapManagerModules } from './modules';
export { createOfflineMapManagerModules } from './modules';
