import type { MapboxStyle } from '@/types/style';
import { logger } from './logger';

const styleLogger = logger.scope('StyleUtils');

/**
 * Patches a MapboxStyle for offline use by replacing URLs with IndexedDB references
 * @param style - The style to patch
 * @param downloadId - The download/region ID for tiles and other resources
 * @param maxZoom - Optional max zoom level for sources
 * @param tileExtension - Optional tile extension
 * @param styleId - Optional style ID for sprites (if different from downloadId). Sprites are shared
 *                  across regions and stored with the style ID, so this parameter allows the sprite
 *                  URLs to correctly reference the style ID.
 */
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

  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey] as {
      tiles?: string[];
      url?: string;
      maxzoom?: number;
    };
    styleLogger.debug(`Patching source: ${sourceKey}`, source);

    if (source.tiles) {
      const originalTiles = [...source.tiles];
      // Patch to idb://{downloadId}/tile/{sourceKey}/{z}/{x}/{y}.ext
      source.tiles = source.tiles.map((url: string) => {
        // Use stored tileExtension if available, otherwise try to extract from URL
        let ext = tileExtension;
        if (!ext) {
          const extMatch = url.match(/\{z\}\/\{x\}\/\{y\}\.(\w+)/);
          ext = extMatch ? extMatch[1] : 'pbf';
        }
        return `idb://${downloadId}/tile/${sourceKey}/{z}/{x}/{y}.${ext}`;
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
    // Use the lower of the region maxZoom and the source's original maxzoom so we
    // don't raise it above the tileset's actual range (e.g. 3dbuildings at z14).
    if (maxZoom !== undefined) {
      const originalMaxzoom = source.maxzoom;
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
        source.tiles = [`idb://${downloadId}/tile/${sourceKey}/{z}/{x}/{y}.${ext}`];
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
    style.glyphs = `idb://${downloadId}/glyph/{fontstack}/{range}.pbf`;
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

/**
 * Extract individual font names from a `text-font` layout property value.
 *
 * Handles both simple arrays (`["Font A", "Font B"]`) and Mapbox GL expression
 * syntax (e.g. `["step", ["zoom"], ["literal", ["Font A"]], 10, ["literal", ["Font B"]]]`).
 */
export function extractFontNamesFromTextField(textFont: unknown): string[] {
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

    // Simple font stack: every element is a string and the first element is
    // NOT a known expression operator
    if (value.every((v: unknown) => typeof v === 'string') && !expressionOps.has(value[0])) {
      for (const f of value) {
        fonts.add(f as string);
      }
      return;
    }

    // Recurse into sub-arrays (covers step/match/case branches)
    for (const item of value) {
      if (Array.isArray(item)) {
        walk(item);
      }
    }
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
        for (const name of extractFontNamesFromTextField(layer.layout['text-font'])) {
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
