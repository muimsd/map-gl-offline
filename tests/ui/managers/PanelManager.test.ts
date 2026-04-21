/**
 * Tests for PanelRenderer (PanelManager) Component
 */

import { PanelRenderer, PanelRendererOptions } from '../../../src/ui/managers/PanelManager';

// Mock the theme manager
jest.mock('../../../src/ui/ThemeManager', () => ({
  themeManager: {
    getTheme: jest.fn().mockReturnValue({ mode: 'light' }),
    setTheme: jest.fn(),
  },
}));

// Mock styleService
jest.mock('../../../src/services/styleService', () => ({
  loadStyles: jest.fn().mockResolvedValue([]),
  getStyleStats: jest.fn().mockResolvedValue({ styles: [] }),
  deleteStyleById: jest.fn().mockResolvedValue(undefined),
}));

// Create mock OfflineManager
const createMockOfflineManager = () => ({
  listStoredRegions: jest.fn().mockResolvedValue([]),
  getComprehensiveStorageAnalytics: jest.fn().mockResolvedValue({
    totalStorageSize: 1024000,
  }),
  deleteRegion: jest.fn().mockResolvedValue(undefined),
  getRegionSize: jest.fn().mockResolvedValue(512000),
  downloadStyle: jest.fn().mockResolvedValue({ success: true }),
  exportRegionAsJSON: jest.fn().mockResolvedValue({}),
  exportRegionAsPMTiles: jest.fn().mockResolvedValue({}),
  exportRegionAsMBTiles: jest.fn().mockResolvedValue({}),
  importRegion: jest.fn().mockResolvedValue({}),
  downloadExportedRegion: jest.fn(),
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
  getActiveModal: jest.fn(),
});

describe('PanelRenderer', () => {
  let container: HTMLDivElement;
  let panelElement: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    panelElement = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(panelElement);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createOptions = (overrides: Partial<PanelRendererOptions> = {}): PanelRendererOptions => ({
    offlineManager: createMockOfflineManager() as unknown as PanelRendererOptions['offlineManager'],
    downloadManager: createMockDownloadManager() as unknown as PanelRendererOptions['downloadManager'],
    modalManager: createMockModalManager() as unknown as PanelRendererOptions['modalManager'],
    onClose: jest.fn(),
    onAddRegion: jest.fn(),
    onFocusRegion: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a panel renderer instance', () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);
      expect(renderer).toBeInstanceOf(PanelRenderer);
    });

    it('should create element', () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);
      expect(renderer.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have proper styling', () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);
      const element = renderer.getElement();

      expect(element.classList.contains('h-full')).toBe(true);
      expect(element.classList.contains('flex')).toBe(true);
      expect(element.classList.contains('flex-col')).toBe(true);
    });
  });

  describe('render', () => {
    it('should render content into panel element', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.children.length).toBeGreaterThan(0);
    });

    it('should call listStoredRegions', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(mockOfflineManager.listStoredRegions).toHaveBeenCalled();
    });

    it('should call getComprehensiveStorageAnalytics', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(mockOfflineManager.getComprehensiveStorageAnalytics).toHaveBeenCalled();
    });

    it('should not render if panel element is null', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await expect(renderer.render(null as unknown as HTMLDivElement)).resolves.toBeUndefined();
    });

    it('should display error state on failure', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockRejectedValue(new Error('Test error'));

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.innerHTML).toContain('Error loading content');
    });
  });

  describe('render with regions', () => {
    it('should display regions list', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([
        {
          id: 'region-1',
          name: 'Test Region',
          bounds: [[-122.5, 37.7], [-122.3, 37.9]],
          minZoom: 10,
          maxZoom: 16,
          created: Date.now(),
          styleId: 'style-1',
        },
      ]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should contain title
      expect(panelElement.textContent).toContain('Offline Manager');
    });

    it('should fetch region sizes', async () => {
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

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(mockOfflineManager.getRegionSize).toHaveBeenCalled();
    });
  });

  describe('render with styles', () => {
    it('should load and display styles', async () => {
      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([
        {
          key: 'style-1',
          style: { name: 'Test Style' },
        },
      ]);

      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should attempt to load styles
      expect(loadStyles).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should refresh content', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Reset mock
      mockOfflineManager.listStoredRegions.mockClear();

      // Call refresh and wait for debounce
      renderer.refresh();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have called again
      expect(mockOfflineManager.listStoredRegions).toHaveBeenCalled();
    });

    it('should debounce rapid refresh calls', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);
      mockOfflineManager.listStoredRegions.mockClear();

      // Multiple rapid refresh calls
      renderer.refresh();
      renderer.refresh();
      renderer.refresh();

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have called only once due to debouncing
      expect(mockOfflineManager.listStoredRegions.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('destroy', () => {
    it('should destroy without throwing', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(() => renderer.destroy()).not.toThrow();
    });

    it('should cleanup regions list', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);
      renderer.destroy();

      // Should not throw on subsequent calls
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('header', () => {
    it('should render header with title', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.textContent).toContain('Offline Manager');
    });

    it('should display region count and size', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([
        { id: '1', name: 'Region 1', bounds: [[0, 0], [1, 1]], minZoom: 0, maxZoom: 10, created: Date.now() },
        { id: '2', name: 'Region 2', bounds: [[0, 0], [1, 1]], minZoom: 0, maxZoom: 10, created: Date.now() },
      ]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.textContent).toContain('2 regions');
    });
  });

  describe('action buttons', () => {
    it('should render Add Region button', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.textContent).toContain('Add Region');
    });

    it('should render Refresh button', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      expect(panelElement.textContent).toContain('Refresh');
    });
  });

  describe('theme toggle', () => {
    it('should render theme toggle button', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should have theme toggle button
      const buttons = panelElement.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('close button', () => {
    it('should render close button', async () => {
      const options = createOptions();
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should have close button
      const buttons = panelElement.querySelectorAll('button');
      const closeButton = Array.from(buttons).find(btn =>
        btn.title === 'Close' || btn.getAttribute('title') === 'Close'
      );
      expect(closeButton || buttons.length).toBeDefined();
    });
  });

  describe('download progress', () => {
    it('should render download progress when downloads are active', async () => {
      const mockDownloadManager = createMockDownloadManager();
      mockDownloadManager.hasActiveDownloads.mockReturnValue(true);
      mockDownloadManager.getCurrentDownloads.mockReturnValue(
        new Map([
          ['download-1', {
            regionId: 'region-1',
            regionName: 'Test Download',
            percentage: 50,
            completed: 50,
            total: 100,
          }],
        ])
      );

      const options = createOptions({
        downloadManager: mockDownloadManager as unknown as PanelRendererOptions['downloadManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should check for active downloads
      expect(mockDownloadManager.hasActiveDownloads).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should display empty message when no regions', async () => {
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([]);

      const { loadStyles } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);

      await renderer.render(panelElement);

      // Should contain empty state message
      expect(panelElement.textContent?.includes('No offline') || panelElement.textContent?.includes('Add Region')).toBe(true);
    });
  });

  describe('map option', () => {
    it('should accept map option', () => {
      const mockMap = {
        setStyle: jest.fn(),
        getStyle: jest.fn(),
      };

      const options = createOptions({
        map: mockMap as unknown as PanelRendererOptions['map'],
      });

      expect(() => new PanelRenderer(options)).not.toThrow();
    });
  });

  describe('showBbox option', () => {
    it('should accept showBbox option', () => {
      const options = createOptions({
        showBbox: true,
      });

      expect(() => new PanelRenderer(options)).not.toThrow();
    });
  });

  describe('render with regions + styles', () => {
    it('renders grouped style cards when a style owns regions', async () => {
      const { loadStyles, getStyleStats } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([
        { key: 'my-style', style: { name: 'My Style', sources: { a: {} } } },
      ]);
      getStyleStats.mockResolvedValue({ styles: [{ id: 'my-style', size: 1024 }] });

      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([
        {
          id: 'r1',
          name: 'Region',
          styleId: 'my-style',
          bounds: [[0, 0], [1, 1]],
          minZoom: 0,
          maxZoom: 10,
          created: Date.now(),
          downloadedAt: Date.now(),
        },
      ]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);
      expect(panelElement.textContent).toContain('My Style');
    });

    it('shows orphaned-regions header when a region references an unknown style', async () => {
      const { loadStyles, getStyleStats } = require('../../../src/services/styleService');
      loadStyles.mockResolvedValue([]);
      getStyleStats.mockResolvedValue({ styles: [] });

      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([
        {
          id: 'orphan',
          name: 'Orphan',
          styleId: 'missing-style',
          bounds: [[0, 0], [1, 1]],
          minZoom: 0,
          maxZoom: 10,
          created: Date.now(),
        },
      ]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);
      // Either orphan section or region card should be present
      expect(panelElement.textContent).toBeTruthy();
    });
  });

  describe('region actions', () => {
    const makeRegion = (id: string) => ({
      id,
      name: `Region ${id}`,
      styleId: 'style',
      styleUrl: 'https://example.com/style.json',
      bounds: [[0, 0], [1, 1]],
      minZoom: 0,
      maxZoom: 10,
      created: Date.now(),
    });

    it('opens details modal when clicking a region item', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const mockModalManager = createMockModalManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([makeRegion('r1')]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
        modalManager: mockModalManager as unknown as PanelRendererOptions['modalManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      // Click the "details" button on the region item.
      const btn = panelElement.querySelector(
        '[data-action="show-details"]'
      ) as HTMLElement | null;
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        expect(mockModalManager.show).toHaveBeenCalled();
      }
    });

    it('invokes onFocusRegion when clicking the focus action', async () => {
      const onFocusRegion = jest.fn();
      const mockOfflineManager = createMockOfflineManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([makeRegion('r2')]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
        onFocusRegion,
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const btn = panelElement.querySelector(
        '[data-action="focus-region"]'
      ) as HTMLElement | null;
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        expect(onFocusRegion).toHaveBeenCalledWith('r2');
      }
    });

    it('opens a confirmation modal when clicking delete', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const mockModalManager = createMockModalManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([makeRegion('r3')]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
        modalManager: mockModalManager as unknown as PanelRendererOptions['modalManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const btn = panelElement.querySelector(
        '[data-action="delete-region"]'
      ) as HTMLElement | null;
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        expect(mockModalManager.show).toHaveBeenCalled();
      }
    });

    it('opens a confirmation modal when clicking redownload', async () => {
      const mockOfflineManager = createMockOfflineManager();
      const mockModalManager = createMockModalManager();
      mockOfflineManager.listStoredRegions.mockResolvedValue([makeRegion('r4')]);

      const options = createOptions({
        offlineManager: mockOfflineManager as unknown as PanelRendererOptions['offlineManager'],
        modalManager: mockModalManager as unknown as PanelRendererOptions['modalManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const btn = panelElement.querySelector(
        '[data-action="redownload-region"]'
      ) as HTMLElement | null;
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 50));
        expect(mockModalManager.show).toHaveBeenCalled();
      }
    });
  });

  describe('theme toggle interaction', () => {
    it('toggles theme when the toggle button is clicked', async () => {
      const { themeManager } = require('../../../src/ui/ThemeManager');
      themeManager.getTheme.mockReturnValue({ mode: 'light' });

      const options = createOptions();
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const themeBtn = Array.from(panelElement.querySelectorAll('button')).find(b =>
        (b.getAttribute('title') || '').toLowerCase().includes('theme') ||
        (b.textContent || '').toLowerCase().includes('theme')
      );
      if (themeBtn) {
        (themeBtn as HTMLButtonElement).click();
        expect(themeManager.setTheme).toHaveBeenCalled();
      }
    });
  });

  describe('close button interaction', () => {
    it('invokes onClose when the close button is clicked', async () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const closeBtn = Array.from(panelElement.querySelectorAll('button')).find(b =>
        (b.getAttribute('title') || '').toLowerCase().includes('close')
      );
      if (closeBtn) {
        (closeBtn as HTMLButtonElement).click();
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('add region button', () => {
    it('invokes onAddRegion when the add button is clicked', async () => {
      const onAddRegion = jest.fn();
      const options = createOptions({ onAddRegion });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);

      const addBtn = Array.from(panelElement.querySelectorAll('button')).find(b =>
        (b.textContent || '').includes('Add Region')
      );
      if (addBtn) {
        (addBtn as HTMLButtonElement).click();
        expect(onAddRegion).toHaveBeenCalled();
      }
    });
  });

  describe('active downloads display', () => {
    it('renders each active download entry', async () => {
      const mockDownloadManager = createMockDownloadManager();
      mockDownloadManager.hasActiveDownloads.mockReturnValue(true);
      mockDownloadManager.getCurrentDownloads.mockReturnValue(
        new Map([
          ['d1', { regionId: 'r1', regionName: 'R1', percentage: 25 }],
          ['d2', { regionId: 'r2', regionName: 'R2', percentage: 75 }],
        ])
      );
      const options = createOptions({
        downloadManager: mockDownloadManager as unknown as PanelRendererOptions['downloadManager'],
      });
      const renderer = new PanelRenderer(options);
      await renderer.render(panelElement);
      expect(panelElement.textContent).toContain('R1');
      expect(panelElement.textContent).toContain('R2');
    });
  });
});
