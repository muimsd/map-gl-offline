import type { MapboxStyle } from '../types/style';
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

    // Set maxzoom to the region's maxZoom to enable overzooming
    // This prevents MapLibre from requesting tiles beyond what we downloaded
    if (maxZoom !== undefined) {
      const originalMaxzoom = source.maxzoom;
      source.maxzoom = maxZoom;
      styleLogger.debug(`Set maxzoom for ${sourceKey}: ${originalMaxzoom} → ${maxZoom}`);
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
    style.sprite = `idb://${spriteBaseId}/sprite/sprite`;
    styleLogger.debug(`Patched sprite:`, {
      original: originalSprite,
      patched: style.sprite,
      spriteBaseId,
      usingStyleId: !!styleId,
    });
  }

  styleLogger.debug(`Final patched style:`, style);
  return style;
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
    [61440, 61695], // Private Use Area (for icons)
  ];
  const usedRanges = ranges || defaultRanges;

  // Collect all fontstacks used in the style's layers
  const fontstacks = new Set<string>();
  if (style && Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (layer.layout && layer.layout['text-font']) {
        const fonts = Array.isArray(layer.layout['text-font'])
          ? layer.layout['text-font']
          : [layer.layout['text-font']];
        fonts.forEach(f => fontstacks.add(f));
      }
    }
  }

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
