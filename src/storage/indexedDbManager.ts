import { openDB, IDBPDatabase } from 'idb';
import { OfflineMapDB } from '@/types';
import { DB_NAME, DB_VERSION } from '@/utils/constants';

/**
 * Creates all required object stores for the offline map database.
 * Called during initial database creation or when stores are missing.
 */
function createStores(db: IDBPDatabase<OfflineMapDB>): void {
  const stores = ['regions', 'tiles', 'styles', 'sprites', 'glyphs', 'fonts'] as const;

  for (const storeName of stores) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: 'key' });
    }
  }
}

/**
 * Migrates regions from the legacy 'regions' store to styles.regions[] array.
 * This runs during upgrade from v2 to v3.
 *
 * Note: Uses IDBRequest callbacks to ensure operations complete within
 * the upgrade transaction's lifetime (async/await can cause transaction to close).
 */
function migrateRegionsToStyles(transaction: IDBTransaction): void {
  const regionsStore = transaction.objectStore('regions');
  const stylesStore = transaction.objectStore('styles');

  const getAllRequest = regionsStore.getAll();

  getAllRequest.onsuccess = () => {
    const regions = getAllRequest.result;

    for (const region of regions) {
      const styleId = region.styleId;
      if (!styleId) continue;

      const getStyleRequest = stylesStore.get(styleId);

      getStyleRequest.onsuccess = () => {
        const style = getStyleRequest.result;
        if (!style) return;

        // Initialize regions array if needed
        style.regions = style.regions || [];

        // Check if region already exists
        const exists = style.regions.some((r: { id: string }) => r.id === region.id);

        if (!exists) {
          style.regions.push({
            id: region.id,
            name: region.name,
            bounds: region.bounds,
            styleUrl: region.styleUrl,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
            created: region.created,
            expiry: region.expiry,
            tileExtension: region.tileExtension,
          });
          stylesStore.put(style);
        }

        // Delete migrated region from legacy store
        regionsStore.delete(region.key);
      };
    }
  };
}

/**
 * IndexedDB database promise for offline map storage.
 *
 * Stores:
 * - styles: Map styles with embedded regions array
 * - tiles: Vector/raster tile data
 * - sprites: Sprite images and JSON
 * - glyphs: Font glyph data
 * - fonts: Font files
 * - regions: (deprecated) Legacy region storage, migrated to styles.regions[]
 *
 * @example
 * ```typescript
 * const db = await dbPromise;
 * const style = await db.get('styles', 'my-style-id');
 * ```
 */
export const dbPromise = openDB<OfflineMapDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    // Create all stores for fresh installs
    createStores(db);

    // Migration: v2 -> v3
    // Move regions from 'regions' store to styles.regions[]
    if (oldVersion > 0 && oldVersion < 3) {
      migrateRegionsToStyles(transaction as unknown as IDBTransaction);
    }
  },
});
