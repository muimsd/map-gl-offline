import {
  createManagerServices,
  type OfflineManagerServiceOverrides,
  type OfflineManagerServices,
} from './base';
import {
  createRegionManagement,
  type RegionManagement,
} from './regionManagement';
import {
  createCleanupManagement,
  type CleanupManagement,
} from './cleanupManagement';
import {
  createResourceManagement,
  type ResourceManagement,
} from './resourceManagement';
import {
  createAnalyticsManagement,
  type AnalyticsManagement,
} from './analyticsManagement';
import {
  createMaintenanceManagement,
  type MaintenanceManagement,
} from './maintenanceManagement';
import {
  createImportExportManagement,
  type ImportExportManagement,
} from './importExportManagement';
import {
  createStyleManagement,
  type StyleManagement,
} from './styleManagement';

export type OfflineMapManagerModules = RegionManagement &
  CleanupManagement &
  ResourceManagement &
  AnalyticsManagement &
  MaintenanceManagement &
  ImportExportManagement &
  StyleManagement;

export class OfflineMapManager implements OfflineMapManagerModules {
  private readonly services: OfflineManagerServices;

  // Region management
  public addRegion!: RegionManagement['addRegion'];
  public loadRegion!: RegionManagement['loadRegion'];
  public deleteRegion!: RegionManagement['deleteRegion'];
  public listRegions!: RegionManagement['listRegions'];
  public listStoredRegions!: RegionManagement['listStoredRegions'];
  public getStoredRegion!: RegionManagement['getStoredRegion'];

  // Cleanup management
  public getRegionSize!: CleanupManagement['getRegionSize'];
  public cleanupExpiredRegions!: CleanupManagement['cleanupExpiredRegions'];
  public forceCleanupExpiredRegions!: CleanupManagement['forceCleanupExpiredRegions'];
  public setupAutoCleanup!: CleanupManagement['setupAutoCleanup'];
  public stopAutoCleanup!: CleanupManagement['stopAutoCleanup'];
  public getRegionAnalytics!: CleanupManagement['getRegionAnalytics'];
  public performSmartCleanup!: CleanupManagement['performSmartCleanup'];
  public startEnhancedAutoCleanup!: CleanupManagement['startEnhancedAutoCleanup'];
  public stopAllAutoCleanup!: CleanupManagement['stopAllAutoCleanup'];

  // Resource management
  public downloadTilesWithOptions!: ResourceManagement['downloadTilesWithOptions'];
  public getTileStatistics!: ResourceManagement['getTileStatistics'];
  public downloadFontsWithOptions!: ResourceManagement['downloadFontsWithOptions'];
  public getFontStatistics!: ResourceManagement['getFontStatistics'];
  public getFontAnalytics!: ResourceManagement['getFontAnalytics'];
  public cleanupOldFonts!: ResourceManagement['cleanupOldFonts'];
  public verifyAndRepairFonts!: ResourceManagement['verifyAndRepairFonts'];
  public downloadSpritesWithOptions!: ResourceManagement['downloadSpritesWithOptions'];
  public getSpriteStatistics!: ResourceManagement['getSpriteStatistics'];
  public cleanupOldSprites!: ResourceManagement['cleanupOldSprites'];
  public verifyAndRepairSprites!: ResourceManagement['verifyAndRepairSprites'];
  public getSpriteAnalytics!: ResourceManagement['getSpriteAnalytics'];
  public downloadGlyphsWithOptions!: ResourceManagement['downloadGlyphsWithOptions'];
  public getGlyphStatistics!: ResourceManagement['getGlyphStatistics'];
  public getGlyphAnalytics!: ResourceManagement['getGlyphAnalytics'];
  public loadGlyphsForStyle!: ResourceManagement['loadGlyphsForStyle'];
  public cleanupOldGlyphs!: ResourceManagement['cleanupOldGlyphs'];
  public verifyAndRepairGlyphs!: ResourceManagement['verifyAndRepairGlyphs'];

  // Analytics management
  public getComprehensiveStorageAnalytics!: AnalyticsManagement['getComprehensiveStorageAnalytics'];

  // Maintenance management
  public performCompleteMaintenance!: MaintenanceManagement['performCompleteMaintenance'];

  // Import/export management
  public exportRegionAsJSON!: ImportExportManagement['exportRegionAsJSON'];
  public exportRegionAsPMTiles!: ImportExportManagement['exportRegionAsPMTiles'];
  public exportRegionAsMBTiles!: ImportExportManagement['exportRegionAsMBTiles'];
  public importRegion!: ImportExportManagement['importRegion'];
  public downloadExportedRegion!: ImportExportManagement['downloadExportedRegion'];

  // Style management
  public downloadStyle!: StyleManagement['downloadStyle'];
  public loadStyleById!: StyleManagement['loadStyleById'];
  public listStyles!: StyleManagement['listStyles'];
  public deleteStyle!: StyleManagement['deleteStyle'];
  public getStyleStats!: StyleManagement['getStyleStats'];
  public downloadMapboxStyle!: StyleManagement['downloadMapboxStyle'];
  public downloadMapLibreStyle!: StyleManagement['downloadMapLibreStyle'];
  public downloadStyleWithAutoDetection!: StyleManagement['downloadStyleWithAutoDetection'];
  public cleanupOldStyles!: StyleManagement['cleanupOldStyles'];

  constructor(overrides: OfflineManagerServiceOverrides = {}) {
    this.services = createManagerServices(overrides);

    const region = createRegionManagement(this.services);
    const cleanup = createCleanupManagement(this.services);
    const resource = createResourceManagement(this.services);
    const analytics = createAnalyticsManagement(this.services, {
      getRegionAnalytics: cleanup.getRegionAnalytics,
    });
    const maintenance = createMaintenanceManagement(this.services, {
      performSmartCleanup: cleanup.performSmartCleanup,
      listRegions: region.listRegions,
      getComprehensiveStorageAnalytics: analytics.getComprehensiveStorageAnalytics,
    });
    const importExport = createImportExportManagement(this.services);
    const style = createStyleManagement();

    Object.assign(
      this,
      region,
      cleanup,
      resource,
      analytics,
      maintenance,
      importExport,
      style
    );
  }
}
