#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_FILENAME = 'idb-offline-sw.js';

function init() {
  const src = resolve(__dirname, '..', 'dist', SW_FILENAME);
  const destDir = resolve(process.cwd(), 'public');
  const dest = join(destDir, SW_FILENAME);

  if (!existsSync(src)) {
    console.error(
      `Error: ${SW_FILENAME} not found in package dist/. Please reinstall map-gl-offline.`,
    );
    process.exit(1);
  }

  mkdirSync(destDir, { recursive: true });
  cpSync(src, dest);
  console.log(`Copied ${SW_FILENAME} to public/${SW_FILENAME}`);
}

const command = process.argv[2];

if (command === 'init') {
  init();
} else {
  console.log(`Usage: map-gl-offline <command>

Commands:
  init    Copy the Service Worker (${SW_FILENAME}) to public/

The Service Worker is required for Mapbox GL JS offline support.
MapLibre GL JS does not need it (uses addProtocol instead).`);
  process.exit(command ? 1 : 0);
}
