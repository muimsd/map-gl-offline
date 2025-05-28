import { dbPromise } from '@/storage/indexedDbManager';
import { downloadTiles, loadTiles, deleteTiles } from '@/map/tileDownloader';
import {
  downloadSprites,
  loadSprites,
  deleteSprites,
} from '@/map/spriteManager';
import { downloadStyles, loadStyles, deleteStyles } from '@/map/styleManager';
import * as mapboxgl from 'mapbox-gl';
import * as maplibregl from 'maplibre-gl';
import { OfflineRegionOptions } from '@/types';
import { downloadFonts, loadFonts, deleteFonts } from './fontManager';
import { generateGlyphUrlsFromStyle } from '@/utils';

export class OfflineMapManager {
  // private map: mapboxgl.Map | maplibregl.Map;

  // constructor(map: mapboxgl.Map | maplibregl.Map) {
  //   this.map = map;
  // }
  constructor() {}
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    console.log('Adding region:', region);
    if (region.multipleRegions) {
      // Option 1: Save region by style URL
      console.log(`Saving region by style URL: ${region.styleUrl}`);
      const style = await downloadStyles(region.styleUrl!);
      console.log('Downloaded style:', style);
      // Use style id for saving items
      const styleId = style!.id || region.id;
      await db.put('regions', { ...region }); // Do not add styleId to region object
      await downloadTiles(region, style, styleId); // Pass styleId to downloadTiles
      // Download fonts (glyphs) referenced in the style
      const styleObj = style as any;
      if (styleObj && styleObj.glyphs) {
        const fontUrls = generateGlyphUrlsFromStyle(styleObj, styleObj.glyphs).map(url => `${styleId}::${url}`);
        await downloadFonts(fontUrls); // downloadFonts expects 1 argument
      }
      // Download sprites referenced in the style
      if (styleObj && styleObj.sprite) {
        const spriteBase = styleObj.sprite;
        const spriteVariants = [
          `${spriteBase}.json`,
          `${spriteBase}.png`,
          `${spriteBase}@2x.json`,
          `${spriteBase}@2x.png`,
        ].map(url => `${styleId}::${url}`);
        await downloadSprites(spriteVariants); // downloadSprites expects 1 argument
      }
      // TODO: Download other resources if needed
      // await downloadStyles(region.styleUrl!); // Download styles if needed
      // const fontUrls = generateFontUrls(region.styleUrl!); // Generate font URLs from style URL
      // await downloadFonts(fontUrls); // downloadFonts expects 1 argument
    } else {
      // Option 2: Save region differently (e.g., by custom identifier)
      console.log(`Saving region by custom identifier: ${region.id}`);
      // await db.put('regions', region);
      // await downloadTiles(region);
      // await downloadSprites();
      // await downloadStyles(region.styleUrl!);
      // const fontUrls = generateFontUrls(region.styleUrl!); // Generate font URLs without style URL
      // await downloadFonts(fontUrls);
    }
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    const currentRegion = await db.get('regions', region.id);
    if (currentRegion) {
      // Derive styleId the same way as in addRegion
      let styleId = currentRegion.id;
      if (currentRegion.styleUrl) {
        // Try to extract style id from URL if possible
        const urlParts = currentRegion.styleUrl.split('/');
        const last = urlParts[urlParts.length - 1];
        styleId = last.endsWith('.json') ? last.replace('.json', '') : last;
      }
      await loadTiles(currentRegion, styleId); // Pass styleId to loadTiles
      await loadSprites(styleId); // loadSprites expects 1 argument
      // if (region.styleUrl) {
      //   await loadStyles(region.styleUrl!);
      //   const fontUrls = generateFontUrls(region.styleUrl);
      //   await loadFonts(fontUrls);
      // } else {
      //   await loadStyles();
      //   const fontUrls = generateFontUrls();
      //   await loadFonts(fontUrls);
      // }
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    return await db.getAll('regions');
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    await db.delete('regions', regionId);
    // Also delete tiles, sprites, styles, and fonts for this region
    // (Assumes keys are prefixed or associated with regionId, or you have a mapping)
    // Example cleanup logic (pseudo, adapt to your keying strategy):
    // await deleteTiles(regionId);
    // await deleteSprites(regionId);
    // await deleteFonts(regionId);
    // await deleteStyles(regionId);
  }
}
