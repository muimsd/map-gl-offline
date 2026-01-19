import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  server: {
    open: true, // Automatically open the browser
    proxy: {
      // Proxy Carto tile requests to avoid CORS issues
      '/tiles/carto-a': {
        target: 'https://tiles-a.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/carto-a/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
      '/tiles/carto-b': {
        target: 'https://tiles-b.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/carto-b/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
      '/tiles/carto-c': {
        target: 'https://tiles-c.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/carto-c/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
      '/tiles/carto-d': {
        target: 'https://tiles-d.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/carto-d/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
      // Proxy other common tile providers
      '/tiles/osm': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/osm/, ''),
      },
      // Proxy CARTO fonts to avoid CORS issues
      '/fonts/carto': {
        target: 'https://tiles.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fonts\/carto/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
      // Proxy CARTO TileJSON and API requests (main domain without subdomain)
      '/carto-api': {
        target: 'https://tiles.basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/carto-api/, ''),
        headers: {
          'User-Agent': 'map-gl-offline-dev',
        },
      },
    }
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
