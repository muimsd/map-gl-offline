import { dbPromise } from '@/storage/indexedDbManager';
import {
  extractAllFontNames,
  normalizeSpriteProperty,
  patchStyleForOffline,
} from '@/utils/styleUtils';
import { logger } from '@/utils/logger';
import { parseTileKey } from '@/utils/tileKey';
import { GLYPH_CONFIG } from '@/utils/constants';
import { isMapboxProtocol, resolveMapboxUrl } from '@/utils/styleProviderUtils';
import { loadStyles } from '@/services/styleService';
import type {
  DownloadRegionOptions,
  DownloadRegionProgress,
  DownloadRegionResult,
  OfflineRegionOptions,
  StoredRegion,
} from '@/types/region';
import type { BaseStyle, StyleEntry } from '@/types/style';
import type { SpriteDownloadResult, TileEntry } from '@/types';
import * as tilebelt from '@mapbox/tilebelt';

const regionLogger = logger.scope('RegionService');

/**
 * True when `key` belongs to the given styleId.
 *
 * Font/glyph/sprite keys use `:` (or `::`) as the delimiter after styleId
 * (see `glyphService.createGlyphKey` and `spriteService.createSpriteKey`).
 * The prior implementation also accepted `styleId_` as a match, which was
 * the source of the cross-style collision: `"abc_def:..."` starts with
 * `"abc_"`, so deleting style `abc` collaterally wiped `abc_def`'s
 * resources. `_` never legitimately appears as the delimiter, so it's
 * dropped here.
 */
export function resourceKeyBelongsToStyle(key: string, styleId: string): boolean {
  return key === styleId || key.startsWith(`${styleId}:`);
}

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
    // Validate region bounds exist and have correct structure
    if (
      !region.bounds ||
      !Array.isArray(region.bounds) ||
      region.bounds.length !== 2 ||
      !Array.isArray(region.bounds[0]) ||
      !Array.isArray(region.bounds[1]) ||
      region.bounds[0].length !== 2 ||
      region.bounds[1].length !== 2
    ) {
      regionLogger.warn('Invalid region bounds structure:', region.bounds);
      return false;
    }

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

      // Parse tile coordinates using shared utility
      const parsed = parseTileKey(tileEntry.key);
      if (!parsed) {
        regionLogger.warn(`Invalid tile key format: ${tileEntry.key}`);
        continue;
      }

      const { x, y, z } = parsed;

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

    // Use a delimiter-aware prefix match uniformly across fonts/glyphs/sprites
    // so styleIds with shared prefixes (e.g. `abc` vs `abc_def`) don't collide.
    let deletedFonts = 0;
    const fontTx = db.transaction('fonts', 'readwrite');
    for await (const cursor of fontTx.store) {
      if (resourceKeyBelongsToStyle(cursor.value.key, styleId)) {
        await cursor.delete();
        deletedFonts++;
      }
    }

    let deletedGlyphs = 0;
    const glyphTx = db.transaction('glyphs', 'readwrite');
    for await (const cursor of glyphTx.store) {
      if (resourceKeyBelongsToStyle(cursor.value.key, styleId)) {
        await cursor.delete();
        deletedGlyphs++;
      }
    }

    let deletedSprites = 0;
    const spriteTx = db.transaction('sprites', 'readwrite');
    for await (const cursor of spriteTx.store) {
      if (resourceKeyBelongsToStyle(cursor.value.key, styleId)) {
        await cursor.delete();
        deletedSprites++;
      }
    }

    let deletedModels = 0;
    const modelTx = db.transaction('models', 'readwrite');
    for await (const cursor of modelTx.store) {
      if (resourceKeyBelongsToStyle(cursor.value.key, styleId)) {
        await cursor.delete();
        deletedModels++;
      }
    }

    regionLogger.info(
      `Deleted style resources: ${deletedFonts} fonts, ${deletedGlyphs} glyphs, ${deletedSprites} sprites, ${deletedModels} models`
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
    let styleEntry: StyleEntry | undefined;
    if (styleId) {
      styleEntry = await db.get('styles', styleId);
    } else {
      // Try to find by styleUrl (legacy)
      const allStyles = await db.getAll('styles');
      styleEntry = allStyles.find(
        (s: { originalUrl?: string }) => s?.originalUrl === region.styleUrl
      );
      styleId = styleEntry?.key;
    }
    if (!styleEntry || !styleId) {
      throw new Error('Style must be downloaded before adding a region.');
    }

    // Ensure styleEntry has proper structure
    if (typeof styleEntry === 'string') {
      throw new Error('Style entry is corrupted.');
    }

    // Ensure regions is always an array
    if (!Array.isArray(styleEntry.regions)) {
      styleEntry.regions = [];
    }

    // Inject extra sources into the style so they get patched for offline use
    if (region.extraSources && region.extraSources.length > 0) {
      for (const extra of region.extraSources) {
        if (!styleEntry.style.sources[extra.id]) {
          styleEntry.style.sources[extra.id] = {
            type: extra.type || 'vector',
            tiles: extra.tiles,
            ...(extra.minzoom !== undefined ? { minzoom: extra.minzoom } : {}),
            ...(extra.maxzoom !== undefined ? { maxzoom: extra.maxzoom } : {}),
            ...(extra.attribution ? { attribution: extra.attribution } : {}),
          };
          regionLogger.debug(`Injected extra source into style: ${extra.id}`);
        }
      }
    }

    // Patch style for offline use with the region's maxZoom and tileExtension
    // Pass styleId for sprites since they're stored with the style ID, not region ID
    patchStyleForOffline(
      styleEntry.style,
      region.id,
      region.maxZoom,
      region.tileExtension,
      styleId
    );

    // Add or update region metadata on the style entry.
    // `expiry` is stored as an absolute timestamp (per the type doc and all
    // readers in cleanupService/cleanupManagement/RegionList). If the caller
    // didn't pass one, default to now + 30 days.
    const DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
    const expiry = region.expiry ?? Date.now() + DEFAULT_EXPIRY_MS;

    // Dedup by id, not bounds: two regions may legitimately share bounds but
    // have distinct ids. Dropping by bounds silently orphans the new region's
    // tiles (its id never lands in styles.regions[]).
    const existingIndex = styleEntry.regions.findIndex(
      (r: OfflineRegionOptions & { regionId?: string }) =>
        r.id === region.id || r.regionId === region.id
    );

    const regionWithMeta = {
      ...region,
      regionId: region.id,
      // Preserve original `created` on update; set it now on first insert.
      created:
        existingIndex >= 0
          ? ((styleEntry.regions[existingIndex] as { created?: number }).created ?? Date.now())
          : Date.now(),
      updated: Date.now(),
      expiry,
    };

    if (existingIndex >= 0) {
      styleEntry.regions[existingIndex] = regionWithMeta;
    } else {
      styleEntry.regions.push(regionWithMeta);
    }
    await db.put('styles', styleEntry);
  }

  async loadRegion(
    region: OfflineRegionOptions,
    options: DownloadRegionOptions = {}
  ): Promise<DownloadRegionResult> {
    return this.downloadRegion(region, options);
  }

  /**
   * Download everything an offline region needs — style (if missing), sprites, glyphs,
   * tiles — and then persist region metadata. This is the programmatic equivalent of the
   * UI control's "Download region" flow.
   */
  async downloadRegion(
    region: OfflineRegionOptions,
    options: DownloadRegionOptions = {}
  ): Promise<DownloadRegionResult> {
    if (!region.styleUrl) {
      throw new Error('Region must have a styleUrl');
    }

    const {
      onProgress,
      provider = 'auto',
      accessToken,
      skipGlyphs = false,
      skipSprites = false,
      skipModels = false,
      glyphRanges,
      tileOptions,
    } = options;

    const emit = (
      phase: DownloadRegionProgress['phase'],
      completed: number,
      total: number,
      message?: string
    ) => {
      if (!onProgress) return;
      const safeTotal = total > 0 ? total : 1;
      const clamped = Math.min(completed, safeTotal);
      onProgress({
        phase,
        completed: clamped,
        total: safeTotal,
        percentage: (clamped / safeTotal) * 100,
        message,
      });
    };

    // 1. Ensure style is downloaded
    let styleResult: DownloadRegionResult['styleResult'];
    let styleId: string;
    let styleEntry = await this.findStyleEntry(region);

    if (!styleEntry) {
      regionLogger.debug(`Style not found locally, downloading: ${region.styleUrl}`);
      const { downloadStyleWithProvider } = await import('@/services/styleService');
      emit('style', 0, 100, 'Downloading style');
      styleResult = await downloadStyleWithProvider(region.styleUrl, {
        provider,
        accessToken,
        skipExisting: true,
        enableSourceEmbedding: true,
        onProgress: progress => emit('style', progress.percentage ?? 0, 100, 'Downloading style'),
      });
      if (!styleResult.success) {
        throw new Error(`Failed to download style: ${styleResult.errors.join(', ')}`);
      }
      styleId = styleResult.styleId;
      styleEntry = await (await dbPromise).get('styles', styleId);
      if (!styleEntry) {
        throw new Error(`Style entry missing after download: ${styleId}`);
      }
    } else {
      styleId = styleEntry.key;
    }
    emit('style', 100, 100, 'Style ready');

    // Capture original (pre-patch) resource URLs for sprite/glyph downloads
    const storedStyle = styleEntry.style as BaseStyle;
    const storedTokenCandidate = (styleEntry as Record<string, unknown>).accessToken;
    const effectiveAccessToken =
      accessToken ?? (typeof storedTokenCandidate === 'string' ? storedTokenCandidate : undefined);
    const originalSpriteUrl = (styleEntry.originalSpriteUrl ??
      storedStyle.sprite) as BaseStyle['sprite'];
    const originalGlyphsUrl = styleEntry.originalGlyphsUrl ?? storedStyle.glyphs;

    // 2. Sprites
    const spriteResults: SpriteDownloadResult[] = [];
    if (!skipSprites) {
      const spriteSources = normalizeSpriteProperty(originalSpriteUrl);
      if (spriteSources.length > 0) {
        const { downloadSprites } = await import('@/services/spriteService');
        // Standard four sprite variants. For Mapbox Standard, an `iconset.pbf`
        // sibling is also served under the same /styles/v1/.../<hash>/ path
        // — we detect that case per-source below and append it to the list.
        const baseSuffixes = ['.json', '.png', '@2x.json', '@2x.png'];
        // Estimate total files assuming iconset is always included (the actual
        // number may be smaller; the emit helper clamps progress to total).
        const totalFiles = spriteSources.length * (baseSuffixes.length + 1);
        let completed = 0;
        emit('sprites', 0, totalFiles, 'Downloading sprites');

        for (const source of spriteSources) {
          let spriteBase = source.url;
          if (isMapboxProtocol(spriteBase) && effectiveAccessToken) {
            spriteBase = resolveMapboxUrl(spriteBase, effectiveAccessToken);
          }
          const qIndex = spriteBase.indexOf('?');
          const suffixes = [...baseSuffixes];
          // Mapbox Standard serves an iconset.pbf alongside the sprite under
          // /styles/v1/{owner}/{style}/{hash}/sprite → the sibling file is
          // /styles/v1/{owner}/{style}/{hash}/iconset.pbf. The last path
          // segment is `sprite`, so replacing it with `iconset.pbf` works.
          const pathWithoutQuery = qIndex !== -1 ? spriteBase.slice(0, qIndex) : spriteBase;
          let isMapboxStandardSprite = false;
          try {
            const parsed = new URL(pathWithoutQuery);
            isMapboxStandardSprite =
              parsed.hostname === 'api.mapbox.com' &&
              parsed.pathname.startsWith('/styles/v1/') &&
              parsed.pathname.endsWith('/sprite');
          } catch {
            // Non-URL sprite base (e.g. relative); not a Mapbox Standard sprite.
          }
          if (isMapboxStandardSprite) {
            // The path-rewrite suffix replaces the trailing `sprite` segment.
            suffixes.push('__ICONSET__');
          }
          const spriteUrls = suffixes.map(suffix => {
            if (suffix === '__ICONSET__') {
              // Replace trailing `sprite` with `iconset.pbf`, preserving query.
              const base = pathWithoutQuery.replace(/sprite$/, 'iconset.pbf');
              return qIndex !== -1 ? base + spriteBase.slice(qIndex) : base;
            }
            return qIndex !== -1
              ? spriteBase.slice(0, qIndex) + suffix + spriteBase.slice(qIndex)
              : spriteBase + suffix;
          });
          try {
            const result = await downloadSprites(spriteUrls, styleId, {
              enableValidation: true,
              skipExisting: false,
              namePrefix: source.id !== 'sprite' ? source.id : undefined,
              onProgress: (progress: { completed: number; total: number }) => {
                emit('sprites', completed + progress.completed, totalFiles, 'Downloading sprites');
              },
            });
            spriteResults.push(result);
          } catch (error) {
            regionLogger.warn(`Sprite download failed for source ${source.id} (non-fatal):`, error);
          }
          completed += suffixes.length;
          emit('sprites', completed, totalFiles, 'Downloading sprites');
        }
      }
    }

    // 3. Glyphs
    let glyphResult: DownloadRegionResult['glyphResult'];
    if (!skipGlyphs && originalGlyphsUrl && !originalGlyphsUrl.startsWith('idb://')) {
      const fontFamilies = new Set(
        extractAllFontNames(
          storedStyle as unknown as {
            layers?: Array<{ layout?: { [key: string]: unknown } }>;
            schema?: Record<string, { default?: unknown }>;
          }
        )
      );
      if (fontFamilies.size > 0) {
        const { downloadGlyphs } = await import('@/services/glyphService');
        let glyphsUrl = originalGlyphsUrl;
        if (isMapboxProtocol(glyphsUrl) && effectiveAccessToken) {
          glyphsUrl = resolveMapboxUrl(glyphsUrl, effectiveAccessToken);
        }
        const ranges = glyphRanges ?? [...GLYPH_CONFIG.COMPREHENSIVE_RANGES];
        // No pre-emit — the service's first onProgress callback drives the
        // initial total (pre-estimating `ranges * families` caused a visible
        // jump when the real total came in).
        try {
          glyphResult = await downloadGlyphs(glyphsUrl, Array.from(fontFamilies), styleId, ranges, {
            onProgress: (progress: { completed: number; total: number }) => {
              emit('glyphs', progress.completed, progress.total, 'Downloading glyphs');
            },
          });
        } catch (error) {
          regionLogger.warn('Glyph download failed (non-fatal):', error);
        }
      }
    }

    // 4. Models — Mapbox Standard's `style.models` references 3D tree /
    //    turbine .glb assets. Two value shapes exist in the wild
    //    (plain string or `{ uri }`) — we accept both.
    let modelResult: DownloadRegionResult['modelResult'];
    if (!skipModels && storedStyle.models) {
      const rawModels = storedStyle.models as Record<string, string | { uri?: string }>;
      const resolved: Record<string, string> = {};
      for (const [name, value] of Object.entries(rawModels)) {
        const uri = typeof value === 'string' ? value : value?.uri;
        if (!uri) continue;
        if (uri.startsWith('idb://')) continue; // already patched
        const httpUrl =
          isMapboxProtocol(uri) && effectiveAccessToken
            ? resolveMapboxUrl(uri, effectiveAccessToken)
            : uri;
        if (httpUrl.startsWith('http://') || httpUrl.startsWith('https://')) {
          resolved[name] = httpUrl;
        }
      }
      if (Object.keys(resolved).length > 0) {
        const { downloadModels } = await import('@/services/modelService');
        emit('models', 0, Object.keys(resolved).length, 'Downloading 3D models');
        try {
          modelResult = await downloadModels(resolved, styleId, {
            onProgress: (progress: { completed: number; total: number }) => {
              emit('models', progress.completed, progress.total, 'Downloading 3D models');
            },
          });
        } catch (error) {
          regionLogger.warn('Model download failed (non-fatal):', error);
        }
      }
    }

    // 5. Tiles — use the stored (source-embedded) style, which still has HTTP tile URLs
    const { downloadTiles } = await import('@/services/tileService');
    const regionForTiles = { ...region, styleId };
    emit('tiles', 0, 100, 'Downloading tiles');
    const tileResult = await downloadTiles(regionForTiles, storedStyle, styleId, {
      skipExisting: false,
      batchSize: 20,
      ...tileOptions,
      onProgress: progress => {
        emit('tiles', progress.completed, progress.total, progress.message ?? 'Downloading tiles');
        tileOptions?.onProgress?.(progress);
      },
    });

    // 6. Metadata — must run last, since addRegion patches style URLs to idb://.
    // Do NOT auto-fill tileExtension from tileResult: that's only the first
    // source's extension, and addRegion feeds it to patchStyleForOffline which
    // would override ALL sources — breaking mixed raster+vector styles. The
    // patcher extracts per-source extensions from tile URL patterns when
    // tileExtension is undefined. Callers who need to force an extension can
    // still pass `region.tileExtension` explicitly.
    emit('metadata', 0, 1, 'Saving region metadata');
    await this.addRegion({ ...region, styleId });
    emit('metadata', 1, 1, 'Region ready');

    return {
      regionId: region.id,
      styleId,
      styleResult,
      spriteResults,
      glyphResult,
      modelResult,
      tileResult,
    };
  }

  /**
   * Look up the stored style matching a region — by `styleId` first, then `styleUrl`.
   */
  private async findStyleEntry(region: OfflineRegionOptions): Promise<StyleEntry | undefined> {
    const db = await dbPromise;
    if (region.styleId) {
      const byId = await db.get('styles', region.styleId);
      if (byId) return byId;
    }
    if (region.styleUrl) {
      const all = await db.getAll('styles');
      // `s.key === styleUrl` looks like a dead branch today (style.id is never
      // a URL; see styleService.ts where id is derived from the URL's last
      // path segment or falls back to `style_${Date.now()}`), but we keep it
      // for backward compatibility with any legacy rows that predate the
      // styleId-vs-URL separation. Matches the logic in isStyleDownloaded().
      return all.find(
        (s: Record<string, unknown> & { key?: string; originalUrl?: string }) =>
          s?.key === region.styleUrl || s?.originalUrl === region.styleUrl
      );
    }
    return undefined;
  }

  async deleteRegion(regionId: string): Promise<void> {
    const db = await dbPromise;
    regionLogger.debug(`Deleting region: ${regionId}`);

    try {
      // Find which style contains this region
      const allStyles = await db.getAll('styles');
      regionLogger.debug(`Found ${allStyles.length} styles to search through`);

      let foundStyle: StyleEntry | null = null;
      let foundRegion: OfflineRegionOptions | null = null;

      for (const style of allStyles) {
        regionLogger.debug(
          `Checking style: ${style?.key}, regions count: ${style?.regions?.length || 0}`
        );
        if (style && Array.isArray(style.regions)) {
          const region = style.regions.find((r: { id?: string; regionId?: string }) => {
            return r.id === regionId || r.regionId === regionId;
          });
          if (region) {
            foundStyle = style;
            foundRegion = region;
            regionLogger.debug(`Found region in style: ${style.key}`);
            break;
          }
        }
      }

      if (!foundStyle || !foundRegion) {
        regionLogger.warn(`Region ${regionId} not found in any style`);
        return;
      }

      regionLogger.debug(`Found region in style: ${foundStyle.key}`, foundRegion);

      // Remove the region from the style's regions array
      const remainingRegions = foundStyle.regions.filter(
        (r: OfflineRegionOptions & { regionId?: string }) =>
          r.id !== regionId && r.regionId !== regionId
      );

      foundStyle.regions = remainingRegions;
      regionLogger.debug(`Remaining regions count: ${remainingRegions.length}`);

      // If this was the last region for the style, delete the entire style and all its resources
      if (remainingRegions.length === 0) {
        regionLogger.info(
          `Style ${foundStyle.key} has no remaining regions, deleting entire style and all resources`
        );

        // Delete all tiles for this style
        const deletedTileCount = await this.deleteAllStyleTiles(foundStyle.key);
        regionLogger.debug(`Deleted ${deletedTileCount} tiles`);

        // Delete all style resources (fonts, glyphs, sprites)
        await this.deleteStyleResources(foundStyle.key);

        // Delete the style entry itself
        await db.delete('styles', foundStyle.key);

        regionLogger.info(
          `Completely deleted style ${foundStyle.key} and all associated resources`
        );
      } else {
        regionLogger.debug(
          `Style ${foundStyle.key} has ${remainingRegions.length} remaining regions, cleaning up non-overlapping tiles`
        );

        // Delete tiles that don't overlap with any remaining regions
        const deletedTileCount = await this.deleteNonOverlappingTiles(
          foundStyle.key,
          remainingRegions
        );

        // Update the style entry with the remaining regions
        await db.put('styles', foundStyle);

        regionLogger.info(
          `Region ${regionId} deleted successfully from style ${foundStyle.key}, cleaned up ${deletedTileCount} non-overlapping tiles`
        );
      }

      regionLogger.info(`Region deletion completed successfully for: ${regionId}`);
    } catch (error) {
      regionLogger.error(`Error during region deletion for ${regionId}:`, error);
      throw error; // Re-throw to let UI handle the error
    }
  }

  async listRegions(): Promise<OfflineRegionOptions[]> {
    // StoredRegion extends OfflineRegionOptions; no need for a second iteration.
    return this.listStoredRegions();
  }

  /**
   * List all stored regions from styles (used for UI and fitBounds)
   */
  async listStoredRegions(): Promise<StoredRegion[]> {
    return loadAllStoredRegions();
  }
}

/**
 * Flatten every `styles.regions[]` entry into a `StoredRegion[]` with the
 * backing style's id, plus defaults for `created`/`lastModified`/`expiry`.
 * Shared by `RegionService.listStoredRegions` and `CleanupService.getAllRegions`.
 */
export async function loadAllStoredRegions(): Promise<StoredRegion[]> {
  try {
    const styles = await loadStyles();
    const allRegions: StoredRegion[] = [];
    for (const style of styles) {
      if (!style.regions || !Array.isArray(style.regions)) continue;
      for (const region of style.regions) {
        allRegions.push({
          ...region,
          key: region.id,
          styleId: style.key,
          created: region.created || Date.now(),
          lastModified: region.updated || region.created || Date.now(),
          expiry: region.expiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
        } as StoredRegion);
      }
    }
    regionLogger.debug('Extracted regions from styles:', allRegions);
    return allRegions;
  } catch (error) {
    regionLogger.error('Error loading regions from styles:', error);
    return [];
  }
}
