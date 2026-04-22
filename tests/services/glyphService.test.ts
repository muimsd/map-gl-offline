/**
 * Tests for Glyph Service
 */
import { GlyphService, glyphService, getGlyphStats, getGlyphAnalytics, cleanupOldGlyphs, loadGlyphs, verifyAndRepairGlyphs } from '../../src/services/glyphService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('GlyphService', () => {
  let service: GlyphService;

  beforeEach(async () => {
    service = new GlyphService();
    const db = await dbPromise;
    await db.clear('glyphs');
  });

  describe('getGlyph', () => {
    it('should return null when glyph does not exist', async () => {
      const glyph = await service.getGlyph('Arial', '0-255');
      expect(glyph).toBeNull();
    });

    it('should find glyph by fontstack and range', async () => {
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

      const glyph = await service.getGlyph('Arial', '0-255');
      expect(glyph).toBeDefined();
      expect(glyph?.fontstack).toBe('Arial');
      expect(glyph?.range).toBe('0-255');
    });

    it('should find glyph with styleName prefix', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'my-style::Open Sans/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/Open%20Sans/0-255.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'Open Sans',
        range: '0-255',
        styleId: 'my-style',
      });

      const glyph = await service.getGlyph('Open Sans', '0-255', 'my-style');
      expect(glyph).toBeDefined();
    });

    it('should handle URL-encoded fontstacks', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'Open Sans/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/Open%20Sans/0-255.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'Open Sans',
        range: '0-255',
      });

      // Should find with encoded fontstack
      const glyph = await service.getGlyph('Open%20Sans', '0-255');
      expect(glyph).toBeDefined();
    });
  });

  describe('loadGlyphs', () => {
    it('should return empty array when no glyphs exist', async () => {
      const glyphRanges = await service.loadGlyphs('Arial', ['0-255', '256-511']);
      expect(glyphRanges).toEqual([]);
    });

    it('should load multiple glyph ranges', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'Roboto/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/Roboto/0-255.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'Roboto',
        range: '0-255',
      });

      await db.put('glyphs', {
        key: 'Roboto/256-511.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/Roboto/256-511.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'Roboto',
        range: '256-511',
      });

      const glyphRanges = await service.loadGlyphs('Roboto', ['0-255', '256-511']);

      expect(glyphRanges.length).toBe(2);
      expect(glyphRanges[0].start).toBe(0);
      expect(glyphRanges[0].end).toBe(255);
      expect(glyphRanges[1].start).toBe(256);
      expect(glyphRanges[1].end).toBe(511);
    });

    it('should skip missing ranges', async () => {
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

      const glyphRanges = await service.loadGlyphs('Arial', ['0-255', '256-511', '512-767']);

      expect(glyphRanges.length).toBe(1);
      expect(glyphRanges[0].start).toBe(0);
    });
  });

  describe('getGlyphStats', () => {
    it('should return empty stats when no glyphs exist', async () => {
      const stats = await service.getGlyphStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.glyphs).toEqual([]);
      expect(stats.fontsByStack).toEqual({});
      expect(stats.sizeByStack).toEqual({});
      expect(stats.corruptedGlyphs).toEqual([]);
      expect(stats.oldestGlyph).toBeUndefined();
      expect(stats.newestGlyph).toBeUndefined();
    });

    it('should calculate stats for stored glyphs', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('glyphs', {
        key: 'Arial/0-255.pbf',
        data: new ArrayBuffer(1000),
        url: 'https://example.com/fonts/Arial/0-255.pbf',
        size: 1000,
        lastModified: now - 10000,
        downloadedAt: new Date(now - 10000).toISOString(),
        fontstack: 'Arial',
        range: '0-255',
      });

      await db.put('glyphs', {
        key: 'Roboto/0-255.pbf',
        data: new ArrayBuffer(2000),
        url: 'https://example.com/fonts/Roboto/0-255.pbf',
        size: 2000,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        fontstack: 'Roboto',
        range: '0-255',
      });

      const stats = await service.getGlyphStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.averageSize).toBe(1500);
      expect(stats.glyphs.length).toBe(2);
      expect(stats.fontsByStack['Arial']).toBe(1);
      expect(stats.fontsByStack['Roboto']).toBe(1);
      expect(stats.sizeByStack['Arial']).toBe(1000);
      expect(stats.sizeByStack['Roboto']).toBe(2000);
    });

    it('should track oldest and newest glyphs', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

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

      await db.put('glyphs', {
        key: 'new-font/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/new-font/0-255.pbf',
        size: 100,
        lastModified: newTime,
        downloadedAt: new Date(newTime).toISOString(),
        fontstack: 'new-font',
        range: '0-255',
      });

      const stats = await service.getGlyphStats();

      expect(stats.oldestGlyph?.fontstack).toBe('old-font');
      expect(stats.newestGlyph?.fontstack).toBe('new-font');
    });

    it('should detect corrupted glyphs', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'corrupted/0-255.pbf',
        data: new ArrayBuffer(0),
        url: 'https://example.com/fonts/corrupted/0-255.pbf',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'corrupted',
        range: '0-255',
      });

      const stats = await service.getGlyphStats();

      expect(stats.corruptedGlyphs.length).toBe(1);
      expect(stats.corruptedGlyphs[0]).toBe('corrupted/0-255.pbf');
    });
  });

  describe('getGlyphAnalytics', () => {
    it('should return structured analytics', async () => {
      const analytics = await service.getGlyphAnalytics();

      expect(analytics).toHaveProperty('basic');
      expect(analytics).toHaveProperty('distribution');
      expect(analytics).toHaveProperty('health');
      expect(analytics).toHaveProperty('temporal');
    });

    it('should calculate corruption rate', async () => {
      const db = await dbPromise;

      // Add normal glyph
      await db.put('glyphs', {
        key: 'normal/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/normal/0-255.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'normal',
        range: '0-255',
      });

      // Add corrupted glyph
      await db.put('glyphs', {
        key: 'corrupted/0-255.pbf',
        data: new ArrayBuffer(0),
        url: 'https://example.com/fonts/corrupted/0-255.pbf',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'corrupted',
        range: '0-255',
      });

      const analytics = await service.getGlyphAnalytics();
      const health = analytics.health as Record<string, number>;

      expect(health.corruptedGlyphs).toBe(1);
      expect(health.corruptionRate).toBe(50);
    });
  });

  describe('cleanupOldGlyphs', () => {
    it('should delete glyphs older than maxAge', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
      const recentTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

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

      await db.put('glyphs', {
        key: 'recent-font/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/recent-font/0-255.pbf',
        size: 100,
        lastModified: recentTime,
        downloadedAt: new Date(recentTime).toISOString(),
        fontstack: 'recent-font',
        range: '0-255',
      });

      const deletedCount = await service.cleanupOldGlyphs(30);

      expect(deletedCount).toBe(1);

      // Verify old glyph was deleted
      const oldGlyph = await db.get('glyphs', 'old-font/0-255.pbf');
      expect(oldGlyph).toBeUndefined();

      // Verify recent glyph still exists
      const recentGlyph = await db.get('glyphs', 'recent-font/0-255.pbf');
      expect(recentGlyph).toBeDefined();
    });

    it('should use default maxAge of 30 days', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 35 * 24 * 60 * 60 * 1000;

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

      const deletedCount = await service.cleanupOldGlyphs();

      expect(deletedCount).toBe(1);
    });
  });

  describe('verifyAndRepairGlyphs', () => {
    it('should return result object with expected shape', async () => {
      const result = await service.verifyAndRepairGlyphs();

      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
      expect(typeof result.verified).toBe('number');
      expect(typeof result.repaired).toBe('number');
      expect(typeof result.removed).toBe('number');
    });

    it('should return zeros when no glyphs exist', async () => {
      const result = await service.verifyAndRepairGlyphs();

      expect(result.verified).toBe(0);
      expect(result.repaired).toBe(0);
      expect(result.removed).toBe(0);
    });

    it('should remove glyphs with empty data', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'corrupted-glyph/0-255.pbf',
        data: new ArrayBuffer(0),
        url: 'https://example.com/fonts/corrupted-glyph/0-255.pbf',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'corrupted-glyph',
        range: '0-255',
      });

      const result = await service.verifyAndRepairGlyphs();

      expect(result.removed).toBe(1);

      // Verify glyph was deleted
      const glyph = await db.get('glyphs', 'corrupted-glyph/0-255.pbf');
      expect(glyph).toBeUndefined();
    });

    it('should remove glyphs with null data', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'null-glyph/0-255.pbf',
        data: null as unknown as ArrayBuffer,
        url: 'https://example.com/fonts/null-glyph/0-255.pbf',
        size: 100,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'null-glyph',
        range: '0-255',
      });

      const result = await service.verifyAndRepairGlyphs();

      expect(result.removed).toBe(1);
    });

    it('should handle multiple corrupted glyphs', async () => {
      const db = await dbPromise;

      await db.put('glyphs', {
        key: 'corrupted-1/0-255.pbf',
        data: new ArrayBuffer(0),
        url: 'https://example.com/fonts/corrupted-1/0-255.pbf',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'corrupted-1',
        range: '0-255',
      });

      await db.put('glyphs', {
        key: 'corrupted-2/0-255.pbf',
        data: new ArrayBuffer(0),
        url: 'https://example.com/fonts/corrupted-2/0-255.pbf',
        size: 0,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
        fontstack: 'corrupted-2',
        range: '0-255',
      });

      const result = await service.verifyAndRepairGlyphs();

      expect(result.removed).toBe(2);
    });
  });

  describe('getGlyphAnalytics edge cases', () => {
    it('should calculate age span correctly', async () => {
      const db = await dbPromise;
      const oldTime = Date.now() - 100000;
      const newTime = Date.now();

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

      await db.put('glyphs', {
        key: 'new-font/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/new-font/0-255.pbf',
        size: 100,
        lastModified: newTime,
        downloadedAt: new Date(newTime).toISOString(),
        fontstack: 'new-font',
        range: '0-255',
      });

      const analytics = await service.getGlyphAnalytics();
      const temporal = analytics.temporal as { ageSpan: number };

      expect(temporal.ageSpan).toBe(newTime - oldTime);
    });

    it('should return zero age span when only one glyph exists', async () => {
      const db = await dbPromise;
      const now = Date.now();

      await db.put('glyphs', {
        key: 'only-font/0-255.pbf',
        data: new ArrayBuffer(100),
        url: 'https://example.com/fonts/only-font/0-255.pbf',
        size: 100,
        lastModified: now,
        downloadedAt: new Date(now).toISOString(),
        fontstack: 'only-font',
        range: '0-255',
      });

      const analytics = await service.getGlyphAnalytics();
      const temporal = analytics.temporal as { ageSpan: number };

      expect(temporal.ageSpan).toBe(0);
    });
  });

  describe('parseGlyphKey edge cases via getGlyphStats', () => {
    it('parses "style::fontstack/range.pbf" format', async () => {
      const db = await dbPromise;
      // Store a glyph without the denormalized fontstack/range fields so
      // getGlyphStats falls back to parseGlyphKey.
      await db.put('glyphs', {
        key: 'my-style::Noto Sans/0-255.pbf',
        data: new ArrayBuffer(10),
        url: 'u',
        size: 10,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      } as never);
      const stats = await glyphService.getGlyphStats();
      expect(stats.count).toBe(1);
      // fontsByStack should key on the parsed fontstack.
      expect(Object.keys(stats.fontsByStack)).toContain('Noto Sans');
    });

    it('parses "style:fontstack_range" format', async () => {
      const db = await dbPromise;
      await db.put('glyphs', {
        key: 'style-x:Arial_0-255',
        data: new ArrayBuffer(10),
        url: 'u',
        size: 10,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      } as never);
      const stats = await glyphService.getGlyphStats();
      expect(stats.count).toBeGreaterThanOrEqual(1);
    });

    it('parses "fontstack/range.pbf" format without a style prefix', async () => {
      const db = await dbPromise;
      await db.put('glyphs', {
        key: 'Arial/0-255.pbf',
        data: new ArrayBuffer(10),
        url: 'u',
        size: 10,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      } as never);
      const stats = await glyphService.getGlyphStats();
      expect(stats.count).toBeGreaterThanOrEqual(1);
    });

    it('falls back to the whole trimmed string when no delimiter is present', async () => {
      const db = await dbPromise;
      await db.put('glyphs', {
        key: 'raw-key-no-delimiter',
        data: new ArrayBuffer(10),
        url: 'u',
        size: 10,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      } as never);
      const stats = await glyphService.getGlyphStats();
      expect(stats.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('exported functions', () => {
    it('should export getGlyphStats function', async () => {
      const stats = await getGlyphStats();
      expect(stats).toBeDefined();
      expect(stats.count).toBe(0);
    });

    it('should export getGlyphAnalytics function', async () => {
      const analytics = await getGlyphAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.basic).toBeDefined();
    });

    it('should export cleanupOldGlyphs function', async () => {
      const deleted = await cleanupOldGlyphs();
      expect(typeof deleted).toBe('number');
    });

    it('should export loadGlyphs function', async () => {
      const ranges = await loadGlyphs('Arial', ['0-255']);
      expect(Array.isArray(ranges)).toBe(true);
    });

    it('should export glyphService singleton', () => {
      expect(glyphService).toBeDefined();
      expect(glyphService).toBeInstanceOf(GlyphService);
    });

    it('should export verifyAndRepairGlyphs function', async () => {
      const result = await verifyAndRepairGlyphs();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('repaired');
      expect(result).toHaveProperty('removed');
    });
  });
});
