/**
 * Shared tile key utilities for consistent key generation across the codebase
 */

/**
 * Create a tile key for storage and lookup
 * Format: styleId:sourceId:z:x:y.ext
 */
export function createTileKey(
  x: number,
  y: number,
  z: number,
  styleId: string,
  sourceId: string,
  ext: string
): string {
  return `${styleId}:${sourceId}:${z}:${x}:${y}.${ext}`;
}

/**
 * Parse a tile key into its components
 * Returns null if the key format is invalid
 */
export function parseTileKey(key: string): {
  styleId: string;
  sourceId: string;
  z: number;
  x: number;
  y: number;
  ext: string;
} | null {
  const parts = key.split(':');
  if (parts.length < 5) {
    return null;
  }

  const [styleId, sourceId, zStr, xStr, yWithExt] = parts;
  const z = parseInt(zStr, 10);
  const x = parseInt(xStr, 10);

  // Parse y and extension from "y.ext"
  const dotIndex = yWithExt.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const y = parseInt(yWithExt.substring(0, dotIndex), 10);
  const ext = yWithExt.substring(dotIndex + 1);

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return null;
  }

  return { styleId, sourceId, z, x, y, ext };
}

/**
 * Extract the extension (the last dotted segment before `?`, `#`, or end) from
 * a tile URL or tile URL template. Defaults to `"pbf"` when no extension can
 * be parsed. For multi-extension URLs like Mapbox v4's `{y}.vector.pbf` this
 * returns `"pbf"`, matching the key used when the tile is stored.
 *
 * Keeping extraction logic in one place ensures patchStyleForOffline (which
 * rewrites tile URLs to `idb://` at load time) derives the same extension
 * that tileService.extractExtension used at store time — otherwise the
 * first-try lookup in idbFetchHandler misses and has to fall through its
 * pbf/mvt/png/jpg/webp fallback loop.
 */
export function extractTileExtensionFromUrl(url: string): string {
  const match = url.match(/\.([\w]+)(?:[?#]|$)/i);
  return match ? match[1] : 'pbf';
}

/**
 * Derive tile extension from tile URL templates
 */
export function deriveTileExtension(tiles?: unknown): string {
  if (Array.isArray(tiles) && tiles.length > 0) {
    const firstTile = tiles[0];
    if (typeof firstTile === 'string') {
      return extractTileExtensionFromUrl(firstTile);
    }
  }
  return 'pbf';
}
