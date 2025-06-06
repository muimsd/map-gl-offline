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
  loadStyleById,
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
import {
  downloadGlyphs,
  loadGlyphs,
  deleteGlyphs,
  getGlyphStats,
  cleanupOldGlyphs,
  verifyAndRepairGlyphs,
  GlyphDownloadOptions,
  GlyphDownloadResult,
  EnhancedGlyphStats
} from './glyphManager';
import { RegionCleanupManager, RegionCleanupOptions, CleanupResult, RegionAnalytics } from './regionCleanup';
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
    const styleResult = await downloadStyles(region.styleUrl!, {});
    if (!styleResult.success) {
      throw new Error(`Failed to download style from ${region.styleUrl}`);
    }

    const style = await loadStyleById(styleResult.styleId);
    
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
    glyphUrls: string[],
    downloadId?: string,
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    return downloadFonts(glyphUrls, downloadId, options);
  }

  async getFontStatistics(styleId: string): Promise<EnhancedFontStats> {
    return getFontStats(styleId);
  }

  async getFontAnalytics(): Promise<{
    totalFonts: number;
    totalSize: number;
    averageSize: number;
    sizeByType: Record<string, number>;
    countByType: Record<string, number>;
    downloadTimeRange: { oldest?: Date; newest?: Date };
    compressionRatio: number;
  }> {
    return getFontAnalytics();
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

  // Enhanced Glyph Management Methods
  async downloadGlyphsWithOptions(
    styleId: string,
    glyphUrls: string[],
    options: GlyphDownloadOptions = {}
  ): Promise<GlyphDownloadResult> {
    return downloadGlyphs(styleId, glyphUrls, options);
  }

  async getGlyphStatistics(styleId: string): Promise<EnhancedGlyphStats> {
    return getGlyphStats(styleId);
  }

  async loadGlyphsForStyle(styleId: string, fontstack?: string): Promise<any[]> {
    const glyphEntries = await loadGlyphs(styleId, fontstack);
    return glyphEntries.map(entry => ({
      fontstack: entry.fontstack,
      range: entry.range,
      data: entry.data,
      size: entry.size,
      lastModified: entry.lastModified
    }));
  }

  async cleanupOldGlyphs(options: {
    maxAge?: number;
    maxCount?: number;
    maxSize?: number;
    styleId?: string;
    onProgress?: (progress: { completed: number; total: number; message: string }) => void;
  } = {}): Promise<{ deletedCount: number; freedSpace: number; errors: string[] }> {
    return cleanupOldGlyphs(options);
  }

  async verifyAndRepairGlyphs(
    styleId: string,
    options: {
      removeCorrupted?: boolean;
      onProgress?: (progress: { checked: number; total: number; corrupted: number; repaired: number }) => void;
    } = {}
  ): Promise<{ totalGlyphs: number; corruptedGlyphs: number; repairedGlyphs: number; removedGlyphs: number }> {
    return verifyAndRepairGlyphs(styleId, options);
  }

  // Enhanced Region Analytics and Management
  async getRegionAnalytics(): Promise<RegionAnalytics> {
    return this.cleanupManager.getRegionAnalytics();
  }

  async performSmartCleanup(options: RegionCleanupOptions = {}): Promise<CleanupResult> {
    return this.cleanupManager.smartCleanup(options);
  }

  async startEnhancedAutoCleanup(
    intervalMs: number = 1000 * 60 * 60,
    options: RegionCleanupOptions = {}
  ): Promise<ReturnType<typeof setInterval>> {
    return this.cleanupManager.startAutoCleanup(intervalMs, options);
  }

  stopAllAutoCleanup(): void {
    this.cleanupManager.stopAllAutoCleanup();
  }

  // Comprehensive Storage Analytics
  async getComprehensiveStorageAnalytics(): Promise<{
    tiles: TileStats;
    fonts: EnhancedFontStats;
    sprites: EnhancedSpriteStats;
    glyphs: EnhancedGlyphStats;
    regions: RegionAnalytics;
    totalStorageSize: number;
    storageByType: Record<string, number>;
    recommendations: string[];
  }> {
    const [tileStats, fontStats, spriteStats, glyphStats, regionAnalytics] = await Promise.all([
      this.getAllTileStats(),
      this.getAllFontStats(),
      this.getAllSpriteStats(),
      this.getAllGlyphStats(),
      this.getRegionAnalytics()
    ]);

    const totalStorageSize = 
      (tileStats.totalSize || 0) + 
      (fontStats.totalSize || 0) + 
      (spriteStats.totalSize || 0) + 
      (glyphStats.totalSize || 0);

    const storageByType = {
      tiles: tileStats.totalSize || 0,
      fonts: fontStats.totalSize || 0,
      sprites: spriteStats.totalSize || 0,
      glyphs: glyphStats.totalSize || 0
    };

    const recommendations = this.generateStorageRecommendations({
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteStats,
      glyphs: glyphStats,
      regions: regionAnalytics,
      totalSize: totalStorageSize
    });

    return {
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteStats,
      glyphs: glyphStats,
      regions: regionAnalytics,
      totalStorageSize,
      storageByType,
      recommendations
    };
  }

  // Helper Methods for Comprehensive Analytics
  private async getAllTileStats(): Promise<TileStats> {
    const db = await dbPromise;
    const styles = await db.getAll('styles');
    
    let totalCount = 0;
    let totalSize = 0;
    const combinedZoomStats = new Map<number, { count: number; size: number }>();
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;
    
    for (const style of styles) {
      const styleStats = await getTileStats((style as any).key);
      totalCount += styleStats.count || 0;
      totalSize += styleStats.totalSize || 0;
      
      // Track oldest/newest across all styles
      if (styleStats.oldestTile && (!oldestTile || styleStats.oldestTile < oldestTile)) {
        oldestTile = styleStats.oldestTile;
      }
      if (styleStats.newestTile && (!newestTile || styleStats.newestTile > newestTile)) {
        newestTile = styleStats.newestTile;
      }
      
      // Combine zoom level statistics
      if (styleStats.zoomLevelStats) {
        styleStats.zoomLevelStats.forEach((stats, zoom) => {
          const existing = combinedZoomStats.get(zoom) || { count: 0, size: 0 };
          combinedZoomStats.set(zoom, {
            count: existing.count + stats.count,
            size: existing.size + stats.size
          });
        });
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      oldestTile,
      newestTile,
      zoomLevelStats: combinedZoomStats
    };
  }

  private async getAllFontStats(): Promise<EnhancedFontStats> {
    const analytics = await getFontAnalytics();
    return {
      count: analytics.totalFonts,
      totalSize: analytics.totalSize,
      averageSize: analytics.averageSize,
      fonts: [],
      fontsByType: analytics.countByType,
      corruptedFonts: []
    };
  }

  private async getAllSpriteStats(): Promise<EnhancedSpriteStats> {
    const analytics = await getSpriteAnalytics();
    return {
      count: analytics.totalSprites,
      totalSize: analytics.totalSize,
      averageSize: analytics.totalSize / Math.max(analytics.totalSprites, 1),
      sprites: [],
      spritesByType: analytics.spritesByType,
      sizeByType: analytics.sizeByType,
      storageRecommendations: analytics.recommendations
    };
  }

  private async getAllGlyphStats(): Promise<EnhancedGlyphStats> {
    const db = await dbPromise;
    const styles = await db.getAll('styles');
    
    let totalCount = 0;
    let totalSize = 0;
    const allGlyphs: string[] = [];
    const glyphsByFontstack: Record<string, number> = {};
    const corruptedGlyphs: string[] = [];
    let oldestGlyph: { key: string; timestamp: number } | undefined;
    let newestGlyph: { key: string; timestamp: number } | undefined;
    
    for (const style of styles) {
      try {
        const styleStats = await getGlyphStats((style as any).key);
        totalCount += styleStats.count || 0;
        totalSize += styleStats.totalSize || 0;
        
        // Merge glyph lists
        allGlyphs.push(...styleStats.glyphs);
        
        // Merge fontstack statistics
        Object.entries(styleStats.glyphsByFontstack).forEach(([fontstack, count]) => {
          glyphsByFontstack[fontstack] = (glyphsByFontstack[fontstack] || 0) + count;
        });
        
        // Merge corrupted glyphs
        corruptedGlyphs.push(...styleStats.corruptedGlyphs);
        
        // Track oldest and newest
        if (styleStats.oldestGlyph && (!oldestGlyph || styleStats.oldestGlyph.timestamp < oldestGlyph.timestamp)) {
          oldestGlyph = styleStats.oldestGlyph;
        }
        if (styleStats.newestGlyph && (!newestGlyph || styleStats.newestGlyph.timestamp > newestGlyph.timestamp)) {
          newestGlyph = styleStats.newestGlyph;
        }
      } catch (error) {
        console.warn(`Failed to get glyph stats for style ${(style as any).key}:`, error);
      }
    }
    
    return {
      count: totalCount,
      totalSize,
      averageSize: totalCount > 0 ? totalSize / totalCount : 0,
      glyphs: [...new Set(allGlyphs)], // Remove duplicates
      glyphsByFontstack,
      oldestGlyph,
      newestGlyph,
      corruptedGlyphs: [...new Set(corruptedGlyphs)], // Remove duplicates
      unicodeRanges: [],
      compressionStats: {
        averageRatio: 0,
        bestCompressed: { key: '', ratio: 0 },
        worstCompressed: { key: '', ratio: 0 }
      }
    };
  }

  private generateStorageRecommendations(analytics: {
    tiles: TileStats;
    fonts: EnhancedFontStats;
    sprites: EnhancedSpriteStats;
    glyphs: EnhancedGlyphStats;
    regions: RegionAnalytics;
    totalSize: number;
  }): string[] {
    const recommendations: string[] = [];
    const { tiles, fonts, sprites, glyphs, regions, totalSize } = analytics;
    
    // Storage size recommendations
    const totalMB = totalSize / (1024 * 1024);
    if (totalMB > 1000) {
      recommendations.push(`Large storage usage detected (${totalMB.toFixed(1)}MB). Consider cleaning up old regions.`);
    }
    
    // Tile recommendations
    if (tiles.count > 50000) {
      recommendations.push(`High tile count (${tiles.count}). Consider reducing zoom levels or region sizes.`);
    }
    
    // Font recommendations
    if (fonts.count > 1000) {
      recommendations.push(`Many fonts stored (${fonts.count}). Consider cleanup if not all are needed.`);
    }
    
    // Sprite recommendations
    if (sprites.count > 500) {
      recommendations.push(`Large number of sprites (${sprites.count}). Consider sprite atlas optimization.`);
    }
    
    // Glyph recommendations
    if (glyphs.count > 2000) {
      recommendations.push(`High glyph count (${glyphs.count}). Consider limiting character ranges.`);
    }
    
    // Region recommendations
    if (regions.totalRegions > 20) {
      recommendations.push(`Many regions stored (${regions.totalRegions}). Consider consolidating or removing unused regions.`);
    }
    
    // Check for expired regions using the expiry distribution
    const expiredCount = regions.expiryDistribution.expired;
    if (expiredCount > 0) {
      recommendations.push(`${expiredCount} expired regions found. Run cleanup to free storage.`);
    }
    
    // Performance recommendations
    const avgTileSize = tiles.averageSize || 0;
    if (avgTileSize > 50000) {
      recommendations.push(`Large average tile size (${(avgTileSize / 1024).toFixed(1)}KB). Consider using vector tiles or lower quality.`);
    }
    
    return recommendations;
  }

  // Complete System Maintenance
  async performCompleteMaintenance(options: {
    cleanupExpired?: boolean;
    verifyIntegrity?: boolean;
    optimizeStorage?: boolean;
    generateReport?: boolean;
    onProgress?: (stage: string, progress: number) => void;
  } = {}): Promise<{
    cleanupResults?: CleanupResult;
    integrityResults?: {
      tiles: { errors: number; fixed: number };
      fonts: { corrupted: number; repaired: number };
      sprites: { corrupted: number; repaired: number };
      glyphs: { corrupted: number; repaired: number };
    };
    optimizationResults?: {
      freedSpace: number;
      optimizedResources: number;
    };
    analyticsReport?: any;
    totalTimeMs: number;
  }> {
    const startTime = Date.now();
    const results: any = {};
    let currentProgress = 0;
    const totalStages = Object.values(options).filter(Boolean).length;
    
    try {
      // Stage 1: Cleanup expired regions
      if (options.cleanupExpired) {
        options.onProgress?.('Cleaning up expired regions', currentProgress / totalStages);
        results.cleanupResults = await this.performSmartCleanup();
        currentProgress++;
      }
      
      // Stage 2: Verify integrity
      if (options.verifyIntegrity) {
        options.onProgress?.('Verifying resource integrity', currentProgress / totalStages);
        const styles = await this.listRegions();
        const integrityResults = {
          tiles: { errors: 0, fixed: 0 },
          fonts: { corrupted: 0, repaired: 0 },
          sprites: { corrupted: 0, repaired: 0 },
          glyphs: { corrupted: 0, repaired: 0 }
        };
        
        for (const region of styles) {
          const styleId = region.styleId || region.id;
          if (styleId) {
            try {
              const [fontResult, spriteResult, glyphResult] = await Promise.all([
                this.verifyAndRepairFonts(styleId, { removeCorrupted: true }),
                this.verifyAndRepairSprites(styleId, { autoRepair: true }),
                this.verifyAndRepairGlyphs(styleId, { removeCorrupted: true })
              ]);
              
              integrityResults.fonts.corrupted += fontResult.corruptedFonts;
              integrityResults.fonts.repaired += fontResult.removedFonts;
              integrityResults.sprites.corrupted += spriteResult.corruptedSprites;
              integrityResults.sprites.repaired += spriteResult.repairedSprites;
              integrityResults.glyphs.corrupted += glyphResult.corruptedGlyphs;
              integrityResults.glyphs.repaired += glyphResult.repairedGlyphs;
            } catch (error) {
              console.warn(`Integrity check failed for style ${styleId}:`, error);
            }
          }
        }
        
        results.integrityResults = integrityResults;
        currentProgress++;
      }
      
      // Stage 3: Optimize storage
      if (options.optimizeStorage) {
        options.onProgress?.('Optimizing storage', currentProgress / totalStages);
        let totalFreedSpace = 0;
        let optimizedResources = 0;
        
        const [fontCleanup, spriteCleanup, glyphCleanup] = await Promise.all([
          this.cleanupOldFonts({ maxAge: 30 * 24 * 60 * 60 * 1000 }), // 30 days
          this.cleanupOldSprites('', { maxAge: 30 * 24 * 60 * 60 * 1000 }),
          this.cleanupOldGlyphs({ maxAge: 30 * 24 * 60 * 60 * 1000 })
        ]);
        
        totalFreedSpace += fontCleanup.freedSpace + spriteCleanup.freedSpace + glyphCleanup.freedSpace;
        optimizedResources += fontCleanup.deletedCount + spriteCleanup.deletedCount + glyphCleanup.deletedCount;
        
        results.optimizationResults = {
          freedSpace: totalFreedSpace,
          optimizedResources
        };
        currentProgress++;
      }
      
      // Stage 4: Generate comprehensive report
      if (options.generateReport) {
        options.onProgress?.('Generating analytics report', currentProgress / totalStages);
        results.analyticsReport = await this.getComprehensiveStorageAnalytics();
        currentProgress++;
      }
      
      options.onProgress?.('Maintenance complete', 1);
      
      return {
        ...results,
        totalTimeMs: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Maintenance operation failed:', error);
      throw error;
    }
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
