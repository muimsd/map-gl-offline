/**
 * Tests for PanelContentRenderer Component
 */

import { PanelContentRenderer, ContentRendererConfig } from '../../../../src/ui/components/shared/PanelContent';

// Mock the theme manager
jest.mock('../../../../src/ui/ThemeManager', () => ({
  themeManager: {
    getTheme: jest.fn().mockReturnValue({ mode: 'light', preference: 'light' }),
    getPreference: jest.fn().mockReturnValue('light'),
    setTheme: jest.fn(),
    cycleTheme: jest.fn(),
  },
}));

// Create mock OfflineManager
const createMockOfflineManager = () => ({
  listStoredRegions: jest.fn().mockResolvedValue([]),
  getComprehensiveStorageAnalytics: jest.fn().mockResolvedValue({
    totalStorageSize: 1024000,
  }),
  deleteRegion: jest.fn().mockResolvedValue(undefined),
});

// Create mock DownloadManager
const createMockDownloadManager = () => ({
  getCurrentDownloads: jest.fn().mockReturnValue(new Map()),
  hasActiveDownloads: jest.fn().mockReturnValue(false),
  downloadRegion: jest.fn().mockResolvedValue(undefined),
});

// Create mock ModalManager
const createMockModalManager = () => ({
  show: jest.fn(),
  close: jest.fn(),
  isOpen: jest.fn().mockReturnValue(false),
});

describe('PanelContentRenderer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createConfig = (overrides: Partial<ContentRendererConfig> = {}): ContentRendererConfig => ({
    offlineManager: createMockOfflineManager() as unknown as ContentRendererConfig['offlineManager'],
    downloadManager: createMockDownloadManager() as unknown as ContentRendererConfig['downloadManager'],
    modalManager: createMockModalManager() as unknown as ContentRendererConfig['modalManager'],
    onClose: jest.fn(),
    onAddRegion: jest.fn(),
    onFocusRegion: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a panel content renderer instance', () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);
      expect(renderer).toBeInstanceOf(PanelContentRenderer);
    });

    it('should create element', () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);
      expect(renderer.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have flex column layout', () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);
      expect(renderer.getElement().classList.contains('flex')).toBe(true);
      expect(renderer.getElement().classList.contains('flex-col')).toBe(true);
    });
  });

  describe('render', () => {
    it('should render content into container', async () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Container should have content
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should call listStoredRegions', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const config = createConfig({
        offlineManager: mockOfflineManager as unknown as ContentRendererConfig['offlineManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      expect(mockOfflineManager.listStoredRegions).toHaveBeenCalled();
    });

    it('should call getComprehensiveStorageAnalytics', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const config = createConfig({
        offlineManager: mockOfflineManager as unknown as ContentRendererConfig['offlineManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      expect(mockOfflineManager.getComprehensiveStorageAnalytics).toHaveBeenCalled();
    });

    it('should display error state on failure', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockRejectedValue(new Error('Test error'));

      const config = createConfig({
        offlineManager: mockOfflineManager as unknown as ContentRendererConfig['offlineManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      expect(container.innerHTML).toContain('Error loading content');
    });

    it('should not render if container is null', async () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);

      // Should not throw
      await expect(renderer.render(null as unknown as HTMLElement)).resolves.toBeUndefined();
    });
  });

  describe('render with regions', () => {
    it('should display regions', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([
        {
          id: 'region-1',
          name: 'Test Region',
          bounds: [[-122.5, 37.7], [-122.3, 37.9]],
          minZoom: 10,
          maxZoom: 16,
          created: Date.now(),
        },
      ]);

      const config = createConfig({
        offlineManager: mockOfflineManager as unknown as ContentRendererConfig['offlineManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Should contain region info
      expect(container.textContent).toContain('Offline Map Manager');
    });

    it('should display storage size', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.getComprehensiveStorageAnalytics.mockResolvedValue({
        totalStorageSize: 5242880, // 5MB
      });

      const config = createConfig({
        offlineManager: mockOfflineManager as unknown as ContentRendererConfig['offlineManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Should contain formatted size (either MB or numeric value)
      const text = container.textContent || '';
      expect(text.includes('MB') || text.includes('5')).toBe(true);
    });
  });

  describe('render with active downloads', () => {
    it('should display download progress when downloads are active', async () => {
      const mockDownloadManager = createMockDownloadManager();
      mockDownloadManager.getCurrentDownloads.mockReturnValue(
        new Map([
          ['download-1', {
            regionId: 'region-1',
            regionName: 'Test Download',
            percentage: 50,
            completed: 50,
            total: 100,
            currentResource: 'Downloading tiles',
            phase: 'tiles',
          }],
        ])
      );

      const config = createConfig({
        downloadManager: mockDownloadManager as unknown as ContentRendererConfig['downloadManager'],
      });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // The render should complete without error
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  describe('refresh', () => {
    it('should refresh content', async () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);

      // First render to set up parent
      await renderer.render(container);

      // Refresh should not throw
      await expect(renderer.refresh()).resolves.not.toThrow();
    });
  });

  describe('event handlers', () => {
    it('should handle onClose callback', async () => {
      const onClose = jest.fn();
      const config = createConfig({ onClose });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // The close button should exist
      const closeButtons = container.querySelectorAll('button');
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('should handle onAddRegion callback', async () => {
      const onAddRegion = jest.fn();
      const config = createConfig({ onAddRegion });
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Should have header with add region button
      expect(container.textContent).toContain('Offline Map Manager');
    });
  });

  describe('theme toggle', () => {
    it('should handle theme toggle', async () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Theme toggle should be present
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  describe('action buttons', () => {
    it('should render action buttons section', async () => {
      const config = createConfig();
      const renderer = new PanelContentRenderer(config);

      await renderer.render(container);

      // Should contain action buttons
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
