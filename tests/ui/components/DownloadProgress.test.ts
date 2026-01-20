/**
 * Tests for DownloadProgress Component
 */

import { createDownloadProgressSection, DownloadProgress } from '../../../src/ui/components/DownloadProgress';

describe('DownloadProgress', () => {
  describe('createDownloadProgressSection', () => {
    it('should return hidden container when no downloads', () => {
      const downloads = new Map<string, DownloadProgress>();
      const container = createDownloadProgressSection({ downloads });

      expect(container).toBeInstanceOf(HTMLDivElement);
      expect(container.style.display).toBe('none');
    });

    it('should show container when there are downloads', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 50,
        total: 100,
        percentage: 50,
        currentResource: 'Downloading tiles...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.style.display).not.toBe('none');
    });

    it('should render download progress card for each download', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 50,
        total: 100,
        percentage: 50,
        currentResource: 'Downloading tiles...',
      });
      downloads.set('region-2', {
        regionId: 'region-2',
        completed: 75,
        total: 100,
        percentage: 75,
        currentResource: 'Downloading sprites...',
      });

      const container = createDownloadProgressSection({ downloads });
      const progressCards = container.querySelectorAll('.rounded-lg');

      // One section card + two progress cards
      expect(progressCards.length).toBeGreaterThanOrEqual(2);
    });

    it('should display region ID in progress card', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('my-region', {
        regionId: 'my-region',
        completed: 30,
        total: 100,
        percentage: 30,
        currentResource: 'Processing...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('my-region');
    });

    it('should display percentage', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 45,
        total: 100,
        percentage: 45,
        currentResource: 'Loading...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('45%');
    });

    it('should display current resource text', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 10,
        total: 100,
        percentage: 10,
        currentResource: 'Downloading font files...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('Downloading font files...');
    });

    it('should show green color for completed downloads (100%)', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 100,
        total: 100,
        percentage: 100,
        currentResource: 'Complete!',
      });

      const container = createDownloadProgressSection({ downloads });
      const greenElements = container.querySelectorAll('.text-green-600, .bg-green-600');

      expect(greenElements.length).toBeGreaterThan(0);
    });

    it('should show blue color for in-progress downloads', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 50,
        total: 100,
        percentage: 50,
        currentResource: 'In progress...',
      });

      const container = createDownloadProgressSection({ downloads });
      const blueElements = container.querySelectorAll('.text-blue-600, .bg-blue-600');

      expect(blueElements.length).toBeGreaterThan(0);
    });

    it('should have progress bar with correct width', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 75,
        total: 100,
        percentage: 75,
        currentResource: 'Loading...',
      });

      const container = createDownloadProgressSection({ downloads });
      const progressBar = container.querySelector('[style*="width: 75%"]');

      expect(progressBar).not.toBeNull();
    });

    it('should have Active Downloads header', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 50,
        total: 100,
        percentage: 50,
        currentResource: 'Loading...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('Active Downloads');
    });

    it('should handle zero percentage', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 0,
        total: 100,
        percentage: 0,
        currentResource: 'Starting...',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('0%');
    });

    it('should handle multiple downloads with different percentages', () => {
      const downloads = new Map<string, DownloadProgress>();
      downloads.set('region-1', {
        regionId: 'region-1',
        completed: 25,
        total: 100,
        percentage: 25,
        currentResource: 'Resource 1',
      });
      downloads.set('region-2', {
        regionId: 'region-2',
        completed: 100,
        total: 100,
        percentage: 100,
        currentResource: 'Complete',
      });

      const container = createDownloadProgressSection({ downloads });

      expect(container.textContent).toContain('25%');
      expect(container.textContent).toContain('100%');
      expect(container.textContent).toContain('Resource 1');
      expect(container.textContent).toContain('Complete');
    });
  });
});
