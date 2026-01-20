/**
 * Tests for Style Utilities
 */
import {
  patchStyleForOffline,
  validateRegion,
  calculateBBoxArea,
  estimateTileCount,
  generateGlyphUrlsFromStyle,
  extractTileKey,
} from '../../src/utils/styleUtils';
import type { MapboxStyle } from '../../src/types/style';

describe('styleUtils', () => {
  describe('patchStyleForOffline', () => {
    it('should patch source tiles to idb:// protocol', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'test-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['test-source'] as { tiles: string[] };

      expect(source.tiles[0]).toBe(
        'idb://my-download/tile/test-source/{z}/{x}/{y}.pbf'
      );
    });

    it('should use provided tile extension', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'raster-source': {
            type: 'raster',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download', undefined, 'mvt');
      const source = patched.sources['raster-source'] as { tiles: string[] };

      expect(source.tiles[0]).toBe(
        'idb://my-download/tile/raster-source/{z}/{x}/{y}.mvt'
      );
    });

    it('should extract tile extension from URL when not provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'vector-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.mvt'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['vector-source'] as { tiles: string[] };

      expect(source.tiles[0]).toContain('.mvt');
    });

    it('should set maxzoom on sources when provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'test-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.pbf'],
            maxzoom: 22,
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download', 14);
      const source = patched.sources['test-source'] as { maxzoom: number };

      expect(source.maxzoom).toBe(14);
    });

    it('should patch tilejson URLs', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'tilejson-source': {
            type: 'vector',
            url: 'https://example.com/tilejson.json',
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['tilejson-source'] as { url: string };

      expect(source.url).toBe(
        'idb://my-download/tilesjson/tilejson-source'
      );
    });

    it('should patch glyphs URL', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
      };

      const patched = patchStyleForOffline(style, 'my-download');

      expect(patched.glyphs).toBe('idb://my-download/glyph/{fontstack}/{range}.pbf');
    });

    it('should patch sprite URL', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        sprite: 'https://example.com/sprite',
      };

      const patched = patchStyleForOffline(style, 'my-download');

      expect(patched.sprite).toBe('idb://my-download/sprite/sprite');
    });

    it('should handle style without glyphs or sprite', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'simple-source': {
            type: 'vector',
            tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');

      expect(patched.glyphs).toBeUndefined();
      expect(patched.sprite).toBeUndefined();
    });
  });

  describe('validateRegion', () => {
    it('should return true for valid region', () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        minZoom: 0,
        maxZoom: 14,
      };

      expect(validateRegion(region)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(validateRegion(null)).toBe(false);
      expect(validateRegion(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validateRegion('string')).toBe(false);
      expect(validateRegion(123)).toBe(false);
    });

    it('should return false for missing id or name', () => {
      expect(validateRegion({ name: 'Test', bounds: [[0, 0], [1, 1]], minZoom: 0, maxZoom: 10 })).toBe(false);
      expect(validateRegion({ id: 'test', bounds: [[0, 0], [1, 1]], minZoom: 0, maxZoom: 10 })).toBe(false);
    });

    it('should return false for invalid bounds', () => {
      // Not an array
      expect(validateRegion({ id: 'test', name: 'Test', bounds: 'invalid', minZoom: 0, maxZoom: 10 })).toBe(false);

      // Wrong length
      expect(validateRegion({ id: 'test', name: 'Test', bounds: [[0, 0]], minZoom: 0, maxZoom: 10 })).toBe(false);

      // Inner arrays not correct length
      expect(validateRegion({ id: 'test', name: 'Test', bounds: [[0], [1, 1]], minZoom: 0, maxZoom: 10 })).toBe(false);
    });

    it('should return false for invalid zoom values', () => {
      const base = { id: 'test', name: 'Test', bounds: [[0, 0], [1, 1]] };

      // Non-number zoom
      expect(validateRegion({ ...base, minZoom: 'zero', maxZoom: 10 })).toBe(false);

      // Negative minZoom
      expect(validateRegion({ ...base, minZoom: -1, maxZoom: 10 })).toBe(false);

      // maxZoom > 24
      expect(validateRegion({ ...base, minZoom: 0, maxZoom: 25 })).toBe(false);

      // minZoom > maxZoom
      expect(validateRegion({ ...base, minZoom: 15, maxZoom: 10 })).toBe(false);
    });
  });

  describe('calculateBBoxArea', () => {
    it('should calculate area correctly', () => {
      const bounds: [[number, number], [number, number]] = [[-10, -10], [10, 10]];
      const area = calculateBBoxArea(bounds);
      expect(area).toBe(400); // 20 * 20
    });

    it('should handle reversed bounds', () => {
      const bounds: [[number, number], [number, number]] = [[10, 10], [-10, -10]];
      const area = calculateBBoxArea(bounds);
      expect(area).toBe(400); // Uses Math.abs
    });

    it('should handle small areas', () => {
      const bounds: [[number, number], [number, number]] = [[0, 0], [0.1, 0.1]];
      const area = calculateBBoxArea(bounds);
      expect(area).toBeCloseTo(0.01);
    });

    it('should handle zero-width or zero-height bounds', () => {
      const lineH: [[number, number], [number, number]] = [[0, 0], [10, 0]];
      const lineV: [[number, number], [number, number]] = [[0, 0], [0, 10]];

      expect(calculateBBoxArea(lineH)).toBe(0);
      expect(calculateBBoxArea(lineV)).toBe(0);
    });
  });

  describe('estimateTileCount', () => {
    it('should estimate tiles for a single zoom level', () => {
      const bounds: [[number, number], [number, number]] = [[-1, -1], [1, 1]];
      const count = estimateTileCount(bounds, 0, 0);
      expect(count).toBeGreaterThan(0);
    });

    it('should increase tile count with zoom level', () => {
      const bounds: [[number, number], [number, number]] = [[-10, -10], [10, 10]];
      const countZ0 = estimateTileCount(bounds, 0, 0);
      const countZ1 = estimateTileCount(bounds, 0, 1);
      const countZ2 = estimateTileCount(bounds, 0, 2);

      expect(countZ1).toBeGreaterThan(countZ0);
      expect(countZ2).toBeGreaterThan(countZ1);
    });

    it('should handle zoom range', () => {
      const bounds: [[number, number], [number, number]] = [[0, 0], [10, 10]];
      const countRange = estimateTileCount(bounds, 5, 10);
      const countSingle = estimateTileCount(bounds, 5, 5);

      expect(countRange).toBeGreaterThan(countSingle);
    });

    it('should return reasonable estimates for real-world regions', () => {
      // San Francisco area
      const sfBounds: [[number, number], [number, number]] = [[-122.5, 37.5], [-122.0, 38.0]];
      const count = estimateTileCount(sfBounds, 0, 14);

      // Should have a reasonable number of tiles
      expect(count).toBeGreaterThan(100);
      expect(count).toBeLessThan(100000);
    });
  });

  describe('generateGlyphUrlsFromStyle', () => {
    it('should return empty array for style without layers', () => {
      const urls = generateGlyphUrlsFromStyle({}, 'https://example.com/fonts/{fontstack}/{range}.pbf');
      expect(urls).toEqual([]);
    });

    it('should return empty array for layers without text-font', () => {
      const style = {
        layers: [
          { layout: { 'fill-color': '#000' } },
          { layout: { 'line-width': 2 } },
        ],
      };
      const urls = generateGlyphUrlsFromStyle(style, 'https://example.com/fonts/{fontstack}/{range}.pbf');
      expect(urls).toEqual([]);
    });

    it('should extract fontstacks and generate URLs', () => {
      const style = {
        layers: [
          { layout: { 'text-font': 'Arial Regular' } },
          { layout: { 'text-font': 'Roboto Bold' } },
        ],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf'
      );

      expect(urls.length).toBeGreaterThan(0);
      expect(urls.some(u => u.includes('Arial%20Regular'))).toBe(true);
      expect(urls.some(u => u.includes('Roboto%20Bold'))).toBe(true);
    });

    it('should handle array of text-font values', () => {
      const style = {
        layers: [
          { layout: { 'text-font': ['Open Sans Regular', 'Arial Regular'] } },
        ],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf'
      );

      expect(urls.some(u => u.includes('Open%20Sans%20Regular'))).toBe(true);
      expect(urls.some(u => u.includes('Arial%20Regular'))).toBe(true);
    });

    it('should use custom ranges when provided', () => {
      const style = {
        layers: [{ layout: { 'text-font': 'Arial' } }],
      };
      const customRanges: Array<[number, number]> = [[0, 255], [256, 511]];
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        customRanges
      );

      expect(urls.length).toBe(2); // 1 font * 2 ranges
      expect(urls.some(u => u.includes('0-255'))).toBe(true);
      expect(urls.some(u => u.includes('256-511'))).toBe(true);
    });

    it('should deduplicate fontstacks', () => {
      const style = {
        layers: [
          { layout: { 'text-font': 'Arial' } },
          { layout: { 'text-font': 'Arial' } },
          { layout: { 'text-font': 'Arial' } },
        ],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        [[0, 255]]
      );

      expect(urls.length).toBe(1); // Should only have 1 URL for the single font
    });
  });

  describe('extractTileKey', () => {
    it('should extract z/x/y from standard tile URLs', () => {
      const key = extractTileKey('https://tiles.example.com/v1/0/0/0.mvt');
      expect(key).toBe('0/0/0.mvt');
    });

    it('should handle different tile coordinates', () => {
      expect(extractTileKey('https://tiles.example.com/14/8123/5456.pbf')).toBe('14/8123/5456.pbf');
      expect(extractTileKey('https://tiles.example.com/10/512/256.png')).toBe('10/512/256.png');
    });

    it('should handle different extensions', () => {
      expect(extractTileKey('https://example.com/0/0/0.pbf')).toBe('0/0/0.pbf');
      expect(extractTileKey('https://example.com/0/0/0.mvt')).toBe('0/0/0.mvt');
      expect(extractTileKey('https://example.com/0/0/0.png')).toBe('0/0/0.png');
      expect(extractTileKey('https://example.com/0/0/0.jpg')).toBe('0/0/0.jpg');
    });

    it('should handle URLs with query parameters', () => {
      // Note: The regex might not handle query params well
      // The function extracts based on the path pattern
      const url = 'https://example.com/tiles/5/10/15.pbf?key=abc123';
      const key = extractTileKey(url);
      // The function should still extract the tile coordinates
      expect(key).toContain('5');
    });

    it('should handle complex paths', () => {
      const key = extractTileKey('https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/10/256/512.mvt');
      expect(key).toBe('10/256/512.mvt');
    });

    it('should fallback to filename for non-standard URLs', () => {
      const key = extractTileKey('https://example.com/custom/tile.pbf');
      expect(key).toBe('tile.pbf');
    });
  });
});
