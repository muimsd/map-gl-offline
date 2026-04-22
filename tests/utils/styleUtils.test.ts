/**
 * Tests for Style Utilities
 */
import {
  patchStyleForOffline,
  generateGlyphUrlsFromStyle,
  extractFontNamesFromTextField,
  extractAllFontNames,
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

    it('should cap maxzoom to the lower of region maxZoom and source maxzoom', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'buildings-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.pbf'],
            maxzoom: 14,
          },
        },
        layers: [],
      };

      // Region maxZoom (16) is higher than source maxzoom (14) — should keep 14
      const patched = patchStyleForOffline(style, 'my-download', 16);
      const source = patched.sources['buildings-source'] as { maxzoom: number };

      expect(source.maxzoom).toBe(14);
    });

    it('should use region maxZoom when source has no original maxzoom', () => {
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

      const patched = patchStyleForOffline(style, 'my-download', 12);
      const source = patched.sources['test-source'] as { maxzoom: number };

      expect(source.maxzoom).toBe(12);
    });

    it('should cap each source independently based on its own maxzoom', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'streets': {
            type: 'vector',
            tiles: ['https://example.com/streets/{z}/{x}/{y}.pbf'],
            maxzoom: 22,
          },
          'buildings': {
            type: 'vector',
            tiles: ['https://example.com/buildings/{z}/{x}/{y}.pbf'],
            maxzoom: 14,
          },
          'terrain': {
            type: 'raster',
            tiles: ['https://example.com/terrain/{z}/{x}/{y}.png'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download', 16);

      expect((patched.sources['streets'] as { maxzoom: number }).maxzoom).toBe(16);
      expect((patched.sources['buildings'] as { maxzoom: number }).maxzoom).toBe(14);
      expect((patched.sources['terrain'] as { maxzoom: number }).maxzoom).toBe(16);
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

    it('should use styleId for sprite URL when provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        sprite: 'https://example.com/sprite',
      };

      const patched = patchStyleForOffline(style, 'region-1', undefined, undefined, 'shared-style-id');

      expect(patched.sprite).toBe('idb://shared-style-id/sprite/sprite');
    });

    it('should fall back to downloadId for sprite when styleId is not provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        sprite: 'https://example.com/sprite',
      };

      const patched = patchStyleForOffline(style, 'region-1');

      expect(patched.sprite).toBe('idb://region-1/sprite/sprite');
    });

    it('patches string-valued models to idb:// URLs (Mapbox Standard shape)', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        models: {
          'maple1-lod1': 'mapbox://models/mapbox/maple1-v4-lod1.glb',
          'oak1-lod2': 'mapbox://models/mapbox/oak1-v4-lod2.glb',
        },
      };
      const patched = patchStyleForOffline(style, 'region-1', undefined, undefined, 'style-xyz');
      expect(patched.models?.['maple1-lod1']).toBe('idb://style-xyz/model/maple1-lod1');
      expect(patched.models?.['oak1-lod2']).toBe('idb://style-xyz/model/oak1-lod2');
    });

    it('patches object-valued models (older/generic {uri} shape)', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        models: {
          'some-model': { uri: 'https://example.com/some.glb', extra: 'kept' },
        },
      };
      const patched = patchStyleForOffline(style, 'region-1', undefined, undefined, 'style-xyz');
      const m = patched.models?.['some-model'] as { uri: string; extra: string };
      expect(m.uri).toBe('idb://style-xyz/model/some-model');
      expect(m.extra).toBe('kept'); // non-uri props preserved
    });

    it('keys models off downloadId when styleId is not provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        models: { 'tree-lod1': 'mapbox://models/mapbox/oak1-v4-lod1.glb' },
      };
      const patched = patchStyleForOffline(style, 'region-abc');
      expect(patched.models?.['tree-lod1']).toBe('idb://region-abc/model/tree-lod1');
    });

    it('should default to pbf when tile URL has no recognizable extension', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'no-ext-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['no-ext-source'] as { tiles: string[] };

      expect(source.tiles[0]).toBe(
        'idb://my-download/tile/no-ext-source/{z}/{x}/{y}.pbf'
      );
    });

    it('should handle style with empty sources object', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
      };

      const patched = patchStyleForOffline(style, 'my-download');

      expect(Object.keys(patched.sources)).toHaveLength(0);
      expect(patched.glyphs).toBe('idb://my-download/glyph/{fontstack}/{range}.pbf');
    });

    it('should patch multiple tiles within a single source', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'multi-tile-source': {
            type: 'vector',
            tiles: [
              'https://a.example.com/tiles/{z}/{x}/{y}.pbf',
              'https://b.example.com/tiles/{z}/{x}/{y}.pbf',
            ],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['multi-tile-source'] as { tiles: string[] };

      expect(source.tiles).toHaveLength(2);
      expect(source.tiles[0]).toBe('idb://my-download/tile/multi-tile-source/{z}/{x}/{y}.pbf');
      expect(source.tiles[1]).toBe('idb://my-download/tile/multi-tile-source/{z}/{x}/{y}.pbf');
    });

    it('should not set maxzoom when not provided', () => {
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

      const patched = patchStyleForOffline(style, 'my-download');
      const source = patched.sources['test-source'] as { maxzoom: number };

      expect(source.maxzoom).toBe(22);
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

    it('should encode fontstack names in URLs', () => {
      const style = {
        layers: [{ layout: { 'text-font': ['Open Sans Bold'] } }],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        [[0, 255]]
      );

      expect(urls.length).toBe(1);
      expect(urls[0]).toBe('https://example.com/fonts/Open%20Sans%20Bold/0-255.pbf');
    });

    it('should generate correct count for multiple fonts and ranges', () => {
      const style = {
        layers: [
          { layout: { 'text-font': ['Font A'] } },
          { layout: { 'text-font': ['Font B'] } },
          { layout: { 'text-font': ['Font C'] } },
        ],
      };
      const ranges: Array<[number, number]> = [[0, 255], [256, 511], [512, 767]];
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        ranges
      );

      // 3 fonts * 3 ranges = 9 URLs
      expect(urls.length).toBe(9);
    });

    it('should handle expression-based text-font in layers', () => {
      const style = {
        layers: [
          {
            layout: {
              'text-font': [
                'step',
                ['zoom'],
                ['literal', ['Small Zoom Font']],
                14,
                ['literal', ['Large Zoom Font']],
              ],
            },
          },
        ],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        [[0, 255]]
      );

      // 'zoom' from ['zoom'] is also extracted as a font name (known limitation of expression parsing)
      expect(urls.length).toBe(3);
      expect(urls.some(u => u.includes('Small%20Zoom%20Font'))).toBe(true);
      expect(urls.some(u => u.includes('Large%20Zoom%20Font'))).toBe(true);
    });

    it('should include the 3 new Unicode ranges in default ranges (16 total)', () => {
      const style = {
        layers: [{ layout: { 'text-font': ['TestFont'] } }],
      };
      const urls = generateGlyphUrlsFromStyle(
        style,
        'https://example.com/fonts/{fontstack}/{range}.pbf'
      );

      // 1 font * 16 default ranges = 16 URLs
      expect(urls.length).toBe(16);

      // Verify the 3 new ranges are present
      expect(urls.some(u => u.includes('7680-7935'))).toBe(true); // Latin Extended Additional
      expect(urls.some(u => u.includes('64256-64511'))).toBe(true); // Alphabetic Presentation Forms
      expect(urls.some(u => u.includes('65024-65279'))).toBe(true); // Variation Selectors
    });
  });

  describe('extractFontNamesFromTextField', () => {
    it('should extract fonts from a simple font array', () => {
      expect(extractFontNamesFromTextField(['Arial Regular'])).toEqual(['Arial Regular']);
    });

    it('should extract multiple fonts from a simple array', () => {
      expect(extractFontNamesFromTextField(['Arial', 'Roboto'])).toEqual(['Arial', 'Roboto']);
    });

    it('should extract fonts from a literal expression', () => {
      expect(extractFontNamesFromTextField(['literal', ['FontA', 'FontB']])).toEqual([
        'FontA',
        'FontB',
      ]);
    });

    it('should extract fonts from a step expression', () => {
      const stepExpr = ['step', ['zoom'], ['literal', ['Font A']], 10, ['literal', ['Font B']]];
      const result = extractFontNamesFromTextField(stepExpr);
      expect(result).toContain('Font A');
      expect(result).toContain('Font B');
    });

    it('should return empty array for an empty array', () => {
      expect(extractFontNamesFromTextField([])).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      expect(extractFontNamesFromTextField(null)).toEqual([]);
      expect(extractFontNamesFromTextField(undefined)).toEqual([]);
      expect(extractFontNamesFromTextField('Arial')).toEqual([]);
      expect(extractFontNamesFromTextField(42)).toEqual([]);
    });

    it('should deduplicate fonts within the same expression', () => {
      const stepExpr = [
        'step',
        ['zoom'],
        ['literal', ['SharedFont', 'Font A']],
        10,
        ['literal', ['SharedFont', 'Font B']],
      ];
      const result = extractFontNamesFromTextField(stepExpr);
      expect(result.filter(f => f === 'SharedFont').length).toBe(1);
    });

    it('should extract fonts from a match expression', () => {
      const matchExpr = [
        'match',
        ['get', 'language'],
        'en',
        ['literal', ['English Font']],
        'ar',
        ['literal', ['Arabic Font']],
        ['literal', ['Default Font']],
      ];
      const result = extractFontNamesFromTextField(matchExpr);
      expect(result).toContain('English Font');
      expect(result).toContain('Arabic Font');
      expect(result).toContain('Default Font');
    });

    it('should extract fonts from a case expression', () => {
      const caseExpr = [
        'case',
        ['has', 'name_en'],
        ['literal', ['Latin Font']],
        ['literal', ['Fallback Font']],
      ];
      const result = extractFontNamesFromTextField(caseExpr);
      expect(result).toContain('Latin Font');
      expect(result).toContain('Fallback Font');
    });

    it('should extract fonts from a coalesce expression', () => {
      const coalesceExpr = [
        'coalesce',
        ['literal', ['Primary Font']],
        ['literal', ['Secondary Font']],
      ];
      const result = extractFontNamesFromTextField(coalesceExpr);
      expect(result).toContain('Primary Font');
      expect(result).toContain('Secondary Font');
    });

    it('should ignore non-string values in literal arrays', () => {
      const expr = ['literal', ['ValidFont', 42, null, 'AnotherFont']];
      const result = extractFontNamesFromTextField(expr);
      expect(result).toEqual(['ValidFont', 'AnotherFont']);
    });

    it('should handle deeply nested expressions', () => {
      const deepExpr = [
        'step',
        ['zoom'],
        [
          'case',
          ['has', 'name'],
          ['literal', ['Deep Font A']],
          ['literal', ['Deep Font B']],
        ],
        14,
        ['literal', ['Zoom 14 Font']],
      ];
      const result = extractFontNamesFromTextField(deepExpr);
      expect(result).toContain('Deep Font A');
      expect(result).toContain('Deep Font B');
      expect(result).toContain('Zoom 14 Font');
    });
  });

  describe('extractAllFontNames', () => {
    it('should return empty array for empty style', () => {
      expect(extractAllFontNames({})).toEqual([]);
    });

    it('should return empty array for style with no text-font layers', () => {
      const style = {
        layers: [
          { layout: { 'fill-color': '#000' } },
          { layout: { 'line-width': 2 } },
        ],
      };
      expect(extractAllFontNames(style)).toEqual([]);
    });

    it('should extract fonts from multiple layers', () => {
      const style = {
        layers: [
          { layout: { 'text-font': ['Arial Regular'] } },
          { layout: { 'text-font': ['Roboto Bold'] } },
        ],
      };
      const result = extractAllFontNames(style);
      expect(result).toContain('Arial Regular');
      expect(result).toContain('Roboto Bold');
      expect(result.length).toBe(2);
    });

    it('should deduplicate fonts across layers', () => {
      const style = {
        layers: [
          { layout: { 'text-font': ['Arial Regular'] } },
          { layout: { 'text-font': ['Arial Regular'] } },
          { layout: { 'text-font': ['Roboto Bold'] } },
        ],
      };
      const result = extractAllFontNames(style);
      expect(result).toContain('Arial Regular');
      expect(result).toContain('Roboto Bold');
      expect(result.length).toBe(2);
    });

    it('should skip layers without layout property', () => {
      const style = {
        layers: [
          { layout: { 'text-font': ['Arial'] } },
          { type: 'fill' } as unknown as { layout?: { [key: string]: unknown } },
          { layout: {} },
        ],
      };
      const result = extractAllFontNames(style);
      expect(result).toEqual(['Arial']);
    });

    it('should handle expression-based text-font in layers', () => {
      const style = {
        layers: [
          {
            layout: {
              'text-font': [
                'match',
                ['get', 'script'],
                'latin',
                ['literal', ['Noto Sans Regular']],
                ['literal', ['Noto Sans Arabic Regular']],
              ],
            },
          },
        ],
      };
      const result = extractAllFontNames(style);
      expect(result).toContain('Noto Sans Regular');
      expect(result).toContain('Noto Sans Arabic Regular');
    });
  });

  describe('patchStyleForOffline - per-source extension extraction', () => {
    it('should extract extension independently per source when no tileExtension is provided', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {
          'vector-source': {
            type: 'vector',
            tiles: ['https://example.com/tiles/{z}/{x}/{y}.pbf'],
          },
          'raster-source': {
            type: 'raster',
            tiles: ['https://example.com/raster/{z}/{x}/{y}.png'],
          },
        },
        layers: [],
      };

      const patched = patchStyleForOffline(style, 'my-download');
      const vectorSource = patched.sources['vector-source'] as { tiles: string[] };
      const rasterSource = patched.sources['raster-source'] as { tiles: string[] };

      expect(vectorSource.tiles[0]).toBe(
        'idb://my-download/tile/vector-source/{z}/{x}/{y}.pbf'
      );
      expect(rasterSource.tiles[0]).toBe(
        'idb://my-download/tile/raster-source/{z}/{x}/{y}.png'
      );
    });

    it('patches an array-shaped sprite config (MapLibre GL JS v3+ format)', () => {
      const style: MapboxStyle = {
        version: 8,
        sources: {},
        layers: [],
        // Array-shaped sprite with multiple entries.
        sprite: [
          { id: 'base', url: 'https://example.com/base' },
          { id: 'overlay', url: 'https://example.com/overlay' },
        ],
      } as unknown as MapboxStyle;

      const patched = patchStyleForOffline(style, 'my-download', undefined, undefined, 'my-style');
      const arr = patched.sprite as unknown as Array<{ id: string; url: string }>;
      // Each entry should be patched to idb:// with the styleId baseId.
      expect(arr).toHaveLength(2);
      expect(arr[0].url).toBe('idb://my-style/sprite/base');
      expect(arr[1].url).toBe('idb://my-style/sprite/overlay');
    });
  });
});
