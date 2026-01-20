/**
 * Tests for tile key utilities
 */
import { createTileKey, parseTileKey, deriveTileExtension } from '../../src/utils/tileKey';

describe('createTileKey', () => {
  it('should create a tile key in the correct format', () => {
    const key = createTileKey(1234, 5678, 12, 'voyager', 'carto', 'pbf');
    expect(key).toBe('voyager:carto:12:1234:5678.pbf');
  });

  it('should handle zero values', () => {
    const key = createTileKey(0, 0, 0, 'style', 'source', 'mvt');
    expect(key).toBe('style:source:0:0:0.mvt');
  });

  it('should handle various extensions', () => {
    expect(createTileKey(1, 2, 3, 's', 'src', 'png')).toBe('s:src:3:1:2.png');
    expect(createTileKey(1, 2, 3, 's', 'src', 'jpg')).toBe('s:src:3:1:2.jpg');
    expect(createTileKey(1, 2, 3, 's', 'src', 'webp')).toBe('s:src:3:1:2.webp');
  });

  it('should handle special characters in IDs', () => {
    const key = createTileKey(1, 2, 3, 'style-id_test', 'source-name', 'pbf');
    expect(key).toBe('style-id_test:source-name:3:1:2.pbf');
  });

  it('should handle large coordinate values', () => {
    const key = createTileKey(262143, 262143, 18, 'style', 'source', 'pbf');
    expect(key).toBe('style:source:18:262143:262143.pbf');
  });
});

describe('parseTileKey', () => {
  it('should parse a valid tile key', () => {
    const result = parseTileKey('voyager:carto:12:1234:5678.pbf');
    expect(result).toEqual({
      styleId: 'voyager',
      sourceId: 'carto',
      z: 12,
      x: 1234,
      y: 5678,
      ext: 'pbf',
    });
  });

  it('should parse keys with zero values', () => {
    const result = parseTileKey('style:source:0:0:0.mvt');
    expect(result).toEqual({
      styleId: 'style',
      sourceId: 'source',
      z: 0,
      x: 0,
      y: 0,
      ext: 'mvt',
    });
  });

  it('should handle various extensions', () => {
    expect(parseTileKey('s:src:3:1:2.png')?.ext).toBe('png');
    expect(parseTileKey('s:src:3:1:2.jpg')?.ext).toBe('jpg');
    expect(parseTileKey('s:src:3:1:2.webp')?.ext).toBe('webp');
  });

  it('should handle special characters in IDs', () => {
    const result = parseTileKey('style-id_test:source-name:3:1:2.pbf');
    expect(result?.styleId).toBe('style-id_test');
    expect(result?.sourceId).toBe('source-name');
  });

  it('should return null for invalid key with too few parts', () => {
    expect(parseTileKey('style:source:12:1234')).toBeNull();
    expect(parseTileKey('invalid:key')).toBeNull();
    expect(parseTileKey('single')).toBeNull();
    expect(parseTileKey('')).toBeNull();
  });

  it('should return null for key without extension', () => {
    expect(parseTileKey('style:source:12:1234:5678')).toBeNull();
  });

  it('should return null for non-numeric coordinates', () => {
    expect(parseTileKey('style:source:abc:1234:5678.pbf')).toBeNull();
    expect(parseTileKey('style:source:12:abc:5678.pbf')).toBeNull();
    expect(parseTileKey('style:source:12:1234:abc.pbf')).toBeNull();
  });

  it('should roundtrip with createTileKey', () => {
    const original = { x: 1234, y: 5678, z: 12, styleId: 'voyager', sourceId: 'carto', ext: 'pbf' };
    const key = createTileKey(original.x, original.y, original.z, original.styleId, original.sourceId, original.ext);
    const parsed = parseTileKey(key);
    expect(parsed).toEqual(original);
  });
});

describe('deriveTileExtension', () => {
  it('should extract extension from tile URL template', () => {
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.pbf'])).toBe('pbf');
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.png'])).toBe('png');
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.mvt'])).toBe('mvt');
  });

  it('should handle URLs with query parameters', () => {
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.pbf?key=abc'])).toBe('pbf');
  });

  it('should use first tile URL if multiple provided', () => {
    expect(deriveTileExtension([
      'https://a.example.com/tiles/{z}/{x}/{y}.png',
      'https://b.example.com/tiles/{z}/{x}/{y}.png',
    ])).toBe('png');
  });

  it('should return default "pbf" for undefined input', () => {
    expect(deriveTileExtension(undefined)).toBe('pbf');
  });

  it('should return default "pbf" for empty array', () => {
    expect(deriveTileExtension([])).toBe('pbf');
  });

  it('should return default "pbf" for non-string array elements', () => {
    expect(deriveTileExtension([123])).toBe('pbf');
    expect(deriveTileExtension([null])).toBe('pbf');
  });

  it('should return default "pbf" for URLs without recognizable extension', () => {
    expect(deriveTileExtension(['https://example.com/tiles/'])).toBe('pbf');
  });

  it('should handle case-insensitive extensions', () => {
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.PNG'])).toBe('PNG');
    expect(deriveTileExtension(['https://example.com/tiles/{z}/{x}/{y}.Pbf'])).toBe('Pbf');
  });
});
