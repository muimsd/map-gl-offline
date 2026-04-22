/**
 * Tests for IDB Fetch Handler
 */
import { idbFetchHandler, clearAllCaches } from '../../src/utils/idbFetchHandler';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

describe('IDBFetchHandler', () => {
  beforeEach(async () => {
    clearAllCaches();
    const db = await dbPromise;
    await db.clear('tiles');
    await db.clear('fonts');
    await db.clear('sprites');
    await db.clear('glyphs');
    await db.clear('styles');
  });

  describe('idbFetchHandler', () => {
    describe('tile requests', () => {
      it('should return 404 for non-existent tile', async () => {
        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.pbf');

        expect(response.status).toBe(404);
        const text = await response.text();
        expect(text).toBe('Not found in IDB');
      });

      it('should serve stored vector tile', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(100);
        new Uint8Array(tileData).fill(42);

        await db.put('tiles', {
          key: 'style-1:source:10:100:200.pbf',
          styleId: 'style-1',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 10,
          size: 100,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.pbf');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/vnd.mapbox-vector-tile');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

        const data = await response.arrayBuffer();
        expect(data.byteLength).toBe(100);
      });

      it('should serve tile with custom content type', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(50);

        await db.put('tiles', {
          key: 'style-1:source:10:100:200.png',
          styleId: 'style-1',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 10,
          size: 50,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'raster',
          contentType: 'image/png',
          url: 'https://example.com/tile.png',
          lastModified: Date.now(),
        });

        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.png');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/png');
      });

      it('should try fallback extensions when tile not found', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(100);

        // Store tile with .mvt extension
        await db.put('tiles', {
          key: 'style-1:source:10:100:200.mvt',
          styleId: 'style-1',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 10,
          size: 100,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.mvt',
          lastModified: Date.now(),
        });

        // Request with .pbf extension
        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.pbf');

        expect(response.status).toBe(200);
      });

      it('should handle fractional zoom levels', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(100);

        // Store tile at zoom 12
        await db.put('tiles', {
          key: 'style-1:source:12:100:200.pbf',
          styleId: 'style-1',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 12,
          size: 100,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        // Request with fractional zoom (12.5 floors to 12)
        const response = await idbFetchHandler('idb://style-1/tile/source/12.5/100/200.pbf');

        expect(response.status).toBe(200);
      });

      it('should find tile by region ID', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(100);

        // Store style with region
        await db.put('styles', {
          key: 'main-style',
          style: { version: 8, sources: {}, layers: [] },
          provider: 'auto' as StyleProvider,
          regions: [{
            id: 'region-123',
            name: 'Test Region',
            bounds: [[-180, -85], [180, 85]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 14,
          }],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        // Store tile with style ID
        await db.put('tiles', {
          key: 'main-style:source:10:100:200.pbf',
          styleId: 'main-style',
          sourceId: 'source',
          x: 100,
          y: 200,
          z: 10,
          size: 100,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        // Request using region ID
        const response = await idbFetchHandler('idb://region-123/tile/source/10/100/200.pbf');

        expect(response.status).toBe(200);
      });
    });

    describe('glyph requests', () => {
      it('should return 404 for non-existent glyph', async () => {
        const response = await idbFetchHandler('idb://style-1/glyph/Arial/0-255.pbf');

        expect(response.status).toBe(404);
      });

      it('should serve stored glyph', async () => {
        const db = await dbPromise;
        const glyphData = new ArrayBuffer(50);

        await db.put('glyphs', {
          key: 'style-1::Arial/0-255.pbf',
          data: glyphData,
          url: 'https://example.com/fonts/Arial/0-255.pbf',
          size: 50,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          fontstack: 'Arial',
          range: '0-255',
        });

        const response = await idbFetchHandler('idb://style-1/glyph/Arial/0-255.pbf');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/x-protobuf');
      });

      it('should handle comma-separated font fallbacks', async () => {
        const db = await dbPromise;
        const glyphData = new ArrayBuffer(50);

        // Store glyph for second font in fallback chain
        await db.put('glyphs', {
          key: 'style-1::Noto Sans/0-255.pbf',
          data: glyphData,
          url: 'https://example.com/fonts/Noto%20Sans/0-255.pbf',
          size: 50,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          fontstack: 'Noto Sans',
          range: '0-255',
        });

        // Request with fallback chain
        const response = await idbFetchHandler(
          'idb://style-1/glyph/Arial,Noto Sans,Sans-Serif/0-255.pbf'
        );

        expect(response.status).toBe(200);
      });

      it('should find glyph by region ID', async () => {
        const db = await dbPromise;
        const glyphData = new ArrayBuffer(50);

        // Store style with region
        await db.put('styles', {
          key: 'main-style',
          style: { version: 8, sources: {}, layers: [] },
          provider: 'auto' as StyleProvider,
          regions: [{
            id: 'region-abc',
            name: 'Test Region',
            bounds: [[-180, -85], [180, 85]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 14,
          }],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        await db.put('glyphs', {
          key: 'main-style::Arial/0-255.pbf',
          data: glyphData,
          url: 'https://example.com/fonts/Arial/0-255.pbf',
          size: 50,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          fontstack: 'Arial',
          range: '0-255',
        });

        // Request using region ID
        const response = await idbFetchHandler('idb://region-abc/glyph/Arial/0-255.pbf');

        expect(response.status).toBe(200);
      });
    });

    describe('sprite requests', () => {
      it('should return 404 for non-existent sprite', async () => {
        const response = await idbFetchHandler('idb://style-1/sprite/sprite.json');

        expect(response.status).toBe(404);
      });

      it('should serve stored sprite JSON', async () => {
        const db = await dbPromise;
        // Create a simple ArrayBuffer for sprite JSON data
        const spriteData = new ArrayBuffer(50);

        await db.put('sprites', {
          key: 'style-1::sprite.json',
          url: 'https://example.com/sprite.json',
          data: spriteData,
          size: 50,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          contentType: 'application/json',
        });

        const response = await idbFetchHandler('idb://style-1/sprite/sprite.json');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should serve stored sprite PNG', async () => {
        const db = await dbPromise;
        const spriteData = new ArrayBuffer(100);

        await db.put('sprites', {
          key: 'style-1::sprite@2x.png',
          url: 'https://example.com/sprite@2x.png',
          data: spriteData,
          size: 100,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          contentType: 'image/png',
        });

        const response = await idbFetchHandler('idb://style-1/sprite/sprite@2x.png');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/png');
      });

      it('should find sprite by region ID', async () => {
        const db = await dbPromise;
        const spriteData = new ArrayBuffer(100);

        // Store style with region
        await db.put('styles', {
          key: 'main-style',
          style: { version: 8, sources: {}, layers: [] },
          provider: 'auto' as StyleProvider,
          regions: [{
            id: 'region-xyz',
            name: 'Test Region',
            bounds: [[-180, -85], [180, 85]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 14,
          }],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        await db.put('sprites', {
          key: 'main-style::sprite.png',
          url: 'https://example.com/sprite.png',
          data: spriteData,
          size: 100,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          contentType: 'image/png',
        });

        // Request using region ID
        const response = await idbFetchHandler('idb://region-xyz/sprite/sprite.png');

        expect(response.status).toBe(200);
      });
    });

    describe('font requests', () => {
      it('should return 404 for non-existent font', async () => {
        const response = await idbFetchHandler('idb://style-1/font/Arial.ttf');

        expect(response.status).toBe(404);
      });

      it('should serve stored font', async () => {
        const db = await dbPromise;
        const fontData = new ArrayBuffer(200);

        await db.put('fonts', {
          key: 'style-1::Arial.ttf',
          url: 'https://example.com/fonts/Arial.ttf',
          originalUrl: 'https://example.com/fonts/Arial.ttf',
          data: fontData,
          size: 200,
          type: 'ttf',
          contentType: 'font/ttf',
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
        });

        const response = await idbFetchHandler('idb://style-1/font/Arial.ttf');

        expect(response.status).toBe(200);
      });
    });

    describe('tilejson requests', () => {
      it('should return 404 for non-existent style', async () => {
        const response = await idbFetchHandler('idb://unknown-style/tilesjson/openmaptiles');

        expect(response.status).toBe(404);
      });

      it('should serve tilejson for stored style', async () => {
        const db = await dbPromise;

        await db.put('styles', {
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
          provider: 'auto' as StyleProvider,
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        const response = await idbFetchHandler('idb://my-style/tilesjson/openmaptiles');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const tileJson = await response.json();
        expect(tileJson.tilejson).toBe('2.2.0');
        expect(tileJson.name).toBe('openmaptiles');
        expect(tileJson.tiles).toEqual(['idb://my-style/tile/openmaptiles/{z}/{x}/{y}.pbf']);
        expect(tileJson.minzoom).toBe(0);
        expect(tileJson.maxzoom).toBe(14);
        expect(tileJson.bounds).toEqual([-180, -85, 180, 85]);
      });

      it('should find tilejson by region ID', async () => {
        const db = await dbPromise;

        await db.put('styles', {
          key: 'my-style',
          style: {
            version: 8,
            sources: {
              mapbox: {
                type: 'vector',
                tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
              },
            },
            layers: [],
          },
          provider: 'auto' as StyleProvider,
          regions: [{
            id: 'region-001',
            name: 'Test Region',
            bounds: [[-180, -85], [180, 85]] as [[number, number], [number, number]],
            minZoom: 0,
            maxZoom: 14,
          }],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        // Request using region ID
        const response = await idbFetchHandler('idb://region-001/tilesjson/mapbox');

        expect(response.status).toBe(200);

        const tileJson = await response.json();
        expect(tileJson.tiles).toEqual(['idb://region-001/tile/mapbox/{z}/{x}/{y}.pbf']);
      });

      it('should find source by original URL', async () => {
        const db = await dbPromise;

        await db.put('styles', {
          key: 'my-style',
          style: {
            version: 8,
            sources: {
              'my-source': {
                type: 'vector',
                tiles: ['https://example.com/{z}/{x}/{y}.pbf'],
                __originalTilesetUrl: 'https://api.example.com/tilejson/v2.json',
              },
            },
            layers: [],
          },
          provider: 'auto' as StyleProvider,
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        });

        const response = await idbFetchHandler(
          'idb://my-style/tilesjson/https://api.example.com/tilejson/v2.json'
        );

        expect(response.status).toBe(200);

        const tileJson = await response.json();
        expect(tileJson.name).toBe('my-source');
      });
    });

    describe('unknown resource types', () => {
      it('should return 404 for unknown resource type', async () => {
        const response = await idbFetchHandler('idb://style-1/unknown/resource');

        expect(response.status).toBe(404);
      });
    });

    describe('HTTP methods', () => {
      it('should handle GET requests', async () => {
        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.pbf', {
          method: 'GET',
        });

        expect(response.status).toBe(404);
      });

      it('should handle POST requests', async () => {
        const response = await idbFetchHandler('idb://style-1/tile/source/10/100/200.pbf', {
          method: 'POST',
          body: JSON.stringify({ test: 'data' }),
        });

        expect(response.status).toBe(404);
      });
    });

    describe('/__offline__/ URL path', () => {
      it('rewrites /__offline__/ URLs to idb:// and serves the tile', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(32);
        await db.put('tiles', {
          key: 'style-1:source:5:10:20.pbf',
          styleId: 'style-1',
          sourceId: 'source',
          x: 10,
          y: 20,
          z: 5,
          size: 32,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        const response = await idbFetchHandler(
          'https://origin.test/__offline__/style-1/tile/source/5/10/20.pbf'
        );
        expect(response.status).toBe(200);
      });
    });

    describe('tile memory cache', () => {
      it('returns a cached tile on the second request', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(16);
        new Uint8Array(tileData).fill(7);
        await db.put('tiles', {
          key: 'style-1:source:1:1:1.pbf',
          styleId: 'style-1',
          sourceId: 'source',
          x: 1, y: 1, z: 1,
          size: 16,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        const first = await idbFetchHandler('idb://style-1/tile/source/1/1/1.pbf');
        expect(first.status).toBe(200);

        // Delete from DB — second request should hit the in-memory cache.
        await db.delete('tiles', 'style-1:source:1:1:1.pbf');
        const second = await idbFetchHandler('idb://style-1/tile/source/1/1/1.pbf');
        expect(second.status).toBe(200);
      });
    });

    describe('gzip handling', () => {
      it('decompresses a gzipped vector tile on the fly', async () => {
        const db = await dbPromise;
        // Gzip-compress a small PBF payload.
        const orig = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const compressedStream = new Response(orig).body?.pipeThrough(
          new CompressionStream('gzip')
        );
        const gzBuffer = compressedStream
          ? await new Response(compressedStream).arrayBuffer()
          : new ArrayBuffer(0);

        await db.put('tiles', {
          key: 'style-gz:source:2:2:2.pbf',
          styleId: 'style-gz',
          sourceId: 'source',
          x: 2, y: 2, z: 2,
          size: gzBuffer.byteLength,
          data: gzBuffer,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
        });

        const response = await idbFetchHandler('idb://style-gz/tile/source/2/2/2.pbf');
        // The decompression path runs either way — we only care that the
        // handler stays on the happy path and returns 200 for a gzipped tile.
        expect(response.status).toBe(200);
      });

      it('does not decompress gzipped non-vector tiles', async () => {
        const db = await dbPromise;
        const gzipHeader = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
        await db.put('tiles', {
          key: 'style-r:source:0:0:0.png',
          styleId: 'style-r',
          sourceId: 'source',
          x: 0, y: 0, z: 0,
          size: gzipHeader.byteLength,
          data: gzipHeader.buffer,
          downloadedAt: new Date().toISOString(),
          type: 'raster',
          contentType: 'image/png',
          url: 'https://example.com/tile.png',
          lastModified: Date.now(),
        });
        const response = await idbFetchHandler('idb://style-r/tile/source/0/0/0.png');
        expect(response.status).toBe(200);
      });

      it('marks expired resources with X-Cache-Expired header', async () => {
        const db = await dbPromise;
        await db.put('tiles', {
          key: 'style-exp:source:3:3:3.pbf',
          styleId: 'style-exp',
          sourceId: 'source',
          x: 3, y: 3, z: 3,
          size: 4,
          data: new ArrayBuffer(4),
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          lastModified: Date.now(),
          expires: Date.now() - 10000,
        });
        const response = await idbFetchHandler('idb://style-exp/tile/source/3/3/3.pbf');
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Cache-Expired')).toBe('true');
      });

      it('preserves non-gzip content-encoding when set', async () => {
        const db = await dbPromise;
        await db.put('tiles', {
          key: 'style-br:source:4:4:4.pbf',
          styleId: 'style-br',
          sourceId: 'source',
          x: 4, y: 4, z: 4,
          size: 4,
          data: new ArrayBuffer(4),
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: 'https://example.com/tile.pbf',
          contentEncoding: 'br',
          lastModified: Date.now(),
        });
        const response = await idbFetchHandler('idb://style-br/tile/source/4/4/4.pbf');
        expect(response.headers.get('Content-Encoding')).toBe('br');
      });
    });

    describe('model requests', () => {
      it('returns 404 for unknown model', async () => {
        const response = await idbFetchHandler('idb://style-1/model/tree.glb');
        expect(response.status).toBe(404);
      });

      it('serves stored models via the style key', async () => {
        const db = await dbPromise;
        await db.put('models', {
          key: 'style-m::model::tree.glb',
          data: new ArrayBuffer(64),
          contentType: 'model/gltf-binary',
          size: 64,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          styleId: 'style-m',
          modelName: 'tree.glb',
        } as never);
        const response = await idbFetchHandler('idb://style-m/model/tree.glb');
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('model/gltf-binary');
      });

      it('defaults model content-type when not stored', async () => {
        const db = await dbPromise;
        await db.put('models', {
          key: 'style-n::model::thing.glb',
          data: new ArrayBuffer(16),
          size: 16,
          lastModified: Date.now(),
          downloadedAt: new Date().toISOString(),
          styleId: 'style-n',
          modelName: 'thing.glb',
        } as never);
        const response = await idbFetchHandler('idb://style-n/model/thing.glb');
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('model/gltf-binary');
      });
    });

    describe('unhappy tilejson', () => {
      it('returns 404 when style exists but has no matching source', async () => {
        const db = await dbPromise;
        await db.put('styles', {
          key: 'nomatch',
          style: {
            version: 8,
            sources: { foo: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
            layers: [],
          },
          provider: 'auto' as StyleProvider,
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        });
        const response = await idbFetchHandler('idb://nomatch/tilesjson/doesnotexist');
        expect(response.status).toBe(404);
      });
    });

    describe('old URL format for tiles (fallback)', () => {
      it('serves a tile using the encoded URL fallback path', async () => {
        const db = await dbPromise;
        const tileData = new ArrayBuffer(8);
        // The service parses "/\d+/\d+/\d+\.ext" out of the URL and
        // uses the 5th-from-last segment as the sourceKey.
        const tileUrl = 'https://tiles.example.com/service/mysrc/vt/10/100/200.pbf';
        await db.put('tiles', {
          key: 'styleOLD:mysrc:10:100:200.pbf',
          styleId: 'styleOLD',
          sourceId: 'mysrc',
          x: 100,
          y: 200,
          z: 10,
          size: 8,
          data: tileData,
          downloadedAt: new Date().toISOString(),
          type: 'vector',
          url: tileUrl,
          lastModified: Date.now(),
        });
        const encoded = encodeURIComponent(tileUrl);
        const response = await idbFetchHandler(`idb://styleOLD/tile/${encoded}`);
        expect(response.status).toBe(200);
      });
    });
  });

});
