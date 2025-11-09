/**
 * Error handling utilities
 * Provides consistent error handling patterns across the application
 */

import { logger } from './logger';

/**
 * Error types for categorization
 */
export enum ErrorType {
  /** Network-related errors */
  NETWORK = 'NETWORK',
  /** Storage/IndexedDB errors */
  STORAGE = 'STORAGE',
  /** Validation errors */
  VALIDATION = 'VALIDATION',
  /** Parsing/Format errors */
  PARSE = 'PARSE',
  /** Quota exceeded errors */
  QUOTA = 'QUOTA',
  /** Unknown errors */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Categorized error with additional context
 */
export class CategorizedError extends Error {
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
 * Categorize an error based on its properties
 */
export function categorizeError(error: unknown): ErrorType {
  if (error instanceof CategorizedError) {
    return error.type;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

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

/**
 * Log error with appropriate level based on error type
 */
export function logError(error: unknown, context?: string): void {
  const type = categorizeError(error);
  const message = error instanceof Error ? error.message : String(error);
  const prefix = context ? `[${context}]` : '';

  switch (type) {
    case ErrorType.NETWORK:
      logger.warn(`${prefix} Network error:`, message);
      break;
    case ErrorType.QUOTA:
      logger.error(`${prefix} Quota exceeded:`, message);
      break;
    case ErrorType.STORAGE:
    case ErrorType.VALIDATION:
    case ErrorType.PARSE:
      logger.error(`${prefix} ${type} error:`, message);
      break;
    default:
      logger.error(`${prefix} Unknown error:`, error);
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const type = categorizeError(error);
  // Network errors are typically retryable
  return type === ErrorType.NETWORK;
}

/**
 * Aggregate multiple errors into a summary
 */
export function aggregateErrors(errors: Array<{ url: string; error: string }>): {
  total: number;
  byType: Record<ErrorType, number>;
  summary: string;
} {
  const byType: Record<ErrorType, number> = {
    [ErrorType.NETWORK]: 0,
    [ErrorType.STORAGE]: 0,
    [ErrorType.VALIDATION]: 0,
    [ErrorType.PARSE]: 0,
    [ErrorType.QUOTA]: 0,
    [ErrorType.UNKNOWN]: 0,
  };

  for (const { error } of errors) {
    const type = categorizeError(new Error(error));
    byType[type]++;
  }

  const summary = Object.entries(byType)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  return {
    total: errors.length,
    byType,
    summary: summary || 'No errors',
  };
}
