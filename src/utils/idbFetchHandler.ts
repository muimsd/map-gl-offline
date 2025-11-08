// idbFetchHandler.ts
// Intercepts idb:// URLs and serves resources from IndexedDB for MapLibre GL offline mode
import { dbPromise } from '../storage/indexedDbManager';
import type { IDBPDatabase } from 'idb';
import type { OfflineMapDB } from '../types/database';
import type { StyleStorageItem } from '../types/style';

// idb://{downloadId}/tile/{sourceKey}/{url}
// idb://{downloadId}/glyph/{fontstack}/{range}.pbf
// idb://{downloadId}/sprite/{spriteName}
// idb://{downloadId}/tilesjson/{url}

/**
 * Find a style entry that contains the given region ID
 * Since styles are stored by style key but patched with region IDs,
 * we need to search all styles to find which one contains this region
 */
async function findStyleByRegionId(
  db: IDBPDatabase<OfflineMapDB>,
  regionId: string
): Promise<StyleStorageItem | null> {
  try {
    const allStyles = await db.getAll('styles');
    for (const styleEntry of allStyles) {
      if (styleEntry.regions && Array.isArray(styleEntry.regions)) {
        const hasRegion = styleEntry.regions.some(
          (r: { regionId?: string; id?: string }) => r.regionId === regionId || r.id === regionId
        );
        if (hasRegion) {
          console.warn(`✅ Found style "${styleEntry.key}" containing region: ${regionId}`);
          return styleEntry;
        }
      }
    }
    console.warn(`⚠️ No style found containing region: ${regionId}`);
    return null;
  } catch (error) {
    console.error(`💥 Error searching for style by region ID: ${regionId}`, error);
    return null;
  }
}

// Create tile key including extension (same logic as TileService.createTileKey)
function createTileKey(
  x: number,
  y: number,
  z: number,
  styleId: string,
  sourceId: string,
  ext: string // Extension included in key
): string {
  // Store keys WITH extension for consistent lookup
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

async function createTileResponse(resource: {
  data: ArrayBuffer;
  contentType?: string;
  contentEncoding?: string;
  type?: string;
}): Promise<Response> {
  const headers: HeadersInit = {};

  // Set proper content type for vector tiles (PBF/MVT format)
  if (resource.contentType) {
    headers['Content-Type'] = resource.contentType;
  } else if (resource.type === 'vector') {
    // Use application/vnd.mapbox-vector-tile for better MapLibre compatibility
    headers['Content-Type'] = 'application/vnd.mapbox-vector-tile';
  }

  let finalData = resource.data;
  
  // Check if data is actually gzipped (even if not marked as such)
  const view = new Uint8Array(resource.data);
  const isGzipped = view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;
  
  console.warn(`🔍 Tile check: type=${resource.type}, size=${view.length}, first2bytes=[0x${view[0]?.toString(16)}, 0x${view[1]?.toString(16)}], isGzipped=${isGzipped}`);
  
  if (isGzipped && resource.type === 'vector') {
    console.warn(`⚠️ Found gzipped vector tile! Decompressing on-the-fly...`);
    console.warn(`   For better performance, delete this region and re-download.`);
    
    try {
      // Decompress using DecompressionStream
      const decompressedStream = new Response(resource.data).body?.pipeThrough(
        new DecompressionStream('gzip')
      );
      if (decompressedStream) {
        finalData = await new Response(decompressedStream).arrayBuffer();
        console.warn(`✅ Decompressed tile: ${resource.data.byteLength} -> ${finalData.byteLength} bytes`);
      }
    } catch (error) {
      console.error(`❌ Failed to decompress tile:`, error);
      console.error(`   DELETE the region and re-download to fix this permanently.`);
    }
  } else if (isGzipped) {
    console.warn(`⚠️ Found gzipped data but type is '${resource.type}', not decompressing`);
  }

  // Only set Content-Encoding if we have compressed data stored
  // If contentEncoding is undefined/null, we decompressed during download
  if (resource.contentEncoding && resource.contentEncoding !== 'gzip') {
    headers['Content-Encoding'] = resource.contentEncoding;
  }

  // Add CORS headers to allow MapLibre to use the tiles
  headers['Access-Control-Allow-Origin'] = '*';
  headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  headers['Cache-Control'] = 'public, max-age=31536000';

  return new Response(finalData, {
    status: 200,
    statusText: 'OK',
    headers: new Headers(headers),
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
        // Find which style this region belongs to (for region-based downloads)
        const styleEntry = await findStyleByRegionId(db, downloadId);
        const actualStyleId = styleEntry?.key || downloadId;
        
        if (styleEntry && downloadId !== actualStyleId) {
          console.warn(`🔄 Region "${downloadId}" belongs to style "${actualStyleId}", using style ID for tile lookup`);
        }
        
        // New format: idb://downloadId/tile/sourceKey/z/x/y.ext
        const pathParts = rest; // ['sourceKey', 'z', 'x', 'y.ext']
        console.warn(`🗺️ Tile request - pathParts:`, pathParts);
        
        if (pathParts.length === 4) {
          const sourceKey = pathParts[0];
          const z = parseInt(pathParts[1]);
          const x = parseInt(pathParts[2]);
          const yExt = pathParts[3]; // e.g. '6142.pbf'
          const yMatch = yExt.match(/(\d+)\.(\w+)/);
          if (yMatch) {
            const y = parseInt(yMatch[1]);
            const requestedExt = yMatch[2]; // Extension from URL (for logging only)
            
            // Create key WITHOUT extension (new format)
            const tileKey = createTileKey(x, y, z, actualStyleId, sourceKey, requestedExt);
            console.warn(`🗺️ Looking for tile with key: ${tileKey} (z:${z}, x:${x}, y:${y}, source:${sourceKey})`);
            
            // Debug: Check what tiles exist for this style
            const allTiles = await db.getAllKeys('tiles');
            const matchingStyleTiles = allTiles.filter(k => typeof k === 'string' && k.startsWith(`${actualStyleId}:`));
            console.warn(`📊 Total tiles in DB: ${allTiles.length}, tiles for style "${actualStyleId}": ${matchingStyleTiles.length}`);
            if (matchingStyleTiles.length > 0 && matchingStyleTiles.length <= 10) {
              console.warn(`📋 Sample tiles:`, matchingStyleTiles.slice(0, 10));
            }
            
            const resource = await db.get('tiles', tileKey);
            
            if (resource?.data) {
              console.warn(`✅ Found tile: ${tileKey}, format: ${resource.format || 'unknown'}`);
              const response = await createTileResponse(resource);
              console.warn(`📦 Serving tile: ${tileKey}, size: ${resource.data.byteLength} bytes, type: ${response.headers.get('Content-Type')}`);
              return response;
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
              // Use actualStyleId instead of downloadId
              const tileKey = createTileKey(
                parseInt(x),
                parseInt(y),
                parseInt(z),
                actualStyleId,
                fallbackSourceKey,
                ext
              );
              console.warn(`🗺️ Looking for tile with key: ${tileKey}`);
              const resource = await db.get('tiles', tileKey);
              if (resource?.data) {
                console.warn(`✅ Found tile: ${tileKey}`);
                return await createTileResponse(resource);
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
                  return await createTileResponse(matchingTile);
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
          
          // Find which style this region belongs to
          const styleEntry = await findStyleByRegionId(db, downloadId);
          const actualStyleId = styleEntry?.key || downloadId;
          
          if (styleEntry && downloadId !== actualStyleId) {
            console.warn(`🔄 Region "${downloadId}" belongs to style "${actualStyleId}", searching with style key`);
          }
          
          // Parse the resource path: "FontA,FontB,FontC/0-255.pbf"
          // MapLibre requests glyphs with comma-separated fallback fonts
          // but glyphs are stored individually per font
          const pathParts = decodedResourcePath.split('/');
          const fontstackPart = pathParts[0]; // "FontA,FontB,FontC"
          const rangePart = pathParts[1] || '0-255.pbf'; // "0-255.pbf"
          
          // Split comma-separated fonts
          const fontstacks = fontstackPart.split(',').map(f => f.trim());
          console.warn(`🔤 Trying ${fontstacks.length} fonts in fallback order: ${fontstacks.join(', ')}`);
          
          // Debug: List some actual glyph keys from the database
          const allGlyphKeys = await db.getAllKeys('glyphs');
          console.warn(`📊 Total glyphs in DB: ${allGlyphKeys.length}`);
          if (allGlyphKeys.length > 0 && allGlyphKeys.length <= 20) {
            console.warn(`📋 All glyph keys:`, allGlyphKeys);
          } else if (allGlyphKeys.length > 0) {
            console.warn(`📋 Sample glyph keys (first 10):`, allGlyphKeys.slice(0, 10));
          }
          
          // Try each font in order (this is how font fallbacks work)
          for (const fontstack of fontstacks) {
            const glyphPath = `${fontstack}/${rangePart}`;
            const normalizedPath = glyphPath.endsWith('.pbf') ? glyphPath : `${glyphPath}.pbf`;
            
            const glyphCandidateKeys = [
              // Try with actual style ID first
              `${actualStyleId}::${normalizedPath}`,
              `${actualStyleId}::${glyphPath}`,
              // Then try with download ID
              `${downloadId}::${normalizedPath}`,
              `${downloadId}::${glyphPath}`,
              // Just paths
              normalizedPath,
              glyphPath,
            ];

            console.warn(`🔍 Trying keys for font "${fontstack}":`, glyphCandidateKeys);

            for (const candidateKey of glyphCandidateKeys) {
              const resource = await db.get('glyphs', candidateKey);
              if (resource?.data) {
                console.warn(`✅ Found glyph using key: ${candidateKey} (font: ${fontstack})`);
                return new Response(resource.data, { 
                  status: 200,
                  headers: {
                    'Content-Type': 'application/x-protobuf',
                  },
                });
              }
            }
          }

          console.warn(`❌ Glyph not found for any font in: ${fontstacks.join(', ')}`);
        break;
      }
      case 'sprite': {
          console.warn(`🎨 Looking for sprite with key: ${key}`);
          
          // Find which style this region belongs to
          const styleEntry = await findStyleByRegionId(db, downloadId);
          const actualStyleId = styleEntry?.key || downloadId;
          
          if (styleEntry && downloadId !== actualStyleId) {
            console.warn(`🔄 Region "${downloadId}" belongs to style "${actualStyleId}", searching with style key`);
          }
          
          // The sprite service stores sprites with keys like: "voyager::sprite.json", "voyager::sprite@2x.json"
          // MapLibre requests sprites as: "idb://region_XXX/sprite/sprite@2x.json"
          // So we need to map the region ID to the style ID
          
          const spriteCandidateKeys = Array.from(
            new Set([
              // Try with actual style ID first (most likely to work)
              `${actualStyleId}::${decodedResourcePath}`,
              `${actualStyleId}:${decodedResourcePath}`,
              `${actualStyleId}::${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              `${actualStyleId}:${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              
              // Then try with download ID (in case it's a direct style download)
              `${downloadId}::${decodedResourcePath}`,
              `${downloadId}:${decodedResourcePath}`,
              `${downloadId}::${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              `${downloadId}:${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
              
              // Just the path itself
              decodedResourcePath,
              
              // Original key format
              key,
            ])
          );

          console.warn(`🎨 Sprite candidates for "${decodedResourcePath}":`, spriteCandidateKeys);

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
        
        // First try direct lookup (for style-level downloads)
        let styleEntry = await db.get('styles', downloadId);
        
        // If not found, search by region ID (for region-level downloads)
        if (!styleEntry || !styleEntry.style?.sources) {
          console.warn(`📄 Style not found with key "${downloadId}", searching by region ID...`);
          const foundStyle = await findStyleByRegionId(db, downloadId);
          if (foundStyle) {
            styleEntry = foundStyle;
          }
        }
        
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
