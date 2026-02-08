/**
 * Error handling utilities for map-gl-offline.
 *
 * This module provides consistent error handling patterns across the application,
 * including error categorization, user-friendly messages, and retry logic helpers.
 *
 * **Error Types:**
 * - `NETWORK`: Transient network errors (retryable)
 * - `CORS`: Cross-origin policy errors (NOT retryable - server-side issue)
 * - `STORAGE`: IndexedDB/storage errors
 * - `VALIDATION`: Invalid input/configuration errors
 * - `PARSE`: JSON/data parsing errors
 * - `QUOTA`: Storage quota exceeded errors
 * - `UNKNOWN`: Uncategorized errors
 *
 * @example
 * ```ts
 * import { categorizeError, getUserErrorMessage, ErrorType } from 'map-gl-offline';
 *
 * try {
 *   await downloadTiles();
 * } catch (error) {
 *   const type = categorizeError(error);
 *   const message = getUserErrorMessage(error);
 *
 *   if (type === ErrorType.NETWORK) {
 *     // Retry the operation
 *   } else {
 *     // Show error to user
 *     showToast(message);
 *   }
 * }
 * ```
 *
 * @module errorHandling
 */

import { logger } from './logger';

/**
 * Error type enumeration for categorizing errors.
 * Used to determine appropriate handling strategies and user messages.
 */
export enum ErrorType {
  /** Transient network errors (connection issues, timeouts) - typically retryable */
  NETWORK = 'NETWORK',
  /** CORS policy errors - NOT retryable, requires server-side configuration or proxy */
  CORS = 'CORS',
  /** IndexedDB or storage-related errors */
  STORAGE = 'STORAGE',
  /** Input validation or configuration errors */
  VALIDATION = 'VALIDATION',
  /** JSON parsing or data format errors */
  PARSE = 'PARSE',
  /** Browser storage quota exceeded */
  QUOTA = 'QUOTA',
  /** Errors that don't match any known category */
  UNKNOWN = 'UNKNOWN',
}

/**
 * An error with additional categorization and context information.
 * Extends the standard Error class with type and metadata.
 *
 * @example
 * ```ts
 * throw new CategorizedError(
 *   'Failed to download tile',
 *   ErrorType.NETWORK,
 *   originalError,
 *   { url: tileUrl, attempt: 3 }
 * );
 * ```
 */
export class CategorizedError extends Error {
  /**
   * Create a new categorized error.
   * @param message - Human-readable error message
   * @param type - The error category
   * @param originalError - The original error that was caught (if any)
   * @param context - Additional context information for debugging
   */
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly originalError?: unknown,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CategorizedError';
  }
}

/**
 * Automatically categorize an error based on its message content.
 * Analyzes the error message to determine the most appropriate ErrorType.
 *
 * @param error - The error to categorize (can be any type)
 * @returns The determined ErrorType
 *
 * @example
 * ```ts
 * const type = categorizeError(new Error('Failed to fetch'));
 * // Returns: ErrorType.NETWORK
 *
 * const type = categorizeError(new Error('CORS policy blocked'));
 * // Returns: ErrorType.CORS
 * ```
 */
export function categorizeError(error: unknown): ErrorType {
  if (error instanceof CategorizedError) {
    return error.type;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for CORS errors first (these appear as network errors but aren't retryable)
  if (
    message.includes('cors') ||
    message.includes('cross-origin') ||
    message.includes('access-control-allow-origin') ||
    message.includes('blocked by cors policy')
  ) {
    return ErrorType.CORS;
  }

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  ) {
    return ErrorType.NETWORK;
  }

  if (
    message.includes('indexeddb') ||
    message.includes('database') ||
    message.includes('transaction')
  ) {
    return ErrorType.STORAGE;
  }

  if (
    message.includes('quota') ||
    message.includes('storage') ||
    message.includes('insufficient')
  ) {
    return ErrorType.QUOTA;
  }

  if (
    message.includes('invalid') ||
    message.includes('validation') ||
    message.includes('required')
  ) {
    return ErrorType.VALIDATION;
  }

  if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
    return ErrorType.PARSE;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserErrorMessage(error: unknown): string {
  const type = categorizeError(error);
  const originalMessage = error instanceof Error ? error.message : String(error);

  switch (type) {
    case ErrorType.NETWORK:
      return 'Network error: Unable to download resource. Please check your connection and try again.';
    case ErrorType.CORS:
      return 'CORS error: The server does not allow cross-origin requests. Consider using a proxy or different tile provider.';
    case ErrorType.STORAGE:
      return 'Storage error: Unable to save data. Please try clearing some space.';
    case ErrorType.QUOTA:
      return 'Storage quota exceeded. Please delete some regions or clear browser storage.';
    case ErrorType.VALIDATION:
      return `Invalid input: ${originalMessage}`;
    case ErrorType.PARSE:
      return 'Error parsing data. The resource may be corrupted.';
    default:
      return `An error occurred: ${originalMessage}`;
  }
}

/**
 * Safely execute a function and return a result or error
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: CategorizedError }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error: unknown) {
    const errorType = categorizeError(error);
    const message = error instanceof Error ? error.message : String(error);
    const categorizedError = new CategorizedError(
      message,
      errorType,
      error,
      context ? { context } : undefined
    );

    if (context) {
      logger.error(`Error in ${context}:`, categorizedError);
    }

    return { success: false, error: categorizedError };
  }
}
