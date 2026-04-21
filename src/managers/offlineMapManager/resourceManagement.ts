import type { ResourceService } from '@/services/resourceService';
import type { OfflineManagerServices } from './base';

export type ResourceServiceMethod<TMethod extends keyof ResourceService> = ResourceService[TMethod];

export interface ResourceManagement {
  downloadTilesWithOptions: ResourceService['downloadTilesWithOptions'];
  getTileStats: ResourceService['getTileStats'];
  downloadFontsWithOptions: ResourceService['downloadFontsWithOptions'];
  getFontStats: ResourceService['getFontStats'];
  getFontAnalytics: ResourceService['getFontAnalytics'];
  cleanupOldFonts: ResourceService['cleanupOldFonts'];
  verifyAndRepairFonts: ResourceService['verifyAndRepairFonts'];
  downloadSpritesWithOptions: ResourceService['downloadSpritesWithOptions'];
  getSpriteStats: ResourceService['getSpriteStats'];
  cleanupOldSprites: ResourceService['cleanupOldSprites'];
  verifyAndRepairSprites: ResourceService['verifyAndRepairSprites'];
  getSpriteAnalytics: ResourceService['getSpriteAnalytics'];
  downloadGlyphsWithOptions: ResourceService['downloadGlyphsWithOptions'];
  getGlyphStats: ResourceService['getGlyphStats'];
  getGlyphAnalytics: ResourceService['getGlyphAnalytics'];
  loadGlyphsForStyle: ResourceService['loadGlyphsForStyle'];
  cleanupOldGlyphs: ResourceService['cleanupOldGlyphs'];
  verifyAndRepairGlyphs: ResourceService['verifyAndRepairGlyphs'];
  downloadModelsWithOptions: ResourceService['downloadModelsWithOptions'];
  getModelStats: ResourceService['getModelStats'];
  cleanupOldModels: ResourceService['cleanupOldModels'];
  verifyAndRepairModels: ResourceService['verifyAndRepairModels'];
}

export const createResourceManagement = (services: OfflineManagerServices): ResourceManagement => ({
  downloadTilesWithOptions: (...args) => services.resourceService.downloadTilesWithOptions(...args),
  getTileStats: (...args) => services.resourceService.getTileStats(...args),
  downloadFontsWithOptions: (...args) => services.resourceService.downloadFontsWithOptions(...args),
  getFontStats: (...args) => services.resourceService.getFontStats(...args),
  getFontAnalytics: (...args) => services.resourceService.getFontAnalytics(...args),
  cleanupOldFonts: (...args) => services.resourceService.cleanupOldFonts(...args),
  verifyAndRepairFonts: (...args) => services.resourceService.verifyAndRepairFonts(...args),
  downloadSpritesWithOptions: (...args) =>
    services.resourceService.downloadSpritesWithOptions(...args),
  getSpriteStats: (...args) => services.resourceService.getSpriteStats(...args),
  cleanupOldSprites: (...args) => services.resourceService.cleanupOldSprites(...args),
  verifyAndRepairSprites: (...args) => services.resourceService.verifyAndRepairSprites(...args),
  getSpriteAnalytics: (...args) => services.resourceService.getSpriteAnalytics(...args),
  downloadGlyphsWithOptions: (...args) =>
    services.resourceService.downloadGlyphsWithOptions(...args),
  getGlyphStats: (...args) => services.resourceService.getGlyphStats(...args),
  getGlyphAnalytics: (...args) => services.resourceService.getGlyphAnalytics(...args),
  loadGlyphsForStyle: (...args) => services.resourceService.loadGlyphsForStyle(...args),
  cleanupOldGlyphs: (...args) => services.resourceService.cleanupOldGlyphs(...args),
  verifyAndRepairGlyphs: (...args) => services.resourceService.verifyAndRepairGlyphs(...args),
  downloadModelsWithOptions: (...args) =>
    services.resourceService.downloadModelsWithOptions(...args),
  getModelStats: (...args) => services.resourceService.getModelStats(...args),
  cleanupOldModels: (...args) => services.resourceService.cleanupOldModels(...args),
  verifyAndRepairModels: (...args) => services.resourceService.verifyAndRepairModels(...args),
});
