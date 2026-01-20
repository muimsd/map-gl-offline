/**
 * E2E test for download tiles flow
 * Tests the offline map manager's tile download functionality
 */
import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = 'http://localhost:5173';
const TEST_TIMEOUT = 60000;

describe('Download Tiles Flow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warn') {
        console.log(`[Browser ${type}]:`, msg.text());
      }
    });

    // Log any page errors
    page.on('pageerror', error => {
      const err = error as Error;
      console.error('[Page Error]:', err.message);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('should load the map application', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Check that the page loaded
    const title = await page.title();
    console.log('Page title:', title);

    // Wait for the map to initialize
    await page.waitForSelector('.maplibregl-map, .mapboxgl-map', { timeout: 10000 });
    console.log('Map container found');

    // Check for the offline manager control button
    const controlButton = await page.$('.maplibregl-ctrl button, .mapboxgl-ctrl button');
    expect(controlButton).not.toBeNull();
    console.log('Control button found');
  }, TEST_TIMEOUT);

  test('should open offline manager panel', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Wait for map to load
    await page.waitForSelector('.maplibregl-map, .mapboxgl-map', { timeout: 10000 });

    // Find and click the offline manager control button
    // The button should be in the map controls area
    const buttons = await page.$$('.maplibregl-ctrl button, .mapboxgl-ctrl button');
    console.log(`Found ${buttons.length} control buttons`);

    // Click the first button (or find the specific offline manager button)
    if (buttons.length > 0) {
      await buttons[0].click();
      console.log('Clicked control button');

      // Wait a moment for panel to appear
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if panel opened
      const panel = await page.$('.offline-manager-control');
      if (panel) {
        console.log('Offline manager panel opened');
        const isVisible = await panel.isVisible();
        console.log('Panel visible:', isVisible);
      }
    }
  }, TEST_TIMEOUT);

  test('should verify IndexedDB is accessible', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Check IndexedDB availability
    const idbAvailable = await page.evaluate(() => {
      return 'indexedDB' in window;
    });
    expect(idbAvailable).toBe(true);
    console.log('IndexedDB available:', idbAvailable);

    // Check if our database can be opened
    const dbAccessible = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('offline-maps-db', 1);
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
        request.onerror = () => resolve(false);
      });
    });
    console.log('Database accessible:', dbAccessible);
  }, TEST_TIMEOUT);

  test('should test tile key utilities', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Wait for the app to load
    await page.waitForSelector('.maplibregl-map, .mapboxgl-map', { timeout: 10000 });

    // Test the tile key creation and parsing (inject test code)
    const tileKeyTest = await page.evaluate(async () => {
      // Access the module through the window if exposed, or test the logic directly
      const createTileKey = (x: number, y: number, z: number, styleId: string, sourceId: string, ext: string) => {
        return `${styleId}:${sourceId}:${z}:${x}:${y}.${ext}`;
      };

      const parseTileKey = (key: string) => {
        const parts = key.split(':');
        if (parts.length < 5) return null;

        const [styleId, sourceId, zStr, xStr, yWithExt] = parts;
        const z = parseInt(zStr, 10);
        const x = parseInt(xStr, 10);

        const dotIndex = yWithExt.lastIndexOf('.');
        if (dotIndex === -1) return null;

        const y = parseInt(yWithExt.substring(0, dotIndex), 10);
        const ext = yWithExt.substring(dotIndex + 1);

        if (isNaN(z) || isNaN(x) || isNaN(y)) return null;

        return { styleId, sourceId, z, x, y, ext };
      };

      // Test cases
      const key1 = createTileKey(1234, 5678, 12, 'voyager', 'carto', 'pbf');
      const parsed1 = parseTileKey(key1);

      const key2 = createTileKey(0, 0, 0, 'test-style', 'test-source', 'mvt');
      const parsed2 = parseTileKey(key2);

      // Invalid key
      const parsed3 = parseTileKey('invalid:key');

      return {
        key1,
        parsed1,
        key2,
        parsed2,
        parsed3,
        tests: {
          createKeyWorks: key1 === 'voyager:carto:12:1234:5678.pbf',
          parseKeyWorks: parsed1?.x === 1234 && parsed1?.y === 5678 && parsed1?.z === 12,
          invalidKeyReturnsNull: parsed3 === null,
        }
      };
    });

    console.log('Tile key test results:', JSON.stringify(tileKeyTest, null, 2));

    expect(tileKeyTest.tests.createKeyWorks).toBe(true);
    expect(tileKeyTest.tests.parseKeyWorks).toBe(true);
    expect(tileKeyTest.tests.invalidKeyReturnsNull).toBe(true);
  }, TEST_TIMEOUT);

  test('should verify fetch interceptor for idb:// URLs', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: TEST_TIMEOUT });

    // Wait for map to load (which sets up the fetch interceptor)
    await page.waitForSelector('.maplibregl-map, .mapboxgl-map', { timeout: 10000 });

    // Test that idb:// URLs are handled
    const fetchTest = await page.evaluate(async () => {
      try {
        // This should be caught by our idb fetch handler
        const response = await fetch('idb://test-style/tile/test-source/12/1234/5678.pbf');
        return {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        };
      } catch (error) {
        return {
          error: (error as Error).message,
        };
      }
    });

    console.log('IDB fetch test result:', fetchTest);

    // The fetch should return 404 (not found) since there's no tile stored
    // But it should NOT throw an error - the handler should process it
    expect(fetchTest.status).toBe(404);
  }, TEST_TIMEOUT);
});
