import type { MapboxStyle } from '../types/style';

/**
 * Patches a MapboxStyle for offline use by replacing URLs with IndexedDB references
 */
export function patchStyleForOffline(style: MapboxStyle, downloadId: string): MapboxStyle {
  // Patch sources
  for (const sourceKey in style.sources) {
    const source = style.sources[sourceKey] as {
      tiles?: string[];
      url?: string;
    };
    if (source.tiles) {
      source.tiles = source.tiles.map(
        (url: string) => `idb://${downloadId}/tile/${encodeURIComponent(url)}`
      );
    }
    if (source.url) {
      source.url = `idb://${downloadId}/tilesjson/${encodeURIComponent(source.url)}`;
    }
  }
  
  // Patch glyphs
  if (style.glyphs) {
    style.glyphs = `idb://${downloadId}/glyph/{fontstack}/{range}.pbf`;
  }
  
  // Patch sprite
  if (style.sprite) {
    style.sprite = `idb://${downloadId}/sprite/sprite`;
  }
  
  return style;
}

/**
 * Validates if a region configuration is valid
 */
export function validateRegion(region: any): boolean {
  if (!region.id || !region.name) return false;
  if (!region.bounds || !Array.isArray(region.bounds)) return false;
  if (region.bounds.length !== 2) return false;
  if (!Array.isArray(region.bounds[0]) || !Array.isArray(region.bounds[1])) return false;
  if (region.bounds[0].length !== 2 || region.bounds[1].length !== 2) return false;
  if (typeof region.minZoom !== 'number' || typeof region.maxZoom !== 'number') return false;
  if (region.minZoom < 0 || region.maxZoom > 24 || region.minZoom > region.maxZoom) return false;
  
  return true;
}

/**
 * Calculates the bounding box area in square degrees
 */
export function calculateBBoxArea(bounds: [[number, number], [number, number]]): number {
  const [[west, south], [east, north]] = bounds;
  return Math.abs(east - west) * Math.abs(north - south);
}

/**
 * Estimates the number of tiles for a given region and zoom range
 */
export function estimateTileCount(
  bounds: [[number, number], [number, number]], 
  minZoom: number, 
  maxZoom: number
): number {
  const [[west, south], [east, north]] = bounds;
  let totalTiles = 0;
  
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const tilesPerRow = Math.pow(2, zoom);
    const tileSize = 360 / tilesPerRow;
    
    const minTileX = Math.floor((west + 180) / tileSize);
    const maxTileX = Math.floor((east + 180) / tileSize);
    const minTileY = Math.floor((90 - north) / tileSize);
    const maxTileY = Math.floor((90 - south) / tileSize);
    
    const tilesX = Math.abs(maxTileX - minTileX) + 1;
    const tilesY = Math.abs(maxTileY - minTileY) + 1;
    
    totalTiles += tilesX * tilesY;
  }
  
  return totalTiles;
}
