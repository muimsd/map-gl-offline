// idbFetchHandler.ts
// Intercepts idb:// URLs and serves resources from IndexedDB for MapLibre GL offline mode
import { dbPromise } from '../storage/indexedDbManager';

// idb://{downloadId}/tile/{sourceKey}/{url}
// idb://{downloadId}/glyph/{fontstack}/{range}.pbf
// idb://{downloadId}/sprite/{spriteName}
// idb://{downloadId}/tilesjson/{url}

// Create tile key including extension (same logic as TileService.createTileKey)
function createTileKey(
  x: number,
  y: number,
  z: number,
  styleId: string,
  sourceId: string,
  ext: string
): string {
  return `${styleId}:${sourceId}:${z}:${x}:${y}.${ext}`;
}

export async function idbFetchHandler(url: string, init?: RequestInit): Promise<Response> {
  console.log(`🔍 IDB Fetch Handler called for URL: ${url}`);
  const method = init?.method || 'GET';
  console.log(`📋 Method: ${method}`);

  // You can handle different HTTP methods here
  if (method === 'POST') {
    console.log(`📝 POST request to: ${url}`);
    if (init?.body) {
      console.log(`📝 POST body:`, init.body);
    }
  }

  const db = await dbPromise;
  const parsed = url.replace('idb://', '').split('/');
  const [downloadId, type, ...rest] = parsed;
  const resourcePath = rest.join('/');
  const key = `${downloadId}::${decodeURIComponent(resourcePath)}`;

  console.log(
    `📋 Parsed - downloadId: ${downloadId}, type: ${type}, resourcePath: ${resourcePath}, key: ${key}`
  );

  try {
    switch (type) {
      case 'tile': {
        // New format: idb://downloadId/tile/sourceKey/z/x/y.ext
        const pathParts = rest; // ['sourceKey', 'z', 'x', 'y.ext']
        if (pathParts.length === 4) {
          const sourceKey = pathParts[0];
          const z = parseInt(pathParts[1]);
          const x = parseInt(pathParts[2]);
          const yExt = pathParts[3]; // e.g. '6142.pbf'
          const yMatch = yExt.match(/(\d+)\.(\w+)/);
          if (yMatch) {
            const y = parseInt(yMatch[1]);
            const ext = yMatch[2];
            const tileKey = createTileKey(x, y, z, downloadId, sourceKey, ext);
            console.log(`🗺️ Looking for tile with key: ${tileKey}`);
            const resource = await db.get('tiles', tileKey);
            if (resource?.data) {
              console.log(`✅ Found tile: ${tileKey}`);
              return new Response(resource.data, { status: 200 });
            } else {
              console.warn(`❌ Tile not found: ${tileKey}`);
            }
          } else {
            console.warn(`❌ Could not parse y/ext from: ${yExt}`);
          }
        } else {
          // fallback: old logic for backward compatibility
          // Old: idb://downloadId/tile/encoded_tile_url
          const pathParts = rest; // ['encoded_tile_url']

          if (pathParts.length === 1) {
            // Old format without sourceKey - try to extract from the URL
            const encodedTileUrl = pathParts[0];
            const tileUrl = decodeURIComponent(encodedTileUrl);
            // Try to extract source from URL pattern
            // For example: https://domain.com/service/source/vt/{z}/{x}/{y}.pbf
            const urlParts = tileUrl.split('/');
            const fallbackSourceKey = urlParts[urlParts.length - 5] || 'unknown'; // Try to guess sourceKey
            console.warn(`⚠️ Using old URL format, guessed sourceKey: ${fallbackSourceKey}`);
            console.log(
              `🗺️ Looking for tile - sourceKey: ${fallbackSourceKey}, tileUrl: ${tileUrl}`
            );
            // Extract z/x/y coordinates from the tile URL
            const match = tileUrl.match(/\/(\d+)\/(\d+)\/(\d+)\.(\w+)(?:\?|$)/);
            if (match) {
              const [, z, x, y, ext] = match;
              const tileKey = createTileKey(
                parseInt(x),
                parseInt(y),
                parseInt(z),
                downloadId,
                fallbackSourceKey,
                ext
              );
              console.log(`🗺️ Looking for tile with key: ${tileKey}`);
              const resource = await db.get('tiles', tileKey);
              if (resource?.data) {
                console.log(`✅ Found tile: ${tileKey}`);
                return new Response(resource.data, { status: 200 });
              } else {
                console.warn(`❌ Tile not found: ${tileKey}`);
                // If not found with guessed sourceKey, try to find any tile with these coordinates
                console.log(`🔍 Searching for any tile with coordinates z:${z}, x:${x}, y:${y}`);
                const allTiles = await db.getAll('tiles');
                const matchingTile = allTiles.find((tile: any) => {
                  const keyParts = tile.key.split(':');
                  if (keyParts.length >= 5) {
                    const [, , tz, tx, ty] = keyParts;
                    return (
                      parseInt(tz) === parseInt(z) &&
                      parseInt(tx) === parseInt(x) &&
                      parseInt(ty) === parseInt(y)
                    );
                  }
                  return false;
                });
                if (matchingTile) {
                  console.log(`✅ Found tile by coordinates: ${matchingTile.key}`);
                  return new Response(matchingTile.data, { status: 200 });
                } else {
                  console.warn(`❌ No tile found with coordinates z:${z}, x:${x}, y:${y}`);
                }
              }
            } else {
              console.warn(`❌ Could not parse coordinates from tile URL: ${tileUrl}`);
            }
          }
        }
        break;
      }
      case 'glyph': {
        console.log(`🔤 Looking for glyph with key: ${key}`);
        const resource = await db.get('glyphs', key);
        if (resource?.data) {
          console.log(`✅ Found glyph: ${key}`);
          return new Response(resource.data, { status: 200 });
        } else {
          console.warn(`❌ Glyph not found: ${key}`);
        }
        break;
      }
      case 'sprite': {
        console.log(`🎨 Looking for sprite with key: ${key}`);
        const resource = await db.get('sprites', key);
        if (resource?.data) {
          console.log(`✅ Found sprite: ${key}`);
          return new Response(resource.data, {
            status: 200,
            headers: resource.contentType ? { 'Content-Type': resource.contentType } : undefined,
          });
        } else {
          console.warn(`❌ Sprite not found: ${key}`);
        }
        break;
      }
      case 'font': {
        console.log(`📝 Looking for font with key: ${key}`);
        const resource = await db.get('fonts', key);
        if (resource?.data) {
          console.log(`✅ Found font: ${key}`);
          return new Response(resource.data, { status: 200 });
        } else {
          console.warn(`❌ Font not found: ${key}`);
        }
        break;
      }
      case 'tilesjson': {
        console.log(`📄 Looking for style/tilesjson with downloadId: ${downloadId}`);
        const style = await db.get('styles', downloadId);
        if (style) {
          console.log(`✅ Found style: ${downloadId}`);
          return new Response(JSON.stringify(style), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          console.warn(`❌ Style not found: ${downloadId}`);
        }
        break;
      }
      default:
        console.warn(`❓ Unknown resource type: ${type}`);
        break;
    }
  } catch (error) {
    console.error(`💥 Error fetching resource from IDB: ${url}`, error);
  }

  console.warn(`🚫 Resource not found in IDB: ${url}`);
  return new Response('Not found in IDB', { status: 404 });
}

// Debug utility: List all tile keys for a given styleId/sourceId/zoom
export async function listTileKeysInIDB(styleId: string, sourceId: string, zoom: number) {
  const db = await dbPromise;
  const allTiles = await db.getAll('tiles');
  const matching = allTiles.filter(tile => {
    if (!tile.key) return false;
    const parts = tile.key.split(':');
    return parts[0] === styleId && parts[1] === sourceId && parseInt(parts[2]) === zoom;
  });
  console.log(`Tile keys for styleId='${styleId}', sourceId='${sourceId}', zoom=${zoom}:`);
  matching.forEach(tile => console.log(tile.key));
  return matching.map(tile => tile.key);
}

// Make available in browser console
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.listTileKeysInIDB = listTileKeysInIDB;
}

// Usage: fetch('idb://tiles/https%3A%2F%2Ftiles.example.com%2Fz%2Fx%2Fy.pbf')
//   .then(idbFetchHandler)
//   .then(response => ...)
