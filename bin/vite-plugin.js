import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_FILENAME = 'idb-offline-sw.js';

/**
 * Vite plugin that copies the offline Service Worker to the public directory.
 * Required for Mapbox GL JS offline support.
 *
 * @example
 * ```js
 * import { offlineSwPlugin } from 'map-gl-offline/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [offlineSwPlugin()],
 * });
 * ```
 */
export function offlineSwPlugin() {
  let projectRoot = '';

  return {
    name: 'map-gl-offline-sw',

    configResolved(config) {
      projectRoot = config.root;
    },

    buildStart() {
      const src = resolve(__dirname, '..', 'dist', SW_FILENAME);
      const destDir = join(projectRoot, 'public');
      const dest = join(destDir, SW_FILENAME);

      if (!existsSync(src)) {
        this.warn(
          `${SW_FILENAME} not found in map-gl-offline dist/. Skipping copy.`,
        );
        return;
      }

      mkdirSync(destDir, { recursive: true });
      cpSync(src, dest);
      console.log(`[map-gl-offline] Copied ${SW_FILENAME} to public/`);
    },
  };
}
