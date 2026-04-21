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
    describe('getTileStats', () => {
      it('should return empty stats when no tiles exist', async () => {
        const stats = await service.getTileStats();

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

        const stats = await service.getTileStats();

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

        const stats = await service.getTileStats('style-1');

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
    describe('getFontStats', () => {
      it('should return font statistics', async () => {
        const stats = await service.getFontStats();

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
    describe('getSpriteStats', () => {
      it('should return sprite statistics', async () => {
        const stats = await service.getSpriteStats();

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
    describe('getGlyphStats', () => {
      it('should return glyph statistics', async () => {
        const stats = await service.getGlyphStats();

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

  describe('Download delegators', () => {
    // These delegators just pass args through to the underlying service
    // modules. Assert the shape and that calls complete without throwing.
    it('downloadFontsWithOptions returns a result shape', async () => {
      const res = await service.downloadFontsWithOptions([], 'style-x', {
        storageQuotaCheck: false,
        validateFonts: false,
      });
      expect(res).toHaveProperty('downloadedFonts');
    });

    it('downloadSpritesWithOptions returns a result shape', async () => {
      const res = await service.downloadSpritesWithOptions([], 'style-x', {
        storageQuotaCheck: false,
        enableValidation: false,
      });
      expect(res).toHaveProperty('downloadedSprites');
    });

    it('downloadGlyphsWithOptions returns a result shape', async () => {
      const res = await service.downloadGlyphsWithOptions(
        'https://example.com/fonts/{fontstack}/{range}.pbf',
        [],
        'style-x',
        [],
        {}
      );
      expect(res).toHaveProperty('downloadedGlyphs');
    });

    it('downloadTilesWithOptions fails early with no sources', async () => {
      await expect(
        service.downloadTilesWithOptions(
          {
            id: 'r1',
            name: 'r1',
            bounds: [[-1, -1], [1, 1]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 0,
          },
          { version: 8, sources: {}, layers: [] },
          'style-x',
          { storageQuotaCheck: false, probeSourcesBeforeDownload: false }
        )
      ).rejects.toThrow(/sources/i);
    });
  });

  describe('Download delegators with default options', () => {
    // These invocations exercise the default-parameter branches on every
    // delegator signature (`options: X = {}`).
    it('downloadFontsWithOptions without options', async () => {
      await expect(
        service.downloadFontsWithOptions([], undefined)
      ).resolves.toBeDefined();
    });

    it('downloadSpritesWithOptions without options', async () => {
      await expect(service.downloadSpritesWithOptions([], 'x')).resolves.toBeDefined();
    });

    it('downloadGlyphsWithOptions without options', async () => {
      await expect(
        service.downloadGlyphsWithOptions('https://x/{fontstack}/{range}.pbf', [], 'x')
      ).resolves.toBeDefined();
    });

    it('cleanupOldFonts without arguments', async () => {
      const n = await service.cleanupOldFonts();
      expect(typeof n).toBe('number');
    });

    it('cleanupOldSprites without arguments', async () => {
      const n = await service.cleanupOldSprites();
      expect(typeof n).toBe('number');
    });

    it('cleanupOldGlyphs without arguments', async () => {
      const n = await service.cleanupOldGlyphs();
      expect(typeof n).toBe('number');
    });

    it('cleanupOldTiles without arguments', async () => {
      const n = await service.cleanupOldTiles();
      expect(typeof n).toBe('number');
    });

    it('cleanupOldModels without arguments', async () => {
      const n = await service.cleanupOldModels();
      expect(typeof n).toBe('number');
    });

    it('downloadModelsWithOptions without options', async () => {
      await expect(service.downloadModelsWithOptions({}, 'x')).resolves.toBeDefined();
    });

    it('downloadTilesWithOptions without options', async () => {
      // Will reject because the style has no sources, but the default-options
      // branch is exercised before that throw.
      await expect(
        service.downloadTilesWithOptions(
          {
            id: 'r',
            name: 'r',
            bounds: [[-1, -1], [1, 1]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 0,
          },
          { version: 8, sources: {}, layers: [] },
          'x'
          // no options — triggers the default branch
        )
      ).rejects.toThrow();
    });
  });

  describe('Model management delegators', () => {
    it('getModelStats returns an empty-state object', async () => {
      const res = await service.getModelStats();
      expect(res).toBeDefined();
      expect(typeof res.count).toBe('number');
    });

    it('cleanupOldModels returns a number', async () => {
      const n = await service.cleanupOldModels({ maxAge: 1 });
      expect(typeof n).toBe('number');
    });

    it('verifyAndRepairModels returns the expected shape', async () => {
      const res = await service.verifyAndRepairModels();
      expect(res).toHaveProperty('verified');
      expect(res).toHaveProperty('repaired');
      expect(res).toHaveProperty('removed');
    });

    it('downloadModelsWithOptions returns a result shape', async () => {
      const res = await service.downloadModelsWithOptions({}, 'style-x', {});
      expect(res).toBeDefined();
    });
  });
});
