/**
 * Tests for Cleanup Compressed Tiles Utility
 */
import {
  countCompressedTiles,
  cleanupCompressedTiles,
  CompressedTileStats,
  CompressedTileCleanupResult,
} from '../../src/utils/cleanupCompressedTiles';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('CleanupCompressedTiles', () => {
  beforeEach(async () => {
    const db = await dbPromise;
    await db.clear('tiles');
  });

  // Helper to create a gzip-compressed buffer (magic bytes: 0x1f 0x8b)
  function createGzipBuffer(size: number = 100): ArrayBuffer {
    const data = new Uint8Array(size);
    data[0] = 0x1f; // gzip magic byte 1
    data[1] = 0x8b; // gzip magic byte 2
    // Fill rest with dummy data
    for (let i = 2; i < size; i++) {
      data[i] = i % 256;
    }
    return data.buffer;
  }

  // Helper to create an uncompressed buffer
  function createUncompressedBuffer(size: number = 100): ArrayBuffer {
    const data = new Uint8Array(size);
    // Start with bytes that are NOT gzip magic bytes
    data[0] = 0x50; // 'P' - like PBF header
    data[1] = 0x42; // 'B'
    for (let i = 2; i < size; i++) {
      data[i] = i % 256;
    }
    return data.buffer;
  }

  describe('countCompressedTiles', () => {
    it('should return all zeros when no tiles exist', async () => {
      const stats = await countCompressedTiles();

      expect(stats.total).toBe(0);
      expect(stats.gzipped).toBe(0);
      expect(stats.uncompressed).toBe(0);
    });

    it('should count uncompressed tiles correctly', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const stats = await countCompressedTiles();

      expect(stats.total).toBe(1);
      expect(stats.gzipped).toBe(0);
      expect(stats.uncompressed).toBe(1);
    });

    it('should count gzipped tiles correctly', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createGzipBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const stats = await countCompressedTiles();

      expect(stats.total).toBe(1);
      expect(stats.gzipped).toBe(1);
      expect(stats.uncompressed).toBe(0);
    });

    it('should count mixed tiles correctly', async () => {
      const db = await dbPromise;

      // Add 2 gzipped tiles
      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createGzipBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-1:source:10:101:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 100,
        data: createGzipBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      // Add 3 uncompressed tiles
      await db.put('tiles', {
        key: 'style-1:source:10:102:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 102,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile3.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-1:source:10:103:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 103,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile4.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-1:source:10:104:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 104,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile5.pbf',
        lastModified: Date.now(),
      });

      const stats = await countCompressedTiles();

      expect(stats.total).toBe(5);
      expect(stats.gzipped).toBe(2);
      expect(stats.uncompressed).toBe(3);
    });

    it('should handle tiles with missing data', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 0,
        data: null as unknown as ArrayBuffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const stats = await countCompressedTiles();

      expect(stats.total).toBe(1);
      expect(stats.gzipped).toBe(0);
      expect(stats.uncompressed).toBe(1); // Null data counts as uncompressed
    });

    it('should handle tiles with very small data buffer', async () => {
      const db = await dbPromise;

      // Buffer with only 1 byte (too small for gzip detection)
      const tinyBuffer = new ArrayBuffer(1);
      new Uint8Array(tinyBuffer)[0] = 0x1f;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 1,
        data: tinyBuffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const stats = await countCompressedTiles();

      expect(stats.total).toBe(1);
      expect(stats.gzipped).toBe(0); // Too small to be gzip
      expect(stats.uncompressed).toBe(1);
    });
  });

  describe('cleanupCompressedTiles', () => {
    it('should return zeros when no tiles exist', async () => {
      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(0);
      expect(result.removed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should not remove uncompressed tiles', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.errors).toEqual([]);

      // Verify tile still exists
      const tile = await db.get('tiles', 'style-1:source:10:100:200.pbf');
      expect(tile).toBeDefined();
    });

    it('should remove gzipped tiles', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'gzipped-tile',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createGzipBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(1);
      expect(result.removed).toBe(1);
      expect(result.errors).toEqual([]);

      // Verify tile was removed
      const tile = await db.get('tiles', 'gzipped-tile');
      expect(tile).toBeUndefined();
    });

    it('should remove only gzipped tiles and keep uncompressed', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'gzipped-tile',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: createGzipBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'uncompressed-tile',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 100,
        data: createUncompressedBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(2);
      expect(result.removed).toBe(1);
      expect(result.errors).toEqual([]);

      // Verify gzipped was removed
      const gzippedTile = await db.get('tiles', 'gzipped-tile');
      expect(gzippedTile).toBeUndefined();

      // Verify uncompressed still exists
      const uncompressedTile = await db.get('tiles', 'uncompressed-tile');
      expect(uncompressedTile).toBeDefined();
    });

    it('should handle multiple gzipped tiles', async () => {
      const db = await dbPromise;

      // Add 5 gzipped tiles
      for (let i = 0; i < 5; i++) {
        await db.put('tiles', {
          key: `gzipped-tile-${i}`,
          styleId: 'style-1',
          sourceId: 'source',
          x: 100 + i,
          y: 200,
          z: 10,
          size: 100,
          data: createGzipBuffer(100),
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: `https://example.com/tile${i}.pbf`,
          lastModified: Date.now(),
        });
      }

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(5);
      expect(result.removed).toBe(5);
      expect(result.errors).toEqual([]);

      // Verify all tiles were removed
      const remainingTiles = await db.getAll('tiles');
      expect(remainingTiles.length).toBe(0);
    });

    it('should handle tiles with null data during cleanup', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'null-data-tile',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 0,
        data: null as unknown as ArrayBuffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0); // Null data is not gzipped
      expect(result.errors).toEqual([]);
    });

    it('should handle empty data buffer', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'empty-data-tile',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 0,
        data: new ArrayBuffer(0),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await cleanupCompressedTiles();

      expect(result.checked).toBe(1);
      expect(result.removed).toBe(0); // Empty buffer is not gzipped
      expect(result.errors).toEqual([]);
    });
  });
});
