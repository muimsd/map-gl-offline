/**
 * Tests for validation utilities
 */
import {
  validateBounds,
  validateZoomLevels,
  validateRegionOptions,
} from '../../src/utils/validation';

describe('validateBounds', () => {
  it('should accept valid bounds', () => {
    expect(validateBounds([[-122.5, 37.5], [-122.0, 38.0]])).toBe(true);
  });

  it('should accept bounds at coordinate extremes', () => {
    expect(validateBounds([[-180, -90], [180, 90]])).toBe(true);
  });

  it('should accept bounds crossing antimeridian', () => {
    // SW longitude > NE longitude when crossing antimeridian
    expect(validateBounds([[170, 10], [-170, 20]])).toBe(true);
  });

  it('should throw for non-array input', () => {
    expect(() => validateBounds('invalid')).toThrow('Must be array of 2 coordinates');
    expect(() => validateBounds(null)).toThrow('Must be array of 2 coordinates');
    expect(() => validateBounds(undefined)).toThrow('Must be array of 2 coordinates');
  });

  it('should throw for wrong array length', () => {
    expect(() => validateBounds([[0, 0]])).toThrow('Must be array of 2 coordinates');
    expect(() => validateBounds([[0, 0], [1, 1], [2, 2]])).toThrow('Must be array of 2 coordinates');
  });

  it('should throw for invalid coordinate arrays', () => {
    expect(() => validateBounds([0, 1])).toThrow('Each coordinate must be [lng, lat]');
    expect(() => validateBounds([[0], [1, 2]])).toThrow('Each coordinate must be [lng, lat]');
    expect(() => validateBounds([[0, 1, 2], [1, 2]])).toThrow('Each coordinate must be [lng, lat]');
  });

  it('should throw for non-number coordinates', () => {
    expect(() => validateBounds([['a', 1], [2, 3]])).toThrow('Coordinates must be numbers');
    expect(() => validateBounds([[1, null], [2, 3]])).toThrow('Coordinates must be numbers');
  });

  it('should throw for longitude out of range', () => {
    expect(() => validateBounds([[-181, 0], [0, 0]])).toThrow('Longitude must be between -180 and 180');
    expect(() => validateBounds([[0, 0], [181, 0]])).toThrow('Longitude must be between -180 and 180');
  });

  it('should throw for latitude out of range', () => {
    expect(() => validateBounds([[0, -91], [0, 0]])).toThrow('Latitude must be between -90 and 90');
    expect(() => validateBounds([[0, 0], [0, 91]])).toThrow('Latitude must be between -90 and 90');
  });

  it('should throw when SW latitude > NE latitude', () => {
    expect(() => validateBounds([[0, 50], [0, 40]])).toThrow('Southwest latitude must be less than northeast latitude');
  });

  it('should throw for single point bounds', () => {
    expect(() => validateBounds([[0, 0], [0, 0]])).toThrow('Bounds cannot be a single point');
  });
});

describe('validateZoomLevels', () => {
  it('should accept valid zoom levels', () => {
    expect(validateZoomLevels(0, 10)).toBe(true);
    expect(validateZoomLevels(5, 15)).toBe(true);
    expect(validateZoomLevels(0, 24)).toBe(true);
  });

  it('should accept same min and max zoom', () => {
    expect(validateZoomLevels(10, 10)).toBe(true);
  });

  it('should throw for non-number values', () => {
    expect(() => validateZoomLevels('5', 10)).toThrow('Zoom levels must be numbers');
    expect(() => validateZoomLevels(5, '10')).toThrow('Zoom levels must be numbers');
  });

  it('should throw for non-integer values', () => {
    expect(() => validateZoomLevels(5.5, 10)).toThrow('Zoom levels must be integers');
    expect(() => validateZoomLevels(5, 10.5)).toThrow('Zoom levels must be integers');
  });

  it('should throw for values below allowed minimum', () => {
    expect(() => validateZoomLevels(-1, 10)).toThrow('minZoom must be between 0 and 24');
  });

  it('should throw for values above allowed maximum', () => {
    expect(() => validateZoomLevels(0, 25)).toThrow('maxZoom must be between 0 and 24');
  });

  it('should throw when minZoom > maxZoom', () => {
    expect(() => validateZoomLevels(15, 10)).toThrow('minZoom cannot be greater than maxZoom');
  });

  it('should respect custom allowed range', () => {
    expect(validateZoomLevels(2, 8, 2, 8)).toBe(true);
    expect(() => validateZoomLevels(1, 8, 2, 8)).toThrow('minZoom must be between 2 and 8');
    expect(() => validateZoomLevels(2, 9, 2, 8)).toThrow('maxZoom must be between 2 and 8');
  });
});

describe('validateRegionOptions', () => {
  const validOptions = {
    name: 'Test Region',
    styleUrl: 'https://example.com/style.json',
    bounds: [[-122.5, 37.5], [-122.0, 38.0]] as [[number, number], [number, number]],
    minZoom: 0,
    maxZoom: 10,
  };

  it('should accept valid region options', () => {
    expect(validateRegionOptions(validOptions)).toBe(true);
  });

  it('should accept minimal valid options', () => {
    expect(validateRegionOptions({
      name: 'Test',
      styleUrl: 'https://example.com/style.json',
    })).toBe(true);
  });

  it('should throw for non-object input', () => {
    expect(() => validateRegionOptions(null)).toThrow('Region options must be an object');
    expect(() => validateRegionOptions('string')).toThrow('Region options must be an object');
    expect(() => validateRegionOptions(123)).toThrow('Region options must be an object');
  });

  it('should throw for missing name', () => {
    expect(() => validateRegionOptions({ styleUrl: 'https://example.com' })).toThrow('Region name is required');
  });

  it('should throw for empty name', () => {
    expect(() => validateRegionOptions({ name: '', styleUrl: 'https://example.com' })).toThrow('Region name is required');
    expect(() => validateRegionOptions({ name: '   ', styleUrl: 'https://example.com' })).toThrow('Region name is required');
  });

  it('should throw for missing styleUrl', () => {
    expect(() => validateRegionOptions({ name: 'Test' })).toThrow();
  });

  it('should validate bounds if provided', () => {
    expect(() => validateRegionOptions({
      ...validOptions,
      bounds: 'invalid',
    })).toThrow();
  });

  it('should validate zoom levels if provided', () => {
    expect(() => validateRegionOptions({
      ...validOptions,
      minZoom: 15,
      maxZoom: 10,
    })).toThrow('minZoom cannot be greater than maxZoom');
  });
});

