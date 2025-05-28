import { dbPromise } from '../storage/indexedDbManager';
import { downloadTiles, loadTiles, deleteTiles } from './tileDownloader';
import { downloadSprites, loadSprites, deleteSprites } from './spriteManager';
import { downloadStyles, loadStyles, deleteStyleById } from './styleManager';
import { deleteFontsByStyleId, loadFontsByDownloadId } from './fontManager';
import type { OfflineRegionOptions, StyleEntry } from '../types';
export class OfflineMapManager {
  // private map: mapboxgl.Map | maplibregl.Map;

  // constructor(map: mapboxgl.Map | maplibregl.Map) {
  //   this.map = map;
  // }
  constructor() {}
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    console.log('Adding region:', region);
    const style = await downloadStyles(region.styleUrl!);
    // Ensure styleId is available
    let styleId =
      style && (style as any).id
        ? (style as any).id
        : region.styleId || region.id;
    if (!styleId) throw new Error('Style must have an id');
    console.log('Style ID:', styleId);

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleId)) as
      | StyleEntry
      | undefined;
    if (!styleEntry || typeof styleEntry === 'string') {
      styleEntry = {
        key: styleId,
        style: patchStyleForOffline(style, styleId),
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      };
    }
    // Create a unique regionId for this region
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const regionId = `${region.id}-${timestamp}`;
    // Add region metadata to the style entry
    const bboxExists = styleEntry.regions.some(
      (r: any) => JSON.stringify(r.bounds) === JSON.stringify(region.bounds),
    );
    if (!bboxExists) {
      styleEntry.regions.push({
        ...region,
        regionId,
        created: Date.now(),
      });
    } else {
      console.log('Region with the same bbox already exists for this style.');
      return;
    }
    // Download and store tiles for this region
    await downloadTiles(region, style, styleId);
    // Fonts and sprites are handled by style download logic, not here
    // Save the updated style entry
    // Always ensure the key is set and value is an object
    await db.put('styles', { ...styleEntry, key: styleId });
    // Optionally, also update a separate regions store for fast lookup (future-proofing)
    // await db.put('regions', { ...region, styleId, regionId });
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    // Find the style entry for this region
    const styleId = region.styleId || region.id;
    const styleEntry = await db.get('styles', styleId);
    if (
      styleEntry &&
      typeof styleEntry === 'object' &&
      'regions' in styleEntry
    ) {
      const entry: any = styleEntry;
      // Find the region in the style's regions array
      // Try to match by id, or fallback to first region if only one exists
      let regionMeta = entry.regions.find((r: any) => r.id === region.id);
      if (!regionMeta && entry.regions.length === 1) {
        regionMeta = entry.regions[0];
      }
      if (!regionMeta) throw new Error('Region not found in style');
      // Load tiles for this region
      await loadTiles(regionMeta, styleId);
      // Load sprites for the style
      await loadSprites(styleId);
      // Load fonts for the style
      await loadFontsByDownloadId(styleId);
      // Load and set the patched style for offline mode
      if (entry.style) {
        // Set the style on the map instance here if needed
        // map.current.setStyle(entry.style);
        console.log('Loaded offline style for region:', region.id);
      }
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    // Gather all regions from all styles
    const allStyles = await db.getAll('styles');
    return allStyles
      .filter(
        (styleEntry: any) =>
          typeof styleEntry === 'object' && 'regions' in styleEntry,
      )
      .flatMap((styleEntry: any) => styleEntry.regions || []);
  }

  async deleteRegion(regionId: string, styleId?: string): Promise<void> {
    const db = await dbPromise;
    // Find the style entry containing this region
    let styleEntry: any;
    if (styleId) {
      styleEntry = await db.get('styles', styleId);
    } else {
      // Search all styles for the region
      const allStyles = await db.getAll('styles');
      styleEntry = allStyles.find(
        (entry: any) =>
          typeof entry === 'object' &&
          'regions' in entry &&
          (entry.regions || []).some((r: any) => r.regionId === regionId),
      );
    }
    if (
      !styleEntry ||
      typeof styleEntry !== 'object' ||
      !('regions' in styleEntry)
    )
      return;
    // Find the region
    const regionIdx = styleEntry.regions.findIndex(
      (r: any) => r.regionId === regionId,
    );
    if (regionIdx === -1) return;
    const region = styleEntry.regions[regionIdx];
    // Delete region's tiles
    await deleteTiles(styleEntry.key);
    // Delete region from style's regions array
    styleEntry.regions.splice(regionIdx, 1);
    // If no regions remain, delete all resources for the style
    if (styleEntry.regions.length === 0) {
      await Promise.all([
        deleteSprites(styleEntry.key),
        deleteFontsByStyleId(styleEntry.key),
        deleteStyleById(styleEntry.key),
        db.delete('styles', styleEntry.key),
      ]);
    } else {
      // Otherwise, just update the style entry
      await db.put('styles', styleEntry);
    }
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
      source.tiles = source.tiles.map(
        (url: string) => `idb://${downloadId}/tile/${encodeURIComponent(url)}`,
      );
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
