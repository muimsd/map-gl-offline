import { openDB, IDBPDatabase } from 'idb';
import { OfflineMapDB } from '@/types';
import { DB_NAME, DB_VERSION } from '@/utils/constants';

/**
 * Thrown when the on-disk IndexedDB is at a higher schema version than the
 * library was built against — i.e. after a downgrade, or when another app
 * sharing the origin already created a DB with the same name at a newer
 * version. Raw `VersionError` from IDB is not actionable for library consumers;
 * this subclass lets callers detect and surface a clear message, or decide
 * whether to call `resetOfflineMapDB()` to recover (destructive — deletes all
 * stored offline data).
 */
export class OfflineMapDBVersionError extends Error {
  constructor(
    public readonly requestedVersion: number,
    public readonly existingVersion: number | undefined
  ) {
    super(
      `offline-map storage is at version ${existingVersion ?? 'unknown'}, but this build ` +
        `requests version ${requestedVersion}. This usually means another app at the same ` +
        `origin created an incompatible database, or the library was downgraded. ` +
        `Call resetOfflineMapDB() to wipe it (destructive — deletes stored offline data).`
    );
    this.name = 'OfflineMapDBVersionError';
  }
}

/**
 * Deletes the offline-map IndexedDB database. Destructive — wipes all stored
 * styles/tiles/sprites/glyphs/fonts. Intended recovery path for callers that
 * caught an {@link OfflineMapDBVersionError}.
 */
export async function resetOfflineMapDB(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // will complete once other connections close
  });
}

/**
 * Creates all required object stores for the offline map database.
 * Called during initial database creation or when stores are missing.
 */
function createStores(db: IDBPDatabase<OfflineMapDB>): void {
  const stores = ['regions', 'tiles', 'styles', 'sprites', 'glyphs', 'fonts', 'models'] as const;

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
  // Guard: both stores must exist for migration
  if (
    !transaction.objectStoreNames.contains('regions') ||
    !transaction.objectStoreNames.contains('styles')
  ) {
    return;
  }

  const regionsStore = transaction.objectStore('regions');
  const stylesStore = transaction.objectStore('styles');

  const getAllRequest = regionsStore.getAll();

  getAllRequest.onsuccess = () => {
    const regions = getAllRequest.result;

    // Group regions by styleId to avoid read-after-write race on the same style
    const regionsByStyle = new Map<string, typeof regions>();
    for (const region of regions) {
      const styleId = region.styleId;
      if (!styleId) continue;
      const existing = regionsByStyle.get(styleId);
      if (existing) {
        existing.push(region);
      } else {
        regionsByStyle.set(styleId, [region]);
      }
    }

    // Process each style group with a single read-modify-write
    for (const [styleId, styleRegions] of regionsByStyle) {
      const getStyleRequest = stylesStore.get(styleId);

      getStyleRequest.onsuccess = () => {
        const style = getStyleRequest.result;
        if (!style) return;

        // Initialize regions array if needed
        style.regions = style.regions || [];

        // Add all regions for this style in one batch
        for (const region of styleRegions) {
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
          }
          // Delete migrated region from legacy store
          regionsStore.delete(region.key);
        }

        // Single put per style with all regions
        stylesStore.put(style);
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
 * - models: 3D model files (.glb) for Mapbox Standard tree/turbine layers
 * - regions: (deprecated) Legacy region storage, migrated to styles.regions[]
 *
 * @example
 * ```typescript
 * const db = await dbPromise;
 * const style = await db.get('styles', 'my-style-id');
 * ```
 */
async function openOfflineMapDB(): Promise<IDBPDatabase<OfflineMapDB>> {
  try {
    return await openDB<OfflineMapDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Create all stores for fresh installs
        createStores(db);

        // Migration: v2 -> v3
        // Move regions from 'regions' store to styles.regions[]
        if (oldVersion > 0 && oldVersion < 3) {
          migrateRegionsToStyles(transaction as unknown as IDBTransaction);
        }
        // Migration: v3 -> v4
        // Adds the `models` store for Mapbox Standard 3D model assets.
        // No data migration needed — createStores above handles it.
      },
    });
  } catch (error) {
    // Convert raw IDB VersionError into something library consumers can
    // inspect and recover from via resetOfflineMapDB().
    const isVersionError =
      error instanceof DOMException
        ? error.name === 'VersionError'
        : (error as { name?: string })?.name === 'VersionError';
    if (isVersionError) {
      let existingVersion: number | undefined;
      try {
        const dbs = (await indexedDB.databases?.()) ?? [];
        existingVersion = dbs.find(d => d.name === DB_NAME)?.version;
      } catch {
        // databases() unavailable (Firefox pre-126); leave existingVersion undefined
      }
      throw new OfflineMapDBVersionError(DB_VERSION, existingVersion);
    }
    throw error;
  }
}

export const dbPromise = openOfflineMapDB();
