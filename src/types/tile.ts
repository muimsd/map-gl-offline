import type { DownloadProgress } from './progress';

/**
 * Tile entry stored in IndexedDB
 * Represents a single map tile with all its metadata
 */
export interface TileEntry {
  /** Unique key: styleId:sourceId:z:x:y.ext (includes extension) */
  key: string;
  /** Tile data as ArrayBuffer */
  data: ArrayBuffer;
  /** Download timestamp (ISO string) */
  downloadedAt: string;
  /** Size in bytes */
  size: number;
  /** Tile type: 'raster' or 'vector' */
  type: string;
  /** File format: 'pbf', 'mvt', 'png', 'jpg', 'webp', etc. */
  format?: string;
  /** Original download URL */
  url: string;
  /** Last modification timestamp (ms since epoch) */
  lastModified: number;
  /** HTTP Content-Type header */
  contentType?: string;
  /** HTTP Content-Encoding header */
  contentEncoding?: string;
  /** Tile X coordinate */
  x?: number;
  /** Tile Y coordinate */
  y?: number;
  /** Tile zoom level */
  z?: number;
  /** Associated style ID */
  styleId?: string;
  /** Associated source ID */
  sourceId?: string;
}

/**
 * Options for tile download operations
 */
export interface TileDownloadOptions {
  /** Progress callback function */
  onProgress?: (progress: DownloadProgress) => void;
  /** Number of tiles to download concurrently (default: 10) */
  batchSize?: number;
  /** Maximum retry attempts for failed downloads (default: 3) */
  maxRetries?: number;
  /** Skip already downloaded tiles (default: true) */
  skipExisting?: boolean;
  /** Maximum concurrent download connections (default: 5) */
  maxConcurrency?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Validate tile data after download (default: false) */
  validateTiles?: boolean;
  /** Compress tiles before storage (default: false) */
  compressTiles?: boolean;
  /** Priority zoom levels to download first */
  priorityZoomLevels?: number[];
  /** Bandwidth limit in KB/s */
  bandwidthLimit?: number;
  /** Check storage quota before download (default: true) */
  storageQuotaCheck?: boolean;
}

/**
 * Result of a tile download operation
 */
export interface TileDownloadResult {
  /** Total tiles in download plan */
  totalTiles: number;
  /** Successfully downloaded tiles */
  downloadedTiles: number;
  /** Tiles skipped (already exist) */
  skippedTiles: number;
  /** Failed tile downloads */
  failedTiles: number;
  /** Total download size in bytes */
  totalSize: number;
  /** Download duration in ms */
  downloadTime: number;
  /** Average download speed in KB/s */
  averageSpeed: number;
  /** Array of error details */
  errors: Array<{ url: string; error: string }>;
  /** Actual tile extension used (mvt, pbf, png, jpg, etc.) */
  tileExtension?: string;
}

/**
 * Statistics for stored tiles
 */
export interface TileStats {
  /** Total number of tiles */
  count: number;
  /** Total storage size in bytes */
  totalSize: number;
  /** Average tile size in bytes */
  averageSize: number;
  /** Oldest tile timestamp */
  oldestTile?: Date;
  /** Newest tile timestamp */
  newestTile?: Date;
  /** Statistics per zoom level */
  zoomLevelStats: Map<number, { count: number; size: number }>;
}
