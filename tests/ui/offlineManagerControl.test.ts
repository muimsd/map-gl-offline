/**
 * Tests for OfflineManagerControl
 */

// Mock matchMedia before importing components that use ThemeManager
const mockMatchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock styleService to avoid transitive TS compilation issues from WIP code
jest.mock('../../src/services/styleService', () => ({
  downloadStyles: jest.fn().mockResolvedValue({ styleId: 'test' }),
  loadStyles: jest.fn().mockResolvedValue([]),
  loadStyleById: jest.fn().mockResolvedValue(null),
  isStyleDownloaded: jest.fn().mockResolvedValue(false),
}));

// Mock swRegistration since navigator.serviceWorker is not available in jsdom
jest.mock('../../src/utils/swRegistration', () => ({
  registerOfflineServiceWorker: jest.fn().mockResolvedValue({} as ServiceWorkerRegistration),
  unregisterOfflineServiceWorker: jest.fn().mockResolvedValue(true),
}));

import { OfflineManagerControl } from '../../src/ui/offlineManagerControl';

// Mock the OfflineMapManager
const createMockOfflineManager = () => ({
  listStoredRegions: jest.fn().mockResolvedValue([]),
  downloadRegion: jest.fn().mockResolvedValue(undefined),
  deleteRegion: jest.fn().mockResolvedValue(undefined),
});

// Mock the map object matching IControl interface
const createMockMap = () => ({
  getContainer: jest.fn().mockReturnValue(document.createElement('div')),
  getBounds: jest.fn().mockReturnValue({
    toArray: () => [
      [-122.5, 37.7],
      [-122.3, 37.9],
    ],
  }),
  on: jest.fn(),
  off: jest.fn(),
  getSource: jest.fn().mockReturnValue(null),
  addSource: jest.fn(),
  addLayer: jest.fn(),
  removeSource: jest.fn(),
  removeLayer: jest.fn(),
  getLayer: jest.fn().mockReturnValue(null),
  setStyle: jest.fn(),
  fitBounds: jest.fn(),
});

// Mock map library with addProtocol/removeProtocol
const createMockMapLib = () => ({
  addProtocol: jest.fn(),
  removeProtocol: jest.fn(),
});

describe('OfflineManagerControl', () => {
  let control: OfflineManagerControl;
  let mockOfflineManager: ReturnType<typeof createMockOfflineManager>;
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    mockOfflineManager = createMockOfflineManager();
  });

  afterEach(() => {
    // Clean up any panels appended to body
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    window.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      expect(control).toBeDefined();
    });

    it('should create an instance with custom options', () => {
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style.json',
        theme: 'light',
        showBbox: true,
      });
      expect(control).toBeDefined();
    });

    it('should setup fetch interceptor', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      // After construction, window.fetch should be overridden
      expect(window.fetch).not.toBe(originalFetch);
    });
  });

  describe('onAdd', () => {
    it('should return a container element', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should return a container with maplibregl-ctrl class', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      expect(container.classList.contains('maplibregl-ctrl')).toBe(true);
    });

    it('should return a container with offline-manager-control class', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      expect(container.classList.contains('offline-manager-control')).toBe(true);
    });

    it('should contain a button element', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('should append a panel to document.body', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      const panels = document.querySelectorAll('.offline-manager-control.fixed');
      expect(panels.length).toBeGreaterThan(0);
    });

    it('should create a hidden panel by default', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      const panel = document.querySelector('.offline-manager-control.fixed') as HTMLElement;
      expect(panel?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('onRemove', () => {
    it('should remove the panel from the DOM', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      const panelsBefore = document.querySelectorAll('.offline-manager-control.fixed');
      expect(panelsBefore.length).toBeGreaterThan(0);

      control.onRemove();

      const panelsAfter = document.querySelectorAll('.offline-manager-control.fixed');
      expect(panelsAfter.length).toBe(0);
    });

    it('should restore original fetch after removal', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      // The constructor sets up an interceptor. Capture the interceptor ref.
      const interceptorFetch = window.fetch;
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      control.onRemove();

      // After onRemove, window.fetch should no longer be the interceptor.
      // The constructor stores a .bind() copy, so we check it's not the interceptor.
      expect(window.fetch).not.toBe(interceptorFetch);
    });

    it('should not throw when called without onAdd', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      expect(() => control.onRemove()).not.toThrow();
    });
  });

  describe('panel toggling', () => {
    it('should show the panel when the button is clicked', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click();

      const panel = document.querySelector('.offline-manager-control.fixed') as HTMLElement;
      expect(panel?.classList.contains('hidden')).toBe(false);
    });

    it('should hide the panel when the button is clicked twice', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      const container = control.onAdd(mockMap as any);

      const button = container.querySelector('button') as HTMLButtonElement;
      button.click(); // open
      button.click(); // close

      const panel = document.querySelector('.offline-manager-control.fixed') as HTMLElement;
      expect(panel?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('updateStyleUrl', () => {
    it('should update the current style URL', () => {
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/old-style.json',
      });
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      control.updateStyleUrl('https://example.com/new-style.json');

      expect(control.getCurrentStyleUrl()).toBe('https://example.com/new-style.json');
    });
  });

  describe('getCurrentStyleUrl', () => {
    it('should return the style URL from options', () => {
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style.json',
      });

      expect(control.getCurrentStyleUrl()).toBe('https://example.com/style.json');
    });
  });

  describe('fetch interceptor', () => {
    it('should pass through non-idb URLs', async () => {
      const mockFetch = jest.fn().mockResolvedValue(new Response('ok'));
      window.fetch = mockFetch;

      control = new OfflineManagerControl(mockOfflineManager as any);

      // The interceptor wraps the current window.fetch, which is our mock
      await window.fetch('https://example.com/data.json');

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('mapLib protocol registration', () => {
    it('should register idb:// protocol when mapLib is provided', () => {
      const mockMapLib = createMockMapLib();
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style.json',
        mapLib: mockMapLib,
      });

      expect(mockMapLib.addProtocol).toHaveBeenCalledWith('idb', expect.any(Function));
    });

    it('should remove idb:// protocol on onRemove() when mapLib was provided', () => {
      const mockMapLib = createMockMapLib();
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style.json',
        mapLib: mockMapLib,
      });
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      control.onRemove();

      expect(mockMapLib.removeProtocol).toHaveBeenCalledWith('idb');
    });

    it('should not throw when mapLib is omitted', () => {
      expect(() => {
        control = new OfflineManagerControl(mockOfflineManager as any, {
          styleUrl: 'https://example.com/style.json',
        });
      }).not.toThrow();
    });

    it('should not call removeProtocol on onRemove() when mapLib was not provided', () => {
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style.json',
      });
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      // Should not throw even without mapLib
      expect(() => control.onRemove()).not.toThrow();
    });
  });
});
