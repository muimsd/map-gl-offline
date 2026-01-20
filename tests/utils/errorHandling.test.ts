/**
 * Tests for error handling utilities
 */
import {
  ErrorType,
  CategorizedError,
  categorizeError,
  getUserErrorMessage,
  safeExecute,
  logError,
  isRetryableError,
  isCorsError,
  aggregateErrors,
} from '../../src/utils/errorHandling';
import { logger, LogLevel } from '../../src/utils/logger';

// Silence logger during tests
beforeAll(() => {
  logger.setLevel(LogLevel.SILENT);
});

afterAll(() => {
  logger.setLevel(LogLevel.ERROR);
});

describe('CategorizedError', () => {
  it('should create an error with type', () => {
    const error = new CategorizedError('Test error', ErrorType.NETWORK);
    expect(error.message).toBe('Test error');
    expect(error.type).toBe(ErrorType.NETWORK);
    expect(error.name).toBe('CategorizedError');
  });

  it('should store original error', () => {
    const original = new Error('Original');
    const error = new CategorizedError('Wrapped', ErrorType.STORAGE, original);
    expect(error.originalError).toBe(original);
  });

  it('should store context', () => {
    const error = new CategorizedError('Test', ErrorType.VALIDATION, undefined, { url: 'test.com' });
    expect(error.context).toEqual({ url: 'test.com' });
  });
});

describe('categorizeError', () => {
  it('should return type from CategorizedError', () => {
    const error = new CategorizedError('Test', ErrorType.QUOTA);
    expect(categorizeError(error)).toBe(ErrorType.QUOTA);
  });

  it('should detect CORS errors', () => {
    expect(categorizeError(new Error('CORS policy blocked'))).toBe(ErrorType.CORS);
    expect(categorizeError(new Error('cross-origin request'))).toBe(ErrorType.CORS);
    expect(categorizeError(new Error('Access-Control-Allow-Origin'))).toBe(ErrorType.CORS);
    expect(categorizeError(new Error('blocked by cors policy'))).toBe(ErrorType.CORS);
  });

  it('should detect network errors', () => {
    expect(categorizeError(new Error('Failed to fetch'))).toBe(ErrorType.NETWORK);
    expect(categorizeError(new Error('Network error'))).toBe(ErrorType.NETWORK);
    expect(categorizeError(new Error('fetch failed'))).toBe(ErrorType.NETWORK);
  });

  it('should detect storage errors', () => {
    expect(categorizeError(new Error('IndexedDB error'))).toBe(ErrorType.STORAGE);
    expect(categorizeError(new Error('Database transaction failed'))).toBe(ErrorType.STORAGE);
  });

  it('should detect quota errors', () => {
    expect(categorizeError(new Error('Quota exceeded'))).toBe(ErrorType.QUOTA);
    expect(categorizeError(new Error('Insufficient storage'))).toBe(ErrorType.QUOTA);
  });

  it('should detect validation errors', () => {
    expect(categorizeError(new Error('Invalid input'))).toBe(ErrorType.VALIDATION);
    expect(categorizeError(new Error('Validation failed'))).toBe(ErrorType.VALIDATION);
    expect(categorizeError(new Error('Field required'))).toBe(ErrorType.VALIDATION);
  });

  it('should detect parse errors', () => {
    expect(categorizeError(new Error('JSON parse error'))).toBe(ErrorType.PARSE);
    expect(categorizeError(new Error('Syntax error'))).toBe(ErrorType.PARSE);
  });

  it('should return UNKNOWN for unrecognized errors', () => {
    expect(categorizeError(new Error('Something went wrong'))).toBe(ErrorType.UNKNOWN);
  });

  it('should handle non-Error values', () => {
    expect(categorizeError('string error')).toBe(ErrorType.UNKNOWN);
    expect(categorizeError({ message: 'object error' })).toBe(ErrorType.UNKNOWN);
  });

  it('should prioritize CORS over network errors', () => {
    // CORS errors often appear as network errors but should be categorized as CORS
    expect(categorizeError(new Error('fetch failed due to CORS'))).toBe(ErrorType.CORS);
  });
});

describe('getUserErrorMessage', () => {
  it('should return user-friendly message for NETWORK errors', () => {
    const message = getUserErrorMessage(new Error('Failed to fetch'));
    expect(message).toContain('Network error');
    expect(message).toContain('check your connection');
  });

  it('should return user-friendly message for CORS errors', () => {
    const message = getUserErrorMessage(new Error('CORS policy blocked'));
    expect(message).toContain('CORS error');
    expect(message).toContain('proxy');
  });

  it('should return user-friendly message for STORAGE errors', () => {
    const message = getUserErrorMessage(new Error('IndexedDB error'));
    expect(message).toContain('Storage error');
  });

  it('should return user-friendly message for QUOTA errors', () => {
    const message = getUserErrorMessage(new Error('Quota exceeded'));
    expect(message).toContain('quota');
  });

  it('should include original message for VALIDATION errors', () => {
    const message = getUserErrorMessage(new Error('Invalid bounds'));
    expect(message).toContain('Invalid');
    expect(message).toContain('bounds');
  });

  it('should return user-friendly message for PARSE errors', () => {
    const message = getUserErrorMessage(new Error('JSON parse error'));
    expect(message).toContain('parsing');
  });

  it('should include original message for UNKNOWN errors', () => {
    const message = getUserErrorMessage(new Error('Something specific'));
    expect(message).toContain('Something specific');
  });
});

describe('safeExecute', () => {
  it('should return success result for successful function', async () => {
    const result = await safeExecute(async () => 'test value');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('test value');
    }
  });

  it('should return error result for throwing function', async () => {
    const result = await safeExecute(async () => {
      throw new Error('Test error');
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CategorizedError);
      expect(result.error.message).toBe('Test error');
    }
  });

  it('should categorize errors correctly', async () => {
    const result = await safeExecute(async () => {
      throw new Error('Failed to fetch');
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe(ErrorType.NETWORK);
    }
  });

  it('should include context in error', async () => {
    const result = await safeExecute(async () => {
      throw new Error('Test');
    }, 'TestContext');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.context).toEqual({ context: 'TestContext' });
    }
  });
});

describe('logError', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger.setLevel(LogLevel.DEBUG);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logger.setLevel(LogLevel.SILENT);
  });

  it('should log network errors as warnings', () => {
    logError(new Error('Failed to fetch'));
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should log other errors as errors', () => {
    logError(new Error('Quota exceeded'));
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should include context prefix', () => {
    logError(new Error('Test error'), 'TestModule');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[TestModule]'), expect.anything());
  });
});

describe('isRetryableError', () => {
  it('should return true for NETWORK errors', () => {
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new Error('Network error'))).toBe(true);
  });

  it('should return false for CORS errors', () => {
    expect(isRetryableError(new Error('CORS policy blocked'))).toBe(false);
  });

  it('should return false for other error types', () => {
    expect(isRetryableError(new Error('Quota exceeded'))).toBe(false);
    expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    expect(isRetryableError(new Error('IndexedDB error'))).toBe(false);
  });
});

describe('isCorsError', () => {
  it('should return true for CORS errors', () => {
    expect(isCorsError(new Error('CORS policy blocked'))).toBe(true);
    expect(isCorsError(new Error('cross-origin'))).toBe(true);
  });

  it('should return false for non-CORS errors', () => {
    expect(isCorsError(new Error('Failed to fetch'))).toBe(false);
    expect(isCorsError(new Error('Unknown error'))).toBe(false);
  });
});

describe('aggregateErrors', () => {
  it('should aggregate errors by type', () => {
    const errors = [
      { url: 'url1', error: 'Failed to fetch' },
      { url: 'url2', error: 'CORS policy blocked' },
      { url: 'url3', error: 'Network error' },
      { url: 'url4', error: 'IndexedDB error' },
    ];

    const result = aggregateErrors(errors);

    expect(result.total).toBe(4);
    expect(result.byType[ErrorType.NETWORK]).toBe(2);
    expect(result.byType[ErrorType.CORS]).toBe(1);
    expect(result.byType[ErrorType.STORAGE]).toBe(1);
  });

  it('should return empty summary for no errors', () => {
    const result = aggregateErrors([]);
    expect(result.total).toBe(0);
    expect(result.summary).toBe('No errors');
  });

  it('should format summary correctly', () => {
    const errors = [
      { url: 'url1', error: 'Failed to fetch' },
      { url: 'url2', error: 'Failed to fetch' },
    ];

    const result = aggregateErrors(errors);
    expect(result.summary).toContain('NETWORK: 2');
  });
});
