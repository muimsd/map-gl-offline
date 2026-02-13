import { convertStyleForServiceWorker } from '../../src/utils/convertStyleForSW';
import type { MapboxStyle } from '../../src/types/style';

// jsdom provides window.location.origin as 'http://localhost'
const ORIGIN = window.location.origin;

function makeStyle(overrides: Partial<MapboxStyle> = {}): MapboxStyle {
  return {
    version: 8,
    sources: {},
    layers: [],
    ...overrides,
  };
}

describe('convertStyleForServiceWorker', () => {
  describe('tile source URLs', () => {
    it('should convert idb:// tile URLs to /__offline__/ format', () => {
      const style = makeStyle({
        sources: {
          openmaptiles: {
            type: 'vector',
            tiles: ['idb://tiles/{z}/{x}/{y}.pbf'],
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['openmaptiles'] as { tiles: string[] };

      expect(source.tiles).toEqual([`${ORIGIN}/__offline__/tiles/{z}/{x}/{y}.pbf`]);
    });

    it('should convert multiple tile URLs in a single source', () => {
      const style = makeStyle({
        sources: {
          raster: {
            type: 'raster',
            tiles: [
              'idb://tiles/a/{z}/{x}/{y}.png',
              'idb://tiles/b/{z}/{x}/{y}.png',
            ],
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['raster'] as { tiles: string[] };

      expect(source.tiles).toEqual([
        `${ORIGIN}/__offline__/tiles/a/{z}/{x}/{y}.png`,
        `${ORIGIN}/__offline__/tiles/b/{z}/{x}/{y}.png`,
      ]);
    });

    it('should convert tile URLs across multiple sources', () => {
      const style = makeStyle({
        sources: {
          vector: {
            type: 'vector',
            tiles: ['idb://vector/{z}/{x}/{y}.pbf'],
          },
          raster: {
            type: 'raster',
            tiles: ['idb://raster/{z}/{x}/{y}.png'],
          },
        },
      });

      const result = convertStyleForServiceWorker(style);

      expect((result.sources['vector'] as { tiles: string[] }).tiles).toEqual([
        `${ORIGIN}/__offline__/vector/{z}/{x}/{y}.pbf`,
      ]);
      expect((result.sources['raster'] as { tiles: string[] }).tiles).toEqual([
        `${ORIGIN}/__offline__/raster/{z}/{x}/{y}.png`,
      ]);
    });
  });

  describe('source.url (TileJSON URL)', () => {
    it('should convert idb:// source.url to /__offline__/ format', () => {
      const style = makeStyle({
        sources: {
          openmaptiles: {
            type: 'vector',
            url: 'idb://tilejson/openmaptiles.json',
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['openmaptiles'] as { url: string };

      expect(source.url).toBe(`${ORIGIN}/__offline__/tilejson/openmaptiles.json`);
    });

    it('should not convert non-idb:// source.url', () => {
      const style = makeStyle({
        sources: {
          remote: {
            type: 'vector',
            url: 'https://example.com/tilejson.json',
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['remote'] as { url: string };

      expect(source.url).toBe('https://example.com/tilejson.json');
    });
  });

  describe('glyphs URL', () => {
    it('should convert idb:// glyphs URL', () => {
      const style = makeStyle({
        glyphs: 'idb://fonts/{fontstack}/{range}.pbf',
      });

      const result = convertStyleForServiceWorker(style);

      expect(result.glyphs).toBe(`${ORIGIN}/__offline__/fonts/{fontstack}/{range}.pbf`);
    });

    it('should not convert non-idb:// glyphs URL', () => {
      const style = makeStyle({
        glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf',
      });

      const result = convertStyleForServiceWorker(style);

      expect(result.glyphs).toBe('https://fonts.example.com/{fontstack}/{range}.pbf');
    });
  });

  describe('sprite URL (string format)', () => {
    it('should convert idb:// sprite string URL', () => {
      const style = makeStyle({
        sprite: 'idb://sprites/default',
      });

      const result = convertStyleForServiceWorker(style);

      expect(result.sprite).toBe(`${ORIGIN}/__offline__/sprites/default`);
    });

    it('should not convert non-idb:// sprite string URL', () => {
      const style = makeStyle({
        sprite: 'https://sprites.example.com/default',
      });

      const result = convertStyleForServiceWorker(style);

      expect(result.sprite).toBe('https://sprites.example.com/default');
    });
  });

  describe('sprite URL (array format - Mapbox v3)', () => {
    it('should convert idb:// sprite entries in array format', () => {
      const style = makeStyle({
        sprite: [
          { id: 'default', url: 'idb://sprites/default' },
          { id: 'custom', url: 'idb://sprites/custom' },
        ] as unknown as string,
      });

      const result = convertStyleForServiceWorker(style);
      const sprites = result.sprite as unknown as Array<{ id: string; url: string }>;

      expect(sprites).toEqual([
        { id: 'default', url: `${ORIGIN}/__offline__/sprites/default` },
        { id: 'custom', url: `${ORIGIN}/__offline__/sprites/custom` },
      ]);
    });

    it('should leave non-idb:// sprite entries in array format unchanged', () => {
      const style = makeStyle({
        sprite: [
          { id: 'default', url: 'https://sprites.example.com/default' },
          { id: 'offline', url: 'idb://sprites/offline' },
        ] as unknown as string,
      });

      const result = convertStyleForServiceWorker(style);
      const sprites = result.sprite as unknown as Array<{ id: string; url: string }>;

      expect(sprites).toEqual([
        { id: 'default', url: 'https://sprites.example.com/default' },
        { id: 'offline', url: `${ORIGIN}/__offline__/sprites/offline` },
      ]);
    });
  });

  describe('non-idb:// URLs left unchanged', () => {
    it('should leave https:// tile URLs unchanged', () => {
      const style = makeStyle({
        sources: {
          remote: {
            type: 'vector',
            tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
          },
        },
        glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf',
        sprite: 'https://sprites.example.com/sprite',
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['remote'] as { tiles: string[] };

      expect(source.tiles).toEqual(['https://tiles.example.com/{z}/{x}/{y}.pbf']);
      expect(result.glyphs).toBe('https://fonts.example.com/{fontstack}/{range}.pbf');
      expect(result.sprite).toBe('https://sprites.example.com/sprite');
    });

    it('should leave mixed idb:// and https:// tile URLs in same source correct', () => {
      const style = makeStyle({
        sources: {
          mixed: {
            type: 'vector',
            tiles: [
              'idb://tiles/{z}/{x}/{y}.pbf',
              'https://remote.example.com/{z}/{x}/{y}.pbf',
            ],
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['mixed'] as { tiles: string[] };

      expect(source.tiles).toEqual([
        `${ORIGIN}/__offline__/tiles/{z}/{x}/{y}.pbf`,
        'https://remote.example.com/{z}/{x}/{y}.pbf',
      ]);
    });
  });

  describe('missing/undefined fields', () => {
    it('should handle style with no sources', () => {
      const style = makeStyle();
      delete (style as Record<string, unknown>).sources;

      const result = convertStyleForServiceWorker(style);

      expect(result.sources).toBeUndefined();
    });

    it('should handle style with empty sources object', () => {
      const style = makeStyle({ sources: {} });

      const result = convertStyleForServiceWorker(style);

      expect(result.sources).toEqual({});
    });

    it('should handle style with no glyphs', () => {
      const style = makeStyle();

      const result = convertStyleForServiceWorker(style);

      expect(result.glyphs).toBeUndefined();
    });

    it('should handle style with no sprite', () => {
      const style = makeStyle();

      const result = convertStyleForServiceWorker(style);

      expect(result.sprite).toBeUndefined();
    });

    it('should handle source without tiles or url', () => {
      const style = makeStyle({
        sources: {
          geojson: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
      });

      const result = convertStyleForServiceWorker(style);
      const source = result.sources['geojson'] as Record<string, unknown>;

      expect(source.type).toBe('geojson');
      expect(source.tiles).toBeUndefined();
      expect(source.url).toBeUndefined();
    });
  });

  describe('deep clone (no mutation)', () => {
    it('should not mutate the original style object', () => {
      const style = makeStyle({
        sources: {
          openmaptiles: {
            type: 'vector',
            tiles: ['idb://tiles/{z}/{x}/{y}.pbf'],
          },
        },
        glyphs: 'idb://fonts/{fontstack}/{range}.pbf',
        sprite: 'idb://sprites/default',
      });

      const originalSources = JSON.stringify(style.sources);
      const originalGlyphs = style.glyphs;
      const originalSprite = style.sprite;

      convertStyleForServiceWorker(style);

      expect(JSON.stringify(style.sources)).toBe(originalSources);
      expect(style.glyphs).toBe(originalGlyphs);
      expect(style.sprite).toBe(originalSprite);
    });

    it('should return a new object reference', () => {
      const style = makeStyle();
      const result = convertStyleForServiceWorker(style);

      expect(result).not.toBe(style);
    });
  });

  describe('minimal and empty styles', () => {
    it('should handle a minimal style with only required fields', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
      };

      const result = convertStyleForServiceWorker(style);

      expect(result.version).toBe(8);
      expect(result.sources).toEqual({});
      expect(result.layers).toEqual([]);
    });

    it('should preserve extra style properties', () => {
      const style = makeStyle({
        name: 'Test Style',
        metadata: { 'mapbox:autocomposite': true },
      });

      const result = convertStyleForServiceWorker(style);

      expect(result.name).toBe('Test Style');
      expect(result.metadata).toEqual({ 'mapbox:autocomposite': true });
    });
  });
});
