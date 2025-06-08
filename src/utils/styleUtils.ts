import type { MapboxStyle } from '../types/style';

/**
 * Patches a MapboxStyle for offline use by replacing URLs with IndexedDB references
 */
export function patchStyleForOffline(style: MapboxStyle, downloadId: string): MapboxStyle {
  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey] as {
      tiles?: string[];
      url?: string;
    };
    if (source.tiles) {
      source.tiles = source.tiles.map(
        (url: string) => `idb://${downloadId}/tile/${encodeURIComponent(url)}`
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

/**
 * Validates if a region configuration is valid
 */
export function validateRegion(region: any): boolean {
  if (!region.id || !region.name) return false;
  if (!region.bounds || !Array.isArray(region.bounds)) return false;
  if (region.bounds.length !== 2) return false;
  if (!Array.isArray(region.bounds[0]) || !Array.isArray(region.bounds[1])) return false;
  if (region.bounds[0].length !== 2 || region.bounds[1].length !== 2) return false;
  if (typeof region.minZoom !== 'number' || typeof region.maxZoom !== 'number') return false;
  if (region.minZoom < 0 || region.maxZoom > 24 || region.minZoom > region.maxZoom) return false;

  return true;
}

/**
 * Calculates the bounding box area in square degrees
 */
export function calculateBBoxArea(bounds: [[number, number], [number, number]]): number {
  const [[west, south], [east, north]] = bounds;
  return Math.abs(east - west) * Math.abs(north - south);
}

/**
 * Estimates the number of tiles for a given region and zoom range
 */
export function estimateTileCount(
  bounds: [[number, number], [number, number]],
  minZoom: number,
  maxZoom: number
): number {
  const [[west, south], [east, north]] = bounds;
  let totalTiles = 0;

  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const tilesPerRow = Math.pow(2, zoom);
    const tileSize = 360 / tilesPerRow;

    const minTileX = Math.floor((west + 180) / tileSize);
    const maxTileX = Math.floor((east + 180) / tileSize);
    const minTileY = Math.floor((90 - north) / tileSize);
    const maxTileY = Math.floor((90 - south) / tileSize);

    const tilesX = Math.abs(maxTileX - minTileX) + 1;
    const tilesY = Math.abs(maxTileY - minTileY) + 1;

    totalTiles += tilesX * tilesY;
  }

  return totalTiles;
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
/**
 * Extract tile coordinates from a tile URL
 * e.g., "https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/0/0/0.mvt" -> "0/0/0.mvt"
 */
export function extractTileKey(url: string): string {
  // Match z/x/y pattern with optional file extension
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/);
  if (match) {
    const [, z, x, y, ext] = match;
    return `${z}/${x}/${y}.${ext}`;
  }

  // Fallback: try to extract just the filename part
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  if (filename.includes('.')) {
    return filename;
  }

  // Last resort: use the full URL
  console.warn(`Could not extract tile key from URL: ${url}`);
  return url;
}
