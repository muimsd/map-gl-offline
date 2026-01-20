/**
 * Tests for RegionControl Component
 */

import { RegionControl, RegionControlOptions } from '../../../src/ui/controls/regionControl';

// Mock the PolygonControl
jest.mock('../../../src/ui/controls/polygonControl', () => ({
  PolygonControl: jest.fn().mockImplementation(() => ({
    enter: jest.fn(),
    exit: jest.fn(),
    getCurrentBounds: jest.fn().mockReturnValue([-122.5, 37.7, -122.3, 37.9]),
    getCurrentArea: jest.fn().mockReturnValue(25),
    triggerSave: jest.fn(),
    createSaveButton: jest.fn(),
  })),
}));

// Mock the RegionFormModal
jest.mock('../../../src/ui/modals/regionFormModal', () => ({
  RegionFormModal: jest.fn().mockImplementation(() => ({
    show: jest.fn().mockReturnValue(document.createElement('div')),
    hide: jest.fn(),
    destroy: jest.fn(),
  })),
}));

// Mock the map object
const createMockMap = () => ({
  getContainer: jest.fn().mockReturnValue(document.createElement('div')),
  getBounds: jest.fn().mockReturnValue({
    toArray: () => [[-122.5, 37.7], [-122.3, 37.9]],
  }),
  on: jest.fn(),
  off: jest.fn(),
  getSource: jest.fn().mockReturnValue(null),
  addSource: jest.fn(),
  addLayer: jest.fn(),
  removeSource: jest.fn(),
  removeLayer: jest.fn(),
  getLayer: jest.fn().mockReturnValue(null),
});

// Mock the ModalManager
const createMockModalManager = () => ({
  show: jest.fn(),
  close: jest.fn(),
  isOpen: jest.fn().mockReturnValue(false),
  getActiveModal: jest.fn(),
});

// Mock the DownloadManager
const createMockDownloadManager = () => ({
  downloadRegion: jest.fn().mockResolvedValue(undefined),
  getCurrentDownloads: jest.fn().mockReturnValue(new Map()),
  hasActiveDownloads: jest.fn().mockReturnValue(false),
  cancelDownload: jest.fn(),
  cancelAllDownloads: jest.fn(),
});

describe('RegionControl', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  const createOptions = (overrides: Partial<RegionControlOptions> = {}): RegionControlOptions => ({
    map: createMockMap() as unknown as RegionControlOptions['map'],
    downloadManager: createMockDownloadManager() as unknown as RegionControlOptions['downloadManager'],
    modalManager: createMockModalManager() as unknown as RegionControlOptions['modalManager'],
    container: container,
    styleUrl: 'https://example.com/style.json',
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a region control instance', () => {
      const options = createOptions();
      const control = new RegionControl(options);
      expect(control).toBeInstanceOf(RegionControl);
    });
  });

  describe('startSelection', () => {
    it('should not throw when starting selection', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      expect(() => control.startSelection()).not.toThrow();
    });

    it('should create save button', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      // The container should have a save button
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('should set active state to true', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      expect(control.isSelectionActive()).toBe(true);
    });

    it('should not start again if already active', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.startSelection(); // Second call should be no-op

      // Should only have one save button
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(1);
    });
  });

  describe('cancelSelection', () => {
    it('should not throw when canceling', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      expect(() => control.cancelSelection()).not.toThrow();
    });

    it('should set active state to false', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.cancelSelection();

      expect(control.isSelectionActive()).toBe(false);
    });

    it('should remove save button', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.cancelSelection();

      // Save button should be removed
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });

    it('should close modal manager', () => {
      const mockModalManager = createMockModalManager();
      const options = createOptions({
        modalManager: mockModalManager as unknown as RegionControlOptions['modalManager'],
      });
      const control = new RegionControl(options);

      control.startSelection();
      control.cancelSelection();

      expect(mockModalManager.close).toHaveBeenCalled();
    });

    it('should be no-op if not active', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      expect(() => control.cancelSelection()).not.toThrow();
      expect(control.isSelectionActive()).toBe(false);
    });
  });

  describe('isSelectionActive', () => {
    it('should return false initially', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      expect(control.isSelectionActive()).toBe(false);
    });

    it('should return true after starting selection', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      expect(control.isSelectionActive()).toBe(true);
    });

    it('should return false after canceling selection', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.cancelSelection();

      expect(control.isSelectionActive()).toBe(false);
    });
  });

  describe('updateStyleUrl', () => {
    it('should update the style URL', () => {
      const options = createOptions({ styleUrl: 'https://old.example.com/style.json' });
      const control = new RegionControl(options);

      expect(() => control.updateStyleUrl('https://new.example.com/style.json')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should not throw when cleaning up', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      expect(() => control.cleanup()).not.toThrow();
    });

    it('should cancel selection', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.cleanup();

      expect(control.isSelectionActive()).toBe(false);
    });
  });

  describe('onRegionSaved callback', () => {
    it('should accept onRegionSaved callback', () => {
      const onRegionSaved = jest.fn();
      const options = createOptions({ onRegionSaved });

      expect(() => new RegionControl(options)).not.toThrow();
    });
  });

  describe('save button', () => {
    it('should have correct styling', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      const button = container.querySelector('button') as HTMLButtonElement;
      expect(button.classList.contains('maplibregl-ctrl-icon')).toBe(true);
    });

    it('should have correct title', () => {
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      const button = container.querySelector('button') as HTMLButtonElement;
      expect(button.title).toBe('Save Selected Region');
    });
  });

  describe('polygon control integration', () => {
    it('should create polygon control on start', () => {
      const { PolygonControl } = require('../../../src/ui/controls/polygonControl');
      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      expect(PolygonControl).toHaveBeenCalled();
    });

    it('should enter polygon control on start', () => {
      const { PolygonControl } = require('../../../src/ui/controls/polygonControl');
      const mockPolygonControl = {
        enter: jest.fn(),
        exit: jest.fn(),
        getCurrentBounds: jest.fn(),
        getCurrentArea: jest.fn(),
        triggerSave: jest.fn(),
      };
      PolygonControl.mockImplementation(() => mockPolygonControl);

      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();

      expect(mockPolygonControl.enter).toHaveBeenCalled();
    });

    it('should exit polygon control on cancel', () => {
      const { PolygonControl } = require('../../../src/ui/controls/polygonControl');
      const mockPolygonControl = {
        enter: jest.fn(),
        exit: jest.fn(),
        getCurrentBounds: jest.fn(),
        getCurrentArea: jest.fn(),
        triggerSave: jest.fn(),
      };
      PolygonControl.mockImplementation(() => mockPolygonControl);

      const options = createOptions();
      const control = new RegionControl(options);

      control.startSelection();
      control.cancelSelection();

      expect(mockPolygonControl.exit).toHaveBeenCalled();
    });
  });
});
