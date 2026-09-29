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
  const minTile = tilebelt.pointToTile(bounds[0][0], bounds[0][1], z);
  const maxTile = tilebelt.pointToTile(bounds[1][0], bounds[1][1], z);
  return {
    minX: Math.min(minTile[0], maxTile[0]),
    maxX: Math.max(minTile[0], maxTile[0]),
    minY: Math.min(minTile[1], maxTile[1]),
    maxY: Math.max(minTile[1], maxTile[1]),
  };
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
