import type { DownloadProgress } from '../types';
import { logger } from './logger';
import { applyProxy, type ProxyType } from './proxyConfig';

const downloadLogger = logger.scope('Download');

export type FetchResourceResult =
  | {
      type: 'json';
      data: unknown;
      contentType: string;
      contentEncoding?: string;
      expires?: number;
    }
  | {
      type: 'image' | 'pbf' | 'other';
      data: ArrayBuffer;
      contentType: string;
      contentEncoding?: string;
      expires?: number;
    };

/**
 * Parse Cache-Control and Expires headers to compute an expiry timestamp.
 * Returns ms since epoch, or undefined if no cache info is available.
 */
export function parseCacheExpiry(headers: Headers): number | undefined {
  // Prefer Cache-Control: max-age=X
  const cacheControl = headers.get('cache-control');
  if (cacheControl) {
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      const maxAgeSec = parseInt(maxAgeMatch[1], 10);
      if (maxAgeSec > 0) {
        return Date.now() + maxAgeSec * 1000;
      }
    }
  }

  // Fallback to Expires header
  const expiresHeader = headers.get('expires');
  if (expiresHeader) {
    const expiresTime = Date.parse(expiresHeader);
    if (!isNaN(expiresTime) && expiresTime > Date.now()) {
      return expiresTime;
    }
  }

  return undefined;
}

/**
 * Enhanced fetch with retry logic and timeout
 */
export async function fetchResourceWithRetry(
  url: string,
  options: {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    proxyType?: ProxyType;
  } = {}
): Promise<FetchResourceResult> {
  const { retries = 3, retryDelay = 1000, timeout = 30000, proxyType } = options;

  // Apply proxy if configured
  const fetchUrl = proxyType ? applyProxy(url, proxyType) : url;
  if (fetchUrl !== url) {
    downloadLogger.debug(
      `Proxying ${proxyType} request: ${url.substring(0, 60)}... -> ${fetchUrl.substring(0, 60)}...`
    );
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(fetchUrl, {
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Provide more specific error messages
        if (response.status === 404) {
          throw new Error(`Resource not found (404): ${url}`);
        }
        if (response.status === 403 || response.status === 401) {
          throw new Error(`Access denied (${response.status}): ${url}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const contentEncoding = response.headers.get('content-encoding') || undefined;
      const expires = parseCacheExpiry(response.headers);

      if (contentType.includes('application/json') || contentType.includes('+json')) {
        const data = (await response.json()) as unknown;
        return { type: 'json', data, contentType, contentEncoding, expires };
      }

      const data = await response.arrayBuffer();

      if (contentType.includes('image')) {
        return { type: 'image', data, contentType, contentEncoding, expires };
      }

      if (contentType.includes('application/x-protobuf') || contentType.includes('protobuf')) {
        return { type: 'pbf', data, contentType, contentEncoding, expires };
      }

      return { type: 'other', data, contentType, contentEncoding, expires };
    } catch (error) {
      if (attempt === retries) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let enhancedMessage = `Failed to fetch ${url} after ${retries + 1} attempts: ${errorMessage}`;

        // Provide helpful CORS guidance
        if (errorMessage.includes('CORS') || errorMessage.includes('Cross-Origin')) {
          enhancedMessage +=
            '\n\n💡 CORS Issue Detected:\n' +
            '• Use a local development server with proxy (check vite.config.ts)\n' +
            '• Or try a different tile provider that allows CORS\n' +
            '• For production, implement a server-side proxy';
        }

        throw new Error(enhancedMessage);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}

/**
 * Enhanced fetch with retry logic and timeout that returns Response object
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(
          `Failed to fetch ${url} after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
    onError?: (error: Error, item: T) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, onProgress, onError } = options;
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async item => {
      try {
        const result = await processor(item);
        completed++;
        onProgress?.(completed, items.length);
        return result;
      } catch (error) {
        onError?.(error as Error, item);
        completed++;
        onProgress?.(completed, items.length);
        throw error;
      }
    });

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          downloadLogger.warn(`Failed to process item ${i + index}:`, result.reason);
        }
      });
    } catch (error) {
      downloadLogger.error(`Batch processing error:`, error);
    }
  }

  return results;
}

/**
 * Create a progress tracker
 */
export function createProgressTracker(total: number): {
  progress: DownloadProgress;
  update: (increment?: number, currentItem?: string, error?: string) => void;
  getProgress: () => DownloadProgress;
} {
  const progress: DownloadProgress = {
    completed: 0,
    total,
    percentage: total > 0 ? 0 : 100,
    errors: [],
  };

  const clampCompleted = (value: number) => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return progress.completed;
    }
    return Math.max(0, Math.min(progress.total, value));
  };

  const recalculatePercentage = () => {
    progress.percentage =
      progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 100;
  };

  recalculatePercentage();

  return {
    progress,
    update: (increment: number = 1, currentItem?: string, error?: string) => {
      if (increment !== undefined) {
        progress.completed = clampCompleted(progress.completed + increment);
      }
      if (currentItem !== undefined) {
        progress.currentItem = currentItem;
      }
      if (error !== undefined && error.length > 0) {
        progress.errors = [...progress.errors, error];
      }
      recalculatePercentage();
    },
    getProgress: () => ({ ...progress }),
  };
}
/**
 * Validate resource data
 */
export function validateResource(data: ArrayBuffer, type: string): boolean {
  if (!data || data.byteLength === 0) {
    return false;
  }

  // Basic validation based on type
  const view = new Uint8Array(data);

  switch (type) {
    case 'pbf':
      // Check for protobuf magic bytes or reasonable size
      return data.byteLength > 0 && data.byteLength < 50 * 1024 * 1024; // Max 50MB
    case 'image': {
      // Check for common image format headers
      const isPNG = view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47;
      const isJPEG = view[0] === 0xff && view[1] === 0xd8;
      const isWebP = view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
      return isPNG || isJPEG || isWebP;
    }
    default:
      return data.byteLength > 0;
  }
}
