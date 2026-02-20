/**
 * Validation utilities for common patterns
 * Provides reusable validation functions to ensure data integrity
 */

import { ERROR_MESSAGES } from './constants';
import type { OfflineRegionOptions } from '@/types';

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

  // Check if values are valid numbers (not NaN)
  if (
    typeof swLng !== 'number' ||
    typeof swLat !== 'number' ||
    typeof neLng !== 'number' ||
    typeof neLat !== 'number' ||
    Number.isNaN(swLng) ||
    Number.isNaN(swLat) ||
    Number.isNaN(neLng) ||
    Number.isNaN(neLat)
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
