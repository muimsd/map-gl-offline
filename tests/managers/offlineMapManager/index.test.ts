/**
 * Tests for the OfflineMapManager class + companion factory.
 * Covers the constructor, `getServices`, `getModules`, service overrides,
 * and the `createOfflineMapManager` helper.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  OfflineMapManager,
  createOfflineMapManager,
  createOfflineMapManagerModules,
} from '../../../src/managers/offlineMapManager';
import { dbPromise } from '../../../src/storage/indexedDbManager';
import { configureSqlJs } from '../../../src/utils/sqlJsLoader';
import type { StyleProvider } from '../../../src/types/style';

// Feed sql.js the wasm binary so tests don't rely on an HTTP loader.
const wasmPath = path.resolve(
  __dirname,
  '../../../node_modules/sql.js/dist/sql-wasm.wasm'
);
const wasmBinary = fs.readFileSync(wasmPath);
configureSqlJs({
  wasmBinary: wasmBinary.buffer.slice(
    wasmBinary.byteOffset,
    wasmBinary.byteOffset + wasmBinary.byteLength
  ),
});

// jsdom's File doesn't accept ArrayBuffer parts reliably; use a thin Blob subclass.
class TestFile extends Blob {
  readonly name: string;
  readonly lastModified: number;
  constructor(parts: BlobPart[], name: string, options: BlobPropertyBag = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = Date.now();
  }
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsArrayBuffer(blob as unknown as Blob);
  });
}

beforeEach(async () => {
  const db = await dbPromise;
  await db.clear('styles');
  await db.clear('tiles');
  await db.clear('fonts');
  await db.clear('glyphs');
  await db.clear('sprites');
  await db.clear('models');
});

describe('OfflineMapManager', () => {
  it('constructs without overrides and wires every module method onto the instance', () => {
    const mgr = new OfflineMapManager();
    // Sample methods from each management module — must be callable fns on the class.
    for (const name of [
      'addRegion',
      'downloadRegion',
      'loadRegion',
      'deleteRegion',
      'listRegions',
      'listStoredRegions',
      'getStoredRegion',
      'getRegionSize',
      'cleanupExpiredRegions',
      'forceCleanupExpiredRegions',
      'setupAutoCleanup',
      'stopAutoCleanup',
      'getRegionAnalytics',
      'performSmartCleanup',
      'startEnhancedAutoCleanup',
      'stopAllAutoCleanup',
      'downloadTilesWithOptions',
      'getTileStats',
      'getFontStats',
      'getSpriteStats',
      'getGlyphStats',
      'getModelStats',
      'downloadModelsWithOptions',
      'cleanupOldModels',
      'verifyAndRepairModels',
      'getComprehensiveStorageAnalytics',
      'performCompleteMaintenance',
      'exportRegionAsMBTiles',
      'importRegion',
      'downloadExportedRegion',
      'downloadStyle',
      'loadStyleById',
      'listStyles',
      'deleteStyle',
      'getStyleStats',
      'downloadMapboxStyle',
      'downloadMapLibreStyle',
      'downloadStyleWithAutoDetection',
      'cleanupOldStyles',
    ]) {
      expect(typeof (mgr as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('exposes the underlying services via getServices()', () => {
    const mgr = new OfflineMapManager();
    const services = mgr.getServices();
    expect(services.regionService).toBeDefined();
    expect(services.cleanupService).toBeDefined();
    expect(services.resourceService).toBeDefined();
    expect(services.analyticsService).toBeDefined();
    expect(services.importExportService).toBeDefined();
  });

  it('exposes the module surface via getModules()', () => {
    const mgr = new OfflineMapManager();
    const modules = mgr.getModules();
    expect(typeof modules.downloadRegion).toBe('function');
    expect(typeof modules.performCompleteMaintenance).toBe('function');
    expect(typeof modules.getComprehensiveStorageAnalytics).toBe('function');
  });

  it('accepts service overrides and uses them for delegated calls', async () => {
    const mockListStoredRegions = jest.fn().mockResolvedValue([]);
    const mockAddRegion = jest.fn().mockResolvedValue(undefined);

    // Construct a minimal regionService override that satisfies the
    // interface enough for listStoredRegions + addRegion delegation.
    const mockRegionService = {
      addRegion: mockAddRegion,
      downloadRegion: jest.fn(),
      loadRegion: jest.fn(),
      deleteRegion: jest.fn(),
      listRegions: jest.fn().mockResolvedValue([]),
      listStoredRegions: mockListStoredRegions,
    } as never;

    const mgr = new OfflineMapManager({ regionService: mockRegionService });
    expect(mgr.getServices().regionService).toBe(mockRegionService);

    await mgr.listStoredRegions();
    expect(mockListStoredRegions).toHaveBeenCalled();
  });

  it('subsequent calls return the same services/modules references', () => {
    const mgr = new OfflineMapManager();
    expect(mgr.getServices()).toBe(mgr.getServices());
    expect(mgr.getModules()).toBe(mgr.getModules());
  });
});

describe('createOfflineMapManager', () => {
  it('returns a services + modules tuple', () => {
    const { services, modules } = createOfflineMapManager();
    expect(services.regionService).toBeDefined();
    expect(typeof modules.downloadRegion).toBe('function');
  });

  it('threads overrides into both services and modules', () => {
    const customCleanup = {
      getRegionSize: jest.fn().mockResolvedValue(123),
      performCleanup: jest.fn(),
      getAllRegions: jest.fn(),
      setupAutoCleanup: jest.fn(),
      stopAutoCleanup: jest.fn(),
      getRegionAnalytics: jest.fn(),
    } as never;
    const { services } = createOfflineMapManager({ cleanupService: customCleanup });
    expect(services.cleanupService).toBe(customCleanup);
  });
});

describe('createOfflineMapManagerModules', () => {
  it('builds the module graph from a services object', () => {
    const { services } = createOfflineMapManager();
    const modules = createOfflineMapManagerModules(services);
    expect(typeof modules.addRegion).toBe('function');
    expect(typeof modules.cleanupExpiredRegions).toBe('function');
    expect(typeof modules.getComprehensiveStorageAnalytics).toBe('function');
  });
});

/**
 * End-to-end proof that the public MBTiles API actually works through
 * OfflineMapManager, not just the underlying service. Exercises the exact
 * call path a consumer would hit:
 *   mgr.exportRegionAsMBTiles(id) → ExportResult with a real SQLite blob
 *   mgr.importRegion({ file, format: 'mbtiles' }) → region materialised
 */
describe('OfflineMapManager — MBTiles API round-trip', () => {
  it('exports a region, imports it back, and preserves tiles', async () => {
    const db = await dbPromise;
    const mgr = new OfflineMapManager();

    // Seed: style with one region + a vector tile (raw PBF bytes).
    const styleId = 'api-round-trip';
    await db.put('styles', {
      key: styleId,
      style: {
        version: 8,
        sources: {
          v: {
            type: 'vector',
            tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
            vector_layers: [{ id: 'water', fields: {}, minzoom: 0, maxzoom: 14 }],
          },
        },
        layers: [],
      },
      provider: 'auto' as StyleProvider,
      regions: [
        {
          id: 'rt-region',
          name: 'Round Trip',
          bounds: [[-1, -1], [1, 1]],
          styleUrl: '',
          minZoom: 0,
          maxZoom: 2,
          created: Date.now(),
          expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      ],
      fonts: [],
      glyphs: [],
      sprites: [],
    });
    const rawTile = new Uint8Array([0x1a, 0x0f, 0x0a, 0x03, 0x66, 0x6f, 0x6f]);
    await db.put('tiles', {
      key: `${styleId}:v:1:0:0.pbf`,
      styleId,
      sourceId: 'v',
      x: 0,
      y: 0,
      z: 1,
      size: rawTile.byteLength,
      data: rawTile.buffer,
      downloadedAt: new Date().toISOString(),
      type: 'vector',
      url: '',
      lastModified: Date.now(),
    });

    // Export through the public API.
    const exportResult = await mgr.exportRegionAsMBTiles('rt-region');
    expect(exportResult.success).toBe(true);
    expect(exportResult.format).toBe('mbtiles');
    expect(exportResult.filename).toMatch(/\.mbtiles$/);
    expect(exportResult.statistics.tilesExported).toBe(1);

    // Sanity: the blob really is a SQLite file.
    const buffer = await blobToArrayBuffer(exportResult.blob);
    const magic = String.fromCharCode(...new Uint8Array(buffer).slice(0, 15));
    expect(magic).toBe('SQLite format 3');

    // Import through the public API, into a fresh region id so the original
    // is left alone (avoids the "already exists" guard).
    const file = new TestFile([buffer], 'rt.mbtiles', {
      type: 'application/x-sqlite3',
    }) as unknown as File;

    const importResult = await mgr.importRegion({
      file,
      format: 'mbtiles',
      newRegionId: 'rt-imported',
      newRegionName: 'Imported Round Trip',
    });

    expect(importResult.success).toBe(true);
    expect(importResult.regionId).toBe('rt-imported');
    expect(importResult.statistics.tilesImported).toBe(1);

    // Confirm the imported region is queryable through the public API.
    const regions = await mgr.listStoredRegions();
    const imported = regions.find(r => r.id === 'rt-imported');
    expect(imported).toBeDefined();
    expect(imported?.name).toBe('Imported Round Trip');
    expect(imported?.minZoom).toBe(0);
    expect(imported?.maxZoom).toBe(2);

    // And the tile bytes are decompressed back to the original raw PBF —
    // the offline fetch handler expects them in that shape.
    const storedTiles = await db.getAll('tiles');
    const tile = storedTiles.find(t => t.styleId === 'rt-imported');
    expect(tile).toBeDefined();
    const restored = new Uint8Array(tile!.data as ArrayBuffer);
    expect(Array.from(restored)).toEqual(Array.from(rawTile));
  });

  it('downloadExportedRegion creates an <a download>, clicks, and revokes the URL', async () => {
    const mgr = new OfflineMapManager();

    const created: string[] = [];
    const revoked: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (b: unknown) => {
      const url = `blob://test/${created.length}`;
      created.push(url);
      void b;
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      mgr.downloadExportedRegion({
        success: true,
        format: 'mbtiles',
        filename: 'dl-test.mbtiles',
        blob: new Blob([new Uint8Array([1, 2, 3])]),
        size: 3,
        statistics: { tilesExported: 0, spritesExported: 0, fontsExported: 0 },
      });
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    expect(created).toHaveLength(1);
    expect(revoked).toEqual(created);
  });

  it('surfaces the not-a-SQLite-file error path cleanly', async () => {
    const mgr = new OfflineMapManager();
    const file = new TestFile(['definitely not sqlite'], 'bad.mbtiles', {
      type: 'application/octet-stream',
    }) as unknown as File;

    const result = await mgr.importRegion({ file, format: 'mbtiles' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Not a valid MBTiles file/);
  });
});
