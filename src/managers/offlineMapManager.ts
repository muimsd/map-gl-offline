import { CleanupService } from '../services/cleanupService';
import { RegionService } from '../services/regionService';
import { ResourceService } from '../services/resourceService';
import { AnalyticsService } from '../services/analyticsService';
import { ImportExportService } from '../services/importExportService';
import {
  MaintenanceService,
  MaintenanceOptions,
  MaintenanceResults,
} from '../services/maintenanceService';
import type {
  OfflineRegionOptions,
  StoredRegion,
  StorageAnalyticsReport,
  RegionCleanupOptions,
  CleanupResult,
  RegionAnalytics,
  ImportExportOptions,
  RegionImportData,
  ImportResult,
  ExportResult,
  PMTilesExportOptions,
  MBTilesExportOptions,
  StyleProvider,
  StyleDownloadOptions,
  StyleDownloadResult,
  StyleEntry,
  EnhancedStyleStats,
} from '../types';

export class OfflineMapManager {
  private cleanupService: CleanupService;
  private regionService: RegionService;
  private resourceService: ResourceService;
  private analyticsService: AnalyticsService;
  private maintenanceService: MaintenanceService;
  private importExportService: ImportExportService;

  constructor() {
    this.regionService = new RegionService();
    this.cleanupService = new CleanupService(
      this.regionService.deleteRegion.bind(this.regionService)
    );
    this.resourceService = new ResourceService();
    this.analyticsService = new AnalyticsService();
    this.importExportService = new ImportExportService();

    // Initialize maintenance service with required dependencies
    this.maintenanceService = new MaintenanceService(
      this.performSmartCleanup.bind(this),
      this.listRegions.bind(this),
      this.resourceService.verifyAndRepairFonts.bind(this.resourceService),
      this.resourceService.verifyAndRepairSprites.bind(this.resourceService),
      this.resourceService.verifyAndRepairGlyphs.bind(this.resourceService),
      (options?: Record<string, unknown>) => this.resourceService.cleanupOldFonts(undefined, options as { maxAge?: number }),
      this.resourceService.cleanupOldSprites.bind(this.resourceService),
      (options?: Record<string, unknown>) => this.resourceService.cleanupOldGlyphs(undefined, options as { maxAge?: number }),
      this.getComprehensiveStorageAnalytics.bind(this)
    );
  }

  // Region Management (delegated to RegionService)
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    return this.regionService.addRegion(region);
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    return this.regionService.loadRegion(region);
  }

  async deleteRegion(regionId: string): Promise<void> {
    return this.regionService.deleteRegion(regionId);
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    return this.regionService.listRegions();
  }

  async listStoredRegions(): Promise<StoredRegion[]> {
    return this.regionService.listStoredRegions();
  }

  async getStoredRegion(regionId: string): Promise<StoredRegion | null> {
    const regions = await this.regionService.listStoredRegions();
    return regions.find((region: StoredRegion) => region.id === regionId) || null;
  }

  async getRegionSize(regionId: string): Promise<number> {
    return this.cleanupService.getRegionSize(regionId);
  }

  // Cleanup Management (delegated to CleanupService)
  async cleanupExpiredRegions(): Promise<number> {
    const result = await this.cleanupService.performCleanup({ maxAge: 30 });
    return result.deletedRegions;
  }

  async forceCleanupExpiredRegions(): Promise<number> {
    const result = await this.cleanupService.performCleanup({ maxAge: 0 });
    return result.deletedRegions;
  }

  async setupAutoCleanup(
    options: RegionCleanupOptions & { intervalHours?: number } = {}
  ): Promise<string> {
    return this.cleanupService.setupAutoCleanup(options);
  }

  async stopAutoCleanup(cleanupId?: string): Promise<void> {
    return this.cleanupService.stopAutoCleanup(cleanupId);
  }

  async getRegionAnalytics(): Promise<RegionAnalytics> {
    return this.cleanupService.getRegionAnalytics();
  }

  async performSmartCleanup(options: RegionCleanupOptions = {}): Promise<CleanupResult> {
    return this.cleanupService.performCleanup(options);
  }

  async startEnhancedAutoCleanup(
    intervalHours: number = 24,
    options: RegionCleanupOptions = {}
  ): Promise<string> {
    return this.cleanupService.setupAutoCleanup({ ...options, intervalHours });
  }

  async stopAllAutoCleanup(): Promise<void> {
    return this.cleanupService.stopAutoCleanup();
  }

  // Resource Management (delegated to ResourceService)
  // Tile methods
  async downloadTilesWithOptions(...args: Parameters<ResourceService['downloadTilesWithOptions']>) {
    return this.resourceService.downloadTilesWithOptions(...args);
  }

  async getTileStatistics(...args: Parameters<ResourceService['getTileStatistics']>) {
    return this.resourceService.getTileStatistics(...args);
  }

  // Font methods
  async downloadFontsWithOptions(...args: Parameters<ResourceService['downloadFontsWithOptions']>) {
    return this.resourceService.downloadFontsWithOptions(...args);
  }

  async getFontStatistics(...args: Parameters<ResourceService['getFontStatistics']>) {
    return this.resourceService.getFontStatistics(...args);
  }

  async getFontAnalytics(...args: Parameters<ResourceService['getFontAnalytics']>) {
    return this.resourceService.getFontAnalytics(...args);
  }

  async cleanupOldFonts(...args: Parameters<ResourceService['cleanupOldFonts']>) {
    return this.resourceService.cleanupOldFonts(...args);
  }

  async verifyAndRepairFonts(...args: Parameters<ResourceService['verifyAndRepairFonts']>) {
    return this.resourceService.verifyAndRepairFonts(...args);
  }

  // Sprite methods
  async downloadSpritesWithOptions(
    ...args: Parameters<ResourceService['downloadSpritesWithOptions']>
  ) {
    return this.resourceService.downloadSpritesWithOptions(...args);
  }

  async getSpriteStatistics(...args: Parameters<ResourceService['getSpriteStatistics']>) {
    return this.resourceService.getSpriteStatistics(...args);
  }

  async cleanupOldSprites(...args: Parameters<ResourceService['cleanupOldSprites']>) {
    return this.resourceService.cleanupOldSprites(...args);
  }

  async verifyAndRepairSprites(...args: Parameters<ResourceService['verifyAndRepairSprites']>) {
    return this.resourceService.verifyAndRepairSprites(...args);
  }

  async getSpriteAnalytics(...args: Parameters<ResourceService['getSpriteAnalytics']>) {
    return this.resourceService.getSpriteAnalytics(...args);
  }

  // Glyph methods
  async downloadGlyphsWithOptions(
    ...args: Parameters<ResourceService['downloadGlyphsWithOptions']>
  ) {
    return this.resourceService.downloadGlyphsWithOptions(...args);
  }

  async getGlyphStatistics(...args: Parameters<ResourceService['getGlyphStatistics']>) {
    return this.resourceService.getGlyphStatistics(...args);
  }

  async getGlyphAnalytics(...args: Parameters<ResourceService['getGlyphAnalytics']>) {
    return this.resourceService.getGlyphAnalytics(...args);
  }

  async loadGlyphsForStyle(...args: Parameters<ResourceService['loadGlyphsForStyle']>) {
    return this.resourceService.loadGlyphsForStyle(...args);
  }

  async cleanupOldGlyphs(...args: Parameters<ResourceService['cleanupOldGlyphs']>) {
    return this.resourceService.cleanupOldGlyphs(...args);
  }

  async verifyAndRepairGlyphs(...args: Parameters<ResourceService['verifyAndRepairGlyphs']>) {
    return this.resourceService.verifyAndRepairGlyphs(...args);
  }

  // Analytics (delegated to AnalyticsService)
  async getComprehensiveStorageAnalytics(): Promise<StorageAnalyticsReport> {
    return this.analyticsService.getComprehensiveStorageAnalytics(
      this.getRegionAnalytics.bind(this)
    );
  }

  // Maintenance (delegated to MaintenanceService)
  async performCompleteMaintenance(options: MaintenanceOptions = {}): Promise<MaintenanceResults> {
    return this.maintenanceService.performCompleteMaintenance(options);
  }

  // Import/Export Management (delegated to ImportExportService)
  /**
   * Export a region as JSON format
   */
  async exportRegionAsJSON(
    regionId: string,
    options: ImportExportOptions = {}
  ): Promise<ExportResult> {
    return this.importExportService.exportRegionAsJSON(regionId, options);
  }

  /**
   * Export a region as PMTiles format
   */
  async exportRegionAsPMTiles(
    regionId: string,
    options: ImportExportOptions & PMTilesExportOptions = {}
  ): Promise<ExportResult> {
    return this.importExportService.exportRegionAsPMTiles(regionId, options);
  }

  /**
   * Export a region as MBTiles format
   */
  async exportRegionAsMBTiles(
    regionId: string,
    options: ImportExportOptions & MBTilesExportOptions = {}
  ): Promise<ExportResult> {
    return this.importExportService.exportRegionAsMBTiles(regionId, options);
  }

  /**
   * Import a region from file
   */
  async importRegion(importData: RegionImportData): Promise<ImportResult> {
    return this.importExportService.importRegion(importData);
  }

  /**
   * Download exported region file
   */
  downloadExportedRegion(exportResult: ExportResult): void {
    const url = URL.createObjectURL(exportResult.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ====================================
  // Style Management Methods
  // ====================================

  /**
   * Download a style with Mapbox GL support
   */
  async downloadStyle(
    styleUrl: string,
    options: StyleDownloadOptions & {
      provider?: StyleProvider;
      accessToken?: string;
      forceProvider?: boolean;
    } = {}
  ): Promise<StyleDownloadResult> {
    const { downloadStyleWithProvider } = await import('../services/styleService');
    return downloadStyleWithProvider(styleUrl, options);
  }

  /**
   * Load a stored style by ID
   */
  async loadStyleById(styleId: string): Promise<StyleEntry | null> {
    const { loadStyleById } = await import('../services/styleService');
    return loadStyleById(styleId);
  }

  /**
   * List all stored styles
   */
  async listStyles(): Promise<StyleEntry[]> {
    const { loadStyles } = await import('../services/styleService');
    return loadStyles();
  }

  /**
   * Delete a stored style
   */
  async deleteStyle(styleId: string): Promise<void> {
    const { deleteStyleById } = await import('../services/styleService');
    return deleteStyleById(styleId);
  }

  /**
   * Get style statistics
   */
  async getStyleStats(_styleId: string): Promise<EnhancedStyleStats> {
    const { getStyleStats } = await import('../services/styleService');
    return getStyleStats();
  }

  /**
   * Download and store a Mapbox GL style with proper provider detection
   */
  async downloadMapboxStyle(
    styleUrl: string,
    accessToken?: string,
    options: StyleDownloadOptions = {}
  ): Promise<StyleDownloadResult> {
    return this.downloadStyle(styleUrl, {
      ...options,
      provider: 'mapbox',
      accessToken,
      forceProvider: true,
    });
  }

  /**
   * Download and store a MapLibre GL style
   */
  async downloadMapLibreStyle(
    styleUrl: string,
    options: StyleDownloadOptions = {}
  ): Promise<StyleDownloadResult> {
    return this.downloadStyle(styleUrl, {
      ...options,
      provider: 'maplibre',
      forceProvider: true,
    });
  }

  /**
   * Auto-detect provider and download style
   */
  async downloadStyleWithAutoDetection(
    styleUrl: string,
    options: StyleDownloadOptions = {}
  ): Promise<StyleDownloadResult> {
    return this.downloadStyle(styleUrl, {
      ...options,
      provider: 'auto',
    });
  }

  /**
   * Clean up old styles
   */
  async cleanupOldStyles(maxAgeDays: number = 30): Promise<number> {
    const { cleanupOldStyles } = await import('../services/styleService');
    const cutoffDate = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const result = await cleanupOldStyles({
      maxAge: cutoffDate,
      onProgress: progress => {
        // Style cleanup progress tracking
        if (progress.completed % 10 === 0 || progress.completed === progress.total) {
          console.warn(`Style cleanup progress: ${progress.completed}/${progress.total}`);
        }
      },
    });

    return result.deletedCount;
  }
}
