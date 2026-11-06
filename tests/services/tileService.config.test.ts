/**
 * Which sources a config-driven style (Mapbox Standard) downloads.
 */
const mockFetchResource = jest.fn();

jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchResourceWithRetry: (...args: unknown[]) => mockFetchResource(...args),
  };
});

import { TileService } from '../../src/services/tileService';
import { dbPromise } from '../../src/storage/indexedDbManager';
import type { MapboxStyle, TileDownloadOptions } from '../../src/types';

const region = {
  id: 'r',
  name: 'R',
  bounds: [
    [-0.1, -0.1],
    [0.1, 0.1],
  ] as [[number, number], [number, number]],
  minZoom: 14,
  maxZoom: 14,
};

const vector = (tileset: string) => ({
  type: 'vector',
  tiles: [`https://api.mapbox.com/v4/${tileset}/{z}/{x}/{y}.vector.pbf`],
  minzoom: 0,
  maxzoom: 14,
});

const gated = (key: string) => ({ visibility: ['case', ['config', key], 'visible', 'none'] });

/** A cut-down Mapbox Standard. */
const standardLike = (showLandmarkIcons: boolean) =>
  ({
    version: 8,
    schema: {
      showHdRoads: { default: false },
      showLandmarkIcons: { default: showLandmarkIcons },
    },
    iconsets: { landmarks: { type: 'source', source: 'mapbox-landmarks' } },
    terrain: { source: 'mapbox-dem' },
    sources: {
      composite: vector('mapbox.mapbox-streets-v8-lite'),
      'mapbox-hd-roads': vector('mapbox.hd-road-v1-bounded'),
      'mapbox-landmark-pois': vector('mapbox.mapbox-landmark-pois-v1'),
      'mapbox-landmarks': {
        type: 'raster-array',
        tiles: ['https://a.tiles.mapbox.com/rasterarrays/v1/icons/{z}/{x}/{y}.mrt?jobid=1'],
        minzoom: 10,
        maxzoom: 10,
      },
      'mapbox-dem': {
        type: 'raster-dem',
        tiles: ['https://a.tiles.mapbox.com/raster/v1/dem/{z}/{x}/{y}.png?access_token=pk.t'],
        minzoom: 0,
        maxzoom: 14,
      },
    },
    layers: [
      { id: 'land', type: 'fill', source: 'composite' },
      { id: 'hd', type: 'line', source: 'mapbox-hd-roads', layout: gated('showHdRoads') },
      {
        id: 'landmark-icon',
        type: 'symbol',
        source: 'mapbox-landmark-pois',
        layout: {
          ...gated('showLandmarkIcons'),
          'icon-image': ['image', ['get', 'n'], { iconset: { id: 'landmarks' } }],
        },
      },
    ],
  }) as unknown as MapboxStyle;

describe('TileService with a config-driven style', () => {
  let service: TileService;
  const realFetch = global.fetch;

  beforeEach(async () => {
    service = new TileService();
    mockFetchResource.mockReset();
    mockFetchResource.mockResolvedValue({
      type: 'pbf',
      data: new ArrayBuffer(8),
      contentType: 'application/x-protobuf',
    });
    // Every probe misses, which would skip any source that gets probed.
    global.fetch = jest.fn(async () => new Response(null, { status: 404 })) as typeof fetch;
    const db = await dbPromise;
    await db.clear('tiles');
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const downloadedUrls = async (style: MapboxStyle, options: TileDownloadOptions = {}) => {
    await service.downloadTiles(region, style, 's', {
      storageQuotaCheck: false,
      maxRetries: 0,
      skipExisting: false,
      probeSourcesBeforeDownload: false,
      ...options,
    });
    return mockFetchResource.mock.calls.map(call => call[0] as string);
  };

  it('skips features that are off, in the default config', async () => {
    const urls = await downloadedUrls(standardLike(false));
    expect(urls.some(u => u.includes('streets-v8-lite'))).toBe(true);
    expect(urls.some(u => u.includes('/raster/v1/dem/'))).toBe(true);
    expect(urls.some(u => u.includes('hd-road'))).toBe(false);
    expect(urls.some(u => u.includes('landmark-pois'))).toBe(false);
    expect(urls.some(u => u.includes('rasterarrays'))).toBe(false);
  });

  it('downloads a known-sparse source and its iconset once the feature is on', async () => {
    const urls = await downloadedUrls(standardLike(true));
    expect(urls.some(u => u.includes('landmark-pois'))).toBe(true);
    expect(urls.some(u => u.includes('rasterarrays'))).toBe(true);
    expect(urls.some(u => u.includes('hd-road'))).toBe(false);
  });

  it("doesn't probe a known-sparse source a feature needs", async () => {
    const urls = await downloadedUrls(standardLike(true), { probeSourcesBeforeDownload: true });
    expect(urls.some(u => u.includes('landmark-pois'))).toBe(true);
    const probed = (global.fetch as jest.Mock).mock.calls.map(call => String(call[0]));
    expect(probed.some(u => u.includes('landmark-pois'))).toBe(false);
    // Ordinary sources are still probed: these all 404, so they drop out.
    expect(urls.some(u => u.includes('streets-v8-lite'))).toBe(false);
  });

  it('downloads every source with skipInactiveSources: false', async () => {
    const urls = await downloadedUrls(standardLike(false), { skipInactiveSources: false });
    expect(urls.some(u => u.includes('hd-road'))).toBe(true);
    expect(urls.some(u => u.includes('rasterarrays'))).toBe(true);
    expect(urls.some(u => u.includes('landmark-pois'))).toBe(true);
  });

  it('requests DEM tiles with an sku, from raster/v1', async () => {
    const urls = await downloadedUrls(standardLike(false));
    const dem = urls.find(u => u.includes('/dem/'));
    expect(dem).toMatch(/\/raster\/v1\/dem\/14\/\d+\/\d+\.png\?access_token=pk\.t&sku=101/);
  });

  it('leaves a style without config alone: hidden layers still download', async () => {
    const style = {
      version: 8,
      sources: { a: vector('mapbox.mapbox-streets-v8') },
      layers: [{ id: 'l', type: 'fill', source: 'a', layout: { visibility: 'none' } }],
    } as unknown as MapboxStyle;
    expect((await downloadedUrls(style)).length).toBeGreaterThan(0);
  });

  it('still pre-skips known-sparse sources on a style without config', async () => {
    const style = {
      version: 8,
      sources: {
        a: vector('mapbox.mapbox-streets-v8'),
        b: vector('mapbox.indoor-v3'),
      },
      layers: [{ id: 'l', type: 'fill', source: 'b' }],
    } as unknown as MapboxStyle;
    const urls = await downloadedUrls(style);
    expect(urls.some(u => u.includes('indoor-v3'))).toBe(false);
  });
});
