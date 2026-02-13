import { logger } from './logger';

const swLogger = logger.scope('ServiceWorker');

const SW_READY_TIMEOUT_MS = 10000;

/**
 * Register the offline Service Worker and wait until it controls the page.
 *
 * The SW intercepts `/__offline__/{downloadId}/{type}/{path}` requests and
 * serves resources from IndexedDB. This is required for Mapbox GL JS v3 which
 * does not have `addProtocol`, so web worker fetch calls cannot be intercepted
 * via `window.fetch` alone.
 *
 * @param swUrl - URL of the SW script. Defaults to `/idb-offline-sw.js`.
 * @returns The ServiceWorkerRegistration, or rejects on timeout / error.
 */
export async function registerOfflineServiceWorker(
  swUrl = '/idb-offline-sw.js'
): Promise<ServiceWorkerRegistration> {
  if (!navigator.serviceWorker) {
    throw new Error('Service Workers are not supported in this browser');
  }

  swLogger.debug('Registering offline service worker:', swUrl);

  const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
  swLogger.debug('SW registered, waiting for activation...');

  // If there's already a controlling SW, we're good
  if (navigator.serviceWorker.controller) {
    swLogger.debug('SW already controlling the page');
    return registration;
  }

  // Wait for the SW to take control (via clients.claim())
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Service Worker activation timed out'));
    }, SW_READY_TIMEOUT_MS);

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timeout);
        swLogger.debug('SW now controlling the page');
        resolve(registration);
      },
      { once: true }
    );

    // Also check if the installing/waiting worker becomes active
    const sw = registration.installing || registration.waiting || registration.active;
    if (sw && sw.state === 'activated') {
      // Already activated but controllerchange may fire from clients.claim()
      // Give it a short grace period
      setTimeout(() => {
        if (navigator.serviceWorker.controller) {
          clearTimeout(timeout);
          swLogger.debug('SW activated and controlling');
          resolve(registration);
        }
      }, 100);
    }
  });
}

/**
 * Unregister the offline Service Worker.
 * @returns `true` if a registration was found and unregistered.
 */
export async function unregisterOfflineServiceWorker(): Promise<boolean> {
  if (!navigator.serviceWorker) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  if (registration) {
    swLogger.debug('Unregistering offline service worker');
    return registration.unregister();
  }
  return false;
}
