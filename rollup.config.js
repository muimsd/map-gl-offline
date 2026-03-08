import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const external = [
  'mapbox-gl',
  'maplibre-gl',
  '@mapbox/tilebelt',
  'idb',
  'i18next',
  '@turf/area',
  '@turf/bbox-polygon',
  '@turf/difference',
  '@turf/helpers'
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
        exports: 'named'
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'mapgloffline',
        sourcemap: true,
        exports: 'named',
        globals: {
          'mapbox-gl': 'mapboxgl',
          'maplibre-gl': 'maplibregl',
          '@mapbox/tilebelt': 'tilebelt',
          'idb': 'idb',
          'i18next': 'i18next',
          '@turf/area': 'turfArea',
          '@turf/bbox-polygon': 'turfBboxPolygon',
          '@turf/difference': 'turfDifference',
          '@turf/helpers': 'turfHelpers'
        }
      }
    ],
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        sourceMap: true,
        declaration: false,
        declarationMap: false
      })
    ]
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
