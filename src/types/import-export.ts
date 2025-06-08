// Import/Export types for regions and map data

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
    format: 'json' | 'pmtiles' | 'mbtiles';
  };
  style: any; // MapLibre style JSON
  tiles: TileExportData[];
  sprites: SpriteExportData[];
  fonts: FontExportData[];
}

export interface TileExportData {
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  format: 'pbf' | 'png' | 'jpg' | 'webp';
  sourceId: string;
}

export interface SpriteExportData {
  url: string;
  data: ArrayBuffer;
  type: 'json' | 'png';
  resolution: '1x' | '2x';
}

export interface FontExportData {
  fontStack: string;
  range: string;
  data: ArrayBuffer;
}

export interface PMTilesExportOptions {
  compression?: 'gzip' | 'brotli' | 'none';
  clustered?: boolean;
  metadata?: Record<string, any>;
}

export interface MBTilesExportOptions {
  format?: 'pbf' | 'png' | 'jpg';
  compression?: 'gzip' | 'none';
  metadata?: Record<string, any>;
}

export interface ImportExportOptions {
  includeStyle?: boolean;
  includeTiles?: boolean;
  includeSprites?: boolean;
  includeFonts?: boolean;
  format?: 'json' | 'pmtiles' | 'mbtiles';
  compression?: boolean;
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
  format: 'json' | 'pmtiles' | 'mbtiles';
  overwrite?: boolean;
  newRegionId?: string;
  newRegionName?: string;
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
  format: 'json' | 'pmtiles' | 'mbtiles';
  filename: string;
  blob: Blob;
  size: number;
  statistics: {
    tilesExported: number;
    spritesExported: number;
    fontsExported: number;
  };
}
