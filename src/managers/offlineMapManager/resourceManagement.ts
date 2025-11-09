import type { ResourceService } from '../../services/resourceService';
import type { OfflineManagerServices } from './base';

export type ResourceServiceMethod<TMethod extends keyof ResourceService> = ResourceService[TMethod];

export interface ResourceManagement {
  downloadTilesWithOptions: ResourceService['downloadTilesWithOptions'];
  getTileStatistics: ResourceService['getTileStatistics'];
  downloadFontsWithOptions: ResourceService['downloadFontsWithOptions'];
  getFontStatistics: ResourceService['getFontStatistics'];
  getFontAnalytics: ResourceService['getFontAnalytics'];
  cleanupOldFonts: ResourceService['cleanupOldFonts'];
  verifyAndRepairFonts: ResourceService['verifyAndRepairFonts'];
  downloadSpritesWithOptions: ResourceService['downloadSpritesWithOptions'];
  getSpriteStatistics: ResourceService['getSpriteStatistics'];
  cleanupOldSprites: ResourceService['cleanupOldSprites'];
  verifyAndRepairSprites: ResourceService['verifyAndRepairSprites'];
  getSpriteAnalytics: ResourceService['getSpriteAnalytics'];
  downloadGlyphsWithOptions: ResourceService['downloadGlyphsWithOptions'];
  getGlyphStatistics: ResourceService['getGlyphStatistics'];
  getGlyphAnalytics: ResourceService['getGlyphAnalytics'];
  loadGlyphsForStyle: ResourceService['loadGlyphsForStyle'];
  cleanupOldGlyphs: ResourceService['cleanupOldGlyphs'];
  verifyAndRepairGlyphs: ResourceService['verifyAndRepairGlyphs'];
}

export const createResourceManagement = (services: OfflineManagerServices): ResourceManagement => ({
  downloadTilesWithOptions: (...args) => services.resourceService.downloadTilesWithOptions(...args),
  getTileStatistics: (...args) => services.resourceService.getTileStatistics(...args),
  downloadFontsWithOptions: (...args) => services.resourceService.downloadFontsWithOptions(...args),
  getFontStatistics: (...args) => services.resourceService.getFontStatistics(...args),
  getFontAnalytics: (...args) => services.resourceService.getFontAnalytics(...args),
  cleanupOldFonts: (...args) => services.resourceService.cleanupOldFonts(...args),
  verifyAndRepairFonts: (...args) => services.resourceService.verifyAndRepairFonts(...args),
  downloadSpritesWithOptions: (...args) =>
    services.resourceService.downloadSpritesWithOptions(...args),
  getSpriteStatistics: (...args) => services.resourceService.getSpriteStatistics(...args),
  cleanupOldSprites: (...args) => services.resourceService.cleanupOldSprites(...args),
  verifyAndRepairSprites: (...args) => services.resourceService.verifyAndRepairSprites(...args),
  getSpriteAnalytics: (...args) => services.resourceService.getSpriteAnalytics(...args),
  downloadGlyphsWithOptions: (...args) =>
    services.resourceService.downloadGlyphsWithOptions(...args),
  getGlyphStatistics: (...args) => services.resourceService.getGlyphStatistics(...args),
  getGlyphAnalytics: (...args) => services.resourceService.getGlyphAnalytics(...args),
  loadGlyphsForStyle: (...args) => services.resourceService.loadGlyphsForStyle(...args),
  cleanupOldGlyphs: (...args) => services.resourceService.cleanupOldGlyphs(...args),
  verifyAndRepairGlyphs: (...args) => services.resourceService.verifyAndRepairGlyphs(...args),
});
