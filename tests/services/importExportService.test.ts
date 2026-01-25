/**
 * Tests for Import/Export Service
 */
import { ImportExportService } from '../../src/services/importExportService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

// Helper function to store a region inside a style entry
async function storeRegionInStyle(
  db: Awaited<typeof dbPromise>,
  styleId: string,
  region: {
    id: string;
    name: string;
    bounds: [[number, number], [number, number]];
    styleUrl: string;
    minZoom: number;
    maxZoom: number;
    created: number;
    expiry: number;
  }
) {
  const existingStyle = await db.get('styles', styleId);
  if (existingStyle) {
    existingStyle.regions = existingStyle.regions || [];
    existingStyle.regions.push(region);
    await db.put('styles', existingStyle);
  } else {
    await db.put('styles', {
      key: styleId,
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto' as StyleProvider,
      regions: [region],
      fonts: [],
      glyphs: [],
      sprites: [],
    });
  }
}

describe('ImportExportService', () => {
  let service: ImportExportService;

  beforeEach(async () => {
    service = new ImportExportService();
    const db = await dbPromise;
    await db.clear('regions'); // Keep for backward compatibility
    await db.clear('styles');
    await db.clear('tiles');
    await db.clear('sprites');
    await db.clear('fonts');
  });

  describe('exportRegionAsJSON', () => {
    it('should throw error when region does not exist', async () => {
      await expect(service.exportRegionAsJSON('non-existent-region')).rejects.toThrow(
        'Export failed: Region non-existent-region not found'
      );
    });

    it('should export region with metadata', async () => {
      const db = await dbPromise;

      // Create a test region inside a style
      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const result = await service.exportRegionAsJSON('test-region');

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.filename).toContain('Test Region');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should call onProgress callback during export', async () => {
      const db = await dbPromise;
      const progressCalls: Array<{ stage: string; percentage: number }> = [];

      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await service.exportRegionAsJSON('test-region', {
        onProgress: (progress) => {
          progressCalls.push({
            stage: progress.stage,
            percentage: progress.percentage,
          });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].stage).toBe('preparing');
      expect(progressCalls[progressCalls.length - 1].stage).toBe('complete');
      expect(progressCalls[progressCalls.length - 1].percentage).toBe(100);
    });

    it('should export tiles when includeTiles is true', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await db.put('tiles', {
        key: 'test-region:source:10:100:200.pbf',
        styleId: 'test-region',
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

      const result = await service.exportRegionAsJSON('test-region', {
        includeTiles: true,
      });

      expect(result.success).toBe(true);
      expect(result.statistics.tilesExported).toBe(1);
    });

    it('should skip tiles when includeTiles is false', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await db.put('tiles', {
        key: 'test-region:source:10:100:200.pbf',
        styleId: 'test-region',
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

      const result = await service.exportRegionAsJSON('test-region', {
        includeTiles: false,
      });

      expect(result.success).toBe(true);
      expect(result.statistics.tilesExported).toBe(0);
    });

    it('should export style when includeStyle is true', async () => {
      const db = await dbPromise;

      // Style already exists with region inside
      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const result = await service.exportRegionAsJSON('test-region', {
        includeStyle: true,
      });

      expect(result.success).toBe(true);
    });

    it('should export sprites when includeSprites is true', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await db.put('sprites', {
        key: 'sprite-1',
        url: 'https://example.com/sprite.png',
        data: new ArrayBuffer(500),
        size: 500,
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const result = await service.exportRegionAsJSON('test-region', {
        includeSprites: true,
      });

      expect(result.success).toBe(true);
      expect(result.statistics.spritesExported).toBe(1);
    });

    it('should export fonts when includeFonts is true', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await db.put('fonts', {
        key: 'Arial/0-255.pbf',
        url: 'https://example.com/fonts/Arial/0-255.pbf',
        originalUrl: 'https://example.com/fonts/Arial/0-255.pbf',
        data: new ArrayBuffer(1000),
        size: 1000,
        type: 'pbf',
        contentType: 'application/x-protobuf',
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      const result = await service.exportRegionAsJSON('test-region', {
        includeFonts: true,
      });

      expect(result.success).toBe(true);
      expect(result.statistics.fontsExported).toBe(1);
    });
  });

  describe('exportRegionAsPMTiles', () => {
    it('should throw error when region does not exist', async () => {
      await expect(service.exportRegionAsPMTiles('non-existent-region')).rejects.toThrow(
        'PMTiles export failed: Region non-existent-region not found'
      );
    });

    it('should export region as PMTiles format', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const result = await service.exportRegionAsPMTiles('test-region');

      expect(result.success).toBe(true);
      expect(result.format).toBe('pmtiles');
      expect(result.filename).toContain('.pmtiles');
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should call onProgress callback', async () => {
      const db = await dbPromise;
      const progressCalls: string[] = [];

      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await service.exportRegionAsPMTiles('test-region', {
        onProgress: (progress) => {
          progressCalls.push(progress.stage);
        },
      });

      expect(progressCalls).toContain('preparing');
      expect(progressCalls).toContain('complete');
    });

    it('should include custom metadata in PMTiles export', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const result = await service.exportRegionAsPMTiles('test-region', {
        metadata: { author: 'Test Author' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('exportRegionAsMBTiles', () => {
    it('should throw error when region does not exist', async () => {
      await expect(service.exportRegionAsMBTiles('non-existent-region')).rejects.toThrow(
        'MBTiles export failed: Region non-existent-region not found'
      );
    });

    it('should export region as MBTiles format', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-style', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const result = await service.exportRegionAsMBTiles('test-region');

      expect(result.success).toBe(true);
      expect(result.format).toBe('mbtiles');
      expect(result.filename).toContain('.mbtiles');
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should export tiles with MBTiles structure', async () => {
      const db = await dbPromise;

      await storeRegionInStyle(db, 'test-region', {
        id: 'test-region',
        name: 'Test Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await db.put('tiles', {
        key: 'test-region:source:10:100:200.pbf',
        styleId: 'test-region',
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

      const result = await service.exportRegionAsMBTiles('test-region');

      expect(result.success).toBe(true);
      expect(result.statistics.tilesExported).toBe(1);
    });
  });

  describe('importRegion', () => {
    it('should return failure for unsupported format', async () => {
      const mockFile = new File(['{}'], 'test.unknown', { type: 'application/octet-stream' });

      const result = await service.importRegion({
        file: mockFile,
        format: 'unknown' as 'json' | 'pmtiles' | 'mbtiles',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported format');
    });

    it('should import valid JSON format', async () => {
      const exportData = {
        metadata: {
          id: 'imported-region',
          name: 'Imported Region',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.regionId).toBe('imported-region');
    });

    it('should use newRegionId when provided', async () => {
      const exportData = {
        metadata: {
          id: 'original-id',
          name: 'Original Name',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
        newRegionId: 'custom-region-id',
        newRegionName: 'Custom Region Name',
      });

      expect(result.success).toBe(true);
      expect(result.regionId).toBe('custom-region-id');
    });

    it('should fail when region exists and overwrite is false', async () => {
      const db = await dbPromise;

      // Create existing region inside a style
      await storeRegionInStyle(db, 'test-style', {
        id: 'existing-region',
        name: 'Existing Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const exportData = {
        metadata: {
          id: 'existing-region',
          name: 'Imported Region',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
        overwrite: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Region already exists');
    });

    it('should succeed when region exists and overwrite is true', async () => {
      const db = await dbPromise;

      // Create existing region inside a style
      await storeRegionInStyle(db, 'test-style', {
        id: 'existing-region',
        name: 'Existing Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 0,
        maxZoom: 14,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const exportData = {
        metadata: {
          id: 'existing-region',
          name: 'Updated Region',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
        overwrite: true,
      });

      expect(result.success).toBe(true);
    });

    it('should import tiles along with region', async () => {
      const exportData = {
        metadata: {
          id: 'region-with-tiles',
          name: 'Region With Tiles',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: {},
        tiles: [
          { z: 10, x: 100, y: 200, data: new ArrayBuffer(100), format: 'pbf', sourceId: 'source' },
          { z: 10, x: 101, y: 200, data: new ArrayBuffer(100), format: 'pbf', sourceId: 'source' },
        ],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.statistics.tilesImported).toBe(2);
    });

    it('should import style along with region', async () => {
      const exportData = {
        metadata: {
          id: 'region-with-style',
          name: 'Region With Style',
          description: 'Test import',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'json',
        },
        style: { version: 8, sources: {}, layers: [] },
        tiles: [],
        sprites: [],
        fonts: [],
      };

      const mockFile = new File([JSON.stringify(exportData)], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
      });

      expect(result.success).toBe(true);

      // Verify style was imported
      const db = await dbPromise;
      const style = await db.get('styles', 'region-with-style');
      expect(style).toBeDefined();
    });

    it('should handle PMTiles format import', async () => {
      const pmtilesData = {
        header: {
          version: 3,
          type: 'mvt',
          compression: 'gzip',
          bounds: [[-122.5, 37.5], [-122.0, 38.0]],
          minZoom: 0,
          maxZoom: 14,
          metadata: {
            name: 'PMTiles Region',
            description: 'Test PMTiles import',
          },
        },
        tiles: [],
      };

      const mockFile = new File([JSON.stringify(pmtilesData)], 'test.pmtiles', {
        type: 'application/octet-stream',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'pmtiles',
      });

      expect(result.success).toBe(true);
      expect(result.regionId).toBe('PMTiles Region');
    });

    it('should handle MBTiles format import', async () => {
      const mbtilesData = {
        metadata: {
          name: 'MBTiles Region',
          type: 'overlay',
          version: '1.0',
          description: 'Test MBTiles import',
          format: 'pbf',
          bounds: '-122.5,37.5,-122.0,38.0',
          minzoom: 0,
          maxzoom: 14,
        },
        tiles: [],
      };

      const mockFile = new File([JSON.stringify(mbtilesData)], 'test.mbtiles', {
        type: 'application/octet-stream',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'mbtiles',
      });

      expect(result.success).toBe(true);
      expect(result.regionId).toBe('MBTiles Region');
    });

    it('should handle file read errors', async () => {
      // Create a file that will fail to parse
      const mockFile = new File(['invalid json {{{'], 'test.json', {
        type: 'application/json',
      });

      const result = await service.importRegion({
        file: mockFile,
        format: 'json',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Import failed');
    });
  });
});
