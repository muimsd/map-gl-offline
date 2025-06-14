import { dbPromise } from '../storage/indexedDbManager';
import { downloadStyles, loadStyleById } from './styleService';
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

    // Ensure style is already downloaded
    // Try to find style by ID or URL
    let styleId = region.styleId;
    let styleData: StyleEntry | undefined;
    if (styleId) {
      styleData = await db.get('styles', styleId);
    } else {
      // Try to find by styleUrl (legacy)
      const allStyles = await db.getAll('styles');
      styleData = allStyles.find((s: any) => s?.style?.sprite?.includes(region.styleUrl) || s?.originalUrl === region.styleUrl);
      styleId = styleData?.key;
    }
    if (!styleData || !styleId) {
      throw new Error('Style must be downloaded before adding a region.');
    }

    // Patch style for offline use
    const patchedStyle = patchStyleForOffline(styleData.style, styleId);

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleId)) as StyleEntry | undefined;
    if (!styleEntry || typeof styleEntry === 'string') {
      styleEntry = {
        key: styleId,
        style: styleData.style,
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
      const expiryTime = region.expiry || 30 * 24 * 60 * 60 * 1000; // Default to 30 days if not specified
      const expiry = Date.now() + expiryTime;
      const regionWithMeta = {
        ...region,
        regionId: region.id,
        created: Date.now(),
        expiry,
      };
      styleEntry.regions.push(regionWithMeta);
      await db.put('styles', styleEntry);
    }
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

    // Remove region from regions table
    await db.delete('regions', regionId);

    // Remove from style's regions array
    try {
      const styleEntry = await db.get('styles', styleId);
      if (styleEntry && typeof styleEntry === 'object' && Array.isArray(styleEntry.regions)) {
        styleEntry.regions = styleEntry.regions.filter((r: any) => r.id !== regionId);
        await db.put('styles', styleEntry);
      }
    } catch (error) {
      console.warn('Could not update style entry regions:', error);
    }

    console.warn(`Region ${regionId} deleted successfully`);
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    const regions = await db.getAll('regions');
    return regions as OfflineRegionOptions[];
  }

}
