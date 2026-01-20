/**
 * Tests for Style Provider Utilities
 */
import {
  detectStyleProvider,
  extractAccessToken,
  requiresAuthentication,
  normalizeStyleUrl,
  processStyleSources,
  validateStyleForProvider,
  getDefaultStyleConfig,
} from '../../src/utils/styleProviderUtils';
import type { BaseStyle } from '../../src/types/style';

describe('styleProviderUtils', () => {
  describe('detectStyleProvider', () => {
    it('should detect Mapbox from URL', () => {
      expect(detectStyleProvider('https://api.mapbox.com/styles/v1/user/style')).toBe('mapbox');
      expect(detectStyleProvider('https://mapbox.com/styles/street')).toBe('mapbox');
    });

    it('should detect MapLibre from URL', () => {
      expect(detectStyleProvider('https://maplibre.org/styles/basic')).toBe('maplibre');
      expect(detectStyleProvider('https://api.maptiler.com/styles/v1/basic')).toBe('maplibre');
      expect(detectStyleProvider('https://tiles.carto.com/styles/voyager')).toBe('maplibre');
    });

    it('should detect Mapbox from style content', () => {
      const style = {
        version: 8,
        owner: 'mapbox',
        sources: {},
        layers: [],
      };
      expect(detectStyleProvider('https://example.com/style.json', style)).toBe('mapbox');
    });

    it('should detect Mapbox from style with draft property', () => {
      const style = {
        version: 8,
        draft: false,
        sources: {},
        layers: [],
      };
      expect(detectStyleProvider('https://example.com/style.json', style)).toBe('mapbox');
    });

    it('should detect Mapbox from style sources', () => {
      const style = {
        version: 8,
        sources: {
          'mapbox-streets': {
            url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json',
          },
        },
        layers: [],
      };
      expect(detectStyleProvider('https://example.com/style.json', style)).toBe('mapbox');
    });

    it('should return auto for unknown providers', () => {
      expect(detectStyleProvider('https://custom.example.com/style.json')).toBe('auto');
    });

    it('should return auto for generic style without identifying features', () => {
      const style = {
        version: 8,
        sources: {
          'osm': {
            type: 'vector',
            tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };
      expect(detectStyleProvider('https://example.com/style.json', style)).toBe('auto');
    });
  });

  describe('extractAccessToken', () => {
    it('should extract access token from URL', () => {
      const url = 'https://api.mapbox.com/styles/v1/user/style?access_token=pk.test123';
      expect(extractAccessToken(url)).toBe('pk.test123');
    });

    it('should return null when no token present', () => {
      const url = 'https://api.mapbox.com/styles/v1/user/style';
      expect(extractAccessToken(url)).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractAccessToken('not-a-url')).toBeNull();
    });

    it('should handle URLs with multiple query params', () => {
      const url = 'https://example.com/style?format=json&access_token=abc123&version=2';
      expect(extractAccessToken(url)).toBe('abc123');
    });
  });

  describe('requiresAuthentication', () => {
    it('should return true for Mapbox URLs', () => {
      expect(requiresAuthentication('https://api.mapbox.com/styles/v1/user/style', 'mapbox')).toBe(true);
    });

    it('should return true for MapTiler URLs', () => {
      expect(requiresAuthentication('https://api.maptiler.com/styles/basic', 'maplibre')).toBe(true);
    });

    it('should return false for generic URLs', () => {
      expect(requiresAuthentication('https://example.com/style.json', 'maplibre')).toBe(false);
      expect(requiresAuthentication('https://tiles.osm.org/style.json', 'auto')).toBe(false);
    });
  });

  describe('normalizeStyleUrl', () => {
    it('should add access token when not present', () => {
      const url = 'https://api.mapbox.com/styles/v1/user/style';
      const normalized = normalizeStyleUrl(url, 'pk.test123');
      expect(normalized).toContain('access_token=pk.test123');
    });

    it('should not duplicate access token', () => {
      const url = 'https://api.mapbox.com/styles/v1/user/style?access_token=existing';
      const normalized = normalizeStyleUrl(url, 'pk.newtoken');
      expect(normalized).toBe(url);
    });

    it('should preserve existing query parameters', () => {
      const url = 'https://example.com/style?format=json';
      const normalized = normalizeStyleUrl(url, 'token123');
      expect(normalized).toContain('format=json');
      expect(normalized).toContain('access_token=token123');
    });

    it('should return original URL for invalid input', () => {
      const invalid = 'not-a-valid-url';
      expect(normalizeStyleUrl(invalid)).toBe(invalid);
    });

    it('should return original URL when no token provided', () => {
      const url = 'https://example.com/style.json';
      expect(normalizeStyleUrl(url)).toBe(url);
    });
  });

  describe('processStyleSources', () => {
    it('should normalize Mapbox source URLs', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'mapbox-streets': {
            type: 'vector',
            url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json',
          },
        },
        layers: [],
      };

      const processed = processStyleSources(style, 'mapbox', 'pk.test123');
      const source = processed.sources['mapbox-streets'] as { url: string };

      expect(source.url).toContain('access_token=pk.test123');
    });

    it('should normalize Mapbox tile URLs', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'mapbox-tiles': {
            type: 'vector',
            tiles: ['https://api.mapbox.com/v4/mapbox.terrain/{z}/{x}/{y}.png'],
          },
        },
        layers: [],
      };

      const processed = processStyleSources(style, 'mapbox', 'pk.test123');
      const source = processed.sources['mapbox-tiles'] as { tiles: string[] };

      expect(source.tiles[0]).toContain('access_token=pk.test123');
    });

    it('should normalize Mapbox sprite URL', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {},
        layers: [],
        sprite: 'https://api.mapbox.com/styles/v1/user/style/sprite',
      };

      const processed = processStyleSources(style, 'mapbox', 'pk.test123');

      expect(processed.sprite).toContain('access_token=pk.test123');
    });

    it('should normalize Mapbox glyph URL', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://api.mapbox.com/fonts/v1/user/{fontstack}/{range}.pbf',
      };

      const processed = processStyleSources(style, 'mapbox', 'pk.test123');

      expect(processed.glyphs).toContain('access_token=pk.test123');
    });

    it('should not modify non-Mapbox URLs', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'osm': {
            type: 'vector',
            tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      const processed = processStyleSources(style, 'mapbox', 'pk.test123');
      const source = processed.sources['osm'] as { tiles: string[] };

      expect(source.tiles[0]).not.toContain('access_token');
    });

    it('should handle MapLibre provider without modifications', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'tiles': {
            type: 'vector',
            tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
          },
        },
        layers: [],
      };

      const processed = processStyleSources(style, 'maplibre');

      expect(processed).toEqual(style);
    });
  });

  describe('validateStyleForProvider', () => {
    it('should return valid for complete style', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'test': { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}.pbf'] },
        },
        layers: [{ id: 'layer1', type: 'fill', source: 'test' }],
      };

      const result = validateStyleForProvider(style, 'auto');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing version', () => {
      const style = {
        version: undefined as unknown as number,
        sources: { test: { type: 'vector' } },
        layers: [{ id: 'layer1' }],
      } as BaseStyle;

      const result = validateStyleForProvider(style, 'auto');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Style is missing version');
    });

    it('should return error for missing sources', () => {
      const style = {
        version: 8,
        sources: {},
        layers: [{ id: 'layer1' }],
      } as BaseStyle;

      const result = validateStyleForProvider(style, 'auto');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Style has no sources');
    });

    it('should return error for missing layers', () => {
      const style = {
        version: 8,
        sources: { test: { type: 'vector' } },
        layers: [],
      } as BaseStyle;

      const result = validateStyleForProvider(style, 'auto');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Style has no layers');
    });

    it('should warn about Mapbox sources without access token', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'mapbox-source': {
            type: 'vector',
            url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json',
          },
        },
        layers: [{ id: 'layer1', type: 'fill', source: 'mapbox-source' }],
      };

      const result = validateStyleForProvider(style, 'mapbox');

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('authentication may be required');
    });

    it('should not warn when access token is present', () => {
      const style: BaseStyle = {
        version: 8,
        sources: {
          'mapbox-source': {
            type: 'vector',
            url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=pk.test',
          },
        },
        layers: [{ id: 'layer1', type: 'fill', source: 'mapbox-source' }],
      };

      const result = validateStyleForProvider(style, 'mapbox');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('getDefaultStyleConfig', () => {
    it('should return Mapbox config', () => {
      const config = getDefaultStyleConfig('mapbox');

      expect(config.requiresAuth).toBe(true);
      expect(config.defaultSources).toContain('mapbox://');
      expect(config.supportedFormats).toContain('mvt');
      expect(config.maxZoom).toBe(22);
    });

    it('should return MapLibre config', () => {
      const config = getDefaultStyleConfig('maplibre');

      expect(config.requiresAuth).toBe(false);
      expect(config.defaultSources).toContain('http://');
      expect(config.supportedFormats).toContain('geojson');
      expect(config.maxZoom).toBe(24);
    });

    it('should return default config for auto', () => {
      const config = getDefaultStyleConfig('auto');

      expect(config.requiresAuth).toBe(false);
      expect(config.maxZoom).toBe(22);
    });
  });
});
