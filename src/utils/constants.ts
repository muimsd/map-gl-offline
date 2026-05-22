/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// IndexedDB Configuration
export const DB_NAME = 'offline-map-db';
export const DB_VERSION = 4;

// Store Names (regions are stored inside styles.regions[], not as a separate store)
export const STORE_NAMES = {
  TILES: 'tiles',
  STYLES: 'styles',
  SPRITES: 'sprites',
  GLYPHS: 'glyphs',
  FONTS: 'fonts',
  MODELS: 'models',
} as const;

// Download Configuration
export const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10,
  MAX_CONCURRENCY: 5,
  MAX_RETRIES: 3,
  TIMEOUT: 10000, // 10 seconds
  RETRY_DELAY: 1000, // 1 second
} as const;

// Tile Configuration
export const TILE_CONFIG = {
  MIN_ZOOM: 0,
  MAX_ZOOM: 24,
  DEFAULT_EXTENSION: 'pbf',
  SUPPORTED_EXTENSIONS: ['pbf', 'mvt', 'png', 'jpg', 'jpeg', 'webp', 'glb'] as const,
} as const;

// Glyph Configuration
//
// Glyph servers (MapTiler, Mapbox, OpenFreeMap, ...) serve glyphs in fixed
// 256-codepoint blocks aligned to a multiple of 256: every request must be
// `${k * 256}-${k * 256 + 255}`. Strict servers (e.g. MapTiler) reject any
// other range with HTTP 400 "Invalid glyph range"; lenient ones silently
// accept them, which is how malformed ranges went unnoticed. See issue #37.
export const GLYPH_BLOCK_SIZE = 256;
export const MAX_GLYPH_CODEPOINT = 65535;

/**
 * Expand an inclusive Unicode codepoint span into the aligned 256-codepoint
 * glyph blocks that cover it, formatted as `"start-end"` request ranges.
 * The span need not be block-aligned — it is snapped out to whole blocks.
 */
function glyphBlocksForSpan(start: number, end: number): string[] {
  const firstBlock = Math.floor(start / GLYPH_BLOCK_SIZE);
  const lastBlock = Math.floor(Math.min(end, MAX_GLYPH_CODEPOINT) / GLYPH_BLOCK_SIZE);
  const blocks: string[] = [];
  for (let block = firstBlock; block <= lastBlock; block++) {
    const blockStart = block * GLYPH_BLOCK_SIZE;
    blocks.push(`${blockStart}-${blockStart + GLYPH_BLOCK_SIZE - 1}`);
  }
  return blocks;
}

/**
 * Unicode codepoint spans the comprehensive glyph download aims to cover.
 * Each span is snapped to whole 256-codepoint glyph blocks below, so the
 * resulting request ranges are always server-valid regardless of where the
 * underlying Unicode blocks happen to start or end. To extend coverage, add
 * a span here — never hand-write raw `"start-end"` ranges.
 */
const GLYPH_COVERAGE_SPANS: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x12ff], // Latin, Greek, Cyrillic, Hebrew, Arabic, Indic, SE Asian, Georgian, Ethiopic, Cherokee
  [0x1e00, 0x21ff], // Latin Extended Additional, punctuation, symbols, arrows
  [0x2e00, 0x31ff], // CJK radicals, Hiragana, Katakana, Bopomofo, Hangul Compatibility Jamo
  [0x4e00, 0x4fff], // CJK Unified Ideographs (common subset)
  [0xa000, 0xa4ff], // Yi Syllables and Radicals
  [0xac00, 0xd7ff], // Hangul Syllables (Korean)
  [0xf900, 0xfbff], // CJK Compatibility Ideographs, Alphabetic Presentation Forms
  [0xfe00, 0xfeff], // Variation Selectors
  [0xff00, 0xffff], // Halfwidth and Fullwidth Forms
];

/** Build the deduped, codepoint-ascending list of comprehensive glyph ranges. */
function buildComprehensiveRanges(): string[] {
  const ranges = new Set<string>();
  for (const [start, end] of GLYPH_COVERAGE_SPANS) {
    for (const range of glyphBlocksForSpan(start, end)) {
      ranges.add(range);
    }
  }
  return Array.from(ranges).sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]));
}

export const GLYPH_CONFIG = {
  DEFAULT_URL: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  DEFAULT_RANGES: ['0-255'] as const,
  COMPREHENSIVE_RANGES: buildComprehensiveRanges(),
} as const;

// Style Configuration
export const STYLE_CONFIG = {
  OPENFREEMAP_BASE: 'https://tiles.openfreemap.org/styles',
  STYLES: {
    LIBERTY: 'https://tiles.openfreemap.org/styles/liberty',
    BRIGHT: 'https://tiles.openfreemap.org/styles/bright',
    POSITRON: 'https://tiles.openfreemap.org/styles/positron',
  },
} as const;

// Storage Configuration
export const STORAGE_CONFIG = {
  DEFAULT_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  MIN_AVAILABLE_SPACE: 500 * 1024 * 1024, // 500 MB
  WARNING_THRESHOLD: 0.9, // 90% usage warning
} as const;

// Content Types
export const CONTENT_TYPES = {
  VECTOR_TILE: 'application/vnd.mapbox-vector-tile',
  PROTOBUF: 'application/x-protobuf',
  JSON: 'application/json',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  GLB: 'model/gltf-binary',
} as const;

// URL Schemes
export const URL_SCHEMES = {
  IDB: 'idb://',
  HTTP: 'http://',
  HTTPS: 'https://',
} as const;

// Gzip Magic Numbers
export const GZIP_MAGIC_BYTES = {
  FIRST: 0x1f,
  SECOND: 0x8b,
} as const;

// Resource Types
export const RESOURCE_TYPES = {
  TILE: 'tile',
  GLYPH: 'glyph',
  SPRITE: 'sprite',
  FONT: 'font',
  STYLE: 'style',
  TILEJSON: 'tilesjson',
} as const;

// Mapbox Classic Style IDs
export const MAPBOX_CLASSIC_STYLES = [
  'streets-v12',
  'outdoors-v12',
  'light-v11',
  'dark-v11',
  'satellite-v9',
  'satellite-streets-v12',
  'navigation-day-v1',
  'navigation-night-v1',
  'standard',
] as const;

export type MapboxClassicStyle = (typeof MAPBOX_CLASSIC_STYLES)[number];

// Mapbox API Configuration
export const MAPBOX_API = {
  BASE_URL: 'https://api.mapbox.com',
  STYLES_PATH: '/styles/v1',
  FONTS_PATH: '/fonts/v1',
  TILES_PATH: '/v4',
  MODELS_PATH: '/models/v1',
  PROTOCOL: 'mapbox://',
} as const;

// Map Providers
export const MAP_PROVIDERS = {
  AUTO: 'auto',
  MAPBOX: 'mapbox',
  MAPLIBRE: 'maplibre',
  CARTO: 'carto',
  MAPTILER: 'maptiler',
} as const;

// Mapbox Cache TTL defaults (used when no Cache-Control header is present)
export const MAPBOX_CACHE_TTL = {
  VECTOR_TILES: 12 * 60 * 60 * 1000, // 12 hours
  RASTER_TILES: 12 * 60 * 60 * 1000, // 12 hours
  TILEJSON: 12 * 60 * 60 * 1000, // 12 hours
  STYLES: 15 * 60 * 1000, // 15 minutes
  FONTS: 7 * 24 * 60 * 60 * 1000, // 7 days
  SPRITES: 7 * 24 * 60 * 60 * 1000, // 7 days
  GLYPHS: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  TILE_URL: /\/(\d+)\/(\d+)\/(\d+)\.(\w+)(?:\?|$)/,
  STYLE_ID: /^[a-zA-Z0-9_-]+$/,
  REGION_ID: /^region_\d+$/,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NO_STYLE: 'Style must be downloaded before adding a region',
  NO_STYLE_ID: 'No style ID found for region',
  NO_STYLE_URL: 'Region must have a styleUrl',
  INVALID_BOUNDS: 'Invalid bounds specified',
  INVALID_ZOOM: 'Invalid zoom levels specified',
  INSUFFICIENT_STORAGE: 'Insufficient storage space for download',
  TILE_VALIDATION_FAILED: 'Tile validation failed',
  NETWORK_ERROR: 'Network error occurred during download',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TILES_DOWNLOADED: 'Tiles downloaded successfully',
  STYLE_DOWNLOADED: 'Style downloaded successfully',
  REGION_ADDED: 'Region added successfully',
  REGION_DELETED: 'Region deleted successfully',
  CLEANUP_COMPLETE: 'Cleanup completed successfully',
} as const;

// Type exports for const assertions
export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];
export type TileExtension = (typeof TILE_CONFIG.SUPPORTED_EXTENSIONS)[number];
export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];
export type MapProvider = (typeof MAP_PROVIDERS)[keyof typeof MAP_PROVIDERS];
