import { dbPromise } from '../storage/indexedDbManager';
import { getTileStats } from './tileService';
import { getFontAnalytics } from './fontService';
import { getSpriteAnalytics } from './spriteService';
import { getGlyphStats, EnhancedGlyphStats } from './glyphService';
import type {
  RegionAnalytics,
  StyleEntry,
  TileStats,
  StorageAnalyticsReport,
  EnhancedFontStats,
  EnhancedSpriteStats,
} from '../types/';

export class AnalyticsService {
  async getAllTileStats(): Promise<TileStats> {
    const db = await dbPromise;
    const styles = await db.getAll('styles');

    let totalCount = 0;
    let totalSize = 0;
    const combinedZoomStats = new Map<number, { count: number; size: number }>();
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;

    for (const style of styles) {
      const styleStats = await getTileStats((style as StyleEntry).key);
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
            size: existing.size + stats.size,
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
      zoomLevelStats: combinedZoomStats,
    };
  }

  async getAllFontStats(): Promise<EnhancedFontStats> {
    const analytics = await getFontAnalytics();
    // Access the nested properties from analytics
    const basic = analytics.basic as { totalFonts: number; totalSize: number; averageSize: number };
    const distribution = analytics.distribution as Record<string, number>;

    return {
      count: basic.totalFonts,
      totalSize: basic.totalSize,
      averageSize: basic.averageSize,
      fonts: [],
      fontsByType: distribution,
      corruptedFonts: [],
    };
  }

  async getAllSpriteStats(): Promise<EnhancedSpriteStats> {
    const analytics = await getSpriteAnalytics();
    // Access the nested properties from analytics
    const basic = analytics.basic as {
      totalSprites: number;
      totalSize: number;
      averageSize: number;
    };
    const distribution = analytics.distribution as {
      spritesByType: Record<string, number>;
      sizeByType: Record<string, number>;
    };

    return {
      count: basic.totalSprites,
      totalSize: basic.totalSize,
      averageSize: basic.totalSize / Math.max(basic.totalSprites, 1),
      sprites: [],
      spritesByType: distribution.spritesByType,
      sizeByType: distribution.sizeByType,
      corruptedSprites: [],
    };
  }

  async getAllGlyphStats(): Promise<EnhancedGlyphStats> {
    // Since getGlyphStats() operates globally and doesn't take parameters,
    // we can just call it directly instead of iterating through styles
    return await getGlyphStats();
  }

  async getComprehensiveStorageAnalytics(
    getRegionAnalytics: () => Promise<RegionAnalytics>
  ): Promise<StorageAnalyticsReport> {
    const [tileStats, fontStats, spriteStats, glyphStats, regionAnalytics] = await Promise.all([
      this.getAllTileStats(),
      this.getAllFontStats(),
      this.getAllSpriteStats(),
      this.getAllGlyphStats(),
      getRegionAnalytics(),
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
      glyphs: glyphStats.totalSize || 0,
    };

    const recommendations = this.generateStorageRecommendations({
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteStats,
      glyphs: glyphStats,
      regions: regionAnalytics,
      totalSize: totalStorageSize,
    });

    return {
      tiles: tileStats,
      fonts: fontStats,
      sprites: spriteStats,
      glyphs: glyphStats,
      regions: regionAnalytics,
      totalStorageSize,
      storageByType,
      recommendations,
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
      recommendations.push(
        `Large storage usage detected (${totalMB.toFixed(1)}MB). Consider cleaning up old regions.`
      );
    }

    // Tile recommendations
    if (tiles.count > 50000) {
      recommendations.push(
        `High tile count (${tiles.count}). Consider reducing zoom levels or region sizes.`
      );
    }

    // Font recommendations
    if (fonts.count > 1000) {
      recommendations.push(
        `Many fonts stored (${fonts.count}). Consider cleanup if not all are needed.`
      );
    }

    // Sprite recommendations
    if (sprites.count > 500) {
      recommendations.push(
        `Large number of sprites (${sprites.count}). Consider sprite atlas optimization.`
      );
    }

    // Glyph recommendations
    if (glyphs.count > 2000) {
      recommendations.push(
        `High glyph count (${glyphs.count}). Consider limiting character ranges.`
      );
    }

    // Region recommendations
    if (regions.totalRegions > 20) {
      recommendations.push(
        `Many regions stored (${regions.totalRegions}). Consider consolidating or removing unused regions.`
      );
    }

    // Check for expired regions using the expiry distribution
    const expiredCount = regions.expiryDistribution.expired;
    if (expiredCount > 0) {
      recommendations.push(`${expiredCount} expired regions found. Run cleanup to free storage.`);
    }

    // Performance recommendations
    const avgTileSize = tiles.averageSize || 0;
    if (avgTileSize > 50000) {
      recommendations.push(
        `Large average tile size (${(avgTileSize / 1024).toFixed(1)}KB). Consider using vector tiles or lower quality.`
      );
    }

    return recommendations;
  }
}
