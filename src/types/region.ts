/**
 * Stored region with metadata
 * Extends OfflineRegionOptions with database-specific fields
 */
export interface StoredRegion extends OfflineRegionOptions {
  /** Database key for the region */
  key: string;
  /** Associated style ID */
  styleId: string;
  /** Creation timestamp (ms since epoch) */
  created: number;
  /** Expiry timestamp (ms since epoch) */
  expiry: number;
  /** Last modification timestamp (ms since epoch) */
  lastModified: number;
  /** Actual tile extension used (mvt, pbf, png, jpg, etc.) */
  tileExtension?: string;
}

/**
 * Configuration options for an offline region
 */
export interface OfflineRegionOptions {
  /**
   * Region ID (unique for each region, used as the key in the regions table)
   */
  id: string;
  /** Human-readable region name */
  name: string;
  /** Geographic bounds: [[west, south], [east, north]] */
  bounds: [[number, number], [number, number]];
  /** Whether this region is part of a multi-region download */
  multipleRegions?: boolean;
  /** URL to the map style JSON */
  styleUrl?: string;
  /** Minimum zoom level to download */
  minZoom: number;
  /** Maximum zoom level to download */
  maxZoom: number;
  /** Associated style ID */
  styleId?: string;
  /** Download session ID */
  downloadId?: string;
  /** Creation timestamp (ms since epoch) */
  created?: number;
  /** Last update timestamp (ms since epoch) */
  updated?: number;
  /**
   * Expiry timestamp (ms since epoch)
   */
  expiry?: number;
  /**
   * Whether to automatically delete this region when it expires (default: false)
   */
  deleteOnExpiry?: boolean;
  /** The actual tile extension used (mvt, pbf, png, jpg, etc.) */
  tileExtension?: string;
}
