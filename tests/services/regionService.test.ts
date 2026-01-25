/**
 * Tests for Region Service
 */
import { RegionService } from '../../src/services/regionService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

describe('RegionService', () => {
  let regionService: RegionService;

  beforeEach(async () => {
    regionService = new RegionService();

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
});
