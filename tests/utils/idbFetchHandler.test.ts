/**
 * Tests for IDB Fetch Handler
 */
import { idbFetchHandler, listTileKeysInIDB, clearAllCaches } from '../../src/utils/idbFetchHandler';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { StyleProvider } from '../../src/types/style';

describe('IDBFetchHandler', () => {
  beforeEach(async () => {
    // Clear in-memory caches first to avoid stale data from previous tests
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
  });

  describe('listTileKeysInIDB', () => {
    it('should return empty array when no matching tiles', async () => {
      const keys = await listTileKeysInIDB('style-1', 'source', 10);

      expect(keys).toEqual([]);
    });

    it('should return matching tile keys', async () => {
      const db = await dbPromise;

      // Add tiles at zoom 10
      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-1:source:10:101:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 101,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      // Add tile at different zoom
      await db.put('tiles', {
        key: 'style-1:source:11:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 11,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile3.pbf',
        lastModified: Date.now(),
      });

      const keys = await listTileKeysInIDB('style-1', 'source', 10);

      expect(keys.length).toBe(2);
      expect(keys).toContain('style-1:source:10:100:200.pbf');
      expect(keys).toContain('style-1:source:10:101:200.pbf');
    });

    it('should filter by styleId', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-2:source:10:100:200.pbf',
        styleId: 'style-2',
        sourceId: 'source',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      const keys = await listTileKeysInIDB('style-1', 'source', 10);

      expect(keys.length).toBe(1);
      expect(keys[0]).toBe('style-1:source:10:100:200.pbf');
    });

    it('should filter by sourceId', async () => {
      const db = await dbPromise;

      await db.put('tiles', {
        key: 'style-1:source-a:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source-a',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile1.pbf',
        lastModified: Date.now(),
      });

      await db.put('tiles', {
        key: 'style-1:source-b:10:100:200.pbf',
        styleId: 'style-1',
        sourceId: 'source-b',
        x: 100,
        y: 200,
        z: 10,
        size: 100,
        data: new ArrayBuffer(100),
        downloadedAt: new Date().toISOString(),
        type: 'vector',
        url: 'https://example.com/tile2.pbf',
        lastModified: Date.now(),
      });

      const keys = await listTileKeysInIDB('style-1', 'source-a', 10);

      expect(keys.length).toBe(1);
      expect(keys[0]).toBe('style-1:source-a:10:100:200.pbf');
    });
  });
});
