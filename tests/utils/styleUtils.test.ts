/**
 * Tests for Style Utilities
 */
import {
  patchStyleForOffline,
  generateGlyphUrlsFromStyle,
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

    it('should replace tilejson URL with tiles array for TileJSON-only sources', () => {
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
      const source = patched.sources['tilejson-source'] as {
        url?: string;
        tiles?: string[];
        __originalTilesetUrl?: string;
      };

      // url should be removed to prevent TileJSON fetch
      expect(source.url).toBeUndefined();
      // tiles array should be added for direct rendering
      expect(source.tiles).toEqual([
        'idb://my-download/tile/tilejson-source/{z}/{x}/{y}.pbf',
      ]);
      // original URL should be preserved
      expect(source.__originalTilesetUrl).toBe('https://example.com/tilejson.json');
    });

    it('should use provided tile extension for TileJSON-only sources', () => {
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

      const patched = patchStyleForOffline(style, 'my-download', undefined, 'mvt');
      const source = patched.sources['tilejson-source'] as { tiles?: string[] };

      expect(source.tiles).toEqual([
        'idb://my-download/tile/tilejson-source/{z}/{x}/{y}.mvt',
      ]);
    });

    it('should keep already-patched tiles for sources with both url and tiles', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'combo-source': {
            type: 'vector',
            url: 'https://example.com/tilejson.json',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['combo-source'] as {
        url?: string;
        tiles?: string[];
      };

      // url should be removed
      expect(source.url).toBeUndefined();
      // tiles should have been patched by the tiles block (not the url block)
      expect(source.tiles).toEqual([
        'idb://my-download/tile/combo-source/{z}/{x}/{y}.pbf',
      ]);
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
          { layout: { 'text-font': ['Arial Regular'] } },
          { layout: { 'text-font': ['Roboto Bold'] } },
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
        layers: [{ layout: { 'text-font': ['Arial'] } }],
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
          { layout: { 'text-font': ['Arial'] } },
          { layout: { 'text-font': ['Arial'] } },
          { layout: { 'text-font': ['Arial'] } },
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

});
