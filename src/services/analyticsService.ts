import { getTileStats } from './tileService';
import { getFontStats } from './fontService';
import { getSpriteStats } from './spriteService';
import { getGlyphStats, EnhancedGlyphStats } from './glyphService';
import type {
  RegionAnalytics,
  TileStats,
  StorageAnalyticsReport,
  EnhancedFontStats,
  EnhancedSpriteStats,
} from '@/types';

// The underlying stats functions already iterate every entry in their
// respective stores, so the "getAll*" methods are just readable aliases
// — one scan per store, no per-style sub-iteration.
export class AnalyticsService {
  async getAllTileStats(): Promise<TileStats> {
    return getTileStats();
  }

  async getAllFontStats(): Promise<EnhancedFontStats> {
    return getFontStats();
  }

  async getAllSpriteStats(): Promise<EnhancedSpriteStats> {
    return getSpriteStats();
  }

  async getAllGlyphStats(): Promise<EnhancedGlyphStats> {
    return getGlyphStats();
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
