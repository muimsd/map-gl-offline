/**
 * Tests for proxy configuration utilities
 */
import {
  configureProxy,
  applyProxy,
} from '../../src/utils/proxyConfig';

describe('proxyConfig', () => {
  describe('configureProxy', () => {
    it('should set proxy configuration', () => {
      configureProxy({
        fonts: { 'example.com': '/proxy/fonts' },
      });

      // Verify via applyProxy behavior
      expect(applyProxy('https://example.com/font.pbf', 'fonts')).toBe('/proxy/fonts/font.pbf');
    });

    it('should merge configurations', () => {
      configureProxy({
        fonts: { 'fonts.example.com': '/fonts' },
      });
      configureProxy({
        tiles: { 'tiles.example.com': '/tiles' },
      });

      expect(applyProxy('https://fonts.example.com/font.pbf', 'fonts')).toBe('/fonts/font.pbf');
      expect(applyProxy('https://tiles.example.com/tile.pbf', 'tiles')).toBe('/tiles/tile.pbf');
    });

    it('should override existing keys', () => {
      configureProxy({
        fonts: { 'example.com': '/old' },
      });
      configureProxy({
        fonts: { 'example.com': '/new' },
      });

      expect(applyProxy('https://example.com/font.pbf', 'fonts')).toBe('/new/font.pbf');
    });
  });

  describe('applyProxy', () => {
    it('should return original URL if no proxy configured for hostname', () => {
      const url = 'https://unknown-host.com/tiles/0/0/0.pbf';
      expect(applyProxy(url, 'tiles')).toBe(url);
    });

    it('should apply hostname-specific proxy with relative path', () => {
      configureProxy({
        tiles: { 'tiles.example.com': '/proxy/tiles' },
      });

      const result = applyProxy('https://tiles.example.com/path/to/tile.pbf', 'tiles');
      expect(result).toBe('/proxy/tiles/path/to/tile.pbf');
    });

    it('should apply hostname-specific proxy with absolute URL', () => {
      configureProxy({
        tiles: { 'tiles.example.com': 'https://proxy.com/tiles' },
      });

      const result = applyProxy('https://tiles.example.com/path/tile.pbf', 'tiles');
      expect(result).toBe('https://proxy.com/tiles/path/tile.pbf');
    });

    it('should preserve query parameters', () => {
      configureProxy({
        tiles: { 'tiles.example.com': '/proxy' },
      });

      const result = applyProxy('https://tiles.example.com/tile.pbf?key=abc', 'tiles');
      expect(result).toBe('/proxy/tile.pbf?key=abc');
    });

    it('should apply CORS proxy when enableForAll is true', () => {
      configureProxy({
        corsProxyUrl: 'https://cors-proxy.com/',
        enableForAll: true,
      });

      const url = 'https://example.com/tile.pbf';
      const result = applyProxy(url, 'tiles');
      expect(result).toBe('https://cors-proxy.com/https://example.com/tile.pbf');
    });

    it('should not apply CORS proxy when enableForAll is false', () => {
      configureProxy({
        corsProxyUrl: 'https://cors-proxy.com/',
        enableForAll: false,
      });

      const url = 'https://no-proxy-configured.com/tile.pbf';
      expect(applyProxy(url, 'tiles')).toBe(url);
    });

    it('should prefer hostname-specific proxy over CORS proxy', () => {
      configureProxy({
        tiles: { 'tiles.example.com': '/local-proxy' },
        corsProxyUrl: 'https://cors-proxy.com/',
        enableForAll: true,
      });

      const result = applyProxy('https://tiles.example.com/tile.pbf', 'tiles');
      expect(result).toBe('/local-proxy/tile.pbf');
    });

    it('should return original URL for empty input', () => {
      expect(applyProxy('', 'tiles')).toBe('');
    });

    it('should return original URL for invalid URL', () => {
      expect(applyProxy('not-a-url', 'tiles')).toBe('not-a-url');
    });

    it('should work with different resource types', () => {
      configureProxy({
        fonts: { 'fonts.example.com': '/fonts-proxy' },
        tiles: { 'tiles.example.com': '/tiles-proxy' },
        sprites: { 'sprites.example.com': '/sprites-proxy' },
      });

      expect(applyProxy('https://fonts.example.com/font.pbf', 'fonts')).toBe('/fonts-proxy/font.pbf');
      expect(applyProxy('https://tiles.example.com/tile.pbf', 'tiles')).toBe('/tiles-proxy/tile.pbf');
      expect(applyProxy('https://sprites.example.com/sprite.png', 'sprites')).toBe('/sprites-proxy/sprite.png');
    });
  });
});
