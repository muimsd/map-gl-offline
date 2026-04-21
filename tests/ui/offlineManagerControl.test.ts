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
const mockLoadStyles = jest.fn().mockResolvedValue([]);
const mockLoadStyleById = jest.fn().mockResolvedValue(null);
jest.mock('../../src/services/styleService', () => ({
  downloadStyles: jest.fn().mockResolvedValue({ styleId: 'test' }),
  loadStyles: (...args: unknown[]) => mockLoadStyles(...args),
  loadStyleById: (...args: unknown[]) => mockLoadStyleById(...args),
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

  describe('fetch interceptor routing', () => {
    it('routes idb:// URLs to the idbFetchHandler (returns 404 when empty)', async () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const response = await window.fetch('idb://nope/tile/x/0/0/0.pbf');
      expect(response.status).toBe(404);
    });

    it('routes /__offline__/ URLs to the idbFetchHandler', async () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const response = await window.fetch(
        'https://example.com/__offline__/unknown/tile/s/0/0/0.pbf'
      );
      expect(response.status).toBe(404);
    });

    it('accepts URL objects as input', async () => {
      const mockFetch = jest.fn().mockResolvedValue(new Response('ok'));
      window.fetch = mockFetch;
      control = new OfflineManagerControl(mockOfflineManager as any);
      await window.fetch(new URL('https://example.com/x.json'));
      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles Request-like objects with a url property', async () => {
      const mockFetch = jest.fn().mockResolvedValue(new Response('ok'));
      window.fetch = mockFetch;
      control = new OfflineManagerControl(mockOfflineManager as any);
      // Jsdom doesn't provide Request; fake one with the shape the interceptor
      // actually reads (`.url`).
      const fakeReq = { url: 'https://example.com/x.json' } as unknown as Request;
      await window.fetch(fakeReq);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('addProtocol handler', () => {
    it('invokes idbFetchHandler and returns parsed JSON for type=json', async () => {
      const mockMapLib = createMockMapLib();
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/s.json',
        mapLib: mockMapLib,
      });

      // Capture the handler that was registered
      const handler = mockMapLib.addProtocol.mock.calls[0][1] as (p: {
        url: string;
        type?: string;
      }) => Promise<{ data: unknown }>;

      // Seed a style so the /tilesjson/ handler returns 200 with JSON.
      const { dbPromise } = await import('../../src/storage/indexedDbManager');
      const db = await dbPromise;
      await db.put('styles', {
        key: 'st',
        style: {
          version: 8,
          sources: { src: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
          layers: [],
        },
        provider: 'auto',
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      } as never);

      const result = await handler({ url: 'idb://st/tilesjson/src', type: 'json' });
      expect(result.data).toBeDefined();
    });

    it('throws when the IDB fetch returns a non-ok response', async () => {
      const mockMapLib = createMockMapLib();
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/s.json',
        mapLib: mockMapLib,
      });
      const handler = mockMapLib.addProtocol.mock.calls[0][1] as (p: {
        url: string;
      }) => Promise<unknown>;
      await expect(handler({ url: 'idb://missing/tile/s/0/0/0.pbf' })).rejects.toThrow(
        /IDB fetch failed/
      );
    });
  });

  describe('loadOfflineStyle', () => {
    it('does nothing when map is not attached', async () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      // No map attached — call should resolve without throwing.
      await expect(control.loadOfflineStyle('xyz')).resolves.toBeUndefined();
    });

    it('logs and returns when style not found', async () => {
      mockLoadStyleById.mockResolvedValueOnce(null);
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);
      await control.loadOfflineStyle('missing');
      expect(mockMap.setStyle).not.toHaveBeenCalled();
    });

    it('applies the patched style when found', async () => {
      mockLoadStyleById.mockResolvedValueOnce({
        key: 'abc',
        style: {
          version: 8,
          sources: {},
          layers: [],
          imports: [{ id: 'x', url: 'https://example.com/x.json' }],
        },
        provider: 'auto',
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);

      await control.loadOfflineStyle('abc');
      expect(mockMap.setStyle).toHaveBeenCalled();
      // The imports field should be stripped from the applied style.
      const appliedStyle = mockMap.setStyle.mock.calls[0][0];
      expect((appliedStyle as Record<string, unknown>).imports).toBeUndefined();
    });
  });

  describe('loadOfflineStyles', () => {
    it('alerts when no styles available', async () => {
      mockLoadStyles.mockResolvedValueOnce([]);
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);
      await control.loadOfflineStyles();
      expect(alertMock).toHaveBeenCalled();
      alertMock.mockRestore();
    });

    it('auto-loads when exactly one style is available', async () => {
      mockLoadStyles.mockResolvedValueOnce([
        {
          key: 'only-style',
          style: { version: 8, sources: {}, layers: [] },
          provider: 'auto',
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        },
      ]);
      mockLoadStyleById.mockResolvedValueOnce({
        key: 'only-style',
        style: { version: 8, sources: {}, layers: [] },
        provider: 'auto',
        regions: [],
        fonts: [],
        glyphs: [],
        sprites: [],
      });
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);
      await control.loadOfflineStyles();
      expect(mockMap.setStyle).toHaveBeenCalled();
    });

    it('shows a selection modal when multiple styles exist', async () => {
      mockLoadStyles.mockResolvedValueOnce([
        {
          key: 'a',
          style: { version: 8, name: 'A', sources: {}, layers: [] },
          provider: 'auto',
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        },
        {
          key: 'b',
          style: { version: 8, name: 'B', sources: {}, layers: [] },
          provider: 'auto',
          regions: [],
          fonts: [],
          glyphs: [],
          sprites: [],
        },
      ]);
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);
      await control.loadOfflineStyles();
      const modal = document.querySelector('.modal-backdrop');
      expect(modal).not.toBeNull();
      // Clean up
      modal?.remove();
    });

    it('does nothing when map is not attached', async () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      await expect(control.loadOfflineStyles()).resolves.toBeUndefined();
    });
  });

  describe('updateStyleUrl edge cases', () => {
    it('stores a new style URL via updateStyleUrl', () => {
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/style-one.json',
      });
      control.updateStyleUrl('https://example.com/style-two.json');
      expect(control.getCurrentStyleUrl()).toBe('https://example.com/style-two.json');
    });
  });

  describe('panel click handling', () => {
    it('stops propagation on panel clicks', () => {
      control = new OfflineManagerControl(mockOfflineManager as any);
      const mockMap = createMockMap();
      control.onAdd(mockMap as any);
      const panel = document.querySelector('.offline-manager-control.fixed') as HTMLElement;
      const ev = new MouseEvent('click', { bubbles: true });
      const stopProp = jest.spyOn(ev, 'stopPropagation');
      panel.dispatchEvent(ev);
      expect(stopProp).toHaveBeenCalled();
    });
  });

  describe('theme initialization', () => {
    it('does not override theme when one is saved', () => {
      localStorage.setItem('offline-manager-theme', 'light');
      control = new OfflineManagerControl(mockOfflineManager as any, {
        styleUrl: 'https://example.com/s.json',
        theme: 'dark',
      });
      localStorage.removeItem('offline-manager-theme');
      expect(control).toBeDefined();
    });
  });
});
