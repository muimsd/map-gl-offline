import { dbPromise } from '../storage/indexedDbManager';
import { OfflineRegionOptions } from '../types';
import * as tilebelt from '@mapbox/tilebelt';
import { fetchResource } from '../utils';

export async function downloadTiles(
  region: OfflineRegionOptions,
  style: any,
  styleId: string,
): Promise<void> {
  const db = await dbPromise;
  const { bounds, minZoom, maxZoom } = region;
  for (const sourceKey of Object.keys(style.sources)) {
    const source = style.sources[sourceKey];
    if (source.url) {
      const tilesArr = Array.isArray(source.url.tiles) ? source.url.tiles : [source.url.tiles];
      for (const tilesURL of tilesArr) {
        const tileUrls = generateTileUrls(tilesURL, bounds, minZoom, maxZoom);
        const downloadPromises = [];

        for (const url of tileUrls) {
          const downloadPromise = (async () => {
            const tileResource = await fetchResource(url);
            const key = `${styleId}::${url}`; // Save tile with style ID as part of the key
            await db.put('tiles', { key, data: tileResource.data } as any);
          })();
          downloadPromises.push(downloadPromise);

          // Limit to 100 parallel downloads
          if (downloadPromises.length >= 100) {
            await Promise.all(downloadPromises);
            downloadPromises.length = 0; // Clear the array
          }
        }

        // Wait for any remaining downloads
        if (downloadPromises.length > 0) {
          await Promise.all(downloadPromises);
        }
      }
    } else {
      console.warn(`No tiles URL found for source ${sourceKey}`);
    }
  }
}

export async function loadTiles(
  region: OfflineRegionOptions,
  styleId?: string,
): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('tiles');
  let keysToLoad = allKeys;
  if (styleId) {
    keysToLoad = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(styleId + '::'),
    );
  }
  for (const key of keysToLoad) {
    const tileData = await db.get('tiles', key);
    if (tileData) {
      // Logic to add tile data to the map or return it
      console.log(`Loaded tile: ${key}`);
    }
  }
}
export async function deleteTiles(downloadId: string): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('tiles');
  const keysToDelete = allKeys.filter(k => typeof k === 'string' && k.startsWith(downloadId + '::'));
  for (const key of keysToDelete) {
    await db.delete('tiles', key);
    console.log(`Deleted tile: ${key}`);
  }
}

function generateTileUrls(
  urlTemplate: string,
  bounds: [[number, number], [number, number]],
  minZoom: number,
  maxZoom: number,
): string[] {
  const urls: string[] = [];
  const [sw, ne] = bounds;

  for (let z = minZoom; z <= maxZoom; z++) {
    const swTile = tilebelt.pointToTile(sw[0], sw[1], z);
    const neTile = tilebelt.pointToTile(ne[0], ne[1], z);

    for (let x = swTile[0]; x <= neTile[0]; x++) {
      for (let y = swTile[1]; y <= neTile[1]; y++) {
        const tileUrl = urlTemplate
          .replace('{z}', z.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());
        urls.push(tileUrl);
      }
    }
  }

  return urls;
}
