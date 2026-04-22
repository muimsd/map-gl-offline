import { dbPromise } from '@/storage/indexedDbManager';
import { logger } from '@/utils/logger';
import { createTileKey } from '@/utils/tileKey';
import { getSqlJs } from '@/utils/sqlJsLoader';
import type {
  RegionExportData,
  RegionImportData,
  ImportExportOptions,
  ImportExportProgress,
  ImportResult,
  ExportResult,
  TileExportData,
  BaseStyle,
  MBTilesExportOptions,
  StoredRegion,
} from '@/types';

/**
 * MBTiles uses TMS tile_row ordering; our storage uses XYZ y. Flip across
 * either direction with the same formula.
 */
function flipY(y: number, z: number): number {
  return (1 << z) - 1 - y;
}

/** Vector tile formats that downstream consumers (QGIS, maplibre-native) expect gzipped. */
const VECTOR_FORMATS = new Set(['pbf', 'mvt']);

function hasGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function drainReadable(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function transformBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // Don't await — the read loop below drives the pipe and we only want
  // the final bytes, not back-pressure handling for a single chunk.
  void writer.write(bytes as BufferSource);
  void writer.close();
  return drainReadable(transform.readable);
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  return transformBytes(bytes, new CompressionStream('gzip'));
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  return transformBytes(bytes, new DecompressionStream('gzip'));
}

/**
 * Build the MBTiles `json` metadata payload. For vector tiles this is
 * mandatory for tippecanoe/QGIS/maplibre-native to render — they read
 * `vector_layers` from here.
 *
 * `vector_layers` is inferred from the offline style's vector sources
 * (populated by the TileJSON expansion step in styleService). Multiple
 * vector sources are merged; duplicates de-duped by id, first wins.
 */
function buildVectorJsonMetadata(style: unknown, sourceIds: Set<string>): string | null {
  if (!style || typeof style !== 'object') return null;
  const sources = (style as { sources?: Record<string, unknown> }).sources;
  if (!sources) return null;

  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const [id, src] of Object.entries(sources)) {
    if (sourceIds.size > 0 && !sourceIds.has(id)) continue;
    const layers = (src as { vector_layers?: Array<Record<string, unknown>> })?.vector_layers;
    if (!Array.isArray(layers)) continue;
    for (const layer of layers) {
      const layerId = typeof layer?.id === 'string' ? layer.id : null;
      if (!layerId || seen.has(layerId)) continue;
      seen.add(layerId);
      merged.push(layer);
    }
  }

  if (merged.length === 0) return null;
  return JSON.stringify({ vector_layers: merged });
}

const serviceLogger = logger.scope('ImportExportService');

export class ImportExportService {
  private db = dbPromise;

  constructor() {
    // No need for initialization since dbPromise is already available
  }

  /**
   * Export region as a real binary MBTiles SQLite file.
   *
   * Produces a v1.3-compliant MBTiles archive: `metadata` + `tiles` tables,
   * with `tile_row` flipped to TMS ordering. The resulting blob can be read
   * by tippecanoe, QGIS, maplibre-native, etc.
   */
  async exportRegionAsMBTiles(
    regionId: string,
    options: ImportExportOptions & MBTilesExportOptions = {}
  ): Promise<ExportResult> {
    const onProgress = options.onProgress || (() => {});

    try {
      onProgress({
        stage: 'preparing',
        percentage: 0,
        message: 'Preparing MBTiles export...',
      });

      const region = await this.getRegionMetadata(regionId);
      if (!region) {
        throw new Error(`Region ${regionId} not found`);
      }

      const tiles = await this.exportTiles(regionId, onProgress);

      // Pick format: caller override → region.tileExtension → default pbf.
      // Drives both the metadata row and whether tile bytes get gzipped.
      const format = String(options.format || region.tileExtension || 'pbf').toLowerCase();
      const isVector = VECTOR_FORMATS.has(format);

      onProgress({
        stage: 'processing',
        percentage: 75,
        message: isVector ? 'Compressing vector tiles...' : 'Packing SQLite database...',
      });

      // Gzip vector tiles. Idempotent: skip tiles already gzipped (downloaded
      // with their original gzip wrapper intact).
      const packedTiles: Array<{ z: number; x: number; y: number; data: Uint8Array }> = [];
      for (const tile of tiles) {
        const raw =
          tile.data instanceof ArrayBuffer
            ? new Uint8Array(tile.data)
            : new Uint8Array(tile.data as ArrayBufferLike);
        const data = isVector && !hasGzipMagic(raw) ? await gzipBytes(raw) : raw;
        packedTiles.push({ z: tile.z, x: tile.x, y: tile.y, data });
      }

      onProgress({
        stage: 'processing',
        percentage: 85,
        message: 'Packing SQLite database...',
      });

      const SQL = await getSqlJs();
      const db = new SQL.Database();
      try {
        db.run(`
          CREATE TABLE metadata (name TEXT, value TEXT);
          CREATE TABLE tiles (
            zoom_level  INTEGER NOT NULL,
            tile_column INTEGER NOT NULL,
            tile_row    INTEGER NOT NULL,
            tile_data   BLOB
          );
          CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
          CREATE UNIQUE INDEX name ON metadata (name);
        `);

        const [[west, south], [east, north]] = region.bounds;
        const centerLon = (west + east) / 2;
        const centerLat = (south + north) / 2;
        const centerZoom = Math.max(
          region.minZoom,
          Math.min(region.maxZoom, Math.round((region.minZoom + region.maxZoom) / 2))
        );

        const metadataRows: Record<string, string> = {
          name: region.name || region.id,
          // MBTiles 1.3 type: 'overlay' or 'baselayer'. Baselayer matches how
          // QGIS treats the dataset (full-coverage map rather than overlay).
          type: isVector ? 'baselayer' : 'overlay',
          version: '1.0',
          description: region.name || region.id,
          format,
          bounds: `${west},${south},${east},${north}`,
          center: `${centerLon},${centerLat},${centerZoom}`,
          minzoom: String(region.minZoom),
          maxzoom: String(region.maxZoom),
        };

        // For vector tiles, the `json` field with `vector_layers` is required
        // by the MBTiles 1.3 spec and by every vector tile consumer worth
        // opening the file in. Derive it from the offline style.
        if (isVector) {
          const style = await this.exportStyle(regionId);
          const sourceIds = new Set(tiles.map(t => t.sourceId).filter(Boolean) as string[]);
          const json = buildVectorJsonMetadata(
            (style as { style?: unknown }).style ?? style,
            sourceIds
          );
          if (json) metadataRows.json = json;
        }

        for (const [k, v] of Object.entries(options.metadata || {})) {
          metadataRows[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }

        const insertMeta = db.prepare(`INSERT INTO metadata (name, value) VALUES (?, ?)`);
        try {
          for (const [name, value] of Object.entries(metadataRows)) {
            insertMeta.run([name, value]);
          }
        } finally {
          insertMeta.free();
        }

        const insertTile = db.prepare(
          `INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data)
           VALUES (?, ?, ?, ?)`
        );
        try {
          db.run('BEGIN');
          for (const tile of packedTiles) {
            insertTile.run([tile.z, tile.x, flipY(tile.y, tile.z), tile.data]);
          }
          db.run('COMMIT');
        } finally {
          insertTile.free();
        }

        const binary = db.export();
        const blob = new Blob([binary.buffer as ArrayBuffer], {
          type: 'application/x-sqlite3',
        });

        onProgress({
          stage: 'complete',
          percentage: 100,
          message: 'MBTiles export complete!',
        });

        return {
          success: true,
          format: 'mbtiles',
          filename: `${region.name || region.id}.mbtiles`,
          blob,
          size: blob.size,
          statistics: {
            tilesExported: tiles.length,
            spritesExported: 0,
            fontsExported: 0,
          },
        };
      } finally {
        db.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`MBTiles export failed: ${errorMessage}`);
    }
  }

  /**
   * Import region from a binary MBTiles (SQLite) file.
   */
  async importRegion(importData: RegionImportData): Promise<ImportResult> {
    const onProgress = importData.onProgress || (() => {});
    try {
      onProgress({
        stage: 'preparing',
        percentage: 0,
        message: 'Reading file...',
      });

      if (importData.format !== 'mbtiles') {
        throw new Error(`Unsupported format: ${importData.format}`);
      }

      const buffer = await this.readFileAsArrayBuffer(importData.file);
      onProgress({ stage: 'importing', percentage: 40, message: 'Parsing MBTiles...' });
      const regionData = await this.parseMBTiles(buffer);

      onProgress({
        stage: 'importing',
        percentage: 70,
        message: `Importing ${regionData.tiles?.length ?? 0} tiles...`,
      });

      const result = await this.importRegionData(regionData, importData);

      onProgress({
        stage: 'complete',
        percentage: 100,
        message: result.success ? 'Import complete!' : result.message,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        regionId: '',
        message: `Import failed: ${errorMessage}`,
        statistics: {
          tilesImported: 0,
          spritesImported: 0,
          fontsImported: 0,
          totalSize: 0,
        },
      };
    }
  }

  /**
   * Get region metadata from styles.regions[]
   */
  private async getRegionMetadata(regionId: string): Promise<StoredRegion | null> {
    const db = await this.db;

    try {
      // Regions are stored inside styles.regions[], not in a separate regions table
      const styles = await db.getAll('styles');
      for (const style of styles) {
        const styleEntry = style as { key?: string; regions?: Array<{ id?: string }> };
        if (styleEntry.regions && Array.isArray(styleEntry.regions)) {
          const region = styleEntry.regions.find(r => r.id === regionId);
          if (region) {
            return {
              ...region,
              key: region.id,
              styleId: styleEntry.key,
              created: (region as { created?: number }).created || Date.now(),
              lastModified: (region as { created?: number }).created || Date.now(),
              expiry:
                (region as { expiry?: number }).expiry || Date.now() + 30 * 24 * 60 * 60 * 1000,
            } as StoredRegion;
          }
        }
      }
      return null;
    } catch (error) {
      serviceLogger.error('Error getting region metadata:', error);
      return null;
    }
  }

  /**
   * Export style data
   */
  private async exportStyle(regionId: string): Promise<Record<string, unknown>> {
    const db = await this.db;
    const transaction = db.transaction(['styles'], 'readonly');
    const store = transaction.objectStore('styles');

    try {
      // Regions are stored inside styles.regions[], so we need to find
      // which style contains this regionId
      let cursor = await store.openCursor();
      while (cursor) {
        const styleEntry = cursor.value as { key?: string; regions?: Array<{ id?: string }> };
        if (styleEntry.regions && Array.isArray(styleEntry.regions)) {
          const hasRegion = styleEntry.regions.some(r => r.id === regionId);
          if (hasRegion) {
            return styleEntry;
          }
        }
        cursor = await cursor.continue();
      }
      return {};
    } catch (error) {
      serviceLogger.error('Error exporting style:', error);
      return {};
    }
  }

  /**
   * Export tiles data
   */
  private async exportTiles(
    regionId: string,
    onProgress?: (progress: ImportExportProgress) => void
  ): Promise<TileExportData[]> {
    const db = await this.db;

    // First, find the styleId for this region
    const region = await this.getRegionMetadata(regionId);
    const styleId = region?.styleId || regionId;

    const transaction = db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');

    const tiles: TileExportData[] = [];

    try {
      let cursor = await store.openCursor();
      let processed = 0;

      while (cursor) {
        const tile = cursor.value;
        // Filter tiles by the region's styleId
        if (tile.styleId === styleId) {
          tiles.push({
            z: tile.z ?? 0, // Handle optional z
            x: tile.x ?? 0, // Handle optional x
            y: tile.y ?? 0, // Handle optional y
            data: tile.data,
            format: 'pbf', // TileEntry doesn't have format, use default
            sourceId: tile.sourceId ?? 'default', // Handle optional sourceId
          });
        }

        processed++;
        if (onProgress && processed % 100 === 0) {
          onProgress({
            stage: 'exporting',
            percentage: 30 + (processed / 1000) * 40, // Rough estimation
            message: `Exported ${processed} tiles...`,
            currentItem: `${tile.z ?? 0}/${tile.x ?? 0}/${tile.y ?? 0}`,
            completedItems: processed,
          });
        }
        cursor = await cursor.continue();
      }

      return tiles;
    } catch (error) {
      serviceLogger.error('Error exporting tiles:', error);
      return [];
    }
  }

  /**
   * Read file content as ArrayBuffer (for the binary MBTiles file).
   */
  private async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse a real binary MBTiles (SQLite) file into our import-data shape.
   * Un-flips the TMS tile_row back to XYZ y.
   */
  private async parseMBTiles(buffer: ArrayBuffer): Promise<RegionExportData> {
    const bytes = new Uint8Array(buffer);
    // SQLite header: "SQLite format 3\0" (16 bytes). Validate up front so
    // non-MBTiles files (e.g. a JSON renamed to .mbtiles) surface a clear
    // error instead of the opaque "file is not a database" from sql.js.
    if (bytes.byteLength < 16) {
      throw new Error('Not a valid MBTiles file: file is too small');
    }
    const magic = String.fromCharCode(...bytes.slice(0, 15));
    if (magic !== 'SQLite format 3') {
      throw new Error('Not a valid MBTiles file: missing SQLite header');
    }

    const SQL = await getSqlJs();
    const db = new SQL.Database(bytes);

    try {
      const tablesResult = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('metadata', 'tiles')"
      );
      const tableNames = (tablesResult[0]?.values || []).map(r => r[0] as string);
      if (!tableNames.includes('metadata') || !tableNames.includes('tiles')) {
        throw new Error('Not a valid MBTiles file: missing required metadata/tiles tables');
      }

      const metadata: Record<string, string> = {};
      const metaStmt = db.prepare('SELECT name, value FROM metadata');
      try {
        while (metaStmt.step()) {
          const row = metaStmt.get() as [string, string];
          metadata[row[0]] = row[1];
        }
      } finally {
        metaStmt.free();
      }

      const rawBounds = metadata.bounds ? metadata.bounds.split(',').map(Number) : [0, 0, 0, 0];
      const bounds: [number, number, number, number] = [
        isFinite(rawBounds[0]) ? rawBounds[0] : 0,
        isFinite(rawBounds[1]) ? rawBounds[1] : 0,
        isFinite(rawBounds[2]) ? rawBounds[2] : 0,
        isFinite(rawBounds[3]) ? rawBounds[3] : 0,
      ];

      const format = (metadata.format || 'pbf') as TileExportData['format'];
      const isVector = VECTOR_FORMATS.has(format);
      const tiles: TileExportData[] = [];

      const tilesStmt = db.prepare(
        'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles'
      );
      try {
        while (tilesStmt.step()) {
          const row = tilesStmt.get() as [number, number, number, Uint8Array];
          const [z, x, tmsRow, data] = row;
          // Sliced copy so the buffer is detached from sql.js's heap.
          const copy = new Uint8Array(data.byteLength);
          copy.set(data);
          // Our IndexedDB stores vector tiles decompressed (tileService
          // inflates on download). MBTiles vector tiles are gzipped by
          // convention — un-gzip on the way in so the stored tile matches
          // what the fetch handler expects to serve.
          const storedBytes = isVector && hasGzipMagic(copy) ? await gunzipBytes(copy) : copy;
          tiles.push({
            z,
            x,
            y: flipY(tmsRow, z),
            data: storedBytes.buffer as ArrayBuffer,
            format,
            sourceId: 'imported',
          });
        }
      } finally {
        tilesStmt.free();
      }

      const minZoom = metadata.minzoom !== undefined ? Number(metadata.minzoom) : 0;
      const maxZoom = metadata.maxzoom !== undefined ? Number(metadata.maxzoom) : 14;

      return {
        metadata: {
          id: metadata.name || 'imported-region',
          name: metadata.name || 'Imported Region',
          description: metadata.description,
          bounds: [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          minZoom,
          maxZoom,
          styleUrl: '',
          createdAt: Date.now(),
          exportedAt: Date.now(),
          version: '1.0.0',
          format: 'mbtiles',
        },
        style: {},
        tiles,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Import region data to database
   */
  private async importRegionData(
    regionData: RegionExportData,
    importOptions: RegionImportData
  ): Promise<ImportResult> {
    const db = await this.db;
    const regionId = importOptions.newRegionId || regionData.metadata.id;
    const regionName = importOptions.newRegionName || regionData.metadata.name;

    try {
      // Check if region exists and handle overwrite
      if (!importOptions.overwrite) {
        const existingRegion = await this.getRegionMetadata(regionId);
        if (existingRegion) {
          throw new Error('Region already exists. Set overwrite to true to replace it.');
        }
      }

      // Create region metadata object
      const regionMetadata = {
        id: regionId,
        name: regionName,
        bounds: regionData.metadata.bounds,
        minZoom: regionData.metadata.minZoom,
        maxZoom: regionData.metadata.maxZoom,
        styleUrl: regionData.metadata.styleUrl,
        created: Date.now(),
        expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // Default 30 days expiry
      };

      // Import style and tiles in a single transaction for atomicity
      const transaction = db.transaction(['styles', 'tiles'], 'readwrite');
      const styleStore = transaction.objectStore('styles');
      const tileStore = transaction.objectStore('tiles');

      const styleData =
        regionData.style && Object.keys(regionData.style).length > 0
          ? (regionData.style as BaseStyle)
          : ({ version: 8, sources: {}, layers: [] } as BaseStyle);

      await styleStore.put({
        key: regionId,
        style: styleData,
        provider: 'auto',
        regions: [regionMetadata],
        fonts: [],
        glyphs: [],
        sprites: [],
      });

      // Import tiles within the same transaction
      if (regionData.tiles && regionData.tiles.length > 0) {
        for (const tile of regionData.tiles) {
          const sourceId = tile.sourceId || 'default';
          const ext = tile.format || 'pbf';
          await tileStore.put({
            key: createTileKey(tile.x, tile.y, tile.z, regionId, sourceId, ext),
            styleId: regionId,
            z: tile.z,
            x: tile.x,
            y: tile.y,
            data: tile.data,
            sourceId,
            downloadedAt: new Date().toISOString(),
            size: tile.data instanceof ArrayBuffer ? tile.data.byteLength : 0,
            type: 'vector',
            url: `tile://${tile.z}/${tile.x}/${tile.y}`,
            lastModified: Date.now(),
          });
        }
      }

      return {
        success: true,
        regionId,
        message: 'Region imported successfully',
        statistics: {
          tilesImported: regionData.tiles?.length || 0,
          spritesImported: 0,
          fontsImported: 0,
          totalSize: 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to import region data: ${errorMessage}`);
    }
  }
}
