/**
 * Tests for Import/Export Service
 */
import * as fs from 'fs';
import * as path from 'path';
import { ImportExportService } from '../../src/services/importExportService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import { configureSqlJs, getSqlJs } from '../../src/utils/sqlJsLoader';
import type { StyleProvider } from '../../src/types/style';

// sql.js in jest/jsdom can't fetch its .wasm file over HTTP — point the loader
// at the copy shipped in node_modules. Done once per test process.
const wasmPath = path.resolve(
  __dirname,
  '../../node_modules/sql.js/dist/sql-wasm.wasm'
);
const wasmBinary = fs.readFileSync(wasmPath);
configureSqlJs({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) });

// Minimal File polyfill — jsdom's File doesn't implement arrayBuffer() reliably
// enough for FileReader, and we now need to read binary files.
class TestFile extends Blob {
  readonly name: string;
  readonly lastModified: number;

  constructor(parts: BlobPart[], name: string, options: BlobPropertyBag = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = Date.now();
  }
}

// jsdom's Blob doesn't implement arrayBuffer(); read via FileReader instead.
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsArrayBuffer(blob as unknown as Blob);
  });
}

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
    await db.clear('styles');
    await db.clear('tiles');
    await db.clear('sprites');
    await db.clear('fonts');
  });

  describe('exportRegionAsMBTiles', () => {
    it('throws when region does not exist', async () => {
      await expect(service.exportRegionAsMBTiles('non-existent-region')).rejects.toThrow(
        'MBTiles export failed: Region non-existent-region not found'
      );
    });

    it('produces a binary SQLite file with the expected schema', async () => {
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
      expect(result.filename).toMatch(/\.mbtiles$/);
      expect(result.blob).toBeInstanceOf(Blob);

      const buffer = await blobToArrayBuffer(result.blob);
      const view = new Uint8Array(buffer);
      // SQLite magic header: "SQLite format 3\0"
      const header = String.fromCharCode(...view.slice(0, 15));
      expect(header).toBe('SQLite format 3');

      // Verify schema by opening the file with sql.js
      const SQL = await getSqlJs();
      const sqliteDb = new SQL.Database(view);
      try {
        const tables = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
        const tableNames = (tables[0]?.values || []).map(r => r[0]);
        expect(tableNames).toEqual(expect.arrayContaining(['metadata', 'tiles']));

        const metaRows = sqliteDb.exec('SELECT name, value FROM metadata');
        const meta = Object.fromEntries((metaRows[0]?.values || []) as [string, string][]);
        expect(meta.name).toBe('Test Region');
        expect(meta.minzoom).toBe('0');
        expect(meta.maxzoom).toBe('14');
        expect(meta.bounds).toBe('-122.5,37.5,-122,38');
        expect(meta.format).toBe('pbf');
      } finally {
        sqliteDb.close();
      }
    });

    it('writes tiles with TMS-flipped tile_row', async () => {
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

      const tileBytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef]);
      await db.put('tiles', {
        key: 'test-region:source:10:100:200.pbf',
        styleId: 'test-region',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: tileBytes.byteLength,
        data: tileBytes.buffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const result = await service.exportRegionAsMBTiles('test-region');
      expect(result.statistics.tilesExported).toBe(1);

      const buffer = await blobToArrayBuffer(result.blob);
      const SQL = await getSqlJs();
      const sqliteDb = new SQL.Database(new Uint8Array(buffer));
      try {
        const rows = sqliteDb.exec(
          'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles'
        );
        expect(rows[0].values).toHaveLength(1);
        const [z, x, tmsRow, data] = rows[0].values[0];
        expect(z).toBe(10);
        expect(x).toBe(100);
        // TMS flip: (2^10 - 1) - 200 = 823
        expect(tmsRow).toBe(823);
        expect((data as Uint8Array)[0]).toBe(0x1f);
        expect((data as Uint8Array)[7]).toBe(0xef);
      } finally {
        sqliteDb.close();
      }
    });

    it('round-trips export → import preserving tiles', async () => {
      const db = await dbPromise;
      await storeRegionInStyle(db, 'source-region', {
        id: 'source-region',
        name: 'Source Region',
        bounds: [[-122.5, 37.5], [-122.0, 38.0]],
        styleUrl: 'https://example.com/style.json',
        minZoom: 5,
        maxZoom: 7,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const tileBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      await db.put('tiles', {
        key: 'source-region:source:5:10:20.pbf',
        styleId: 'source-region',
        sourceId: 'source',
        x: 10,
        y: 20,
        z: 5,
        size: tileBytes.byteLength,
        data: tileBytes.buffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile.pbf',
        lastModified: Date.now(),
      });

      const exportResult = await service.exportRegionAsMBTiles('source-region');
      const buffer = await blobToArrayBuffer(exportResult.blob);

      const importFile = new TestFile([buffer], 'exported.mbtiles', {
        type: 'application/octet-stream',
      }) as unknown as File;

      const importResult = await service.importRegion({
        file: importFile,
        format: 'mbtiles',
        newRegionId: 'imported-region',
        newRegionName: 'Imported Region',
      });

      expect(importResult.success).toBe(true);
      expect(importResult.regionId).toBe('imported-region');
      expect(importResult.statistics.tilesImported).toBe(1);

      // Verify the tile was re-stored with the original (XYZ) coordinates
      const storedTiles = await db.getAll('tiles');
      const imported = storedTiles.filter(t => t.styleId === 'imported-region');
      expect(imported).toHaveLength(1);
      expect(imported[0].z).toBe(5);
      expect(imported[0].x).toBe(10);
      expect(imported[0].y).toBe(20);

      const restored = new Uint8Array(imported[0].data as ArrayBuffer);
      expect(Array.from(restored)).toEqual(Array.from(tileBytes));
    });

    it('gzips vector tiles on export (QGIS/tippecanoe convention)', async () => {
      const db = await dbPromise;
      await storeRegionInStyle(db, 'vec-region', {
        id: 'vec-region',
        name: 'Vector Region',
        bounds: [[-1, -1], [1, 1]],
        styleUrl: '',
        minZoom: 0,
        maxZoom: 2,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // Raw PBF bytes (no gzip magic). tileService stores tiles decompressed,
      // so the exporter is responsible for re-wrapping.
      const rawPbf = new Uint8Array([0x1a, 0x0f, 0x0a, 0x03, 0x66, 0x6f, 0x6f]);
      await db.put('tiles', {
        key: 'vec-region:source:1:0:0.pbf',
        styleId: 'vec-region',
        sourceId: 'source',
        x: 0,
        y: 0,
        z: 1,
        size: rawPbf.byteLength,
        data: rawPbf.buffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: '',
        lastModified: Date.now(),
      });

      const result = await service.exportRegionAsMBTiles('vec-region');
      const buffer = await blobToArrayBuffer(result.blob);
      const SQL = await getSqlJs();
      const sqliteDb = new SQL.Database(new Uint8Array(buffer));
      try {
        const rows = sqliteDb.exec('SELECT tile_data FROM tiles');
        const data = rows[0].values[0][0] as Uint8Array;
        expect(data[0]).toBe(0x1f);
        expect(data[1]).toBe(0x8b); // gzip magic
      } finally {
        sqliteDb.close();
      }
    });

    it('writes vector_layers into the json metadata when the style has them', async () => {
      const db = await dbPromise;
      const styleId = 'vl-style';

      await db.put('styles', {
        key: styleId,
        style: {
          version: 8,
          sources: {
            main: {
              type: 'vector',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              vector_layers: [
                {
                  id: 'water',
                  fields: { class: 'String' },
                  minzoom: 0,
                  maxzoom: 14,
                },
                {
                  id: 'roads',
                  fields: { class: 'String', subclass: 'String' },
                  minzoom: 6,
                  maxzoom: 14,
                },
              ],
            },
          },
          layers: [],
        },
        provider: 'auto' as StyleProvider,
        regions: [
          {
            id: 'vl-region',
            name: 'VL Region',
            bounds: [[0, 0], [1, 1]],
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

      await db.put('tiles', {
        key: `${styleId}:main:1:0:0.pbf`,
        styleId,
        sourceId: 'main',
        x: 0,
        y: 0,
        z: 1,
        size: 4,
        data: new Uint8Array([1, 2, 3, 4]).buffer,
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: '',
        lastModified: Date.now(),
      });

      const result = await service.exportRegionAsMBTiles('vl-region');
      const buffer = await blobToArrayBuffer(result.blob);
      const SQL = await getSqlJs();
      const sqliteDb = new SQL.Database(new Uint8Array(buffer));
      try {
        const rows = sqliteDb.exec("SELECT value FROM metadata WHERE name = 'json'");
        expect(rows[0].values[0][0]).toBeTruthy();
        const parsed = JSON.parse(rows[0].values[0][0] as string);
        expect(parsed.vector_layers).toHaveLength(2);
        expect(parsed.vector_layers.map((v: { id: string }) => v.id)).toEqual([
          'water',
          'roads',
        ]);
      } finally {
        sqliteDb.close();
      }
    });

    it('accepts custom metadata entries', async () => {
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

      const result = await service.exportRegionAsMBTiles('test-region', {
        metadata: { attribution: 'Test Author' },
      });

      const buffer = await blobToArrayBuffer(result.blob);
      const SQL = await getSqlJs();
      const sqliteDb = new SQL.Database(new Uint8Array(buffer));
      try {
        const rows = sqliteDb.exec(
          "SELECT value FROM metadata WHERE name = 'attribution'"
        );
        expect(rows[0].values[0][0]).toBe('Test Author');
      } finally {
        sqliteDb.close();
      }
    });
  });

  describe('importRegion', () => {
    // Helper: produce a minimal real MBTiles blob for a region id so the
    // overwrite tests can drive the full import pipeline.
    async function makeMbtilesBlobFor(regionId: string): Promise<ArrayBuffer> {
      const db = await dbPromise;
      await storeRegionInStyle(db, 'src-style-' + regionId, {
        id: regionId,
        name: regionId,
        bounds: [[-1, -1], [1, 1]],
        styleUrl: '',
        minZoom: 0,
        maxZoom: 1,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      const res = await service.exportRegionAsMBTiles(regionId);
      return blobToArrayBuffer(res.blob);
    }

    it('returns failure for unsupported format', async () => {
      const mockFile = new TestFile(['{}'], 'test.unknown', {
        type: 'application/octet-stream',
      }) as unknown as File;

      const result = await service.importRegion({
        file: mockFile,
        format: 'unknown' as 'mbtiles',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported format');
    });

    it('refuses to overwrite an existing region when overwrite is false', async () => {
      const buffer = await makeMbtilesBlobFor('existing-region');
      // Import once to materialise 'existing-region' in the DB.
      await service.importRegion({
        file: new TestFile([buffer.slice(0)], 'r.mbtiles') as unknown as File,
        format: 'mbtiles',
        newRegionId: 'existing-region',
      });

      const result = await service.importRegion({
        file: new TestFile([buffer.slice(0)], 'r.mbtiles') as unknown as File,
        format: 'mbtiles',
        newRegionId: 'existing-region',
        overwrite: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Region already exists');
    });

    it('overwrites when overwrite is true', async () => {
      const buffer = await makeMbtilesBlobFor('over-region');
      await service.importRegion({
        file: new TestFile([buffer.slice(0)], 'r.mbtiles') as unknown as File,
        format: 'mbtiles',
        newRegionId: 'over-region',
      });

      const result = await service.importRegion({
        file: new TestFile([buffer.slice(0)], 'r.mbtiles') as unknown as File,
        format: 'mbtiles',
        newRegionId: 'over-region',
        overwrite: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects a non-SQLite file masquerading as .mbtiles', async () => {
      const mockFile = new TestFile(
        [JSON.stringify({ not: 'an mbtiles file' })],
        'fake.mbtiles',
        { type: 'application/octet-stream' }
      ) as unknown as File;

      const result = await service.importRegion({ file: mockFile, format: 'mbtiles' });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Not a valid MBTiles file/);
    });

    it('rejects a SQLite file missing metadata/tiles tables', async () => {
      const SQL = await getSqlJs();
      const db = new SQL.Database();
      db.run('CREATE TABLE some_other_table (foo TEXT)');
      const bytes = db.export();
      db.close();

      const mockFile = new TestFile([bytes.buffer as ArrayBuffer], 'bad.mbtiles', {
        type: 'application/octet-stream',
      }) as unknown as File;

      const result = await service.importRegion({ file: mockFile, format: 'mbtiles' });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/missing required metadata\/tiles tables/);
    });

    it('emits progress callbacks during mbtiles import', async () => {
      // Produce a real mbtiles blob first
      const db = await dbPromise;
      await storeRegionInStyle(db, 'source-region', {
        id: 'source-region',
        name: 'Source Region',
        bounds: [[-1, -1], [1, 1]],
        styleUrl: '',
        minZoom: 0,
        maxZoom: 2,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      const exportResult = await service.exportRegionAsMBTiles('source-region');
      const buffer = await blobToArrayBuffer(exportResult.blob);
      const file = new TestFile([buffer], 'r.mbtiles', {
        type: 'application/octet-stream',
      }) as unknown as File;

      const stages: string[] = [];
      const result = await service.importRegion({
        file,
        format: 'mbtiles',
        newRegionId: 'imported',
        onProgress: p => stages.push(p.stage),
      });

      expect(result.success).toBe(true);
      expect(stages[0]).toBe('preparing');
      expect(stages).toContain('importing');
      expect(stages[stages.length - 1]).toBe('complete');
    });
  });
});
