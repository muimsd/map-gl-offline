import { dbPromise } from '@/src/storage/indexedDbManager';
import { OfflineRegionOptions } from '@/src/types';
import tilebelt from '@mapbox/tilebelt';
import { fetchResource } from '../utils';

export async function downloadTiles(
  region: OfflineRegionOptions,
): Promise<void> {
  const db = await dbPromise;
  const { bounds, minZoom, maxZoom } = region;

  // Generate tile URLs based on the region bounds and zoom levels
  const tileUrls = generateTileUrls(bounds, minZoom, maxZoom);

  for (const url of tileUrls) {
    const tileData = await fetchResource(url);
    await db.put('tiles', { key: url, value: tileData } as any);
  }
}

export async function loadTiles(region: OfflineRegionOptions): Promise<void> {
  const db = await dbPromise;
  const { bounds, minZoom, maxZoom } = region;

  // Generate tile URLs based on the region bounds and zoom levels
  const tileUrls = generateTileUrls(bounds, minZoom, maxZoom);

  for (const url of tileUrls) {
    const tileData = await db.get('tiles', url);
    if (tileData) {
      // Logic to add tile data to the map
      console.log(`Loaded tile from ${url}`);
    }
  }
}
export async function deleteTiles(regionId: string): Promise<void> {
  const db = await dbPromise;
  // Logic to delete tiles from storage
  // Implement delete tiles
  console.log(`Deleted tiles for region ${regionId}`);
}

function generateTileUrls(
  bounds: [[number, number], [number, number]],
  minZoom: number,
  maxZoom: number,
): string[] {
  const urls: string[] = [];
  const [sw, ne] = bounds;

  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const swTile = tilebelt.pointToTile(sw[0], sw[1], zoom);
    const neTile = tilebelt.pointToTile(ne[0], ne[1], zoom);

    for (let x = swTile[0]; x <= neTile[0]; x++) {
      for (let y = swTile[1]; y <= neTile[1]; y++) {
        const tileUrl = `https://example.com/tiles/${zoom}/${x}/${y}.png`; // Replace with actual tile URL template
        urls.push(tileUrl);
      }
    }
  }

  return urls;
}
