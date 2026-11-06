import { cacheMapboxRuntimeAssets } from '../../src/services/runtimeAssetService';
import {
  isMapboxRuntimeAsset,
  MAPBOX_RUNTIME_ASSETS,
  MAPBOX_RUNTIME_ORIGIN,
} from '../../src/sw/shared';

describe('isMapboxRuntimeAsset', () => {
  const draco = `${MAPBOX_RUNTIME_ORIGIN}/mapbox-gl-js/draco_decoder_gltf_v1.5.6.wasm`;

  it('matches listed assets, ignoring any query string', () => {
    expect(isMapboxRuntimeAsset(draco)).toBe(true);
    expect(isMapboxRuntimeAsset(`${draco}?v=1`)).toBe(true);
  });

  it('ignores other Mapbox and foreign URLs', () => {
    expect(isMapboxRuntimeAsset(`${MAPBOX_RUNTIME_ORIGIN}/mapbox-gl-js/other.wasm`)).toBe(false);
    expect(isMapboxRuntimeAsset(`${MAPBOX_RUNTIME_ORIGIN}/styles/v1/mapbox/standard`)).toBe(false);
    expect(isMapboxRuntimeAsset('https://example.com/mapbox-gl-js/draco_decoder_gltf_v1.5.6.wasm')).toBe(false);
  });
});

describe('cacheMapboxRuntimeAssets', () => {
  const realFetch = global.fetch;
  const realCaches = (global as { caches?: unknown }).caches;
  let store: Map<string, unknown>;

  beforeEach(() => {
    store = new Map();
    (global as { caches?: unknown }).caches = {
      open: async () => ({
        match: async (url: string) => store.get(url),
        put: async (url: string, response: unknown) => void store.set(url, response),
      }),
    };
  });

  afterEach(() => {
    global.fetch = realFetch;
    (global as { caches?: unknown }).caches = realCaches;
  });

  it('caches every asset', async () => {
    global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    await expect(cacheMapboxRuntimeAssets()).resolves.toBe(MAPBOX_RUNTIME_ASSETS.length);
    expect(store.size).toBe(MAPBOX_RUNTIME_ASSETS.length);
  });

  it("doesn't fetch what is already cached", async () => {
    for (const path of MAPBOX_RUNTIME_ASSETS) store.set(`${MAPBOX_RUNTIME_ORIGIN}${path}`, {});
    global.fetch = jest.fn() as unknown as typeof fetch;
    await expect(cacheMapboxRuntimeAssets()).resolves.toBe(MAPBOX_RUNTIME_ASSETS.length);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('counts failures instead of throwing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    await expect(cacheMapboxRuntimeAssets()).resolves.toBe(MAPBOX_RUNTIME_ASSETS.length - 2);
  });

  it('does nothing where the Cache API is unavailable', async () => {
    delete (global as { caches?: unknown }).caches;
    await expect(cacheMapboxRuntimeAssets()).resolves.toBe(0);
  });
});
