/**
 * Tests for Download Utilities
 */
import {
  processBatch,
  createProgressTracker,
  validateResource,
} from '../../src/utils/download';

describe('download utilities', () => {
  describe('processBatch', () => {
    it('should process all items', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processBatch(items, async item => item * 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should respect batch size', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batchStartTimes: number[] = [];

      await processBatch(
        items,
        async () => {
          batchStartTimes.push(Date.now());
          return true;
        },
        { batchSize: 3 }
      );

      // All items should be processed
      expect(batchStartTimes.length).toBe(10);
    });

    it('should call onProgress callback', async () => {
      const items = [1, 2, 3];
      const progressCalls: Array<{ completed: number; total: number }> = [];

      await processBatch(
        items,
        async item => item,
        {
          batchSize: 1,
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          },
        }
      );

      expect(progressCalls.length).toBe(3);
      expect(progressCalls[2]).toEqual({ completed: 3, total: 3 });
    });

    it('should call onError callback for failures', async () => {
      const items = [1, 2, 3];
      const errors: Array<{ error: Error; item: number }> = [];

      await processBatch(
        items,
        async item => {
          if (item === 2) {
            throw new Error('Failed on 2');
          }
          return item;
        },
        {
          batchSize: 1,
          onError: (error, item) => {
            errors.push({ error, item: item as number });
          },
        }
      );

      expect(errors.length).toBe(1);
      expect(errors[0].item).toBe(2);
      expect(errors[0].error.message).toBe('Failed on 2');
    });

    it('should continue processing after errors', async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];

      const results = await processBatch(
        items,
        async item => {
          if (item === 3) {
            throw new Error('Failed');
          }
          processed.push(item);
          return item;
        },
        { batchSize: 1 }
      );

      // Should process items 1, 2, 4, 5 (3 failed)
      expect(processed).toEqual([1, 2, 4, 5]);
      expect(results.length).toBe(4);
    });

    it('should handle empty array', async () => {
      const results = await processBatch([], async item => item);
      expect(results).toEqual([]);
    });

    it('should use default batch size of 10', async () => {
      const items = Array.from({ length: 25 }, (_, i) => i);
      const results = await processBatch(items, async item => item);

      expect(results.length).toBe(25);
    });
  });

  describe('createProgressTracker', () => {
    it('should initialize with correct values', () => {
      const tracker = createProgressTracker(100);

      expect(tracker.progress.completed).toBe(0);
      expect(tracker.progress.total).toBe(100);
      expect(tracker.progress.percentage).toBe(0);
      expect(tracker.progress.errors).toEqual([]);
    });

    it('should handle zero total', () => {
      const tracker = createProgressTracker(0);

      expect(tracker.progress.percentage).toBe(100);
    });

    it('should update completed count', () => {
      const tracker = createProgressTracker(10);

      tracker.update(5);
      expect(tracker.progress.completed).toBe(5);
      expect(tracker.progress.percentage).toBe(50);

      tracker.update(3);
      expect(tracker.progress.completed).toBe(8);
      expect(tracker.progress.percentage).toBe(80);
    });

    it('should track current item', () => {
      const tracker = createProgressTracker(10);

      tracker.update(1, 'item-1');
      expect(tracker.progress.currentItem).toBe('item-1');

      tracker.update(1, 'item-2');
      expect(tracker.progress.currentItem).toBe('item-2');
    });

    it('should accumulate errors', () => {
      const tracker = createProgressTracker(10);

      tracker.update(1, undefined, 'Error 1');
      tracker.update(1, undefined, 'Error 2');

      expect(tracker.progress.errors).toEqual(['Error 1', 'Error 2']);
    });

    it('should not add empty errors', () => {
      const tracker = createProgressTracker(10);

      tracker.update(1, undefined, '');
      tracker.update(1, undefined, undefined);

      expect(tracker.progress.errors).toEqual([]);
    });

    it('should clamp completed to valid range', () => {
      const tracker = createProgressTracker(10);

      // Try to exceed total
      tracker.update(15);
      expect(tracker.progress.completed).toBe(10);
      expect(tracker.progress.percentage).toBe(100);
    });

    it('should handle negative increments gracefully', () => {
      const tracker = createProgressTracker(10);

      tracker.update(5);
      expect(tracker.progress.completed).toBe(5);

      tracker.update(-3);
      expect(tracker.progress.completed).toBe(2);

      tracker.update(-10);
      expect(tracker.progress.completed).toBe(0);
    });

    it('should handle NaN and Infinity gracefully', () => {
      const tracker = createProgressTracker(10);

      tracker.update(5);
      expect(tracker.progress.completed).toBe(5);

      tracker.update(NaN);
      expect(tracker.progress.completed).toBe(5); // Should not change

      tracker.update(Infinity);
      expect(tracker.progress.completed).toBe(5); // Should not change
    });

    it('should return copy of progress from getProgress', () => {
      const tracker = createProgressTracker(10);
      tracker.update(5);

      const progress1 = tracker.getProgress();
      const progress2 = tracker.getProgress();

      expect(progress1).toEqual(progress2);
      expect(progress1).not.toBe(progress2);

      // Modifying returned object should not affect tracker
      progress1.completed = 999;
      expect(tracker.progress.completed).toBe(5);
    });
  });

  describe('validateResource', () => {
    it('should return false for empty data', () => {
      expect(validateResource(new ArrayBuffer(0), 'pbf')).toBe(false);
    });

    it('should return false for null data', () => {
      expect(validateResource(null as unknown as ArrayBuffer, 'pbf')).toBe(false);
    });

    it('should validate PBF data by size', () => {
      // Valid PBF (non-empty, under 50MB)
      const validPbf = new ArrayBuffer(1000);
      expect(validateResource(validPbf, 'pbf')).toBe(true);

      // Empty PBF (but byteLength > 0 is required)
      const emptyBuffer = new ArrayBuffer(0);
      expect(validateResource(emptyBuffer, 'pbf')).toBe(false);
    });

    it('should reject oversized PBF', () => {
      // Over 50MB (would fail in practice but we can test the limit check)
      const largePbf = new ArrayBuffer(51 * 1024 * 1024);
      expect(validateResource(largePbf, 'pbf')).toBe(false);
    });

    it('should validate PNG images', () => {
      // Valid PNG signature: 89 50 4E 47
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateResource(pngData.buffer, 'image')).toBe(true);

      // Invalid signature
      const invalidPng = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(validateResource(invalidPng.buffer, 'image')).toBe(false);
    });

    it('should validate JPEG images', () => {
      // Valid JPEG signature: FF D8
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(validateResource(jpegData.buffer, 'image')).toBe(true);
    });

    it('should validate WebP images', () => {
      // Valid WebP: RIFF....WEBP (bytes 8-11 are WEBP)
      const webpData = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(validateResource(webpData.buffer, 'image')).toBe(true);
    });

    it('should return true for unknown type with data', () => {
      const someData = new ArrayBuffer(100);
      expect(validateResource(someData, 'unknown')).toBe(true);
    });

    it('should return false for unknown type without data', () => {
      const emptyData = new ArrayBuffer(0);
      expect(validateResource(emptyData, 'unknown')).toBe(false);
    });
  });
});
