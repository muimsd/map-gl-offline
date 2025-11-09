import { dbPromise } from '../storage/indexedDbManager';
import { patchStyleForOffline } from '../utils/styleUtils';
import { logger } from '../utils/logger';
import type { OfflineRegionOptions, StoredRegion } from '../types/region';
import type { StyleEntry } from '../types/style';
import type { TileEntry } from '../types';
import * as tilebelt from '@mapbox/tilebelt';

const regionLogger = logger.scope('RegionService');

export class RegionService {
  /**
   * Check if a tile overlaps with any region bounds
   */
  private tileOverlapsWithRegion(
    tileX: number,
    tileY: number,
    tileZ: number,
    region: OfflineRegionOptions
  ): boolean {
    // Get tile bounds using tilebelt
    const tileBounds = tilebelt.tileToBBOX([tileX, tileY, tileZ]);
    const [tileWest, tileSouth, tileEast, tileNorth] = tileBounds;

    // Region bounds format: [[west, south], [east, north]]
    const regionWest = region.bounds[0][0];
    const regionSouth = region.bounds[0][1];
    const regionEast = region.bounds[1][0];
    const regionNorth = region.bounds[1][1];

    // Check if bounding boxes overlap
    return !(
      tileEast < regionWest ||
      tileWest > regionEast ||
      tileNorth < regionSouth ||
      tileSouth > regionNorth
    );
  }

  /**
   * Check if a tile overlaps with any of the given regions
   */
  private tileOverlapsWithAnyRegion(
    tileX: number,
    tileY: number,
    tileZ: number,
    regions: OfflineRegionOptions[]
  ): boolean {
    return regions.some(region => this.tileOverlapsWithRegion(tileX, tileY, tileZ, region));
  }

  /**
   * Delete tiles that don't overlap with any remaining regions
   */
  private async deleteNonOverlappingTiles(
    styleId: string,
    remainingRegions: OfflineRegionOptions[]
  ): Promise<number> {
    const db = await dbPromise;
    let deletedCount = 0;

    regionLogger.debug(
      `Checking tiles for style ${styleId} against ${remainingRegions.length} remaining regions`
    );

    const tx = db.transaction('tiles', 'readwrite');
    for await (const cursor of tx.store) {
      const tileEntry: TileEntry = cursor.value;

      // Only check tiles for this style
      if (tileEntry.styleId !== styleId) {
        continue;
      }

      // Parse tile coordinates from key: styleId:sourceId:z:x:y.ext
      const keyParts = tileEntry.key.split(':');
      if (keyParts.length < 5) {
        regionLogger.warn(`Invalid tile key format: ${tileEntry.key}`);
        continue;
      }

      const z = parseInt(keyParts[2]);
      const x = parseInt(keyParts[3]);
      const yWithExt = keyParts[4];
      const y = parseInt(yWithExt.split('.')[0]);

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        regionLogger.warn(`Invalid tile coordinates in key: ${tileEntry.key}`);
        continue;
      }

      // Check if this tile overlaps with any remaining region
      if (!this.tileOverlapsWithAnyRegion(x, y, z, remainingRegions)) {
        regionLogger.debug(`Deleting non-overlapping tile: ${tileEntry.key}`);
        await cursor.delete();
        deletedCount++;
      }
    }

    regionLogger.info(`Deleted ${deletedCount} non-overlapping tiles for style ${styleId}`);
    return deletedCount;
  }

  /**
   * Delete all resources for a style (fonts, glyphs, sprites)
   */
  private async deleteStyleResources(styleId: string): Promise<void> {
    const db = await dbPromise;

    regionLogger.debug(`Deleting all resources for style: ${styleId}`);

    // Delete fonts - fonts have keys like "styleId:fontname"
    let deletedFonts = 0;
    const fontTx = db.transaction('fonts', 'readwrite');
    for await (const cursor of fontTx.store) {
      const fontEntry = cursor.value;
      // Check if font key starts with "styleId:"
      if (fontEntry.key.startsWith(`${styleId}:`)) {
        await cursor.delete();
        deletedFonts++;
      }
    }

    // Delete glyphs - glyphs have keys that may include style info in various formats
    let deletedGlyphs = 0;
    const glyphTx = db.transaction('glyphs', 'readwrite');
    for await (const cursor of glyphTx.store) {
      const glyphEntry = cursor.value;
      // Check if glyph key contains style ID (may be in different formats)
      if (glyphEntry.key.includes(styleId)) {
        await cursor.delete();
        deletedGlyphs++;
      }
    }

    // Delete sprites - sprites may have keys that include style info
    let deletedSprites = 0;
    const spriteTx = db.transaction('sprites', 'readwrite');
    for await (const cursor of spriteTx.store) {
      const spriteEntry = cursor.value;
      // Check if sprite key contains style ID
      if (spriteEntry.key.includes(styleId)) {
        await cursor.delete();
        deletedSprites++;
      }
    }

    regionLogger.info(
      `Deleted style resources: ${deletedFonts} fonts, ${deletedGlyphs} glyphs, ${deletedSprites} sprites`
    );
  }

  /**
   * Delete all tiles for a style
   */
  private async deleteAllStyleTiles(styleId: string): Promise<number> {
    const db = await dbPromise;
    let deletedCount = 0;

    regionLogger.debug(`Deleting all tiles for style: ${styleId}`);

    const tx = db.transaction('tiles', 'readwrite');
    for await (const cursor of tx.store) {
      const tileEntry: TileEntry = cursor.value;
      if (tileEntry.styleId === styleId) {
        await cursor.delete();
        deletedCount++;
      }
    }

    regionLogger.info(`Deleted ${deletedCount} tiles for style ${styleId}`);
    return deletedCount;
  }
  async addRegion(region: OfflineRegionOptions): Promise<void> {
    const db = await dbPromise;
    regionLogger.debug('Adding region:', region);

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
      styleData = allStyles.find(
        (s: { style?: { sprite?: string }; originalUrl?: string }) =>
          (region.styleUrl && s?.style?.sprite?.includes(region.styleUrl)) ||
          s?.originalUrl === region.styleUrl
      );
      styleId = styleData?.key;
    }
    if (!styleData || !styleId) {
      throw new Error('Style must be downloaded before adding a region.');
    }

    // We'll patch the style after we get the styleEntry

    // Get or create the style entry
    let styleEntry: StyleEntry = (await db.get('styles', styleId)) as StyleEntry;
    if (!styleEntry || typeof styleEntry === 'string') {
      styleEntry = {
        key: styleId,
        style: styleData.style,
        provider: 'auto',
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

    // Patch style for offline use with the region's maxZoom and tileExtension
    patchStyleForOffline(styleEntry.style, region.id, region.maxZoom, region.tileExtension);

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
    if (!styleId) {
      throw new Error(`No style ID found for region: ${region.id}`);
    }
    const db = await dbPromise;
    const storedStyle = await db.get('styles', styleId);

    if (!storedStyle || !('style' in storedStyle)) {
      throw new Error(`Style not found for region: ${region.id}`);
    }

    // TODO: Implement loadTiles function in tileService
    // await loadTiles(region, styleId);
    console.warn('loadTiles function not yet implemented');
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    console.warn(`🗑️  Deleting region: ${regionId}`);

    try {
      // Find which style contains this region
      const allStyles = await db.getAll('styles');
      console.warn(`🔍 Found ${allStyles.length} styles to search through`);

      let foundStyle: unknown = null;
      let foundRegion: unknown = null;

      for (const style of allStyles) {
        console.warn(
          `🔍 Checking style: ${style?.key}, regions count: ${style?.regions?.length || 0}`
        );
        if (style && Array.isArray(style.regions)) {
          const region = style.regions.find((r: { id?: string; regionId?: string }) => {
            const match = r.id === regionId || r.regionId === regionId;
            console.warn(`  📍 Region ${r.id || r.regionId}: match = ${match}`);
            return match;
          });
          if (region) {
            foundStyle = style;
            foundRegion = region;
            console.warn(`✅ Found region in style: ${style.key}`);
            break;
          }
        }
      }

      if (!foundStyle || !foundRegion) {
        console.warn(`❌ Region ${regionId} not found in any style`);
        console.warn('Available regions:');
        allStyles.forEach(style => {
          if (style && Array.isArray(style.regions)) {
            style.regions.forEach((r: { id?: string; regionId?: string; name?: string }) => {
              console.warn(
                `  - Style ${style.key}: Region ${r.id || r.regionId} (${r.name || 'unnamed'})`
              );
            });
          }
        });
        return;
      }

      const styleObj = foundStyle as StyleEntry;
      console.warn(`🎯 Found region in style: ${styleObj.key}`, foundRegion);

      // Remove the region from the style's regions array
      const remainingRegions = styleObj.regions.filter(
        (r: OfflineRegionOptions) => r.id !== regionId
      );

      styleObj.regions = remainingRegions;
      console.warn(`📊 Remaining regions count: ${remainingRegions.length}`);

      // If this was the last region for the style, delete the entire style and all its resources
      if (remainingRegions.length === 0) {
        console.warn(
          `🗑️  Style ${styleObj.key} has no remaining regions, deleting entire style and all resources`
        );

        // Delete all tiles for this style
        const deletedTileCount = await this.deleteAllStyleTiles(styleObj.key);
        console.warn(`🗑️  Deleted ${deletedTileCount} tiles`);

        // Delete all style resources (fonts, glyphs, sprites)
        await this.deleteStyleResources(styleObj.key);

        // Delete the style entry itself
        await db.delete('styles', styleObj.key);

        console.warn(`✅ Completely deleted style ${styleObj.key} and all associated resources`);
      } else {
        console.warn(
          `🔍 Style ${styleObj.key} has ${remainingRegions.length} remaining regions, cleaning up non-overlapping tiles`
        );

        // Delete tiles that don't overlap with any remaining regions
        const deletedTileCount = await this.deleteNonOverlappingTiles(
          styleObj.key,
          remainingRegions
        );

        // Update the style entry with the remaining regions
        await db.put('styles', styleObj);

        console.warn(
          `✅ Region ${regionId} deleted successfully from style ${styleObj.key}, cleaned up ${deletedTileCount} non-overlapping tiles`
        );
      }

      console.warn(`🎉 Region deletion completed successfully for: ${regionId}`);
    } catch (error) {
      console.error(`❌ Error during region deletion for ${regionId}:`, error);
      throw error; // Re-throw to let UI handle the error
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    const db = await dbPromise;
    const regions = await db.getAll('regions');
    return regions as OfflineRegionOptions[];
  }

  /**
   * List all stored regions from styles (used for UI and fitBounds)
   */
  async listStoredRegions(): Promise<StoredRegion[]> {
    try {
      const { loadStyles } = await import('./styleService');
      const styles = await loadStyles();
      const allRegions: StoredRegion[] = [];
      for (const style of styles) {
        if (style.regions && Array.isArray(style.regions)) {
          const regionsWithStyle = style.regions.map(
            region =>
              ({
                ...region,
                key: region.id,
                styleId: style.key,
                created: region.created || Date.now(),
                lastModified: region.updated || region.created || Date.now(),
                expiry: region.expiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
              }) as StoredRegion
          );
          allRegions.push(...regionsWithStyle);
        }
      }
      console.warn('📋 Extracted regions from styles:', allRegions);
      return allRegions;
    } catch (error) {
      console.error('Error loading regions from styles:', error);
      // Fallback to cleanup service method if available
      // return this.cleanupService.getAllRegions();
      return [];
    }
  }
}
