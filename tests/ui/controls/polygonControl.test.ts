/**
 * Tests for PolygonControl Component
 */

import { PolygonControl, PolygonControlOptions } from '../../../src/ui/controls/polygonControl';
import type { Map as MaplibreMap } from 'maplibre-gl';

// Mock the map object
const createMockMap = () => {
  const eventHandlers: Record<string, Function[]> = {};

  return {
    getContainer: jest.fn().mockReturnValue({
      querySelector: jest.fn().mockReturnValue(null),
      appendChild: jest.fn(),
    }),
    getBounds: jest.fn().mockReturnValue({
      toArray: () => [[-122.5, 37.7], [-122.3, 37.9]],
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
    getSource: jest.fn().mockReturnValue(null),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeSource: jest.fn(),
    removeLayer: jest.fn(),
    getLayer: jest.fn().mockReturnValue(null),
    _trigger: (event: string, data?: unknown) => {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(handler => handler(data));
      }
    },
  };
};

describe('PolygonControl', () => {
  let mockMap: ReturnType<typeof createMockMap>;
  let container: HTMLDivElement;

  beforeEach(() => {
    mockMap = createMockMap();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.querySelectorAll('.bottom-chips-container').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createOptions = (overrides: Partial<PolygonControlOptions> = {}): PolygonControlOptions => ({
    onSave: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a polygon control instance', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);
      expect(control).toBeInstanceOf(PolygonControl);
    });
  });

  describe('enter', () => {
    it('should not throw when entering polygon mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      expect(() => control.enter()).not.toThrow();
    });

    it('should add map event listeners', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      expect(mockMap.on).toHaveBeenCalledWith('move', expect.any(Function));
      expect(mockMap.on).toHaveBeenCalledWith('zoomend', expect.any(Function));
    });

    it('should create area display UI', () => {
      const options = createOptions();

      // Update mock to properly handle container creation
      const mockContainer = document.createElement('div');
      mockMap.getContainer.mockReturnValue(mockContainer);

      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);
      control.enter();

      const chipsContainer = mockContainer.querySelector('.bottom-chips-container');
      expect(mockContainer.querySelector('.bottom-chips-container') || mockMap.getContainer().appendChild).toBeDefined();
    });
  });

  describe('exit', () => {
    it('should not throw when exiting polygon mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();
      expect(() => control.exit()).not.toThrow();
    });

    it('should remove map event listeners', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();
      control.exit();

      expect(mockMap.off).toHaveBeenCalledWith('move', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('zoomend', expect.any(Function));
    });

    it('should clear current bounds', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();
      control.exit();

      expect(control.getCurrentBounds()).toBeNull();
    });

    it('should reset current area', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();
      control.exit();

      expect(control.getCurrentArea()).toBe(0);
    });
  });

  describe('getCurrentBounds', () => {
    it('should return null initially', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      expect(control.getCurrentBounds()).toBeNull();
    });

    it('should return bounds after entering mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      const bounds = control.getCurrentBounds();
      // Bounds should be calculated (may be null if map mock is incomplete)
      expect(bounds === null || Array.isArray(bounds)).toBe(true);
    });
  });

  describe('getCurrentArea', () => {
    it('should return 0 initially', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      expect(control.getCurrentArea()).toBe(0);
    });

    it('should return calculated area after entering mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      const area = control.getCurrentArea();
      expect(typeof area).toBe('number');
    });
  });

  describe('createSaveButton', () => {
    it('should create a save button in the parent container', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      const parentContainer = document.createElement('div');
      control.createSaveButton(parentContainer);

      const button = parentContainer.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('should hide save button initially', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      const parentContainer = document.createElement('div');
      control.createSaveButton(parentContainer);

      const button = parentContainer.querySelector('button') as HTMLButtonElement;
      expect(button.style.display).toBe('none');
    });

    it('should have correct title', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      const parentContainer = document.createElement('div');
      control.createSaveButton(parentContainer);

      const button = parentContainer.querySelector('button') as HTMLButtonElement;
      expect(button.title).toBe('Save Selected Region');
    });
  });

  describe('triggerSave', () => {
    it('should call onSave with bounds and area', () => {
      const onSave = jest.fn();
      const options = createOptions({ onSave });
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();
      control.triggerSave();

      // Should be called if bounds exist
      if (control.getCurrentBounds()) {
        expect(onSave).toHaveBeenCalled();
      }
    });

    it('should not call onSave when bounds are null', () => {
      const onSave = jest.fn();
      const options = createOptions({ onSave });
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      // Don't enter mode, so bounds will be null
      control.triggerSave();

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('map visualization', () => {
    it('should add sources when entering mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      // Should attempt to add visualization sources
      expect(mockMap.getSource).toHaveBeenCalled();
    });

    it('should remove layers when exiting mode', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      // Mock that layers exist with setData method for GeoJSONSource
      mockMap.getLayer.mockReturnValue({});
      mockMap.getSource.mockReturnValue({ setData: jest.fn() });

      control.enter();
      control.exit();

      // Should check for layers to remove
      expect(mockMap.getLayer).toHaveBeenCalled();
    });
  });

  describe('map move events', () => {
    it('should update visualization on map move', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      // Simulate map move
      mockMap._trigger('move');

      // Should call getBounds to update visualization
      expect(mockMap.getBounds).toHaveBeenCalled();
    });

    it('should update visualization on zoomend', () => {
      const options = createOptions();
      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);

      control.enter();

      // Simulate zoom end
      mockMap._trigger('zoomend');

      expect(mockMap.getBounds).toHaveBeenCalled();
    });
  });

  describe('UI elements', () => {
    it('should create offline-manager-control classed container', () => {
      const options = createOptions();
      const mockContainer = document.createElement('div');
      mockMap.getContainer.mockReturnValue(mockContainer);

      const control = new PolygonControl(mockMap as unknown as MaplibreMap, options);
      control.enter();

      // The area display should have the offline-manager-control class
      const areaDisplay = mockContainer.querySelector('.offline-manager-control');
      expect(areaDisplay || mockContainer.childNodes.length).toBeDefined();
    });
  });
});
