import { downloadTiles, getTileStats, getTileAnalytics, cleanupOldTiles } from './tileService';
import {
  downloadSprites,
  getSpriteStats,
  cleanupOldSprites,
  verifyAndRepairSprites,
  getSpriteAnalytics,
} from './spriteService';
import {
  downloadFonts,
  getFontStats,
  getFontAnalytics,
  cleanupOldFonts,
  verifyAndRepairFonts,
} from './fontService';
import {
  downloadGlyphs,
  loadGlyphs,
  getGlyphStats,
  getGlyphAnalytics,
  cleanupOldGlyphs,
  verifyAndRepairGlyphs,
  EnhancedGlyphStats,
} from './glyphService';
import type {
  OfflineRegionOptions,
  MapboxStyle,
  TileDownloadOptions,
  TileDownloadResult,
  TileStats,
  SpriteDownloadOptions,
  SpriteDownloadResult,
  EnhancedSpriteStats,
  FontDownloadOptions,
  FontDownloadResult,
  EnhancedFontStats,
  GlyphDownloadOptions,
  GlyphDownloadResult,
} from '../types';

export class ResourceService {
  // Tile Management Methods
  async downloadTilesWithOptions(
    region: OfflineRegionOptions,
    style: MapboxStyle,
    styleId: string,
    options: TileDownloadOptions = {}
  ): Promise<TileDownloadResult> {
    return downloadTiles(region, style, styleId, options);
  }

  async getTileStatistics(styleId?: string): Promise<TileStats> {
    return getTileStats(styleId);
  }

  async getTileAnalytics(styleId?: string): Promise<Record<string, unknown>> {
    return getTileAnalytics(styleId);
  }

  async cleanupOldTiles(maxAge?: number, styleId?: string): Promise<number> {
    return cleanupOldTiles(maxAge, styleId);
  }

  // Font Management Methods
  async downloadFontsWithOptions(
    fontUrls: string[],
    downloadId?: string,
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    return downloadFonts(fontUrls, downloadId, options);
  }

  async getFontStatistics(): Promise<EnhancedFontStats> {
    return getFontStats();
  }

  async getFontAnalytics(): Promise<Record<string, unknown>> {
    return getFontAnalytics();
  }

  async cleanupOldFonts(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    const maxAge = options?.maxAge;
    return cleanupOldFonts(maxAge);
  }

  async verifyAndRepairFonts(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairFonts();
  }

  // Sprite Management Methods
  async downloadSpritesWithOptions(
    spriteUrls: string[],
    options: SpriteDownloadOptions = {}
  ): Promise<SpriteDownloadResult> {
    return downloadSprites(spriteUrls, options);
  }

  async getSpriteStatistics(): Promise<EnhancedSpriteStats> {
    return getSpriteStats();
  }

  async getSpriteAnalytics(): Promise<Record<string, unknown>> {
    return getSpriteAnalytics();
  }

  async cleanupOldSprites(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    const maxAge = options?.maxAge;
    return cleanupOldSprites(maxAge);
  }

  async verifyAndRepairSprites(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairSprites();
  }

  // Glyph Management Methods
  async downloadGlyphsWithOptions(
    glyphUrl: string,
    fontstacks: string[],
    ranges?: string[],
    options: GlyphDownloadOptions = {}
  ): Promise<GlyphDownloadResult> {
    return downloadGlyphs(glyphUrl, fontstacks, ranges, options);
  }

  async getGlyphStatistics(): Promise<EnhancedGlyphStats> {
    return getGlyphStats();
  }

  async getGlyphAnalytics(): Promise<Record<string, unknown>> {
    return getGlyphAnalytics();
  }

  async loadGlyphsForStyle(fontstack: string, ranges: string[]) {
    return loadGlyphs(fontstack, ranges);
  }

  async cleanupOldGlyphs(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    const maxAge = options?.maxAge;
    return cleanupOldGlyphs(maxAge);
  }

  async verifyAndRepairGlyphs(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairGlyphs();
  }
}
