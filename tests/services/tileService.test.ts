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

    it('should handle tiles without z property', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 'style-1:source:legacy-tile.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        // No x, y, z properties (legacy format)
        size: 1000,
        data: new ArrayBuffer(1000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: now,
      });

      const stats = await service.getTileStats();

      expect(stats.count).toBe(1);
      // Should use z=0 as fallback
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
});
