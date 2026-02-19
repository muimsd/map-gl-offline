/**
 * Style Provider Detection and Handling Utilities
 * Supports both Mapbox GL and MapLibre GL styles
 */

import type { BaseStyle, StyleProvider, MapboxGLStyle } from '../types/style';
import { MAPBOX_API } from './constants';

/**
 * Check if a URL uses the mapbox:// protocol
 */
export function isMapboxProtocol(url: string): boolean {
  return url.startsWith(MAPBOX_API.PROTOCOL);
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

  // Strip the protocol prefix
  const path = mapboxUrl.slice(MAPBOX_API.PROTOCOL.length);

  // mapbox://styles/{user}/{id}
  if (path.startsWith('styles/')) {
    const rest = path.slice('styles/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.STYLES_PATH}/${rest}?access_token=${accessToken}`;
  }

  // mapbox://sprites/{user}/{id}
  if (path.startsWith('sprites/')) {
    const rest = path.slice('sprites/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.STYLES_PATH}/${rest}/sprite?access_token=${accessToken}`;
  }

  // mapbox://fonts/{user}/{fontstack}/{range}.pbf
  if (path.startsWith('fonts/')) {
    const rest = path.slice('fonts/'.length);
    return `${MAPBOX_API.BASE_URL}${MAPBOX_API.FONTS_PATH}/${rest}?access_token=${accessToken}`;
  }

  // mapbox://{tileset} (e.g. mapbox://mapbox.mapbox-streets-v8)
  return `${MAPBOX_API.BASE_URL}${MAPBOX_API.TILES_PATH}/${path}.json?access_token=${accessToken}`;
}

/**
 * Detect the style provider based on the style URL or content
 */
export function detectStyleProvider(styleUrl: string, style?: BaseStyle): StyleProvider {
  // Check URL patterns
  if (
    isMapboxProtocol(styleUrl) ||
    styleUrl.includes('mapbox.com') ||
    styleUrl.includes('api.mapbox.com')
  ) {
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
      if (source.url && (source.url.includes('mapbox.com') || isMapboxProtocol(source.url))) {
        return 'mapbox';
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
        if (provider === 'mapbox' && accessToken && tileUrl.includes('mapbox.com')) {
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
      } else if (provider === 'mapbox' && processedStyle.sprite.includes('mapbox.com')) {
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
          } else if (provider === 'mapbox' && entry.url.includes('mapbox.com')) {
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
    } else if (provider === 'mapbox' && processedStyle.glyphs.includes('mapbox.com')) {
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

  // Basic validation
  if (!style.version) {
    errors.push('Style is missing version');
  }

  if (!style.sources || Object.keys(style.sources).length === 0) {
    errors.push('Style has no sources');
  }

  if (!style.layers || style.layers.length === 0) {
    errors.push('Style has no layers');
  }

  // Provider-specific validation
  if (provider === 'mapbox') {
    // Check for Mapbox-specific requirements
    const hasMapboxSources = Object.values(style.sources || {}).some((source: unknown) => {
      const s = source as { url?: string };
      return s.url && s.url.includes('mapbox.com');
    });

    if (hasMapboxSources) {
      // Check if access token might be needed
      const hasAccessToken = Object.values(style.sources || {}).some((source: unknown) => {
        const s = source as { url?: string };
        return s.url && s.url.includes('access_token');
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
