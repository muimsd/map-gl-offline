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
import { generateFontUrls } from './fontUtils';
import { OfflineRegionOptions } from '@/types';
import { downloadFonts, loadFonts, deleteFonts } from './fontManager';

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
      await db.put('regions', region);
      // console.log(`regions`, await db.getAll('regions'));
      await downloadTiles(region, style);
      // await downloadSprites();
      // const fontUrls = generateFontUrls(region.styleUrl!); // Pass style URL to generate font URLs
      // await downloadFonts(fontUrls);
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
      await loadTiles(currentRegion);
      await loadSprites();
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
    // Add logic to delete tiles, sprites, styles, and fonts if necessary
  }
}
