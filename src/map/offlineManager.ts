import { dbPromise } from '../storage/indexedDbManager';
import { downloadTiles, loadTiles, deleteTiles } from './tileDownloader';
import { downloadSprites, loadSprites, deleteSprites } from './spriteManager';
import { downloadStyles, loadStyles } from './styleManager';
import { deleteStyleById } from './styleManager';
import { downloadFonts, loadFonts, deleteFonts, deleteFontsByStyleId } from './fontManager';
import { generateGlyphUrlsFromStyle } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import type { OfflineRegionOptions } from '../types';

export class OfflineMapManager {
  // private map: mapboxgl.Map | maplibregl.Map;

  // constructor(map: mapboxgl.Map | maplibregl.Map) {
  //   this.map = map;
  // }
  constructor() {}
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    console.log('Adding region:', region);
    // Generate a unique downloadId for this region (styleId + timestamp)
    const style = await downloadStyles(region.styleUrl!);
    const styleObj = style as any;
    const styleId = styleObj.id || region.id;
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const downloadId = `${styleId}-${timestamp}`;
    // Save region metadata with bbox, zoom, styleId, downloadId
    await db.put('regions', {
      ...region,
      styleId,
      downloadId,
      created: Date.now(),
    });
    // Download and store tiles
    await downloadTiles(region, style, downloadId);
    // Download fonts (glyphs)
    if (styleObj && styleObj.glyphs) {
      const fontUrls = generateGlyphUrlsFromStyle(styleObj, styleObj.glyphs);
      await downloadFonts(fontUrls, downloadId); // Store with downloadId prefix for offline lookup
    }
    // Download sprites
    if (styleObj && styleObj.sprite) {
      const spriteBase = styleObj.sprite;
      const spriteVariants = [
        `${spriteBase}.json`,
        `${spriteBase}.png`,
        `${spriteBase}@2x.json`,
        `${spriteBase}@2x.png`,
      ];
      await downloadSprites(spriteVariants); // Only store with downloadId prefix inside downloadSprites
    }
    // Save the patched style JSON for offline use
    const patchedStyle = { ...patchStyleForOffline(styleObj, downloadId), key: downloadId };
    await db.put('styles', patchedStyle); // In-line key for compatibility
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    const currentRegion = await db.get('regions', region.id);
    if (currentRegion) {
      const downloadId = currentRegion.downloadId;
      if (!downloadId) throw new Error('No downloadId found for region');
      await loadTiles(currentRegion, downloadId);
      await loadSprites(downloadId);
      // Optionally load fonts by downloadId
      // await loadFontsByStyleId(downloadId);
      // Load and set the patched style for offline mode
      const style = await db.get('styles', downloadId);
      if (style) {
        // Set the style on the map instance here if needed
        // map.current.setStyle(style);
        console.log('Loaded offline style for region:', region.id);
      }
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    return await db.getAll('regions');
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);
    if (!region) return;
    const downloadId = region.downloadId;
    await db.delete('regions', regionId);
    if (!downloadId) return;
    // Delete all resources for this region using downloadId
    await Promise.all([
      deleteTiles(downloadId),
      deleteSprites(downloadId),
      deleteFontsByStyleId(downloadId),
      deleteStyleById(downloadId),
      db.delete('styles', downloadId), // Redundant but safe
    ]);
  }

  async updateRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    // Fetch the existing region by id
    const existing = await db.get('regions', region.id);
    if (existing && existing.downloadId) {
      const downloadId = existing.downloadId;
      await Promise.all([
        deleteTiles(downloadId),
        deleteSprites(downloadId),
        deleteFontsByStyleId(downloadId),
        deleteStyleById(downloadId),
        db.delete('styles', downloadId),
      ]);
    }
    // Add the region again (new downloadId, new resources)
    await this.addRegion({ ...region, updated: Date.now() });
  }
}

// ---
// Patch style for offline use
function patchStyleForOffline(style: any, downloadId: string) {
  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey];
    if (source.tiles) {
      source.tiles = source.tiles.map((url: string) => `idb://${downloadId}/tile/${encodeURIComponent(url)}`);
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
