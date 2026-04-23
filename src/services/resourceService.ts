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
import {
  downloadModels,
  getModelStats,
  cleanupOldModels,
  verifyAndRepairModels,
} from './modelService';
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
  ModelDownloadOptions,
  ModelDownloadResult,
  EnhancedModelStats,
} from '@/types';

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

  async getTileStats(styleId?: string): Promise<TileStats> {
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

  async getFontStats(): Promise<EnhancedFontStats> {
    return getFontStats();
  }

  async getFontAnalytics(): Promise<Record<string, unknown>> {
    return getFontAnalytics();
  }

  async cleanupOldFonts(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    return cleanupOldFonts(options?.maxAge, { styleId });
  }

  async verifyAndRepairFonts(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairFonts();
  }

  // Sprite Management Methods
  async downloadSpritesWithOptions(
    spriteUrls: string[],
    styleName: string,
    options: SpriteDownloadOptions = {}
  ): Promise<SpriteDownloadResult> {
    return downloadSprites(spriteUrls, styleName, options);
  }

  async getSpriteStats(): Promise<EnhancedSpriteStats> {
    return getSpriteStats();
  }

  async getSpriteAnalytics(): Promise<Record<string, unknown>> {
    return getSpriteAnalytics();
  }

  async cleanupOldSprites(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    return cleanupOldSprites(options?.maxAge, { styleId });
  }

  async verifyAndRepairSprites(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairSprites();
  }

  // Glyph Management Methods
  async downloadGlyphsWithOptions(
    glyphUrl: string,
    fontstacks: string[],
    styleName: string,
    ranges?: string[],
    options: GlyphDownloadOptions = {}
  ): Promise<GlyphDownloadResult> {
    return downloadGlyphs(glyphUrl, fontstacks, styleName, ranges, options);
  }

  async getGlyphStats(): Promise<EnhancedGlyphStats> {
    return getGlyphStats();
  }

  async getGlyphAnalytics(): Promise<Record<string, unknown>> {
    return getGlyphAnalytics();
  }

  async loadGlyphsForStyle(fontstack: string, ranges: string[], styleId?: string) {
    return loadGlyphs(fontstack, ranges, styleId);
  }

  async cleanupOldGlyphs(styleId?: string, options?: { maxAge?: number }): Promise<number> {
    return cleanupOldGlyphs(options?.maxAge, { styleId });
  }

  async verifyAndRepairGlyphs(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairGlyphs();
  }

  // 3D Model Management Methods

  async downloadModelsWithOptions(
    models: Record<string, string>,
    styleId: string,
    options: ModelDownloadOptions = {}
  ): Promise<ModelDownloadResult> {
    return downloadModels(models, styleId, options);
  }

  async getModelStats(): Promise<EnhancedModelStats> {
    return getModelStats();
  }

  async cleanupOldModels(options?: { maxAge?: number }): Promise<number> {
    return cleanupOldModels(options?.maxAge);
  }

  async verifyAndRepairModels(): Promise<{ verified: number; repaired: number; removed: number }> {
    return verifyAndRepairModels();
  }
}
