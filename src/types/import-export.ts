// Import/Export types for regions.
//
// The library's import/export API is MBTiles-only. The RegionExportData /
// RegionImportData shapes are the internal representation the service
// pipes between `parseMBTiles` and `importRegionData`; callers of the
// public API only ever see `RegionImportData` (with a File) and
// `ExportResult` (with a Blob).

export interface RegionExportData {
  metadata: {
    id: string;
    name: string;
    description?: string;
    bounds: [[number, number], [number, number]];
    minZoom: number;
    maxZoom: number;
    styleUrl: string;
    createdAt: number;
    exportedAt: number;
    version: string;
    format: 'mbtiles';
  };
  style: unknown; // MapLibre style JSON
  tiles: TileExportData[];
}

export interface TileExportData {
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  format: 'pbf' | 'png' | 'jpg' | 'webp';
  sourceId: string;
}

export interface MBTilesExportOptions {
  /** Tile format written into the MBTiles metadata table. */
  format?: 'pbf' | 'png' | 'jpg';
  /** Additional metadata rows. Values are JSON-stringified if non-string. */
  metadata?: Record<string, unknown>;
}

export interface ImportExportOptions {
  onProgress?: (progress: ImportExportProgress) => void;
}

export interface ImportExportProgress {
  stage: 'preparing' | 'exporting' | 'importing' | 'processing' | 'complete';
  percentage: number;
  message: string;
  currentItem?: string;
  totalItems?: number;
  completedItems?: number;
}

export interface RegionImportData {
  file: File;
  /** Format is fixed to mbtiles; kept as a literal field for forward-compat. */
  format: 'mbtiles';
  overwrite?: boolean;
  newRegionId?: string;
  newRegionName?: string;
  onProgress?: (progress: ImportExportProgress) => void;
}

export interface ImportResult {
  success: boolean;
  regionId: string;
  message: string;
  warnings?: string[];
  statistics: {
    tilesImported: number;
    spritesImported: number;
    fontsImported: number;
    totalSize: number;
  };
}

export interface ExportResult {
  success: boolean;
  format: 'mbtiles';
  filename: string;
  blob: Blob;
  size: number;
  statistics: {
    tilesExported: number;
    spritesExported: number;
    fontsExported: number;
  };
}
