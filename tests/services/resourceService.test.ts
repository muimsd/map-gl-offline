/**
 * Tests for Resource Service
 */
import { ResourceService } from '../../src/services/resourceService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('ResourceService', () => {
  let service: ResourceService;

  beforeEach(async () => {
    service = new ResourceService();
    const db = await dbPromise;
    await db.clear('tiles');
    await db.clear('fonts');
    await db.clear('sprites');
    await db.clear('glyphs');
  });

  describe('Tile Management', () => {
    describe('getTileStatistics', () => {
      it('should return empty stats when no tiles exist', async () => {
        const stats = await service.getTileStatistics();

        expect(stats.count).toBe(0);
        expect(stats.totalSize).toBe(0);
      });

      it('should return stats for stored tiles', async () => {
        const db = await dbPromise;

        await db.put('tiles', {
          key: 'style-1:source:10:100:200.pbf',
          styleId: 'style-1',
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

        const stats = await service.getTileStatistics();

        expect(stats.count).toBe(1);
        expect(stats.totalSize).toBe(1000);
      });

      it('should filter by styleId', async () => {
        const db = await dbPromise;

        await db.put('tiles', {
          key: 'style-1:source:10:100:200.pbf',
          styleId: 'style-1',
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
          key: 'style-2:source:10:100:200.pbf',
          styleId: 'style-2',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 10,
          size: 2000,
          data: new ArrayBuffer(2000),
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile2.pbf',
          lastModified: Date.now(),
        });

        const stats = await service.getTileStatistics('style-1');

        expect(stats.count).toBe(1);
        expect(stats.totalSize).toBe(1000);
      });
    });

    describe('getTileAnalytics', () => {
      it('should return structured analytics', async () => {
        const analytics = await service.getTileAnalytics();

        expect(analytics).toHaveProperty('basic');
        expect(analytics).toHaveProperty('distribution');
        expect(analytics).toHaveProperty('temporal');
      });
    });

    describe('cleanupOldTiles', () => {
      it('should delete old tiles', async () => {
        const db = await dbPromise;
        const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000;

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
          url: 'https://example.com/tile.pbf',
          lastModified: oldTime,
        });

        const deleted = await service.cleanupOldTiles(30);

        expect(deleted).toBe(1);
      });
    });
  });

  describe('Font Management', () => {
    describe('getFontStatistics', () => {
      it('should return font statistics', async () => {
        const stats = await service.getFontStatistics();

        expect(stats).toHaveProperty('count');
        expect(stats).toHaveProperty('totalSize');
      });
    });

    describe('getFontAnalytics', () => {
      it('should return font analytics', async () => {
        const analytics = await service.getFontAnalytics();

        expect(analytics).toHaveProperty('basic');
      });
    });

    describe('cleanupOldFonts', () => {
      it('should delete old fonts', async () => {
        const db = await dbPromise;
        const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000;

        await db.put('fonts', {
          key: 'old-font.pbf',
          url: 'https://example.com/fonts/old-font.pbf',
          originalUrl: 'https://example.com/fonts/old-font.pbf',
          data: new ArrayBuffer(1000),
          size: 1000,
          type: 'pbf',
          contentType: 'application/x-protobuf',
          lastModified: oldTime,
          downloadedAt: new Date(oldTime).toISOString(),
        });

        const deleted = await service.cleanupOldFonts(undefined, { maxAge: 30 });

        expect(deleted).toBe(1);
      });
    });

    describe('verifyAndRepairFonts', () => {
      it('should return verification results', async () => {
        const result = await service.verifyAndRepairFonts();

        expect(result).toHaveProperty('verified');
        expect(result).toHaveProperty('repaired');
        expect(result).toHaveProperty('removed');
      });
    });
  });

  describe('Sprite Management', () => {
    describe('getSpriteStatistics', () => {
      it('should return sprite statistics', async () => {
        const stats = await service.getSpriteStatistics();

        expect(stats).toHaveProperty('count');
        expect(stats).toHaveProperty('totalSize');
      });
    });

    describe('getSpriteAnalytics', () => {
      it('should return sprite analytics', async () => {
        const analytics = await service.getSpriteAnalytics();

        expect(analytics).toHaveProperty('basic');
      });
    });

    describe('cleanupOldSprites', () => {
      it('should delete old sprites', async () => {
        const db = await dbPromise;
        const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000;

        await db.put('sprites', {
          key: 'old-sprite.png',
          url: 'https://example.com/sprites/old-sprite.png',
          data: new ArrayBuffer(500),
          size: 500,
          lastModified: oldTime,
          downloadedAt: new Date(oldTime).toISOString(),
        });

        const deleted = await service.cleanupOldSprites(undefined, { maxAge: 30 });

        expect(deleted).toBe(1);
      });
    });

    describe('verifyAndRepairSprites', () => {
      it('should return verification results', async () => {
        const result = await service.verifyAndRepairSprites();

        expect(result).toHaveProperty('verified');
        expect(result).toHaveProperty('repaired');
        expect(result).toHaveProperty('removed');
      });
    });
  });

  describe('Glyph Management', () => {
    describe('getGlyphStatistics', () => {
      it('should return glyph statistics', async () => {
        const stats = await service.getGlyphStatistics();

        expect(stats).toHaveProperty('count');
        expect(stats).toHaveProperty('totalSize');
      });
    });

    describe('getGlyphAnalytics', () => {
      it('should return glyph analytics', async () => {
        const analytics = await service.getGlyphAnalytics();

        expect(analytics).toHaveProperty('basic');
      });
    });

    describe('loadGlyphsForStyle', () => {
      it('should return empty array when no glyphs exist', async () => {
        const glyphs = await service.loadGlyphsForStyle('Arial', ['0-255']);

        expect(glyphs).toEqual([]);
      });

      it('should load glyphs for fontstack', async () => {
        const db = await dbPromise;

        await db.put('glyphs', {
          key: 'Arial/0-255.pbf',
          data: new ArrayBuffer(100),
          url: 'https://example.com/fonts/Arial/0-255.pbf',
          size: 100,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          fontstack: 'Arial',
          range: '0-255',
        });

        const glyphs = await service.loadGlyphsForStyle('Arial', ['0-255']);

        expect(glyphs.length).toBe(1);
      });
    });

    describe('cleanupOldGlyphs', () => {
      it('should delete old glyphs', async () => {
        const db = await dbPromise;
        const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000;

        await db.put('glyphs', {
          key: 'old-font/0-255.pbf',
          data: new ArrayBuffer(100),
          url: 'https://example.com/fonts/old-font/0-255.pbf',
          size: 100,
          lastModified: oldTime,
          downloadedAt: new Date(oldTime).toISOString(),
          fontstack: 'old-font',
          range: '0-255',
        });

        const deleted = await service.cleanupOldGlyphs(undefined, { maxAge: 30 });

        expect(deleted).toBe(1);
      });
    });

    describe('verifyAndRepairGlyphs', () => {
      it('should return verification results', async () => {
        const result = await service.verifyAndRepairGlyphs();

        expect(result).toHaveProperty('verified');
        expect(result).toHaveProperty('repaired');
        expect(result).toHaveProperty('removed');
      });
    });
  });
});
