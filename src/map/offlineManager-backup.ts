import { dbPromise } from '../storage/indexedDbManager';
import { downloadTiles, loadTiles, deleteTiles, getTileStats, TileDownloadOptions, TileDownloadResult, TileStats } from './tileDownloader';
import { 
  downloadSprites, 
  deleteSprites, 
  getSpriteStats, 
  cleanupOldSprites,
  verifyAndRepairSprites,
  getSpriteAnalytics,
  SpriteDownloadOptions,
  SpriteDownloadResult,
  EnhancedSpriteStats
} from './spriteManager';
import { 
  downloadStyles, 
  deleteStyleById, 
  getStyleStats,
  cleanupOldStyles,
  verifyAndValidateStyles,
  getStyleAnalytics,
  StyleDownloadOptions,
  StyleDownloadResult,
  EnhancedStyleStats
} from './styleManager';
import { 
  downloadFonts, 
  deleteFontsByStyleId, 
  loadFontsByDownloadId, 
  getFontStats, 
  getFontAnalytics,
  cleanupOldFonts,
  verifyAndRepairFonts,
  FontDownloadOptions,
  FontDownloadResult,
  EnhancedFontStats
} from './fontManager';
import { RegionCleanupManager } from './regionCleanup';
import type { OfflineRegionOptions, StyleEntry, StoredRegion } from '../types';
import { DownloadProgress } from '../utils';
export class OfflineMapManager {
  private cleanupManager: RegionCleanupManager;

  constructor() {
    this.cleanupManager = new RegionCleanupManager(this.deleteRegion.bind(this));
  }

  // Delegate cleanup methods to the RegionCleanupManager
  async cleanupExpiredRegions(): Promise<number> {
    return this.cleanupManager.cleanupExpiredRegions();
  }

  async forceCleanupExpiredRegions(): Promise<number> {
    return this.cleanupManager.forceCleanupExpiredRegions();
  }

  async getExpiredRegions(): Promise<{
    autoDelete: StoredRegion[];
    manualOnly: StoredRegion[];
  }> {
    return this.cleanupManager.getExpiredRegions();
  }

  async getRegionExpiry(
    regionId: string,
  ): Promise<{ expiry: number; expired: boolean } | null> {
    return this.cleanupManager.getRegionExpiry(regionId);
  }

  async extendRegionExpiry(regionId: string, newExpiry: number): Promise<void> {
    return this.cleanupManager.extendRegionExpiry(regionId, newExpiry);
  }

  startAutoCleanup(
    intervalMs: number = 1000 * 60 * 60,
  ): ReturnType<typeof setInterval> {
    return this.cleanupManager.startAutoCleanup(intervalMs);
  }

  stopAutoCleanup(intervalId: ReturnType<typeof setInterval>): void {
    this.cleanupManager.stopAutoCleanup(intervalId);
  }

  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    console.log('Adding region:', region);
    const style = await downloadStyles(region.styleUrl!);
    // Ensure styleId is available
    let styleId =
      style && (style as any).id
        ? (style as any).id
        : region.styleId || region.id;
    if (!styleId) throw new Error('Style must have an id');

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleId)) as
      | StyleEntry
      | undefined;
    if (!styleEntry || typeof styleEntry === 'string') {
      styleEntry = {
        key: styleId,
        style: patchStyleForOffline(style, styleId),
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      };
    }
    // Ensure regions is always an array
    if (!Array.isArray(styleEntry.regions)) {
      styleEntry.regions = [];
    }
    // Create a unique regionId for this region
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const regionId = `${region.id}-${timestamp}`;
    // Add region metadata to the style entry
    const bboxExists = styleEntry.regions.some(
      (r: any) => JSON.stringify(r.bounds) === JSON.stringify(region.bounds),
    );
    if (!bboxExists) {
      const expiry = Date.now() + region.expiry!;
      const regionWithMeta = {
        ...region,
        regionId,
        created: Date.now(),
        expiry,
      };
      styleEntry.regions.push(regionWithMeta);
      // Also add to the regions table for fast lookup
      const storedRegion: StoredRegion = {
        ...region,
        key: regionId,
        styleId,
        created: Date.now(),
        expiry,
      };
      await db.put('regions', storedRegion);
    } else {
      console.log('Region with the same bbox already exists for this style.');
      return;
    }
    // Download and store tiles for this region
    await downloadTiles(region, style, styleId);
    // Fonts and sprites are handled by style download logic, not here
    // Save the updated style entry
    // Always ensure the key is set and value is an object
    await db.put('styles', { ...styleEntry, key: styleId });
    // Optionally, also update a separate regions store for fast lookup (future-proofing)
    // await db.put('regions', { ...region, styleId, regionId });
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    // Find the style entry for this region
    const styleId = region.styleId || region.id;
    const styleEntry = await db.get('styles', styleId);
    if (
      styleEntry &&
      typeof styleEntry === 'object' &&
      'regions' in styleEntry
    ) {
      const entry: any = styleEntry;
      // Find the region in the style's regions array
      // Try to match by id, or fallback to first region if only one exists
      let regionMeta = entry.regions.find((r: any) => r.id === region.id);
      if (!regionMeta && entry.regions.length === 1) {
        regionMeta = entry.regions[0];
      }
      if (!regionMeta) throw new Error('Region not found in style');
      // Load tiles for this region
      await loadTiles(regionMeta, styleId);
      // Load sprites for the style
      if (styleId && entry.style && entry.style.sprite) {
        const spriteBase = entry.style.sprite;
        const spriteVariants = [
          `${spriteBase}.json`,
          `${spriteBase}.png`,
          `${spriteBase}@2x.json`,
          `${spriteBase}@2x.png`,
        ];
        await downloadSprites(styleId, spriteVariants);
        entry.sprites = spriteVariants.map(
          (url) => `${styleId}::${url.split('/').pop()}`,
        );
      }
      // Load fonts for the style
      await loadFontsByDownloadId(styleId);
      // Load and set the patched style for offline mode
      if (entry.style) {
        // Set the style on the map instance here if needed
        // map.current.setStyle(entry.style);
        console.log('Loaded offline style for region:', region.id);
      }
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    // Gather all regions from all styles
    const allStyles = await db.getAll('styles');
    return allStyles
      .filter(
        (styleEntry: any) =>
          typeof styleEntry === 'object' && 'regions' in styleEntry,
      )
      .flatMap((styleEntry: any) => styleEntry.regions || []);
  }

  async deleteRegion(regionId: string, styleId?: string): Promise<void> {
    const db = await dbPromise;
    // Find the style entry containing this region
    let styleEntry: any;
    if (styleId) {
      styleEntry = await db.get('styles', styleId);
    } else {
      // Search all styles for the region
      const allStyles = await db.getAll('styles');
      styleEntry = allStyles.find(
        (entry: any) =>
          typeof entry === 'object' &&
          'regions' in entry &&
          (entry.regions || []).some((r: any) => r.regionId === regionId),
      );
    }
    if (
      !styleEntry ||
      typeof styleEntry !== 'object' ||
      !('regions' in styleEntry)
    )
      return;
    // Find the region
    const regionIdx = styleEntry.regions.findIndex(
      (r: any) => r.regionId === regionId,
    );
    if (regionIdx === -1) return;
    // Delete region's tiles
    await deleteTiles(styleEntry.key);
    // Delete region from style's regions array
    styleEntry.regions.splice(regionIdx, 1);
    // If no regions remain, delete all resources for the style
    if (styleEntry.regions.length === 0) {
      await Promise.all([
        deleteSprites(styleEntry.key),
        deleteFontsByStyleId(styleEntry.key),
        deleteStyleById(styleEntry.key),
        db.delete('styles', styleEntry.key),
      ]);
    } else {
      // Otherwise, just update the style entry
      await db.put('styles', styleEntry);
    }
  }

  async updateRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    // Fetch the existing region by id
    const existing = await db.get('regions', region.id);
    if (existing && existing.downloadId) {
      const downloadId = existing.downloadId;
      await Promise.all([
        deleteTiles(downloadId),
        deleteSprites(downloadId),
        deleteFontsByStyleId(downloadId),
        deleteStyleById(downloadId),
        db.delete('styles', downloadId),
      ]);
    }
    // Add the region again (new downloadId, new resources)
    await this.addRegion({ ...region, updated: Date.now() });
  }

  // Enhanced font management methods
  
  /**
   * Download fonts with enhanced options and progress tracking
   */
  async downloadFontsWithOptions(
    fontUrls: string[],
    styleId: string,
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    return downloadFonts(fontUrls, styleId, options);
  }

  /**
   * Get comprehensive font statistics for a style
   */
  async getFontStatistics(styleId: string): Promise<EnhancedFontStats> {
    return getFontStats(styleId);
  }

  /**
   * Get comprehensive font analytics across all styles or specific style
   */
  async getFontAnalytics(styleId?: string): Promise<{
    totalFonts: number;
    totalSize: number;
    averageSize: number;
    sizeByType: Record<string, number>;
    countByType: Record<string, number>;
    downloadTimeRange: { oldest?: Date; newest?: Date };
    compressionRatio: number;
  }> {
    return getFontAnalytics(styleId);
  }

  /**
   * Clean up old fonts based on age or storage quota
   */
  async cleanupOldFonts(options: {
    maxAge?: number;
    maxStorageSize?: number;
    styleId?: string;
  } = {}): Promise<{ deletedCount: number; freedSpace: number }> {
    return cleanupOldFonts(options);
  }

  /**
   * Verify font integrity and repair if needed
   */
  async verifyAndRepairFonts(
    styleId: string,
    options: {
      removeCorrupted?: boolean;
      onProgress?: (progress: { checked: number; total: number; corrupted: number }) => void;
    } = {}
  ): Promise<{ 
    totalFonts: number; 
    corruptedFonts: number; 
    removedFonts: number;
  }> {
    return verifyAndRepairFonts(styleId, options);
  }

  /**
   * Get comprehensive storage analytics across all components
   */
  async getStorageAnalytics(styleId?: string): Promise<{
    tiles: TileStats;
    fonts: EnhancedFontStats;
    sprites: EnhancedSpriteStats;
    styles: EnhancedStyleStats;
    totalSize: number;
    componentBreakdown: {
      tiles: { size: number; percentage: number };
      fonts: { size: number; percentage: number };
      sprites: { size: number; percentage: number };
      styles: { size: number; percentage: number };
    };
  }> {
    const [tileStats, fontStats, spriteStats, styleStats] = await Promise.all([
      styleId ? getTileStats(styleId) : this.getAllTileStats(),
      styleId ? getFontStats(styleId) : this.getAllFontStats(),
      styleId ? getSpriteStats(styleId) : this.getAllSpriteStats(),
      styleId ? getStyleStats(styleId) : this.getAllStyleStats()
    ]);

    const totalSize = tileStats.totalSize + fontStats.totalSize + spriteStats.totalSize + styleStats.totalSize;
    
    return {
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteStats,
      styles: styleStats,
      totalSize,
      componentBreakdown: {
        tiles: {
          size: tileStats.totalSize,
          percentage: totalSize > 0 ? (tileStats.totalSize / totalSize) * 100 : 0
        },
        fonts: {
          size: fontStats.totalSize,
          percentage: totalSize > 0 ? (fontStats.totalSize / totalSize) * 100 : 0
        },
        sprites: {
          size: spriteStats.totalSize,
          percentage: totalSize > 0 ? (spriteStats.totalSize / totalSize) * 100 : 0
        },
        styles: {
          size: styleStats.totalSize,
          percentage: totalSize > 0 ? (styleStats.totalSize / totalSize) * 100 : 0
        }
      }
    };
  }

  /**
   * Perform comprehensive maintenance across all components
   */
  async performMaintenance(options: {
    maxAge?: number;
    maxStorageSize?: number;
    verifyIntegrity?: boolean;
    removeCorrupted?: boolean;
    onProgress?: (progress: {
      component: 'tiles' | 'fonts' | 'sprites' | 'cleanup';
      message: string;
      completed?: number;
      total?: number;
    }) => void;
  } = {}): Promise<{
    tiles: { verified?: boolean; cleaned: { deletedCount: number; freedSpace: number } };
    fonts: { 
      verified?: { totalFonts: number; corruptedFonts: number; removedFonts: number };
      cleaned: { deletedCount: number; freedSpace: number };
    };
    totalFreedSpace: number;
    summary: string;
  }> {
    const { maxAge = 60, maxStorageSize, verifyIntegrity = true, removeCorrupted = true, onProgress } = options;
    
    const results = {
      tiles: { cleaned: { deletedCount: 0, freedSpace: 0 } },
      fonts: { cleaned: { deletedCount: 0, freedSpace: 0 } },
      totalFreedSpace: 0,
      summary: ''
    } as any;

    try {
      // Font verification and cleanup
      if (verifyIntegrity) {
        onProgress?.({ component: 'fonts', message: 'Verifying font integrity...' });
        
        const allStyles = await this.listRegions();
        const styleIds = [...new Set(allStyles.map(r => r.styleId || r.id))];
        
        let totalVerified = 0;
        let totalCorrupted = 0;
        let totalRemoved = 0;

        for (const styleId of styleIds) {
          const verification = await verifyAndRepairFonts(styleId, {
            removeCorrupted,
            onProgress: (progress) => {
              onProgress?.({
                component: 'fonts',
                message: `Verifying fonts for ${styleId}...`,
                completed: progress.checked,
                total: progress.total
              });
            }
          });
          
          totalVerified += verification.totalFonts;
          totalCorrupted += verification.corruptedFonts;
          totalRemoved += verification.removedFonts;
        }

        results.fonts.verified = {
          totalFonts: totalVerified,
          corruptedFonts: totalCorrupted,
          removedFonts: totalRemoved
        };
      }

      // Font cleanup
      onProgress?.({ component: 'fonts', message: 'Cleaning up old fonts...' });
      const fontCleanup = await cleanupOldFonts({ maxAge, maxStorageSize });
      results.fonts.cleaned = fontCleanup;
      results.totalFreedSpace += fontCleanup.freedSpace;

      // Region cleanup (includes tiles and other resources)
      onProgress?.({ component: 'cleanup', message: 'Cleaning up expired regions...' });
      const expiredCount = await this.cleanupExpiredRegions();
      
      // Summary
      const summary = [
        `Maintenance completed:`,
        `- Fonts: ${results.fonts.cleaned.deletedCount} deleted`,
        results.fonts.verified ? `- Font verification: ${results.fonts.verified.corruptedFonts} corrupted, ${results.fonts.verified.removedFonts} removed` : '',
        `- Expired regions: ${expiredCount} cleaned`,
        `- Total space freed: ${(results.totalFreedSpace / 1024 / 1024).toFixed(2)} MB`
      ].filter(Boolean).join('\n');

      results.summary = summary;
      
      onProgress?.({ component: 'cleanup', message: 'Maintenance completed' });
      
      return results;
    } catch (error) {
      console.error('Maintenance failed:', error);
      throw error;
    }
  }

  /**
   * Get storage dashboard with comprehensive metrics
   */
  async getStorageDashboard(): Promise<{
    overview: {
      totalSize: number;
      totalItems: number;
      lastUpdated: Date;
    };
    breakdown: {
      tiles: { count: number; size: number; percentage: number };
      fonts: { count: number; size: number; percentage: number };
      sprites: { count: number; size: number; percentage: number };
      styles: { count: number; size: number; percentage: number };
    };
    regions: Array<{
      id: string;
      styleId: string;
      size: number;
      created: Date;
      expiry?: Date;
      expired: boolean;
    }>;
    recommendations: string[];
  }> {
    const analytics = await this.getStorageAnalytics();
    const regions = await this.listRegions();
    const fontAnalytics = await getFontAnalytics();
    
    const now = Date.now();
    const totalSize = analytics.totalSize;
    
    const regionDetails = regions.map(region => ({
      id: region.id,
      styleId: region.styleId || region.id,
      size: 0, // TODO: Calculate actual region size
      created: new Date((region as any).created || now),
      expiry: (region as any).expiry ? new Date((region as any).expiry) : undefined,
      expired: (region as any).expiry ? (region as any).expiry < now : false
    }));

    const recommendations: string[] = [];
    
    // Storage recommendations
    if (totalSize > 100 * 1024 * 1024) { // > 100MB
      recommendations.push('Consider cleaning up old data - storage usage is high');
    }
    
    if (analytics.fonts.corruptedFonts.length > 0) {
      recommendations.push(`${analytics.fonts.corruptedFonts.length} corrupted fonts found - run verification`);
    }
    
    const expiredRegions = regionDetails.filter(r => r.expired);
    if (expiredRegions.length > 0) {
      recommendations.push(`${expiredRegions.length} expired regions can be cleaned up`);
    }
    
    if (fontAnalytics.compressionRatio < 0.8) {
      recommendations.push('Consider using WOFF2 fonts for better compression');
    }

    return {
      overview: {
        totalSize,
        totalItems: analytics.tiles.count + analytics.fonts.count,
        lastUpdated: new Date()
      },
      breakdown: {
        tiles: {
          count: analytics.tiles.count,
          size: analytics.tiles.totalSize,
          percentage: analytics.componentBreakdown.tiles.percentage
        },
        fonts: {
          count: analytics.fonts.count,
          size: analytics.fonts.totalSize,
          percentage: analytics.componentBreakdown.fonts.percentage
        },
        sprites: {
          count: analytics.sprites.count,
          size: analytics.sprites.totalSize,
          percentage: analytics.componentBreakdown.sprites.percentage
        },
        styles: {
          count: analytics.styles.count,
          size: analytics.styles.totalSize,
          percentage: analytics.componentBreakdown.styles.percentage
        }
      },
      regions: regionDetails,
      recommendations
    };
  }

  // Helper methods for aggregated stats
  private async getAllTileStats(): Promise<TileStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;
    const zoomLevelStats = new Map<number, { count: number; size: number }>();
    
    for (const styleId of styleIds) {
      const stats = await getTileStats(styleId);
      totalCount += stats.count;
      totalSize += stats.totalSize;
      
      // Track oldest and newest tiles
      if (stats.oldestTile && (!oldestTile || stats.oldestTile < oldestTile)) {
        oldestTile = stats.oldestTile;
      }
      if (stats.newestTile && (!newestTile || stats.newestTile > newestTile)) {
        newestTile = stats.newestTile;
      }
      
      // Merge zoom level stats
      stats.zoomLevelStats.forEach((levelStats, zoom) => {
        const existing = zoomLevelStats.get(zoom) || { count: 0, size: 0 };
        zoomLevelStats.set(zoom, {
          count: existing.count + levelStats.count,
          size: existing.size + levelStats.size
        });
      });
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      oldestTile,
      newestTile,
      zoomLevelStats
    };
  }

  private async getAllFontStats(): Promise<EnhancedFontStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    const allFonts: string[] = [];
    const fontsByType: Record<string, number> = {};
    const corruptedFonts: string[] = [];
    let oldestFont: { key: string; timestamp: number } | undefined;
    let newestFont: { key: string; timestamp: number } | undefined;
    
    for (const styleId of styleIds) {
      const stats = await getFontStats(styleId);
      totalCount += stats.count;
      totalSize += stats.totalSize;
      allFonts.push(...stats.fonts);
      corruptedFonts.push(...stats.corruptedFonts);
      
      // Merge font types
      Object.entries(stats.fontsByType).forEach(([type, count]) => {
        fontsByType[type] = (fontsByType[type] || 0) + count;
      });
      
      // Track oldest and newest
      if (stats.oldestFont && (!oldestFont || stats.oldestFont.timestamp < oldestFont.timestamp)) {
        oldestFont = stats.oldestFont;
      }
      if (stats.newestFont && (!newestFont || stats.newestFont.timestamp > newestFont.timestamp)) {
        newestFont = stats.newestFont;
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      fonts: allFonts,
      fontsByType,
      oldestFont,
      newestFont,
      corruptedFonts
    };
  }

  private async getAllSpriteStats(): Promise<EnhancedSpriteStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    const spritesByType: Record<string, number> = {};
    let totalSprites = 0;
    
    for (const styleId of styleIds) {
      try {
        const stats = await getSpriteStats(styleId);
        totalCount += stats.count;
        totalSize += stats.totalSize;
        totalSprites += stats.totalSprites;
        
        // Merge sprite types
        Object.entries(stats.spritesByType).forEach(([type, count]) => {
          spritesByType[type] = (spritesByType[type] || 0) + count;
        });
      } catch (error) {
        console.warn(`Failed to get sprite stats for ${styleId}:`, error);
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      sprites: [],
      spritesByType,
      totalSprites,
      oldestSprite: undefined,
      newestSprite: undefined,
      corruptedSprites: []
    };
  }

  private async getAllStyleStats(): Promise<EnhancedStyleStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    let totalSources = 0;
    let totalLayers = 0;
    const sourceTypeBreakdown: Record<string, number> = {};
    const layerTypeBreakdown: Record<string, number> = {};
    
    for (const styleId of styleIds) {
      try {
        const stats = await getStyleStats(styleId);
        totalCount += stats.count;
        totalSize += stats.totalSize;
        totalSources += stats.totalSources;
        totalLayers += stats.totalLayers;
        
        // Merge source and layer types
        Object.entries(stats.sourceTypeBreakdown).forEach(([type, count]) => {
          sourceTypeBreakdown[type] = (sourceTypeBreakdown[type] || 0) + count;
        });
        
        Object.entries(stats.layerTypeBreakdown).forEach(([type, count]) => {
          layerTypeBreakdown[type] = (layerTypeBreakdown[type] || 0) + count;
        });
      } catch (error) {
        console.warn(`Failed to get style stats for ${styleId}:`, error);
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      styles: [],
      totalSources,
      totalLayers,
      sourceTypeBreakdown,
      layerTypeBreakdown,
      oldestStyle: undefined,
      newestStyle: undefined
    };
  }
  // Enhanced Sprite Management Methods
  
  /**
   * Download sprites with enhanced options and analytics
   */
  async downloadSpritesWithOptions(
    styleId: string,
    urls: string[],
    options: SpriteDownloadOptions = {}
  ): Promise<SpriteDownloadResult> {
    return downloadSprites(styleId, urls, options);
  }

  /**
   * Get enhanced sprite statistics for a style
   */
  async getSpriteStatistics(styleId: string): Promise<EnhancedSpriteStats> {
    return getSpriteStats(styleId);
  }

  /**
   * Clean up old sprites for a style
   */
  async cleanupOldSprites(
    styleId: string,
    options: {
      maxAge?: number;
      maxCount?: number;
      maxSize?: number;
      onProgress?: (progress: { completed: number; total: number; message: string }) => void;
    } = {}
  ): Promise<{ deletedCount: number; freedSpace: number; errors: string[] }> {
    return cleanupOldSprites(styleId, options);
  }

  /**
   * Verify and repair sprite integrity for a style
   */
  async verifyAndRepairSprites(
    styleId: string,
    options: {
      onProgress?: (progress: { completed: number; total: number; message: string }) => void;
      autoRepair?: boolean;
    } = {}
  ): Promise<{
    totalSprites: number;
    validSprites: number;
    corruptedSprites: number;
    repairedSprites: number;
    errors: Array<{ name: string; error: string }>;
  }> {
    return verifyAndRepairSprites(styleId, options);
  }

  /**
   * Get comprehensive sprite analytics across all styles
   */
  async getSpriteAnalytics(): Promise<{
    totalSprites: number;
    totalSize: number;
    styleCount: number;
    spritesByType: Record<string, number>;
    sizeByType: Record<string, number>;
    topStyles: Array<{ styleId: string; spriteCount: number; size: number }>;
    recommendations: string[];
  }> {
    return getSpriteAnalytics();
  }

  // Enhanced Style Management Methods
  
  /**
   * Download styles with enhanced options and analytics
   */
  async downloadStylesWithOptions(
    stylesUrl: string,
    options: StyleDownloadOptions = {}
  ): Promise<StyleDownloadResult> {
    return downloadStyles(stylesUrl, options);
  }

  /**
   * Get enhanced style statistics
   */
  async getStyleStatistics(): Promise<EnhancedStyleStats> {
    return getStyleStats();
  }

  /**
   * Clean up old styles
   */
  async cleanupOldStyles(
    options: {
      maxAge?: number;
      maxCount?: number;
      maxSize?: number;
      keepIds?: string[];
      onProgress?: (progress: { completed: number; total: number; message: string }) => void;
    } = {}
  ): Promise<{ deletedCount: number; freedSpace: number; errors: string[] }> {
    return cleanupOldStyles(options);
  }

  /**
   * Verify and validate style integrity
   */
  async verifyAndValidateStyles(
    options: {
      onProgress?: (progress: { completed: number; total: number; message: string }) => void;
      autoRepair?: boolean;
    } = {}
  ): Promise<{
    totalStyles: number;
    validStyles: number;
    invalidStyles: number;
    repairedStyles: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    return verifyAndValidateStyles(options);
  }

  /**
   * Get comprehensive style analytics
   */
  async getStyleAnalytics(): Promise<{
    totalStyles: number;
    totalSize: number;
    totalSources: number;
    totalLayers: number;
    sourceTypeBreakdown: Record<string, number>;
    layerTypeBreakdown: Record<string, number>;
    stylesWithGlyphs: number;
    stylesWithSprites: number;
    averageLayersPerStyle: number;
    averageSourcesPerStyle: number;
    recommendations: string[];
  }> {
    return getStyleAnalytics();
  }

  // Cross-Component Analytics and Management
  
  /**
   * Get comprehensive storage analytics across all components
   */
  async getStorageAnalytics(): Promise<{
    tiles: TileStats;
    fonts: EnhancedFontStats;
    sprites: {
      totalSprites: number;
      totalSize: number;
      styleCount: number;
      spritesByType: Record<string, number>;
      sizeByType: Record<string, number>;
      topStyles: Array<{ styleId: string; spriteCount: number; size: number }>;
      recommendations: string[];
    };
    styles: {
      totalStyles: number;
      totalSize: number;
      totalSources: number;
      totalLayers: number;
      sourceTypeBreakdown: Record<string, number>;
      layerTypeBreakdown: Record<string, number>;
      stylesWithGlyphs: number;
      stylesWithSprites: number;
      averageLayersPerStyle: number;
      averageSourcesPerStyle: number;
      recommendations: string[];
    };
    total: {
      size: number;
      recommendations: string[];
    };
  }> {
    const [tileStats, fontStats, spriteAnalytics, styleAnalytics] = await Promise.all([
      this.getAllTileStats(),
      this.getAllFontStats(),
      this.getSpriteAnalytics(),
      this.getStyleAnalytics()
    ]);

    const totalSize = tileStats.totalSize + fontStats.totalSize + spriteAnalytics.totalSize + styleAnalytics.totalSize;
    const totalRecommendations = [
      ...tileStats.recommendations,
      ...fontStats.recommendations,
      ...spriteAnalytics.recommendations,
      ...styleAnalytics.recommendations
    ];

    // Add cross-component recommendations
    if (totalSize > 500 * 1024 * 1024) { // 500MB
      totalRecommendations.push(`Total storage is very large (${(totalSize / 1024 / 1024).toFixed(1)}MB) - consider comprehensive cleanup`);
    }

    const componentCounts = [
      tileStats.totalTiles,
      fontStats.count,
      spriteAnalytics.totalSprites,
      styleAnalytics.totalStyles
    ];
    
    if (componentCounts.some(count => count > 10000)) {
      totalRecommendations.push('Some components have very high item counts - consider archiving or cleanup');
    }

    return {
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteAnalytics,
      styles: styleAnalytics,
      total: {
        size: totalSize,
        recommendations: [...new Set(totalRecommendations)] // Remove duplicates
      }
    };
  }

  /**
   * Perform comprehensive maintenance across all components
   */
  async performMaintenance(
    options: {
      tiles?: {
        maxAge?: number;
        maxCount?: number;
        maxSize?: number;
      };
      fonts?: {
        maxAge?: number;
        maxCount?: number;
        maxSize?: number;
      };
      sprites?: {
        maxAge?: number;
        maxCount?: number;
        maxSize?: number;
      };
      styles?: {
        maxAge?: number;
        maxCount?: number;
        maxSize?: number;
        keepIds?: string[];
      };
      onProgress?: (progress: { 
        component: string; 
        completed: number; 
        total: number; 
        message: string 
      }) => void;
    } = {}
  ): Promise<{
    tiles: { deletedCount: number; freedSpace: number; errors: string[] };
    fonts: { deletedCount: number; freedSpace: number; errors: string[] };
    sprites: { deletedCount: number; freedSpace: number; errors: string[] };
    styles: { deletedCount: number; freedSpace: number; errors: string[] };
    verification: {
      tiles: { totalTiles: number; validTiles: number; corruptedTiles: number };
      fonts: { totalFonts: number; validFonts: number; corruptedFonts: number; repairedFonts: number };
      sprites: { totalSprites: number; validSprites: number; corruptedSprites: number; repairedSprites: number };
      styles: { totalStyles: number; validStyles: number; invalidStyles: number; repairedStyles: number };
    };
    summary: {
      totalDeleted: number;
      totalFreedSpace: number;
      totalErrors: number;
    };
  }> {
    const { tiles: tileOptions, fonts: fontOptions, sprites: spriteOptions, styles: styleOptions, onProgress } = options;

    let totalDeleted = 0;
    let totalFreedSpace = 0;
    let totalErrors = 0;

    // Get region list for tile and font cleanup
    const regions = await this.listRegions();

    // Tile cleanup and verification
    onProgress?.({ component: 'tiles', completed: 0, total: 100, message: 'Starting tile maintenance' });
    
    const tileResults = { deletedCount: 0, freedSpace: 0, errors: [] as string[] };
    const tileVerification = { totalTiles: 0, validTiles: 0, corruptedTiles: 0 };
    
    if (tileOptions) {
      for (const region of regions) {
        // Individual region tile cleanup would go here
        // This is a placeholder for the actual implementation
      }
    }

    onProgress?.({ component: 'tiles', completed: 100, total: 100, message: 'Tile maintenance completed' });

    // Font cleanup and verification
    onProgress?.({ component: 'fonts', completed: 0, total: 100, message: 'Starting font maintenance' });
    
    let fontResults = { deletedCount: 0, freedSpace: 0, errors: [] as string[] };
    let fontVerification = { totalFonts: 0, validFonts: 0, corruptedFonts: 0, repairedFonts: 0 };
    
    if (fontOptions) {
      for (const region of regions) {
        const styleId = region.styleId || region.id;
        const cleanup = await this.cleanupOldFonts(styleId, {
          ...fontOptions,
          onProgress: (progress) => {
            onProgress?.({ 
              component: 'fonts', 
              completed: progress.completed, 
              total: progress.total, 
              message: progress.message 
            });
          }
        });
        
        fontResults.deletedCount += cleanup.deletedCount;
        fontResults.freedSpace += cleanup.freedSpace;
        fontResults.errors.push(...cleanup.errors);
      }

      // Font verification
      for (const region of regions) {
        const styleId = region.styleId || region.id;
        const verification = await this.verifyAndRepairFonts(styleId, { autoRepair: true });
        fontVerification.totalFonts += verification.totalFonts;
        fontVerification.validFonts += verification.validFonts;
        fontVerification.corruptedFonts += verification.corruptedFonts;
        fontVerification.repairedFonts += verification.repairedFonts;
      }
    }

    onProgress?.({ component: 'fonts', completed: 100, total: 100, message: 'Font maintenance completed' });

    // Sprite cleanup and verification
    onProgress?.({ component: 'sprites', completed: 0, total: 100, message: 'Starting sprite maintenance' });
    
    let spriteResults = { deletedCount: 0, freedSpace: 0, errors: [] as string[] };
    let spriteVerification = { totalSprites: 0, validSprites: 0, corruptedSprites: 0, repairedSprites: 0 };
    
    if (spriteOptions) {
      for (const region of regions) {
        const styleId = region.styleId || region.id;
        const cleanup = await this.cleanupOldSprites(styleId, {
          ...spriteOptions,
          onProgress: (progress) => {
            onProgress?.({ 
              component: 'sprites', 
              completed: progress.completed, 
              total: progress.total, 
              message: progress.message 
            });
          }
        });
        
        spriteResults.deletedCount += cleanup.deletedCount;
        spriteResults.freedSpace += cleanup.freedSpace;
        spriteResults.errors.push(...cleanup.errors);
      }

      // Sprite verification
      for (const region of regions) {
        const styleId = region.styleId || region.id;
        const verification = await this.verifyAndRepairSprites(styleId, { autoRepair: true });
        spriteVerification.totalSprites += verification.totalSprites;
        spriteVerification.validSprites += verification.validSprites;
        spriteVerification.corruptedSprites += verification.corruptedSprites;
        spriteVerification.repairedSprites += verification.repairedSprites;
      }
    }

    onProgress?.({ component: 'sprites', completed: 100, total: 100, message: 'Sprite maintenance completed' });

    // Style cleanup and verification
    onProgress?.({ component: 'styles', completed: 0, total: 100, message: 'Starting style maintenance' });
    
    let styleResults = { deletedCount: 0, freedSpace: 0, errors: [] as string[] };
    let styleVerification = { totalStyles: 0, validStyles: 0, invalidStyles: 0, repairedStyles: 0 };
    
    if (styleOptions) {
      styleResults = await this.cleanupOldStyles({
        ...styleOptions,
        onProgress: (progress) => {
          onProgress?.({ 
            component: 'styles', 
            completed: progress.completed, 
            total: progress.total, 
            message: progress.message 
          });
        }
      });

      styleVerification = await this.verifyAndValidateStyles({ autoRepair: true });
    }

    onProgress?.({ component: 'styles', completed: 100, total: 100, message: 'Style maintenance completed' });

    // Calculate totals
    totalDeleted = tileResults.deletedCount + fontResults.deletedCount + spriteResults.deletedCount + styleResults.deletedCount;
    totalFreedSpace = tileResults.freedSpace + fontResults.freedSpace + spriteResults.freedSpace + styleResults.freedSpace;
    totalErrors = tileResults.errors.length + fontResults.errors.length + spriteResults.errors.length + styleResults.errors.length;

    return {
      tiles: tileResults,
      fonts: fontResults,
      sprites: spriteResults,
      styles: styleResults,
      verification: {
        tiles: tileVerification,
        fonts: fontVerification,
        sprites: spriteVerification,
        styles: styleVerification
      },
      summary: {
        totalDeleted,
        totalFreedSpace,
        totalErrors
      }
    };
  }

  /**
   * Get comprehensive storage dashboard with recommendations
   */
  async getStorageDashboard(): Promise<{
    overview: {
      totalSize: string;
      components: Array<{ name: string; size: string; percentage: number }>;
    };
    details: {
      tiles: TileStats & { recommendations: string[] };
      fonts: EnhancedFontStats & { recommendations: string[] };
      sprites: {
        totalSprites: number;
        totalSize: number;
        styleCount: number;
        spritesByType: Record<string, number>;
        sizeByType: Record<string, number>;
        topStyles: Array<{ styleId: string; spriteCount: number; size: number }>;
        recommendations: string[];
      };
      styles: {
        totalStyles: number;
        totalSize: number;
        totalSources: number;
        totalLayers: number;
        sourceTypeBreakdown: Record<string, number>;
        layerTypeBreakdown: Record<string, number>;
        stylesWithGlyphs: number;
        stylesWithSprites: number;
        averageLayersPerStyle: number;
        averageSourcesPerStyle: number;
        recommendations: string[];
      };
    };
    recommendations: {
      immediate: string[];
      maintenance: string[];
      optimization: string[];
    };
    healthScore: {
      overall: number;
      breakdown: {
        storage: number;
        integrity: number;
        organization: number;
        performance: number;
      };
    };
  }> {
    const analytics = await this.getStorageAnalytics();
    const totalSize = analytics.total.size;

    // Format sizes
    const formatSize = (bytes: number): string => {
      if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
      if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
      if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${bytes}B`;
    };

    // Calculate component percentages
    const components = [
      { name: 'Tiles', size: formatSize(analytics.tiles.totalSize), percentage: (analytics.tiles.totalSize / totalSize) * 100 },
      { name: 'Fonts', size: formatSize(analytics.fonts.totalSize), percentage: (analytics.fonts.totalSize / totalSize) * 100 },
      { name: 'Sprites', size: formatSize(analytics.sprites.totalSize), percentage: (analytics.sprites.totalSize / totalSize) * 100 },
      { name: 'Styles', size: formatSize(analytics.styles.totalSize), percentage: (analytics.styles.totalSize / totalSize) * 100 }
    ].filter(c => c.percentage > 0);

    // Categorize recommendations
    const immediate: string[] = [];
    const maintenance: string[] = [];
    const optimization: string[] = [];

    analytics.total.recommendations.forEach(rec => {
      if (rec.includes('very large') || rec.includes('critical') || rec.includes('corrupted')) {
        immediate.push(rec);
      } else if (rec.includes('cleanup') || rec.includes('old') || rec.includes('expired')) {
        maintenance.push(rec);
      } else {
        optimization.push(rec);
      }
    });

    // Calculate health score
    const storageScore = Math.max(0, 100 - (totalSize / (100 * 1024 * 1024)) * 10); // Penalty for large storage
    const integrityScore = 90; // Placeholder - would calculate based on corruption rates
    const organizationScore = Math.max(0, 100 - immediate.length * 20 - maintenance.length * 5);
    const performanceScore = Math.max(0, 100 - optimization.length * 10);
    const overallScore = (storageScore + integrityScore + organizationScore + performanceScore) / 4;

    return {
      overview: {
        totalSize: formatSize(totalSize),
        components
      },
      details: {
        tiles: { ...analytics.tiles, recommendations: analytics.tiles.recommendations },
        fonts: { ...analytics.fonts, recommendations: analytics.fonts.recommendations },
        sprites: analytics.sprites,
        styles: analytics.styles
      },
      recommendations: {
        immediate,
        maintenance,
        optimization
      },
      healthScore: {
        overall: Math.round(overallScore),
        breakdown: {
          storage: Math.round(storageScore),
          integrity: Math.round(integrityScore),
          organization: Math.round(organizationScore),
          performance: Math.round(performanceScore)
        }
      }
    };
  }

  private async getAllTileStats(): Promise<TileStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;
    const zoomLevelStats = new Map<number, { count: number; size: number }>();
    
    for (const styleId of styleIds) {
      const stats = await getTileStats(styleId);
      totalCount += stats.count;
      totalSize += stats.totalSize;
      
      // Track oldest and newest tiles
      if (stats.oldestTile && (!oldestTile || stats.oldestTile < oldestTile)) {
        oldestTile = stats.oldestTile;
      }
      if (stats.newestTile && (!newestTile || stats.newestTile > newestTile)) {
        newestTile = stats.newestTile;
      }
      
      // Merge zoom level stats
      stats.zoomLevelStats.forEach((levelStats, zoom) => {
        const existing = zoomLevelStats.get(zoom) || { count: 0, size: 0 };
        zoomLevelStats.set(zoom, {
          count: existing.count + levelStats.count,
          size: existing.size + levelStats.size
        });
      });
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      oldestTile,
      newestTile,
      zoomLevelStats
    };
  }

  private async getAllFontStats(): Promise<EnhancedFontStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    const allFonts: string[] = [];
    const fontsByType: Record<string, number> = {};
    const corruptedFonts: string[] = [];
    let oldestFont: { key: string; timestamp: number } | undefined;
    let newestFont: { key: string; timestamp: number } | undefined;
    
    for (const styleId of styleIds) {
      const stats = await getFontStats(styleId);
      totalCount += stats.count;
      totalSize += stats.totalSize;
      allFonts.push(...stats.fonts);
      corruptedFonts.push(...stats.corruptedFonts);
      
      // Merge font types
      Object.entries(stats.fontsByType).forEach(([type, count]) => {
        fontsByType[type] = (fontsByType[type] || 0) + count;
      });
      
      // Track oldest and newest
      if (stats.oldestFont && (!oldestFont || stats.oldestFont.timestamp < oldestFont.timestamp)) {
        oldestFont = stats.oldestFont;
      }
      if (stats.newestFont && (!newestFont || stats.newestFont.timestamp > newestFont.timestamp)) {
        newestFont = stats.newestFont;
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      fonts: allFonts,
      fontsByType,
      oldestFont,
      newestFont,
      corruptedFonts
    };
  }
}

// ---
// Patch style for offline use
function patchStyleForOffline(style: any, downloadId: string) {
  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey];
    if (source.tiles) {
      source.tiles = source.tiles.map(
        (url: string) => `idb://${downloadId}/tile/${encodeURIComponent(url)}`,
      );
    }
    if (source.url) {
      source.url = `idb://${downloadId}/tilesjson/${encodeURIComponent(source.url)}`;
    }
  }
  // Patch glyphs
  if (style.glyphs) {
    style.glyphs = `idb://${downloadId}/glyph/{fontstack}/{range}.pbf`;
  }
  // Patch sprite
  if (style.sprite) {
    style.sprite = `idb://${downloadId}/sprite/sprite`;
  }
  return style;
}
