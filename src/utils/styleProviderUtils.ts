/**
 * Style Provider Detection and Handling Utilities
 * Supports both Mapbox GL and MapLibre GL styles
 */

import type { BaseStyle, StyleProvider, MapboxGLStyle } from '../types/style';

/**
 * Detect the style provider based on the style URL or content
 */
export function detectStyleProvider(styleUrl: string, style?: BaseStyle): StyleProvider {
  // Check URL patterns
  if (styleUrl.includes('mapbox.com') || styleUrl.includes('api.mapbox.com')) {
    return 'mapbox';
  }
  
  if (styleUrl.includes('maplibre') || styleUrl.includes('maptiler') || styleUrl.includes('carto')) {
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
    for (const [sourceId, sourceConfig] of Object.entries(sources)) {
      const source = sourceConfig as any;
      if (source.url && source.url.includes('mapbox.com')) {
        return 'mapbox';
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
 * Validate if a style URL requires authentication
 */
export function requiresAuthentication(styleUrl: string, provider: StyleProvider): boolean {
  if (provider === 'mapbox') {
    // Mapbox styles typically require access tokens
    return styleUrl.includes('mapbox.com');
  }
  
  // Check for other providers that might require tokens
  if (styleUrl.includes('api.maptiler.com')) {
    return true;
  }
  
  return false;
}

/**
 * Normalize style URL for consistent processing
 */
export function normalizeStyleUrl(styleUrl: string, accessToken?: string): string {
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
    const source = sourceConfig ? { ...(sourceConfig as object) } as any : {};
    
    // Handle Mapbox-specific source URLs
    if (provider === 'mapbox' && source.url) {
      source.url = normalizeStyleUrl(source.url, accessToken);
    }
    
    // Handle tile URLs
    if (source.tiles && Array.isArray(source.tiles)) {
      source.tiles = source.tiles.map((tileUrl: string) => {
        if (provider === 'mapbox' && accessToken && tileUrl.includes('mapbox.com')) {
          return normalizeStyleUrl(tileUrl, accessToken);
        }
        return tileUrl;
      });
    }
    
    sources[sourceId] = source;
  }
  
  processedStyle.sources = sources;
  
  // Handle sprite URLs
  if (processedStyle.sprite && provider === 'mapbox' && accessToken) {
    if (typeof processedStyle.sprite === 'string' && processedStyle.sprite.includes('mapbox.com')) {
      processedStyle.sprite = normalizeStyleUrl(processedStyle.sprite, accessToken);
    }
  }
  
  // Handle glyph URLs
  if (processedStyle.glyphs && provider === 'mapbox' && accessToken) {
    if (typeof processedStyle.glyphs === 'string' && processedStyle.glyphs.includes('mapbox.com')) {
      processedStyle.glyphs = normalizeStyleUrl(processedStyle.glyphs, accessToken);
    }
  }
  
  return processedStyle;
}

/**
 * Enhanced style validation for different providers
 */
export function validateStyleForProvider(style: BaseStyle, provider: StyleProvider): {
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
    const hasMapboxSources = Object.values(style.sources || {}).some((source: any) => 
      source.url && source.url.includes('mapbox.com')
    );
    
    if (hasMapboxSources) {
      // Check if access token might be needed
      const hasAccessToken = Object.values(style.sources || {}).some((source: any) => 
        source.url && source.url.includes('access_token')
      );
      
      if (!hasAccessToken) {
        warnings.push('Mapbox sources detected but no access token found - authentication may be required');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default style configuration for a provider
 */
export function getDefaultStyleConfig(provider: StyleProvider) {
  switch (provider) {
    case 'mapbox':
      return {
        requiresAuth: true,
        defaultSources: ['mapbox://'],
        supportedFormats: ['mvt', 'raster'],
        maxZoom: 22
      };
    
    case 'maplibre':
      return {
        requiresAuth: false,
        defaultSources: ['http://', 'https://'],
        supportedFormats: ['mvt', 'raster', 'geojson'],
        maxZoom: 24
      };
    
    default:
      return {
        requiresAuth: false,
        defaultSources: ['http://', 'https://'],
        supportedFormats: ['mvt', 'raster', 'geojson'],
        maxZoom: 22
      };
  }
}
