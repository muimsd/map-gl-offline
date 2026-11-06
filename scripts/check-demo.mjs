#!/usr/bin/env node
/**
 * Build the demo, open both renderer tabs in a real browser and fail if a map
 * doesn't draw. Unit tests can't see this: a Mapbox GL / MapLibre conflict once
 * left every Mapbox style as a blank background with nothing in the console, so
 * this judges the rendered pixels rather than relying on errors.
 *
 *   npm run check:demo
 *
 * The Mapbox tab needs VITE_MAPBOX_ACCESS_TOKEN (environment or `.env`). Without
 * one, for example on a fork's pull request, it's skipped with a warning.
 * Exits 1 if a check fails and 2 if the check itself can't run.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { build, loadEnv, preview } from 'vite';

const PORT = 4199;
const URL_ROOT = `http://localhost:${PORT}/`;
const DRAW_TIMEOUT_MS = 60000;
const POLL_MS = 3000;
/** A blank map is one flat colour. A drawn one, even Light, is far more varied. */
const MAX_DOMINANT_COLOUR_SHARE = 0.75;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const scrub = text => String(text).replace(/pk\.[\w.-]+/g, 'pk.X');

/** The share of the map's pixels taken by its most common colour. */
async function dominantColourShare(page, containerId) {
  const container = await page.$(`#${containerId}`);
  const box = await container?.boundingBox();
  if (!box) throw new Error(`#${containerId} isn't on the page`);

  const image = await page.screenshot({ encoding: 'base64', clip: box });
  return page.evaluate(async base64 => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, img.width, img.height);

    const counts = new Map();
    let total = 0;
    for (let i = 0; i < data.length; i += 16) {
      // Rounded a little, so anti-aliasing doesn't split one colour into many.
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
    return Math.max(...counts.values()) / total;
  }, image);
}

/** Wait for the map to draw, since tiles arrive over time. Returns the last share seen. */
async function waitForDrawnMap(page, containerId) {
  const deadline = Date.now() + DRAW_TIMEOUT_MS;
  let share = 1;
  while (Date.now() < deadline) {
    share = await dominantColourShare(page, containerId);
    if (share < MAX_DOMINANT_COLOUR_SHARE) return { drawn: true, share };
    await wait(POLL_MS);
  }
  return { drawn: false, share };
}

async function switchTab(page, tabId) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
    page.click(`#${tabId}`),
  ]);
}

async function selectMapboxStyle(page, name) {
  await page.evaluate(styleName => {
    const select = document.querySelector('#map-mapbox select');
    const index = [...select.options].findIndex(option => option.text === styleName);
    if (index < 0) throw new Error(`No Mapbox style named ${styleName}`);
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, name);
  // The outgoing style stays on screen for a moment.
  await wait(POLL_MS);
}

async function run(page, hasMapboxToken) {
  const failures = [];
  const fatalErrors = [];
  page.on('pageerror', error => fatalErrors.push(scrub(error)));
  page.on('console', message => {
    // Failed resources are left to the pixel check, since one missing tile is
    // normal but a map that can't draw isn't.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      fatalErrors.push(scrub(message.text()));
    }
  });

  const check = async (label, containerId) => {
    const { drawn, share } = await waitForDrawnMap(page, containerId);
    const newErrors = fatalErrors.splice(0).slice(0, 3);
    const percent = (share * 100).toFixed(0);
    const ok = drawn && newErrors.length === 0;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: most common colour ${percent}% of the map`);
    if (!drawn) failures.push(`${label}: map is blank (${percent}% one colour)`);
    for (const error of newErrors) failures.push(`${label}: ${error.slice(0, 200)}`);
  };

  await page.goto(URL_ROOT, { waitUntil: 'load', timeout: 30000 });
  await check('MapLibre tab', 'map-maplibre');

  if (!hasMapboxToken) {
    const message = 'No VITE_MAPBOX_ACCESS_TOKEN, so the Mapbox tab was not checked';
    console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `WARN ${message}`);
    return failures;
  }

  await switchTab(page, 'tab-mapbox');

  // The renderers can't share a page: see "One renderer per page" in CLAUDE.md.
  const pageState = await page.evaluate(() => ({
    stamped: Object.prototype.hasOwnProperty.call(Set, '_classRegistryKey'),
    maplibreCanvases: document.querySelectorAll('.maplibregl-canvas').length,
  }));
  if (pageState.stamped || pageState.maplibreCanvases > 0) {
    failures.push('Mapbox tab: MapLibre is also loaded on the page, which breaks Mapbox GL');
  }

  await check('Mapbox tab, Streets', 'map-mapbox');
  await selectMapboxStyle(page, 'Standard');
  await check('Mapbox tab, Standard', 'map-mapbox');

  await switchTab(page, 'tab-maplibre');
  await check('MapLibre tab, after switching back', 'map-maplibre');

  return failures;
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-gl-offline-demo-'));
  const outDir = path.join(tempDir, 'build');
  const hasMapboxToken = Boolean(
    loadEnv('production', process.cwd(), 'VITE_').VITE_MAPBOX_ACCESS_TOKEN
  );

  let server;
  let browser;
  try {
    await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
    server = await preview({
      logLevel: 'error',
      build: { outDir },
      preview: { port: PORT, strictPort: true, open: false },
    });
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: path.join(tempDir, 'profile'),
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    });
    const failures = await run(await browser.newPage(), hasMapboxToken);

    if (failures.length > 0) {
      console.error(`\n${failures.length} problem(s) in the demo:`);
      for (const failure of failures) console.error(`  - ${failure}`);
      return 1;
    }
    console.log('\nThe demo draws on every checked tab.');
    return 0;
  } catch (error) {
    console.error(`The check could not run: ${scrub(error?.message ?? error)}`);
    return 2;
  } finally {
    await browser?.close().catch(() => {});
    await server?.close().catch(() => {});
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

process.exit(await main());
