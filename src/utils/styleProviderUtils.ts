/**
 * Style Provider Detection and Handling Utilities
 * Supports both Mapbox GL and MapLibre GL styles
 */

import type { BaseStyle, StyleProvider, MapboxGLStyle } from '@/types/style';
import { MAPBOX_API } from './constants';

/**
 * Check if a URL uses the mapbox:// protocol
 */
export function isMapboxProtocol(url: string): boolean {
  return url.startsWith(MAPBOX_API.PROTOCOL);
}

/**
 * Parse a URL and return its hostname, or null if the URL is malformed.
 * Accepts relative URLs when `base` is provided.
 */
export function getUrlHostname(url: string, base?: string): string | null {
  try {
    return new URL(url, base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True if `url`'s hostname equals `host` or is a subdomain of `host`.
 * Uses URL parsing (not substring matching) to avoid false positives like
 * `https://evil.com/?x=mapbox.com` matching `mapbox.com`.
 */
export function hostMatches(url: string, host: string, base?: string): boolean {
  const hostname = getUrlHostname(url, base);
  if (hostname === null) return false;
  const target = host.toLowerCase();
  return hostname === target || hostname.endsWith('.' + target);
}

/**
 * True for any host under the mapbox.com domain (including api.mapbox.com,
 * *.tiles.mapbox.com, etc.). Used by provider detection.
 */
export function isMapboxHost(url: string, base?: string): boolean {
  return hostMatches(url, 'mapbox.com', base);
}

/**
 * Resolve a mapbox:// URL to its HTTPS API equivalent
 *
 * Supported patterns:
 * - mapbox://styles/{user}/{id} -> https://api.mapbox.com/styles/v1/{user}/{id}?access_token={token}
 * - mapbox://{tileset} (e.g. mapbox://mapbox.mapbox-streets-v8) -> https://api.mapbox.com/v4/{tileset}.json?access_token={token}
 * - mapbox://sprites/{user}/{id} -> https://api.mapbox.com/styles/v1/{user}/{id}/sprite?access_token={token}
 * - mapbox://fonts/{user}/{fontstack}/{range}.pbf -> https://api.mapbox.com/fonts/v1/{user}/{fontstack}/{range}.pbf?access_token={token}
 */
export function resolveMapboxUrl(mapboxUrl: string, accessToken: string): string {
  if (!isMapboxProtocol(mapboxUrl)) {
    return mapboxUrl;
  }

  if (!accessToken) {
    throw new Error(`Mapbox access token is required to resolve mapbox:// URL: ${mapboxUrl}`);
  }

  // Strip the protocol prefix, and split off any query so path matching and
  // the resolved URL's suffixes (`.json`, `/sprite`) go before it. Existing
  // parameters are kept; `access_token` is set exactly once.
  const withoutProtocol = mapboxUrl.slice(MAPBOX_API.PROTOCOL.length);
  const queryIndex = withoutProtocol.indexOf('?');
  const path = queryIndex === -1 ? withoutProtocol : withoutProtocol.slice(0, queryIndex);
  const params = new URLSearchParams(
    queryIndex === -1 ? '' : withoutProtocol.slice(queryIndex + 1)
  );
  params.set('access_token', accessToken);
  const query = `?${params.toString()}`;

  // mapbox://styles/{user}/{id}
  if (path.startsWith('styles/')) {
    const rest = path.slice('styles/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.STYLES_PATH}/${rest}${query}`;
  }

  // mapbox://sprites/{user}/{id}
  if (path.startsWith('sprites/')) {
    const rest = path.slice('sprites/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.STYLES_PATH}/${rest}/sprite${query}`;
  }

  // mapbox://fonts/{user}/{fontstack}/{range}.pbf
  if (path.startsWith('fonts/')) {
    const rest = path.slice('fonts/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.FONTS_PATH}/${rest}${query}`;
  }

  // mapbox://models/{path}
  if (path.startsWith('models/')) {
    const rest = path.slice('models/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.MODELS_PATH}/${rest}${query}`;
  }

  // mapbox://{tileset} (e.g. mapbox://mapbox.mapbox-streets-v8)
  return `${MAPBOX_API.BASE_URL}${MAPBOX_API.TILES_PATH}/${path}.json${query}`;
}

const SKU_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SKU_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let skuSession: { token: string; expiresAt: number } | undefined;

/** A Mapbox session token in the format Mapbox GL JS generates: version + SKU id + 10 random. */
function getSkuToken(): string {
  if (!skuSession || Date.now() > skuSession.expiresAt) {
    let randomizer = '';
    for (let i = 0; i < 10; i++) {
      randomizer += SKU_CHARS[Math.floor(Math.random() * SKU_CHARS.length)];
    }
    skuSession = { token: `101${randomizer}`, expiresAt: Date.now() + SKU_LIFETIME_MS };
  }
  return skuSession.token;
}

/**
 * Add the `sku` session token that Mapbox `/raster/v1/` tile URLs need.
 *
 * TileJSON returns these URLs without one, and without it they 401. Mapbox GL
 * adds it at request time, but this library fetches tiles itself.
 *
 * Don't switch these to the `/v4/` endpoint, which needs no token: it serves a
 * different tile. For `mapbox.mapbox-terrain-dem-v1`, `/v4/….png` is a 256px
 * palette PNG with elevations off by up to ~200 m, while the renderer expects
 * the 514px RGB tile (`tileSize: 514`) that `/raster/v1/` returns.
 *
 * Example:
 *   https://a.tiles.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=...
 *   -> https://a.tiles.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=...&sku=101...
 */
export function rewriteMapboxCdnTileUrl(tileUrl: string): string {
  if (!/^https?:\/\/(?:[a-z]\.tiles\.mapbox\.com|api\.mapbox\.com)\/raster\/v1\//.test(tileUrl)) {
    return tileUrl;
  }
  if (/[?&]sku=/.test(tileUrl)) {
    return tileUrl;
  }
  return `${tileUrl}${tileUrl.includes('?') ? '&' : '?'}sku=${getSkuToken()}`;
}

/**
 * Detect the style provider based on the style URL or content
 */
export function detectStyleProvider(styleUrl: string, style?: BaseStyle): StyleProvider {
  // Check URL patterns
  if (isMapboxProtocol(styleUrl) || isMapboxHost(styleUrl)) {
    return 'mapbox';
  }

  if (
    styleUrl.includes('maplibre') ||
    styleUrl.includes('maptiler') ||
    styleUrl.includes('carto')
  ) {
    return 'maplibre';
  }

  // Check style content if available
  if (style) {
    // Check for Mapbox-specific properties
    const mapboxStyle = style as MapboxGLStyle;
    if (mapboxStyle.owner || mapboxStyle.draft !== undefined || mapboxStyle.visibility) {
      return 'mapbox';
    }

    // Check sources for Mapbox-specific patterns
    const sources = style.sources || {};
    for (const [, sourceConfig] of Object.entries(sources)) {
      const source = sourceConfig as { url?: string };
      if (source.url && (isMapboxProtocol(source.url) || isMapboxHost(source.url))) {
        return 'mapbox';
      }
    }

    // Check imports for mapbox:// protocol
    if (Array.isArray(style.imports)) {
      for (const imp of style.imports as Array<{ url?: string }>) {
        if (typeof imp.url === 'string' && isMapboxProtocol(imp.url)) {
          return 'mapbox';
        }
      }
    }

    // Check sprite/glyphs for mapbox:// protocol
    if (typeof style.glyphs === 'string' && isMapboxProtocol(style.glyphs)) {
      return 'mapbox';
    }
    if (typeof style.sprite === 'string' && isMapboxProtocol(style.sprite)) {
      return 'mapbox';
    }
    // Array sprite format: check each entry
    if (Array.isArray(style.sprite)) {
      for (const entry of style.sprite as Array<{ url?: string }>) {
        if (typeof entry.url === 'string' && isMapboxProtocol(entry.url)) {
          return 'mapbox';
        }
      }
    }
  }

  // Default to auto-detection
  return 'auto';
}

/**
 * Extract access token from Mapbox style URL
 */
export function extractAccessToken(styleUrl: string): string | null {
  try {
    const url = new URL(styleUrl);
    return url.searchParams.get('access_token');
  } catch {
    return null;
  }
}

/**
 * Normalize style URL for consistent processing
 */
export function normalizeStyleUrl(styleUrl: string, accessToken?: string): string {
  // Resolve mapbox:// protocol URLs first
  if (isMapboxProtocol(styleUrl)) {
    if (!accessToken) {
      throw new Error(`Mapbox access token is required for mapbox:// URL: ${styleUrl}`);
    }
    return resolveMapboxUrl(styleUrl, accessToken);
  }

  try {
    const url = new URL(styleUrl);

    // Add access token if required and not present
    if (accessToken && !url.searchParams.has('access_token')) {
      url.searchParams.set('access_token', accessToken);
    }

    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return styleUrl;
  }
}

/**
 * Process style sources for offline compatibility
 */
export function processStyleSources(
  style: BaseStyle,
  provider: StyleProvider,
  accessToken?: string
): BaseStyle {
  const processedStyle = { ...style };
  const sources = { ...style.sources };

  for (const [sourceId, sourceConfig] of Object.entries(sources)) {
    const source = sourceConfig
      ? ({ ...(sourceConfig as Record<string, unknown>) } as Record<string, unknown>)
      : {};

    // Handle Mapbox-specific source URLs (including mapbox:// protocol)
    if (source.url && typeof source.url === 'string') {
      if (isMapboxProtocol(source.url as string) && accessToken) {
        source.url = resolveMapboxUrl(source.url as string, accessToken);
      } else if (provider === 'mapbox' && accessToken) {
        source.url = normalizeStyleUrl(source.url as string, accessToken);
      }
    }

    // Handle tile URLs
    if (source.tiles && Array.isArray(source.tiles)) {
      source.tiles = source.tiles.map((tileUrl: string) => {
        if (isMapboxProtocol(tileUrl) && accessToken) {
          return resolveMapboxUrl(tileUrl, accessToken);
        }
        if (provider === 'mapbox' && accessToken && isMapboxHost(tileUrl)) {
          return normalizeStyleUrl(tileUrl, accessToken);
        }
        return tileUrl;
      });
    }

    sources[sourceId] = source;
  }

  processedStyle.sources = sources;

  // Handle sprite URLs (string or array format)
  if (processedStyle.sprite && accessToken) {
    if (typeof processedStyle.sprite === 'string') {
      if (isMapboxProtocol(processedStyle.sprite)) {
        processedStyle.sprite = resolveMapboxUrl(processedStyle.sprite, accessToken);
      } else if (provider === 'mapbox' && isMapboxHost(processedStyle.sprite)) {
        processedStyle.sprite = normalizeStyleUrl(processedStyle.sprite, accessToken);
      }
    } else if (Array.isArray(processedStyle.sprite)) {
      // Resolve mapbox:// URLs in each array entry
      (processedStyle as Record<string, unknown>).sprite = (
        processedStyle.sprite as unknown as Array<{ id: string; url: string }>
      ).map(entry => {
        if (typeof entry.url === 'string') {
          if (isMapboxProtocol(entry.url)) {
            return { ...entry, url: resolveMapboxUrl(entry.url, accessToken) };
          } else if (provider === 'mapbox' && isMapboxHost(entry.url)) {
            return { ...entry, url: normalizeStyleUrl(entry.url, accessToken) };
          }
        }
        return entry;
      });
    }
  }

  // Handle glyph URLs
  if (processedStyle.glyphs && typeof processedStyle.glyphs === 'string' && accessToken) {
    if (isMapboxProtocol(processedStyle.glyphs)) {
      processedStyle.glyphs = resolveMapboxUrl(processedStyle.glyphs, accessToken);
    } else if (provider === 'mapbox' && isMapboxHost(processedStyle.glyphs)) {
      processedStyle.glyphs = normalizeStyleUrl(processedStyle.glyphs, accessToken);
    }
  }

  return processedStyle;
}

/**
 * Enhanced style validation for different providers
 */
export function validateStyleForProvider(
  style: BaseStyle,
  provider: StyleProvider
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Import-based styles may have empty sources/layers before resolution
  const usesImports =
    Array.isArray((style as Record<string, unknown>).imports) &&
    ((style as Record<string, unknown>).imports as unknown[]).length > 0;

  // Basic validation
  if (!style.version) {
    errors.push('Style is missing version');
  }

  if (!style.sources || Object.keys(style.sources).length === 0) {
    if (usesImports) {
      warnings.push('Style has no sources (uses imports — sources will be resolved)');
    } else {
      errors.push('Style has no sources');
    }
  }

  if (!style.layers || style.layers.length === 0) {
    if (usesImports) {
      warnings.push('Style has no layers (uses imports — layers will be resolved)');
    } else {
      errors.push('Style has no layers');
    }
  }

  // Provider-specific validation
  if (provider === 'mapbox') {
    // Check for Mapbox-specific requirements
    const hasMapboxSources = Object.values(style.sources || {}).some((source: unknown) => {
      const s = source as { url?: string };
      return !!s.url && isMapboxHost(s.url);
    });

    if (hasMapboxSources) {
      // Check if access token might be needed
      const hasAccessToken = Object.values(style.sources || {}).some((source: unknown) => {
        const s = source as { url?: string };
        if (!s.url) return false;
        try {
          return new URL(s.url).searchParams.has('access_token');
        } catch {
          return false;
        }
      });

      if (!hasAccessToken) {
        warnings.push(
          'Mapbox sources detected but no access token found - authentication may be required'
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
