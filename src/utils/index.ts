export async function fetchResource(url: string): Promise<{ type: 'image' | 'pbf'; data: ArrayBuffer }> {
  // Add CORS mode to fetch
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  const data = await response.arrayBuffer();

  if (contentType?.includes('image')) {
    return { type: 'image', data };
  } else if (contentType?.includes('application/x-protobuf')) {
    return { type: 'pbf', data };
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}
/**
 * Extracts all fontstacks from a style object and generates all glyph URLs for a set of Unicode ranges.
 * @param style The style JSON object
 * @param glyphsUrlTemplate The glyphs URL template from the style (e.g. .../fonts/{fontstack}/{range}.pbf)
 * @param ranges Optional array of ranges (default: [0-255, 256-511, ..., 61440-61695])
 */
export function generateGlyphUrlsFromStyle(style: any, glyphsUrlTemplate: string, ranges?: Array<[number, number]>): string[] {
  // Default Unicode ranges for Mapbox/MapLibre fonts
  const defaultRanges: Array<[number, number]> = [
    [0, 255], [256, 511], [512, 767], [768, 1023], [1024, 1279],
    [1280, 1535], [1536, 1791], [1792, 2047], [2048, 2303], [2304, 2559],
    [61440, 61695] // Private Use Area (for icons)
  ];
  const usedRanges = ranges || defaultRanges;

  // Collect all fontstacks used in the style's layers
  const fontstacks = new Set<string>();
  if (style && Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (layer.layout && layer.layout["text-font"]) {
        const fonts = Array.isArray(layer.layout["text-font"]) ? layer.layout["text-font"] : [layer.layout["text-font"]];
        fonts.forEach(f => fontstacks.add(f));
      }
    }
  }

  // Generate all glyph URLs
  const urls: string[] = [];
  for (const fontstack of fontstacks) {
    for (const [start, end] of usedRanges) {
      const range = `${start}-${end}`;
      const url = glyphsUrlTemplate.replace('{fontstack}', encodeURIComponent(fontstack)).replace('{range}', range);
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
