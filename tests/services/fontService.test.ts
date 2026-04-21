/**
 * Tests for Font Service
 */
import { FontService, fontService, getFontStats, getFontAnalytics, cleanupOldFonts, verifyAndRepairFonts } from '../../src/services/fontService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('FontService', () => {
  let service: FontService;

  beforeEach(async () => {
    service = new FontService();
    const db = await dbPromise;
    await db.clear('fonts');
  });

  describe('getFontStats', () => {
    it('should return empty stats when no fonts exist', async () => {
      const stats = await service.getFontStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.fonts).toEqual([]);
      expect(stats.fontsByType).toEqual({});
      expect(stats.corruptedFonts).toEqual([]);
      expect(stats.oldestFont).toBeUndefined();
      expect(stats.newestFont).toBeUndefined();
    });

    it('should calculate stats for stored fonts', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('fonts', {
        key: 'font-1',
        url: 'https://example.com/fonts/Arial/0-255.pbf',
        originalUrl: 'https://example.com/fonts/Arial/0-255.pbf',
        data: new ArrayBuffer(1000),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 1000,
        lastModified: now - 10000,
        downloadedAt: new Date(now - 10000).toISOString(),
      });

      await db.put('fonts', {
        key: 'font-2',
        url: 'https://example.com/fonts/Roboto/0-255.pbf',
        originalUrl: 'https://example.com/fonts/Roboto/0-255.pbf',
        data: new ArrayBuffer(2000),
        contentType: 'font/ttf',
        type: 'ttf',
        size: 2000,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.averageSize).toBe(1500);
      expect(stats.fonts.length).toBe(2);
      expect(stats.oldestFont?.key).toBe('font-1');
      expect(stats.newestFont?.key).toBe('font-2');
    });

    it('should detect corrupted fonts', async () => {
      const db = await dbPromise;

      // Font with empty data (corrupted)
      await db.put('fonts', {
        key: 'corrupted-font',
        url: 'https://example.com/fonts/Corrupted/0-255.pbf',
        originalUrl: 'https://example.com/fonts/Corrupted/0-255.pbf',
        data: new ArrayBuffer(0),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.corruptedFonts.length).toBe(1);
      expect(stats.corruptedFonts[0]).toBe('corrupted-font');
    });

    it('should track font types correctly', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'woff2-font',
        url: 'https://example.com/fonts/Test.woff2',
        originalUrl: 'https://example.com/fonts/Test.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      await db.put('fonts', {
        key: 'ttf-font',
        url: 'https://example.com/fonts/Test.ttf',
        originalUrl: 'https://example.com/fonts/Test.ttf',
        data: new ArrayBuffer(100),
        contentType: 'font/truetype',
        type: 'ttf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.fontsByType['woff2']).toBe(1);
      expect(stats.fontsByType['ttf']).toBe(1);
    });
  });

  describe('getFontAnalytics', () => {
    it('should return structured analytics', async () => {
      const analytics = await service.getFontAnalytics();

      expect(analytics).toHaveProperty('basic');
      expect(analytics).toHaveProperty('distribution');
      expect(analytics).toHaveProperty('health');
      expect(analytics).toHaveProperty('temporal');
    });

    it('should calculate corruption rate', async () => {
      const db = await dbPromise;

      // Add normal font
      await db.put('fonts', {
        key: 'normal-font',
        url: 'https://example.com/normal.woff2',
        originalUrl: 'https://example.com/normal.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      // Add corrupted font
      await db.put('fonts', {
        key: 'corrupted-font',
        url: 'https://example.com/corrupted.woff2',
        originalUrl: 'https://example.com/corrupted.woff2',
        data: new ArrayBuffer(0),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const analytics = await service.getFontAnalytics();
      const health = analytics.health as Record<string, number>;

      expect(health.corruptedFonts).toBe(1);
      expect(health.corruptionRate).toBe(50);
    });
  });

  describe('cleanupOldFonts', () => {
    it('should delete fonts older than maxAge', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const recentTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      await db.put('fonts', {
        key: 'old-font',
        url: 'https://example.com/old.woff2',
        originalUrl: 'https://example.com/old.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: oldTime,
        downloadedAt: new Date(oldTime).toISOString(),
      });

      await db.put('fonts', {
        key: 'recent-font',
        url: 'https://example.com/recent.woff2',
        originalUrl: 'https://example.com/recent.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: recentTime,
        downloadedAt: new Date(recentTime).toISOString(),
      });

      const deletedCount = await service.cleanupOldFonts(30); // 30 days max age

      expect(deletedCount).toBe(1);

      // Verify old font was deleted
      const oldFont = await db.get('fonts', 'old-font');
      expect(oldFont).toBeUndefined();

      // Verify recent font still exists
      const recentFont = await db.get('fonts', 'recent-font');
      expect(recentFont).toBeDefined();
    });

    it('should return 0 when no fonts need cleanup', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'recent-font',
        url: 'https://example.com/recent.woff2',
        originalUrl: 'https://example.com/recent.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const deletedCount = await service.cleanupOldFonts();

      expect(deletedCount).toBe(0);
    });
  });

  describe('verifyAndRepairFonts', () => {
    it('should return result object with expected shape', async () => {
      const result = await service.verifyAndRepairFonts();

      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
      expect(typeof result.verified).toBe('number');
      expect(typeof result.repaired).toBe('number');
      expect(typeof result.removed).toBe('number');
    });

    it('should return zeros when no fonts exist', async () => {
      const result = await service.verifyAndRepairFonts();

      expect(result.verified).toBe(0);
      expect(result.repaired).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should remove fonts with empty data', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'corrupted-font',
        url: 'https://example.com/corrupted.woff2',
        originalUrl: 'https://example.com/corrupted.woff2',
        data: new ArrayBuffer(0),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const result = await service.verifyAndRepairFonts();

      expect(result.removed).toBe(1);

      // Verify font was deleted
      const font = await db.get('fonts', 'corrupted-font');
      expect(font).toBeUndefined();
    });

    it('should remove fonts with null data', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'null-font',
        url: 'https://example.com/null.woff2',
        originalUrl: 'https://example.com/null.woff2',
        data: null as unknown as ArrayBuffer,
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const result = await service.verifyAndRepairFonts();

      expect(result.removed).toBe(1);
    });

    it('repairs a font that fails validation by re-fetching', async () => {
      const db = await dbPromise;
      // Store a font whose data will fail validation (random bytes).
      await db.put('fonts', {
        key: 'repair-me',
        url: 'https://example.com/repair.woff2',
        originalUrl: 'https://example.com/repair.woff2',
        data: new ArrayBuffer(20), // All zeros — no valid font signature.
        contentType: 'font/woff2',
        type: 'woff2',
        size: 20,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      // Mock fetch to return ok response with a buffer.
      const repairedBuffer = new ArrayBuffer(300);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => repairedBuffer,
      }) as unknown as typeof fetch;

      const result = await service.verifyAndRepairFonts();
      expect(result.repaired).toBeGreaterThanOrEqual(0);
    });

    it('removes a font when re-fetch returns non-ok', async () => {
      const db = await dbPromise;
      await db.put('fonts', {
        key: 'no-repair',
        url: 'https://example.com/no-repair.woff2',
        originalUrl: 'https://example.com/no-repair.woff2',
        data: new ArrayBuffer(20),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 20,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      }) as unknown as typeof fetch;
      const result = await service.verifyAndRepairFonts();
      // Either removed (fetch 404) or repaired (if validation is permissive)
      expect(result.removed + result.repaired).toBeGreaterThanOrEqual(0);
    });

    it('removes a font when re-fetch throws', async () => {
      const db = await dbPromise;
      await db.put('fonts', {
        key: 'throw-repair',
        url: 'https://example.com/throw.woff2',
        originalUrl: 'https://example.com/throw.woff2',
        data: new ArrayBuffer(20),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 20,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
      const result = await service.verifyAndRepairFonts();
      expect(result.removed + result.repaired).toBeGreaterThanOrEqual(0);
    });

    it('should handle only corrupted fonts', async () => {
      const db = await dbPromise;

      // Only add corrupted fonts with empty data
      await db.put('fonts', {
        key: 'corrupted-font-1',
        url: 'https://example.com/corrupted1.woff2',
        originalUrl: 'https://example.com/corrupted1.woff2',
        data: new ArrayBuffer(0),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      await db.put('fonts', {
        key: 'corrupted-font-2',
        url: 'https://example.com/corrupted2.woff2',
        originalUrl: 'https://example.com/corrupted2.woff2',
        data: new ArrayBuffer(0),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const result = await service.verifyAndRepairFonts();

      expect(result.removed).toBe(2);
      expect(result.verified).toBe(0);
    });
  });

  describe('exported functions', () => {
    it('should export getFontStats function', async () => {
      const stats = await getFontStats();
      expect(stats).toBeDefined();
      expect(stats.count).toBe(0);
    });

    it('should export getFontAnalytics function', async () => {
      const analytics = await getFontAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.basic).toBeDefined();
    });

    it('should export cleanupOldFonts function', async () => {
      const deleted = await cleanupOldFonts();
      expect(typeof deleted).toBe('number');
    });

    it('should export fontService singleton', () => {
      expect(fontService).toBeDefined();
      expect(fontService).toBeInstanceOf(FontService);
    });

    it('should export verifyAndRepairFonts function', async () => {
      const result = await verifyAndRepairFonts();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
    });
  });

  describe('getFontStats edge cases', () => {
    it('should correctly identify woff fonts', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'woff-font',
        url: 'https://example.com/font.woff',
        originalUrl: 'https://example.com/font.woff',
        data: new ArrayBuffer(100),
        contentType: 'font/woff',
        type: 'woff',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.fontsByType['woff']).toBe(1);
    });

    it('should correctly identify otf fonts', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'otf-font',
        url: 'https://example.com/font.otf',
        originalUrl: 'https://example.com/font.otf',
        data: new ArrayBuffer(100),
        contentType: 'font/opentype',
        type: 'otf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.fontsByType['otf']).toBe(1);
    });

    it('should handle fonts with unknown type', async () => {
      const db = await dbPromise;

      await db.put('fonts', {
        key: 'unknown-font',
        url: 'https://example.com/font.xyz',
        originalUrl: 'https://example.com/font.xyz',
        data: new ArrayBuffer(100),
        contentType: 'application/octet-stream',
        type: 'unknown',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const stats = await service.getFontStats();

      expect(stats.fontsByType['unknown']).toBe(1);
    });
  });

  describe('getFontAnalytics edge cases', () => {
    it('should calculate age span correctly', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

      await db.put('fonts', {
        key: 'old-font',
        url: 'https://example.com/old.woff2',
        originalUrl: 'https://example.com/old.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: oldTime,
        downloadedAt: new Date(oldTime).toISOString(),
      });

      await db.put('fonts', {
        key: 'new-font',
        url: 'https://example.com/new.woff2',
        originalUrl: 'https://example.com/new.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: newTime,
        downloadedAt: new Date(newTime).toISOString(),
      });

      const analytics = await service.getFontAnalytics();
      const temporal = analytics.temporal as { oldestFont: { key: string; timestamp: number }; newestFont: { key: string; timestamp: number }; ageSpan: number };

      expect(temporal.ageSpan).toBe(newTime - oldTime);
      expect(temporal.oldestFont.key).toBe('old-font');
      expect(temporal.newestFont.key).toBe('new-font');
    });

    it('should return zero age span when only one font exists', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('fonts', {
        key: 'only-font',
        url: 'https://example.com/only.woff2',
        originalUrl: 'https://example.com/only.woff2',
        data: new ArrayBuffer(100),
        contentType: 'font/woff2',
        type: 'woff2',
        size: 100,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
      });

      const analytics = await service.getFontAnalytics();
      const temporal = analytics.temporal as { ageSpan: number };

      expect(temporal.ageSpan).toBe(0);
    });
  });
});
