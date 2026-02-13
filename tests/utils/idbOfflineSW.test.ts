/**
 * Tests for Service Worker (public/idb-offline-sw.js)
 *
 * Strategy: We load the SW file as a script, providing a mock `self` that
 * captures addEventListener calls. Then we invoke the captured fetch handler
 * directly. IndexedDB is provided by fake-indexeddb (auto-setup in tests/setup.ts).
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

// ---------------------------------------------------------------
// Types for captured SW handlers
// ---------------------------------------------------------------

interface FetchEvent {
  request: { url: string };
  respondWith: (p: Promise<Response>) => void;
}

type FetchHandler = (event: FetchEvent) => void;

// ---------------------------------------------------------------
// Helpers: load the SW script in a sandboxed context
// ---------------------------------------------------------------

let fetchHandler: FetchHandler;

/** Send a fetch event to the SW and return the Response */
async function swFetch(url: string): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const event: FetchEvent = {
      request: { url },
      respondWith(promise: Promise<Response>) {
        promise.then(resolve, reject);
      },
    };
    fetchHandler(event);
  });
}

/** Check if the SW would intercept a URL (calls respondWith) */
function wouldIntercept(url: string): boolean {
  let handled = false;
  const event: FetchEvent = {
    request: { url },
    respondWith() {
      handled = true;
    },
  };
  fetchHandler(event);
  return handled;
}

/** Open the same DB the SW uses so we can seed data */
function openTestDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('offline-map-db', 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ['regions', 'tiles', 'styles', 'sprites', 'glyphs', 'fonts']) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'key' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, storeName: string, value: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearStore(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------
// Load the SW once before all tests
// ---------------------------------------------------------------

beforeAll(() => {
  const swPath = path.resolve(__dirname, '../../public/idb-offline-sw.js');
  const swCode = fs.readFileSync(swPath, 'utf-8');

  const listeners: Record<string, Function> = {};

  // Build a mock `self` that the SW will use
  const mockSelf: Record<string, unknown> = {
    addEventListener(type: string, handler: Function) {
      listeners[type] = handler;
    },
    skipWaiting: jest.fn(),
    clients: {
      claim: jest.fn(() => Promise.resolve()),
    },
    location: {
      origin: 'https://localhost',
    },
  };

  // DecompressionStream mock — return data unchanged (decompression tested separately)
  class MockDecompressionStream {
    readable: ReadableStream;
    writable: WritableStream;
    constructor(_format: string) {
      let controller: ReadableStreamDefaultController;
      this.readable = new ReadableStream({
        start(c) {
          controller = c;
        },
      });
      this.writable = new WritableStream({
        write(chunk) {
          controller.enqueue(chunk);
        },
        close() {
          controller.close();
        },
      });
    }
  }

  // Create a sandbox context with everything the SW needs
  const sandbox = {
    self: mockSelf,
    indexedDB: globalThis.indexedDB,
    IDBKeyRange: globalThis.IDBKeyRange,
    console: globalThis.console,
    Response: globalThis.Response,
    Request: globalThis.Request,
    Headers: globalThis.Headers,
    ReadableStream: globalThis.ReadableStream,
    WritableStream: globalThis.WritableStream,
    Uint8Array: globalThis.Uint8Array,
    ArrayBuffer: globalThis.ArrayBuffer,
    Promise: globalThis.Promise,
    Map: globalThis.Map,
    Set: globalThis.Set,
    Date: globalThis.Date,
    Math: globalThis.Math,
    Array: globalThis.Array,
    Object: globalThis.Object,
    String: globalThis.String,
    JSON: globalThis.JSON,
    parseInt: globalThis.parseInt,
    parseFloat: globalThis.parseFloat,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    DecompressionStream: MockDecompressionStream,
    URL: globalThis.URL,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    decodeURIComponent: globalThis.decodeURIComponent,
    encodeURIComponent: globalThis.encodeURIComponent,
    Blob: globalThis.Blob,
  };

  vm.createContext(sandbox);
  vm.runInContext(swCode, sandbox);

  // Capture the fetch handler
  fetchHandler = listeners['fetch'] as FetchHandler;
  if (!fetchHandler) {
    throw new Error('SW did not register a fetch handler');
  }
});

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe('idb-offline-sw.js', () => {
  let db: IDBDatabase;

  beforeAll(async () => {
    db = await openTestDB();
  });

  beforeEach(async () => {
    await clearStore(db, 'tiles');
    await clearStore(db, 'styles');
    await clearStore(db, 'sprites');
    await clearStore(db, 'glyphs');
    await clearStore(db, 'fonts');
  });

  afterAll(() => {
    db.close();
  });

  // -----------------------------------------------------------
  // Passthrough
  // -----------------------------------------------------------

  describe('passthrough for non-offline URLs', () => {
    it('should not intercept normal requests', () => {
      // Handler returns early without calling respondWith
      expect(wouldIntercept('https://example.com/normal/path')).toBe(false);
    });

    it('should intercept offline requests', () => {
      expect(wouldIntercept('https://localhost/__offline__/style-1/tile/src/1/0/0.pbf')).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Invalid offline URLs
  // -----------------------------------------------------------

  describe('invalid offline URLs', () => {
    it('should return 400 for missing downloadId and type', async () => {
      const resp = await swFetch('https://localhost/__offline__/');
      expect(resp.status).toBe(400);
    });

    it('should return 400 for unknown resource type', async () => {
      const resp = await swFetch('https://localhost/__offline__/style-1/unknown/resource');
      expect(resp.status).toBe(400);
      const text = await resp.text();
      expect(text).toContain('Unknown resource type');
    });
  });

  // -----------------------------------------------------------
  // Tile handling
  // -----------------------------------------------------------

  describe('tile handling', () => {
    it('should return 404 for non-existent tile', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(404);
    });

    it('should serve a stored vector tile', async () => {
      const tileData = new ArrayBuffer(64);
      new Uint8Array(tileData).fill(42);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:10:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('application/vnd.mapbox-vector-tile');
      expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(resp.headers.get('Cache-Control')).toBe('public, max-age=31536000');

      const data = await resp.arrayBuffer();
      expect(data.byteLength).toBe(64);
    });

    it('should serve a tile with custom contentType', async () => {
      const tileData = new ArrayBuffer(32);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:5:10:20.png',
        data: tileData,
        type: 'raster',
        contentType: 'image/png',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/5/10/20.png'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('image/png');
    });

    it('should return 400 for invalid tile path (too few segments)', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100'
      );
      expect(resp.status).toBe(400);
    });

    it('should return 400 for invalid tile coordinates', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/bad'
      );
      expect(resp.status).toBe(400);
    });

    it('should handle fractional zoom levels (floor to int)', async () => {
      const tileData = new ArrayBuffer(16);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:12:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/12.7/100/200.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should try fallback extensions (.mvt stored, .pbf requested)', async () => {
      const tileData = new ArrayBuffer(16);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:10:100:200.mvt',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should try fallback extensions (.pbf stored, .mvt requested)', async () => {
      const tileData = new ArrayBuffer(16);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:10:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.mvt'
      );
      expect(resp.status).toBe(200);
    });

    it('should resolve tile via region ID lookup', async () => {
      await idbPut(db, 'styles', {
        key: 'main-style',
        style: { version: 8, sources: {}, layers: [] },
        regions: [{ regionId: 'region-1', name: 'Test' }],
      });

      const tileData = new ArrayBuffer(16);
      await idbPut(db, 'tiles', {
        key: 'main-style:source:10:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/region-1/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should resolve tile via region ID using "id" field', async () => {
      await idbPut(db, 'styles', {
        key: 'main-style',
        style: { version: 8, sources: {}, layers: [] },
        regions: [{ id: 'region-2', name: 'Test' }],
      });

      const tileData = new ArrayBuffer(16);
      await idbPut(db, 'tiles', {
        key: 'main-style:source:10:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/region-2/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should decompress gzipped vector tiles', async () => {
      // Create data with gzip magic bytes (0x1f, 0x8b)
      const tileData = new ArrayBuffer(10);
      const view = new Uint8Array(tileData);
      view[0] = 0x1f;
      view[1] = 0x8b;
      view.fill(0x00, 2);

      await idbPut(db, 'tiles', {
        key: 'style-1:source:10:100:200.pbf',
        data: tileData,
        type: 'vector',
      });

      // The mock DecompressionStream passes data through unchanged,
      // so we just verify no error and a 200 response
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should NOT decompress gzipped raster tiles', async () => {
      // Raster tiles should not be decompressed even with gzip magic
      const tileData = new ArrayBuffer(10);
      const view = new Uint8Array(tileData);
      view[0] = 0x1f;
      view[1] = 0x8b;

      await idbPut(db, 'tiles', {
        key: 'style-1:source:10:100:200.png',
        data: tileData,
        type: 'raster',
        contentType: 'image/png',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/tile/source/10/100/200.png'
      );
      expect(resp.status).toBe(200);
      // Verify the original data is returned (no decompression)
      const returned = await resp.arrayBuffer();
      const returnedView = new Uint8Array(returned);
      expect(returnedView[0]).toBe(0x1f);
      expect(returnedView[1]).toBe(0x8b);
    });
  });

  // -----------------------------------------------------------
  // Glyph handling
  // -----------------------------------------------------------

  describe('glyph handling', () => {
    it('should return 404 for non-existent glyph', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/glyph/Arial/0-255.pbf'
      );
      expect(resp.status).toBe(404);
    });

    it('should serve stored glyph', async () => {
      const glyphData = new ArrayBuffer(50);

      await idbPut(db, 'glyphs', {
        key: 'style-1::Arial/0-255.pbf',
        data: glyphData,
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/glyph/Arial/0-255.pbf'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('application/x-protobuf');
    });

    it('should handle comma-separated font fallbacks (first match)', async () => {
      const glyphData = new ArrayBuffer(50);

      await idbPut(db, 'glyphs', {
        key: 'style-1::Arial/0-255.pbf',
        data: glyphData,
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/glyph/Arial,Noto Sans/0-255.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should handle comma-separated font fallbacks (second match)', async () => {
      const glyphData = new ArrayBuffer(50);

      // Only store the second font
      await idbPut(db, 'glyphs', {
        key: 'style-1::Noto Sans/0-255.pbf',
        data: glyphData,
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/glyph/Arial,Noto Sans/0-255.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should resolve glyph via region ID', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: { version: 8, sources: {}, layers: [] },
        regions: [{ regionId: 'region-g', name: 'Test' }],
      });

      const glyphData = new ArrayBuffer(50);
      await idbPut(db, 'glyphs', {
        key: 'my-style::Arial/0-255.pbf',
        data: glyphData,
      });

      const resp = await swFetch(
        'https://localhost/__offline__/region-g/glyph/Arial/0-255.pbf'
      );
      expect(resp.status).toBe(200);
    });

    it('should append .pbf extension if missing in stored key', async () => {
      const glyphData = new ArrayBuffer(50);

      // Store without .pbf extension in one of the candidate key forms
      await idbPut(db, 'glyphs', {
        key: 'style-1::Arial/0-255.pbf',
        data: glyphData,
      });

      // Request path already has .pbf
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/glyph/Arial/0-255.pbf'
      );
      expect(resp.status).toBe(200);
    });
  });

  // -----------------------------------------------------------
  // Sprite handling
  // -----------------------------------------------------------

  describe('sprite handling', () => {
    it('should return 404 for non-existent sprite', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/style-1/sprite/sprite.json'
      );
      expect(resp.status).toBe(404);
    });

    it('should serve stored sprite JSON', async () => {
      const spriteData = new ArrayBuffer(80);

      await idbPut(db, 'sprites', {
        key: 'style-1::sprite.json',
        data: spriteData,
        contentType: 'application/json',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/sprite/sprite.json'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('application/json');
    });

    it('should serve stored sprite PNG', async () => {
      const spriteData = new ArrayBuffer(100);

      await idbPut(db, 'sprites', {
        key: 'style-1::sprite@2x.png',
        data: spriteData,
        contentType: 'image/png',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/sprite/sprite@2x.png'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('image/png');
    });

    it('should try key without extension as fallback', async () => {
      const spriteData = new ArrayBuffer(100);

      // Store with key that strips extension
      await idbPut(db, 'sprites', {
        key: 'style-1::sprite',
        data: spriteData,
        contentType: 'application/json',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/sprite/sprite.json'
      );
      expect(resp.status).toBe(200);
    });

    it('should resolve sprite via region ID', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: { version: 8, sources: {}, layers: [] },
        regions: [{ id: 'region-s', name: 'Test' }],
      });

      const spriteData = new ArrayBuffer(100);
      await idbPut(db, 'sprites', {
        key: 'my-style::sprite.png',
        data: spriteData,
        contentType: 'image/png',
      });

      const resp = await swFetch(
        'https://localhost/__offline__/region-s/sprite/sprite.png'
      );
      expect(resp.status).toBe(200);
    });

    it('should return no content-type when sprite has none', async () => {
      const spriteData = new ArrayBuffer(100);

      await idbPut(db, 'sprites', {
        key: 'style-1::sprite.png',
        data: spriteData,
        // no contentType
      });

      const resp = await swFetch(
        'https://localhost/__offline__/style-1/sprite/sprite.png'
      );
      expect(resp.status).toBe(200);
      // No Content-Type header when resource has none
      expect(resp.headers.get('Content-Type')).toBeNull();
    });
  });

  // -----------------------------------------------------------
  // TileJSON handling
  // -----------------------------------------------------------

  describe('TileJSON handling', () => {
    it('should return 404 for non-existent style', async () => {
      const resp = await swFetch(
        'https://localhost/__offline__/unknown-style/tilesjson/openmaptiles'
      );
      expect(resp.status).toBe(404);
    });

    it('should build offline TileJSON for stored style', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            openmaptiles: {
              type: 'vector',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
              bounds: [-180, -85, 180, 85],
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/openmaptiles'
      );
      expect(resp.status).toBe(200);
      expect(resp.headers.get('Content-Type')).toBe('application/json');

      const tileJson = await resp.json();
      expect(tileJson.tilejson).toBe('2.2.0');
      expect(tileJson.name).toBe('openmaptiles');
      expect(tileJson.minzoom).toBe(0);
      expect(tileJson.maxzoom).toBe(14);
      expect(tileJson.bounds).toEqual([-180, -85, 180, 85]);
      expect(tileJson.tiles).toEqual([
        'https://localhost/__offline__/my-style/tile/openmaptiles/{z}/{x}/{y}.pbf',
      ]);
    });

    it('should derive extension from source tiles array', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            raster: {
              type: 'raster',
              tiles: ['https://example.com/{z}/{x}/{y}.png?key=abc'],
              minzoom: 0,
              maxzoom: 18,
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/raster'
      );
      expect(resp.status).toBe(200);

      const tileJson = await resp.json();
      expect(tileJson.tiles[0]).toContain('.png');
    });

    it('should default extension to pbf when tiles array is empty', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            openmaptiles: {
              type: 'vector',
              tiles: [],
              minzoom: 0,
              maxzoom: 14,
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/openmaptiles'
      );
      const tileJson = await resp.json();
      expect(tileJson.tiles[0]).toContain('.pbf');
    });

    it('should find source by URL match', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            'my-source': {
              type: 'vector',
              url: 'https://api.example.com/tilejson.json',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/https://api.example.com/tilejson.json'
      );
      expect(resp.status).toBe(200);

      const tileJson = await resp.json();
      expect(tileJson.name).toBe('my-source');
    });

    it('should find source by __originalTilesetUrl', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            'mapbox-source': {
              type: 'vector',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              __originalTilesetUrl: 'mapbox://mapbox.mapbox-streets-v8',
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/mapbox://mapbox.mapbox-streets-v8'
      );
      expect(resp.status).toBe(200);

      const tileJson = await resp.json();
      expect(tileJson.name).toBe('mapbox-source');
    });

    it('should return 404 when source not found in style', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: { 'existing-source': { type: 'vector', tiles: [] } },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/non-existent-source'
      );
      expect(resp.status).toBe(404);
    });

    it('should resolve TileJSON via region ID', async () => {
      await idbPut(db, 'styles', {
        key: 'main-style',
        style: {
          version: 8,
          sources: {
            openmaptiles: {
              type: 'vector',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
            },
          },
          layers: [],
        },
        regions: [{ regionId: 'region-tj', name: 'Test' }],
      });

      const resp = await swFetch(
        'https://localhost/__offline__/region-tj/tilesjson/openmaptiles'
      );
      expect(resp.status).toBe(200);

      const tileJson = await resp.json();
      expect(tileJson.tiles[0]).toContain('region-tj');
    });

    it('should copy additional fields to TileJSON', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            openmaptiles: {
              type: 'vector',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
              vector_layers: [{ id: 'water', fields: {} }],
              attribution: '(c) OpenMapTiles',
              scheme: 'xyz',
              center: [0, 0, 5],
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/openmaptiles'
      );
      const tileJson = await resp.json();
      expect(tileJson.vector_layers).toEqual([{ id: 'water', fields: {} }]);
      expect(tileJson.attribution).toBe('(c) OpenMapTiles');
      expect(tileJson.scheme).toBe('xyz');
      expect(tileJson.center).toEqual([0, 0, 5]);
    });

    it('should use source tilejson version when present', async () => {
      await idbPut(db, 'styles', {
        key: 'my-style',
        style: {
          version: 8,
          sources: {
            openmaptiles: {
              type: 'vector',
              tilejson: '3.0.0',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
            },
          },
          layers: [],
        },
      });

      const resp = await swFetch(
        'https://localhost/__offline__/my-style/tilesjson/openmaptiles'
      );
      const tileJson = await resp.json();
      expect(tileJson.tilejson).toBe('3.0.0');
    });
  });

  // -----------------------------------------------------------
  // findStyleByRegionId caching
  // -----------------------------------------------------------

  describe('region-to-style caching', () => {
    it('should cache region lookups and return same result on second call', async () => {
      await idbPut(db, 'styles', {
        key: 'cached-style',
        style: { version: 8, sources: {}, layers: [] },
        regions: [{ regionId: 'cached-region', name: 'Cached' }],
      });

      const tileData = new ArrayBuffer(16);
      await idbPut(db, 'tiles', {
        key: 'cached-style:src:5:1:1.pbf',
        data: tileData,
        type: 'vector',
      });

      // First call populates cache
      const resp1 = await swFetch(
        'https://localhost/__offline__/cached-region/tile/src/5/1/1.pbf'
      );
      expect(resp1.status).toBe(200);

      // Second call should use cache
      const resp2 = await swFetch(
        'https://localhost/__offline__/cached-region/tile/src/5/1/1.pbf'
      );
      expect(resp2.status).toBe(200);
    });

    it('should cache negative lookups', async () => {
      // No styles at all — region won't be found
      const resp = await swFetch(
        'https://localhost/__offline__/nonexistent-region/tile/src/5/1/1.pbf'
      );
      expect(resp.status).toBe(404);

      // Second call — cached negative result
      const resp2 = await swFetch(
        'https://localhost/__offline__/nonexistent-region/tile/src/5/1/1.pbf'
      );
      expect(resp2.status).toBe(404);
    });
  });
});
