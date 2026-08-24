import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

// Dependencies left to the consumer's package manager for the ESM/CJS builds.
const external = [
  'mapbox-gl',
  'maplibre-gl',
  '@mapbox/tilebelt',
  'idb',
  'i18next',
  'sql.js',
  '@turf/area',
  '@turf/bbox-polygon',
  '@turf/difference',
  '@turf/helpers'
];

// The UMD build targets `<script>`-tag / CDN usage, where npm dependencies
// aren't resolvable. Only the map libraries (which the page loads itself and
// which expose real globals) and `sql.js` (optional, lazily imported, and
// ~1.5 MB of Emscripten glue) stay external — everything else is bundled in.
// `idb`, `@mapbox/tilebelt` and the `@turf/*` packages ship no UMD global at
// all, so leaving them external produced a bundle that loaded and then failed
// at the first IndexedDB call.
const umdExternal = ['mapbox-gl', 'maplibre-gl', 'sql.js'];

const plugins = [
  resolve({
    preferBuiltins: true,
    browser: true
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.build.json',
    sourceMap: true,
    declaration: false,
    declarationMap: false
  })
];

export default defineConfig([
  // ESM and CJS builds
  {
    input: 'src/index.ts',
    external,
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
        // `sql.js` is loaded via dynamic import in sqlJsLoader.ts. Inline it
        // (as an `await import('sql.js')` reference, since it's external)
        // so we can keep shipping a single-file bundle.
        inlineDynamicImports: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
        inlineDynamicImports: true
      }
    ],
    plugins
  },
  // Self-contained UMD build for CDN consumers
  {
    input: 'src/index.ts',
    external: umdExternal,
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'mapgloffline',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true,
      globals: {
        'mapbox-gl': 'mapboxgl',
        'maplibre-gl': 'maplibregl',
        // Only reached if the page loads sql.js itself; MBTiles import/export
        // otherwise falls back to the `initSqlJs` global at call time.
        'sql.js': 'initSqlJs'
      }
    },
    plugins
  },
  // Type definitions bundle
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()]
  }
]);
