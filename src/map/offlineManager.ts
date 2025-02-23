import { dbPromise } from '@/src/storage/indexedDbManager';
import {
  downloadTiles,
  loadTiles,
  deleteTiles,
} from '@/src/map/tileDownloader';
import {
  downloadSprites,
  loadSprites,
  deleteSprites,
} from '@/src/map/spriteManager';
import {
  downloadStyles,
  loadStyles,
  deleteStyles,
} from '@/src/map/styleManager';
import * as mapboxgl from 'mapbox-gl';
import * as maplibregl from 'maplibre-gl';
import { generateFontUrls } from './fontUtils';
import { OfflineRegionOptions } from '@/src/types';
import { downloadFonts, loadFonts, deleteFonts } from './fontManager';

export class OfflineMapManager {
  private map: mapboxgl.Map | maplibregl.Map;

  constructor(map: mapboxgl.Map | maplibregl.Map) {
    this.map = map;
  }

  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    await db.put('regions', region);
    await downloadTiles(region);
    await downloadSprites();
    await downloadStyles();
    const fontUrls = generateFontUrls(); // Implement this function to generate font URLs
    await downloadFonts(fontUrls);
  }

  async loadRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);
    if (region) {
      await loadTiles(region);
      await loadSprites();
      await loadStyles();
      const fontUrls = generateFontUrls(); // Implement this function to generate font URLs
      await loadFonts(fontUrls);
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    return await db.getAll('regions');
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    await db.delete('regions', regionId);
    await deleteTiles(regionId);
    await deleteSprites();
    await deleteStyles();
    const fontUrls = generateFontUrls(); // Implement this function to generate font URLs
    await deleteFonts(fontUrls);
  }
}
