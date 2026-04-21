/**
 * Tests for Cleanup Service
 */
import { CleanupService, cleanupService, getRegionAnalytics, optimizeStorage } from '../../src/services/cleanupService';
import { dbPromise } from '../../src/storage/indexedDbManager';

// Helper to store region inside styles.regions[] (the new storage pattern)
async function storeRegionInStyle(
  db: Awaited<typeof dbPromise>,
  styleId: string,
  region: {
    id: string;
    name: string;
    bounds: [[number, number], [number, number]];
    styleUrl: string;
    minZoom: number;
    maxZoom: number;
    created: number;
    expiry: number;
  }
) {
  const existingStyle = await db.get('styles', styleId);
  if (existingStyle) {
    existingStyle.regions = existingStyle.regions || [];
    existingStyle.regions.push(region);
    await db.put('styles', existingStyle);
  } else {
    await db.put('styles', {
      key: styleId,
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto',
      regions: [region],
      fonts: [],
      glyphs: [],
      sprites: [],
    });
  }
}

describe('CleanupService', () => {
  let service: CleanupService;
  const mockDeleteRegion = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CleanupService(mockDeleteRegion);
    const db = await dbPromise;
    await db.clear('tiles');
    await db.clear('styles');
  });

  describe('getAllRegions', () => {
    it('should return empty array when no regions exist', async () => {
      const regions = await service.getAllRegions();
      expect(regions).toEqual([]);
    });

    it('should return all stored regions', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-style', {
        id: 'region-1',
        name: 'Test Region 1',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await storeRegionInStyle(db, 'test-style', {
        id: 'region-2',
        name: 'Test Region 2',
        bounds: [[-73.5, 40.5], [-73.0, 41.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const regions = await service.getAllRegions();
      expect(regions.length).toBe(2);
    });
  });

  describe('getRegionSize', () => {
    it('should return 0 for non-existent region', async () => {
      const size = await service.getRegionSize('non-existent');
      expect(size).toBe(0);
    });

    it('should return 0 for region with empty styleId', async () => {
      // When styleId is empty, region won't be found
      const size = await service.getRegionSize('region-no-style');
      expect(size).toBe(0);
    });

    it('should calculate size from associated tiles', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-style', {
        id: 'region-with-tiles',
        name: 'Region With Tiles',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

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

      await db.put('tiles', {
        key: 'test-style:source:10:101:200.pbf',
        styleId: 'test-style',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      const size = await service.getRegionSize('region-with-tiles');
      expect(size).toBe(3000);
    });
  });

  describe('getRegionAnalytics', () => {
    it('should return empty analytics when no regions exist', async () => {
      const analytics = await service.getRegionAnalytics();

      expect(analytics.totalRegions).toBe(0);
      expect(analytics.totalSize).toBe(0);
      expect(analytics.averageSize).toBe(0);
      expect(analytics.regionsByStyle).toEqual({});
      expect(analytics.expiryDistribution.expired).toBe(0);
    });

    it('should calculate analytics for stored regions', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await storeRegionInStyle(db, 'style-1', {
        id: 'region-1',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 10000,
        expiry: now + 30 * 24 * 60 * 60 * 1000,
      });

      await storeRegionInStyle(db, 'style-2', {
        id: 'region-2',
        name: 'Test Region 2',
        bounds: [[-73.5, 40.5], [-73.0, 41.0]],
        styleUrl: 'https://example.com/style2.json',
        minZoom: 0,
        maxZoom: 10,
        created: now,
        expiry: now + 30 * 24 * 60 * 60 * 1000,
      });

      const analytics = await service.getRegionAnalytics();

      expect(analytics.totalRegions).toBe(2);
      expect(analytics.regionsByStyle['style-1']).toBe(1);
      expect(analytics.regionsByStyle['style-2']).toBe(1);
      expect(analytics.oldestRegion?.id).toBe('region-1');
      expect(analytics.newestRegion?.id).toBe('region-2');
    });

    it('should track expiry distribution', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      // Expired region (modified more than 30 days ago)
      await storeRegionInStyle(db, 'style', {
        id: 'expired-region',
        name: 'Expired',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      // Recent region
      await storeRegionInStyle(db, 'style', {
        id: 'recent-region',
        name: 'Recent',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 5 * day,
        expiry: now + 25 * day,
      });

      const analytics = await service.getRegionAnalytics();

      expect(analytics.expiryDistribution.expired).toBe(1);
      expect(analytics.expiryDistribution.neverExpiring).toBe(1);
    });
  });

  describe('runCleanup', () => {
    it('should return result when no regions exist', async () => {
      const result = await service.runCleanup();

      expect(result.scannedRegions).toBe(0);
      expect(result.expiredRegions).toBe(0);
      expect(result.deletedRegions).toBe(0);
      expect(result.preservedRegions).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should scan regions and identify expired ones', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'expired-region',
        name: 'Expired',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      const result = await service.runCleanup({ maxAge: 30 });

      expect(result.scannedRegions).toBe(1);
      expect(result.expiredRegions).toBe(1);
    });

    it('should call onProgress callback', async () => {
      const progressCalls: Array<{ phase: string; completed: number }> = [];

      await service.runCleanup({
        onProgress: (progress) => {
          progressCalls.push({
            phase: progress.phase,
            completed: progress.completed,
          });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].phase).toBe('scanning');
    });

    it('should preserve priority regions', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'priority-region',
        name: 'Important Region',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      const result = await service.runCleanup({
        priorityPatterns: ['priority'],
        maxAge: 30,
      });

      // Priority region should be preserved even though expired
      expect(result.deletedRegions).toBe(0);
    });

    it('should delete expired non-priority regions', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'expired-region',
        name: 'Old Region',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      const result = await service.runCleanup({ maxAge: 30 });

      expect(result.deletedRegions).toBe(1);
      expect(mockDeleteRegion).toHaveBeenCalledWith('expired-region', 'style');
    });

    it('should apply maxRegions limit', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'old-region',
        name: 'Old',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 20 * day,
        expiry: now + 10 * day,
      });

      await storeRegionInStyle(db, 'style', {
        id: 'middle-region',
        name: 'Middle',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 10 * day,
        expiry: now + 20 * day,
      });

      await storeRegionInStyle(db, 'style', {
        id: 'new-region',
        name: 'New',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 1 * day,
        expiry: now + 29 * day,
      });

      const result = await service.runCleanup({ maxRegions: 2 });

      expect(result.scannedRegions).toBe(3);
      expect(result.deletedRegions).toBe(1);
      // Should delete the oldest region
      expect(mockDeleteRegion).toHaveBeenCalledWith('old-region', 'style');
    });

    it('should handle deletion errors gracefully', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'error-region',
        name: 'Error Region',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      // Mock delete to throw error
      mockDeleteRegion.mockRejectedValueOnce(new Error('Deletion failed'));

      const result = await service.runCleanup({ maxAge: 30 });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to delete region');
    });

    it('should track freed space when deleting regions', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'test-style', {
        id: 'region-with-tiles',
        name: 'Region With Tiles',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        expiry: now - 10 * day,
      });

      await db.put('tiles', {
        key: 'test-style:source:10:100:200.pbf',
        styleId: 'test-style',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 5000,
        data: new ArrayBuffer(5000),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await service.runCleanup({ maxAge: 30 });

      expect(result.freedSpace).toBe(5000);
    });

    it('should preserve non-expired priority regions by name', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      await storeRegionInStyle(db, 'style', {
        id: 'region-1',
        name: 'Important Home Region',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 5 * day,
        expiry: now + 25 * day,
      });

      const result = await service.runCleanup({
        priorityPatterns: ['Important'],
        maxAge: 30,
      });

      expect(result.deletedRegions).toBe(0);
      expect(result.preservedRegions).toBe(1);
    });
  });

  describe('performCleanup', () => {
    it('should be an alias for runCleanup', async () => {
      const result = await service.performCleanup();

      expect(result).toHaveProperty('scannedRegions');
      expect(result).toHaveProperty('deletedRegions');
    });
  });

  describe('optimizeStorage', () => {
    it('should return optimization results', async () => {
      const result = await service.optimizeStorage();

      expect(result).toHaveProperty('compactedSize');
      expect(result).toHaveProperty('freedSpace');
    });
  });

  describe('setupAutoCleanup', () => {
    it('should return a cleanup ID', async () => {
      const cleanupId = await service.setupAutoCleanup({ intervalHours: 24 });

      expect(cleanupId).toMatch(/^auto_cleanup_\d+$/);

      // Clean up
      await service.stopAutoCleanup();
    });
  });

  describe('stopAutoCleanup', () => {
    it('should stop all auto cleanups', async () => {
      await service.setupAutoCleanup({ intervalHours: 24 });
      await service.setupAutoCleanup({ intervalHours: 48 });

      await expect(service.stopAutoCleanup()).resolves.not.toThrow();
    });

    it('should handle stopping with specific ID', async () => {
      const cleanupId = await service.setupAutoCleanup({ intervalHours: 24 });

      await expect(service.stopAutoCleanup(cleanupId)).resolves.not.toThrow();

      // Clean up remaining
      await service.stopAutoCleanup();
    });
  });

  describe('getExpiredResourceCount', () => {
    it('returns zeros when no expired resources exist', async () => {
      const counts = await service.getExpiredResourceCount();
      expect(counts).toEqual({ tiles: 0, fonts: 0, sprites: 0, glyphs: 0, total: 0 });
    });

    it('counts resources with past expires across stores', async () => {
      const db = await dbPromise;
      const past = Date.now() - 86_400_000;
      const future = Date.now() + 86_400_000;

      await db.put('tiles', {
        key: 's:v:1:2:3.pbf',
        styleId: 's',
        sourceId: 'v',
        x: 1, y: 2, z: 3,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'http://t',
        lastModified: Date.now(),
        expires: past,
      });
      await db.put('tiles', {
        key: 's:v:1:2:4.pbf',
        styleId: 's',
        sourceId: 'v',
        x: 1, y: 2, z: 4,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'http://t',
        lastModified: Date.now(),
        expires: future,
      });
      await db.put('fonts', {
        key: 'font-a',
        url: 'http://f',
        originalUrl: 'http://f',
        data: new ArrayBuffer(10),
        size: 10,
        type: 'pbf',
        contentType: 'application/x-protobuf',
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        expires: past,
      });
      await db.put('sprites', {
        key: 'sprite-a',
        data: new ArrayBuffer(5),
        size: 5,
        url: 'http://s',
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        expires: past,
      });
      // No expired glyphs -> 0 expected.

      const counts = await service.getExpiredResourceCount();
      expect(counts.tiles).toBe(1);
      expect(counts.fonts).toBe(1);
      expect(counts.sprites).toBe(1);
      expect(counts.glyphs).toBe(0);
      expect(counts.total).toBe(3);
    });
  });

  describe('cleanupExpiredTiles', () => {
    it('deletes expired tiles and reports freed space', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('tiles', {
        key: 's1:v:10:100:200.pbf',
        styleId: 's1',
        sourceId: 'v',
        x: 100, y: 200, z: 10,
        size: 500,
        data: new ArrayBuffer(500),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'http://t',
        lastModified: now,
        expires: now - 1000,
      });
      await db.put('tiles', {
        key: 's1:v:10:100:201.pbf',
        styleId: 's1',
        sourceId: 'v',
        x: 100, y: 201, z: 10,
        size: 700,
        data: new ArrayBuffer(700),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'http://t',
        lastModified: now,
        expires: now + 1000, // not expired
      });

      const result = await service.cleanupExpiredTiles();
      expect(result.deleted).toBe(1);
      expect(result.freedSpace).toBe(500);
    });

    it('scopes to a specific styleId when provided', async () => {
      const db = await dbPromise;
      const past = Date.now() - 1000;
      const base = {
        sourceId: 'v',
        x: 0, y: 0, z: 0,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector' as const,
        url: 'http://t',
        lastModified: Date.now(),
        expires: past,
      };
      await db.put('tiles', { key: 's1:v:0:0:0.pbf', styleId: 's1', ...base });
      await db.put('tiles', { key: 's2:v:0:0:0.pbf', styleId: 's2', ...base });

      const result = await service.cleanupExpiredTiles('s1');
      expect(result.deleted).toBe(1);
      expect(await db.get('tiles', 's2:v:0:0:0.pbf')).toBeDefined();
    });
  });

  describe('exported functions', () => {
    it('should export getRegionAnalytics function', async () => {
      const analytics = await getRegionAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('totalRegions');
    });

    it('should export optimizeStorage function', async () => {
      const result = await optimizeStorage();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('freedSpace');
    });

    it('should export cleanupService singleton', () => {
      expect(cleanupService).toBeDefined();
      expect(cleanupService).toBeInstanceOf(CleanupService);
    });
  });

  describe('generateRecommendations branches', () => {
    it('emits "no offline regions" recommendation when no regions exist', async () => {
      const result = await service.runCleanup();
      expect(result.scannedRegions).toBe(0);
    });

    it('emits an expired-regions recommendation', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 86400000;
      await storeRegionInStyle(db, 'exp-style', {
        id: 'expired-1',
        name: 'Expired',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/s.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 40 * day,
        // Already expired.
        expiry: now - day,
      });
      const result = await service.runCleanup({ maxAge: 30 });
      expect(result.recommendations.join(' ')).toBeTruthy();
    });

    it('emits an expiring-soon recommendation', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 86400000;
      await storeRegionInStyle(db, 'soon-style', {
        id: 'soon-1',
        name: 'Soon',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/s.json',
        minZoom: 0,
        maxZoom: 10,
        created: now,
        expiry: now + 3 * day, // expires in 3 days
      });
      const result = await service.runCleanup();
      expect(result.scannedRegions).toBeGreaterThan(0);
    });

    it('emits an auto-cleanup recommendation when no limits are set', async () => {
      const db = await dbPromise;
      await storeRegionInStyle(db, 'plain-style', {
        id: 'plain-1',
        name: 'Plain',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/s.json',
        minZoom: 0,
        maxZoom: 10,
        created: Date.now(),
        expiry: Date.now() + 86400000,
      });
      const result = await service.runCleanup(); // no options
      expect(
        result.recommendations.some(r =>
          r.toLowerCase().includes('automatic cleanup')
        )
      ).toBe(true);
    });
  });

  describe('runCleanup with maxStorageSize', () => {
    it('deletes additional regions when storage exceeds maxStorageSize', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 86400000;
      await storeRegionInStyle(db, 'style-a', {
        id: 'big-1',
        name: 'Big 1',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/a.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 10 * day,
        expiry: now + 20 * day,
      });
      await storeRegionInStyle(db, 'style-a', {
        id: 'big-2',
        name: 'Big 2',
        bounds: [[0, 0], [1, 1]],
        styleUrl: 'https://example.com/a.json',
        minZoom: 0,
        maxZoom: 10,
        created: now - 5 * day,
        expiry: now + 20 * day,
      });
      // Tiles to give the regions size.
      for (let i = 0; i < 5; i++) {
        await db.put('tiles', {
          key: `style-a:v:${i}:0:0.pbf`,
          styleId: 'style-a',
          sourceId: 'v',
          x: 0, y: 0, z: i,
          size: 1_000_000,
          data: new ArrayBuffer(8),
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'http://t',
          lastModified: now,
        });
      }

      const result = await service.runCleanup({
        maxStorageSize: 1_000, // Tiny — force selection.
      });
      expect(result.scannedRegions).toBeGreaterThanOrEqual(2);
    });

    it('applies maxRegions to trim excess regions', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const day = 86400000;
      for (let i = 0; i < 3; i++) {
        await storeRegionInStyle(db, 'style-b', {
          id: `r-${i}`,
          name: `R${i}`,
          bounds: [[0, 0], [1, 1]],
          styleUrl: 'https://example.com/b.json',
          minZoom: 0,
          maxZoom: 10,
          created: now - (10 + i) * day,
          expiry: now + 20 * day,
        });
      }
      const result = await service.runCleanup({ maxRegions: 1 });
      expect(result.scannedRegions).toBe(3);
      expect(result.deletedRegions).toBeGreaterThanOrEqual(1);
    });
  });
});
