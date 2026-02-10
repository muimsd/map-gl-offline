/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// IndexedDB Configuration
export const DB_NAME = 'offline-map-db';
export const DB_VERSION = 3;

// Store Names (regions are stored inside styles.regions[], not as a separate store)
export const STORE_NAMES = {
  TILES: 'tiles',
  STYLES: 'styles',
  SPRITES: 'sprites',
  GLYPHS: 'glyphs',
  FONTS: 'fonts',
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
  SUPPORTED_EXTENSIONS: ['pbf', 'mvt', 'png', 'jpg', 'jpeg', 'webp'] as const,
} as const;

// Glyph Configuration
export const GLYPH_CONFIG = {
  DEFAULT_URL: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  DEFAULT_RANGES: ['0-255'] as const,
  COMPREHENSIVE_RANGES: [
    '0-255', // Basic Latin + Latin-1 Supplement
    '256-511', // Latin Extended-A + Latin Extended-B
    '512-767', // IPA Extensions + Spacing Modifier Letters
    '768-1023', // Combining Diacritical Marks + Greek and Coptic
    '1024-1279', // Cyrillic + Cyrillic Supplement
    '1280-1535', // Armenian + Hebrew
    '1536-1791', // Arabic
    '1792-2047', // Syriac + Arabic Supplement + Thaana
    '2048-2303', // NKo + Samaritan + Mandaic
    '2304-2559', // Devanagari + Bengali
    '2560-2815', // Gurmukhi + Gujarati
    '2816-3071', // Oriya + Tamil
    '3072-3327', // Telugu + Kannada
    '3328-3583', // Malayalam + Sinhala
    '3584-3839', // Thai + Lao
    '3840-4095', // Tibetan + Myanmar
    '4096-4351', // Georgian + Hangul Jamo
    '4352-4607', // Ethiopic
    '4608-4863', // Cherokee + Canadian Aboriginal
    '11904-12031', // CJK Radicals Supplement
    '12032-12255', // Kangxi Radicals + CJK Symbols
    '12288-12543', // Hiragana + Katakana
    '12544-12799', // Bopomofo + Hangul Compatibility Jamo
    '19968-20223', // CJK Unified Ideographs (first block)
    '20224-20479', // CJK Unified Ideographs
    '40960-42127', // Yi Syllables + Yi Radicals
    '44032-55203', // Hangul Syllables (Korean)
    '63744-64255', // CJK Compatibility Ideographs
    '65280-65535', // Halfwidth and Fullwidth Forms
  ] as const,
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
