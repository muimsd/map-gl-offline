/**
 * Tests for Analytics Service
 */
import { AnalyticsService } from '../../src/services/analyticsService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    service = new AnalyticsService();
    const db = await dbPromise;
    await db.clear('styles');
    await db.clear('tiles');
    await db.clear('fonts');
    await db.clear('sprites');
    await db.clear('glyphs');
  });

  describe('getAllTileStats', () => {
    it('should return empty stats when no styles exist', async () => {
      const stats = await service.getAllTileStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
    });

    it('should aggregate stats from multiple styles', async () => {
      const db = await dbPromise;

      // Add styles
      await db.put('styles', {
        key: 'style-1',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      await db.put('styles', {
        key: 'style-2',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const stats = await service.getAllTileStats();

      expect(stats).toBeDefined();
      expect(typeof stats.count).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
    });
  });

  describe('getAllFontStats', () => {
    it('should return font statistics', async () => {
      const stats = await service.getAllFontStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('averageSize');
      expect(stats).toHaveProperty('fonts');
      expect(stats).toHaveProperty('fontsByType');
    });

    it('should return zero counts when no fonts exist', async () => {
      const stats = await service.getAllFontStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('getAllSpriteStats', () => {
    it('should return sprite statistics', async () => {
      const stats = await service.getAllSpriteStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('averageSize');
      expect(stats).toHaveProperty('sprites');
      expect(stats).toHaveProperty('spritesByType');
    });

    it('should return zero counts when no sprites exist', async () => {
      const stats = await service.getAllSpriteStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('getAllGlyphStats', () => {
    it('should return glyph statistics', async () => {
      const stats = await service.getAllGlyphStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('averageSize');
      expect(stats).toHaveProperty('glyphs');
      expect(stats).toHaveProperty('fontsByStack');
    });

    it('should return zero counts when no glyphs exist', async () => {
      const stats = await service.getAllGlyphStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('getComprehensiveStorageAnalytics', () => {
    it('should return comprehensive analytics report', async () => {
      const mockRegionAnalytics = async () => ({
        totalRegions: 0,
        totalSize: 0,
        averageSize: 0,
        regionsByStyle: {},
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 0,
        },
      });

      const report = await service.getComprehensiveStorageAnalytics(mockRegionAnalytics);

      expect(report).toBeDefined();
      expect(report).toHaveProperty('tiles');
      expect(report).toHaveProperty('fonts');
      expect(report).toHaveProperty('sprites');
      expect(report).toHaveProperty('glyphs');
      expect(report).toHaveProperty('regions');
      expect(report).toHaveProperty('totalStorageSize');
      expect(report).toHaveProperty('storageByType');
      expect(report).toHaveProperty('recommendations');
    });

    it('should calculate total storage size', async () => {
      const mockRegionAnalytics = async () => ({
        totalRegions: 0,
        totalSize: 0,
        averageSize: 0,
        regionsByStyle: {},
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 0,
        },
      });

      const report = await service.getComprehensiveStorageAnalytics(mockRegionAnalytics);

      expect(report.totalStorageSize).toBe(0);
      expect(report.storageByType.tiles).toBe(0);
      expect(report.storageByType.fonts).toBe(0);
      expect(report.storageByType.sprites).toBe(0);
      expect(report.storageByType.glyphs).toBe(0);
    });

    it('should generate recommendations for expired regions', async () => {
      const mockRegionAnalytics = async () => ({
        totalRegions: 5,
        totalSize: 1000,
        averageSize: 200,
        regionsByStyle: { 'style-1': 5 },
        expiryDistribution: {
          expired: 3,
          expiringWithin24h: 0,
          expiringWithin7d: 1,
          neverExpiring: 1,
        },
      });

      const report = await service.getComprehensiveStorageAnalytics(mockRegionAnalytics);

      expect(report.recommendations).toContain('3 expired regions found. Run cleanup to free storage.');
    });

    it('should generate recommendations for many regions', async () => {
      const mockRegionAnalytics = async () => ({
        totalRegions: 25,
        totalSize: 1000,
        averageSize: 40,
        regionsByStyle: { 'style-1': 25 },
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 25,
        },
      });

      const report = await service.getComprehensiveStorageAnalytics(mockRegionAnalytics);

      expect(report.recommendations.some(r => r.includes('Many regions stored'))).toBe(true);
    });

    it('emits recommendations for every over-threshold metric', async () => {
      const db = await dbPromise;
      // Seed a large tile to bump tile count / totalSize / average size.
      // Use many small entries to simulate volume without gigabytes of data.
      const bigTile = new ArrayBuffer(60_000); // > 50KB triggers the avg-size rec
      await db.put('tiles', {
        key: 'big:v:0:0:0.pbf',
        styleId: 'big',
        sourceId: 'v',
        x: 0, y: 0, z: 0,
        size: 1100 * 1024 * 1024, // 1.1 GB — triggers the > 1000 MB rec
        data: bigTile,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'http://t',
        lastModified: Date.now(),
      });

      // Override stats methods to simulate high counts without having to
      // actually insert 50k+ tiles/fonts/sprites/glyphs.
      jest.spyOn(service, 'getAllTileStats').mockResolvedValue({
        count: 60_000,
        totalSize: 1100 * 1024 * 1024,
        averageSize: 60_000,
        tilesByStyle: {},
        tilesByType: {},
      } as never);
      jest.spyOn(service, 'getAllFontStats').mockResolvedValue({
        count: 1500,
        totalSize: 1000,
        averageSize: 1,
        fontsByType: {},
      } as never);
      jest.spyOn(service, 'getAllSpriteStats').mockResolvedValue({
        count: 600,
        totalSize: 1000,
        averageSize: 1,
        spritesByStyle: {},
        spritesByType: {},
      } as never);
      jest.spyOn(service, 'getAllGlyphStats').mockResolvedValue({
        count: 3000,
        totalSize: 1000,
        averageSize: 1,
        glyphsByStack: {},
      } as never);

      const mockRegionAnalytics = async () => ({
        totalRegions: 0,
        totalSize: 0,
        averageSize: 0,
        regionsByStyle: {},
        expiryDistribution: {
          expired: 0,
          expiringWithin24h: 0,
          expiringWithin7d: 0,
          neverExpiring: 0,
        },
      });

      const report = await service.getComprehensiveStorageAnalytics(mockRegionAnalytics);
      // All the over-threshold recommendation lines should be present.
      const joined = report.recommendations.join('\n');
      expect(joined).toMatch(/Large storage usage/i);
      expect(joined).toMatch(/High tile count/i);
      expect(joined).toMatch(/Many fonts stored/i);
      expect(joined).toMatch(/Large number of sprites/i);
      expect(joined).toMatch(/High glyph count/i);
      expect(joined).toMatch(/Large average tile size/i);
    });
  });
});
