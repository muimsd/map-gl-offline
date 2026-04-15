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
 * An additional tile source to download alongside the style's own sources.
 * Allows saving extra vector (MVT/PBF) or raster layers for a region.
 */
export interface ExtraSource {
  /** Unique identifier for this source (used as sourceId in tile keys and style sources) */
  id: string;
  /**
   * Source type. Defaults to 'vector'.
   */
  type?: 'vector' | 'raster' | 'raster-dem';
  /**
   * Tile URL template(s) with {z}, {x}, {y} placeholders.
   * Example: 'https://example.com/tiles/{z}/{x}/{y}.pbf'
   */
  tiles: string[];
  /** Minimum zoom level for this source */
  minzoom?: number;
  /** Maximum zoom level for this source */
  maxzoom?: number;
  /** Attribution string for this source */
  attribution?: string;
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
  /**
   * Additional tile sources to download alongside the style's own sources.
   * These are injected into the style for offline rendering.
   */
  extraSources?: ExtraSource[];
}
