/**
 * Standalone test file for `resetOfflineMapDB`. Isolated from other tests
 * because deleting the shared DB invalidates the module-level `dbPromise`
 * connection, which would break sibling test suites running in the same
 * worker.
 */
import { DB_NAME } from '../../src/utils/constants';
import {
  dbPromise,
  resetOfflineMapDB,
  OfflineMapDBVersionError,
} from '../../src/storage/indexedDbManager';

describe('resetOfflineMapDB', () => {
  it('deletes the offline-map-db database', async () => {
    // Make sure the DB exists from the normal open path before we wipe.
    const db = await dbPromise;
    expect(db.name).toBe(DB_NAME);
    // Seed something we can verify disappears.
    await db.put('styles', {
      key: 'seed-style',
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto',
      regions: [],
      fonts: [],
      glyphs: [],
      sprites: [],
    } as never);
    expect(await db.get('styles', 'seed-style')).toBeDefined();

    // Close the connection first so the delete isn't blocked.
    db.close();

    await expect(resetOfflineMapDB()).resolves.toBeUndefined();

    // After deletion, the DB should no longer exist in the list.
    const dbs = (await indexedDB.databases?.()) ?? [];
    expect(dbs.find(d => d.name === DB_NAME)).toBeUndefined();
  });
});

describe('OfflineMapDBVersionError', () => {
  it('round-trips requestedVersion and existingVersion', () => {
    const err = new OfflineMapDBVersionError(3, 4);
    expect(err.name).toBe('OfflineMapDBVersionError');
    expect(err.requestedVersion).toBe(3);
    expect(err.existingVersion).toBe(4);
    expect(err).toBeInstanceOf(Error);
  });

  it('serializes unknown existingVersion gracefully', () => {
    const err = new OfflineMapDBVersionError(3, undefined);
    expect(err.existingVersion).toBeUndefined();
    expect(err.message).toContain('unknown');
  });
});
