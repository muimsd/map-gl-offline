import { dbPromise } from '../storage/indexedDbManager';
import { downloadTiles, loadTiles, deleteTiles } from './tileDownloader';
import { downloadSprites, deleteSprites } from './spriteManager';
import { downloadStyles, deleteStyleById } from './styleManager';
import { deleteFontsByStyleId, loadFontsByDownloadId } from './fontManager';
import type { OfflineRegionOptions, StyleEntry, StoredRegion } from '../types';
export class OfflineMapManager {

  private regionExpiryMs: number;

  constructor(regionExpiryMs: number = 1000 * 60 * 60 * 24 * 30) { // default 30 days
    this.regionExpiryMs = regionExpiryMs;
  }

  /**
   * Clean up expired regions automatically
   * Only deletes regions that have deleteOnExpiry set to true
   * Should be called periodically by the application
   */
  async cleanupExpiredRegions(): Promise<number> {
    const db = await dbPromise;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Get all regions from the regions table
      const allRegions = await db.getAll('regions');
      
      for (const region of allRegions) {
        // Only delete if the region is expired AND deleteOnExpiry is true
        if (region.expiry && region.expiry < now && region.deleteOnExpiry === true) {
          console.log(`Auto-cleaning expired region: ${region.key} (deleteOnExpiry: true)`);
          
          // Delete the region and its associated resources
          await this.deleteRegion(region.key, region.styleId);
          await db.delete('regions', region.key);
          cleanedCount++;
        } else if (region.expiry && region.expiry < now) {
          console.log(`Expired region ${region.key} found but deleteOnExpiry is false - skipping auto-deletion`);
        }
      }

      console.log(`Auto-cleanup: Removed ${cleanedCount} expired regions`);
      return cleanedCount;
    } catch (error) {
      console.error('Error during cleanup of expired regions:', error);
      return 0;
    }
  }

  /**
   * Manually clean up expired regions regardless of deleteOnExpiry setting
   * Useful for manual cleanup operations
   */
  async forceCleanupExpiredRegions(): Promise<number> {
    const db = await dbPromise;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Get all regions from the regions table
      const allRegions = await db.getAll('regions');
      
      for (const region of allRegions) {
        if (region.expiry && region.expiry < now) {
          console.log(`Force-cleaning expired region: ${region.key}`);
          
          // Delete the region and its associated resources
          await this.deleteRegion(region.key, region.styleId);
          await db.delete('regions', region.key);
          cleanedCount++;
        }
      }

      console.log(`Force cleanup: Removed ${cleanedCount} expired regions`);
      return cleanedCount;
    } catch (error) {
      console.error('Error during force cleanup of expired regions:', error);
      return 0;
    }
  }

  /**
   * Get all expired regions (both auto-deletable and manual-only)
   */
  async getExpiredRegions(): Promise<{ autoDelete: StoredRegion[]; manualOnly: StoredRegion[] }> {
    const db = await dbPromise;
    const now = Date.now();
    const allRegions = await db.getAll('regions');
    
    const autoDelete: StoredRegion[] = [];
    const manualOnly: StoredRegion[] = [];
    
    for (const region of allRegions) {
      if (region.expiry && region.expiry < now) {
        if (region.deleteOnExpiry === true) {
          autoDelete.push(region);
        } else {
          manualOnly.push(region);
        }
      }
    }
    
    return { autoDelete, manualOnly };
  }

  /**
   * Get region expiry information
   */
  async getRegionExpiry(regionId: string): Promise<{ expiry: number; expired: boolean } | null> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);
    
    if (!region || !region.expiry) {
      return null;
    }

    return {
      expiry: region.expiry,
      expired: region.expiry < Date.now()
    };
  }

  /**
   * Extend region expiry by the default expiry time
   */
  async extendRegionExpiry(regionId: string): Promise<void> {
    const db = await dbPromise;
    const region = await db.get('regions', regionId);
    
    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    const newExpiry = Date.now() + this.regionExpiryMs;
    
    // Update the region in the regions table
    await db.put('regions', { ...region, expiry: newExpiry });
    
    // Also update the region in the style's regions array
    if (region.styleId) {
      const styleEntry = await db.get('styles', region.styleId);
      if (styleEntry && typeof styleEntry === 'object' && 'regions' in styleEntry) {
        const regions = styleEntry.regions || [];
        const regionIndex = regions.findIndex((r: any) => r.regionId === regionId);
        if (regionIndex !== -1) {
          regions[regionIndex].expiry = newExpiry;
          await db.put('styles', { ...styleEntry, regions });
        }
      }
    }
    
    console.log(`Extended expiry for region ${regionId} to ${new Date(newExpiry).toISOString()}`);
  }

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

    // Get or create the style entry
    let styleEntry = (await db.get('styles', styleId)) as StyleEntry | undefined;
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
    // Ensure regions is always an array
    if (!Array.isArray(styleEntry.regions)) {
      styleEntry.regions = [];
    }
    // Create a unique regionId for this region
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const regionId = `${region.id}-${timestamp}`;
    // Add region metadata to the style entry
    const bboxExists = styleEntry.regions.some(
      (r: any) => JSON.stringify(r.bounds) === JSON.stringify(region.bounds),
    );
    if (!bboxExists) {
      const expiry = Date.now() + this.regionExpiryMs;
      const regionWithMeta = {
        ...region,
        regionId,
        created: Date.now(),
        expiry,
      };
      styleEntry.regions.push(regionWithMeta);
      // Also add to the regions table for fast lookup
      const storedRegion: StoredRegion = { 
        ...region, 
        key: regionId, 
        styleId, 
        created: Date.now(), 
        expiry 
      };
      await db.put('regions', storedRegion);
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
      if (styleId && entry.style && entry.style.sprite) {
        const spriteBase = entry.style.sprite;
        const spriteVariants = [
          `${spriteBase}.json`,
          `${spriteBase}.png`,
          `${spriteBase}@2x.json`,
          `${spriteBase}@2x.png`,
        ];
        await downloadSprites(styleId, spriteVariants);
        entry.sprites = spriteVariants.map(url => `${styleId}::${url.split('/').pop()}`);
      }
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

  /**
   * Start automatic cleanup of expired regions
   * @param intervalMs How often to run cleanup (default: 1 hour)
   * @returns Cleanup interval ID that can be used with clearInterval()
   */
  startAutoCleanup(intervalMs: number = 1000 * 60 * 60): ReturnType<typeof setInterval> {
    const intervalId = setInterval(async () => {
      try {
        const cleanedCount = await this.cleanupExpiredRegions();
        if (cleanedCount > 0) {
          console.log(`Auto-cleanup: Removed ${cleanedCount} expired regions`);
        }
      } catch (error) {
        console.error('Auto-cleanup failed:', error);
      }
    }, intervalMs);

    console.log(`Started auto-cleanup with interval: ${intervalMs}ms`);
    return intervalId;
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(intervalId: ReturnType<typeof setInterval>): void {
    clearInterval(intervalId);
    console.log('Stopped auto-cleanup');
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
