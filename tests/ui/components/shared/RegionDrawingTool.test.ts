/**
 * Tests for RegionDrawing Component
 */

import { RegionDrawing, RegionDrawingConfig } from '../../../../src/ui/components/shared/RegionDrawingTool';

// Mock the RegionFormModal
jest.mock('../../../../src/ui/modals/regionFormModal', () => ({
  RegionFormModal: jest.fn().mockImplementation(() => ({
    show: jest.fn().mockReturnValue(document.createElement('div')),
    hide: jest.fn(),
    destroy: jest.fn(),
  })),
}));

// Create mock map
const createMockMap = () => {
  const eventHandlers: Record<string, Function[]> = {};

  return {
    getCanvas: jest.fn().mockReturnValue({
      style: { cursor: '' },
    }),
    on: jest.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }),
    off: jest.fn((event: string, handler: Function) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
      }
    }),
    _trigger: (event: string, data?: unknown) => {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(handler => handler(data));
      }
    },
    _getHandlers: () => eventHandlers,
  };
};

// Create mock DownloadManager
const createMockDownloadManager = () => ({
  downloadRegion: jest.fn().mockResolvedValue(undefined),
  getCurrentDownloads: jest.fn().mockReturnValue(new Map()),
  hasActiveDownloads: jest.fn().mockReturnValue(false),
});

// Create mock ModalManager
const createMockModalManager = () => ({
  show: jest.fn(),
  close: jest.fn(),
  isOpen: jest.fn().mockReturnValue(false),
});

describe('RegionDrawing', () => {
  let container: HTMLDivElement;
  let mockMap: ReturnType<typeof createMockMap>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mockMap = createMockMap();
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.querySelectorAll('#drawing-instructions').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createConfig = (overrides: Partial<RegionDrawingConfig> = {}): RegionDrawingConfig => ({
    map: mockMap as unknown as RegionDrawingConfig['map'],
    downloadManager: createMockDownloadManager() as unknown as RegionDrawingConfig['downloadManager'],
    modalManager: createMockModalManager() as unknown as RegionDrawingConfig['modalManager'],
    container: container,
    onRegionSaved: jest.fn(),
    getCurrentStyleUrl: jest.fn().mockReturnValue('https://example.com/style.json'),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a region drawing instance', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);
      expect(drawing).toBeInstanceOf(RegionDrawing);
    });

    it('should create element', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);
      expect(drawing.getElement()).toBeInstanceOf(HTMLElement);
    });
  });

  describe('startSelection', () => {
    it('should start drawing mode', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      expect(drawing.isInDrawingMode()).toBe(true);
    });

    it('should change cursor to crosshair', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      expect(mockMap.getCanvas().style.cursor).toBe('crosshair');
    });

    it('should show drawing instructions', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      const instructions = document.getElementById('drawing-instructions');
      expect(instructions).not.toBeNull();
    });

    it('should add click handler to map', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      expect(mockMap.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not start again if already drawing', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.startSelection(); // Second call

      // Should only have one click handler registered
      expect(mockMap._getHandlers()['click']?.length).toBe(1);
    });
  });

  describe('stopSelection', () => {
    it('should stop drawing mode', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.stopSelection();

      expect(drawing.isInDrawingMode()).toBe(false);
    });

    it('should reset cursor', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.stopSelection();

      expect(mockMap.getCanvas().style.cursor).toBe('');
    });

    it('should hide drawing instructions', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.stopSelection();

      const instructions = document.getElementById('drawing-instructions');
      expect(instructions).toBeNull();
    });

    it('should remove click handler from map', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.stopSelection();

      expect(mockMap.off).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should be no-op if not drawing', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      expect(() => drawing.stopSelection()).not.toThrow();
      expect(drawing.isInDrawingMode()).toBe(false);
    });
  });

  describe('isInDrawingMode', () => {
    it('should return false initially', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      expect(drawing.isInDrawingMode()).toBe(false);
    });

    it('should return true after startSelection', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      expect(drawing.isInDrawingMode()).toBe(true);
    });

    it('should return false after stopSelection', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.stopSelection();

      expect(drawing.isInDrawingMode()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should stop selection and destroy', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      drawing.cleanup();

      expect(drawing.isInDrawingMode()).toBe(false);
    });

    it('should not throw when cleaning up without starting', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      expect(() => drawing.cleanup()).not.toThrow();
    });
  });

  describe('map click handling', () => {
    it('should handle map click when in drawing mode', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      // Simulate a map click
      mockMap._trigger('click', { lngLat: { lng: -122.4, lat: 37.8 } });

      // Should stop drawing mode after click
      expect(drawing.isInDrawingMode()).toBe(false);
    });

    it('should show region form after click', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      // Simulate a map click
      mockMap._trigger('click', { lngLat: { lng: -122.4, lat: 37.8 } });

      // RegionFormModal should have been created
      const { RegionFormModal } = require('../../../../src/ui/modals/regionFormModal');
      expect(RegionFormModal).toHaveBeenCalled();
    });
  });

  describe('escape key handling', () => {
    it('should add escape key handler when starting', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

      drawing.startSelection();

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should stop selection on escape key', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      // Simulate escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(drawing.isInDrawingMode()).toBe(false);
    });
  });

  describe('drawing instructions', () => {
    it('should display correct text in instructions', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      const instructions = document.getElementById('drawing-instructions');
      expect(instructions?.textContent).toContain('Drawing Mode Active');
      expect(instructions?.textContent).toContain('Click on the map');
      expect(instructions?.textContent).toContain('ESC');
    });

    it('should have correct styling', () => {
      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();

      const instructions = document.getElementById('drawing-instructions');
      expect(instructions?.classList.contains('fixed')).toBe(true);
    });
  });

  describe('bounds calculation', () => {
    it('should create bounds around clicked point', () => {
      const { RegionFormModal } = require('../../../../src/ui/modals/regionFormModal');

      const config = createConfig();
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      mockMap._trigger('click', { lngLat: { lng: -122.4, lat: 37.8 } });

      // RegionFormModal should be called with bounds
      expect(RegionFormModal).toHaveBeenCalledWith(
        expect.objectContaining({
          bounds: expect.any(Array),
        })
      );
    });
  });

  describe('getCurrentStyleUrl', () => {
    it('should use getCurrentStyleUrl callback', () => {
      const getCurrentStyleUrl = jest.fn().mockReturnValue('https://custom.example.com/style.json');
      const config = createConfig({ getCurrentStyleUrl });
      const drawing = new RegionDrawing(config);

      drawing.startSelection();
      mockMap._trigger('click', { lngLat: { lng: -122.4, lat: 37.8 } });

      expect(getCurrentStyleUrl).toHaveBeenCalled();
    });
  });
});
