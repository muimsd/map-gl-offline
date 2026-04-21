/**
 * Tests for Tile Service
 */
import { TileService, tileService, getTileStats, getTileAnalytics, cleanupOldTiles } from '../../src/services/tileService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('TileService', () => {
  let service: TileService;

  beforeEach(async () => {
    service = new TileService();
    const db = await dbPromise;
    await db.clear('tiles');
  });

  describe('getTileStats', () => {
    it('should return empty stats when no tiles exist', async () => {
      const stats = await service.getTileStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.oldestTile).toBeUndefined();
      expect(stats.newestTile).toBeUndefined();
      expect(stats.zoomLevelStats.size).toBe(0);
    });

    it('should calculate stats for stored tiles', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now - 10000).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now - 10000,
      });

      await db.put('tiles', {
        key: 'style-1:source:12:400:500.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 400,
        y: 500,
        z: 12,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.averageSize).toBe(1500);
      expect(stats.oldestTile).toBeDefined();
      expect(stats.newestTile).toBeDefined();
    });

    it('should filter by styleId when provided', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'style-2:source:10:101:200.pbf',
        styleId: 'style-2',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats('style-1');

      expect(stats.count).toBe(1);
      expect(stats.totalSize).toBe(1000);
    });

    it('should track zoom level statistics', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'style-1:source:10:101:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 1500,
        data: new ArrayBuffer(1500),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'style-1:source:12:400:500.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 400,
        y: 500,
        z: 12,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile3.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.zoomLevelStats.size).toBe(2);
      expect(stats.zoomLevelStats.get(10)?.count).toBe(2);
      expect(stats.zoomLevelStats.get(10)?.size).toBe(2500);
      expect(stats.zoomLevelStats.get(12)?.count).toBe(1);
      expect(stats.zoomLevelStats.get(12)?.size).toBe(2000);
    });

    it('should track oldest and newest tiles', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: oldTime,
      });

      await db.put('tiles', {
        key: 'style-1:source:10:101:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(newTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: newTime,
      });

      const stats = await service.getTileStats();

      expect(stats.oldestTile?.getTime()).toBe(oldTime);
      expect(stats.newestTile?.getTime()).toBe(newTime);
    });

    it('should handle tiles at zoom level 0', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:0:0:0.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 0,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.count).toBe(1);
      expect(stats.zoomLevelStats.get(0)?.count).toBe(1);
    });
  });

  describe('cleanupOldTiles', () => {
    it('should delete tiles older than maxAge', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const recentTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      await db.put('tiles', {
        key: 'old-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/old-tile.pbf',
        lastModified: oldTime,
      });

      await db.put('tiles', {
        key: 'recent-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(recentTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/recent-tile.pbf',
        lastModified: recentTime,
      });

      const deletedCount = await service.cleanupOldTiles(30);

      expect(deletedCount).toBe(1);

      // Verify old tile was deleted
      const oldTile = await db.get('tiles', 'old-tile.pbf');
      expect(oldTile).toBeUndefined();

      // Verify recent tile still exists
      const recentTile = await db.get('tiles', 'recent-tile.pbf');
      expect(recentTile).toBeDefined();
    });

    it('should use default maxAge of 30 days', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 35 * 24 * 60 * 60 * 1000; // 35 days ago

      await db.put('tiles', {
        key: 'old-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/old-tile.pbf',
        lastModified: oldTime,
      });

      const deletedCount = await service.cleanupOldTiles();

      expect(deletedCount).toBe(1);
    });

    it('should filter by styleId when provided', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago

      await db.put('tiles', {
        key: 'style-1-old-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: oldTime,
      });

      await db.put('tiles', {
        key: 'style-2-old-tile.pbf',
        styleId: 'style-2',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: oldTime,
      });

      // Only delete style-1 tiles
      const deletedCount = await service.cleanupOldTiles(30, 'style-1');

      expect(deletedCount).toBe(1);

      // Verify style-1 tile was deleted
      const style1Tile = await db.get('tiles', 'style-1-old-tile.pbf');
      expect(style1Tile).toBeUndefined();

      // Verify style-2 tile still exists
      const style2Tile = await db.get('tiles', 'style-2-old-tile.pbf');
      expect(style2Tile).toBeDefined();
    });

    it('should return 0 when no tiles match criteria', async () => {
      const db = await dbPromise;
      const recentTime = Date.now();

      await db.put('tiles', {
        key: 'recent-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(recentTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: recentTime,
      });

      const deletedCount = await service.cleanupOldTiles(30);

      expect(deletedCount).toBe(0);
    });
  });

  describe('getTileAnalytics', () => {
    it('should return structured analytics', async () => {
      const analytics = await service.getTileAnalytics();

      expect(analytics).toHaveProperty('basic');
      expect(analytics).toHaveProperty('distribution');
      expect(analytics).toHaveProperty('temporal');
    });

    it('should return empty analytics when no tiles exist', async () => {
      const analytics = await service.getTileAnalytics();

      const basic = analytics.basic as { totalTiles: number; totalSize: number; averageSize: number };
      expect(basic.totalTiles).toBe(0);
      expect(basic.totalSize).toBe(0);
      expect(basic.averageSize).toBe(0);
    });

    it('should calculate analytics for stored tiles', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const oldTime = now - 100000;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(oldTime).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: oldTime,
      });

      await db.put('tiles', {
        key: 'style-1:source:12:400:500.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 400,
        y: 500,
        z: 12,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      const analytics = await service.getTileAnalytics();

      const basic = analytics.basic as { totalTiles: number; totalSize: number; averageSize: number };
      expect(basic.totalTiles).toBe(2);
      expect(basic.totalSize).toBe(3000);
      expect(basic.averageSize).toBe(1500);

      const distribution = analytics.distribution as { tilesByZoom: Record<string, number>; sizeByZoom: Record<string, number> };
      expect(distribution.tilesByZoom['10']).toBe(1);
      expect(distribution.tilesByZoom['12']).toBe(1);
      expect(distribution.sizeByZoom['10']).toBe(1000);
      expect(distribution.sizeByZoom['12']).toBe(2000);

      const temporal = analytics.temporal as { oldestTile: number; newestTile: number; ageSpan: number };
      expect(temporal.oldestTile).toBe(oldTime);
      expect(temporal.newestTile).toBe(now);
      expect(temporal.ageSpan).toBe(now - oldTime);
    });

    it('should filter by styleId when provided', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'style-2:source:10:101:200.pbf',
        styleId: 'style-2',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 5000,
        data: new ArrayBuffer(5000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      const analytics = await service.getTileAnalytics('style-1');

      const basic = analytics.basic as { totalTiles: number; totalSize: number };
      expect(basic.totalTiles).toBe(1);
      expect(basic.totalSize).toBe(1000);
    });

    it('should handle empty ageSpan when no tiles exist', async () => {
      const analytics = await service.getTileAnalytics();

      const temporal = analytics.temporal as { oldestTile: number | undefined; newestTile: number | undefined; ageSpan: number };
      expect(temporal.oldestTile).toBeUndefined();
      expect(temporal.newestTile).toBeUndefined();
      expect(temporal.ageSpan).toBe(0);
    });
  });

  describe('downloadTiles', () => {
    it('should throw error when style has no sources', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
      };
      const style = {
        version: 8 as const,
        sources: {},
        layers: [],
      };

      await expect(service.downloadTiles(region, style, 'test-style')).rejects.toThrow(
        'Style does not contain any sources to download tiles from'
      );
    });

    it('should throw error when sources is undefined', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
      };
      const style = {
        version: 8 as const,
        sources: undefined as unknown as Record<string, unknown>,
        layers: [],
      };

      await expect(service.downloadTiles(region, style, 'test-style')).rejects.toThrow(
        'Style does not contain any sources to download tiles from'
      );
    });

    it('skips known-sparse Mapbox tilesets by default (Standard style noise fix)', async () => {
      // Two sources: a non-sparse one and a known-sparse Mapbox tileset.
      // With the default filter the sparse one should contribute zero tiles.
      const region = {
        id: 'test-sparse',
        name: 'Sparse',
        bounds: [[55.27, 25.2], [55.28, 25.21]] as [[number, number], [number, number]],
        minZoom: 1,
        maxZoom: 1, // keep totals tiny so we don't hit the network
      };
      const style = {
        version: 8 as const,
        sources: {
          landmarks: {
            type: 'vector',
            tiles: [
              'https://a.tiles.mapbox.com/v4/mapbox.mapbox-landmark-pois-v1/{z}/{x}/{y}.vector.pbf',
            ],
          },
        },
        layers: [],
      };
      const result = await service.downloadTiles(region, style, 'test-sparse-style', {
        storageQuotaCheck: false,
        maxRetries: 0,
      });
      // Sparse source was fully pre-filtered; nothing was planned for download.
      expect(result.totalTiles).toBe(0);
      expect(result.failedTiles).toBe(0);
    });

    it('can be overridden with skipSparseSources: false', async () => {
      // Same style as above, but opt-in to downloading the sparse tileset.
      // We only assert the pipeline doesn't pre-filter it — the actual fetch
      // will 404 but that's downstream of the filter we're testing.
      const region = {
        id: 'test-sparse-included',
        name: 'Sparse included',
        bounds: [[55.27, 25.2], [55.28, 25.21]] as [[number, number], [number, number]],
        minZoom: 1,
        maxZoom: 1, // keep tile count tiny
      };
      const style = {
        version: 8 as const,
        sources: {
          landmarks: {
            type: 'vector',
            tiles: [
              'https://a.tiles.mapbox.com/v4/mapbox.mapbox-landmark-pois-v1/{z}/{x}/{y}.vector.pbf',
            ],
          },
        },
        layers: [],
      };
      const result = await service.downloadTiles(region, style, 'test-style-included', {
        skipSparseSources: false,
        storageQuotaCheck: false,
        maxRetries: 0,
      });
      // The source wasn't pre-filtered; some tiles were attempted even if
      // they ultimately 404'd or errored (downstream of our filter).
      expect(result.totalTiles).toBeGreaterThan(0);
    });
  });

  describe('exported functions', () => {
    it('should export getTileStats function', async () => {
      const stats = await getTileStats();
      expect(stats).toBeDefined();
      expect(stats.count).toBe(0);
    });

    it('should export getTileAnalytics function', async () => {
      const analytics = await getTileAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.basic).toBeDefined();
    });

    it('should export cleanupOldTiles function', async () => {
      const deleted = await cleanupOldTiles();
      expect(typeof deleted).toBe('number');
    });

    it('should export tileService singleton', () => {
      expect(tileService).toBeDefined();
      expect(tileService).toBeInstanceOf(TileService);
    });
  });

  describe('downloadTiles validation', () => {
    it('should throw error when style is null', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
      };

      await expect(service.downloadTiles(region, null as unknown as { version: 8; sources: Record<string, unknown>; layers: unknown[] }, 'test-style')).rejects.toThrow(
        'Style does not contain any sources to download tiles from'
      );
    });

    it('should throw error when sources is empty object', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
      };
      const style = {
        version: 8 as const,
        sources: {},
        layers: [],
      };

      await expect(service.downloadTiles(region, style, 'test-style')).rejects.toThrow(
        'Style does not contain any sources to download tiles from'
      );
    });

    it('should use fallback for sources without tile URLs', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 2,
      };
      const style = {
        version: 8 as const,
        sources: {
          'geojson-source': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [],
      };

      // GeoJSON sources are ignored, but a fallback is created from the first source
      // The download will fail but won't throw immediately
      const result = await service.downloadTiles(region, style, 'test-style');
      // The result will show failed tiles due to network errors
      expect(result.failedTiles).toBeGreaterThan(0);
    });

    it('should handle vector source with only idb:// URLs using fallback', async () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 2,
      };
      const style = {
        version: 8 as const,
        sources: {
          'vector-source': {
            type: 'vector',
            tiles: ['idb://tiles/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      // idb:// URLs are skipped, but a fallback is created
      // The download will fail but won't throw immediately
      const result = await service.downloadTiles(region, style, 'test-style');
      // The result will show failed tiles
      expect(result.failedTiles).toBeGreaterThan(0);
    });
  });

  describe('getTileStats edge cases', () => {
    it('should handle single tile correctly', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'single-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 0,
        size: 500,
        data: new ArrayBuffer(500),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.count).toBe(1);
      expect(stats.totalSize).toBe(500);
      expect(stats.averageSize).toBe(500);
      expect(stats.oldestTile?.getTime()).toBe(now);
      expect(stats.newestTile?.getTime()).toBe(now);
    });

    it('should handle tiles with same timestamp', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'tile-1.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 0,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'tile-2.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 1,
        y: 0,
        z: 0,
        size: 200,
        data: new ArrayBuffer(200),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.count).toBe(2);
      expect(stats.oldestTile?.getTime()).toBe(now);
      expect(stats.newestTile?.getTime()).toBe(now);
    });

    it('should handle multiple zoom levels correctly', async () => {
      const db = await dbPromise;
      const now = Date.now();

      for (let z = 0; z <= 5; z++) {
        await db.put('tiles', {
          key: `tile-z${z}.pbf`,
          styleId: 'style-1',
          sourceId: 'source',
          x: 0,
          y: 0,
          z,
          size: (z + 1) * 100,
          data: new ArrayBuffer((z + 1) * 100),
          downloadedAt: new Date(now).toISOString(),
          type: 'vector',
          url: `https://example.com/tile-z${z}.pbf`,
          lastModified: now,
        });
      }

      const stats = await service.getTileStats();

      expect(stats.count).toBe(6);
      expect(stats.zoomLevelStats.size).toBe(6);
      expect(stats.zoomLevelStats.get(0)?.count).toBe(1);
      expect(stats.zoomLevelStats.get(0)?.size).toBe(100);
      expect(stats.zoomLevelStats.get(5)?.count).toBe(1);
      expect(stats.zoomLevelStats.get(5)?.size).toBe(600);
    });
  });

  describe('cleanupOldTiles edge cases', () => {
    it('should handle empty database', async () => {
      const deletedCount = await service.cleanupOldTiles(30);
      expect(deletedCount).toBe(0);
    });

    it('should handle maxAge of 1 day', async () => {
      const db = await dbPromise;
      // Create a tile from 2 days ago
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

      await db.put('tiles', {
        key: 'tile-old.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 0,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date(twoDaysAgo).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: twoDaysAgo,
      });

      const deletedCount = await service.cleanupOldTiles(1);

      // Tile older than 1 day should be deleted
      expect(deletedCount).toBe(1);
    });

    it('should handle very old maxAge value', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 0,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      // 1000 days - nothing should be deleted
      const deletedCount = await service.cleanupOldTiles(1000);
      expect(deletedCount).toBe(0);
    });

    it('should delete multiple old tiles at once', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 5; i++) {
        await db.put('tiles', {
          key: `old-tile-${i}.pbf`,
          styleId: 'style-1',
          sourceId: 'source',
          x: i,
          y: 0,
          z: 0,
          size: 100,
          data: new ArrayBuffer(100),
          downloadedAt: new Date(oldTime).toISOString(),
          type: 'vector',
          url: `https://example.com/tile-${i}.pbf`,
          lastModified: oldTime,
        });
      }

      const deletedCount = await service.cleanupOldTiles(30);
      expect(deletedCount).toBe(5);
    });
  });

  describe('generateTileCoordinates', () => {
    it('should generate tiles for the specified zoom range', () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[0, 0], [1, 1]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 2,
      };

      const coords = (service as unknown as { generateTileCoordinates: (r: typeof region) => Array<{ x: number; y: number; z: number }> }).generateTileCoordinates(region);

      expect(coords.length).toBeGreaterThan(0);
      // Should have tiles at zoom 0, 1, and 2
      const zooms = new Set(coords.map(c => c.z));
      expect(zooms.has(0)).toBe(true);
      expect(zooms.has(1)).toBe(true);
      expect(zooms.has(2)).toBe(true);
      expect(zooms.has(3)).toBe(false);
    });

    it('should generate single tile at zoom 0', () => {
      const region = {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-180, -85], [180, 85]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 0,
      };

      const coords = (service as unknown as { generateTileCoordinates: (r: typeof region) => Array<{ x: number; y: number; z: number }> }).generateTileCoordinates(region);

      expect(coords.length).toBe(1);
      expect(coords[0]).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('extractExtension', () => {
    it('should extract pbf extension from template URL', () => {
      const ext = (service as unknown as { extractExtension: (t: string) => string }).extractExtension(
        'https://example.com/tiles/{z}/{x}/{y}.pbf'
      );
      expect(ext).toBe('pbf');
    });

    it('should extract png extension from template URL', () => {
      const ext = (service as unknown as { extractExtension: (t: string) => string }).extractExtension(
        'https://example.com/tiles/{z}/{x}/{y}.png?access_token=pk.test'
      );
      expect(ext).toBe('png');
    });

    it('should extract mvt extension', () => {
      const ext = (service as unknown as { extractExtension: (t: string) => string }).extractExtension(
        'https://example.com/tiles/{z}/{x}/{y}.mvt'
      );
      expect(ext).toBe('mvt');
    });

    it('should extract glb extension for 3D tiles', () => {
      const ext = (service as unknown as { extractExtension: (t: string) => string }).extractExtension(
        'https://a.tiles.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/{z}/{x}/{y}.glb?access_token=pk.test'
      );
      expect(ext).toBe('glb');
    });

    it('should default to pbf when no extension found', () => {
      const ext = (service as unknown as { extractExtension: (t: string) => string }).extractExtension(
        'https://example.com/tiles'
      );
      expect(ext).toBe('pbf');
    });
  });

  describe('selectTileTemplate', () => {
    it('should return the only template when there is one', () => {
      const template = (service as unknown as { selectTileTemplate: (t: readonly string[], c: { x: number; y: number; z: number }) => string }).selectTileTemplate(
        ['https://example.com/{z}/{x}/{y}.pbf'],
        { x: 0, y: 0, z: 0 }
      );
      expect(template).toBe('https://example.com/{z}/{x}/{y}.pbf');
    });

    it('should distribute across multiple templates', () => {
      const templates = [
        'https://a.example.com/{z}/{x}/{y}.pbf',
        'https://b.example.com/{z}/{x}/{y}.pbf',
        'https://c.example.com/{z}/{x}/{y}.pbf',
      ];

      const selectTemplate = (service as unknown as { selectTileTemplate: (t: readonly string[], c: { x: number; y: number; z: number }) => string }).selectTileTemplate.bind(service);

      // Different coords should potentially select different templates
      const results = new Set<string>();
      for (let x = 0; x < 10; x++) {
        results.add(selectTemplate(templates, { x, y: 0, z: 1 }));
      }

      // Should use more than one template
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('populateTemplate', () => {
    it('should replace {z}, {x}, {y} placeholders', () => {
      const url = (service as unknown as { populateTemplate: (t: string, c: { x: number; y: number; z: number }) => string }).populateTemplate(
        'https://example.com/{z}/{x}/{y}.pbf',
        { x: 100, y: 200, z: 12 }
      );
      expect(url).toBe('https://example.com/12/100/200.pbf');
    });
  });

  describe('getTileAnalytics edge cases', () => {
    it('should handle multiple styles', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-a-tile.pbf',
        styleId: 'style-a',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 5,
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      await db.put('tiles', {
        key: 'style-b-tile.pbf',
        styleId: 'style-b',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: now,
      });

      // Get all tiles
      const allAnalytics = await service.getTileAnalytics();
      const allBasic = allAnalytics.basic as { totalTiles: number };
      expect(allBasic.totalTiles).toBe(2);

      // Filter by style-a
      const styleAAnalytics = await service.getTileAnalytics('style-a');
      const styleABasic = styleAAnalytics.basic as { totalTiles: number };
      expect(styleABasic.totalTiles).toBe(1);
    });

    it('should have empty distribution when no tiles', async () => {
      const analytics = await service.getTileAnalytics();
      const distribution = analytics.distribution as { tilesByZoom: Record<string, number> };
      expect(Object.keys(distribution.tilesByZoom).length).toBe(0);
    });
  });
});
