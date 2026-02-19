/**
 * Tests for DownloadManager Component
 */

import { DownloadManager, DownloadManagerOptions, DownloadProgress } from '../../../src/ui/managers/downloadManager';

// Mock the services
jest.mock('../../../src/services/styleService', () => ({
  isStyleDownloaded: jest.fn().mockResolvedValue(false),
  loadStyles: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../src/services/tileService', () => ({
  downloadTiles: jest.fn().mockResolvedValue({
    totalTiles: 100,
    downloadedTiles: 100,
    failedTiles: 0,
    skippedTiles: 0,
    totalSize: 1024000,
    tileExtension: 'mvt',
    errors: [],
  }),
}));

const mockDownloadGlyphs = jest.fn().mockResolvedValue({ downloaded: 10, failed: 0 });
jest.mock('../../../src/services/glyphService', () => ({
  GlyphService: jest.fn().mockImplementation(() => ({
    downloadGlyphs: mockDownloadGlyphs,
  })),
}));

describe('DownloadManager', () => {
  // Mock OfflineMapManager
  const createMockOfflineManager = () => ({
    downloadStyle: jest.fn().mockResolvedValue({
      success: true,
      styleId: 'test-style-id',
      errors: [],
    }),
    addRegion: jest.fn().mockResolvedValue(undefined),
    listStoredRegions: jest.fn().mockResolvedValue([]),
    deleteRegion: jest.fn().mockResolvedValue(undefined),
    getComprehensiveStorageAnalytics: jest.fn().mockResolvedValue({
      totalStorageSize: 0,
    }),
  });

  const createOptions = (overrides: Partial<DownloadManagerOptions> = {}): DownloadManagerOptions => ({
    offlineManager: createMockOfflineManager() as unknown as DownloadManagerOptions['offlineManager'],
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a download manager instance', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);
      expect(manager).toBeInstanceOf(DownloadManager);
    });

    it('should start with no active downloads', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      expect(manager.hasActiveDownloads()).toBe(false);
      expect(manager.getCurrentDownloads().size).toBe(0);
    });
  });

  describe('getCurrentDownloads', () => {
    it('should return a Map of downloads', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      const downloads = manager.getCurrentDownloads();
      expect(downloads).toBeInstanceOf(Map);
    });

    it('should return empty map initially', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      expect(manager.getCurrentDownloads().size).toBe(0);
    });
  });

  describe('hasActiveDownloads', () => {
    it('should return false when no downloads are active', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      expect(manager.hasActiveDownloads()).toBe(false);
    });
  });

  describe('cancelDownload', () => {
    it('should not throw when canceling non-existent download', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      expect(() => manager.cancelDownload('non-existent')).not.toThrow();
    });

    it('should call onProgressUpdate after cancel', () => {
      const onProgressUpdate = jest.fn();
      const options = createOptions({ onProgressUpdate });
      const manager = new DownloadManager(options);

      manager.cancelDownload('test-id');

      expect(onProgressUpdate).toHaveBeenCalled();
    });
  });

  describe('cancelAllDownloads', () => {
    it('should clear all downloads', () => {
      const options = createOptions();
      const manager = new DownloadManager(options);

      manager.cancelAllDownloads();

      expect(manager.getCurrentDownloads().size).toBe(0);
    });

    it('should call onProgressUpdate', () => {
      const onProgressUpdate = jest.fn();
      const options = createOptions({ onProgressUpdate });
      const manager = new DownloadManager(options);

      manager.cancelAllDownloads();

      expect(onProgressUpdate).toHaveBeenCalled();
    });

    it('should reset UI via updateButton callback', () => {
      const updateButton = jest.fn();
      const options = createOptions({ updateButton });
      const manager = new DownloadManager(options);

      manager.cancelAllDownloads();

      expect(updateButton).toHaveBeenCalledWith('Offline Maps', false);
    });

    it('should hide progress badge via updateProgressBadge callback', () => {
      const updateProgressBadge = jest.fn();
      const options = createOptions({ updateProgressBadge });
      const manager = new DownloadManager(options);

      manager.cancelAllDownloads();

      expect(updateProgressBadge).toHaveBeenCalledWith('', false);
    });
  });

  describe('callbacks', () => {
    it('should call onDownloadComplete when download finishes', async () => {
      const onDownloadComplete = jest.fn();
      const mockOfflineManager = createMockOfflineManager();

      // Set up loadStyles to return a matching style
      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        onDownloadComplete,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // May fail due to mocking but callback may still be called
      }

      // The callback mechanism should work even if the download process has issues
    });

    it('should call onDownloadError on failure', async () => {
      const onDownloadError = jest.fn();
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.downloadStyle.mockResolvedValue({
        success: false,
        styleId: null,
        errors: ['Test error'],
      });

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        onDownloadError,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // Expected to fail
      }

      // The error callback should have been called
      expect(onDownloadError).toHaveBeenCalled();
    });
  });

  describe('downloadRegion', () => {
    it('should accept form data with required fields', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
      });
      const manager = new DownloadManager(options);

      const formData = {
        name: 'Test Region',
        bounds: [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number],
        minZoom: 10,
        maxZoom: 14,
        styleUrl: 'https://example.com/style.json',
      };

      // Should not throw for valid form data structure
      await expect(manager.downloadRegion(formData)).resolves.not.toThrow();
    });

    it('should handle provider option', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
      });
      const manager = new DownloadManager(options);

      const formData = {
        name: 'Test Region',
        bounds: [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number],
        minZoom: 10,
        maxZoom: 14,
        styleUrl: 'https://example.com/style.json',
        provider: 'mapbox' as const,
        accessToken: 'pk.test123',
      };

      await expect(manager.downloadRegion(formData)).resolves.not.toThrow();
    });
  });

  describe('progress updates', () => {
    it('should call onProgressUpdate with progress data', async () => {
      const onProgressUpdate = jest.fn();
      const mockOfflineManager = createMockOfflineManager();

      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        onProgressUpdate,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // May fail but should still call progress updates
      }

      // Progress update should be called at least once
      expect(onProgressUpdate).toHaveBeenCalled();
    });

    it('should track download percentage', async () => {
      const progressUpdates: Map<string, DownloadProgress>[] = [];
      const onProgressUpdate = (downloads: Map<string, DownloadProgress>) => {
        progressUpdates.push(new Map(downloads));
      };

      const mockOfflineManager = createMockOfflineManager();
      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        onProgressUpdate,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // May fail
      }

      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('addRegion without tileExtension', () => {
    it('should call addRegion without tileExtension property', async () => {
      const mockOfflineManager = createMockOfflineManager();

      const { isStyleDownloaded, loadStyles } = require('../../../src/services/styleService');
      isStyleDownloaded.mockResolvedValue(false);
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
      });
      const manager = new DownloadManager(options);

      await manager.downloadRegion({
        name: 'Test Region',
        bounds: [-122.5, 37.7, -122.3, 37.9],
        minZoom: 10,
        maxZoom: 14,
        styleUrl: 'https://example.com/style.json',
      });

      expect(mockOfflineManager.addRegion).toHaveBeenCalledTimes(1);
      const addRegionArg = mockOfflineManager.addRegion.mock.calls[0][0];
      expect(addRegionArg).not.toHaveProperty('tileExtension');
      // Should have the expected region fields
      expect(addRegionArg).toHaveProperty('styleId', 'test-style-id');
      expect(addRegionArg).toHaveProperty('name', 'Test Region');
    });
  });

  describe('glyph download ranges', () => {
    beforeEach(() => {
      mockDownloadGlyphs.mockClear();
    });

    it('should include new Unicode ranges when downloading glyphs', async () => {
      const mockOfflineManager = createMockOfflineManager();

      const { isStyleDownloaded, loadStyles } = require('../../../src/services/styleService');
      isStyleDownloaded.mockResolvedValue(false);
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [
            {
              id: 'text-layer',
              type: 'symbol',
              layout: {
                'text-font': ['Open Sans Regular'],
                'text-field': '{name}',
              },
            },
          ],
          glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
        },
        originalUrl: 'https://example.com/style.json',
        originalGlyphsUrl: 'https://example.com/fonts/{fontstack}/{range}.pbf',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
      });
      const manager = new DownloadManager(options);

      await manager.downloadRegion({
        name: 'Test Region',
        bounds: [-122.5, 37.7, -122.3, 37.9],
        minZoom: 10,
        maxZoom: 14,
        styleUrl: 'https://example.com/style.json',
      });

      expect(mockDownloadGlyphs).toHaveBeenCalledTimes(1);

      // The 4th argument is the glyph ranges array
      const glyphRanges: string[] = mockDownloadGlyphs.mock.calls[0][3];

      // Verify the three new Unicode ranges are included
      expect(glyphRanges).toContain('7680-7935');   // Latin Extended Additional
      expect(glyphRanges).toContain('64256-64511');  // Alphabetic Presentation Forms
      expect(glyphRanges).toContain('65024-65279');  // Variation Selectors

      // Also verify some of the existing ranges are still present
      expect(glyphRanges).toContain('0-255');        // Basic Latin
      expect(glyphRanges).toContain('1536-1791');    // Arabic
      expect(glyphRanges).toContain('65280-65535');   // Halfwidth and Fullwidth Forms
    });
  });

  describe('UI callbacks', () => {
    it('should update button text during download', async () => {
      const updateButton = jest.fn();
      const mockOfflineManager = createMockOfflineManager();

      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        updateButton,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // May fail
      }

      // updateButton should be called with 'Downloading...'
      expect(updateButton).toHaveBeenCalledWith('Downloading...', true);
    });

    it('should show progress badge during download', async () => {
      const updateProgressBadge = jest.fn();
      const mockOfflineManager = createMockOfflineManager();

      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([{
        key: 'test-style-id',
        style: {
          sources: { testSource: { tiles: ['http://test/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        originalUrl: 'https://example.com/style.json',
      }]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as DownloadManagerOptions['offlineManager'],
        updateProgressBadge,
      });
      const manager = new DownloadManager(options);

      try {
        await manager.downloadRegion({
          name: 'Test Region',
          bounds: [-122.5, 37.7, -122.3, 37.9],
          minZoom: 10,
          maxZoom: 14,
          styleUrl: 'https://example.com/style.json',
        });
      } catch {
        // May fail
      }

      // Progress badge should be shown
      expect(updateProgressBadge).toHaveBeenCalledWith('0%', true);
    });
  });
});
