import { dbPromise } from '../storage/indexedDbManager';
import { downloadStyles, loadStyleById } from '../map/styleManager';
import { downloadTiles } from './tileService';
// import { deleteTiles } from './tileService'; // Will need to be implemented in tileService
// import { deleteFontsByStyleId } from './fontService'; // Will need to be implemented in fontService
// import { deleteSprites } from './spriteService'; // Will need to be implemented in spriteService
import { patchStyleForOffline, validateRegion } from '../utils/styleUtils';
import type { OfflineRegionOptions, StoredRegion } from '../types/region';
import type { StyleEntry, MapboxStyle } from '../types/style';

// Helper function to get style data from StyleEntry
function getStyleData(entry: StyleEntry): MapboxStyle & { id?: string } {
  return {
    ...entry.style,
    id: entry.key
  };
}

export class RegionService {
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    console.warn('Adding region:', region);
    
    if (!region.styleUrl) {
      throw new Error('Region must have a styleUrl');
    }

    const styleResult = await downloadStyles(region.styleUrl, {});
    if (!styleResult.success) {
      throw new Error(`Failed to download style from ${region.styleUrl}`);
    }

    // --- DEBUG LOGGING FOR STYLE DOWNLOAD/LOAD ---
    console.warn('Downloaded style result:', styleResult);
    let styleData = await loadStyleById(styleResult.styleId);
    console.warn('Loaded style from DB:', styleData);

    // Patch style for offline use
    const patchedStyle = patchStyleForOffline(styleData as unknown as MapboxStyle, styleResult.styleId);

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleResult.styleId)) as StyleEntry | undefined;
    if (!styleEntry || typeof styleEntry === 'string') {
      styleEntry = {
        key: styleResult.styleId,
        style: patchedStyle,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      };
    }

    // Ensure regions is always an array
    if (!Array.isArray(styleEntry.regions)) {
      styleEntry.regions = [];
    }

    // Add region metadata to the style entry
    const bboxExists = styleEntry.regions.some(
      (r: OfflineRegionOptions) => JSON.stringify(r.bounds) === JSON.stringify(region.bounds)
    );

    if (!bboxExists) {
      const expiryTime = region.expiry || 7 * 24 * 60 * 60 * 1000; // Default to 7 days if not specified
      const expiry = Date.now() + expiryTime;
      const regionWithMeta = {
        ...region,
        regionId: region.id,
        created: Date.now(),
        expiry,
      };
      styleEntry.regions.push(regionWithMeta);

      // Also add to the regions table for fast lookup
      const storedRegion: StoredRegion = {
        ...region,
        key: region.id,
        styleId: styleEntry.key,
        created: Date.now(),
        lastModified: Date.now(),
        expiry,
      };
      await db.put('regions', storedRegion);
    } else {
      console.warn('Region with the same bbox already exists for this style.');
      return;
    }

    // Get the style data for tile downloading
    const style = getStyleData(styleEntry);

    // Download and store tiles for this region
    await downloadTiles(region, patchedStyle, styleEntry.key);

    // Save the updated style entry
    await db.put('styles', styleEntry);
  }

  async loadRegion(region: OfflineRegionOptions): Promise<void> {
    const styleId = region.styleId || region.id;
    const db = await dbPromise;
    const storedStyle = await db.get('styles', styleId!);
    
    if (!storedStyle || !('style' in storedStyle)) {
      throw new Error(`Style not found for region: ${region.id}`);
    }
    
    // TODO: Implement loadTiles function in tileService
    // await loadTiles(region, styleId);
    console.warn('loadTiles function not yet implemented');
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);

    if (!region) {
      console.warn(`Region ${regionId} not found`);
      return;
    }

    const styleId = (region as StoredRegion).styleId;

    // TODO: Implement delete functions in respective services
    // await Promise.all([
    //   deleteTiles(styleId),
    //   deleteFontsByStyleId(styleId),
    //   deleteSprites(styleId),
    // ]);
    console.warn('Delete functions not yet implemented:', styleId);

    // Remove from regions table
    await db.delete('regions', regionId);
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    const regions = await db.getAll('regions');
    return regions as OfflineRegionOptions[];
  }

}
