/**
 * Tests for Region Service
 */
const mockDownloadTiles = jest.fn();
const mockDownloadSprites = jest.fn();
const mockDownloadGlyphs = jest.fn();
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

jest.mock('../../src/services/styleService', () => {
  const actual = jest.requireActual('../../src/services/styleService');
  return {
    ...actual,
    downloadStyleWithProvider: (...args: unknown[]) => mockDownloadStyleWithProvider(...args),
  };
});

import { RegionService } from '../../src/services/regionService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';
import { GLYPH_CONFIG } from '../../src/utils/constants';

describe('RegionService', () => {
  let regionService: RegionService;

  beforeEach(async () => {
    regionService = new RegionService();

    mockDownloadTiles.mockReset();
    mockDownloadSprites.mockReset();
    mockDownloadGlyphs.mockReset();
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
    mockDownloadGlyphs.mockResolvedValue({ downloaded: 0, failed: 0 });

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
            bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
            styleUrl: 'https://example.com/style.json',
            minZoom: 0,
            maxZoom: 10,
            created: Date.now(),
            expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
          },
          {
            id: 'region-2',
            name: 'Region Two',
            bounds: [[-73.5, 40.5], [-73.0, 41.0]] as [[number, number], [number, number]],
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
            bounds: [[-122.5, 37.5], [-122.0, 38.0]],
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
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
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
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
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
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
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
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
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
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
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
            bounds: [[-122.5, 37.5], [-122.0, 38.0]],
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
            bounds: [[-122.5, 37.5], [-122.0, 38.0]],
            minZoom: 0,
            maxZoom: 10,
          },
          {
            id: 'region-2',
            name: 'Region Two',
            bounds: [[-73.5, 40.5], [-73.0, 41.0]],
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
  });

  describe('downloadRegion', () => {
    const seedStyle = async (overrides: Partial<Record<string, unknown>> = {}) => {
      const db = await dbPromise;
      await db.put('styles', {
        key: 'test-style-id',
        style: {
          version: 8,
          sources: { v: { tiles: ['http://tiles/{z}/{x}/{y}.pbf'] } },
          layers: [
            { id: 'text', type: 'symbol', layout: { 'text-font': ['Open Sans Regular'] } },
          ],
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
      bounds: [[-122.5, 37.7], [-122.3, 37.9]] as [[number, number], [number, number]],
      minZoom: 10,
      maxZoom: 12,
      styleUrl: 'https://example.com/style.json',
    });

    it('throws when no styleUrl is provided', async () => {
      await expect(
        regionService.downloadRegion({
          id: 'x',
          name: 'x',
          bounds: [[0, 0], [1, 1]],
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
      expect(phases).toEqual(expect.arrayContaining(['style', 'sprites', 'glyphs', 'tiles', 'metadata']));
    });

    it('downloads the style when missing and then continues the pipeline', async () => {
      mockDownloadStyleWithProvider.mockImplementation(async (styleUrl: string) => {
        // Emulate downloadStyleWithProvider by writing the style to the DB
        const db = await dbPromise;
        await db.put('styles', {
          key: 'fresh-style-id',
          style: { version: 8, sources: { v: { tiles: ['http://t/{z}/{x}/{y}.pbf'] } }, layers: [] },
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
          analytics: { sourceTypes: {}, layerTypes: {}, totalLayers: 0, hasGlyphs: false, hasSprites: false },
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
  });
});
