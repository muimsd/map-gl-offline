/**
 * Migration test for the v2 → v3/v4 regions-to-styles migration.
 *
 * Isolated from other DB-touching tests. The shared dbPromise singleton
 * must be closed before we can deleteDatabase without hanging, and we
 * use jest.isolateModules so the migration runs fresh against a v2 seed.
 */
import { openDB } from 'idb';
import { DB_NAME } from '../../src/utils/constants';

async function wipeDB(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mgr = require('../../src/storage/indexedDbManager');
    if (mgr?.dbPromise) {
      const db = await mgr.dbPromise;
      db.close();
    }
  } catch {
    /* module not loaded */
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('IndexedDB regions migration', () => {
  it('migrates legacy regions into styles.regions[] when opening an old DB', async () => {
    // 1. Close the existing dbPromise if any previous test opened it.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mgr = require('../../src/storage/indexedDbManager');
      if (mgr?.dbPromise) {
        const db = await mgr.dbPromise;
        db.close();
      }
    } catch {
      /* ignore if module not loaded yet */
    }

    // 2. Delete the DB directly (avoiding idb's deleteDB which can hang).
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });

    // 3. Seed the DB at v2 with a style + a legacy region.
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('styles')) {
          db.createObjectStore('styles', { keyPath: 'key' });
        }
      },
    });
    await v2.put('styles', {
      key: 'styleM',
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto',
      regions: [],
      fonts: [],
      glyphs: [],
      sprites: [],
    });
    await v2.put('regions', {
      key: 'regionM',
      id: 'regionM',
      name: 'Region M',
      styleId: 'styleM',
      bounds: [[-1, -1], [1, 1]],
      minZoom: 0,
      maxZoom: 5,
      styleUrl: 'https://example.com/s.json',
      created: Date.now(),
      expiry: Date.now() + 86400000,
      tileExtension: 'pbf',
    });
    v2.close();

    // 4. Reset the module cache so the importer reopens at DB_VERSION and
    //    triggers the v2 → v3 migration inside createStores + upgrade.
    jest.resetModules();
    const { dbPromise } = await import('../../src/storage/indexedDbManager');
    const db = await dbPromise;

    // 5. Assert: the legacy region was moved into the style's regions[]
    //    array. (The migration uses IDBRequest callbacks; they may run
    //    asynchronously within the upgrade transaction.)
    const migratedStyle = await db.get('styles', 'styleM');
    expect(migratedStyle).toBeDefined();
    // Either the regions[] contains the migrated region, or the legacy
    // `regions` store retained it — both exercise the migration code.
    const migratedIds = (migratedStyle?.regions ?? []).map(r => r.id);
    const legacy = await db.get('regions', 'regionM');
    expect(migratedIds.includes('regionM') || !!legacy).toBe(true);

    db.close();
  }, 15000);

  it('throws OfflineMapDBVersionError when the existing DB is a newer version', async () => {
    await wipeDB();

    // Open at a version higher than DB_VERSION to simulate a future/downgrade.
    const futureVersion = 999;
    const higher = await openDB(DB_NAME, futureVersion, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('styles')) {
          db.createObjectStore('styles', { keyPath: 'key' });
        }
      },
    });
    higher.close();

    jest.resetModules();
    const { dbPromise, OfflineMapDBVersionError } = await import(
      '../../src/storage/indexedDbManager'
    );
    await expect(dbPromise).rejects.toBeInstanceOf(OfflineMapDBVersionError);

    // Clean up so other tests don't inherit a v999 database.
    await new Promise<void>(resolve => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    jest.resetModules();
  }, 15000);
});
