import type { StyleProvider } from './style';
import type { TileDownloadOptions, TileDownloadResult } from './tile';
import type { SpriteDownloadResult } from './sprite';
import type { GlyphDownloadResult } from './glyph';
import type { ModelDownloadResult } from './model';
import type { StyleDownloadResult } from './style';

/**
 * Phase of a region download pipeline, reported via `DownloadRegionOptions.onProgress`.
 */
export type DownloadRegionPhase = 'style' | 'sprites' | 'glyphs' | 'models' | 'tiles' | 'metadata';

/**
 * Progress update emitted by `OfflineMapManager.downloadRegion`.
 */
export interface DownloadRegionProgress {
  phase: DownloadRegionPhase;
  /** Items finished in this phase. */
  completed: number;
  /** Items in this phase, or 0 while that's still unknown. */
  total: number;
  /** How far through this phase, 0-100. It starts again in each phase. */
  percentage: number;
  /**
   * How far through the whole download, 0-100. Only moves forward and reaches 100
   * when the region is ready. Phases are weighted, so it's an estimate of the work
   * done rather than a count of files, and it jumps ahead over skipped phases.
   */
  overallPercentage: number;
  message?: string;
}

/**
 * Options for the programmatic `downloadRegion` pipeline.
 */
export interface DownloadRegionOptions {
  /** Called with per-phase progress during style → sprites → glyphs → models → tiles → metadata. */
  onProgress?: (progress: DownloadRegionProgress) => void;
  /** Style provider hint when the style needs to be fetched. Defaults to 'auto'. */
  provider?: StyleProvider;
  /**
   * Mapbox access token; required when the style or sources use mapbox:// URLs.
   * Accepts `null` to match Mapbox GL's `accessToken` type so callers can pass
   * `mapboxgl.accessToken` directly without a cast; treated the same as omitted.
   */
  accessToken?: string | null;
  /** Skip glyph download entirely. Default: false. */
  skipGlyphs?: boolean;
  /** Skip sprite download entirely. Default: false. */
  skipSprites?: boolean;
  /**
   * Skip 3D model download. Default: false. Models (e.g. Mapbox Standard
   * trees / wind turbines) are declared via `style.models` and live at
   * `mapbox://models/…` URLs that only Mapbox serves. Skip for styles that
   * don't use model layers, or to reduce storage footprint at the cost of
   * missing tree/turbine rendering.
   */
  skipModels?: boolean;
  /** Override Unicode glyph ranges fetched per font. Defaults to `GLYPH_CONFIG.COMPREHENSIVE_RANGES`. */
  glyphRanges?: string[];
  /** Extra options forwarded to the tile download step. */
  tileOptions?: TileDownloadOptions;
  /**
   * Config values for a style with a `schema`, such as Mapbox Standard:
   * `{ showLandmarkIcons: true, show3dFacades: true }`. They're saved as the
   * stored style's defaults, so they decide both what gets downloaded and what
   * renders offline. They apply to the whole style, not just this region, and
   * features a region enabled earlier keep their tiles. Floor selection isn't
   * available offline, so `showIndoor` adds little.
   */
  styleConfig?: Record<string, unknown>;
  /**
   * Cancels the download when aborted. `downloadRegion` then rejects, saves no
   * region, and removes the tiles it had stored that no other region needs.
   */
  signal?: AbortSignal;
}

/**
 * Result of a full `downloadRegion` pipeline.
 */
export interface DownloadRegionResult {
  regionId: string;
  styleId: string;
  styleResult?: StyleDownloadResult;
  spriteResults: SpriteDownloadResult[];
  glyphResult?: GlyphDownloadResult;
  modelResult?: ModelDownloadResult;
  /** Mapbox GL runtime assets in the offline cache. Undefined for non-Mapbox styles. */
  runtimeAssetsCached?: number;
  tileResult: TileDownloadResult;
}

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
 * Geographic bounding box as `[[west, south], [east, north]]`.
 *
 * Exposed as a public tuple alias so callers can annotate `bounds` literals
 * (or arrays of them) without TypeScript widening them to `number[][]`. Use
 * this in your own types for cities/regions lists, e.g.
 *
 * ```ts
 * const cities: Array<{ id: string; bounds: BoundingBox }> = [
 *   { id: 'nyc', bounds: [[-74.05, 40.68], [-73.90, 40.82]] },
 * ];
 * ```
 */
export type BoundingBox = [[number, number], [number, number]];

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
  bounds: BoundingBox;
  /**
   * @deprecated Has no effect. Regions already coexist, keyed by `id`.
   */
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
   * @deprecated Has no effect. Use `forceCleanupExpiredRegions` to delete expired regions.
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
