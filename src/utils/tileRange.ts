import * as tilebelt from '@mapbox/tilebelt';

export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * XYZ tile range covering `bounds` at zoom `z`. Shared by the download
 * pipeline (which fetches exactly this range) and region-scoped consumers
 * like MBTiles export, so both agree on which tiles belong to a region.
 */
export function getTileRangeAtZoom(
  bounds: [[number, number], [number, number]],
  z: number
): TileRange {
  const minTile = pointToTileClamped(bounds[0][0], bounds[0][1], z);
  const maxTile = pointToTileClamped(bounds[1][0], bounds[1][1], z);
  return {
    minX: Math.min(minTile[0], maxTile[0]),
    maxX: Math.max(minTile[0], maxTile[0]),
    minY: Math.min(minTile[1], maxTile[1]),
    maxY: Math.max(minTile[1], maxTile[1]),
  };
}

/** Web Mercator's latitude limit; tiles don't exist beyond it. */
const MAX_MERCATOR_LAT = 85.0511287798066;

/**
 * `tilebelt.pointToTile`, kept on the tile grid. tilebelt wraps longitude 180
 * to x = 0, so a region whose east edge is the antimeridian became the range
 * 0..maxX — nearly the whole world at every zoom. Latitudes beyond the
 * Mercator limit likewise fall off the grid.
 */
function pointToTileClamped(lon: number, lat: number, z: number): [number, number] {
  const maxIndex = 2 ** z - 1;
  const clampedLon = Math.max(-180, Math.min(180, lon));
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const [x, y] = tilebelt.pointToTile(clampedLon, clampedLat, z);
  return [
    clampedLon === 180 ? maxIndex : Math.max(0, Math.min(maxIndex, x)),
    Math.max(0, Math.min(maxIndex, y)),
  ];
}

/**
 * Whether tile `z/x/y` falls inside `bounds` and `[minZoom, maxZoom]`.
 */
export function isTileInRegion(
  z: number,
  x: number,
  y: number,
  region: { bounds: [[number, number], [number, number]]; minZoom: number; maxZoom: number }
): boolean {
  if (z < region.minZoom || z > region.maxZoom) return false;
  const { minX, maxX, minY, maxY } = getTileRangeAtZoom(region.bounds, z);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Zoom levels to download for one source in `region`: the overlap of the
 * region's and the source's zoom ranges. When they don't overlap, the source
 * still gets the zooms the map needs from it:
 * - source ends below the region (`maxzoom` < region min) → its `maxzoom`,
 *   which the renderer overzooms for the region's zooms;
 * - source starts above the region (`minzoom` > region max) → `minzoom`
 *   through `maxzoom` (or just `minzoom` if unbounded).
 */
export function sourceZoomRange(
  region: { minZoom: number; maxZoom: number },
  sourceMinZoom?: number,
  sourceMaxZoom?: number
): { min: number; max: number } {
  const srcMin = sourceMinZoom !== undefined ? Math.ceil(sourceMinZoom) : undefined;
  const srcMax = sourceMaxZoom !== undefined ? Math.floor(sourceMaxZoom) : undefined;

  if (srcMax !== undefined && srcMax < region.minZoom) {
    return { min: srcMax, max: srcMax };
  }
  if (srcMin !== undefined && srcMin > region.maxZoom) {
    return { min: srcMin, max: srcMax ?? srcMin };
  }
  return {
    min: Math.max(region.minZoom, srcMin ?? region.minZoom),
    max: Math.min(region.maxZoom, srcMax ?? region.maxZoom),
  };
}

/** Zoom fields of a stored style source (possibly patched by patchStyleForOffline). */
export interface SourceZoomConfig {
  minzoom?: number;
  maxzoom?: number;
  __originalMaxzoom?: number | null;
}

/**
 * A stored source's upstream `maxzoom`. Patched styles cap `maxzoom` for
 * rendering and stash the upstream value under `__originalMaxzoom`.
 */
export function upstreamMaxzoom(source: SourceZoomConfig | undefined): number | undefined {
  if (source?.__originalMaxzoom !== undefined) return source.__originalMaxzoom ?? undefined;
  return source?.maxzoom;
}

function hasValidBounds(region: { bounds?: unknown }): boolean {
  const b = region.bounds;
  return (
    Array.isArray(b) &&
    b.length === 2 &&
    b.every(corner => Array.isArray(corner) && corner.length === 2)
  );
}

/**
 * Whether a stored tile was downloaded for `region`: inside its bounds, at a
 * zoom the download pipeline fetches for the tile's source (which can fall
 * outside the region's own range — see `sourceZoomRange`). `sources` is the
 * stored style's `sources`. Regions with malformed bounds match nothing.
 */
export function tileBelongsToRegion(
  tile: { sourceId?: string; z: number; x: number; y: number },
  region: { bounds: [[number, number], [number, number]]; minZoom: number; maxZoom: number },
  sources: Record<string, SourceZoomConfig | undefined>
): boolean {
  if (!hasValidBounds(region)) return false;
  const source = tile.sourceId !== undefined ? sources[tile.sourceId] : undefined;
  const { min, max } = sourceZoomRange(region, source?.minzoom, upstreamMaxzoom(source));
  return isTileInRegion(tile.z, tile.x, tile.y, {
    bounds: region.bounds,
    minZoom: min,
    maxZoom: max,
  });
}
