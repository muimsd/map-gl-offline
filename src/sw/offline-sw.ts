/**
 * Offline Service Worker for Mapbox GL JS v3.
 *
 * Intercepts `/__offline__/{downloadId}/{type}/{...path}` requests and serves
 * resources from IndexedDB. Compiled by `scripts/build-sw.js` (esbuild) into
 * a single self-contained `public/idb-offline-sw.js` with no imports left in
 * the output. That file is checked in and served as-is at runtime — the SW
 * global runs in its own context and can't load ESM modules.
 *
 * Scope of the SW: intercepts fetches made from web workers, which
 * `window.fetch` overrides can't reach. Main-thread fetches go through
 * `src/utils/idbFetchHandler.ts` instead.
 *
 * Pure routing / key-computation logic lives in `shared.ts` so both paths
 * stay in lockstep.
 */

/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  OFFLINE_PREFIX,
  DB_NAME,
  findStyleByRegionIdIn,
  makeTileKey,
  parseTileYExt,
  tileFallbackExtensions,
  parseGlyphPath,
  glyphCandidateKeys,
  spriteCandidateKeys,
  modelCandidateKeys,
  matchTileJsonSource,
  buildOfflineTileJson,
  deriveTileExtensionFromTiles,
  isGzipped,
  type StyleEntryLike,
} from './shared';

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Install / Activate
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// IDB (raw API — SW globals don't have the `idb` library)
// ---------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // No version → never triggers onupgradeneeded. The main app owns the schema.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T = unknown>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T = unknown>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Region → style cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
const regionToStyleCache = new Map<string, { styleEntry: StyleEntryLike | null; ts: number }>();

async function findStyleByRegionId(
  db: IDBDatabase,
  regionId: string
): Promise<StyleEntryLike | null> {
  const cached = regionToStyleCache.get(regionId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.styleEntry;
  }
  try {
    const all = await idbGetAll<StyleEntryLike>(db, 'styles');
    const hit = findStyleByRegionIdIn(all, regionId);
    // Cache hit; skip caching negative results — a tile fetch can race ahead
    // of addRegion() and we want it to retry on the next call.
    if (hit) {
      regionToStyleCache.set(regionId, { styleEntry: hit, ts: Date.now() });
    }
    return hit;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SW] findStyleByRegionId failed for', regionId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

async function decompressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const stream = new Response(data).body?.pipeThrough(new DecompressionStream('gzip'));
    if (!stream) return data;
    return await new Response(stream).arrayBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SW] Gzip decompression failed:', err);
    return data;
  }
}

interface TileResource {
  data: ArrayBuffer;
  type?: string;
  contentType?: string;
  contentEncoding?: string;
}

async function buildTileResponse(resource: TileResource): Promise<Response> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000',
  };
  if (resource.contentType) {
    headers['Content-Type'] = resource.contentType;
  } else if (resource.type === 'vector') {
    headers['Content-Type'] = 'application/vnd.mapbox-vector-tile';
  }

  let finalData = resource.data;
  if (isGzipped(resource.data) && resource.type === 'vector') {
    finalData = await decompressGzip(resource.data);
  }
  if (resource.contentEncoding && resource.contentEncoding !== 'gzip') {
    headers['Content-Encoding'] = resource.contentEncoding;
  }
  return new Response(finalData, { status: 200, statusText: 'OK', headers });
}

// ---------------------------------------------------------------------------
// Resource handlers
// ---------------------------------------------------------------------------

async function handleTile(db: IDBDatabase, downloadId: string, rest: string[]): Promise<Response> {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const styleId = styleEntry?.key ?? downloadId;

  // rest = ['sourceKey', ..., 'z', 'x', 'y.ext']. Source keys may contain
  // slashes, so we parse from the end.
  if (rest.length < 4) {
    return new Response('Invalid tile path', { status: 400 });
  }

  const yExt = rest[rest.length - 1];
  const x = parseInt(rest[rest.length - 2], 10);
  const z = Math.floor(parseFloat(rest[rest.length - 3]));
  const sourceKey = rest.slice(0, rest.length - 3).join('/');
  const parsed = parseTileYExt(yExt);
  if (!parsed || Number.isNaN(x) || Number.isNaN(z)) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  const primary = makeTileKey(x, parsed.y, z, styleId, sourceKey, parsed.ext);
  let resource = await idbGet<TileResource>(db, 'tiles', primary);
  if (resource?.data) return buildTileResponse(resource);

  for (const ext of tileFallbackExtensions(parsed.ext)) {
    const key = makeTileKey(x, parsed.y, z, styleId, sourceKey, ext);
    resource = await idbGet<TileResource>(db, 'tiles', key);
    if (resource?.data) return buildTileResponse(resource);
  }
  return new Response('Tile not found', { status: 404 });
}

async function handleGlyph(db: IDBDatabase, downloadId: string, rest: string[]): Promise<Response> {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const styleId = styleEntry?.key ?? downloadId;
  const { fontstacks, rangePart } = parseGlyphPath(decodeURIComponent(rest.join('/')));

  for (const fontstack of fontstacks) {
    for (const key of glyphCandidateKeys(styleId, downloadId, fontstack, rangePart)) {
      const resource = await idbGet<{ data: ArrayBuffer }>(db, 'glyphs', key);
      if (resource?.data) {
        return new Response(resource.data, {
          status: 200,
          headers: { 'Content-Type': 'application/x-protobuf' },
        });
      }
    }
  }
  return new Response('Glyph not found', { status: 404 });
}

async function handleSprite(
  db: IDBDatabase,
  downloadId: string,
  rest: string[]
): Promise<Response> {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const styleId = styleEntry?.key ?? downloadId;
  const path = decodeURIComponent(rest.join('/'));

  for (const key of spriteCandidateKeys(styleId, downloadId, path)) {
    const resource = await idbGet<{ data: ArrayBuffer; contentType?: string }>(db, 'sprites', key);
    if (resource?.data) {
      const headers: Record<string, string> = {};
      if (resource.contentType) headers['Content-Type'] = resource.contentType;
      return new Response(resource.data, { status: 200, headers });
    }
  }
  return new Response('Sprite not found', { status: 404 });
}

async function handleModel(db: IDBDatabase, downloadId: string, rest: string[]): Promise<Response> {
  const styleEntry = await findStyleByRegionId(db, downloadId);
  const styleId = styleEntry?.key ?? downloadId;
  const path = decodeURIComponent(rest.join('/'));

  for (const key of modelCandidateKeys(styleId, downloadId, path)) {
    const resource = await idbGet<{ data: ArrayBuffer; contentType?: string }>(db, 'models', key);
    if (resource?.data) {
      return new Response(resource.data, {
        status: 200,
        headers: { 'Content-Type': resource.contentType || 'model/gltf-binary' },
      });
    }
  }
  return new Response('Model not found', { status: 404 });
}

async function handleTileJSON(
  db: IDBDatabase,
  downloadId: string,
  rest: string[]
): Promise<Response> {
  const path = decodeURIComponent(rest.join('/'));

  let styleEntry = await idbGet<StyleEntryLike>(db, 'styles', downloadId);
  if (!styleEntry?.style?.sources) {
    styleEntry = await findStyleByRegionId(db, downloadId);
  }
  if (!styleEntry?.style?.sources) {
    return new Response('Style not found for TileJSON', { status: 404 });
  }

  const match = matchTileJsonSource(styleEntry.style.sources, path);
  if (!match) {
    return new Response('Source not found for TileJSON', { status: 404 });
  }

  const ext = deriveTileExtensionFromTiles(match.config.tiles);
  const tileJson = buildOfflineTileJson(
    match.config,
    downloadId,
    match.sourceId,
    ext,
    'offline',
    self.location.origin
  );

  return new Response(JSON.stringify(tileJson), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Fetch event
// ---------------------------------------------------------------------------

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const idx = url.indexOf(OFFLINE_PREFIX);
  if (idx === -1) return;
  event.respondWith(handleOfflineRequest(url, idx));
});

async function handleOfflineRequest(url: string, prefixIndex: number): Promise<Response> {
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
    // eslint-disable-next-line no-console
    console.error('[SW] Error handling offline request:', err);
    return new Response('Service Worker error', { status: 500 });
  }
}
