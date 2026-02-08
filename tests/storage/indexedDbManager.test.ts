/**
 * Tests for IndexedDB Manager
 */
import { dbPromise } from '../../src/storage/indexedDbManager';
import { DB_NAME, DB_VERSION } from '../../src/utils/constants';
import type { StyleProvider } from '../../src/types/style';

describe('IndexedDB Manager', () => {
  it('should open the database', async () => {
    const db = await dbPromise;
    expect(db).toBeDefined();
    expect(db.name).toBe(DB_NAME);
  });

  it('should have the correct version', async () => {
    const db = await dbPromise;
    expect(db.version).toBe(DB_VERSION);
  });

  it('should have all required object stores', async () => {
    const db = await dbPromise;
    const storeNames = Array.from(db.objectStoreNames);

    expect(storeNames).toContain('regions');
    expect(storeNames).toContain('tiles');
    expect(storeNames).toContain('styles');
    expect(storeNames).toContain('sprites');
    expect(storeNames).toContain('glyphs');
    expect(storeNames).toContain('fonts');
  });

  describe('CRUD operations', () => {
    it('should store and retrieve a region', async () => {
      const db = await dbPromise;
      const testRegion = {
        key: 'test-region-1',
        id: 'test-region-1',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleId: 'test-style',
        styleUrl: 'https://example.com/style.json',
        created: Date.now(),
        lastModified: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await db.put('regions', testRegion);
      const retrieved = await db.get('regions', 'test-region-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('test-region-1');
    });

    it('should store and retrieve a tile', async () => {
      const db = await dbPromise;
      const testTile = {
        key: 'test-style:test-source:12:1234:5678.pbf',
        url: 'https://example.com/tiles/12/1234/5678.pbf',
        data: new ArrayBuffer(100),
        contentType: 'application/x-protobuf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        format: 'pbf',
        x: 1234,
        y: 5678,
        z: 12,
        styleId: 'test-style',
        sourceId: 'test-source',
      };

      await db.put('tiles', testTile);
      const retrieved = await db.get('tiles', testTile.key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe(testTile.key);
      expect(retrieved?.styleId).toBe('test-style');
    });

    it('should store and retrieve a style', async () => {
      const db = await dbPromise;
      const testStyle = {
        key: 'test-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      };

      await db.put('styles', testStyle);
      const retrieved = await db.get('styles', 'test-style');

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('test-style');
    });

    it('should delete a record', async () => {
      const db = await dbPromise;
      const testRegion = {
        key: 'test-region-to-delete',
        id: 'test-region-to-delete',
        name: 'Delete Me',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleId: 'test-style',
        styleUrl: 'https://example.com/style.json',
        created: Date.now(),
        lastModified: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await db.put('regions', testRegion);
      let retrieved = await db.get('regions', 'test-region-to-delete');
      expect(retrieved).toBeDefined();

      await db.delete('regions', 'test-region-to-delete');
      retrieved = await db.get('regions', 'test-region-to-delete');
      expect(retrieved).toBeUndefined();
    });

    it('should get all records from a store', async () => {
      const db = await dbPromise;

      // Clear existing regions first
      const existingRegions = await db.getAll('regions');
      for (const region of existingRegions) {
        if (region.key) {
          await db.delete('regions', region.key);
        }
      }

      // Add test regions with full data
      const baseRegion = {
        bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
        minZoom: 0,
        maxZoom: 10,
        styleId: 'test-style',
        styleUrl: 'https://example.com/style.json',
        created: Date.now(),
        lastModified: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await db.put('regions', { ...baseRegion, key: 'region-1', id: 'region-1', name: 'Region 1' });
      await db.put('regions', { ...baseRegion, key: 'region-2', id: 'region-2', name: 'Region 2' });
      await db.put('regions', { ...baseRegion, key: 'region-3', id: 'region-3', name: 'Region 3' });

      const allRegions = await db.getAll('regions');
      expect(allRegions.length).toBe(3);
    });

    it('should count records in a store', async () => {
      const db = await dbPromise;

      // Clear and add test sprites
      const tx = db.transaction('sprites', 'readwrite');
      await tx.store.clear();
      await tx.done;

      // Full sprite data
      const baseSprite = {
        data: new ArrayBuffer(10),
        downloadedAt: new Date().toISOString(),
        size: 10,
        lastModified: Date.now(),
      };

      // @ts-ignore - test data
      await db.put('sprites', { ...baseSprite, key: 'sprite-1', url: 'https://example.com/sprite1', type: 'json' });
      // @ts-ignore - test data
      await db.put('sprites', { ...baseSprite, key: 'sprite-2', url: 'https://example.com/sprite2', type: 'json' });

      const count = await db.count('sprites');
      expect(count).toBe(2);
    });
  });

  describe('Transactions', () => {
    it('should support read-only transactions', async () => {
      const db = await dbPromise;

      const glyphData = {
        key: 'glyph-1',
        data: new ArrayBuffer(10),
        fontStack: 'test-font',
        range: '0-255',
        downloadedAt: new Date().toISOString(),
        size: 10,
        url: 'https://example.com/glyph',
        lastModified: Date.now(),
      };

      // @ts-ignore - test data
      await db.put('glyphs', glyphData);

      const tx = db.transaction('glyphs', 'readonly');
      const glyph = await tx.store.get('glyph-1');
      await tx.done;

      expect(glyph).toBeDefined();
    });

    it('should support read-write transactions', async () => {
      const db = await dbPromise;

      // Clear fonts first
      const clearTx = db.transaction('fonts', 'readwrite');
      await clearTx.store.clear();
      await clearTx.done;

      const tx = db.transaction('fonts', 'readwrite');

      const baseFont = {
        data: new ArrayBuffer(10),
        downloadedAt: new Date().toISOString(),
        size: 10,
        url: 'https://example.com/font',
        lastModified: Date.now(),
        type: 'font',
        contentType: 'application/x-protobuf',
        fontFamily: 'Test',
        fontWeight: 'normal',
      };

      // @ts-ignore - test data
      await tx.store.put({ ...baseFont, key: 'font-1', fontStack: 'Test Font' });
      // @ts-ignore - test data
      await tx.store.put({ ...baseFont, key: 'font-2', fontStack: 'Another Font' });
      await tx.done;

      const fonts = await db.getAll('fonts');
      const font1 = fonts.find(f => f.key === 'font-1');
      const font2 = fonts.find(f => f.key === 'font-2');

      expect(font1).toBeDefined();
      expect(font2).toBeDefined();
    });

    it('should support iterating over records with cursor', async () => {
      const db = await dbPromise;

      // Clear and add test tiles
      const clearTx = db.transaction('tiles', 'readwrite');
      await clearTx.store.clear();
      await clearTx.done;

      const baseTile = {
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
        x: 0,
        y: 0,
        z: 0,
        styleId: 'test-style',
        sourceId: 'test-source',
      };

      await db.put('tiles', { ...baseTile, key: 'tile-a', size: 100 });
      await db.put('tiles', { ...baseTile, key: 'tile-b', size: 200 });
      await db.put('tiles', { ...baseTile, key: 'tile-c', size: 300 });

      let totalSize = 0;
      const tx = db.transaction('tiles', 'readonly');
      for await (const cursor of tx.store) {
        totalSize += cursor.value.size;
      }

      expect(totalSize).toBe(600);
    });
  });
});
