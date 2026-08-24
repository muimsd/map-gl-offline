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
  x: number;
  /** Tile Y coordinate */
  y: number;
  /** Tile zoom level */
  z: number;
  /** Associated style ID */
  styleId: string;
  /** Associated source ID */
  sourceId: string;
  /** Expiry timestamp (ms since epoch) based on HTTP Cache-Control/Expires headers */
  expires?: number;
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
  /**
   * @deprecated Not read by the tile downloader — `batchSize` is the effective
   * concurrency knob (each batch is issued in parallel via `Promise.allSettled`).
   * Kept so existing callers still type-check; setting it has no effect.
   */
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
  /**
   * Before committing to download a source's full tile plan, probe three
   * representative tiles from that plan (start, middle, end). If the
   * majority return 404, the source is treated as sparse-for-this-region
   * and skipped entirely. This adapts to the region (some cities have
   * indoor/landmark/3D-building data, others don't) without requiring a
   * static skip list.
   *
   * Up to three probe HTTP requests are added per source (fewer when the
   * plan is small enough that start/middle/end collapse to the same
   * coordinate). The probes themselves may 404 (visible in the Network
   * tab), but downstream we then avoid dozens of follow-up 404s.
   *
   * Default: `true`. Set `false` to download every source regardless
   * (old behavior — noisier, but guaranteed-complete).
   */
  probeSourcesBeforeDownload?: boolean;
  /**
   * Pre-skip a small allowlist of Mapbox Standard sub-tilesets that are
   * sparse-by-design across the whole planet — `mapbox.indoor-v3`,
   * `mapbox.mapbox-landmark-pois-v1`, `mapbox.procedural-buildings-v1`. These
   * have tiles only where indoor venues / landmark POIs / 3D buildings
   * actually exist; for typical regions they return 404 for nearly every
   * coordinate. Pre-skipping means we never issue probe or download
   * requests for them, eliminating the 404 noise in devtools.
   *
   * Default: `true`. Set `false` to attempt these sources anyway — the
   * downstream `probeSourcesBeforeDownload` pass will still skip them
   * for most regions, but you'll see the probe 404s in the network log.
   */
  skipKnownSparseSources?: boolean;
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
