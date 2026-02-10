/**
 * Tests for constants utility
 * Ensures magic numbers and configuration values haven't drifted from expected values.
 */

import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  DOWNLOAD_DEFAULTS,
  TILE_CONFIG,
  GLYPH_CONFIG,
  STYLE_CONFIG,
  STORAGE_CONFIG,
  CONTENT_TYPES,
  URL_SCHEMES,
  GZIP_MAGIC_BYTES,
  RESOURCE_TYPES,
  MAPBOX_CLASSIC_STYLES,
  MAPBOX_API,
  MAP_PROVIDERS,
  VALIDATION_PATTERNS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../../src/utils/constants';

describe('constants', () => {
  describe('IndexedDB Configuration', () => {
    it('should have the correct DB name', () => {
      expect(DB_NAME).toBe('offline-map-db');
    });

    it('should have DB_VERSION set to 3', () => {
      expect(DB_VERSION).toBe(3);
    });
  });

  describe('STORE_NAMES', () => {
    it('should define the tiles store', () => {
      expect(STORE_NAMES.TILES).toBe('tiles');
    });

    it('should define the styles store', () => {
      expect(STORE_NAMES.STYLES).toBe('styles');
    });

    it('should define the sprites store', () => {
      expect(STORE_NAMES.SPRITES).toBe('sprites');
    });

    it('should define the glyphs store', () => {
      expect(STORE_NAMES.GLYPHS).toBe('glyphs');
    });

    it('should define the fonts store', () => {
      expect(STORE_NAMES.FONTS).toBe('fonts');
    });

    it('should have exactly 5 stores', () => {
      expect(Object.keys(STORE_NAMES)).toHaveLength(5);
    });
  });

  describe('DOWNLOAD_DEFAULTS', () => {
    it('should have BATCH_SIZE of 10', () => {
      expect(DOWNLOAD_DEFAULTS.BATCH_SIZE).toBe(10);
    });

    it('should have MAX_CONCURRENCY of 5', () => {
      expect(DOWNLOAD_DEFAULTS.MAX_CONCURRENCY).toBe(5);
    });

    it('should have MAX_RETRIES of 3', () => {
      expect(DOWNLOAD_DEFAULTS.MAX_RETRIES).toBe(3);
    });

    it('should have TIMEOUT of 10000ms', () => {
      expect(DOWNLOAD_DEFAULTS.TIMEOUT).toBe(10000);
    });

    it('should have RETRY_DELAY of 1000ms', () => {
      expect(DOWNLOAD_DEFAULTS.RETRY_DELAY).toBe(1000);
    });
  });

  describe('TILE_CONFIG', () => {
    it('should have MIN_ZOOM of 0', () => {
      expect(TILE_CONFIG.MIN_ZOOM).toBe(0);
    });

    it('should have MAX_ZOOM of 24', () => {
      expect(TILE_CONFIG.MAX_ZOOM).toBe(24);
    });

    it('should have DEFAULT_EXTENSION of pbf', () => {
      expect(TILE_CONFIG.DEFAULT_EXTENSION).toBe('pbf');
    });

    it('should support the expected tile extensions', () => {
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('pbf');
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('mvt');
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('png');
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('jpg');
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('jpeg');
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toContain('webp');
    });

    it('should have exactly 6 supported extensions', () => {
      expect(TILE_CONFIG.SUPPORTED_EXTENSIONS).toHaveLength(6);
    });
  });

  describe('GLYPH_CONFIG', () => {
    it('should have a valid DEFAULT_URL with placeholders', () => {
      expect(GLYPH_CONFIG.DEFAULT_URL).toContain('{fontstack}');
      expect(GLYPH_CONFIG.DEFAULT_URL).toContain('{range}');
    });

    it('should have DEFAULT_RANGES with 0-255', () => {
      expect(GLYPH_CONFIG.DEFAULT_RANGES).toContain('0-255');
    });

    it('should have COMPREHENSIVE_RANGES starting with 0-255', () => {
      expect(GLYPH_CONFIG.COMPREHENSIVE_RANGES[0]).toBe('0-255');
    });

    it('should have multiple comprehensive ranges', () => {
      expect(GLYPH_CONFIG.COMPREHENSIVE_RANGES.length).toBeGreaterThan(10);
    });

    it('should include CJK range in comprehensive ranges', () => {
      expect(GLYPH_CONFIG.COMPREHENSIVE_RANGES).toContain('19968-20223');
    });

    it('should include Arabic range in comprehensive ranges', () => {
      expect(GLYPH_CONFIG.COMPREHENSIVE_RANGES).toContain('1536-1791');
    });
  });

  describe('STYLE_CONFIG', () => {
    it('should have the correct OpenFreeMap base URL', () => {
      expect(STYLE_CONFIG.OPENFREEMAP_BASE).toBe('https://tiles.openfreemap.org/styles');
    });

    it('should define LIBERTY style URL', () => {
      expect(STYLE_CONFIG.STYLES.LIBERTY).toBe('https://tiles.openfreemap.org/styles/liberty');
    });

    it('should define BRIGHT style URL', () => {
      expect(STYLE_CONFIG.STYLES.BRIGHT).toBe('https://tiles.openfreemap.org/styles/bright');
    });

    it('should define POSITRON style URL', () => {
      expect(STYLE_CONFIG.STYLES.POSITRON).toBe('https://tiles.openfreemap.org/styles/positron');
    });
  });

  describe('STORAGE_CONFIG', () => {
    it('should have DEFAULT_EXPIRY of 30 days in milliseconds', () => {
      expect(STORAGE_CONFIG.DEFAULT_EXPIRY).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should have MIN_AVAILABLE_SPACE of 500 MB', () => {
      expect(STORAGE_CONFIG.MIN_AVAILABLE_SPACE).toBe(500 * 1024 * 1024);
    });

    it('should have WARNING_THRESHOLD at 90%', () => {
      expect(STORAGE_CONFIG.WARNING_THRESHOLD).toBe(0.9);
    });
  });

  describe('CONTENT_TYPES', () => {
    it('should define VECTOR_TILE content type', () => {
      expect(CONTENT_TYPES.VECTOR_TILE).toBe('application/vnd.mapbox-vector-tile');
    });

    it('should define PROTOBUF content type', () => {
      expect(CONTENT_TYPES.PROTOBUF).toBe('application/x-protobuf');
    });

    it('should define JSON content type', () => {
      expect(CONTENT_TYPES.JSON).toBe('application/json');
    });

    it('should define PNG content type', () => {
      expect(CONTENT_TYPES.PNG).toBe('image/png');
    });

    it('should define JPEG content type', () => {
      expect(CONTENT_TYPES.JPEG).toBe('image/jpeg');
    });

    it('should define WEBP content type', () => {
      expect(CONTENT_TYPES.WEBP).toBe('image/webp');
    });
  });

  describe('URL_SCHEMES', () => {
    it('should define IDB scheme', () => {
      expect(URL_SCHEMES.IDB).toBe('idb://');
    });

    it('should define HTTP scheme', () => {
      expect(URL_SCHEMES.HTTP).toBe('http://');
    });

    it('should define HTTPS scheme', () => {
      expect(URL_SCHEMES.HTTPS).toBe('https://');
    });
  });

  describe('GZIP_MAGIC_BYTES', () => {
    it('should have FIRST byte as 0x1f', () => {
      expect(GZIP_MAGIC_BYTES.FIRST).toBe(0x1f);
    });

    it('should have SECOND byte as 0x8b', () => {
      expect(GZIP_MAGIC_BYTES.SECOND).toBe(0x8b);
    });
  });

  describe('RESOURCE_TYPES', () => {
    it('should define TILE resource type', () => {
      expect(RESOURCE_TYPES.TILE).toBe('tile');
    });

    it('should define GLYPH resource type', () => {
      expect(RESOURCE_TYPES.GLYPH).toBe('glyph');
    });

    it('should define SPRITE resource type', () => {
      expect(RESOURCE_TYPES.SPRITE).toBe('sprite');
    });

    it('should define FONT resource type', () => {
      expect(RESOURCE_TYPES.FONT).toBe('font');
    });

    it('should define STYLE resource type', () => {
      expect(RESOURCE_TYPES.STYLE).toBe('style');
    });

    it('should define TILEJSON resource type', () => {
      expect(RESOURCE_TYPES.TILEJSON).toBe('tilesjson');
    });
  });

  describe('MAPBOX_CLASSIC_STYLES', () => {
    it('should include streets-v12', () => {
      expect(MAPBOX_CLASSIC_STYLES).toContain('streets-v12');
    });

    it('should include satellite-v9', () => {
      expect(MAPBOX_CLASSIC_STYLES).toContain('satellite-v9');
    });

    it('should include standard', () => {
      expect(MAPBOX_CLASSIC_STYLES).toContain('standard');
    });

    it('should have 9 classic styles', () => {
      expect(MAPBOX_CLASSIC_STYLES).toHaveLength(9);
    });
  });

  describe('MAPBOX_API', () => {
    it('should have the correct BASE_URL', () => {
      expect(MAPBOX_API.BASE_URL).toBe('https://api.mapbox.com');
    });

    it('should have the correct STYLES_PATH', () => {
      expect(MAPBOX_API.STYLES_PATH).toBe('/styles/v1');
    });

    it('should have the correct FONTS_PATH', () => {
      expect(MAPBOX_API.FONTS_PATH).toBe('/fonts/v1');
    });

    it('should have the correct TILES_PATH', () => {
      expect(MAPBOX_API.TILES_PATH).toBe('/v4');
    });

    it('should have the correct PROTOCOL', () => {
      expect(MAPBOX_API.PROTOCOL).toBe('mapbox://');
    });
  });

  describe('MAP_PROVIDERS', () => {
    it('should define AUTO provider', () => {
      expect(MAP_PROVIDERS.AUTO).toBe('auto');
    });

    it('should define MAPBOX provider', () => {
      expect(MAP_PROVIDERS.MAPBOX).toBe('mapbox');
    });

    it('should define MAPLIBRE provider', () => {
      expect(MAP_PROVIDERS.MAPLIBRE).toBe('maplibre');
    });

    it('should define CARTO provider', () => {
      expect(MAP_PROVIDERS.CARTO).toBe('carto');
    });

    it('should define MAPTILER provider', () => {
      expect(MAP_PROVIDERS.MAPTILER).toBe('maptiler');
    });
  });

  describe('VALIDATION_PATTERNS', () => {
    it('should match valid tile URLs', () => {
      expect(VALIDATION_PATTERNS.TILE_URL.test('/10/512/341.pbf')).toBe(true);
      expect(VALIDATION_PATTERNS.TILE_URL.test('/0/0/0.png')).toBe(true);
      expect(VALIDATION_PATTERNS.TILE_URL.test('/14/8192/5461.mvt?access_token=abc')).toBe(true);
    });

    it('should match valid style IDs', () => {
      expect(VALIDATION_PATTERNS.STYLE_ID.test('my-style_01')).toBe(true);
      expect(VALIDATION_PATTERNS.STYLE_ID.test('ABC123')).toBe(true);
    });

    it('should reject invalid style IDs', () => {
      expect(VALIDATION_PATTERNS.STYLE_ID.test('has spaces')).toBe(false);
      expect(VALIDATION_PATTERNS.STYLE_ID.test('has/slash')).toBe(false);
    });

    it('should match valid region IDs', () => {
      expect(VALIDATION_PATTERNS.REGION_ID.test('region_123')).toBe(true);
      expect(VALIDATION_PATTERNS.REGION_ID.test('region_0')).toBe(true);
    });

    it('should reject invalid region IDs', () => {
      expect(VALIDATION_PATTERNS.REGION_ID.test('region_abc')).toBe(false);
      expect(VALIDATION_PATTERNS.REGION_ID.test('notregion_1')).toBe(false);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should define all expected error messages', () => {
      expect(ERROR_MESSAGES.NO_STYLE).toBeDefined();
      expect(ERROR_MESSAGES.NO_STYLE_ID).toBeDefined();
      expect(ERROR_MESSAGES.NO_STYLE_URL).toBeDefined();
      expect(ERROR_MESSAGES.INVALID_BOUNDS).toBeDefined();
      expect(ERROR_MESSAGES.INVALID_ZOOM).toBeDefined();
      expect(ERROR_MESSAGES.INSUFFICIENT_STORAGE).toBeDefined();
      expect(ERROR_MESSAGES.TILE_VALIDATION_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.NETWORK_ERROR).toBeDefined();
    });

    it('should have string values for all messages', () => {
      for (const value of Object.values(ERROR_MESSAGES)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('SUCCESS_MESSAGES', () => {
    it('should define all expected success messages', () => {
      expect(SUCCESS_MESSAGES.TILES_DOWNLOADED).toBeDefined();
      expect(SUCCESS_MESSAGES.STYLE_DOWNLOADED).toBeDefined();
      expect(SUCCESS_MESSAGES.REGION_ADDED).toBeDefined();
      expect(SUCCESS_MESSAGES.REGION_DELETED).toBeDefined();
      expect(SUCCESS_MESSAGES.CLEANUP_COMPLETE).toBeDefined();
    });

    it('should have string values for all messages', () => {
      for (const value of Object.values(SUCCESS_MESSAGES)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });
});
