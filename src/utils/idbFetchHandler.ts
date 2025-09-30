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

function deriveTileExtension(tiles?: unknown): string {
  if (Array.isArray(tiles) && tiles.length > 0) {
    const firstTile = tiles[0];
    if (typeof firstTile === 'string') {
      const match = firstTile.match(/\.([\w]+)(?:\?|$)/i);
      if (match) {
        return match[1];
      }
    }
  }
  return 'pbf';
}

function buildOfflineTileJson(
  sourceConfig: Record<string, unknown>,
  downloadId: string,
  sourceId: string
): Record<string, unknown> {
  const extension = deriveTileExtension(sourceConfig.tiles);
  const offlineTiles = [`idb://${downloadId}/tile/${sourceId}/{z}/{x}/{y}.${extension}`];

  const tileJson: Record<string, unknown> = {
    tilejson: typeof sourceConfig.tilejson === 'string' ? sourceConfig.tilejson : '2.2.0',
    name: (sourceConfig.name as string) ?? sourceId,
    tiles: offlineTiles,
    minzoom: typeof sourceConfig.minzoom === 'number' ? sourceConfig.minzoom : 0,
    maxzoom: typeof sourceConfig.maxzoom === 'number' ? sourceConfig.maxzoom : 22,
  };

  const fieldsToCopy = [
    'bounds',
    'center',
    'vector_layers',
    'scheme',
    'attribution',
    'encoding',
    'format',
    'grids',
    'data',
    'template',
    'version',
  ] as const;

  for (const field of fieldsToCopy) {
    if (field in sourceConfig && sourceConfig[field] !== undefined) {
      tileJson[field] = sourceConfig[field];
    }
  }

  return tileJson;
}

function createTileResponse(resource: {
  data: ArrayBuffer;
  contentType?: string;
  contentEncoding?: string;
  type?: string;
}): Response {
  const headers: HeadersInit = {};

  if (resource.contentType) {
    headers['Content-Type'] = resource.contentType;
  } else if (resource.type === 'vector') {
    headers['Content-Type'] = 'application/x-protobuf';
  }

  if (resource.contentEncoding) {
    headers['Content-Encoding'] = resource.contentEncoding;
  }

  return new Response(resource.data, {
    status: 200,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
}

export async function idbFetchHandler(url: string, init?: RequestInit): Promise<Response> {
  console.warn(`🔍 IDB Fetch Handler called for URL: ${url}`);
  const method = init?.method || 'GET';
  console.warn(`📋 Method: ${method}`);

  // You can handle different HTTP methods here
  if (method === 'POST') {
    console.warn(`📝 POST request to: ${url}`);
    if (init?.body) {
      console.warn(`📝 POST body:`, init.body);
    }
  }

  const db = await dbPromise;
  const parsed = url.replace('idb://', '').split('/');
  const [downloadId, type, ...rest] = parsed;
  const resourcePath = rest.join('/');
  const decodedResourcePath = decodeURIComponent(resourcePath);
  const key = `${downloadId}::${decodedResourcePath}`;

  console.warn(
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
            console.warn(`🗺️ Looking for tile with key: ${tileKey}`);
            const resource = await db.get('tiles', tileKey);
            if (resource?.data) {
              console.warn(`✅ Found tile: ${tileKey}`);
              return createTileResponse(resource);
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
            console.warn(
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
              console.warn(`🗺️ Looking for tile with key: ${tileKey}`);
              const resource = await db.get('tiles', tileKey);
              if (resource?.data) {
                console.warn(`✅ Found tile: ${tileKey}`);
                return createTileResponse(resource);
              } else {
                console.warn(`❌ Tile not found: ${tileKey}`);
                // If not found with guessed sourceKey, try to find any tile with these coordinates
                console.warn(`🔍 Searching for any tile with coordinates z:${z}, x:${x}, y:${y}`);
                const allTiles = await db.getAll('tiles');
                const matchingTile = allTiles.find((tile) => {
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
                  console.warn(`✅ Found tile by coordinates: ${matchingTile.key}`);
                  return createTileResponse(matchingTile);
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
          console.warn(`🔤 Looking for glyph with key: ${key}`);
          const normalizedPath = decodedResourcePath.endsWith('.pbf')
            ? decodedResourcePath
            : `${decodedResourcePath}.pbf`;

          const glyphCandidateKeys = Array.from(
            new Set([
              key,
              `${downloadId}::${normalizedPath}`,
              `${downloadId}:${normalizedPath}`,
              `${downloadId}:${normalizedPath.replace(/\//g, '_')}`,
              `${downloadId}:${normalizedPath.replace(/\//g, '_').replace(/\.pbf$/i, '')}`,
              `${downloadId}::${decodedResourcePath}`,
              normalizedPath,
              decodedResourcePath,
              normalizedPath.replace(/\//g, '_'),
              decodedResourcePath.replace(/\//g, '_'),
              normalizedPath.replace(/\//g, '_').replace(/\.pbf$/i, ''),
              decodedResourcePath.replace(/\//g, '_').replace(/\.pbf$/i, ''),
            ])
          );

          for (const candidateKey of glyphCandidateKeys) {
            const resource = await db.get('glyphs', candidateKey);
            if (resource?.data) {
              console.warn(`✅ Found glyph using key: ${candidateKey}`);
              return new Response(resource.data, { status: 200 });
            }
          }

          console.warn(`❌ Glyph not found, tried keys: ${glyphCandidateKeys.join(', ')}`);
        break;
      }
      case 'sprite': {
          console.warn(`🎨 Looking for sprite with key: ${key}`);
          const spriteCandidateKeys = Array.from(
            new Set([
              key,
              `${downloadId}:${decodedResourcePath}`,
              `${downloadId}::${decodedResourcePath}`,
              `${downloadId}:${decodedResourcePath.replace(/\//g, ':')}`,
              `${downloadId}::${decodedResourcePath.replace(/\//g, ':')}`,
              `${downloadId}:${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              `${downloadId}::${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              decodedResourcePath,
              decodedResourcePath.replace(/\//g, ':'),
              decodedResourcePath.replace(/\.(json|png)$/i, ''),
            ])
          );

          for (const candidateKey of spriteCandidateKeys) {
            const resource = await db.get('sprites', candidateKey);
            if (resource?.data) {
              console.warn(`✅ Found sprite using key: ${candidateKey}`);
              return new Response(resource.data, {
                status: 200,
                headers: resource.contentType ? { 'Content-Type': resource.contentType } : undefined,
              });
            }
          }

          console.warn(`❌ Sprite not found, tried keys: ${spriteCandidateKeys.join(', ')}`);
        break;
      }
      case 'font': {
        console.warn(`📝 Looking for font with key: ${key}`);
        const resource = await db.get('fonts', key);
        if (resource?.data) {
          console.warn(`✅ Found font: ${key}`);
          return new Response(resource.data, { status: 200 });
        } else {
          console.warn(`❌ Font not found: ${key}`);
        }
        break;
      }
      case 'tilesjson': {
        console.warn(`📄 Looking for tilejson with downloadId: ${downloadId}, resourcePath: ${decodedResourcePath}`);
        const styleEntry = await db.get('styles', downloadId);
        if (styleEntry?.style?.sources) {
          const sources = styleEntry.style.sources as Record<string, Record<string, unknown>>;
          let matchedSourceId: string | undefined;
          let matchedSourceConfig: Record<string, unknown> | undefined;

          if (decodedResourcePath in sources) {
            matchedSourceId = decodedResourcePath;
            matchedSourceConfig = sources[decodedResourcePath];
          } else {
            for (const [sourceId, sourceValue] of Object.entries(sources)) {
              const sourceUrl = typeof sourceValue.url === 'string' ? sourceValue.url : undefined;
              const originalUrl = typeof sourceValue.__originalTilesetUrl === 'string'
                ? sourceValue.__originalTilesetUrl
                : undefined;
              if (sourceUrl === decodedResourcePath || originalUrl === decodedResourcePath) {
                matchedSourceId = sourceId;
                matchedSourceConfig = sourceValue;
                break;
              }
            }
          }

          if (matchedSourceId && matchedSourceConfig) {
            const tileJson = buildOfflineTileJson(matchedSourceConfig, downloadId, matchedSourceId);
            console.warn(`✅ Serving offline tilejson for source: ${matchedSourceId}`);
            return new Response(JSON.stringify(tileJson), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          console.warn(`❌ No matching source found for tilejson: ${decodedResourcePath}`);
        } else {
          console.warn(`❌ Style not found or missing sources for downloadId: ${downloadId}`);
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
  console.warn(`Tile keys for styleId='${styleId}', sourceId='${sourceId}', zoom=${zoom}:`);
  matching.forEach(tile => console.warn(tile.key));
  return matching.map(tile => tile.key);
}

// Make available in browser console
if (typeof window !== 'undefined') {
  // @ts-expect-error - Adding to global window for debugging
  window.listTileKeysInIDB = listTileKeysInIDB;
}

// Usage: fetch('idb://tiles/https%3A%2F%2Ftiles.example.com%2Fz%2Fx%2Fy.pbf')
//   .then(idbFetchHandler)
//   .then(response => ...)
