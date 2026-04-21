import type { MapboxStyle } from '@/types/style';

/**
 * Convert a style with `idb://` URLs to use absolute `/__offline__/` HTTP URLs
 * so that a Service Worker can intercept the requests from web workers.
 *
 * This is needed for Mapbox GL JS v3 which does not support `addProtocol`.
 * The Service Worker intercepts `/__offline__/` fetches from both the main
 * thread and web workers, then serves resources from IndexedDB.
 *
 * URLs must be absolute (with origin) because Mapbox GL JS's internal URL
 * parser (`normalizeSpriteURL`, etc.) rejects relative paths without a scheme.
 */
export function convertStyleForServiceWorker(style: MapboxStyle): MapboxStyle {
  const converted = JSON.parse(JSON.stringify(style)) as MapboxStyle;

  // Use absolute URLs so Mapbox GL JS's URL parser doesn't reject them
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const replace = (value: string): string => value.replace(/^idb:\/\//, `${origin}/__offline__/`);

  // Convert sources
  if (converted.sources) {
    for (const sourceKey of Object.keys(converted.sources)) {
      const source = converted.sources[sourceKey] as {
        tiles?: string[];
        url?: string;
      };
      if (source.tiles) {
        source.tiles = source.tiles.map(replace);
      }
      if (source.url && typeof source.url === 'string' && source.url.startsWith('idb://')) {
        source.url = replace(source.url);
      }
    }
  }

  // Convert glyphs
  if (
    converted.glyphs &&
    typeof converted.glyphs === 'string' &&
    converted.glyphs.startsWith('idb://')
  ) {
    converted.glyphs = replace(converted.glyphs);
  }

  // Convert sprite
  if (converted.sprite) {
    if (typeof converted.sprite === 'string' && converted.sprite.startsWith('idb://')) {
      converted.sprite = replace(converted.sprite);
    } else if (Array.isArray(converted.sprite)) {
      // Mapbox v3 may use sprite as an array of { id, url }
      converted.sprite = (converted.sprite as unknown as Array<{ id: string; url: string }>).map(
        entry => {
          if (typeof entry.url === 'string' && entry.url.startsWith('idb://')) {
            return { ...entry, url: replace(entry.url) };
          }
          return entry;
        }
      ) as unknown as string;
    }
  }

  // Convert models. Two shapes in the wild:
  //   - Mapbox Standard: `{ name: "idb://..." }` (string value)
  //   - Older/generic:   `{ name: { uri: "idb://..." } }` (object value)
  if (converted.models) {
    const models = converted.models as Record<string, string | { uri?: string }>;
    for (const modelKey of Object.keys(models)) {
      const value = models[modelKey];
      if (typeof value === 'string') {
        if (value.startsWith('idb://')) {
          models[modelKey] = replace(value);
        }
      } else if (value && typeof value === 'object') {
        if (typeof value.uri === 'string' && value.uri.startsWith('idb://')) {
          value.uri = replace(value.uri);
        }
      }
    }
  }

  return converted;
}
