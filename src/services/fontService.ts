import { dbPromise } from '../storage/indexedDbManager';
import { fetchResourceWithRetry, processBatch, createProgressTracker } from '../utils';
import type {
  EnhancedFontStats,
  FontDownloadOptions,
  FontDownloadResult,
  FontEntry,
} from '../types';

export class FontService {
  private db = dbPromise;

  async downloadFonts(
    fontUrls: string[],
    downloadId?: string,
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    const db = await this.db;
    const {
      onProgress,
      batchSize = 10,
      maxRetries = 3,
      corsProxy,
      skipExisting = true,
      retryDelay = 1000,
      timeout = 30000,
      validateFonts = true,
      maxConcurrency = 5,
      storageQuotaCheck = true,
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedFonts = 0;
    let skippedFonts = 0;
    let failedFonts = 0;
    const errors: Array<{ url: string; error: string }> = [];
    const fontsByType: Record<string, number> = {};

    // Create progress tracker
    const progressTracker = createProgressTracker(fontUrls.length);

    // Filter existing fonts if skipExisting is true
    let urlsToDownload = fontUrls;
    if (skipExisting) {
      const existingFonts = new Set();
      const tx = db.transaction(['fonts'], 'readonly');

      let cursor = await tx.objectStore('fonts').openCursor();
      while (cursor) {
        existingFonts.add(cursor.value.key);
        cursor = await cursor.continue();
      }

      urlsToDownload = fontUrls.filter(url => {
        const key = this.createFontKey(url);
        return !existingFonts.has(key);
      });

      skippedFonts = fontUrls.length - urlsToDownload.length;
    }

    // Check storage quota if enabled
    if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedSpace = estimate.usage || 0;
      const availableSpace = (estimate.quota || 0) - usedSpace;

      if (availableSpace < 50 * 1024 * 1024) {
        // Less than 50MB
        throw new Error('Insufficient storage space for font download');
      }
    }

    // Process fonts in batches with concurrency control
    await processBatch(
      urlsToDownload,
      async fontUrl => {
        try {
          const fontKey = this.createFontKey(fontUrl);

          progressTracker.update(1, fontKey);

          const response = await fetchResourceWithRetry(fontUrl, {
            retries: maxRetries,
            retryDelay,
            timeout,
          });

          const fontData = response.data;
          const contentType = response.type === 'other' ? 'font/opentype' : `font/${response.type}`;

          // Validate font if enabled
          if (validateFonts) {
            await this.validateFont(fontData, contentType);
          }

          // Store font in database
          const fontEntry: FontEntry = {
            key: fontKey,
            url: fontUrl,
            originalUrl: fontUrl,
            data: fontData,
            contentType,
            type: this.detectFontType(contentType, fontUrl),
            size: fontData.byteLength,
            lastModified: Date.now(),
            downloadedAt: new Date().toISOString(),
            downloadId,
            metadata: {
              userAgent: navigator.userAgent,
              downloadTimestamp: Date.now(),
            },
          };

          await db.put('fonts', fontEntry);

          totalSize += fontData.byteLength;
          downloadedFonts++;

          // Track font types
          const fontType = this.detectFontType(contentType, fontUrl);
          fontsByType[fontType] = (fontsByType[fontType] || 0) + 1;
        } catch (error) {
          failedFonts++;
          errors.push({
            url: fontUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`Failed to download font ${fontUrl}:`, error);
        }
      },
      { batchSize }
    );

    const downloadTime = Date.now() - startTime;
    const averageSpeed = downloadTime > 0 ? (totalSize / downloadTime) * 1000 : 0;

    return {
      totalFonts: fontUrls.length,
      downloadedFonts,
      skippedFonts,
      failedFonts,
      totalSize,
      downloadTime,
      averageSpeed,
      errors,
      fontsByType,
    };
  }

  async getFontStats(): Promise<EnhancedFontStats> {
    const db = await this.db;
    const tx = db.transaction(['fonts'], 'readonly');

    let count = 0;
    let totalSize = 0;
    const fonts: string[] = [];
    const fontsByType: Record<string, number> = {};
    const corruptedFonts: string[] = [];
    let oldestFont: { key: string; timestamp: number } | undefined;
    let newestFont: { key: string; timestamp: number } | undefined;

    let cursor = await tx.objectStore('fonts').openCursor();
    while (cursor) {
      const fontEntry: FontEntry = cursor.value;
      count++;
      totalSize += fontEntry.size;
      fonts.push(fontEntry.key);

      // Track font types
      const fontType = this.detectFontType(fontEntry.contentType, fontEntry.url);
      fontsByType[fontType] = (fontsByType[fontType] || 0) + 1;

      // Track oldest and newest
      if (!oldestFont || fontEntry.lastModified < oldestFont.timestamp) {
        oldestFont = { key: fontEntry.key, timestamp: fontEntry.lastModified };
      }
      if (!newestFont || fontEntry.lastModified > newestFont.timestamp) {
        newestFont = { key: fontEntry.key, timestamp: fontEntry.lastModified };
      }

      // Basic corruption check
      if (fontEntry.size === 0 || !fontEntry.data) {
        corruptedFonts.push(fontEntry.key);
      }

      cursor = await cursor.continue();
    }

    return {
      count,
      totalSize,
      averageSize: count > 0 ? totalSize / count : 0,
      fonts,
      fontsByType,
      oldestFont,
      newestFont,
      corruptedFonts,
    };
  }

  async getFontAnalytics(): Promise<Record<string, unknown>> {
    const stats = await this.getFontStats();

    return {
      basic: {
        totalFonts: stats.count,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
      },
      distribution: stats.fontsByType,
      health: {
        corruptedFonts: stats.corruptedFonts.length,
        corruptionRate: stats.count > 0 ? (stats.corruptedFonts.length / stats.count) * 100 : 0,
      },
      temporal: {
        oldestFont: stats.oldestFont,
        newestFont: stats.newestFont,
        ageSpan:
          stats.oldestFont && stats.newestFont
            ? stats.newestFont.timestamp - stats.oldestFont.timestamp
            : 0,
      },
    };
  }

  async cleanupOldFonts(maxAge: number = 30): Promise<number> {
    const db = await this.db;
    const cutoffTime = Date.now() - maxAge * 24 * 60 * 60 * 1000;

    const tx = db.transaction(['fonts'], 'readwrite');
    let deletedCount = 0;

    let cursor = await tx.objectStore('fonts').openCursor();
    while (cursor) {
      const fontEntry: FontEntry = cursor.value;
      if (fontEntry.lastModified < cutoffTime) {
        await cursor.delete();
        deletedCount++;
      }
      cursor = await cursor.continue();
    }

    return deletedCount;
  }

  async verifyAndRepairFonts(): Promise<{ verified: number; repaired: number; removed: number }> {
    const db = await this.db;
    const tx = db.transaction(['fonts'], 'readwrite');

    let verified = 0;
    let repaired = 0;
    let removed = 0;

    let cursor = await tx.objectStore('fonts').openCursor();
    while (cursor) {
      const fontEntry: FontEntry = cursor.value;

      try {
        // Basic validation
        if (!fontEntry.data || fontEntry.size === 0) {
          await cursor.delete();
          removed++;
        } else {
          await this.validateFont(fontEntry.data, fontEntry.contentType);
          verified++;
        }
      } catch (error) {
        // Try to repair or remove
        try {
          // Attempt basic repair by re-downloading
          const response = await fetch(fontEntry.url);
          if (response.ok) {
            const newData = await response.arrayBuffer();
            const repairedEntry = {
              ...fontEntry,
              data: newData,
              size: newData.byteLength,
              lastModified: Date.now(),
            };
            await cursor.update(repairedEntry);
            repaired++;
          } else {
            await cursor.delete();
            removed++;
          }
        } catch (repairError) {
          await cursor.delete();
          removed++;
        }
      }

      cursor = await cursor.continue();
    }

    return { verified, repaired, removed };
  }

  private createFontKey(url: string): string {
    // Create a consistent key from the font URL
    return btoa(url).replace(/[+/=]/g, '').substring(0, 32);
  }

  private detectFontType(contentType: string, url: string): string {
    // Handle undefined or null contentType
    if (contentType && typeof contentType === 'string') {
      if (contentType.includes('woff2')) return 'woff2';
      if (contentType.includes('woff')) return 'woff';
      if (contentType.includes('ttf') || contentType.includes('truetype')) return 'ttf';
      if (contentType.includes('otf') || contentType.includes('opentype')) return 'otf';
    }

    // Fallback to URL extension
    const extension = url.split('.').pop()?.toLowerCase();
    if (extension === 'woff2') return 'woff2';
    if (extension === 'woff') return 'woff';
    if (extension === 'ttf') return 'ttf';
    if (extension === 'otf') return 'otf';

    return 'unknown';
  }

  private async validateFont(data: ArrayBuffer, contentType: string): Promise<void> {
    // Basic validation - check for font signature
    const view = new Uint8Array(data);

    if (view.length < 4) {
      throw new Error('Font data too short');
    }

    // Check for common font signatures
    const signature = Array.from(view.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const validSignatures = [
      '774f4632', // wOF2 (WOFF2)
      '774f4646', // wOFF (WOFF)
      '00010000', // TTF/OTF
      '4f54544f', // OTTO (OpenType)
      '74727565', // true (TrueType)
      '74797031', // typ1 (Type 1)
    ];

    if (!validSignatures.includes(signature)) {
      throw new Error(`Invalid font signature: ${signature}`);
    }
  }
}

// Export functions for backward compatibility
export const fontService = new FontService();

export const downloadFonts = (
  fontUrls: string[],
  downloadId?: string,
  options?: FontDownloadOptions
) => fontService.downloadFonts(fontUrls, downloadId, options);

export const getFontStats = () => fontService.getFontStats();
export const getFontAnalytics = () => fontService.getFontAnalytics();
export const cleanupOldFonts = (maxAge?: number) => fontService.cleanupOldFonts(maxAge);
export const verifyAndRepairFonts = () => fontService.verifyAndRepairFonts();
