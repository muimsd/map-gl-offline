/**
 * Base class for download services
 * Provides common functionality for tile, glyph, sprite, and font downloads
 */

import { logger } from '../utils/logger';
import type { DownloadProgress } from '../types';

/**
 * Base options for all download services
 */
export interface BaseDownloadOptions {
  /** Progress callback */
  onProgress?: (progress: DownloadProgress) => void;
  /** Number of items to process concurrently */
  batchSize?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Skip items that already exist */
  skipExisting?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Check storage quota before download */
  storageQuotaCheck?: boolean;
}

/**
 * Base result for all download operations
 */
export interface BaseDownloadResult {
  /** Total items in download plan */
  total: number;
  /** Successfully downloaded items */
  downloaded: number;
  /** Items skipped (already exist) */
  skipped: number;
  /** Failed downloads */
  failed: number;
  /** Total size in bytes */
  totalSize: number;
  /** Download duration in milliseconds */
  downloadTime: number;
  /** Average download speed in KB/s */
  averageSpeed: number;
  /** Error details */
  errors: Array<{ url: string; error: string }>;
}

/**
 * Base download service with common functionality
 */
export abstract class BaseDownloadService {
  protected abstract serviceName: string;

  /**
   * Get a scoped logger for this service
   */
  protected getLogger() {
    return logger.scope(this.serviceName);
  }

  /**
   * Check storage quota before download
   * @param requiredSpace - Estimated space needed in bytes
   * @throws Error if insufficient space
   */
  protected async checkStorageQuota(requiredSpace: number = 500 * 1024 * 1024): Promise<void> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      this.getLogger().warn('Storage API not available, skipping quota check');
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usedSpace = estimate.usage || 0;
      const availableSpace = (estimate.quota || 0) - usedSpace;

      if (availableSpace < requiredSpace) {
        const availableMB = (availableSpace / (1024 * 1024)).toFixed(2);
        const requiredMB = (requiredSpace / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Insufficient storage space. Available: ${availableMB}MB, Required: ${requiredMB}MB`
        );
      }

      this.getLogger().debug(
        `Storage check passed: ${(availableSpace / (1024 * 1024)).toFixed(2)}MB available`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Insufficient storage')) {
        throw error;
      }
      this.getLogger().warn('Storage quota check failed:', error);
    }
  }

  /**
   * Calculate average speed in KB/s
   */
  protected calculateSpeed(bytes: number, milliseconds: number): number {
    if (milliseconds === 0) return 0;
    return bytes / 1024 / (milliseconds / 1000);
  }

  /**
   * Create a standardized error object
   */
  protected createError(url: string, error: unknown): { url: string; error: string } {
    return {
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * Sleep for a specified duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track download statistics
   */
  protected createStatsTracker() {
    let largestItem = { name: '', size: 0 };
    let smallestItem = { name: '', size: Infinity };
    const itemsByType: Record<string, number> = {};

    return {
      trackItem(name: string, size: number, type?: string) {
        if (size > largestItem.size) {
          largestItem = { name, size };
        }
        if (size < smallestItem.size) {
          smallestItem = { name, size };
        }
        if (type) {
          itemsByType[type] = (itemsByType[type] || 0) + 1;
        }
      },
      getStats() {
        return {
          largest: largestItem.size !== 0 ? largestItem : undefined,
          smallest: smallestItem.size !== Infinity ? smallestItem : undefined,
          byType: itemsByType,
        };
      },
    };
  }
}
