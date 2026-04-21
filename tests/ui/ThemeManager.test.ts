/**
 * Tests for ThemeManager
 */

// Mock matchMedia before importing ThemeManager
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

// Import after mock is set up
import { themeManager, lightTheme, darkTheme, systemTheme } from '../../src/ui/ThemeManager';

describe('ThemeManager', () => {
  // Store original values
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // Save original localStorage
    originalLocalStorage = window.localStorage;

    // Create mock localStorage
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: jest.fn((key: string) => storage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete storage[key];
      }),
      clear: jest.fn(() => {
        Object.keys(storage).forEach(key => delete storage[key]);
      }),
      key: jest.fn((index: number) => Object.keys(storage)[index] || null),
      length: 0,
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Reset theme to light
    themeManager.setThemePreference('light');
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe('Theme constants', () => {
    it('should have light theme with mode light and preference light', () => {
      expect(lightTheme.mode).toBe('light');
      expect(lightTheme.preference).toBe('light');
    });

    it('should have dark theme with mode dark and preference dark', () => {
      expect(darkTheme.mode).toBe('dark');
      expect(darkTheme.preference).toBe('dark');
    });

    it('should have system theme with preference system', () => {
      expect(systemTheme.preference).toBe('system');
    });
  });

  describe('getTheme', () => {
    it('should return current theme', () => {
      const theme = themeManager.getTheme();
      expect(theme).toBeDefined();
      expect(theme.mode).toBeDefined();
      expect(theme.preference).toBeDefined();
    });
  });

  describe('getEffectiveMode', () => {
    it('should return the effective mode', () => {
      themeManager.setThemePreference('dark');
      expect(themeManager.getEffectiveMode()).toBe('dark');
    });
  });

  describe('getPreference', () => {
    it('should return the preference', () => {
      themeManager.setThemePreference('system');
      expect(themeManager.getPreference()).toBe('system');
    });
  });

  describe('setThemePreference', () => {
    it('should set light theme preference', () => {
      themeManager.setThemePreference('light');
      expect(themeManager.getTheme().mode).toBe('light');
      expect(themeManager.getTheme().preference).toBe('light');
    });

    it('should set dark theme preference', () => {
      themeManager.setThemePreference('dark');
      expect(themeManager.getTheme().mode).toBe('dark');
      expect(themeManager.getTheme().preference).toBe('dark');
    });

    it('should set system theme preference', () => {
      themeManager.setThemePreference('system');
      expect(themeManager.getTheme().preference).toBe('system');
      // Mode will depend on system preference (mocked as false/light)
      expect(themeManager.getTheme().mode).toBe('light');
    });

    it('should save preference to localStorage', () => {
      themeManager.setThemePreference('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('offline-manager-theme', 'dark');
    });

    it('should add dark class to document when setting dark theme', () => {
      themeManager.setThemePreference('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class from document when setting light theme', () => {
      themeManager.setThemePreference('dark');
      themeManager.setThemePreference('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('setTheme (backwards compatibility)', () => {
    it('should set light theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getTheme().mode).toBe('light');
    });

    it('should set dark theme', () => {
      themeManager.setTheme('dark');
      expect(themeManager.getTheme().mode).toBe('dark');
    });
  });

  describe('cycleTheme', () => {
    it('should cycle from light to dark', () => {
      themeManager.setThemePreference('light');
      themeManager.cycleTheme();
      expect(themeManager.getTheme().preference).toBe('dark');
    });

    it('should cycle from dark to system', () => {
      themeManager.setThemePreference('dark');
      themeManager.cycleTheme();
      expect(themeManager.getTheme().preference).toBe('system');
    });

    it('should cycle from system to light', () => {
      themeManager.setThemePreference('system');
      themeManager.cycleTheme();
      expect(themeManager.getTheme().preference).toBe('light');
    });
  });

  describe('toggleTheme (backwards compatibility)', () => {
    it('should cycle through themes', () => {
      themeManager.setThemePreference('light');
      themeManager.toggleTheme();
      expect(themeManager.getTheme().preference).toBe('dark');
    });
  });

  describe('init from localStorage', () => {
    it('honors a saved light/dark preference on load', () => {
      jest.isolateModules(() => {
        localStorage.setItem('offline-manager-theme', 'dark');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { themeManager: fresh } = require('../../src/ui/ThemeManager');
        expect(fresh.getPreference()).toBe('dark');
        localStorage.removeItem('offline-manager-theme');
      });
    });

    it('defaults to system when no saved preference exists', () => {
      jest.isolateModules(() => {
        localStorage.removeItem('offline-manager-theme');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { themeManager: fresh } = require('../../src/ui/ThemeManager');
        expect(fresh.getPreference()).toBe('system');
      });
    });
  });

  describe('subscribe', () => {
    it('should notify listeners when theme changes', () => {
      const listener = jest.fn();
      themeManager.subscribe(listener);

      themeManager.setThemePreference('dark');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ mode: 'dark', preference: 'dark' }));
    });

    it('should allow unsubscribing', () => {
      const listener = jest.fn();
      const unsubscribe = themeManager.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      themeManager.setThemePreference('light');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      themeManager.subscribe(listener1);
      themeManager.subscribe(listener2);

      themeManager.setThemePreference('dark');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent listener gracefully', () => {
      const listener = jest.fn();
      const unsubscribe = themeManager.subscribe(listener);

      // Unsubscribe twice
      unsubscribe();
      unsubscribe();

      // Should not throw
    });
  });
});
