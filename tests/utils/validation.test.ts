/**
 * Tests for validation utilities
 */
import {
  validateBounds,
  validateZoomLevels,
  validateRegionOptions,
  validateStyleUrl,
  validateRegionId,
  validateBatchSize,
  validateTimeout,
  safeValidate,
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

describe('validateStyleUrl', () => {
  it('should accept HTTPS URLs', () => {
    expect(validateStyleUrl('https://example.com/style.json')).toBe(true);
  });

  it('should accept HTTP URLs', () => {
    expect(validateStyleUrl('http://example.com/style.json')).toBe(true);
  });

  it('should accept Mapbox style URLs', () => {
    expect(validateStyleUrl('mapbox://styles/mapbox/streets-v11')).toBe(true);
  });

  it('should accept local paths', () => {
    expect(validateStyleUrl('/styles/local.json')).toBe(true);
    expect(validateStyleUrl('./styles/local.json')).toBe(true);
  });

  it('should throw for non-string input', () => {
    expect(() => validateStyleUrl(123)).toThrow('Style URL must be a non-empty string');
    expect(() => validateStyleUrl(null)).toThrow('Style URL must be a non-empty string');
  });

  it('should throw for empty string', () => {
    expect(() => validateStyleUrl('')).toThrow('Style URL must be a non-empty string');
    expect(() => validateStyleUrl('   ')).toThrow('Style URL must be a non-empty string');
  });

  it('should throw for invalid URL schemes', () => {
    expect(() => validateStyleUrl('ftp://example.com/style.json')).toThrow('must be a valid HTTP(S) URL');
    expect(() => validateStyleUrl('file://styles/local.json')).toThrow('must be a valid HTTP(S) URL');
    expect(() => validateStyleUrl('invalid-url')).toThrow('must be a valid HTTP(S) URL');
  });
});

describe('validateRegionId', () => {
  it('should accept valid region IDs', () => {
    expect(validateRegionId('region_123')).toBe(true);
    expect(validateRegionId('my-region')).toBe(true);
    expect(validateRegionId('test_region_abc')).toBe(true);
  });

  it('should throw for non-string input', () => {
    expect(() => validateRegionId(123)).toThrow('Region ID must be a non-empty string');
    expect(() => validateRegionId(null)).toThrow('Region ID must be a non-empty string');
  });

  it('should throw for empty string', () => {
    expect(() => validateRegionId('')).toThrow('Region ID must be a non-empty string');
    expect(() => validateRegionId('   ')).toThrow('Region ID must be a non-empty string');
  });

  it('should throw for IDs with invalid characters', () => {
    expect(() => validateRegionId('region<script>')).toThrow('contains invalid characters');
    expect(() => validateRegionId('region|test')).toThrow('contains invalid characters');
    expect(() => validateRegionId('region?query')).toThrow('contains invalid characters');
    expect(() => validateRegionId('region*')).toThrow('contains invalid characters');
  });
});

describe('validateBatchSize', () => {
  it('should accept valid batch sizes', () => {
    expect(validateBatchSize(1)).toBe(true);
    expect(validateBatchSize(50)).toBe(true);
    expect(validateBatchSize(100)).toBe(true);
  });

  it('should throw for non-integer values', () => {
    expect(() => validateBatchSize(5.5)).toThrow('Batch size must be an integer');
    expect(() => validateBatchSize('10')).toThrow('Batch size must be an integer');
  });

  it('should throw for values below minimum', () => {
    expect(() => validateBatchSize(0)).toThrow('Batch size must be between 1 and 100');
  });

  it('should throw for values above maximum', () => {
    expect(() => validateBatchSize(101)).toThrow('Batch size must be between 1 and 100');
  });

  it('should respect custom range', () => {
    expect(validateBatchSize(5, 5, 10)).toBe(true);
    expect(() => validateBatchSize(4, 5, 10)).toThrow('Batch size must be between 5 and 10');
    expect(() => validateBatchSize(11, 5, 10)).toThrow('Batch size must be between 5 and 10');
  });
});

describe('validateTimeout', () => {
  it('should accept valid timeout values', () => {
    expect(validateTimeout(1000)).toBe(true);
    expect(validateTimeout(30000)).toBe(true);
    expect(validateTimeout(120000)).toBe(true);
  });

  it('should throw for non-integer values', () => {
    expect(() => validateTimeout(1000.5)).toThrow('Timeout must be an integer');
    expect(() => validateTimeout('1000')).toThrow('Timeout must be an integer');
  });

  it('should throw for values below minimum', () => {
    expect(() => validateTimeout(999)).toThrow('Timeout must be at least 1000ms');
  });

  it('should throw for values above maximum', () => {
    expect(() => validateTimeout(120001)).toThrow('Timeout cannot exceed 120000ms');
  });

  it('should respect custom range', () => {
    expect(validateTimeout(5000, 5000, 10000)).toBe(true);
    expect(() => validateTimeout(4999, 5000, 10000)).toThrow('Timeout must be at least 5000ms');
    expect(() => validateTimeout(10001, 5000, 10000)).toThrow('Timeout cannot exceed 10000ms');
  });
});

describe('safeValidate', () => {
  it('should return valid result for passing validation', () => {
    const result = safeValidate(validateStyleUrl, 'https://example.com/style.json');
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.value).toBe('https://example.com/style.json');
    }
  });

  it('should return invalid result with error message for failing validation', () => {
    const result = safeValidate(validateStyleUrl, 'invalid-url');
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.error).toContain('must be a valid HTTP(S) URL');
    }
  });

  it('should handle non-Error exceptions', () => {
    // Create a validator that throws a string instead of an Error
    const throwingValidator = (value: unknown): value is string => {
      if (value) throw 'string error';
      return false;
    };
    const result = safeValidate(throwingValidator, 'test');
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      // safeValidate returns 'Unknown validation error' for non-Error exceptions
      expect(result.error).toBe('Unknown validation error');
    }
  });
});
