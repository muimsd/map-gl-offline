#!/usr/bin/env node
/**
 * Guard the UMD bundle's CDN contract.
 *
 * The docs tell people to drop `dist/index.umd.js` in a <script> tag and use
 * the `mapgloffline` global. That only works if the bundle is self-contained:
 * a CDN page has no module resolver, and `idb`, `@mapbox/tilebelt` and the
 * `@turf/*` packages publish no UMD global to fall back on. Leaving one of
 * them external produces a bundle that loads fine and then fails at the first
 * IndexedDB / geometry call — silent breakage that no unit test would catch.
 *
 * Only the map libraries (which the page loads itself) and `sql.js` (optional,
 * lazily imported, resolved from the `initSqlJs` global at call time) may stay
 * external.
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UMD_PATH = resolve(__dirname, '..', 'dist', 'index.umd.js');

const ALLOWED_EXTERNALS = new Set(['mapbox-gl', 'maplibre-gl', 'sql.js']);

const source = readFileSync(UMD_PATH, 'utf8');

// The UMD wrapper's AMD branch lists every external module id:
//   define(['exports', 'idb', '@turf/area'], factory)
const amdMatch = source.match(/define\(\[([^\]]*)\]\s*,\s*factory\)/);
if (!amdMatch) {
  console.error('check-umd: could not find the UMD wrapper in dist/index.umd.js');
  process.exit(1);
}

const externals = amdMatch[1]
  .split(',')
  .map(id => id.trim().replace(/^['"]|['"]$/g, ''))
  .filter(id => id && id !== 'exports');

const unexpected = externals.filter(id => !ALLOWED_EXTERNALS.has(id));

if (unexpected.length > 0) {
  console.error(
    `check-umd: dist/index.umd.js expects globals that no CDN provides: ${unexpected.join(', ')}.\n` +
      '           Bundle them in (see `umdExternal` in rollup.config.js) or the ' +
      'documented <script>-tag usage will fail at runtime.'
  );
  process.exit(1);
}

if (!source.includes('mapgloffline')) {
  console.error('check-umd: dist/index.umd.js does not expose the `mapgloffline` global');
  process.exit(1);
}

console.log(
  `check-umd: OK — UMD bundle is self-contained (externals: ${externals.join(', ') || 'none'})`
);
