/**
 * Proxy configuration for handling CORS issues with tile providers
 *
 * Many tile and font providers block cross-origin requests, which prevents
 * direct downloads from the browser. This module provides configuration
 * options for routing requests through a proxy.
 *
 * @example
 * ```ts
 * import { configureProxy, ProxyType } from 'map-gl-offline';
 *
 * // Configure a proxy for fonts (e.g., for CARTO fonts)
 * configureProxy({
 *   fonts: {
 *     'tiles.basemaps.cartocdn.com': '/fonts/carto'
 *   }
 * });
 *
 * // Or use a CORS proxy service
 * configureProxy({
 *   corsProxyUrl: 'https://cors-anywhere.herokuapp.com/'
 * });
 * ```
 */

export interface ProxyConfig {
  /**
   * Custom proxy mappings for font URLs
   * Key: original hostname, Value: proxy path or URL
   */
  fonts?: Record<string, string>;

  /**
   * Custom proxy mappings for tile URLs
   * Key: original hostname, Value: proxy path or URL
   */
  tiles?: Record<string, string>;

  /**
   * Custom proxy mappings for sprite URLs
   * Key: original hostname, Value: proxy path or URL
   */
  sprites?: Record<string, string>;

  /**
   * Generic CORS proxy URL prefix
   * All requests will be prefixed with this URL
   * Example: 'https://cors-anywhere.herokuapp.com/'
   */
  corsProxyUrl?: string;

  /**
   * Whether to enable proxy for all requests (default: false)
   * If false, only configured domains will use proxy
   */
  enableForAll?: boolean;
}

export type ProxyType = 'fonts' | 'tiles' | 'sprites';

// Global proxy configuration
let proxyConfig: ProxyConfig = {};

/**
 * Configure proxy settings for handling CORS issues
 *
 * @example
 * ```ts
 * // Using Vite's dev server proxy (recommended for development)
 * configureProxy({
 *   fonts: {
 *     'tiles.basemaps.cartocdn.com': '/fonts/carto'
 *   },
 *   tiles: {
 *     'tiles-a.basemaps.cartocdn.com': '/tiles/carto-a',
 *     'tiles-b.basemaps.cartocdn.com': '/tiles/carto-b'
 *   }
 * });
 *
 * // Using a CORS proxy service (works in production)
 * configureProxy({
 *   corsProxyUrl: 'https://your-cors-proxy.com/',
 *   enableForAll: true
 * });
 * ```
 */
export function configureProxy(config: ProxyConfig): void {
  proxyConfig = { ...proxyConfig, ...config };
}

/**
 * Get the current proxy configuration
 */
export function getProxyConfig(): ProxyConfig {
  return { ...proxyConfig };
}

/**
 * Reset proxy configuration to defaults
 */
export function resetProxyConfig(): void {
  proxyConfig = {};
}

/**
 * Apply proxy to a URL based on current configuration
 *
 * @param url - The original URL
 * @param type - The type of resource (fonts, tiles, sprites)
 * @returns The proxied URL or original URL if no proxy configured
 */
export function applyProxy(url: string, type: ProxyType): string {
  if (!url) return url;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check for specific hostname mapping
    const typeConfig = proxyConfig[type];
    if (typeConfig && typeConfig[hostname]) {
      const proxyPath = typeConfig[hostname];

      // If proxy path is a full URL, use it as base
      if (proxyPath.startsWith('http://') || proxyPath.startsWith('https://')) {
        return proxyPath + urlObj.pathname + urlObj.search;
      }

      // Otherwise treat as relative path (for Vite proxy)
      return proxyPath + urlObj.pathname + urlObj.search;
    }

    // Check for generic CORS proxy
    if (proxyConfig.corsProxyUrl && proxyConfig.enableForAll) {
      return proxyConfig.corsProxyUrl + url;
    }

    return url;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Check if a URL should be proxied
 */
export function shouldProxy(url: string, type: ProxyType): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check for specific hostname mapping
    const typeConfig = proxyConfig[type];
    if (typeConfig && typeConfig[hostname]) {
      return true;
    }

    // Check for generic CORS proxy
    if (proxyConfig.corsProxyUrl && proxyConfig.enableForAll) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
