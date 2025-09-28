import { dbPromise } from '../storage/indexedDbManager';
import { fetchWithRetry } from '../utils';
import type { GlyphDownloadOptions, GlyphDownloadResult, GlyphEntry, GlyphRange } from '../types';

export interface EnhancedGlyphStats {
  count: number;
  totalSize: number;
  averageSize: number;
  glyphs: Array<{
    fontstack: string;
    range: string;
    size: number;
    lastModified: number;
    metadata?: Record<string, unknown>;
  }>;
  fontsByStack: Record<string, number>;
  sizeByStack: Record<string, number>;
  oldestGlyph?: { fontstack: string; range: string; lastModified: number };
  newestGlyph?: { fontstack: string; range: string; lastModified: number };
  corruptedGlyphs: string[];
}

export class GlyphService {
  private db = dbPromise;

  async downloadGlyphs(
    glyphUrl: string,
    fontstacks: string[],
    styleName?: string,
    ranges: string[] = ['0-255'],
    options: GlyphDownloadOptions = {}
  ): Promise<GlyphDownloadResult> {
    const db = await this.db;
    const {
      maxConcurrency = 5,
      retries = 3,
      timeout = 10000,
      onProgress,
      enableValidation = true,
      priorityFonts = [],
    } = options;

    const startTime = Date.now();
    let totalSize = 0;
    let downloadedGlyphs = 0;
    let skippedGlyphs = 0;
    let failedGlyphs = 0;
    const errors: string[] = [];
    const fontsByStack: Record<string, number> = {};
    let largestGlyph = { fontstack: '', range: '', size: 0 };
    let smallestGlyph = { fontstack: '', range: '', size: Infinity };

    // Generate all combinations of fontstacks and ranges
    const glyphTasks: Array<{ fontstack: string; range: string }> = [];
    for (const fontstack of fontstacks) {
      for (const range of ranges) {
        glyphTasks.push({ fontstack, range });
      }
    }

    // Sort by priority
    glyphTasks.sort((a, b) => {
      const aPriority = priorityFonts.includes(a.fontstack);
      const bPriority = priorityFonts.includes(b.fontstack);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      return 0;
    });

    const total = glyphTasks.length;
    let completed = 0;

    // Process glyphs with concurrency control
    const semaphore = new Array(maxConcurrency).fill(0);
    const promises = semaphore.map(async () => {
      while (glyphTasks.length > 0) {
        const task = glyphTasks.shift();
        if (!task) break;

        const { fontstack, range } = task;
        const glyphKey = this.createGlyphKey(fontstack, range, styleName);

        try {
          // Check if glyph already exists
          const existingGlyph = await this.getGlyph(fontstack, range);
          if (existingGlyph) {
            skippedGlyphs++;
            completed++;
            onProgress?.({ completed, total, currentFont: fontstack });
            continue;
          }

          // Download glyph
          const url = glyphUrl
            .replace('{fontstack}', encodeURIComponent(fontstack))
            .replace('{range}', range);

          const response = await fetchWithRetry(url, { retries, timeout });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.arrayBuffer();
          // Response content type checked but not used

          // Validate glyph data if enabled
          if (enableValidation) {
            this.validateGlyphData(data);
          }

          // Create glyph entry
          const glyphEntry: GlyphEntry = {
            key: glyphKey,
            data,
            url,
            size: data.byteLength,
            lastModified: Date.now(),
            downloadedAt: new Date().toISOString(),
          };

          // Store in database
          await db.put('glyphs', glyphEntry);

          totalSize += data.byteLength;
          downloadedGlyphs++;
          fontsByStack[fontstack] = (fontsByStack[fontstack] || 0) + 1;

          // Track largest and smallest glyphs
          if (data.byteLength > largestGlyph.size) {
            largestGlyph = { fontstack, range, size: data.byteLength };
          }
          if (data.byteLength < smallestGlyph.size) {
            smallestGlyph = { fontstack, range, size: data.byteLength };
          }
        } catch (error) {
          failedGlyphs++;
          errors.push(`${glyphKey}: ${error instanceof Error ? error.message : String(error)}`);
        }

        completed++;
        onProgress?.({ completed, total, currentFont: fontstack });
      }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const downloadSpeed = duration > 0 ? (totalSize / duration) * 1000 : 0;

    return {
      totalGlyphs: total,
      downloadedGlyphs,
      skippedGlyphs,
      failedGlyphs,
      totalSize,
      downloadSpeed,
      duration,
      errors,
      analytics: {
        fontsByStack,
        averageGlyphSize: downloadedGlyphs > 0 ? totalSize / downloadedGlyphs : 0,
        largestGlyph: largestGlyph.size > 0 ? largestGlyph : { fontstack: '', range: '', size: 0 },
        smallestGlyph:
          smallestGlyph.size < Infinity ? smallestGlyph : { fontstack: '', range: '', size: 0 },
      },
    };
  }

  async loadGlyphs(fontstack: string, ranges: string[]): Promise<GlyphRange[]> {
    const glyphRanges: GlyphRange[] = [];

    for (const range of ranges) {
      const glyph = await this.getGlyph(fontstack, range);
      if (glyph) {
        const [start, end] = range.split('-').map(Number);
        glyphRanges.push({
          start,
          end,
          data: glyph.data,
          contentType: 'application/x-protobuf', // Default since it's not stored in GlyphEntry
        });
      }
    }

    return glyphRanges;
  }

  async getGlyph(fontstack: string, range: string): Promise<GlyphEntry | null> {
    const db = await this.db;
    const key = `${fontstack}/${range}`;

    const glyph = await db.get('glyphs', key);
    return glyph || null;
  }

  async getGlyphStats(): Promise<EnhancedGlyphStats> {
    const db = await this.db;

    let count = 0;
    let totalSize = 0;
    const glyphs: Array<{
      fontstack: string;
      range: string;
      size: number;
      lastModified: number;
      metadata?: Record<string, unknown>;
    }> = [];
    const fontsByStack: Record<string, number> = {};
    const sizeByStack: Record<string, number> = {};
    const corruptedGlyphs: string[] = [];
    let oldestGlyph: { fontstack: string; range: string; lastModified: number } | undefined;
    let newestGlyph: { fontstack: string; range: string; lastModified: number } | undefined;

    const tx = db.transaction('glyphs', 'readonly');
    for await (const cursor of tx.store) {
      const glyphEntry: GlyphEntry = cursor.value;
      count++;
      totalSize += glyphEntry.size;

      // Parse fontstack and range from key (format: "fontstack/range")
      const [fontstack, range] = glyphEntry.key.split('/');

      glyphs.push({
        fontstack,
        range,
        size: glyphEntry.size,
        lastModified: glyphEntry.lastModified,
        metadata: {}, // No metadata in basic GlyphEntry
      });

      // Track by fontstack
      fontsByStack[fontstack] = (fontsByStack[fontstack] || 0) + 1;
      sizeByStack[fontstack] = (sizeByStack[fontstack] || 0) + glyphEntry.size;

      // Track oldest and newest
      if (!oldestGlyph || glyphEntry.lastModified < oldestGlyph.lastModified) {
        oldestGlyph = {
          fontstack,
          range,
          lastModified: glyphEntry.lastModified,
        };
      }
      if (!newestGlyph || glyphEntry.lastModified > newestGlyph.lastModified) {
        newestGlyph = {
          fontstack,
          range,
          lastModified: glyphEntry.lastModified,
        };
      }

      // Basic corruption check
      if (glyphEntry.size === 0 || !glyphEntry.data) {
        corruptedGlyphs.push(glyphEntry.key);
      }
    }

    return {
      count,
      totalSize,
      averageSize: count > 0 ? totalSize / count : 0,
      glyphs,
      fontsByStack,
      sizeByStack,
      oldestGlyph,
      newestGlyph,
      corruptedGlyphs,
    };
  }

  async getGlyphAnalytics(): Promise<Record<string, unknown>> {
    const stats = await this.getGlyphStats();

    return {
      basic: {
        totalGlyphs: stats.count,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
      },
      distribution: {
        fontsByStack: stats.fontsByStack,
        sizeByStack: stats.sizeByStack,
      },
      health: {
        corruptedGlyphs: stats.corruptedGlyphs.length,
        corruptionRate: stats.count > 0 ? (stats.corruptedGlyphs.length / stats.count) * 100 : 0,
      },
      temporal: {
        oldestGlyph: stats.oldestGlyph,
        newestGlyph: stats.newestGlyph,
        ageSpan:
          stats.oldestGlyph && stats.newestGlyph
            ? stats.newestGlyph.lastModified - stats.oldestGlyph.lastModified
            : 0,
      },
    };
  }

  async cleanupOldGlyphs(maxAge: number = 30): Promise<number> {
    const db = await this.db;
    const cutoffTime = Date.now() - maxAge * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    const tx = db.transaction('glyphs', 'readwrite');
    for await (const cursor of tx.store) {
      const glyphEntry: GlyphEntry = cursor.value;
      if (glyphEntry.lastModified < cutoffTime) {
        await cursor.delete();
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async verifyAndRepairGlyphs(): Promise<{ verified: number; repaired: number; removed: number }> {
    const db = await this.db;

    let verified = 0;
    const repaired = 0;
    let removed = 0;

    const tx = db.transaction('glyphs', 'readwrite');
    for await (const cursor of tx.store) {
      const glyphEntry: GlyphEntry = cursor.value;

      try {
        // Basic validation
        if (!glyphEntry.data || glyphEntry.size === 0) {
          await cursor.delete();
          removed++;
        } else {
          this.validateGlyphData(glyphEntry.data);
          verified++;
        }
      } catch {
        // Remove corrupted glyphs (they can be re-downloaded)
        await cursor.delete();
        removed++;
      }
    }

    return { verified, repaired, removed };
  }

  private validateGlyphData(data: ArrayBuffer): void {
    if (data.byteLength < 10) {
      throw new Error('Glyph data too short');
    }

    // Basic Protocol Buffer validation
    const view = new Uint8Array(data);

    // Check for valid protobuf structure (basic check)
    if (view[0] === 0x00 && view[1] === 0x00 && view[2] === 0x00 && view[3] === 0x00) {
      throw new Error('Invalid glyph data - appears to be empty');
    }
  }

  private countGlyphsInData(data: ArrayBuffer): number {
    // This would require proper protobuf parsing
    // For now, return estimated count based on size
    return Math.floor(data.byteLength / 50); // Rough estimate
  }

  private calculateCompressionRatio(data: ArrayBuffer): number {
    // Simple estimation - would need actual uncompressed size for accuracy
    return data.byteLength > 1000 ? 0.3 : 0.8;
  }

  private createGlyphKey(fontstack: string, range: string, styleName?: string): string {
    // Create a consistent key from the style name, fontstack and range
    // Format: stylename:fontstack_range.pbf (if styleName provided) or fontstack/range
    if (styleName) {
      return `${styleName}:${fontstack}_${range}.pbf`;
    }

    // Fallback to original format for backward compatibility
    return `${fontstack}/${range}`;
  }
}

// Export singleton instance and functions for backward compatibility
export const glyphService = new GlyphService();

export const downloadGlyphs = (
  glyphUrl: string,
  fontstacks: string[],
  styleName?: string,
  ranges?: string[],
  options?: GlyphDownloadOptions
) => glyphService.downloadGlyphs(glyphUrl, fontstacks, styleName, ranges, options);

export const loadGlyphs = (fontstack: string, ranges: string[]) =>
  glyphService.loadGlyphs(fontstack, ranges);

export const getGlyphStats = () => glyphService.getGlyphStats();
export const getGlyphAnalytics = () => glyphService.getGlyphAnalytics();
export const cleanupOldGlyphs = (maxAge?: number) => glyphService.cleanupOldGlyphs(maxAge);
export const verifyAndRepairGlyphs = () => glyphService.verifyAndRepairGlyphs();
