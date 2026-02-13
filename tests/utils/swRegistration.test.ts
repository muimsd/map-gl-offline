/**
 * Tests for swRegistration utility
 */

// Mock the logger to avoid noise
jest.mock('../../src/utils/logger', () => {
  const mockScopedLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  };
  return {
    logger: {
      scope: jest.fn(() => mockScopedLogger),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn(),
      configure: jest.fn(),
    },
  };
});

import {
  registerOfflineServiceWorker,
  unregisterOfflineServiceWorker,
} from '../../src/utils/swRegistration';

/**
 * Helper to create a mock ServiceWorkerContainer with configurable properties.
 */
function createMockServiceWorkerContainer(
  overrides: {
    controller?: ServiceWorker | null;
    registerResult?: ServiceWorkerRegistration;
    getRegistrationResult?: ServiceWorkerRegistration | undefined;
  } = {}
) {
  const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};

  const mockRegistration = {
    installing: null,
    waiting: null,
    active: null,
    scope: '/',
    updateViaCache: 'imports' as ServiceWorkerUpdateViaCache,
    navigationPreload: {} as NavigationPreloadManager,
    onupdatefound: null,
    getNotifications: jest.fn().mockResolvedValue([]),
    showNotification: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    unregister: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn().mockReturnValue(true),
    ...(overrides.registerResult || {}),
  } as unknown as ServiceWorkerRegistration;

  const container = {
    controller: overrides.controller !== undefined ? overrides.controller : null,
    ready: Promise.resolve(mockRegistration),
    oncontrollerchange: null,
    onmessage: null,
    onmessageerror: null,
    register: jest.fn().mockResolvedValue(mockRegistration),
    getRegistration: jest.fn().mockResolvedValue(
      overrides.getRegistrationResult !== undefined
        ? overrides.getRegistrationResult
        : undefined
    ),
    getRegistrations: jest.fn().mockResolvedValue([]),
    startMessages: jest.fn(),
    addEventListener: jest.fn((event: string, handler: EventListenerOrEventListenerObject) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: EventListenerOrEventListenerObject) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
    dispatchEvent: jest.fn().mockReturnValue(true),
  };

  return { container, mockRegistration, listeners };
}

describe('swRegistration', () => {
  let savedDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    savedDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  });

  afterEach(() => {
    // Restore navigator.serviceWorker
    if (savedDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', savedDescriptor);
    } else {
      // Remove any own-property override we added
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
    jest.restoreAllMocks();
  });

  describe('registerOfflineServiceWorker', () => {
    it('should throw when Service Workers are not supported', async () => {
      // Make navigator.serviceWorker falsy (undefined)
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await expect(registerOfflineServiceWorker()).rejects.toThrow(
        'Service Workers are not supported in this browser'
      );
    });

    it('should return existing registration when SW already controlling page', async () => {
      const mockController = { state: 'activated' } as ServiceWorker;
      const { container, mockRegistration } = createMockServiceWorkerContainer({
        controller: mockController,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      const result = await registerOfflineServiceWorker();

      expect(container.register).toHaveBeenCalledWith('/idb-offline-sw.js', { scope: '/' });
      expect(result).toBe(mockRegistration);
    });

    it('should use default SW URL /idb-offline-sw.js', async () => {
      const mockController = { state: 'activated' } as ServiceWorker;
      const { container } = createMockServiceWorkerContainer({
        controller: mockController,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      await registerOfflineServiceWorker();

      expect(container.register).toHaveBeenCalledWith('/idb-offline-sw.js', { scope: '/' });
    });

    it('should accept a custom SW URL', async () => {
      const mockController = { state: 'activated' } as ServiceWorker;
      const { container } = createMockServiceWorkerContainer({
        controller: mockController,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      await registerOfflineServiceWorker('/custom-sw.js');

      expect(container.register).toHaveBeenCalledWith('/custom-sw.js', { scope: '/' });
    });

    it('should wait for controllerchange event and resolve', async () => {
      const { container, mockRegistration, listeners } = createMockServiceWorkerContainer({
        controller: null,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      const promise = registerOfflineServiceWorker();

      // Wait a tick so the addEventListener is set up
      await new Promise(resolve => setTimeout(resolve, 0));

      // Fire controllerchange
      const handlers = listeners['controllerchange'];
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
      for (const handler of handlers) {
        if (typeof handler === 'function') {
          handler(new Event('controllerchange'));
        }
      }

      const result = await promise;
      expect(result).toBe(mockRegistration);
    });

    it('should time out after 10s if SW never activates', async () => {
      jest.useFakeTimers();

      const { container } = createMockServiceWorkerContainer({
        controller: null,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      // Attach rejection handler before advancing timers
      const promise = registerOfflineServiceWorker().catch((err: Error) => err);

      // Advance past the timeout
      await jest.advanceTimersByTimeAsync(10001);

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Service Worker activation timed out');

      jest.useRealTimers();
    }, 15000);

    it('should resolve when SW is already activated and controller becomes available', async () => {
      jest.useFakeTimers();

      const mockSW = { state: 'activated' } as ServiceWorker;
      const { container, mockRegistration } = createMockServiceWorkerContainer({
        controller: null,
      });

      // Set the registration to have an active worker that's already activated
      Object.defineProperty(mockRegistration, 'active', { value: mockSW, writable: true });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      const promise = registerOfflineServiceWorker();

      // Simulate controller becoming available before the 100ms grace check
      (container as Record<string, unknown>).controller = mockSW;

      await jest.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toBe(mockRegistration);

      jest.useRealTimers();
    });
  });

  describe('unregisterOfflineServiceWorker', () => {
    it('should return true when registration is found and unregistered', async () => {
      const mockRegistration = {
        unregister: jest.fn().mockResolvedValue(true),
      } as unknown as ServiceWorkerRegistration;

      const { container } = createMockServiceWorkerContainer({
        getRegistrationResult: mockRegistration,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      const result = await unregisterOfflineServiceWorker();

      expect(container.getRegistration).toHaveBeenCalledWith('/');
      expect(mockRegistration.unregister).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when no registration is found', async () => {
      const { container } = createMockServiceWorkerContainer({
        getRegistrationResult: undefined,
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        value: container,
        configurable: true,
        writable: true,
      });

      const result = await unregisterOfflineServiceWorker();

      expect(container.getRegistration).toHaveBeenCalledWith('/');
      expect(result).toBe(false);
    });

    it('should return false when Service Workers are not supported', async () => {
      // Make navigator.serviceWorker falsy (undefined)
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const result = await unregisterOfflineServiceWorker();
      expect(result).toBe(false);
    });
  });
});
