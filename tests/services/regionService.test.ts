/**
 * Tests for Region Service
 */
const mockDownloadTiles = jest.fn();
const mockDownloadSprites = jest.fn();
const mockDownloadGlyphs = jest.fn();
const mockDownloadModels = jest.fn();
const mockDownloadStyleWithProvider = jest.fn();

jest.mock('../../src/services/tileService', () => {
  const actual = jest.requireActual('../../src/services/tileService');
  return {
    ...actual,
    downloadTiles: (...args: unknown[]) => mockDownloadTiles(...args),
  };
});

jest.mock('../../src/services/spriteService', () => {
  const actual = jest.requireActual('../../src/services/spriteService');
  return {
    ...actual,
    downloadSprites: (...args: unknown[]) => mockDownloadSprites(...args),
  };
});

jest.mock('../../src/services/glyphService', () => {
  const actual = jest.requireActual('../../src/services/glyphService');
  return {
    ...actual,
    downloadGlyphs: (...args: unknown[]) => mockDownloadGlyphs(...args),
  };
});

jest.mock('../../src/services/modelService', () => {
  const actual = jest.requireActual('../../src/services/modelService');
  return {
    ...actual,
    downloadModels: (...args: unknown[]) => mockDownloadModels(...args),
  };
});

jest.mock('../../src/services/styleService', () => {
  const actual = jest.requireActual('../../src/services/styleService');
  return {
    ...actual,
    downloadStyleWithProvider: (...args: unknown[]) => mockDownloadStyleWithProvider(...args),
  };
});

import { RegionService, resourceKeyBelongsToStyle } from '../../src/services/regionService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';
import { GLYPH_CONFIG } from '../../src/utils/constants';

describe('resourceKeyBelongsToStyle', () => {
  it('matches exact styleId', () => {
    expect(resourceKeyBelongsToStyle('abc', 'abc')).toBe(true);
  });
  it('matches keys with colon delimiter', () => {
    expect(resourceKeyBelongsToStyle('abc:NotoSans/0-255', 'abc')).toBe(true);
  });
  it('does not match a sibling styleId that shares a prefix', () => {
    expect(resourceKeyBelongsToStyle('abc_def:NotoSans/0-255', 'abc')).toBe(false);
    expect(resourceKeyBelongsToStyle('abcdef:foo', 'abc')).toBe(false);
    expect(resourceKeyBelongsToStyle('abc_NotoSans', 'abc')).toBe(false);
  });
  it('does not match unrelated keys', () => {
    expect(resourceKeyBelongsToStyle('xyz:foo', 'abc')).toBe(false);
  });
});

describe('RegionService', () => {
  let regionService: RegionService;

  beforeEach(async () => {
    regionService = new RegionService();

    mockDownloadTiles.mockReset();
    mockDownloadSprites.mockReset();
    mockDownloadGlyphs.mockReset();
    mockDownloadModels.mockReset();
    mockDownloadStyleWithProvider.mockReset();

    mockDownloadTiles.mockResolvedValue({
      totalTiles: 0,
      downloadedTiles: 0,
      skippedTiles: 0,
      failedTiles: 0,
      totalSize: 0,
      downloadTime: 0,
      averageSpeed: 0,
      errors: [],
      tileExtension: 'pbf',
    });
    mockDownloadSprites.mockResolvedValue({ downloaded: 0, failed: 0 });
    mockDownloadModels.mockResolvedValue({
      totalModels: 0,
      downloadedModels: 0,
      skippedModels: 0,
      failedModels: 0,
      totalSize: 0,
      errors: [],
    });
    // Simulate the real glyphService.downloadGlyphs which fires onProgress
    // at least once (the orchestrator relies on this to surface the `glyphs`
    // phase now that we no longer pre-emit a synthetic progress event).
    mockDownloadGlyphs.mockImplementation(
      async (
        _url: string,
        fontstacks: string[],
        _styleId: string,
        ranges: string[],
        opts?: { onProgress?: (p: { completed: number; total: number }) => void }
      ) => {
        const total = fontstacks.length * ranges.length;
        opts?.onProgress?.({ completed: total, total });
        return { downloaded: total, failed: 0 };
      }
    );

    // Clear all relevant stores before each test
    const db = await dbPromise;
    await db.clear('styles');
    await db.clear('tiles');
    await db.clear('fonts');
    await db.clear('glyphs');
    await db.clear('sprites');
  });

  describe('listRegions', () => {
    it('should return empty array when no regions exist', async () => {
      const regions = await regionService.listRegions();
      expect(regions).toEqual([]);
    });

    it('should return all stored regions', async () => {
      const db = await dbPromise;

      // Regions are now stored inside styles.regions[]
      await db.put('styles', {
        key: 'test-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'region-1',
            name: 'Region One',
            bounds: [
              [-122.5, 37.5],
              [-122.0, 38.0],
            ] as [[number, number], [number, number]],
            styleUrl: 'https://example.com/style.json',
            minZoom: 0,
            maxZoom: 10,
            created: Date.now(),
            expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
          },
          {
            id: 'region-2',
            name: 'Region Two',
            bounds: [
              [-73.5, 40.5],
              [-73.0, 41.0],
            ] as [[number, number], [number, number]],
            styleUrl: 'https://example.com/style.json',
            minZoom: 0,
            maxZoom: 10,
            created: Date.now(),
            expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const regions = await regionService.listRegions();
      expect(regions.length).toBe(2);
    });
  });

  describe('listStoredRegions', () => {
    it('should return regions extracted from styles', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'test-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'region-1',
            name: 'Test Region',
            bounds: [
              [-122.5, 37.5],
              [-122.0, 38.0],
            ],
            minZoom: 0,
            maxZoom: 10,
            created: Date.now() - 10000,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const regions = await regionService.listStoredRegions();
      expect(regions.length).toBe(1);
      expect(regions[0].id).toBe('region-1');
      expect(regions[0].styleId).toBe('test-style');
    });

    it('should return empty array when no styles have regions', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'empty-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const regions = await regionService.listStoredRegions();
      expect(regions).toEqual([]);
    });
  });

  describe('addRegion', () => {
    it('should throw when no styleUrl provided', async () => {
      const region = {
        id: 'test-region',
        name: 'Test',
        bounds: [
          [-122.5, 37.5],
          [-122.0, 38.0],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleUrl: '',
      };

      await expect(regionService.addRegion(region)).rejects.toThrow('Region must have a styleUrl');
    });

    it('should throw when style not downloaded', async () => {
      const region = {
        id: 'test-region',
        name: 'Test',
        bounds: [
          [-122.5, 37.5],
          [-122.0, 38.0],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleUrl: 'https://example.com/style.json',
      };

      await expect(regionService.addRegion(region)).rejects.toThrow(
        'Style must be downloaded before adding a region'
      );
    });

    it('should add region to existing style', async () => {
      const db = await dbPromise;

      // First, add a style
      await db.put('styles', {
        key: 'test-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style.json',
      });

      const region = {
        id: 'new-region',
        styleId: 'test-style',
        name: 'New Region',
        bounds: [
          [-122.5, 37.5],
          [-122.0, 38.0],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleUrl: 'https://example.com/style.json',
      };

      await regionService.addRegion(region);

      // Verify region was added
      const style = await db.get('styles', 'test-style');
      expect(style?.regions.length).toBe(1);
      expect(style?.regions[0].name).toBe('New Region');
    });

    it('should inject extraSources into the style when adding a region', async () => {
      const db = await dbPromise;

      // Add a style with an existing vector source
      await db.put('styles', {
        key: 'test-style-extra',
        style: {
          version: 8,
          sources: {
            'base-tiles': {
              type: 'vector',
              tiles: ['https://example.com/base/{z}/{x}/{y}.pbf'],
            },
          },
          layers: [],
        },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-extra.json',
      });

      const region = {
        id: 'region-with-extras',
        styleId: 'test-style-extra',
        name: 'Region With Extra Layers',
        bounds: [
          [-122.5, 37.5],
          [-122.0, 38.0],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleUrl: 'https://example.com/style-extra.json',
        extraSources: [
          {
            id: 'buildings',
            type: 'vector' as const,
            tiles: ['https://example.com/buildings/{z}/{x}/{y}.pbf'],
            minzoom: 12,
            maxzoom: 16,
          },
          {
            id: 'poi-layer',
            type: 'vector' as const,
            tiles: ['https://example.com/poi/{z}/{x}/{y}.mvt'],
            attribution: '(c) Test',
          },
        ],
      };

      await regionService.addRegion(region);

      // Verify extra sources were injected into the style
      const style = await db.get('styles', 'test-style-extra');
      expect(style?.style.sources['buildings']).toBeDefined();
      expect(style?.style.sources['poi-layer']).toBeDefined();

      // Verify the extra sources have idb:// tiles (patched for offline)
      const buildingsSource = style?.style.sources['buildings'] as { tiles?: string[] };
      expect(buildingsSource.tiles?.[0]).toMatch(/^idb:\/\//);

      const poiSource = style?.style.sources['poi-layer'] as { tiles?: string[] };
      expect(poiSource.tiles?.[0]).toMatch(/^idb:\/\//);

      // Verify original base source was also patched
      const baseSource = style?.style.sources['base-tiles'] as { tiles?: string[] };
      expect(baseSource.tiles?.[0]).toMatch(/^idb:\/\//);
    });

    it('should not overwrite existing sources with extraSources of the same id', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'test-style-no-overwrite',
        style: {
          version: 8,
          sources: {
            'shared-source': {
              type: 'vector',
              tiles: ['https://original.com/{z}/{x}/{y}.pbf'],
            },
          },
          layers: [],
        },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-no-overwrite.json',
      });

      const region = {
        id: 'region-no-overwrite',
        styleId: 'test-style-no-overwrite',
        name: 'Test',
        bounds: [
          [-122.5, 37.5],
          [-122.0, 38.0],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleUrl: 'https://example.com/style-no-overwrite.json',
        extraSources: [
          {
            id: 'shared-source',
            type: 'vector' as const,
            tiles: ['https://different.com/{z}/{x}/{y}.pbf'],
          },
        ],
      };

      await regionService.addRegion(region);

      // The original source should be preserved, not overwritten
      const style = await db.get('styles', 'test-style-no-overwrite');
      const source = style?.style.sources['shared-source'] as { tiles?: string[] };
      // It should be patched to idb:// but from the original URL, not the extra source URL
      expect(source.tiles?.[0]).toMatch(/^idb:\/\//);
    });

    it('stores region.expiry as a timestamp (regression P1-A)', async () => {
      // Per the OfflineRegionOptions type, `expiry` is "ms since epoch".
      // Prior bug treated the caller's value as a duration and stored
      // `Date.now() + expiry`, corrupting absolute timestamps.
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-expiry',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-expiry.json',
      });

      const expiryTimestamp = Date.UTC(2099, 0, 1); // far-future absolute ts
      await regionService.addRegion({
        id: 'region-expiry',
        styleId: 'test-style-expiry',
        name: 'Expiry Test',
        bounds: [
          [0, 0],
          [1, 1],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 0,
        styleUrl: 'https://example.com/style-expiry.json',
        expiry: expiryTimestamp,
      });

      const style = await db.get('styles', 'test-style-expiry');
      const stored = style?.regions[0] as { expiry: number };
      expect(stored.expiry).toBe(expiryTimestamp);
    });

    it('defaults expiry to ~30 days from now when caller omits it (P1-A)', async () => {
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-default-expiry',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-default.json',
      });
      const before = Date.now();
      await regionService.addRegion({
        id: 'region-default',
        styleId: 'test-style-default-expiry',
        name: 'Default',
        bounds: [
          [0, 0],
          [1, 1],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 0,
        styleUrl: 'https://example.com/style-default.json',
      });
      const after = Date.now();
      const style = await db.get('styles', 'test-style-default-expiry');
      const expiry = (style?.regions[0] as { expiry: number }).expiry;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(expiry).toBeGreaterThanOrEqual(before + thirtyDays);
      expect(expiry).toBeLessThanOrEqual(after + thirtyDays);
    });

    it('upserts regions with the same id (regression P1-B)', async () => {
      // Prior bug: bboxExists check silently skipped persistence when another
      // region on the same style shared bounds, orphaning the new region's id.
      // New behavior: dedup by id, and an existing id gets replaced in place.
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-upsert',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-upsert.json',
      });

      const base = {
        id: 'same-id',
        styleId: 'test-style-upsert',
        styleUrl: 'https://example.com/style-upsert.json',
        bounds: [
          [0, 0],
          [1, 1],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 0,
      };
      await regionService.addRegion({ ...base, name: 'First' });
      await regionService.addRegion({ ...base, name: 'Second (updated)' });

      const style = await db.get('styles', 'test-style-upsert');
      expect(style?.regions).toHaveLength(1);
      expect((style?.regions[0] as { name: string }).name).toBe('Second (updated)');
      expect((style?.regions[0] as { updated?: number }).updated).toBeDefined();
    });

    it('stores distinct regions even when bounds overlap (regression P1-B)', async () => {
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-same-bounds',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/style-same-bounds.json',
      });
      const base = {
        styleId: 'test-style-same-bounds',
        styleUrl: 'https://example.com/style-same-bounds.json',
        bounds: [
          [0, 0],
          [1, 1],
        ] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 0,
      };
      await regionService.addRegion({ ...base, id: 'region-a', name: 'A' });
      await regionService.addRegion({ ...base, id: 'region-b', name: 'B' });

      const style = await db.get('styles', 'test-style-same-bounds');
      expect(style?.regions).toHaveLength(2);
      expect(style?.regions.map((r: { id: string }) => r.id).sort()).toEqual([
        'region-a',
        'region-b',
      ]);
    });
  });

  describe('deleteRegion', () => {
    it('should handle deleting non-existent region gracefully', async () => {
      // Should not throw
      await expect(regionService.deleteRegion('non-existent')).resolves.not.toThrow();
    });

    it('should delete region and clean up tiles', async () => {
      const db = await dbPromise;

      // Set up style with region
      await db.put('styles', {
        key: 'test-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'region-to-delete',
            name: 'Delete Me',
            bounds: [
              [-122.5, 37.5],
              [-122.0, 38.0],
            ],
            minZoom: 0,
            maxZoom: 10,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      // Add some tiles for this style - using type assertion for test data
      await db.put('tiles', {
        key: 'test-style:source:10:100:200.pbf',
        styleId: 'test-style',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      await regionService.deleteRegion('region-to-delete');

      // Verify style was deleted (last region)
      const style = await db.get('styles', 'test-style');
      expect(style).toBeUndefined();

      // Verify tiles were cleaned up
      const tiles = await db.getAll('tiles');
      expect(tiles.length).toBe(0);
    });

    it('should keep other regions when deleting one', async () => {
      const db = await dbPromise;

      // Set up style with multiple regions
      await db.put('styles', {
        key: 'multi-region-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'region-1',
            name: 'Region One',
            bounds: [
              [-122.5, 37.5],
              [-122.0, 38.0],
            ],
            minZoom: 0,
            maxZoom: 10,
          },
          {
            id: 'region-2',
            name: 'Region Two',
            bounds: [
              [-73.5, 40.5],
              [-73.0, 41.0],
            ],
            minZoom: 0,
            maxZoom: 10,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      await regionService.deleteRegion('region-1');

      // Verify style still exists with remaining region
      const style = await db.get('styles', 'multi-region-style');
      expect(style).toBeDefined();
      expect(style?.regions.length).toBe(1);
      expect(style?.regions[0].id).toBe('region-2');
    });

    it('does not delete resources of sibling styles with shared prefix (regression P1-C)', async () => {
      // Prior bug: `key.startsWith("abc_")` matched glyphs for style "abc_def".
      // Deleting style "abc" would collaterally wipe style "abc_def"'s resources.
      const db = await dbPromise;

      // Style `abc` with one region; deleting that region triggers style cleanup.
      await db.put('styles', {
        key: 'abc',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'r-abc',
            name: 'r-abc',
            bounds: [
              [0, 0],
              [1, 1],
            ],
            minZoom: 0,
            maxZoom: 0,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });
      await db.put('styles', {
        key: 'abc_def',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'r-abc_def',
            name: 'r',
            bounds: [
              [0, 0],
              [1, 1],
            ],
            minZoom: 0,
            maxZoom: 0,
          },
        ],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      // Minimal entries — the deletion logic only reads `.key`. Cast to skip
      // filling unrelated required fields (lastModified/url/etc).
      const put = async (store: 'glyphs' | 'sprites' | 'fonts', key: string) => {
        await (db.put as unknown as (s: string, v: Record<string, unknown>) => Promise<unknown>)(
          store,
          { key, data: new ArrayBuffer(1), size: 1 }
        );
      };
      await put('glyphs', 'abc:NotoSans/0-255');
      await put('glyphs', 'abc_def:NotoSans/0-255');
      await put('sprites', 'abc:sprite.png');
      await put('sprites', 'abc_def:sprite.png');
      await put('fonts', 'abc:Roboto');
      await put('fonts', 'abc_def:Roboto');

      await regionService.deleteRegion('r-abc');

      // `abc_def`'s resources must survive.
      expect(await db.get('glyphs', 'abc_def:NotoSans/0-255')).toBeDefined();
      expect(await db.get('sprites', 'abc_def:sprite.png')).toBeDefined();
      expect(await db.get('fonts', 'abc_def:Roboto')).toBeDefined();

      // `abc`'s resources should be gone.
      expect(await db.get('glyphs', 'abc:NotoSans/0-255')).toBeUndefined();
      expect(await db.get('sprites', 'abc:sprite.png')).toBeUndefined();
      expect(await db.get('fonts', 'abc:Roboto')).toBeUndefined();
    });
  });

  describe('downloadRegion', () => {
    const seedStyle = async (overrides: Partial<Record<string, unknown>> = {}) => {
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-id',
        style: {
          version: 8,
          sources: { v: { tiles: ['http://tiles/{z}/{x}/{y}.pbf'] } },
          layers: [{ id: 'text', type: 'symbol', layout: { 'text-font': ['Open Sans Regular'] } }],
          sprite: 'https://example.com/sprites/sprite',
          glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
        },
        originalUrl: 'https://example.com/style.json',
        originalSpriteUrl: 'https://example.com/sprites/sprite',
        originalGlyphsUrl: 'https://example.com/fonts/{fontstack}/{range}.pbf',
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        ...overrides,
      });
    };

    const makeRegion = () => ({
      id: 'region-prog',
      name: 'Programmatic Region',
      bounds: [
        [-122.5, 37.7],
        [-122.3, 37.9],
      ] as [[number, number], [number, number]],
      minZoom: 10,
      maxZoom: 12,
      styleUrl: 'https://example.com/style.json',
    });

    it('throws when no styleUrl is provided', async () => {
      await expect(
        regionService.downloadRegion({
          id: 'x',
          name: 'x',
          bounds: [
            [0, 0],
            [1, 1],
          ],
          minZoom: 0,
          maxZoom: 0,
        } as never)
      ).rejects.toThrow('Region must have a styleUrl');
    });

    it('runs sprites → glyphs → tiles → metadata and stores the region', async () => {
      await seedStyle();
      const phases: string[] = [];

      const result = await regionService.downloadRegion(makeRegion(), {
        onProgress: p => {
          if (!phases.includes(p.phase)) phases.push(p.phase);
        },
      });

      expect(mockDownloadSprites).toHaveBeenCalledTimes(1);
      expect(mockDownloadGlyphs).toHaveBeenCalledTimes(1);
      expect(mockDownloadTiles).toHaveBeenCalledTimes(1);

      // Glyph ranges must come from the comprehensive-ranges constant
      const glyphRanges = mockDownloadGlyphs.mock.calls[0][3];
      expect(glyphRanges).toEqual([...GLYPH_CONFIG.COMPREHENSIVE_RANGES]);

      // Metadata persisted last, inside styles.regions[]
      const db = await dbPromise;
      const style = await db.get('styles', 'test-style-id');
      expect(style?.regions).toHaveLength(1);
      expect(style?.regions[0]).toMatchObject({ id: 'region-prog', styleId: 'test-style-id' });

      expect(result.styleId).toBe('test-style-id');
      expect(phases).toEqual(
        expect.arrayContaining(['style', 'sprites', 'glyphs', 'tiles', 'metadata'])
      );
    });

    it('does not auto-fill tileExtension from tileResult (regression: mixed-format styles)', async () => {
      // tileResult.tileExtension is the first source's extension only; passing
      // it through to addRegion→patchStyleForOffline would override ALL
      // sources (e.g., .png from a raster source would clobber vector .pbf).
      await seedStyle();
      mockDownloadTiles.mockResolvedValueOnce({
        totalTiles: 0,
        downloadedTiles: 0,
        skippedTiles: 0,
        failedTiles: 0,
        totalSize: 0,
        downloadTime: 0,
        averageSpeed: 0,
        errors: [],
        tileExtension: 'png', // raster, e.g.
      });

      await regionService.downloadRegion(makeRegion()); // region has no tileExtension

      const db = await dbPromise;
      const style = await db.get('styles', 'test-style-id');
      const stored = style?.regions[0] as { tileExtension?: string } | undefined;
      expect(stored?.tileExtension).toBeUndefined();
    });

    it('downloads the style when missing and then continues the pipeline', async () => {
      mockDownloadStyleWithProvider.mockImplementation(async (styleUrl: string) => {
        // Emulate downloadStyleWithProvider by writing the style to the DB
        const db = await dbPromise;
        await db.put('styles', {
          key: 'fresh-style-id',
          style: {
            version: 8,
            sources: { v: { tiles: ['http://t/{z}/{x}/{y}.pbf'] } },
            layers: [],
          },
          originalUrl: styleUrl,
          provider: 'auto' as StyleProvider,
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        });
        return {
          styleId: 'fresh-style-id',
          success: true,
          downloadTime: 0,
          styleSize: 0,
          sourcesProcessed: 0,
          sourcesEmbedded: 0,
          errors: [],
          analytics: {
            sourceTypes: {},
            layerTypes: {},
            totalLayers: 0,
            hasGlyphs: false,
            hasSprites: false,
          },
        };
      });

      const result = await regionService.downloadRegion(makeRegion());

      expect(mockDownloadStyleWithProvider).toHaveBeenCalledWith(
        'https://example.com/style.json',
        expect.objectContaining({ enableSourceEmbedding: true, skipExisting: true })
      );
      expect(mockDownloadTiles).toHaveBeenCalledTimes(1);
      expect(result.styleId).toBe('fresh-style-id');
    });

    it('skips sprites and glyphs when asked', async () => {
      await seedStyle();
      await regionService.downloadRegion(makeRegion(), { skipSprites: true, skipGlyphs: true });
      expect(mockDownloadSprites).not.toHaveBeenCalled();
      expect(mockDownloadGlyphs).not.toHaveBeenCalled();
      expect(mockDownloadTiles).toHaveBeenCalledTimes(1);
    });

    it('loadRegion is an alias for downloadRegion', async () => {
      await seedStyle();
      await regionService.loadRegion(makeRegion());
      expect(mockDownloadTiles).toHaveBeenCalledTimes(1);
    });

    it('fetches iconset.pbf alongside sprite for Mapbox Standard styles', async () => {
      // Mapbox Standard serves an iconset.pbf sibling under the same
      // /styles/v1/.../<hash>/ path as the sprite.json/png. Our sprite
      // download must include it in the URL list for that family.
      await seedStyle({
        originalSpriteUrl:
          'https://api.mapbox.com/styles/v1/mapbox/standard/abc123/sprite?access_token=pk.foo',
      });
      await regionService.downloadRegion(makeRegion());
      expect(mockDownloadSprites).toHaveBeenCalledTimes(1);
      const spriteUrls = mockDownloadSprites.mock.calls[0][0] as string[];
      // Base four variants still fetched
      expect(spriteUrls.some(u => u.includes('/sprite.json'))).toBe(true);
      expect(spriteUrls.some(u => u.includes('/sprite.png'))).toBe(true);
      expect(spriteUrls.some(u => u.includes('/sprite@2x.json'))).toBe(true);
      expect(spriteUrls.some(u => u.includes('/sprite@2x.png'))).toBe(true);
      // Plus the new iconset.pbf sibling
      expect(spriteUrls.some(u => u.includes('/iconset.pbf'))).toBe(true);
    });

    it('downloads style.models during the models phase (Mapbox Standard trees/turbines)', async () => {
      await seedStyle({
        style: {
          version: 8,
          sources: { v: { tiles: ['http://tiles/{z}/{x}/{y}.pbf'] } },
          layers: [],
          sprite: 'https://example.com/sprites/sprite',
          glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
          // Mapbox Standard-style model shape: {name: "URI string"}.
          models: {
            'maple1-lod1': 'https://api.mapbox.com/models/v1/mapbox/maple1-v4-lod1.glb?access_token=foo',
            'oak1-lod2': 'https://api.mapbox.com/models/v1/mapbox/oak1-v4-lod2.glb?access_token=foo',
          },
        },
      });
      const phases: string[] = [];
      await regionService.downloadRegion(makeRegion(), {
        onProgress: p => {
          if (!phases.includes(p.phase)) phases.push(p.phase);
        },
      });
      expect(mockDownloadModels).toHaveBeenCalledTimes(1);
      const [resolved, styleIdArg] = mockDownloadModels.mock.calls[0];
      expect(Object.keys(resolved)).toEqual(['maple1-lod1', 'oak1-lod2']);
      expect(styleIdArg).toBe('test-style-id');
      expect(phases).toContain('models');
    });

    it('skips the models phase entirely when skipModels: true', async () => {
      await seedStyle({
        style: {
          version: 8,
          sources: { v: { tiles: ['http://tiles/{z}/{x}/{y}.pbf'] } },
          layers: [],
          models: { 'tree-lod1': 'https://api.mapbox.com/models/v1/mapbox/oak1-v4-lod1.glb' },
        },
      });
      await regionService.downloadRegion(makeRegion(), { skipModels: true });
      expect(mockDownloadModels).not.toHaveBeenCalled();
    });

    it('does NOT re-download models that were already patched to idb://', async () => {
      // Once a region has been downloaded, patchStyleForOffline rewrites
      // style.models URIs to idb://... — those should be no-ops on a
      // subsequent download, not generate bogus fetches.
      await seedStyle({
        style: {
          version: 8,
          sources: { v: { tiles: ['http://tiles/{z}/{x}/{y}.pbf'] } },
          layers: [],
          models: {
            'already-patched': 'idb://test-style-id/model/already-patched',
            'fresh-model': 'https://api.mapbox.com/models/v1/mapbox/maple1-v4-lod1.glb',
          },
        },
      });
      await regionService.downloadRegion(makeRegion());
      const [resolved] = mockDownloadModels.mock.calls[0];
      expect(Object.keys(resolved)).toEqual(['fresh-model']);
      expect(resolved['already-patched']).toBeUndefined();
    });

    it('does NOT fetch iconset.pbf for non-Mapbox sprite URLs', async () => {
      // OpenFreeMap and other providers don't have iconset.pbf — we must
      // not synthesize a bogus URL that would 404.
      await seedStyle({
        originalSpriteUrl: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
      });
      await regionService.downloadRegion(makeRegion());
      const spriteUrls = mockDownloadSprites.mock.calls[0][0] as string[];
      expect(spriteUrls.some(u => u.includes('iconset.pbf'))).toBe(false);
      // Base four variants still present
      expect(spriteUrls).toHaveLength(4);
    });
  });
});
