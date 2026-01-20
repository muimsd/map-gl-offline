/**
 * Tests for Sprite Service
 */
import { SpriteService, spriteService, getSpriteStats, getSpriteAnalytics, cleanupOldSprites, verifyAndRepairSprites } from '../../src/services/spriteService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('SpriteService', () => {
  let service: SpriteService;

  beforeEach(async () => {
    service = new SpriteService();
    const db = await dbPromise;
    await db.clear('sprites');
  });

  describe('getSpriteStats', () => {
    it('should return empty stats when no sprites exist', async () => {
      const stats = await service.getSpriteStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.sprites).toEqual([]);
      expect(stats.spritesByType).toEqual({});
      expect(stats.sizeByType).toEqual({});
      expect(stats.corruptedSprites).toEqual([]);
      expect(stats.oldestSprite).toBeUndefined();
      expect(stats.newestSprite).toBeUndefined();
    });

    it('should calculate stats for stored sprites', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('sprites', {
        key: 'test-style::sprite.png',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(1000),
        contentType: 'image/png',
        size: 1000,
        lastModified: now - 10000,
        downloadedAt: new Date(now - 10000).toISOString(),
        styleId: 'test-style',
        spriteName: 'sprite.png',
      });

      await db.put('sprites', {
        key: 'test-style::sprite.json',
        url: 'https://example.com/sprite.json',
        data: new ArrayBuffer(500),
        contentType: 'application/json',
        size: 500,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        styleId: 'test-style',
        spriteName: 'sprite.json',
      });

      const stats = await service.getSpriteStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(1500);
      expect(stats.averageSize).toBe(750);
      expect(stats.sprites.length).toBe(2);
      expect(stats.oldestSprite?.name).toBe('sprite.png');
      expect(stats.newestSprite?.name).toBe('sprite.json');
    });

    it('should detect corrupted sprites', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'corrupted-sprite',
        url: 'https://example.com/corrupted.png',
        data: new ArrayBuffer(0),
        contentType: 'image/png',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'corrupted.png',
      });

      const stats = await service.getSpriteStats();

      expect(stats.corruptedSprites.length).toBe(1);
      expect(stats.corruptedSprites[0]).toBe('corrupted-sprite');
    });

    it('should track sprite types correctly', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'png-sprite',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.png',
      });

      await db.put('sprites', {
        key: 'json-sprite',
        url: 'https://example.com/sprite.json',
        data: new ArrayBuffer(200),
        contentType: 'application/json',
        size: 200,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.json',
      });

      const stats = await service.getSpriteStats();

      expect(stats.spritesByType['png']).toBe(1);
      expect(stats.spritesByType['json']).toBe(1);
      expect(stats.sizeByType['png']).toBe(100);
      expect(stats.sizeByType['json']).toBe(200);
    });
  });

  describe('getSpriteAnalytics', () => {
    it('should return structured analytics', async () => {
      const analytics = await service.getSpriteAnalytics();

      expect(analytics).toHaveProperty('basic');
      expect(analytics).toHaveProperty('distribution');
      expect(analytics).toHaveProperty('health');
      expect(analytics).toHaveProperty('temporal');
    });

    it('should calculate corruption rate', async () => {
      const db = await dbPromise;

      // Add normal sprite
      await db.put('sprites', {
        key: 'normal-sprite',
        url: 'https://example.com/normal.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'normal.png',
      });

      // Add corrupted sprite
      await db.put('sprites', {
        key: 'corrupted-sprite',
        url: 'https://example.com/corrupted.png',
        data: new ArrayBuffer(0),
        contentType: 'image/png',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'corrupted.png',
      });

      const analytics = await service.getSpriteAnalytics();
      const health = analytics.health as Record<string, number>;

      expect(health.corruptedSprites).toBe(1);
      expect(health.corruptionRate).toBe(50);
    });

    it('should calculate age span', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

      await db.put('sprites', {
        key: 'old-sprite',
        url: 'https://example.com/old.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: oldTime,
        downloadedAt: new Date(oldTime).toISOString(),
        styleId: 'test',
        spriteName: 'old.png',
      });

      await db.put('sprites', {
        key: 'new-sprite',
        url: 'https://example.com/new.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: newTime,
        downloadedAt: new Date(newTime).toISOString(),
        styleId: 'test',
        spriteName: 'new.png',
      });

      const analytics = await service.getSpriteAnalytics();
      const temporal = analytics.temporal as Record<string, unknown>;

      expect(temporal.ageSpan).toBe(newTime - oldTime);
    });
  });

  describe('cleanupOldSprites', () => {
    it('should delete sprites older than maxAge', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const recentTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

      await db.put('sprites', {
        key: 'old-sprite',
        url: 'https://example.com/old.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: oldTime,
        downloadedAt: new Date(oldTime).toISOString(),
        styleId: 'test',
        spriteName: 'old.png',
      });

      await db.put('sprites', {
        key: 'recent-sprite',
        url: 'https://example.com/recent.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: recentTime,
        downloadedAt: new Date(recentTime).toISOString(),
        styleId: 'test',
        spriteName: 'recent.png',
      });

      const deletedCount = await service.cleanupOldSprites(30);

      expect(deletedCount).toBe(1);

      // Verify old sprite was deleted
      const oldSprite = await db.get('sprites', 'old-sprite');
      expect(oldSprite).toBeUndefined();

      // Verify recent sprite still exists
      const recentSprite = await db.get('sprites', 'recent-sprite');
      expect(recentSprite).toBeDefined();
    });

    it('should use default maxAge of 30 days', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 35 * 24 * 60 * 60 * 1000;

      await db.put('sprites', {
        key: 'old-sprite',
        url: 'https://example.com/old.png',
        data: new ArrayBuffer(100),
        contentType: 'image/png',
        size: 100,
        lastModified: oldTime,
        downloadedAt: new Date(oldTime).toISOString(),
        styleId: 'test',
        spriteName: 'old.png',
      });

      const deletedCount = await service.cleanupOldSprites();

      expect(deletedCount).toBe(1);
    });
  });

  describe('verifyAndRepairSprites', () => {
    it('should return result object with expected shape', async () => {
      const result = await service.verifyAndRepairSprites();

      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
      expect(typeof result.verified).toBe('number');
      expect(typeof result.repaired).toBe('number');
      expect(typeof result.removed).toBe('number');
    });

    it('should return zeros when no sprites exist', async () => {
      const result = await service.verifyAndRepairSprites();

      expect(result.verified).toBe(0);
      expect(result.repaired).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should remove corrupted sprites with empty data', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'corrupted-sprite',
        url: 'https://example.com/corrupted.png',
        data: new ArrayBuffer(0),
        contentType: 'image/png',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'corrupted.png',
      });

      const result = await service.verifyAndRepairSprites();

      expect(result.removed).toBe(1);
      expect(result.verified).toBe(0);

      // Verify sprite was actually deleted
      const sprite = await db.get('sprites', 'corrupted-sprite');
      expect(sprite).toBeUndefined();
    });

    it('should remove sprites with null data', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'null-data-sprite',
        url: 'https://example.com/null.png',
        data: null as unknown as ArrayBuffer,
        contentType: 'image/png',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'null.png',
      });

      const result = await service.verifyAndRepairSprites();

      expect(result.removed).toBe(1);
    });

    it('should handle only corrupted sprites', async () => {
      const db = await dbPromise;

      // Only add corrupted sprites with size: 0
      await db.put('sprites', {
        key: 'corrupted-sprite-1',
        url: 'https://example.com/corrupted1.png',
        data: new ArrayBuffer(0),
        contentType: 'image/png',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'corrupted1.png',
      });

      await db.put('sprites', {
        key: 'corrupted-sprite-2',
        url: 'https://example.com/corrupted2.png',
        data: new ArrayBuffer(0),
        contentType: 'image/png',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'corrupted2.png',
      });

      const result = await service.verifyAndRepairSprites();

      expect(result.removed).toBe(2);
      expect(result.verified).toBe(0);
    });
  });

  describe('exported functions', () => {
    it('should export getSpriteStats function', async () => {
      const stats = await getSpriteStats();
      expect(stats).toBeDefined();
      expect(stats.count).toBe(0);
    });

    it('should export getSpriteAnalytics function', async () => {
      const analytics = await getSpriteAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.basic).toBeDefined();
    });

    it('should export cleanupOldSprites function', async () => {
      const deleted = await cleanupOldSprites();
      expect(typeof deleted).toBe('number');
    });

    it('should export spriteService singleton', () => {
      expect(spriteService).toBeDefined();
      expect(spriteService).toBeInstanceOf(SpriteService);
    });

    it('should export verifyAndRepairSprites function', async () => {
      const result = await verifyAndRepairSprites();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
    });
  });

  describe('getSpriteStats edge cases', () => {
    it('should handle sprites with missing contentType', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'no-content-type-sprite',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(100),
        // contentType intentionally omitted
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.png',
      });

      const stats = await service.getSpriteStats();

      expect(stats.count).toBe(1);
      expect(stats.spritesByType['png']).toBe(1);
    });

    it('should handle sprites with unknown type', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'unknown-type-sprite',
        url: 'https://example.com/sprite.xyz',
        data: new ArrayBuffer(100),
        contentType: 'application/octet-stream',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.xyz',
      });

      const stats = await service.getSpriteStats();

      expect(stats.count).toBe(1);
      expect(stats.spritesByType['unknown']).toBe(1);
    });

    it('should correctly identify jpeg sprites', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'jpeg-sprite',
        url: 'https://example.com/sprite.jpg',
        data: new ArrayBuffer(100),
        contentType: 'image/jpeg',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.jpg',
      });

      const stats = await service.getSpriteStats();

      expect(stats.spritesByType['jpeg']).toBe(1);
    });

    it('should correctly identify webp sprites', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'webp-sprite',
        url: 'https://example.com/sprite.webp',
        data: new ArrayBuffer(100),
        contentType: 'image/webp',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.webp',
      });

      const stats = await service.getSpriteStats();

      expect(stats.spritesByType['webp']).toBe(1);
    });

    it('should correctly identify svg sprites', async () => {
      const db = await dbPromise;

      await db.put('sprites', {
        key: 'svg-sprite',
        url: 'https://example.com/sprite.svg',
        data: new ArrayBuffer(100),
        contentType: 'image/svg+xml',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        styleId: 'test',
        spriteName: 'sprite.svg',
      });

      const stats = await service.getSpriteStats();

      expect(stats.spritesByType['svg']).toBe(1);
    });
  });
});
