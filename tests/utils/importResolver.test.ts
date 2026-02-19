/**
 * Tests for Import Resolution (Mapbox Standard style support)
 */
import { hasImports, resolveImports } from '../../src/utils/importResolver';
import type { BaseStyle } from '../../src/types/style';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeStyle(overrides: Partial<BaseStyle> = {}): BaseStyle {
  return {
    version: 8,
    sources: { composite: { type: 'vector', url: 'https://example.com/tiles' } },
    layers: [{ id: 'land', type: 'fill', source: 'composite' }],
    glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://example.com/sprite',
    ...overrides,
  };
}

function mockFetchResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

describe('importResolver', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('hasImports', () => {
    it('should return true when style has non-empty imports array', () => {
      const style = {
        version: 8,
        imports: [{ id: 'basemap', url: 'mapbox://styles/mapbox/standard' }],
        sources: {},
        layers: [],
      };
      expect(hasImports(style)).toBe(true);
    });

    it('should return false when style has no imports', () => {
      expect(hasImports(makeStyle())).toBe(false);
    });

    it('should return false when imports is empty array', () => {
      expect(hasImports({ version: 8, imports: [], sources: {}, layers: [] })).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(hasImports(null)).toBe(false);
      expect(hasImports(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(hasImports('string')).toBe(false);
      expect(hasImports(42)).toBe(false);
    });
  });

  describe('resolveImports', () => {
    it('should resolve a single import and flatten sources/layers', async () => {
      const importedStyle = makeStyle({
        sources: {
          composite: { type: 'vector', url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json' },
        },
        layers: [
          { id: 'land', type: 'fill', source: 'composite' },
          { id: 'water', type: 'fill', source: 'composite' },
        ],
        sprite: 'https://api.mapbox.com/styles/v1/mapbox/standard/sprite',
        glyphs: 'https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf',
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'basemap', url: 'https://api.mapbox.com/styles/v1/mapbox/standard' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Sources should be prefixed
      expect(result.sources['basemap/composite']).toBeDefined();

      // Layers should be prefixed and source refs updated
      expect(result.layers).toHaveLength(2);
      expect((result.layers[0] as Record<string, unknown>).id).toBe('basemap/land');
      expect((result.layers[0] as Record<string, unknown>).source).toBe('basemap/composite');
      expect((result.layers[1] as Record<string, unknown>).id).toBe('basemap/water');

      // Sprite and glyphs should be inherited from import
      expect(result.sprite).toBe('https://api.mapbox.com/styles/v1/mapbox/standard/sprite');
      expect(result.glyphs).toBe('https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf');
    });

    it('should preserve outer sources/layers over imported ones', async () => {
      const importedStyle = makeStyle({
        sources: { imported: { type: 'vector' } },
        layers: [{ id: 'imported-layer', type: 'fill', source: 'imported' }],
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/imported.json' }],
        sources: { outer: { type: 'raster' } },
        layers: [{ id: 'outer-layer', type: 'line', source: 'outer' }],
        glyphs: 'https://example.com/my-fonts/{fontstack}/{range}.pbf',
      };

      const result = await resolveImports(style, 'test-token');

      // Outer source preserved
      expect(result.sources['outer']).toBeDefined();
      // Imported source prefixed
      expect(result.sources['base/imported']).toBeDefined();

      // Layers: imported first, outer on top
      expect(result.layers).toHaveLength(2);
      expect((result.layers[0] as Record<string, unknown>).id).toBe('base/imported-layer');
      expect((result.layers[1] as Record<string, unknown>).id).toBe('outer-layer');

      // Outer glyphs should win
      expect(result.glyphs).toBe('https://example.com/my-fonts/{fontstack}/{range}.pbf');
    });

    it('should resolve nested imports (2 levels)', async () => {
      const innerStyle = makeStyle({
        sources: { inner: { type: 'vector' } },
        layers: [{ id: 'inner-layer', type: 'fill', source: 'inner' }],
      });

      const middleStyle: BaseStyle = {
        version: 8,
        imports: [{ id: 'inner', url: 'https://example.com/inner.json' }],
        sources: { middle: { type: 'raster' } },
        layers: [{ id: 'middle-layer', type: 'line', source: 'middle' }],
      };

      // First fetch: middle style, second fetch: inner style
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(middleStyle))
        .mockResolvedValueOnce(mockFetchResponse(innerStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'mid', url: 'https://example.com/middle.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Inner sources get double-prefixed: mid/inner/inner
      expect(result.sources['mid/inner/inner']).toBeDefined();
      // Middle sources get prefixed: mid/middle
      expect(result.sources['mid/middle']).toBeDefined();

      // Should have layers from both levels
      expect(result.layers.length).toBeGreaterThanOrEqual(2);
    });

    it('should enforce max depth', async () => {
      // Create a chain of imports that exceeds max depth
      const createChainedStyle = (depth: number): BaseStyle => ({
        version: 8,
        imports:
          depth < 10
            ? [{ id: `level${depth}`, url: `https://example.com/level${depth}.json` }]
            : undefined,
        sources: { [`src${depth}`]: { type: 'vector' } },
        layers: [{ id: `layer${depth}`, type: 'fill', source: `src${depth}` }],
      });

      // Mock 6 levels of fetches (0-5, where 5 should be skipped)
      for (let i = 1; i <= 6; i++) {
        mockFetch.mockResolvedValueOnce(mockFetchResponse(createChainedStyle(i)));
      }

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'level0', url: 'https://example.com/level0.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Should have stopped at max depth (5) — not all 6 levels fetched
      // The exact number of fetches depends on the depth limit
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(5);
      expect(Object.keys(result.sources).length).toBeGreaterThan(0);
    });

    it('should detect circular imports', async () => {
      const circularStyle: BaseStyle = {
        version: 8,
        imports: [{ id: 'self', url: 'https://example.com/style-a.json' }],
        sources: { src: { type: 'vector' } },
        layers: [{ id: 'layer', type: 'fill', source: 'src' }],
      };

      mockFetch.mockResolvedValueOnce(mockFetchResponse(circularStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'a', url: 'https://example.com/style-a.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Should have resolved the first import but skipped the circular reference
      // Sources from the fetched style get prefixed with 'a/'
      expect(Object.keys(result.sources)).toContain('a/src');
      // Only one fetch should have happened (circular self-reference was skipped)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should prefix source IDs and update layer source refs', async () => {
      const importedStyle = makeStyle({
        sources: {
          composite: { type: 'vector' },
          satellite: { type: 'raster' },
        },
        layers: [
          { id: 'roads', type: 'line', source: 'composite' },
          { id: 'imagery', type: 'raster', source: 'satellite' },
        ],
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'basemap', url: 'https://example.com/standard.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Source IDs should be prefixed
      expect(result.sources['basemap/composite']).toBeDefined();
      expect(result.sources['basemap/satellite']).toBeDefined();

      // Layer source references should be updated
      const roads = result.layers[0] as Record<string, unknown>;
      expect(roads.source).toBe('basemap/composite');
      const imagery = result.layers[1] as Record<string, unknown>;
      expect(imagery.source).toBe('basemap/satellite');
    });

    it('should merge sprites when both outer and import have sprites (string + string)', async () => {
      const importedStyle = makeStyle({
        sprite: 'https://example.com/imported-sprite',
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/import.json' }],
        sources: {},
        layers: [],
        sprite: 'https://example.com/outer-sprite',
      };

      const result = await resolveImports(style, 'test-token');

      // Should be merged into array format
      expect(Array.isArray(result.sprite)).toBe(true);
      const sprites = result.sprite as unknown as Array<{ id: string; url: string }>;
      expect(sprites).toHaveLength(2);
      expect(sprites[0].url).toBe('https://example.com/imported-sprite');
      expect(sprites[1].url).toBe('https://example.com/outer-sprite');
    });

    it('should merge sprites when import has array format', async () => {
      const importedStyle = makeStyle({
        sprite: [
          { id: 'icons', url: 'https://example.com/icons' },
          { id: 'patterns', url: 'https://example.com/patterns' },
        ] as unknown as string,
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/import.json' }],
        sources: {},
        layers: [],
        sprite: 'https://example.com/outer-sprite',
      };

      const result = await resolveImports(style, 'test-token');

      expect(Array.isArray(result.sprite)).toBe(true);
      const sprites = result.sprite as unknown as Array<{ id: string; url: string }>;
      expect(sprites).toHaveLength(3);
      expect(sprites[0].id).toBe('icons');
      expect(sprites[1].id).toBe('patterns');
      expect(sprites[2].url).toBe('https://example.com/outer-sprite');
    });

    it('should use imported glyphs when outer has none', async () => {
      const importedStyle = makeStyle({
        glyphs: 'https://api.mapbox.com/fonts/v1/{fontstack}/{range}.pbf',
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/import.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      expect(result.glyphs).toBe('https://api.mapbox.com/fonts/v1/{fontstack}/{range}.pbf');
    });

    it('should prefer outer glyphs over imported ones', async () => {
      const importedStyle = makeStyle({
        glyphs: 'https://example.com/imported-fonts/{fontstack}/{range}.pbf',
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/import.json' }],
        sources: {},
        layers: [],
        glyphs: 'https://example.com/outer-fonts/{fontstack}/{range}.pbf',
      };

      const result = await resolveImports(style, 'test-token');

      expect(result.glyphs).toBe('https://example.com/outer-fonts/{fontstack}/{range}.pbf');
    });

    it('should handle failed import fetch gracefully (non-fatal)', async () => {
      // Reject for all retry attempts (initial + 1 retry = 2 calls)
      for (let i = 0; i < 2; i++) {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
      }

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'base', url: 'https://example.com/import.json' }],
        sources: { local: { type: 'vector' } },
        layers: [{ id: 'local-layer', type: 'fill', source: 'local' }],
      };

      // Should not throw — use maxRetries: 1 for fast failure
      const result = await resolveImports(style, 'test-token', {
        maxRetries: 1,
        timeoutMs: 5000,
      });

      // Original style data should be preserved
      expect(result.sources['local']).toBeDefined();
      expect(result.layers).toHaveLength(1);
    });

    it('should resolve mapbox:// import URLs', async () => {
      const importedStyle = makeStyle({
        sources: { composite: { type: 'vector' } },
        layers: [{ id: 'land', type: 'fill', source: 'composite' }],
      });

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'basemap', url: 'mapbox://styles/mapbox/standard' }],
        sources: {},
        layers: [],
      };

      await resolveImports(style, 'test-token');

      // Should have resolved the mapbox:// URL to HTTPS
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('api.mapbox.com');
      expect(fetchedUrl).toContain('access_token=test-token');
    });

    it('should use inline data when import has data property', async () => {
      const inlineStyle = makeStyle({
        sources: { inline: { type: 'vector' } },
        layers: [{ id: 'inline-layer', type: 'fill', source: 'inline' }],
      });

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'inline', url: 'https://example.com/never-fetched.json', data: inlineStyle }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      // Should not have fetched — data was inline
      expect(mockFetch).not.toHaveBeenCalled();

      // Should have resolved the inline data
      expect(result.sources['inline/inline']).toBeDefined();
      expect((result.layers[0] as Record<string, unknown>).id).toBe('inline/inline-layer');
    });

    it('should skip imports with no URL', async () => {
      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'bad', url: '' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(Object.keys(result.sources)).toHaveLength(0);
    });

    it('should return style unchanged when no imports', async () => {
      const style = makeStyle();
      const original = { ...style };

      const result = await resolveImports(style, 'test-token');

      expect(result.sources).toEqual(original.sources);
      expect(result.layers).toEqual(original.layers);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should resolve config expressions using schema defaults', async () => {
      const importedStyle: BaseStyle = {
        version: 8,
        schema: {
          showBuildings: { default: true, type: 'boolean' },
          lightPreset: { default: 'day', type: 'string' },
        },
        sources: { composite: { type: 'vector' } },
        layers: [
          {
            id: 'buildings',
            type: 'fill-extrusion',
            source: 'composite',
            layout: {
              visibility: ['case', ['config', 'showBuildings'], 'visible', 'none'],
            },
            paint: {
              'fill-extrusion-color': ['match', ['config', 'lightPreset'], 'night', '#222', '#fff'],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'basemap', url: 'https://example.com/standard.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      const buildingLayer = result.layers[0] as Record<string, unknown>;
      const layout = buildingLayer.layout as Record<string, unknown>;
      const paint = buildingLayer.paint as Record<string, unknown>;

      // ["case", true, "visible", "none"] should resolve to "visible"
      expect(layout.visibility).toBe('visible');
      // ["match", "day", "night", "#222", "#fff"] should resolve to fallback "#fff"
      expect(paint['fill-extrusion-color']).toBe('#fff');
    });

    it('should apply config overrides from import entry', async () => {
      const importedStyle: BaseStyle = {
        version: 8,
        schema: {
          showBuildings: { default: true, type: 'boolean' },
        },
        sources: { composite: { type: 'vector' } },
        layers: [
          {
            id: 'buildings',
            type: 'fill-extrusion',
            source: 'composite',
            layout: {
              visibility: ['case', ['config', 'showBuildings'], 'visible', 'none'],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{
          id: 'basemap',
          url: 'https://example.com/standard.json',
          config: { showBuildings: false }, // Override default
        }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      const buildingLayer = result.layers[0] as Record<string, unknown>;
      const layout = buildingLayer.layout as Record<string, unknown>;

      // Config override: showBuildings = false → visibility = "none"
      expect(layout.visibility).toBe('none');
    });

    it('should resolve nested config expressions in paint/layout properties', async () => {
      const importedStyle: BaseStyle = {
        version: 8,
        schema: {
          font: { default: 'DIN Pro', type: 'string' },
        },
        sources: { composite: { type: 'vector' } },
        layers: [
          {
            id: 'labels',
            type: 'symbol',
            source: 'composite',
            layout: {
              'text-font': ['literal', [['config', 'font']]],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce(mockFetchResponse(importedStyle));

      const style: BaseStyle = {
        version: 8,
        imports: [{ id: 'basemap', url: 'https://example.com/standard.json' }],
        sources: {},
        layers: [],
      };

      const result = await resolveImports(style, 'test-token');

      const labelLayer = result.layers[0] as Record<string, unknown>;
      const layout = labelLayer.layout as Record<string, unknown>;

      // The ["config", "font"] inside the literal should resolve to "DIN Pro"
      const textFont = layout['text-font'] as unknown[];
      expect(textFont[0]).toBe('literal');
      expect((textFont[1] as unknown[])[0]).toBe('DIN Pro');
    });
  });
});
