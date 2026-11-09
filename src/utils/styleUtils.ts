import type { MapboxStyle } from '@/types/style';
import { logger } from './logger';
import { extractTileExtensionFromUrl } from './tileKey';

const styleLogger = logger.scope('StyleUtils');

/**
 * Patches a MapboxStyle for offline use by replacing URLs with IndexedDB references.
 *
 * Safe to call repeatedly on the same stored style (every `addRegion` does):
 * the first call stashes each source's upstream `tiles` / `maxzoom` under
 * `__originalTiles` / `__originalMaxzoom`, and later calls patch from those,
 * so the download pipeline can still reach the network and `maxzoom` can grow
 * again when a deeper region is added.
 *
 * @param style - The style to patch
 * @param downloadId - Fallback ID for `idb://` URLs when `styleId` is omitted
 * @param maxZoom - Max zoom downloaded for this style (the highest across its regions)
 * @param tileExtension - Optional tile extension
 * @param styleId - Style ID used in all `idb://` URLs. Tiles, glyphs, sprites and
 *                  models are stored per style, so URLs keyed by style keep working
 *                  when any one region is deleted.
 */
/**
 * Add a region's extra tile sources to a style, unless one with that id is
 * already there. Sources must be in the style before it's patched for offline use.
 */
export function injectExtraSources(
  style: { sources: Record<string, unknown> },
  extraSources: ReadonlyArray<{
    id: string;
    tiles: string[];
    type?: string;
    minzoom?: number;
    maxzoom?: number;
    attribution?: string;
  }> = []
): void {
  for (const extra of extraSources) {
    if (style.sources[extra.id]) continue;
    style.sources[extra.id] = {
      type: extra.type || 'vector',
      tiles: extra.tiles,
      ...(extra.minzoom !== undefined ? { minzoom: extra.minzoom } : {}),
      ...(extra.maxzoom !== undefined ? { maxzoom: extra.maxzoom } : {}),
      ...(extra.attribution ? { attribution: extra.attribution } : {}),
    };
  }
}

/**
 * Keep each model's upstream URL before the style is patched, the first time
 * only. Patching points every model at `idb://`, so without this a model that
 * failed to download couldn't be fetched again.
 */
export function stashOriginalModels(entry: {
  style: object;
  originalModels?: Record<string, unknown>;
}): void {
  const models = (entry.style as { models?: Record<string, unknown> }).models;
  if (!models || entry.originalModels) return;
  const isPatched = (value: unknown) =>
    String(typeof value === 'string' ? value : (value as { uri?: unknown })?.uri).startsWith(
      'idb://'
    );
  // A style patched before this stash existed has no upstream URLs left to keep.
  if (Object.values(models).some(isPatched)) return;
  entry.originalModels = JSON.parse(JSON.stringify(models)) as Record<string, unknown>;
}

/**
 * Point models that aren't stored back at their upstream URLs. Run after
 * patching, which points every model at `idb://`.
 */
export function restoreUnstoredModels(
  entry: { style: object; originalModels?: Record<string, unknown> },
  storedNames: ReadonlySet<string>
): void {
  const models = (entry.style as { models?: Record<string, unknown> }).models;
  if (!models || !entry.originalModels) return;
  for (const name of Object.keys(models)) {
    if (!storedNames.has(name) && entry.originalModels[name] !== undefined) {
      models[name] = JSON.parse(JSON.stringify(entry.originalModels[name]));
    }
  }
}

/**
 * Whether a style uses parts of the spec only Mapbox GL JS v3 draws: config
 * (`schema`), 3D `models`, `lights` or `imports`. MapLibre rejects these.
 */
export function needsMapboxGl(style: object): boolean {
  const parts = style as Record<string, unknown>;
  return Boolean(parts.schema || parts.models || parts.lights || parts.imports);
}

/** Whether a map instance is Mapbox GL JS v3, the only renderer with style config. */
export function isMapboxGlMap(map: unknown): boolean {
  return typeof (map as { setConfigProperty?: unknown } | null)?.setConfigProperty === 'function';
}

export function patchStyleForOffline(
  style: MapboxStyle,
  downloadId: string,
  maxZoom?: number,
  tileExtension?: string,
  styleId?: string
): MapboxStyle {
  styleLogger.debug(
    `Patching style for offline use with downloadId: ${downloadId}, maxZoom: ${maxZoom}, tileExtension: ${tileExtension}`
  );
  styleLogger.debug(`Original style:`, style);

  const urlId = styleId || downloadId;

  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey] as {
      tiles?: string[];
      url?: string;
      maxzoom?: number;
      __originalTiles?: string[];
      __originalMaxzoom?: number | null;
    };
    styleLogger.debug(`Patching source: ${sourceKey}`, source);

    // Stash upstream values once. Already-patched tiles (all idb://) are never
    // stashed as "original"; `null` records that the source had no maxzoom.
    if (
      source.tiles &&
      source.__originalTiles === undefined &&
      !source.tiles.every(url => url.startsWith('idb://'))
    ) {
      source.__originalTiles = [...source.tiles];
    }
    if (source.__originalMaxzoom === undefined) {
      source.__originalMaxzoom = source.maxzoom ?? null;
    }

    if (source.tiles) {
      const originalTiles = source.__originalTiles ?? [...source.tiles];
      // Patch to idb://{downloadId}/tile/{sourceKey}/{z}/{x}/{y}.ext.
      // Extension extraction goes through the shared extractTileExtensionFromUrl
      // helper so the patched URL's extension matches what tileService used when
      // storing — otherwise Mapbox v4 tile URLs (`{y}.vector.pbf`) produced a
      // stored key under `.pbf` but a patched URL with `.vector`, forcing
      // idbFetchHandler to fall through its pbf/mvt/png/jpg/webp fallback loop
      // on every tile.
      source.tiles = originalTiles.map((url: string) => {
        const ext = tileExtension ?? extractTileExtensionFromUrl(url);
        return `idb://${urlId}/tile/${sourceKey}/{z}/{x}/{y}.${ext}`;
      });
      styleLogger.debug(
        `Patched tiles for ${sourceKey} with extension .${tileExtension || 'pbf'}:`,
        {
          original: originalTiles,
          patched: source.tiles,
        }
      );
    }

    // Cap maxzoom so the map doesn't request tiles beyond what we downloaded.
    // Use the lower of the downloaded maxZoom and the source's *upstream*
    // maxzoom so we don't raise it above the tileset's actual range (e.g.
    // 3dbuildings at z14) — and so an earlier, shallower region's cap doesn't
    // stick once a deeper region is added.
    if (maxZoom !== undefined) {
      const originalMaxzoom = source.__originalMaxzoom ?? undefined;
      source.maxzoom = originalMaxzoom !== undefined ? Math.min(maxZoom, originalMaxzoom) : maxZoom;
      styleLogger.debug(`Set maxzoom for ${sourceKey}: ${originalMaxzoom} → ${source.maxzoom}`);
    }

    if (source.url) {
      const originalUrl = source.url;
      (source as Record<string, unknown>).__originalTilesetUrl = originalUrl;

      // Always ensure tiles array exists for direct rendering
      // This avoids relying on TileJSON fetch via addProtocol which may fail
      if (!source.tiles) {
        let ext = tileExtension;
        if (!ext) ext = 'pbf';
        source.tiles = [`idb://${urlId}/tile/${sourceKey}/{z}/{x}/{y}.${ext}`];
        styleLogger.debug(`Added tiles array for TileJSON-only source ${sourceKey}:`, {
          tiles: source.tiles,
        });
      }

      // Remove url so MapLibre doesn't try to fetch TileJSON
      // (tiles array is sufficient for rendering)
      delete source.url;
      styleLogger.debug(`Removed tilejson URL for ${sourceKey} (tiles array is set):`, {
        original: originalUrl,
      });
    }
  }

  // Patch glyphs
  if (style.glyphs) {
    const originalGlyphs = style.glyphs;
    style.glyphs = `idb://${urlId}/glyph/{fontstack}/{range}.pbf`;
    styleLogger.debug(`Patched glyphs:`, { original: originalGlyphs, patched: style.glyphs });
  }

  // Patch sprite
  // Use styleId for sprites since they're shared across regions and stored with the style ID
  if (style.sprite) {
    const originalSprite = style.sprite;
    const spriteBaseId = styleId || downloadId;

    if (Array.isArray(style.sprite)) {
      // MapLibre GL JS v3+ array sprite format: [{id, url}, ...]
      const arraySprite = style.sprite as unknown as Array<{ id: string; url: string }>;
      const patchedArray = arraySprite.map(entry => ({
        ...entry,
        url: `idb://${spriteBaseId}/sprite/${entry.id}`,
      }));
      (style as Record<string, unknown>).sprite = patchedArray;
      styleLogger.debug(`Patched array sprite (${patchedArray.length} sources):`, {
        original: originalSprite,
        patched: patchedArray,
        spriteBaseId,
      });
    } else {
      style.sprite = `idb://${spriteBaseId}/sprite/sprite`;
      styleLogger.debug(`Patched sprite:`, {
        original: originalSprite,
        patched: style.sprite,
        spriteBaseId,
        usingStyleId: !!styleId,
      });
    }
  }

  // Patch top-level models (Mapbox Standard 3D trees / wind turbines).
  // Two shapes exist in the wild:
  //   - Mapbox Standard: `{ "maple1-lod1": "mapbox://models/mapbox/maple1-v4-lod1.glb" }` (string values)
  //   - Older/generic:   `{ "name": { "uri": "mapbox://..." } }`               (object values)
  // Models are keyed on the style ID (like sprites) so they can be shared
  // across regions.
  if (style.models) {
    const modelBaseId = styleId || downloadId;
    const models = style.models as unknown as Record<string, string | { uri?: string }>;
    let patchedCount = 0;
    for (const [modelId, value] of Object.entries(models)) {
      if (typeof value === 'string') {
        models[modelId] = `idb://${modelBaseId}/model/${modelId}`;
        patchedCount++;
      } else if (value && typeof value === 'object' && 'uri' in value && value.uri) {
        value.uri = `idb://${modelBaseId}/model/${modelId}`;
        patchedCount++;
      }
    }
    if (patchedCount > 0) {
      styleLogger.debug(`Patched ${patchedCount} model URIs (styleId: ${modelBaseId})`);
    }
  }

  styleLogger.debug(`Final patched style:`, style);
  return style;
}

type FontSchema = Record<string, { default?: unknown }>;

/** Resolve one entry of a font stack: a name, `["config", key]` or a `["concat", ...]` of those. */
function resolveFontName(value: unknown, schema?: FontSchema): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  if (value[0] === 'config' && typeof value[1] === 'string') {
    const configured = schema?.[value[1]]?.default;
    return typeof configured === 'string' ? configured : undefined;
  }
  if (value[0] === 'concat') {
    const parts = value.slice(1).map(part => resolveFontName(part, schema));
    return parts.every(part => part !== undefined) ? parts.join('') : undefined;
  }
  return undefined;
}

/**
 * Extract individual font names from a `text-font` layout property value.
 *
 * Handles simple arrays (`["Font A", "Font B"]`), Mapbox GL expression syntax
 * (e.g. `["step", ["zoom"], ["literal", ["Font A"]], 10, ["literal", ["Font B"]]]`),
 * and Mapbox Standard's config-built stacks
 * (`[["concat", ["config", "font"], " Medium"], "Arial Unicode MS Bold"]`).
 */
export function extractFontNamesFromTextField(textFont: unknown, schema?: FontSchema): string[] {
  const fonts = new Set<string>();

  // Known expression operators — anything starting with one of these is NOT a font name list
  const expressionOps = new Set([
    'step',
    'match',
    'case',
    'coalesce',
    'interpolate',
    'interpolate-hcl',
    'interpolate-lab',
    'literal',
    'get',
    'has',
    'in',
    'at',
    'length',
    'let',
    'var',
    'concat',
    'format',
    'image',
    'to-string',
    'linear',
    'exponential',
    'cubic-bezier',
    // Mapbox GL v3 config system (Standard style uses ["config", "font"])
    'config',
  ]);

  function walk(value: unknown): void {
    if (!Array.isArray(value) || value.length === 0) return;

    // ["literal", ["FontA", "FontB"]]
    if (value[0] === 'literal' && Array.isArray(value[1])) {
      for (const f of value[1]) {
        if (typeof f === 'string') fonts.add(f);
      }
      return;
    }

    // A font stack: only font names, and the first isn't an expression operator
    const isFontEntry = (item: unknown) =>
      typeof item === 'string' ||
      (Array.isArray(item) && (item[0] === 'config' || item[0] === 'concat'));
    if (value.every(isFontEntry) && !expressionOps.has(value[0])) {
      for (const item of value) {
        const name = resolveFontName(item, schema);
        if (name !== undefined) fonts.add(name);
      }
      return;
    }

    // Only the branches that output a font. Conditions and inputs hold strings
    // like `["zoom"]` or match labels that aren't fonts.
    const last = value.length - 1;
    const isOutput = (i: number): boolean => {
      switch (value[0]) {
        case 'step': // ["step", input, out0, stop, out, ...]
          return i >= 2 && i % 2 === 0;
        case 'match': // ["match", input, label, out, label, out, ..., fallback]
          return i === last || (i >= 3 && i % 2 === 1);
        case 'case': // ["case", cond, out, cond, out, ..., fallback]
          return i === last || (i >= 2 && i % 2 === 0);
        case 'coalesce':
          return i >= 1;
        case 'let': // ["let", name, value, ..., body]
          return i === last;
        default:
          return false;
      }
    };
    value.forEach((item: unknown, i: number) => {
      if (isOutput(i)) walk(item);
    });
  }

  walk(textFont);
  return Array.from(fonts);
}

/**
 * Normalize a style's `sprite` property into a uniform array of {id, url} sources.
 * Handles string format, array format, and filters out already-patched idb:// URLs.
 */
export function normalizeSpriteProperty(sprite: unknown): Array<{ id: string; url: string }> {
  if (!sprite) return [];
  if (Array.isArray(sprite)) {
    return (sprite as Array<{ id: string; url: string }>).filter(
      entry => entry && typeof entry.url === 'string' && !entry.url.startsWith('idb://')
    );
  }
  if (typeof sprite === 'string' && !sprite.startsWith('idb://')) {
    return [{ id: 'sprite', url: sprite }];
  }
  return [];
}

/**
 * Collect all unique font names referenced in a style's layers.
 */
export function extractAllFontNames(style: {
  layers?: Array<{ layout?: { [key: string]: unknown } }>;
  schema?: Record<string, { default?: unknown }>;
}): string[] {
  const fonts = new Set<string>();
  if (style && Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (layer.layout && layer.layout['text-font']) {
        for (const name of extractFontNamesFromTextField(layer.layout['text-font'], style.schema)) {
          fonts.add(name);
        }
      }
    }
  }

  // Mapbox Standard style uses schema config for fonts (e.g. schema.font.default = "DIN Pro")
  // If no fonts were found from layers, check the schema for font defaults
  if (fonts.size === 0 && style && style.schema) {
    const fontConfig = style.schema.font || style.schema['text-font'];
    if (fontConfig && typeof fontConfig.default === 'string') {
      // The config value is a font family like "DIN Pro" — add common weights
      const baseName = fontConfig.default;
      fonts.add(`${baseName} Regular`);
      fonts.add(`${baseName} Medium`);
      fonts.add(`${baseName} Bold`);
      fonts.add(`${baseName} Italic`);
    }
  }

  return Array.from(fonts);
}

/**
 * Extracts all fontstacks from a style object and generates all glyph URLs for a set of Unicode ranges.
 * @param style The style JSON object
 * @param glyphsUrlTemplate The glyphs URL template from the style (e.g. .../fonts/{fontstack}/{range}.pbf)
 * @param ranges Optional array of ranges (default: [0-255, 256-511, ..., 61440-61695])
 */
export function generateGlyphUrlsFromStyle(
  style: { layers?: Array<{ layout?: { [key: string]: unknown } }> },
  glyphsUrlTemplate: string,
  ranges?: Array<[number, number]>
): string[] {
  // Default Unicode ranges for Mapbox/MapLibre fonts
  const defaultRanges: Array<[number, number]> = [
    [0, 255],
    [256, 511],
    [512, 767],
    [768, 1023],
    [1024, 1279],
    [1280, 1535],
    [1536, 1791],
    [1792, 2047],
    [2048, 2303],
    [2304, 2559],
    [7680, 7935], // Latin Extended Additional
    [8192, 8447], // General Punctuation, Superscripts/Subscripts, Currency Symbols
    [8448, 8703], // Letterlike Symbols, Number Forms, Arrows
    [61440, 61695], // Private Use Area (for icons)
    [64256, 64511], // Alphabetic Presentation Forms
    [65024, 65279], // Variation Selectors
  ];
  const usedRanges = ranges || defaultRanges;

  // Collect all font names using expression-aware extraction
  const fontstacks = extractAllFontNames(style);

  // Generate all glyph URLs
  const urls: string[] = [];
  for (const fontstack of fontstacks) {
    for (const [start, end] of usedRanges) {
      const range = `${start}-${end}`;
      const url = glyphsUrlTemplate
        .replace('{fontstack}', encodeURIComponent(fontstack))
        .replace('{range}', range);
      urls.push(url);
    }
  }
  return urls;
}
