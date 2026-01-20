/**
 * Tests for Style Service
 */
import {
  loadStyles,
  loadStyleById,
  deleteStyles,
  deleteStyleById,
  getStyleStats,
  isStyleDownloaded,
} from '../../src/services/styleService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

describe('StyleService', () => {
  beforeEach(async () => {
    // Clear the styles store before each test
    const db = await dbPromise;
    await db.clear('styles');
  });

  describe('loadStyles', () => {
    it('should return empty array when no styles exist', async () => {
      const styles = await loadStyles();
      expect(styles).toEqual([]);
    });

    it('should return all stored styles', async () => {
      const db = await dbPromise;

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
        provider: 'mapbox' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const styles = await loadStyles();
      expect(styles.length).toBe(2);
    });
  });

  describe('loadStyleById', () => {
    it('should return null for non-existent style', async () => {
      const style = await loadStyleById('non-existent');
      expect(style).toBeNull();
    });

    it('should return the correct style by ID', async () => {
      const db = await dbPromise;
      const testStyle = {
        key: 'test-style',
        style: { version: 8, name: 'Test', sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      };

      await db.put('styles', testStyle);

      const loaded = await loadStyleById('test-style');
      expect(loaded).toBeDefined();
      expect(loaded?.key).toBe('test-style');
    });
  });

  describe('deleteStyles', () => {
    it('should delete all styles', async () => {
      const db = await dbPromise;

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

      let styles = await loadStyles();
      expect(styles.length).toBe(2);

      await deleteStyles();

      styles = await loadStyles();
      expect(styles.length).toBe(0);
    });
  });

  describe('deleteStyleById', () => {
    it('should delete a specific style', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'style-to-keep',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      await db.put('styles', {
        key: 'style-to-delete',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      await deleteStyleById('style-to-delete');

      const remaining = await loadStyles();
      expect(remaining.length).toBe(1);
      expect(remaining[0].key).toBe('style-to-keep');
    });

    it('should handle deleting non-existent style gracefully', async () => {
      // Should not throw
      await expect(deleteStyleById('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getStyleStats', () => {
    it('should return empty stats when no styles exist', async () => {
      const stats = await getStyleStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.styles).toEqual([]);
    });

    it('should calculate stats for stored styles', async () => {
      const db = await dbPromise;

      // Extended style data - runtime uses additional fields for stats
      const style1 = {
        key: 'style-1',
        style: {
          version: 8,
          name: 'Style One',
          sources: {
            'vector-source': { type: 'vector' },
          },
          layers: [
            { id: 'layer-1', type: 'fill' },
            { id: 'layer-2', type: 'line' },
          ],
          glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf',
        },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        lastModified: Date.now() - 10000,
        size: 1000,
      };

      const style2 = {
        key: 'style-2',
        style: {
          version: 8,
          name: 'Style Two',
          sources: {
            'raster-source': { type: 'raster' },
          },
          layers: [
            { id: 'layer-3', type: 'raster' },
          ],
          sprite: 'https://sprites.example.com/sprite',
        },
        provider: 'mapbox' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        lastModified: Date.now(),
        size: 2000,
      };

      // @ts-ignore - runtime code uses extended fields not in type
      await db.put('styles', style1);
      // @ts-ignore - runtime code uses extended fields not in type
      await db.put('styles', style2);

      const stats = await getStyleStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.styles.length).toBe(2);
      expect(stats.sourceTypes).toHaveProperty('vector');
      expect(stats.sourceTypes).toHaveProperty('raster');
      expect(stats.layerTypes).toHaveProperty('fill');
      expect(stats.layerTypes).toHaveProperty('line');
      expect(stats.layerTypes).toHaveProperty('raster');
    });

    it('should identify oldest and newest styles', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

      // Extended style data for stats tracking - runtime uses additional fields
      const oldStyle = {
        key: 'old-style',
        style: { version: 8, sources: {}, layers: [{ id: 'l', type: 'fill' }] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        lastModified: oldTime,
        size: 100,
      };

      const newStyle = {
        key: 'new-style',
        style: { version: 8, sources: {}, layers: [{ id: 'l', type: 'fill' }] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        lastModified: newTime,
        size: 200,
      };

      // @ts-ignore - runtime code uses extended fields not in type
      await db.put('styles', oldStyle);
      // @ts-ignore - runtime code uses extended fields not in type
      await db.put('styles', newStyle);

      const stats = await getStyleStats();

      expect(stats.oldestStyle?.id).toBe('old-style');
      expect(stats.newestStyle?.id).toBe('new-style');
    });
  });

  describe('isStyleDownloaded', () => {
    it('should return false when style does not exist', async () => {
      const result = await isStyleDownloaded('non-existent');
      expect(result).toBe(false);
    });

    it('should return true when style exists by ID', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'existing-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      const result = await isStyleDownloaded('existing-style');
      expect(result).toBe(true);
    });

    it('should find style by URL', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'url-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/styles/test.json',
      });

      const result = await isStyleDownloaded(undefined, 'https://example.com/styles/test.json');
      expect(result).toBe(true);
    });

    it('should return false for non-matching URL', async () => {
      const db = await dbPromise;

      await db.put('styles', {
        key: 'url-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto' as StyleProvider,
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
        originalUrl: 'https://example.com/styles/test.json',
      });

      const result = await isStyleDownloaded(undefined, 'https://other.com/styles/other.json');
      expect(result).toBe(false);
    });
  });
});
