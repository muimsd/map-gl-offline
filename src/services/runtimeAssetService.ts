import { MAPBOX_RUNTIME_ASSETS, MAPBOX_RUNTIME_CACHE, MAPBOX_RUNTIME_ORIGIN } from '@/sw/shared';
import { logger } from '@/utils/logger';

const assetLogger = logger.scope('RuntimeAssets');

/**
 * Cache the code Mapbox GL fetches from api.mapbox.com while rendering: the
 * Draco and meshopt decoders 3D models need, plus the RTL text and procedural
 * building modules. The Service Worker serves them back from this cache. They
 * live in the Cache API rather than IndexedDB because they belong to the
 * renderer, not to any style or region.
 *
 * Failures only log: the rest of a region is still usable without these.
 *
 * @returns how many assets are now cached
 */
export async function cacheMapboxRuntimeAssets(): Promise<number> {
  if (typeof caches === 'undefined') return 0;

  const cache = await caches.open(MAPBOX_RUNTIME_CACHE);
  const results = await Promise.all(
    MAPBOX_RUNTIME_ASSETS.map(async path => {
      const url = `${MAPBOX_RUNTIME_ORIGIN}${path}`;
      try {
        if (await cache.match(url)) return true;
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(url, response);
        return true;
      } catch (error) {
        assetLogger.warn(`Failed to cache ${url}:`, error);
        return false;
      }
    })
  );
  return results.filter(Boolean).length;
}
