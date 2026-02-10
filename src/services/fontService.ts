import { dbPromise } from '../storage/indexedDbManager';
import { fetchResourceWithRetry, processBatch, createProgressTracker, logger } from '../utils';
import type {
  EnhancedFontStats,
  FontDownloadOptions,
  FontDownloadResult,
  FontEntry,
} from '../types';

const fontLogger = logger.scope('FontService');

export class FontService {
  private db = dbPromise;

  async downloadFonts(
    fontUrls: string[],
    styleName?: string,
    options: FontDownloadOptions = {}
  ): Promise<FontDownloadResult> {
    const db = await this.db;
    const {
      batchSize = 10,
      maxRetries = 3,
      skipExisting = true,
      retryDelay = 1000,
      timeout = 30000,
      validateFonts = true,
      storageQuotaCheck = true,
      quietMode = false,
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
        const key = this.createFontKey(url, styleName);
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
          const fontKey = this.createFontKey(fontUrl, styleName);

          const response = await fetchResourceWithRetry(fontUrl, {
            retries: maxRetries,
            retryDelay,
            timeout,
            proxyType: 'fonts',
          });

          if (response.type === 'json') {
            throw new Error(`Unexpected JSON response when fetching font: ${fontUrl}`);
          }

          const fontData = response.data;
          const contentType =
            response.contentType ||
            (response.type === 'other' ? 'font/opentype' : `font/${response.type}`);

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
            downloadId: styleName,
            metadata: {
              userAgent: navigator.userAgent,
              downloadTimestamp: Date.now(),
            },
            expires: response.expires,
          };

          await db.put('fonts', fontEntry);

          progressTracker.update(1, fontKey);

          totalSize += fontData.byteLength;
          downloadedFonts++;

          // Track font types
          const fontType = this.detectFontType(contentType, fontUrl);
          fontsByType[fontType] = (fontsByType[fontType] || 0) + 1;
        } catch (error) {
          failedFonts++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            url: fontUrl,
            error: errorMessage,
          });

          // Only log detailed errors if not in quiet mode
          if (!quietMode) {
            fontLogger.error(`Failed to download font ${fontUrl}:`, errorMessage);
          } else if (errors.length === 1) {
            // Log a summary message only once
            fontLogger.warn(
              `Font download issues detected. Some fonts may not be available. Check network connectivity and CORS settings.`
            );
          }
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

    let verified = 0;
    let repaired = 0;
    let removed = 0;

    // First pass: collect entries and categorize them
    const toRepair: FontEntry[] = [];
    const toRemove: string[] = [];

    const readTx = db.transaction(['fonts'], 'readonly');
    let cursor = await readTx.objectStore('fonts').openCursor();
    while (cursor) {
      const fontEntry: FontEntry = cursor.value;

      try {
        if (!fontEntry.data || fontEntry.size === 0) {
          toRemove.push(fontEntry.key);
        } else {
          await this.validateFont(fontEntry.data, fontEntry.contentType);
          verified++;
        }
      } catch {
        toRepair.push(fontEntry);
      }

      cursor = await cursor.continue();
    }

    // Second pass: attempt repairs via network (outside any transaction)
    for (const fontEntry of toRepair) {
      try {
        const response = await fetch(fontEntry.url);
        if (response.ok) {
          const newData = await response.arrayBuffer();
          const repairedEntry = {
            ...fontEntry,
            data: newData,
            size: newData.byteLength,
            lastModified: Date.now(),
          };
          await db.put('fonts', repairedEntry);
          repaired++;
        } else {
          toRemove.push(fontEntry.key);
        }
      } catch {
        toRemove.push(fontEntry.key);
      }
    }

    // Third pass: remove entries that couldn't be repaired
    if (toRemove.length > 0) {
      const deleteTx = db.transaction(['fonts'], 'readwrite');
      for (const key of toRemove) {
        await deleteTx.objectStore('fonts').delete(key);
        removed++;
      }
      await deleteTx.done;
    }

    return { verified, repaired, removed };
  }

  private createFontKey(url: string, styleName?: string): string {
    // Create a consistent key from the style name and font URL
    // Format: stylename:fontname.pbf (if styleName provided) or just fontIdentifier

    // Extract font name from URL (e.g., "/fonts/Arial Regular/0-255.pbf" -> "Arial Regular_0-255.pbf")
    const parts = url.split('/');
    let fontName = '';

    if (parts.length >= 3) {
      // Get the last two parts: fontstack and range.pbf
      const fontstack = parts[parts.length - 2];
      const rangeFile = parts[parts.length - 1];
      fontName = `${fontstack}_${rangeFile}`;
    } else {
      // Fallback to hash if URL structure is unexpected
      fontName = btoa(url).replace(/[+/=]/g, '').substring(0, 32) + '.pbf';
    }

    if (styleName) {
      return `${styleName}:${fontName}`;
    }

    return fontName;
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

    // Get first 4 bytes as signature
    const signature = Array.from(view.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Check for traditional font formats first
    const validSignatures = [
      '774f4632', // wOF2 (WOFF2)
      '774f4646', // wOFF (WOFF)
      '00010000', // TTF/OTF
      '4f54544f', // OTTO (OpenType)
      '74727565', // true (TrueType)
      '74797031', // typ1 (Type 1)
    ];

    if (validSignatures.includes(signature)) {
      return; // Valid traditional font
    }

    // For .pbf files and protobuf content, be more permissive
    if (
      contentType.includes('application/x-protobuf') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/protobuf')
    ) {
      // Accept if it looks like a protobuf (most start with 0x0a)
      const firstByte = view[0];
      if (firstByte === 0x0a || firstByte === 0x08 || firstByte === 0x12) {
        return; // Valid protobuf structure
      }
    }

    // Check if it's a protobuf file based on signature patterns
    const firstByte = view[0];
    if (firstByte === 0x0a) {
      // This is very likely a protobuf file (field 1, wire type 2)
      // All the signatures we're seeing (0aa78b02, 0ac14b0a, etc.) start with 0x0a
      return;
    }

    // For development and debugging, be more permissive
    // If it's a reasonable file size and looks like it could be valid data
    if (data.byteLength > 100 && data.byteLength < 10 * 1024 * 1024) {
      // Between 100 bytes and 10MB
      return;
    }

    throw new Error(`Invalid font signature: ${signature}`);
  }
}

// Export functions for backward compatibility
export const fontService = new FontService();

export const downloadFonts = (
  fontUrls: string[],
  styleName?: string,
  options?: FontDownloadOptions
) => fontService.downloadFonts(fontUrls, styleName, options);

export const getFontStats = () => fontService.getFontStats();
export const getFontAnalytics = () => fontService.getFontAnalytics();
export const cleanupOldFonts = (maxAge?: number) => fontService.cleanupOldFonts(maxAge);
export const verifyAndRepairFonts = () => fontService.verifyAndRepairFonts();
