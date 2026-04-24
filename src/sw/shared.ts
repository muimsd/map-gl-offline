/**
 * Pure helpers shared between the main-thread offline fetch handler
 * (`src/utils/idbFetchHandler.ts`) and the offline Service Worker
 * (`src/sw/offline-sw.ts`, compiled to `public/idb-offline-sw.js`).
 *
 * Keeping these in one place means the SW and the main-thread handler
 * can't drift — adding a new `model` handler, changing the fallback
 * order, or tweaking the tilejson-source matcher happens once.
 *
 * Nothing in here touches IndexedDB directly. Each helper takes already-
 * resolved inputs and returns the list of candidate keys (or the
 * resolved output) that the caller feeds into its own IDB lookup.
 *
 * The corresponding IDB access layer is:
 *   - main thread: `idb` library via `dbPromise`
 *   - service worker: raw `indexedDB.open` (see `offline-sw.ts`)
 *
 * They have different shapes so cannot be shared; the key computation
 * can be and is.
 */

export const OFFLINE_PREFIX = '/__offline__/';
export const DB_NAME = 'offline-map-db';

/**
 * Minimal stored-style shape used for region-by-style lookup and
 * tilejson source resolution.
 */
export interface StyleEntryLike {
  key: string;
  style?: {
    sources?: Record<string, unknown>;
  };
  regions?: Array<{ id?: string; regionId?: string }>;
}

// ---------------------------------------------------------------------------
// Tile keys
// ---------------------------------------------------------------------------

/** Canonical tile key format used across stores. Keep in sync with `tileKey.ts`. */
export function makeTileKey(
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
 * Extensions to try in order when the requested extension misses. `glb` is
 * last so batched-model sources (Mapbox Standard 3D buildings) resolve when
 * their source URL template ended in `.vector` or similar and the actual
 * tile body was stored as glb.
 */
export const TILE_FALLBACK_EXTENSIONS = ['pbf', 'mvt', 'png', 'jpg', 'webp', 'glb'] as const;

/** Extensions minus the one the caller already tried. */
export function tileFallbackExtensions(requested: string): string[] {
  return TILE_FALLBACK_EXTENSIONS.filter(e => e !== requested);
}

/** Extract `.../{y}.ext` → `{ y, ext }`. Returns null if the path isn't a tile filename. */
export function parseTileYExt(yExt: string): { y: number; ext: string } | null {
  const match = yExt.match(/^(\d+)\.([\w.]+?)(?:[?#]|$)/);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  if (Number.isNaN(y)) return null;
  return { y, ext: match[2] };
}

// ---------------------------------------------------------------------------
// Region → style lookup
// ---------------------------------------------------------------------------

/**
 * Given an already-fetched list of style entries, find the first one whose
 * `regions` array contains the given ID. Pure — the caller is responsible for
 * loading the entries and for caching. Used by both `findStyleByRegionId`
 * implementations to keep the match rule identical.
 */
export function findStyleByRegionIdIn(
  styles: readonly StyleEntryLike[],
  regionId: string
): StyleEntryLike | null {
  for (const entry of styles) {
    const regions = entry.regions;
    if (!Array.isArray(regions)) continue;
    for (const r of regions) {
      if (r?.regionId === regionId || r?.id === regionId) {
        return entry;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Glyph candidate keys
// ---------------------------------------------------------------------------

/**
 * Parse `FontA,FontB,FontC/0-255.pbf` into (fontstacks, rangePart). Mapbox
 * requests a comma-joined font-family fallback chain; each glyph is stored
 * individually, so the caller tries each fontstack in order.
 */
export function parseGlyphPath(decodedPath: string): {
  fontstacks: string[];
  rangePart: string;
} {
  const pathParts = decodedPath.split('/');
  const fontstackPart = pathParts[0] ?? '';
  const rangePart = pathParts[1] || '0-255.pbf';
  const fontstacks = fontstackPart
    .split(',')
    .map(f => f.trim())
    .filter(Boolean);
  return { fontstacks, rangePart };
}

/**
 * Build the list of keys to try for a single (fontstack, range) pair.
 * Order: actualStyleId variants first (most common), then downloadId,
 * then the bare path. Normalized and raw `.pbf`-less forms are both tried
 * to cover stored-key variants from older versions.
 */
export function glyphCandidateKeys(
  actualStyleId: string,
  downloadId: string,
  fontstack: string,
  rangePart: string
): string[] {
  const glyphPath = `${fontstack}/${rangePart}`;
  const normalizedPath = glyphPath.endsWith('.pbf') ? glyphPath : `${glyphPath}.pbf`;
  return dedupe([
    `${actualStyleId}::${normalizedPath}`,
    `${actualStyleId}::${glyphPath}`,
    `${downloadId}::${normalizedPath}`,
    `${downloadId}::${glyphPath}`,
    normalizedPath,
    glyphPath,
  ]);
}

// ---------------------------------------------------------------------------
// Sprite candidate keys
// ---------------------------------------------------------------------------

/**
 * Sprite keys have historically used both `::` and `:` as the separator, and
 * both the full filename (`sprite.json`) and the bare name (`sprite`). Return
 * every variant in priority order; the caller stops at the first hit.
 */
export function spriteCandidateKeys(
  actualStyleId: string,
  downloadId: string,
  decodedPath: string
): string[] {
  const stripExt = decodedPath.replace(/\.(json|png)$/i, '');
  return dedupe([
    `${actualStyleId}::${decodedPath}`,
    `${actualStyleId}:${decodedPath}`,
    `${actualStyleId}::${stripExt}`,
    `${actualStyleId}:${stripExt}`,
    `${downloadId}::${decodedPath}`,
    `${downloadId}:${decodedPath}`,
    `${downloadId}::${stripExt}`,
    `${downloadId}:${stripExt}`,
    decodedPath,
  ]);
}

// ---------------------------------------------------------------------------
// Model candidate keys
// ---------------------------------------------------------------------------

/**
 * Model keys are `{styleId}::model::{name}`. Try the resolved style id first,
 * then the bare downloadId in case the request came through the region-scoped
 * URL form (`idb://{regionId}/model/{name}`).
 */
export function modelCandidateKeys(
  actualStyleId: string,
  downloadId: string,
  decodedPath: string
): string[] {
  return dedupe([
    `${actualStyleId}::model::${decodedPath}`,
    `${downloadId}::model::${decodedPath}`,
  ]);
}

// ---------------------------------------------------------------------------
// TileJSON source matching
// ---------------------------------------------------------------------------

/**
 * Mapbox GL requests tilejson via `idb://{downloadId}/tilesjson/{path}` where
 * `{path}` may be the source id, the original TileJSON URL, or the URL we
 * stashed under `__originalTilesetUrl` when patching for offline. Try all
 * three; return the matching source id + its config, or null.
 */
export function matchTileJsonSource(
  sources: Record<string, unknown>,
  decodedPath: string
): { sourceId: string; config: Record<string, unknown> } | null {
  const asConfig = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : null;

  if (decodedPath in sources) {
    const config = asConfig(sources[decodedPath]);
    if (config) return { sourceId: decodedPath, config };
  }
  for (const [sourceId, raw] of Object.entries(sources)) {
    const config = asConfig(raw);
    if (!config) continue;
    const url = typeof config.url === 'string' ? config.url : undefined;
    const original =
      typeof config.__originalTilesetUrl === 'string'
        ? (config.__originalTilesetUrl as string)
        : undefined;
    if (url === decodedPath || original === decodedPath) {
      return { sourceId, config };
    }
  }
  return null;
}

/**
 * Build the offline TileJSON payload that replaces the one Mapbox would
 * have fetched from the network. `tiles` is rewritten to serve from the SW
 * (the caller supplies the scheme via `tileUrlScheme`); copyable TileJSON
 * fields are preserved.
 */
export function buildOfflineTileJson(
  sourceConfig: Record<string, unknown>,
  downloadId: string,
  sourceId: string,
  extension: string,
  tileUrlScheme: 'idb' | 'offline',
  origin?: string
): Record<string, unknown> {
  const base =
    tileUrlScheme === 'idb'
      ? `idb://${downloadId}/tile/${sourceId}/{z}/{x}/{y}.${extension}`
      : `${origin ?? ''}${OFFLINE_PREFIX}${downloadId}/tile/${sourceId}/{z}/{x}/{y}.${extension}`;

  const tileJson: Record<string, unknown> = {
    tilejson: typeof sourceConfig.tilejson === 'string' ? sourceConfig.tilejson : '2.2.0',
    name: (sourceConfig.name as string) ?? sourceId,
    tiles: [base],
    minzoom: typeof sourceConfig.minzoom === 'number' ? sourceConfig.minzoom : 0,
    maxzoom: typeof sourceConfig.maxzoom === 'number' ? sourceConfig.maxzoom : 22,
  };

  const copyable = [
    'bounds',
    'center',
    'vector_layers',
    'scheme',
    'attribution',
    'encoding',
    'format',
    'grids',
    'data',
    'template',
    'version',
  ] as const;
  for (const field of copyable) {
    if (field in sourceConfig && sourceConfig[field] !== undefined) {
      tileJson[field] = sourceConfig[field];
    }
  }
  return tileJson;
}

/** First-match extension derivation, same rule as `tileKey.extractTileExtensionFromUrl`. */
export function deriveTileExtensionFromTiles(tiles: unknown): string {
  if (Array.isArray(tiles) && tiles.length > 0 && typeof tiles[0] === 'string') {
    const match = (tiles[0] as string).match(/\.([\w]+)(?:[?#]|$)/i);
    if (match) return match[1];
  }
  return 'pbf';
}

// ---------------------------------------------------------------------------
// Gzip sniffing
// ---------------------------------------------------------------------------

/** RFC 1952 gzip magic bytes: 1f 8b. */
export function isGzipped(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 2) return false;
  const view = new Uint8Array(buffer, 0, 2);
  return view[0] === 0x1f && view[1] === 0x8b;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
