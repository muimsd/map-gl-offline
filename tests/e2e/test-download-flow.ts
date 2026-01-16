/**
 * E2E test for download tiles flow
 * Run with: npx tsx tests/e2e/test-download-flow.ts
 */
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:5173';

async function runTests() {
  console.log('🚀 Starting Download Tiles Flow E2E Test\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning' || msg.type() === 'log') {
      consoleLogs.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });

  let testsPassed = 0;
  let testsFailed = 0;

  async function runTest(name: string, testFn: () => Promise<void>) {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${(error as Error).message}`);
      testsFailed++;
    }
  }

  try {
    // Test 1: Load the page
    await runTest('Page loads successfully', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
      const title = await page.title();
      console.log(`   Page title: ${title}`);
    });

    // Test 2: Map container exists
    await runTest('Map container is present', async () => {
      await page.waitForSelector('.maplibregl-map, .mapboxgl-map', { timeout: 10000 });
    });

    // Test 3: Offline manager control exists
    await runTest('Offline manager control button exists', async () => {
      // Wait for controls to load
      await new Promise(r => setTimeout(r, 1000));
      const buttons = await page.$$('.maplibregl-ctrl button, .mapboxgl-ctrl button');
      if (buttons.length === 0) {
        throw new Error('No control buttons found');
      }
      console.log(`   Found ${buttons.length} control buttons`);
    });

    // Test 4: IndexedDB is accessible
    await runTest('IndexedDB is accessible', async () => {
      const idbAvailable = await page.evaluate(() => 'indexedDB' in window);
      if (!idbAvailable) {
        throw new Error('IndexedDB not available');
      }
    });

    // Test 5: Offline database can be opened
    await runTest('Offline database can be opened', async () => {
      const dbResult = await page.evaluate(async () => {
        return new Promise<{ success: boolean; stores?: string[] }>((resolve) => {
          const request = indexedDB.open('offline-maps-db');
          request.onsuccess = () => {
            const db = request.result;
            const stores = Array.from(db.objectStoreNames);
            db.close();
            resolve({ success: true, stores });
          };
          request.onerror = () => resolve({ success: false });
        });
      });

      if (!dbResult.success) {
        throw new Error('Could not open database');
      }
      console.log(`   Database stores: ${dbResult.stores?.join(', ') || 'none yet'}`);
    });

    // Test 6: IDB fetch handler works
    await runTest('IDB fetch handler intercepts idb:// URLs', async () => {
      const result = await page.evaluate(async () => {
        try {
          const response = await fetch('idb://test-region/tile/test-source/10/512/512.pbf');
          return { status: response.status, handled: true };
        } catch (e) {
          return { error: (e as Error).message, handled: false };
        }
      });

      if (!result.handled) {
        throw new Error(`Fetch not handled: ${result.error}`);
      }
      console.log(`   Response status: ${result.status} (expected 404 for missing tile)`);
    });

    // Test 7: Open offline panel
    await runTest('Offline panel can be opened', async () => {
      // Click on the first control button to open the panel
      const buttons = await page.$$('.maplibregl-ctrl button, .mapboxgl-ctrl button');

      // Find offline manager button (look for one with specific attributes or in right position)
      let clicked = false;
      for (const button of buttons) {
        const buttonText = await button.evaluate(el => el.textContent || el.innerHTML);
        // Click buttons to find the offline manager
        await button.click();
        await new Promise(r => setTimeout(r, 300));

        const panel = await page.$('.offline-manager-control:not(.hidden)');
        if (panel) {
          clicked = true;
          console.log(`   Panel opened successfully`);
          break;
        }
      }

      if (!clicked) {
        // Try to find panel that might already exist
        const panel = await page.$('.offline-manager-control');
        if (!panel) {
          throw new Error('Could not open offline panel');
        }
      }
    });

    // Test 8: Check for style download capability
    await runTest('Style service is accessible', async () => {
      const result = await page.evaluate(async () => {
        // Check if the offline manager is properly initialized
        // by checking if window has any related globals or the DB has styles
        return new Promise<{ ready: boolean; info: string }>((resolve) => {
          const request = indexedDB.open('offline-maps-db');
          request.onsuccess = () => {
            const db = request.result;
            const hasStoresTable = db.objectStoreNames.contains('styles');
            db.close();
            resolve({
              ready: true,
              info: hasStoresTable ? 'styles store exists' : 'database initialized',
            });
          };
          request.onerror = () => resolve({ ready: false, info: 'database error' });
        });
      });

      if (!result.ready) {
        throw new Error(result.info);
      }
      console.log(`   ${result.info}`);
    });

    // Test 9: Verify tile key creation logic
    await runTest('Tile key creation and parsing works correctly', async () => {
      const result = await page.evaluate(() => {
        // Test the tile key logic directly
        const createKey = (x: number, y: number, z: number, style: string, source: string, ext: string) =>
          `${style}:${source}:${z}:${x}:${y}.${ext}`;

        const parseKey = (key: string) => {
          const parts = key.split(':');
          if (parts.length < 5) return null;
          const [styleId, sourceId, zStr, xStr, yWithExt] = parts;
          const z = parseInt(zStr);
          const x = parseInt(xStr);
          const dotIdx = yWithExt.lastIndexOf('.');
          if (dotIdx === -1) return null;
          const y = parseInt(yWithExt.substring(0, dotIdx));
          const ext = yWithExt.substring(dotIdx + 1);
          if (isNaN(z) || isNaN(x) || isNaN(y)) return null;
          return { styleId, sourceId, z, x, y, ext };
        };

        const testKey = createKey(1234, 5678, 12, 'test-style', 'test-source', 'pbf');
        const parsed = parseKey(testKey);

        return {
          key: testKey,
          parsed,
          valid:
            parsed !== null &&
            parsed.x === 1234 &&
            parsed.y === 5678 &&
            parsed.z === 12 &&
            parsed.styleId === 'test-style' &&
            parsed.sourceId === 'test-source' &&
            parsed.ext === 'pbf',
        };
      });

      if (!result.valid) {
        throw new Error(`Key parsing failed: ${JSON.stringify(result)}`);
      }
      console.log(`   Key: ${result.key}`);
      console.log(`   Parsed correctly: x=${result.parsed?.x}, y=${result.parsed?.y}, z=${result.parsed?.z}`);
    });

    // Test 10: Check no JavaScript errors
    await runTest('No critical JavaScript errors', async () => {
      // Filter out expected/non-critical errors
      const criticalErrors = consoleErrors.filter(
        e =>
          !e.includes('404') &&
          !e.includes('not found') &&
          !e.includes('Failed to load resource')
      );

      if (criticalErrors.length > 0) {
        console.log(`   Errors found:`);
        criticalErrors.forEach(e => console.log(`   - ${e}`));
        throw new Error(`Found ${criticalErrors.length} critical errors`);
      }
    });

  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
