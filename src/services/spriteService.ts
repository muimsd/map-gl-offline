import { dbPromise } from '../storage/indexedDbManager';
import type {
  EnhancedSpriteStats,
  SpriteDownloadOptions,
  SpriteDownloadResult,
  SpriteEntry,
} from '../types';
import { fetchWithRetry, processBatch, createProgressTracker } from '../utils';

export class SpriteService {
  private db = dbPromise;

  async downloadSprites(
    spriteUrls: string[],
    styleName: string,
    options: SpriteDownloadOptions = {}
  ): Promise<SpriteDownloadResult> {
    const db = await this.db;
    const {
      _onProgress,
      batchSize = 5,
      maxRetries = 3,
      skipExisting = true,
      bandwidthLimit,
      prioritySprites = [],
      _storageQuotaCheck = true,
      enableValidation = true,
      timeoutMs = 15000,
      _includeMetadata = false,
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedSprites = 0;
    let skippedSprites = 0;
    let failedSprites = 0;
    const errors: Array<{ url: string; error: string }> = [];
    const spritesByType: Record<string, number> = {};
    let largestSprite = { name: '', size: 0 };
    let smallestSprite = { name: '', size: Infinity };

    // Create progress tracker
    const progressTracker = createProgressTracker(spriteUrls.length);

    // Sort URLs by priority
    const sortedUrls = [...spriteUrls].sort((a, b) => {
      const aName = this.extractSpriteName(a);
      const bName = this.extractSpriteName(b);
      const aPriority = prioritySprites.includes(aName);
      const bPriority = prioritySprites.includes(bName);

      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });

    // Filter existing sprites if skipExisting is true
    let urlsToDownload = sortedUrls;
    if (skipExisting) {
      const existingSprites = new Set();
      const tx = db.transaction(['sprites'], 'readonly');

      let cursor = await tx.objectStore('sprites').openCursor();

      while (cursor) {
        existingSprites.add(cursor.value.key);
        cursor = await cursor.continue();
      }

      urlsToDownload = sortedUrls.filter(url => {
        const key = this.createSpriteKey(url, styleName);
        return !existingSprites.has(key);
      });

      skippedSprites = spriteUrls.length - urlsToDownload.length;
    }

    // Check storage quota if enabled
    if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedSpace = estimate.usage || 0;
      const availableSpace = (estimate.quota || 0) - usedSpace;

      if (availableSpace < 100 * 1024 * 1024) {
        // Less than 100MB
        throw new Error('Insufficient storage space for sprite download');
      }
    }

    // Process sprites in batches
    console.warn(
      `Starting to download ${urlsToDownload.length} sprites in batches of ${batchSize}`
    );

    // Debug: Show all sprite URLs and their generated keys
    console.warn('Sprite URLs and their generated keys:');
    urlsToDownload.forEach(url => {
      const key = this.createSpriteKey(url, styleName);
      console.warn(`  ${url} -> ${key}`);
    });

    await processBatch(
      urlsToDownload,
      async spriteUrl => {
        try {
          const spriteName = this.extractSpriteName(spriteUrl);
          const spriteKey = this.createSpriteKey(spriteUrl, styleName);

          console.warn(`Downloading sprite: ${spriteUrl}`);

          progressTracker.update(1, spriteName);

          // Call progress callback if provided
          if (onProgress) {
            const progress = progressTracker.getProgress();
            onProgress({
              completed: progress.completed,
              total: progress.total,
              percentage: progress.percentage,
              message: `Downloading ${spriteName}`,
              errors: errors.map(e => e.error),
            });
          }

          // Apply bandwidth limiting if specified
          if (bandwidthLimit) {
            await this.rateLimitDelay(bandwidthLimit);
          }

          const response = await fetchWithRetry(spriteUrl, {
            retries: maxRetries,
            timeout: timeoutMs,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const spriteData = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/png';

          console.warn(
            `Downloaded sprite ${spriteUrl}: ${spriteData.byteLength} bytes, type: ${contentType}`
          );

          // Validate sprite if enabled
          if (enableValidation) {
            await this.validateSprite(spriteData, contentType);
          }

          // Create sprite entry
          const spriteEntry: SpriteEntry = {
            key: spriteKey,
            url: spriteUrl,
            data: spriteData,
            contentType,
            size: spriteData.byteLength,
            lastModified: Date.now(),
            downloadedAt: new Date().toISOString(),
          };

          console.warn(`Storing sprite with key: ${spriteKey} for URL: ${spriteUrl}`);

          // Store sprite in database
          await db.put('sprites', spriteEntry);

          // Verify the sprite was stored
          const storedSprite = await db.get('sprites', spriteKey);
          if (storedSprite) {
            console.warn(
              `✓ Verified sprite stored with key: ${spriteKey}, size: ${storedSprite.size} bytes`
            );
          } else {
            console.error(`✗ Failed to verify sprite storage for key: ${spriteKey}`);
          }

          // Show total sprite count in database
          const allSprites = await db.getAll('sprites');
          console.warn(`Database now contains ${allSprites.length} sprites total`);

          totalSize += spriteData.byteLength;
          downloadedSprites++;

          // Track sprite types and sizes
          const spriteType = this.detectSpriteType(contentType, spriteUrl);
          spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;

          if (spriteData.byteLength > largestSprite.size) {
            largestSprite = { name: spriteName, size: spriteData.byteLength };
          }
          if (spriteData.byteLength < smallestSprite.size) {
            smallestSprite = { name: spriteName, size: spriteData.byteLength };
          }
        } catch (_error) {
          failedSprites++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            url: spriteUrl,
            error: errorMessage,
          });
          console.error(`Failed to download sprite ${spriteUrl}:`, error);

          // Update progress even on failure
          if (onProgress) {
            const progress = progressTracker.getProgress();
            onProgress({
              completed: progress.completed,
              total: progress.total,
              percentage: progress.percentage,
              message: `Failed: ${this.extractSpriteName(spriteUrl)}`,
              errors: errors.map(e => e.error),
            });
          }
        }
      },
      { batchSize }
    );

    const duration = Date.now() - startTime;
    const downloadSpeed = duration > 0 ? (totalSize / duration) * 1000 : 0;

    // Final progress callback
    if (onProgress) {
      onProgress({
        completed: spriteUrls.length,
        total: spriteUrls.length,
        percentage: 100,
        message: `Sprite download complete: ${downloadedSprites} downloaded, ${failedSprites} failed`,
        errors: errors.map(e => e.error),
      });
    }

    console.warn(
      `Sprite download completed: ${downloadedSprites}/${spriteUrls.length} sprites downloaded in ${duration}ms`
    );

    return {
      totalSprites: spriteUrls.length,
      downloadedSprites,
      skippedSprites,
      failedSprites,
      totalSize,
      downloadSpeed,
      duration,
      errors,
      analytics: {
        spritesByType,
        averageSpriteSize: downloadedSprites > 0 ? totalSize / downloadedSprites : 0,
        largestSprite: largestSprite.size > 0 ? largestSprite : { name: '', size: 0 },
        smallestSprite: smallestSprite.size < Infinity ? smallestSprite : { name: '', size: 0 },
      },
    };
  }

  async getSpriteStats(): Promise<EnhancedSpriteStats> {
    const db = await this.db;

    let count = 0;
    let totalSize = 0;
    const sprites: Array<{
      name: string;
      size: number;
      type: string;
      lastModified?: number;
      metadata?: Record<string, unknown>;
    }> = [];
    const spritesByType: Record<string, number> = {};
    const sizeByType: Record<string, number> = {};
    const corruptedSprites: string[] = [];
    let oldestSprite: { name: string; lastModified: number } | undefined;
    let newestSprite: { name: string; lastModified: number } | undefined;

    const tx = db.transaction(['sprites'], 'readonly');
    let cursor = await tx.objectStore('sprites').openCursor();

    while (cursor) {
      const spriteEntry: SpriteEntry = cursor.value;
      count++;
      totalSize += spriteEntry.size;

      const spriteType = this.detectSpriteType(
        spriteEntry.contentType || 'image/png',
        spriteEntry.url
      );
      const spriteName = this.extractSpriteName(spriteEntry.url);

      sprites.push({
        name: spriteName,
        size: spriteEntry.size,
        type: spriteType,
        lastModified: spriteEntry.lastModified,
      });

      // Track by type
      spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;
      sizeByType[spriteType] = (sizeByType[spriteType] || 0) + spriteEntry.size;

      // Track oldest and newest
      if (!oldestSprite || spriteEntry.lastModified < oldestSprite.lastModified) {
        oldestSprite = { name: spriteName, lastModified: spriteEntry.lastModified };
      }
      if (!newestSprite || spriteEntry.lastModified > newestSprite.lastModified) {
        newestSprite = { name: spriteName, lastModified: spriteEntry.lastModified };
      }

      // Basic corruption check
      if (spriteEntry.size === 0 || !spriteEntry.data) {
        corruptedSprites.push(spriteEntry.key);
      }

      cursor = await cursor.continue();
    }

    return {
      count,
      totalSize,
      averageSize: count > 0 ? totalSize / count : 0,
      sprites,
      spritesByType,
      sizeByType,
      oldestSprite,
      newestSprite,
      corruptedSprites,
    };
  }

  async getSpriteAnalytics(): Promise<Record<string, unknown>> {
    const stats = await this.getSpriteStats();

    return {
      basic: {
        totalSprites: stats.count,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
      },
      distribution: {
        spritesByType: stats.spritesByType,
        sizeByType: stats.sizeByType,
      },
      health: {
        corruptedSprites: stats.corruptedSprites.length,
        corruptionRate: stats.count > 0 ? (stats.corruptedSprites.length / stats.count) * 100 : 0,
      },
      temporal: {
        oldestSprite: stats.oldestSprite,
        newestSprite: stats.newestSprite,
        ageSpan:
          stats.oldestSprite && stats.newestSprite
            ? stats.newestSprite.lastModified - stats.oldestSprite.lastModified
            : 0,
      },
    };
  }

  async cleanupOldSprites(maxAge: number = 30): Promise<number> {
    const db = await this.db;
    const cutoffTime = Date.now() - maxAge * 24 * 60 * 60 * 1000;

    const tx = db.transaction(['sprites'], 'readwrite');
    let deletedCount = 0;

    let cursor = await tx.objectStore('sprites').openCursor();

    while (cursor) {
      const spriteEntry: SpriteEntry = cursor.value;
      if (spriteEntry.lastModified < cutoffTime) {
        await cursor.delete();
        deletedCount++;
      }
      cursor = await cursor.continue();
    }

    return deletedCount;
  }

  async verifyAndRepairSprites(): Promise<{ verified: number; repaired: number; removed: number }> {
    const db = await this.db;
    const tx = db.transaction(['sprites'], 'readwrite');

    let verified = 0;
    let repaired = 0;
    let removed = 0;

    let cursor = await tx.objectStore('sprites').openCursor();

    while (cursor) {
      const spriteEntry: SpriteEntry = cursor.value;

      try {
        // Basic validation
        if (!spriteEntry.data || spriteEntry.size === 0) {
          await cursor.delete();
          removed++;
        } else {
          await this.validateSprite(spriteEntry.data, spriteEntry.contentType || 'image/png');
          verified++;
        }
      } catch (_error) {
        // Try to repair by re-downloading
        try {
          const response = await fetch(spriteEntry.url);
          if (response.ok) {
            const newData = await response.arrayBuffer();
            const repairedEntry = {
              ...spriteEntry,
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

  private createSpriteKey(url: string, styleName: string): string {
    // Create a consistent key from the style name and sprite URL
    // Format: stylename:spritename.extension
    const spriteName = this.extractSpriteName(url);

    return `${styleName}:${spriteName}`;
  }

  private extractSpriteName(url?: string): string {
    // Extract sprite name from URL, including variants like @2x
    if (!url || typeof url !== 'string') {
      return 'unknown';
    }

    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const nameWithExtension = filename.split('.')[0] || 'unknown';

    // Handle sprite variants (e.g., sprite, sprite@2x)
    // If it's just "sprite", add the file extension to differentiate JSON from PNG
    const extension = filename.split('.').pop()?.toLowerCase();
    if (nameWithExtension === 'sprite') {
      return extension === 'json' ? 'sprite.json' : `sprite.${extension}`;
    } else if (nameWithExtension.includes('@')) {
      // For sprite@2x, add extension to differentiate JSON from PNG
      return extension === 'json'
        ? `${nameWithExtension}.json`
        : `${nameWithExtension}.${extension}`;
    }

    return nameWithExtension;
  }

  private detectSpriteType(contentType: string, url?: string): string {
    // Handle undefined or null contentType
    if (contentType && typeof contentType === 'string') {
      if (contentType.includes('json')) return 'json';
      if (contentType.includes('png')) return 'png';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpeg';
      if (contentType.includes('webp')) return 'webp';
      if (contentType.includes('svg')) return 'svg';
    }

    // Fallback to URL extension if url is provided
    const extension = url ? url.split('.').pop()?.toLowerCase() : undefined;
    if (extension === 'json') return 'json';
    if (extension === 'png') return 'png';
    if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
    if (extension === 'webp') return 'webp';
    if (extension === 'svg') return 'svg';

    return 'unknown';
  }

  private async validateSprite(data: ArrayBuffer, contentType: string): Promise<void> {
    const view = new Uint8Array(data);

    if (view.length < 8) {
      throw new Error('Sprite data too short');
    }

    // Check for valid image signatures
    if (contentType.includes('png')) {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (view[0] !== 0x89 || view[1] !== 0x50 || view[2] !== 0x4e || view[3] !== 0x47) {
        throw new Error('Invalid PNG signature');
      }
    } else if (contentType.includes('jpeg')) {
      // JPEG signature: FF D8 FF
      if (view[0] !== 0xff || view[1] !== 0xd8 || view[2] !== 0xff) {
        throw new Error('Invalid JPEG signature');
      }
    } else if (contentType.includes('webp')) {
      // WebP signature: RIFF ... WEBP
      if (view[0] !== 0x52 || view[1] !== 0x49 || view[2] !== 0x46 || view[3] !== 0x46) {
        throw new Error('Invalid WebP signature');
      }
    }
  }

  private async extractSpriteMetadata(
    data: ArrayBuffer,
    contentType: string
  ): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
      format: this.detectSpriteType(contentType, ''),
      compressionRatio: 0.8, // Estimated
    };

    // For PNG files, we could extract more detailed metadata
    if (contentType.includes('png')) {
      metadata.spritesheet = this.isProbablySpritesheet(data);
    }

    return metadata;
  }

  private isProbablySpritesheet(data: ArrayBuffer): boolean {
    // Simple heuristic: larger files are more likely to be spritesheets
    return data.byteLength > 50 * 1024; // 50KB threshold
  }

  private async rateLimitDelay(bandwidthLimit: number): Promise<void> {
    // Simple rate limiting implementation
    const delay = Math.max(0, 1000 / (bandwidthLimit / 1024)); // Convert to KB/s
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Export singleton instance and functions for backward compatibility
export const spriteService = new SpriteService();

export const downloadSprites = (
  spriteUrls: string[],
  styleName: string,
  options?: SpriteDownloadOptions
) => spriteService.downloadSprites(spriteUrls, styleName, options);

export const getSpriteStats = () => spriteService.getSpriteStats();
export const getSpriteAnalytics = () => spriteService.getSpriteAnalytics();
export const cleanupOldSprites = (maxAge?: number) => spriteService.cleanupOldSprites(maxAge);
export const verifyAndRepairSprites = () => spriteService.verifyAndRepairSprites();
