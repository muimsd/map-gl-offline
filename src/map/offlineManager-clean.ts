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
    const styleResult = await downloadStyles(region.styleUrl!, region.styleId!, {});
    const style = styleResult.styles[0]?.data;
    
    // Ensure styleId is available
    let styleId = region.styleId || region.id;
    if (!styleId) throw new Error('Style must have an id');

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleId)) as StyleEntry | undefined;
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
    
    // Save the updated style entry
    await db.put('styles', { ...styleEntry, key: styleId });
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    const styleId = region.styleId || region.id;
    const storedStyle = await db.get('styles', styleId!);
    
    if (!storedStyle) {
      throw new Error(`Style not found for region: ${region.id}`);
    }

    // Load tiles from storage
    await loadTiles(storedStyle);
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);
    
    if (!region) {
      console.warn(`Region ${regionId} not found`);
      return;
    }

    const styleId = (region as StoredRegion).styleId;
    
    // Delete associated resources
    await Promise.all([
      deleteTiles(styleId),
      deleteFontsByStyleId(styleId),
      deleteSprites(styleId),
    ]);

    // Remove from regions table
    await db.delete('regions', regionId);
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    const regions = await db.getAll('regions');
    return regions as OfflineRegionOptions[];
  }

  // Enhanced Tile Management Methods
  async downloadTilesWithOptions(
    region: OfflineRegionOptions,
    style: any,
    styleId: string,
    options: TileDownloadOptions = {}
  ): Promise<TileDownloadResult> {
    return downloadTiles(region, style, styleId, options);
  }

  async getTileStatistics(styleId: string): Promise<TileStats> {
    return getTileStats(styleId);
  }

  // Enhanced Font Management Methods
  async downloadFontsWithOptions(
    styleId: string,
    glyphUrls: string[],
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    return downloadFonts(styleId, glyphUrls, options);
  }

  async getFontStatistics(styleId: string): Promise<EnhancedFontStats> {
    return getFontStats(styleId);
  }

  async getFontAnalytics(styleId?: string): Promise<{
    totalFonts: number;
    totalSize: number;
    averageSize: number;
    compressionRatio: number;
    formatBreakdown: Record<string, number>;
    topFonts: Array<{ name: string; size: number; usageCount: number }>;
    recommendations: string[];
  }> {
    return getFontAnalytics(styleId);
  }

  async cleanupOldFonts(options: {
    maxAge?: number;
    maxStorageSize?: number;
    styleId?: string;
  } = {}): Promise<{ deletedCount: number; freedSpace: number }> {
    return cleanupOldFonts(options);
  }

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

  // Enhanced Sprite Management Methods
  async downloadSpritesWithOptions(
    styleId: string,
    urls: string[],
    options: SpriteDownloadOptions = {}
  ): Promise<SpriteDownloadResult> {
    return downloadSprites(styleId, urls, options);
  }

  async getSpriteStatistics(styleId: string): Promise<EnhancedSpriteStats> {
    return getSpriteStats(styleId);
  }

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

  async verifyAndRepairSprites(
    styleId: string,
    options: {
      removeCorrupted?: boolean;
      onProgress?: (progress: { checked: number; total: number; corrupted: number; repaired: number }) => void;
    } = {}
  ): Promise<{ totalSprites: number; corruptedSprites: number; repairedSprites: number; removedSprites: number }> {
    return verifyAndRepairSprites(styleId, options);
  }

  async getSpriteAnalytics(styleId?: string): Promise<{
    totalSprites: number;
    totalSize: number;
    styleCount: number;
    spritesByType: Record<string, number>;
    sizeByType: Record<string, number>;
    topStyles: Array<{ styleId: string; spriteCount: number; size: number }>;
    recommendations: string[];
  }> {
    return getSpriteAnalytics(styleId);
  }

  // Enhanced Style Management Methods
  async downloadStylesWithOptions(
    styleUrl: string,
    styleId: string,
    options: StyleDownloadOptions = {}
  ): Promise<StyleDownloadResult> {
    return downloadStyles(styleUrl, styleId, options);
  }

  async getStyleStatistics(styleId: string): Promise<EnhancedStyleStats> {
    return getStyleStats(styleId);
  }

  async cleanupOldStyles(options: {
    maxAge?: number;
    maxCount?: number;
    maxSize?: number;
    onProgress?: (progress: { completed: number; total: number; message: string }) => void;
  } = {}): Promise<{ deletedCount: number; freedSpace: number; errors: string[] }> {
    return cleanupOldStyles(options);
  }

  async verifyAndValidateStyles(options: {
    removeInvalid?: boolean;
    onProgress?: (progress: { checked: number; total: number; invalid: number; repaired: number }) => void;
  } = {}): Promise<{ totalStyles: number; invalidStyles: number; repairedStyles: number; removedStyles: number }> {
    return verifyAndValidateStyles(options);
  }

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

  async performMaintenance(options: {
    maxAge?: number;
    maxStorageSize?: number;
    verifyIntegrity?: boolean;
    removeCorrupted?: boolean;
    onProgress?: (progress: {
      component: 'tiles' | 'fonts' | 'sprites' | 'styles' | 'cleanup';
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
    sprites: {
      verified?: { totalSprites: number; corruptedSprites: number; removedSprites: number };
      cleaned: { deletedCount: number; freedSpace: number; errors: string[] };
    };
    styles: {
      verified?: { totalStyles: number; invalidStyles: number; removedStyles: number };
      cleaned: { deletedCount: number; freedSpace: number; errors: string[] };
    };
    totalFreedSpace: number;
    summary: string;
  }> {
    const { maxAge = 60, maxStorageSize, verifyIntegrity = true, removeCorrupted = true, onProgress } = options;
    
    const results = {
      tiles: { cleaned: { deletedCount: 0, freedSpace: 0 } },
      fonts: { cleaned: { deletedCount: 0, freedSpace: 0 } },
      sprites: { cleaned: { deletedCount: 0, freedSpace: 0, errors: [] } },
      styles: { cleaned: { deletedCount: 0, freedSpace: 0, errors: [] } },
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
            onProgress: (progress: { checked: number; total: number; corrupted: number }) => {
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

        // Sprite verification
        onProgress?.({ component: 'sprites', message: 'Verifying sprite integrity...' });
        for (const styleId of styleIds) {
          const spriteVerification = await verifyAndRepairSprites(styleId, { removeCorrupted });
          if (!results.sprites.verified) {
            results.sprites.verified = { totalSprites: 0, corruptedSprites: 0, removedSprites: 0 };
          }
          results.sprites.verified.totalSprites += spriteVerification.totalSprites;
          results.sprites.verified.corruptedSprites += spriteVerification.corruptedSprites;
          results.sprites.verified.removedSprites += spriteVerification.removedSprites;
        }

        // Style verification
        onProgress?.({ component: 'styles', message: 'Verifying style integrity...' });
        const styleVerification = await verifyAndValidateStyles({ removeInvalid: removeCorrupted });
        results.styles.verified = {
          totalStyles: styleVerification.totalStyles,
          invalidStyles: styleVerification.invalidStyles,
          removedStyles: styleVerification.removedStyles
        };
      }

      // Cleanup operations
      onProgress?.({ component: 'fonts', message: 'Cleaning up old fonts...' });
      const fontCleanup = await cleanupOldFonts({ maxAge, maxStorageSize });
      results.fonts.cleaned = fontCleanup;
      results.totalFreedSpace += fontCleanup.freedSpace;

      onProgress?.({ component: 'sprites', message: 'Cleaning up old sprites...' });
      const allStyles = await this.listRegions();
      const styleIds = [...new Set(allStyles.map(r => r.styleId || r.id))];
      
      let totalSpriteDeleted = 0;
      let totalSpriteFreed = 0;
      const spriteErrors: string[] = [];

      for (const styleId of styleIds) {
        try {
          const spriteCleanup = await cleanupOldSprites(styleId, { maxAge });
          totalSpriteDeleted += spriteCleanup.deletedCount;
          totalSpriteFreed += spriteCleanup.freedSpace;
          spriteErrors.push(...spriteCleanup.errors);
        } catch (error) {
          spriteErrors.push(`Failed to cleanup sprites for ${styleId}: ${error}`);
        }
      }

      results.sprites.cleaned = {
        deletedCount: totalSpriteDeleted,
        freedSpace: totalSpriteFreed,
        errors: spriteErrors
      };
      results.totalFreedSpace += totalSpriteFreed;

      onProgress?.({ component: 'styles', message: 'Cleaning up old styles...' });
      const styleCleanup = await cleanupOldStyles({ maxAge });
      results.styles.cleaned = styleCleanup;
      results.totalFreedSpace += styleCleanup.freedSpace;

      // Region cleanup
      onProgress?.({ component: 'cleanup', message: 'Cleaning up expired regions...' });
      const expiredCount = await this.cleanupExpiredRegions();
      
      // Summary
      const summary = [
        `Maintenance completed:`,
        `- Fonts: ${results.fonts.cleaned.deletedCount} deleted`,
        results.fonts.verified ? `- Font verification: ${results.fonts.verified.corruptedFonts} corrupted, ${results.fonts.verified.removedFonts} removed` : '',
        `- Sprites: ${results.sprites.cleaned.deletedCount} deleted`,
        `- Styles: ${results.styles.cleaned.deletedCount} deleted`,
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
        totalItems: analytics.tiles.count + analytics.fonts.count + analytics.sprites.count + analytics.styles.count,
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
    const allSprites: string[] = [];
    const corruptedSprites: string[] = [];
    
    for (const styleId of styleIds) {
      try {
        const stats = await getSpriteStats(styleId);
        totalCount += stats.count;
        totalSize += stats.totalSize;
        allSprites.push(...stats.sprites);
        corruptedSprites.push(...stats.corruptedSprites);
        
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
      sprites: allSprites,
      spritesByType,
      oldestSprite: undefined,
      newestSprite: undefined,
      corruptedSprites
    };
  }

  private async getAllStyleStats(): Promise<EnhancedStyleStats> {
    const regions = await this.listRegions();
    const styleIds = [...new Set(regions.map(r => r.styleId || r.id))];
    
    let totalCount = 0;
    let totalSize = 0;
    const allStyles: string[] = [];
    
    for (const styleId of styleIds) {
      try {
        const stats = await getStyleStats(styleId);
        totalCount += stats.count;
        totalSize += stats.totalSize;
        allStyles.push(...stats.styles);
      } catch (error) {
        console.warn(`Failed to get style stats for ${styleId}:`, error);
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      styles: allStyles,
      oldestStyle: undefined,
      newestStyle: undefined
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
