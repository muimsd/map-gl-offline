/**
 * Service Worker for offline map tile serving.
 *
 * Intercepts /__offline__/{downloadId}/{type}/{...path} requests and serves
 * resources from IndexedDB. This is needed for Mapbox GL JS v3 which does NOT
 * have addProtocol, so tile requests from web workers cannot be intercepted
 * via window.fetch override alone.
 *
 * Self-contained: uses raw IndexedDB API (no imports).
 *
 * DB: 'offline-map-db' v3
 * Stores: tiles, styles, sprites, glyphs
 * Tile key format: {styleId}:{sourceId}:{z}:{x}:{y}.{ext}
 */

const DB_NAME = 'offline-map-db';
const OFFLINE_PREFIX = '/__offline__/';

// In-memory cache: regionId -> { styleKey, timestamp }
const regionToStyleCache = new Map();
const CACHE_TTL_MS = 60000;

// -----------------------------------------------------------
// Install / Activate
// -----------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// -----------------------------------------------------------
// IndexedDB helpers (raw API, no idb library)
// -----------------------------------------------------------

function openDatabase() {
  return new Promise((resolve, reject) => {
    // Open without specifying a version so we never trigger onupgradeneeded.
    // The main application is responsible for creating/upgrading the DB schema.
    // If the DB doesn't exist yet, this will create it at version 1 with no stores,
    // but the SW should only run after the main app has initialised the DB.
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// -----------------------------------------------------------
// findStyleByRegionId - search all styles for matching region
// -----------------------------------------------------------

async function findStyleByRegionId(db, regionId) {
  // Check cache
  const cached = regionToStyleCache.get(regionId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.styleEntry;
  }

  try {
    const allStyles = await idbGetAll(db, 'styles');
    for (const styleEntry of allStyles) {
      if (styleEntry.regions && Array.isArray(styleEntry.regions)) {
        const hasRegion = styleEntry.regions.some(
          (r) => r.regionId === regionId || r.id === regionId
        );
        if (hasRegion) {
          regionToStyleCache.set(regionId, { styleEntry, timestamp: Date.now() });
          return styleEntry;
        }
      }
    }
    // Cache negative result
    regionToStyleCache.set(regionId, { styleEntry: null, timestamp: Date.now() });
    return null;
  } catch (err) {
    console.warn('[SW] Error searching for style by region ID:', regionId, err);
    return null;
  }
}

// -----------------------------------------------------------
// Response builders
// -----------------------------------------------------------

function createTileKey(x, y, z, styleId, sourceId, ext) {
  return `${styleId}:${sourceId}:${z}:${x}:${y}.${ext}`;
}

async function decompressGzip(data) {
  try {
    const ds = new DecompressionStream('gzip');
    const stream = new Response(data).body.pipeThrough(ds);
    return await new Response(stream).arrayBuffer();
  } catch (err) {
    console.warn('[SW] Gzip decompression failed:', err);
    return data;
  }
}

async function buildTileResponse(resource) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000',
  };

  if (resource.contentType) {
    headers['Content-Type'] = resource.contentType;
  } else if (resource.type === 'vector') {
    headers['Content-Type'] = 'application/vnd.mapbox-vector-tile';
  }

  let finalData = resource.data;

  // Check for gzip and decompress
  const view = new Uint8Array(resource.data);
  const isGzipped = view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;

  if (isGzipped && resource.type === 'vector') {
    finalData = await decompressGzip(resource.data);
  }

  if (resource.contentEncoding && resource.contentEncoding !== 'gzip') {
    headers['Content-Encoding'] = resource.contentEncoding;
  }

  return new Response(finalData, { status: 200, statusText: 'OK', headers });
}

function deriveTileExtension(tiles) {
  if (Array.isArray(tiles) && tiles.length > 0 && typeof tiles[0] === 'string') {
    const match = tiles[0].match(/\.([\w]+)(?:\?|$)/i);
    if (match) return match[1];
  }
  return 'pbf';
}

// -----------------------------------------------------------
// Resource handlers
// -----------------------------------------------------------

async function handleTile(db, downloadId, rest) {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const actualStyleId = styleEntry ? styleEntry.key : downloadId;

  // rest = ['sourceKey', 'z', 'x', 'y.ext']
  if (rest.length !== 4) {
    return new Response('Invalid tile path', { status: 400 });
  }

  const sourceKey = rest[0];
  const z = Math.floor(parseFloat(rest[1]));
  const x = parseInt(rest[2], 10);
  const yExt = rest[3];
  const yMatch = yExt.match(/(\d+)\.(\w+)/);

  if (!yMatch) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  const y = parseInt(yMatch[1], 10);
  const requestedExt = yMatch[2];

  // Try primary key
  const tileKey = createTileKey(x, y, z, actualStyleId, sourceKey, requestedExt);
  let resource = await idbGet(db, 'tiles', tileKey);
  if (resource && resource.data) {
    return buildTileResponse(resource);
  }

  // Fallback extensions
  const fallbacks = ['pbf', 'mvt', 'png', 'jpg', 'webp'].filter((e) => e !== requestedExt);
  for (const ext of fallbacks) {
    const key = createTileKey(x, y, z, actualStyleId, sourceKey, ext);
    resource = await idbGet(db, 'tiles', key);
    if (resource && resource.data) {
      return buildTileResponse(resource);
    }
  }

  return new Response('Tile not found', { status: 404 });
}

async function handleGlyph(db, downloadId, rest) {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const actualStyleId = styleEntry ? styleEntry.key : downloadId;

  // rest might be ['FontA,FontB', '0-255.pbf'] or ['FontA,FontB,FontC', '0-255.pbf']
  const resourcePath = decodeURIComponent(rest.join('/'));
  const pathParts = resourcePath.split('/');
  const fontstackPart = pathParts[0] || '';
  const rangePart = pathParts[1] || '0-255.pbf';

  // Split comma-separated fonts for fallback
  const fontstacks = fontstackPart.split(',').map((f) => f.trim());

  for (const fontstack of fontstacks) {
    const glyphPath = `${fontstack}/${rangePart}`;
    const normalizedPath = glyphPath.endsWith('.pbf') ? glyphPath : `${glyphPath}.pbf`;

    const candidateKeys = [
      `${actualStyleId}::${normalizedPath}`,
      `${actualStyleId}::${glyphPath}`,
      `${downloadId}::${normalizedPath}`,
      `${downloadId}::${glyphPath}`,
      normalizedPath,
      glyphPath,
    ];

    for (const key of candidateKeys) {
      const resource = await idbGet(db, 'glyphs', key);
      if (resource && resource.data) {
        return new Response(resource.data, {
          status: 200,
          headers: { 'Content-Type': 'application/x-protobuf' },
        });
      }
    }
  }

  return new Response('Glyph not found', { status: 404 });
}

async function handleModel(db, downloadId, rest) {
  // Model URLs are rewritten by patchStyleForOffline to
  //   idb://{styleId}/model/{modelName}  (served as /__offline__/{styleId}/model/{modelName})
  // and stored under the key  {styleId}::model::{modelName}.  Mirror the
  // sprite fallback: try the style ID first, then the download/region ID.
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const actualStyleId = styleEntry ? styleEntry.key : downloadId;
  const resourcePath = decodeURIComponent(rest.join('/'));

  const candidates = Array.from(
    new Set([
      `${actualStyleId}::model::${resourcePath}`,
      `${downloadId}::model::${resourcePath}`,
    ])
  );

  for (const key of candidates) {
    const resource = await idbGet(db, 'models', key);
    if (resource && resource.data) {
      return new Response(resource.data, {
        status: 200,
        headers: { 'Content-Type': resource.contentType || 'model/gltf-binary' },
      });
    }
  }

  return new Response('Model not found', { status: 404 });
}

async function handleSprite(db, downloadId, rest) {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const actualStyleId = styleEntry ? styleEntry.key : downloadId;

  const decodedResourcePath = decodeURIComponent(rest.join('/'));

  const candidateKeys = [
    `${actualStyleId}::${decodedResourcePath}`,
    `${actualStyleId}:${decodedResourcePath}`,
    `${actualStyleId}::${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
    `${actualStyleId}:${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
    `${downloadId}::${decodedResourcePath}`,
    `${downloadId}:${decodedResourcePath}`,
    `${downloadId}::${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
    `${downloadId}:${decodedResourcePath.replace(/\.(json|png)$/i, '')}`,
    decodedResourcePath,
    `${downloadId}::${decodedResourcePath}`,
  ];

  // Deduplicate
  const uniqueKeys = [...new Set(candidateKeys)];

  for (const key of uniqueKeys) {
    const resource = await idbGet(db, 'sprites', key);
    if (resource && resource.data) {
      return new Response(resource.data, {
        status: 200,
        headers: resource.contentType ? { 'Content-Type': resource.contentType } : {},
      });
    }
  }

  return new Response('Sprite not found', { status: 404 });
}

async function handleTileJSON(db, downloadId, rest) {
  const decodedResourcePath = decodeURIComponent(rest.join('/'));

  // Try direct style lookup first
  let styleEntry = await idbGet(db, 'styles', downloadId);

  // Fallback: search by region ID
  if (!styleEntry || !styleEntry.style || !styleEntry.style.sources) {
    const foundStyle = await findStyleByRegionId(db, downloadId);
    if (foundStyle) {
      styleEntry = foundStyle;
    }
  }

  if (!styleEntry || !styleEntry.style || !styleEntry.style.sources) {
    return new Response('Style not found for TileJSON', { status: 404 });
  }

  const sources = styleEntry.style.sources;
  let matchedSourceId;
  let matchedSourceConfig;

  if (decodedResourcePath in sources) {
    matchedSourceId = decodedResourcePath;
    matchedSourceConfig = sources[decodedResourcePath];
  } else {
    for (const [sourceId, sourceValue] of Object.entries(sources)) {
      const sourceUrl = typeof sourceValue.url === 'string' ? sourceValue.url : undefined;
      const originalUrl =
        typeof sourceValue.__originalTilesetUrl === 'string'
          ? sourceValue.__originalTilesetUrl
          : undefined;
      if (sourceUrl === decodedResourcePath || originalUrl === decodedResourcePath) {
        matchedSourceId = sourceId;
        matchedSourceConfig = sourceValue;
        break;
      }
    }
  }

  if (!matchedSourceId || !matchedSourceConfig) {
    return new Response('Source not found for TileJSON', { status: 404 });
  }

  // Build offline TileJSON with /__offline__/ tile URLs
  const extension = deriveTileExtension(matchedSourceConfig.tiles);
  const offlineTiles = [
    `${self.location.origin}${OFFLINE_PREFIX}${downloadId}/tile/${matchedSourceId}/{z}/{x}/{y}.${extension}`,
  ];

  const tileJson = {
    tilejson: typeof matchedSourceConfig.tilejson === 'string' ? matchedSourceConfig.tilejson : '2.2.0',
    name: matchedSourceConfig.name || matchedSourceId,
    tiles: offlineTiles,
    minzoom: typeof matchedSourceConfig.minzoom === 'number' ? matchedSourceConfig.minzoom : 0,
    maxzoom: typeof matchedSourceConfig.maxzoom === 'number' ? matchedSourceConfig.maxzoom : 22,
  };

  // Copy additional fields
  const fieldsToCopy = [
    'bounds', 'center', 'vector_layers', 'scheme', 'attribution',
    'encoding', 'format', 'grids', 'data', 'template', 'version',
  ];
  for (const field of fieldsToCopy) {
    if (field in matchedSourceConfig && matchedSourceConfig[field] !== undefined) {
      tileJson[field] = matchedSourceConfig[field];
    }
  }

  return new Response(JSON.stringify(tileJson), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// -----------------------------------------------------------
// Fetch event listener
// -----------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const idx = url.indexOf(OFFLINE_PREFIX);
  if (idx === -1) return; // Not an offline request, let it pass through

  event.respondWith(handleOfflineRequest(url, idx));
});

async function handleOfflineRequest(url, prefixIndex) {
  try {
    const path = url.substring(prefixIndex + OFFLINE_PREFIX.length);
    const parts = path.split('/');
    const [downloadId, type, ...rest] = parts;

    if (!downloadId || !type) {
      return new Response('Invalid offline URL', { status: 400 });
    }

    const db = await openDatabase();

    switch (type) {
      case 'tile':
        return await handleTile(db, downloadId, rest);
      case 'glyph':
        return await handleGlyph(db, downloadId, rest);
      case 'sprite':
        return await handleSprite(db, downloadId, rest);
      case 'model':
        return await handleModel(db, downloadId, rest);
      case 'tilesjson':
        return await handleTileJSON(db, downloadId, rest);
      default:
        return new Response(`Unknown resource type: ${type}`, { status: 400 });
    }
  } catch (err) {
    console.error('[SW] Error handling offline request:', err);
    return new Response('Service Worker error', { status: 500 });
  }
}
