import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    open: true, // Automatically open the browser
  },
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
