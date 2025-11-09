/**
 * Performance monitoring utilities
 * Track and measure application performance
 */

import { logger } from './logger';
import { formatBytes, formatDuration } from './formatting';

const perfLogger = logger.scope('Performance');

export { formatBytes, formatDuration }; // Re-export for convenience

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  /** Operation name */
  name: string;
  /** Start timestamp in milliseconds */
  startTime: number;
  /** End timestamp in milliseconds */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Download performance statistics
 */
export interface DownloadPerformance {
  /** Total items downloaded */
  totalItems: number;
  /** Total bytes downloaded */
  totalBytes: number;
  /** Total time in milliseconds */
  totalTime: number;
  /** Average download speed in bytes/second */
  averageSpeed: number;
  /** Average time per item in milliseconds */
  averageTimePerItem: number;
  /** Fastest download time in milliseconds */
  fastestItem?: number;
  /** Slowest download time in milliseconds */
  slowestItem?: number;
  /** Success rate percentage */
  successRate: number;
}

/**
 * Storage performance monitor
 */
export interface StorageMetrics {
  /** Current usage in bytes */
  used: number;
  /** Total quota in bytes */
  quota: number;
  /** Usage percentage */
  usagePercentage: number;
  /** Available space in bytes */
  available: number;
  /** Estimated items that can be stored */
  estimatedCapacity?: number;
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private metrics: Map<string, PerformanceMetric> = new Map();

  /**
   * Start timing an operation
   * @param name - Operation name
   * @param metadata - Optional metadata to store with the metric
   */
  start(name: string, metadata?: Record<string, unknown>): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * Stop timing an operation and return the duration
   * @param name - Operation name
   * @returns Duration in milliseconds, or undefined if not started
   */
  stop(name: string): number | undefined {
    const metric = this.metrics.get(name);
    if (!metric) {
      perfLogger.warn(`Performance timer '${name}' was not started`);
      return undefined;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    perfLogger.debug(`${name}: ${duration.toFixed(2)}ms`, metric.metadata);

    return duration;
  }

  /**
   * Get a metric by name
   * @param name - Operation name
   * @returns Metric data or undefined
   */
  getMetric(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all completed metrics
   * @returns Array of completed metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    totalDuration: number;
    averageDuration: number;
    fastest: PerformanceMetric | null;
    slowest: PerformanceMetric | null;
  } {
    const completed = this.getAllMetrics();

    if (completed.length === 0) {
      return {
        total: 0,
        totalDuration: 0,
        averageDuration: 0,
        fastest: null,
        slowest: null,
      };
    }

    const totalDuration = completed.reduce((sum, m) => sum + (m.duration || 0), 0);
    const fastest = completed.reduce((min, m) =>
      (m.duration || 0) < (min.duration || Infinity) ? m : min
    );
    const slowest = completed.reduce((max, m) =>
      (m.duration || 0) > (max.duration || 0) ? m : max
    );

    return {
      total: completed.length,
      totalDuration,
      averageDuration: totalDuration / completed.length,
      fastest,
      slowest,
    };
  }
}

/**
 * Download performance tracker
 */
export class DownloadPerformanceTracker {
  private items: Array<{ size: number; time: number; success: boolean }> = [];

  /**
   * Record a download
   * @param size - Size in bytes
   * @param time - Time taken in milliseconds
   * @param success - Whether the download succeeded
   */
  recordDownload(size: number, time: number, success: boolean = true): void {
    this.items.push({ size, time, success });
  }

  /**
   * Get performance statistics
   */
  getStats(): DownloadPerformance {
    if (this.items.length === 0) {
      return {
        totalItems: 0,
        totalBytes: 0,
        totalTime: 0,
        averageSpeed: 0,
        averageTimePerItem: 0,
        successRate: 0,
      };
    }

    const totalBytes = this.items.reduce((sum, item) => sum + item.size, 0);
    const totalTime = this.items.reduce((sum, item) => sum + item.time, 0);
    const successCount = this.items.filter(item => item.success).length;

    const times = this.items.map(item => item.time);
    const fastestItem = Math.min(...times);
    const slowestItem = Math.max(...times);

    return {
      totalItems: this.items.length,
      totalBytes,
      totalTime,
      averageSpeed: totalTime > 0 ? (totalBytes / totalTime) * 1000 : 0, // bytes/second
      averageTimePerItem: totalTime / this.items.length,
      fastestItem,
      slowestItem,
      successRate: (successCount / this.items.length) * 100,
    };
  }

  /**
   * Get human-readable speed
   */
  getFormattedSpeed(): string {
    const stats = this.getStats();
    const speed = stats.averageSpeed;

    if (speed < 1024) {
      return `${speed.toFixed(2)} B/s`;
    } else if (speed < 1024 * 1024) {
      return `${(speed / 1024).toFixed(2)} KB/s`;
    } else {
      return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
    }
  }

  /**
   * Clear all recorded downloads
   */
  clear(): void {
    this.items = [];
  }
}

/**
 * Get current storage metrics
 */
export async function getStorageMetrics(): Promise<StorageMetrics> {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    throw new Error('Storage API not available');
  }

  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const available = quota - used;
  const usagePercentage = quota > 0 ? (used / quota) * 100 : 0;

  return {
    used,
    quota,
    available,
    usagePercentage,
  };
}

/**
 * Monitor operation performance with automatic timing
 * @param name - Operation name
 * @param operation - Async operation to monitor
 * @param metadata - Optional metadata
 * @returns Operation result and performance metric
 */
export async function monitorPerformance<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<{ result: T; metric: PerformanceMetric }> {
  const startTime = performance.now();

  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      name,
      startTime,
      endTime,
      duration,
      metadata,
    };

    perfLogger.debug(`${name} completed in ${formatDuration(duration)}`, metadata);

    return { result, metric };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    perfLogger.error(
      `${name} failed after ${formatDuration(duration)}`,
      error instanceof Error ? error.message : error
    );

    throw error;
  }
}

/**
 * Create a rate limiter for controlling request frequency
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;

  constructor(
    private maxConcurrent: number = 5,
    private delayMs: number = 0
  ) {}

  /**
   * Execute an operation with rate limiting
   * @param operation - Async operation to execute
   * @returns Operation result
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Wait if we're at max concurrent requests
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.activeRequests++;

    try {
      const result = await operation();

      // Add delay if configured
      if (this.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }

      return result;
    } finally {
      this.activeRequests--;

      // Process next queued operation
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get number of active requests
   */
  getActiveCount(): number {
    return this.activeRequests;
  }
}
