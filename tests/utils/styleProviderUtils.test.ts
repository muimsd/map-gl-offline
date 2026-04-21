/**
 * Tests for Style Provider Utilities
 */
import {
  detectStyleProvider,
  extractAccessToken,
  normalizeStyleUrl,
  processStyleSources,
  validateStyleForProvider,
  rewriteMapboxCdnTileUrl,
  isMapboxProtocol,
  resolveMapboxUrl,
} from '../../src/utils/styleProviderUtils';
import type { BaseStyle } from '../../src/types/style';

describe('isMapboxProtocol', () => {
  it('returns true for mapbox:// URLs', () => {
    expect(isMapboxProtocol('mapbox://styles/mapbox/standard')).toBe(true);
    expect(isMapboxProtocol('mapbox://mapbox.mapbox-streets-v8')).toBe(true);
    expect(isMapboxProtocol('mapbox://sprites/mapbox/standard/abc')).toBe(true);
    expect(isMapboxProtocol('mapbox://fonts/mapbox/DIN/0-255.pbf')).toBe(true);
    expect(isMapboxProtocol('mapbox://models/mapbox/maple1.glb')).toBe(true);
  });
  it('returns false for non-mapbox URLs', () => {
    expect(isMapboxProtocol('https://api.mapbox.com/styles/v1/mapbox/standard')).toBe(false);
    expect(isMapboxProtocol('idb://styleId/tile/x/1/2/3.pbf')).toBe(false);
    expect(isMapboxProtocol('https://example.com/style.json')).toBe(false);
    expect(isMapboxProtocol('')).toBe(false);
  });
});

describe('resolveMapboxUrl', () => {
  const token = 'pk.test-token';

  it('returns non-mapbox URLs unchanged', () => {
    expect(resolveMapboxUrl('https://example.com/style.json', token)).toBe(
      'https://example.com/style.json'
    );
  });

  it('throws when the URL is mapbox:// but no access token is provided', () => {
    expect(() => resolveMapboxUrl('mapbox://styles/mapbox/standard', '')).toThrow(
      /access token/i
    );
  });

  it('resolves mapbox://styles/{user}/{id} to /styles/v1/…', () => {
    const url = resolveMapboxUrl('mapbox://styles/mapbox/standard', token);
    expect(url).toBe(`https://api.mapbox.com/styles/v1/mapbox/standard?access_token=${token}`);
  });

  it('resolves mapbox://sprites/{user}/{id}[/hash] to /styles/v1/.../sprite', () => {
    const url = resolveMapboxUrl('mapbox://sprites/mapbox/standard/00kxhqqddcml91u4n6ur3drf3', token);
    expect(url).toBe(
      `https://api.mapbox.com/styles/v1/mapbox/standard/00kxhqqddcml91u4n6ur3drf3/sprite?access_token=${token}`
    );
  });

  it('resolves mapbox://fonts/{user}/{fontstack}/{range}.pbf to /fonts/v1/…', () => {
    const url = resolveMapboxUrl('mapbox://fonts/mapbox/DIN%20Pro%20Bold/0-255.pbf', token);
    expect(url).toBe(
      `https://api.mapbox.com/fonts/v1/mapbox/DIN%20Pro%20Bold/0-255.pbf?access_token=${token}`
    );
  });

  it('resolves mapbox://models/{path}.glb to /models/v1/…', () => {
    const url = resolveMapboxUrl('mapbox://models/mapbox/maple1-v4-lod1.glb', token);
    expect(url).toBe(
      `https://api.mapbox.com/models/v1/mapbox/maple1-v4-lod1.glb?access_token=${token}`
    );
  });

  it('resolves mapbox://{tileset} to /v4/{tileset}.json', () => {
    const url = resolveMapboxUrl('mapbox://mapbox.mapbox-streets-v8', token);
    expect(url).toBe(
      `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=${token}`
    );
  });

  it('resolves composite mapbox://{a,b,c} tileset URLs', () => {
    const url = resolveMapboxUrl(
      'mapbox://mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8-lite',
      token
    );
    expect(url).toBe(
      `https://api.mapbox.com/v4/mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8-lite.json?access_token=${token}`
    );
  });
});

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

  describe('rewriteMapboxCdnTileUrl', () => {
    it('should rewrite raster/v1 CDN URLs to v4 API URLs', () => {
      const cdnUrl =
        'https://a.tiles.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=pk.test';
      const result = rewriteMapboxCdnTileUrl(cdnUrl);
      expect(result).toBe(
        'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=pk.test'
      );
    });

    it('should rewrite subdomain b CDN URLs', () => {
      const cdnUrl =
        'https://b.tiles.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=pk.test';
      const result = rewriteMapboxCdnTileUrl(cdnUrl);
      expect(result).toBe(
        'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png?access_token=pk.test'
      );
    });

    it('should not rewrite v4 CDN URLs (they already work)', () => {
      const cdnUrl =
        'https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=pk.test';
      expect(rewriteMapboxCdnTileUrl(cdnUrl)).toBe(cdnUrl);
    });

    it('should not rewrite non-Mapbox URLs', () => {
      const otherUrl = 'https://tiles.example.com/raster/v1/{z}/{x}/{y}.png';
      expect(rewriteMapboxCdnTileUrl(otherUrl)).toBe(otherUrl);
    });

    it('should not rewrite 3dtiles CDN URLs', () => {
      const cdnUrl =
        'https://a.tiles.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/{z}/{x}/{y}.glb?access_token=pk.test';
      expect(rewriteMapboxCdnTileUrl(cdnUrl)).toBe(cdnUrl);
    });

    it('should handle URLs without query parameters', () => {
      const cdnUrl =
        'https://a.tiles.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png';
      const result = rewriteMapboxCdnTileUrl(cdnUrl);
      expect(result).toBe(
        'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.png'
      );
    });
  });

});
