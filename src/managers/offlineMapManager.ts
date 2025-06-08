import { CleanupService } from '../services/cleanupService';
import { RegionService } from '../services/regionService';
import { ResourceService } from '../services/resourceService';
import { AnalyticsService } from '../services/analyticsService';
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
} from '../types';

export class OfflineMapManager {
  private cleanupService: CleanupService;
  private regionService: RegionService;
  private resourceService: ResourceService;
  private analyticsService: AnalyticsService;
  private maintenanceService: MaintenanceService;

  constructor() {
    this.regionService = new RegionService();
    this.cleanupService = new CleanupService(
      this.regionService.deleteRegion.bind(this.regionService)
    );
    this.resourceService = new ResourceService();
    this.analyticsService = new AnalyticsService();

    // Initialize maintenance service with required dependencies
    this.maintenanceService = new MaintenanceService(
      this.performSmartCleanup.bind(this),
      this.listRegions.bind(this),
      this.resourceService.verifyAndRepairFonts.bind(this.resourceService),
      this.resourceService.verifyAndRepairSprites.bind(this.resourceService),
      this.resourceService.verifyAndRepairGlyphs.bind(this.resourceService),
      this.resourceService.cleanupOldFonts.bind(this.resourceService),
      this.resourceService.cleanupOldSprites.bind(this.resourceService),
      this.resourceService.cleanupOldGlyphs.bind(this.resourceService),
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
    // Get StoredRegion data directly from the database
    return this.cleanupService['getAllRegions']();
  }

  async getStoredRegion(regionId: string): Promise<StoredRegion | null> {
    const regions = await this.listStoredRegions();
    return regions.find(region => region.id === regionId) || null;
  }

  async getRegionSize(regionId: string): Promise<number> {
    return this.cleanupService['getRegionSize'](regionId);
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

  async getExpiredRegions(): Promise<{
    autoDelete: StoredRegion[];
    manualOnly: StoredRegion[];
  }> {
    // This would need to be implemented in CleanupService if needed
    return { autoDelete: [], manualOnly: [] };
  }

  async getRegionExpiry(regionId: string): Promise<{ expiry: number; expired: boolean } | null> {
    // This would need to be implemented in CleanupService if needed
    return null;
  }

  async extendRegionExpiry(regionId: string, newExpiry: number): Promise<void> {
    // This would need to be implemented in CleanupService if needed
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
}
