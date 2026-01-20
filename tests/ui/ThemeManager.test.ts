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
import { themeManager, lightTheme, darkTheme } from '../../src/ui/ThemeManager';

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
    themeManager.setTheme('light');
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
    it('should have light theme with mode light', () => {
      expect(lightTheme.mode).toBe('light');
    });

    it('should have dark theme with mode dark', () => {
      expect(darkTheme.mode).toBe('dark');
    });
  });

  describe('getTheme', () => {
    it('should return current theme', () => {
      const theme = themeManager.getTheme();
      expect(theme).toBeDefined();
      expect(theme.mode).toBeDefined();
    });
  });

  describe('setTheme', () => {
    it('should set light theme', () => {
      themeManager.setTheme('light');
      expect(themeManager.getTheme().mode).toBe('light');
    });

    it('should set dark theme', () => {
      themeManager.setTheme('dark');
      expect(themeManager.getTheme().mode).toBe('dark');
    });

    it('should save theme to localStorage', () => {
      themeManager.setTheme('dark');
      expect(localStorage.setItem).toHaveBeenCalledWith('offline-manager-theme', 'dark');
    });

    it('should add dark class to document when setting dark theme', () => {
      themeManager.setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class from document when setting light theme', () => {
      themeManager.setTheme('dark');
      themeManager.setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      themeManager.setTheme('light');
      themeManager.toggleTheme();
      expect(themeManager.getTheme().mode).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      themeManager.setTheme('dark');
      themeManager.toggleTheme();
      expect(themeManager.getTheme().mode).toBe('light');
    });
  });

  describe('subscribe', () => {
    it('should notify listeners when theme changes', () => {
      const listener = jest.fn();
      themeManager.subscribe(listener);

      themeManager.setTheme('dark');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ mode: 'dark' }));
    });

    it('should allow unsubscribing', () => {
      const listener = jest.fn();
      const unsubscribe = themeManager.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      themeManager.setTheme('light');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      themeManager.subscribe(listener1);
      themeManager.subscribe(listener2);

      themeManager.setTheme('dark');

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
