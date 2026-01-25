/**
 * Integration tests for service interactions
 * Tests how services work together in realistic scenarios
 */
import { dbPromise } from '../../src/storage/indexedDbManager';
import { TileService } from '../../src/services/tileService';
import { SpriteService } from '../../src/services/spriteService';
import { ResourceService } from '../../src/services/resourceService';
import type { StyleProvider } from '../../src/types/style';

describe('Service Integration', () => {
  beforeEach(async () => {
    const db = await dbPromise;
    await db.clear('tiles');
    await db.clear('sprites');
    await db.clear('fonts');
    await db.clear('glyphs');
    await db.clear('styles');
  });

  describe('TileService and ResourceService interaction', () => {
    it('should share consistent tile data between services', async () => {
      const db = await dbPromise;
      const tileService = new TileService();
      const resourceService = new ResourceService();
      const now = Date.now();

      // Add tiles via direct database insertion
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

      // Both services should see the same data
      const tileStats = await tileService.getTileStats();
      const resourceStats = await resourceService.getTileStatistics();

      expect(tileStats.count).toBe(1);
      expect(resourceStats.count).toBe(1);
      expect(tileStats.totalSize).toBe(resourceStats.totalSize);
    });

    it('should maintain data consistency after cleanup', async () => {
      const db = await dbPromise;
      const tileService = new TileService();
      const resourceService = new ResourceService();
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

      // Both services should report tile
      let tileStats = await tileService.getTileStats();
      let resourceStats = await resourceService.getTileStatistics();
      expect(tileStats.count).toBe(1);
      expect(resourceStats.count).toBe(1);

      // Cleanup using tileService
      await tileService.cleanupOldTiles(30);

      // Both services should report no tiles
      tileStats = await tileService.getTileStats();
      resourceStats = await resourceService.getTileStatistics();
      expect(tileStats.count).toBe(0);
      expect(resourceStats.count).toBe(0);
    });
  });

  describe('SpriteService and ResourceService interaction', () => {
    it('should share consistent sprite data between services', async () => {
      const db = await dbPromise;
      const spriteService = new SpriteService();
      const resourceService = new ResourceService();
      const now = Date.now();

      await db.put('sprites', {
        key: 'test-style::sprite.png',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(500),
        contentType: 'image/png',
        size: 500,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        styleId: 'test-style',
        spriteName: 'sprite.png',
      });

      const spriteStats = await spriteService.getSpriteStats();
      const resourceStats = await resourceService.getSpriteStatistics();

      expect(spriteStats.count).toBe(1);
      expect(resourceStats.count).toBe(1);
      expect(spriteStats.totalSize).toBe(resourceStats.totalSize);
    });
  });

  describe('Cross-service data integrity', () => {
    it('should handle multiple resource types simultaneously', async () => {
      const db = await dbPromise;
      const resourceService = new ResourceService();
      const now = Date.now();

      // Add tiles
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

      // Add sprites
      await db.put('sprites', {
        key: 'test-style::sprite.png',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(500),
        contentType: 'image/png',
        size: 500,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        styleId: 'test-style',
        spriteName: 'sprite.png',
      });

      // Add fonts
      await db.put('fonts', {
        key: 'test-font.pbf',
        url: 'https://example.com/fonts/test.pbf',
        originalUrl: 'https://example.com/fonts/test.pbf',
        data: new ArrayBuffer(200),
        size: 200,
        type: 'pbf',
        contentType: 'application/x-protobuf',
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
      });

      // Add glyphs
      await db.put('glyphs', {
        key: 'Arial/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/Arial/0-255.pbf',
        size: 100,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        fontstack: 'Arial',
        range: '0-255',
      });

      // Verify all resource types
      const tileStats = await resourceService.getTileStatistics();
      const spriteStats = await resourceService.getSpriteStatistics();
      const fontStats = await resourceService.getFontStatistics();
      const glyphStats = await resourceService.getGlyphStatistics();

      expect(tileStats.count).toBe(1);
      expect(spriteStats.count).toBe(1);
      expect(fontStats.count).toBe(1);
      expect(glyphStats.count).toBe(1);
    });

    it('should maintain style association across resources', async () => {
      const db = await dbPromise;
      const resourceService = new ResourceService();
      const now = Date.now();
      const styleId = 'shared-style';

      // Add style
      await db.put('styles', {
        key: styleId,
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: ['Arial'],
        glyphs: [],
        sprites: ['sprite.png'],
      });

      // Add associated tiles
      await db.put('tiles', {
        key: `${styleId}:source:10:100:200.pbf`,
        styleId: styleId,
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
        key: `${styleId}:source:10:101:200.pbf`,
        styleId: styleId,
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

      // Add tiles for different style
      await db.put('tiles', {
        key: 'other-style:source:10:100:200.pbf',
        styleId: 'other-style',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 2000,
        data: new ArrayBuffer(2000),
        downloadedAt: new Date(now).toISOString(),
        type: 'vector',
        url: 'https://example.com/tile3.pbf',
        lastModified: now,
      });

      // Filter by style
      const filteredStats = await resourceService.getTileStatistics(styleId);
      const allStats = await resourceService.getTileStatistics();

      expect(filteredStats.count).toBe(2);
      expect(filteredStats.totalSize).toBe(2500);
      expect(allStats.count).toBe(3);
      expect(allStats.totalSize).toBe(4500);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent reads from multiple services', async () => {
      const db = await dbPromise;
      const tileService = new TileService();
      const spriteService = new SpriteService();
      const resourceService = new ResourceService();
      const now = Date.now();

      // Setup test data
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

      await db.put('sprites', {
        key: 'test-style::sprite.png',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(500),
        contentType: 'image/png',
        size: 500,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        styleId: 'test-style',
        spriteName: 'sprite.png',
      });

      // Concurrent reads
      const [tileStats, spriteStats, resourceTileStats, resourceSpriteStats] = await Promise.all([
        tileService.getTileStats(),
        spriteService.getSpriteStats(),
        resourceService.getTileStatistics(),
        resourceService.getSpriteStatistics(),
      ]);

      expect(tileStats.count).toBe(1);
      expect(spriteStats.count).toBe(1);
      expect(resourceTileStats.count).toBe(1);
      expect(resourceSpriteStats.count).toBe(1);
    });
  });
});
