/**
 * Validation utilities for common patterns
 * Provides reusable validation functions to ensure data integrity
 */

import { ERROR_MESSAGES } from './constants';
import type { OfflineRegionOptions } from '../types';

/**
 * Validate geographic bounds
 * @param bounds - Array of two [lng, lat] coordinate pairs
 * @returns true if valid, throws error if invalid
 */
export function validateBounds(bounds: unknown): bounds is [[number, number], [number, number]] {
  if (!Array.isArray(bounds) || bounds.length !== 2) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Must be array of 2 coordinates');
  }

  const [sw, ne] = bounds;

  if (!Array.isArray(sw) || sw.length !== 2 || !Array.isArray(ne) || ne.length !== 2) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Each coordinate must be [lng, lat]');
  }

  const [swLng, swLat] = sw;
  const [neLng, neLat] = ne;

  // Check if values are numbers
  if (
    typeof swLng !== 'number' ||
    typeof swLat !== 'number' ||
    typeof neLng !== 'number' ||
    typeof neLat !== 'number'
  ) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Coordinates must be numbers');
  }

  // Check longitude range (-180 to 180)
  if (swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Longitude must be between -180 and 180');
  }

  // Check latitude range (-90 to 90)
  if (swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Latitude must be between -90 and 90');
  }

  // Check that NE is actually northeast of SW
  if (swLat > neLat) {
    throw new Error(
      ERROR_MESSAGES.INVALID_BOUNDS + ': Southwest latitude must be less than northeast latitude'
    );
  }

  // For longitude, handle wrapping around 180/-180
  // We allow swLng > neLng for cases that cross the antimeridian
  if (swLng === neLng && swLat === neLat) {
    throw new Error(ERROR_MESSAGES.INVALID_BOUNDS + ': Bounds cannot be a single point');
  }

  return true;
}

/**
 * Validate zoom levels
 * @param minZoom - Minimum zoom level
 * @param maxZoom - Maximum zoom level
 * @param allowedMin - Minimum allowed value (default: 0)
 * @param allowedMax - Maximum allowed value (default: 24)
 * @returns true if valid, throws error if invalid
 */
export function validateZoomLevels(
  minZoom: unknown,
  maxZoom: unknown,
  allowedMin: number = 0,
  allowedMax: number = 24
): boolean {
  if (typeof minZoom !== 'number' || typeof maxZoom !== 'number') {
    throw new Error(ERROR_MESSAGES.INVALID_ZOOM + ': Zoom levels must be numbers');
  }

  if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom)) {
    throw new Error(ERROR_MESSAGES.INVALID_ZOOM + ': Zoom levels must be integers');
  }

  if (minZoom < allowedMin || minZoom > allowedMax) {
    throw new Error(
      ERROR_MESSAGES.INVALID_ZOOM + `: minZoom must be between ${allowedMin} and ${allowedMax}`
    );
  }

  if (maxZoom < allowedMin || maxZoom > allowedMax) {
    throw new Error(
      ERROR_MESSAGES.INVALID_ZOOM + `: maxZoom must be between ${allowedMin} and ${allowedMax}`
    );
  }

  if (minZoom > maxZoom) {
    throw new Error(ERROR_MESSAGES.INVALID_ZOOM + ': minZoom cannot be greater than maxZoom');
  }

  return true;
}

/**
 * Validate region configuration
 * @param options - Region options to validate
 * @returns true if valid, throws error if invalid
 */
export function validateRegionOptions(options: unknown): options is OfflineRegionOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('Region options must be an object');
  }

  const opts = options as Partial<OfflineRegionOptions>;

  // Validate required fields
  if (!opts.name || typeof opts.name !== 'string' || opts.name.trim() === '') {
    throw new Error('Region name is required and must be a non-empty string');
  }

  if (!opts.styleUrl || typeof opts.styleUrl !== 'string') {
    throw new Error(ERROR_MESSAGES.NO_STYLE_URL);
  }

  // Validate bounds if provided
  if (opts.bounds) {
    validateBounds(opts.bounds);
  }

  // Validate zoom levels if provided
  if (opts.minZoom !== undefined && opts.maxZoom !== undefined) {
    validateZoomLevels(opts.minZoom, opts.maxZoom);
  }

  return true;
}

/**
 * Validate style URL
 * @param url - Style URL to validate
 * @returns true if valid, throws error if invalid
 */
export function validateStyleUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('Style URL must be a non-empty string');
  }

  // Check if it's a valid URL or a known style provider pattern
  const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');
  const isMapboxStyle = url.startsWith('mapbox://');
  const isLocalPath = url.startsWith('/') || url.startsWith('./');

  if (!isHttpUrl && !isMapboxStyle && !isLocalPath) {
    throw new Error(
      'Style URL must be a valid HTTP(S) URL, Mapbox style URL (mapbox://), or local path'
    );
  }

  return true;
}

/**
 * Validate region ID format
 * @param id - Region ID to validate
 * @returns true if valid, throws error if invalid
 */
export function validateRegionId(id: unknown): id is string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('Region ID must be a non-empty string');
  }

  // Check for invalid characters that might cause issues in storage keys
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(id)) {
    throw new Error('Region ID contains invalid characters');
  }

  return true;
}

/**
 * Validate download options batch size
 * @param batchSize - Batch size to validate
 * @param min - Minimum allowed value (default: 1)
 * @param max - Maximum allowed value (default: 100)
 * @returns true if valid, throws error if invalid
 */
export function validateBatchSize(
  batchSize: unknown,
  min: number = 1,
  max: number = 100
): batchSize is number {
  if (typeof batchSize !== 'number' || !Number.isInteger(batchSize)) {
    throw new Error('Batch size must be an integer');
  }

  if (batchSize < min || batchSize > max) {
    throw new Error(`Batch size must be between ${min} and ${max}`);
  }

  return true;
}

/**
 * Validate timeout value
 * @param timeout - Timeout in milliseconds
 * @param min - Minimum allowed value (default: 1000)
 * @param max - Maximum allowed value (default: 120000)
 * @returns true if valid, throws error if invalid
 */
export function validateTimeout(
  timeout: unknown,
  min: number = 1000,
  max: number = 120000
): timeout is number {
  if (typeof timeout !== 'number' || !Number.isInteger(timeout)) {
    throw new Error('Timeout must be an integer');
  }

  if (timeout < min) {
    throw new Error(`Timeout must be at least ${min}ms`);
  }

  if (timeout > max) {
    throw new Error(`Timeout cannot exceed ${max}ms`);
  }

  return true;
}

/**
 * Safe validation wrapper that returns a result object instead of throwing
 * @param validator - Validation function that throws on error
 * @param value - Value to validate
 * @returns Object with isValid boolean and optional error message
 */
export function safeValidate<T>(
  validator: (value: unknown) => value is T,
  value: unknown
): { isValid: true; value: T } | { isValid: false; error: string } {
  try {
    if (validator(value)) {
      return { isValid: true, value };
    }
    return { isValid: false, error: 'Validation failed' };
  } catch (error: unknown) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}
