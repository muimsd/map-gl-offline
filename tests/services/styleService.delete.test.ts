/**
 * Deleting a style removes everything stored for it, and nothing else.
 */
import {
  deleteStyleById,
  deleteStyles,
  getStyleStorageSizes,
} from '../../src/services/styleService';
import { dbPromise } from '../../src/storage/indexedDbManager';

const STORES = ['styles', 'tiles', 'glyphs', 'sprites', 'fonts', 'models'] as const;
const bytes = () => new ArrayBuffer(8);

/** Store one of everything for a style. */
const seed = async (styleId: string) => {
  const db = await dbPromise;
  const put = db.put.bind(db) as (store: string, value: unknown) => Promise<unknown>;
  await put('styles', { key: styleId, style: { version: 8, sources: {}, layers: [] }, regions: [] });
  await put('tiles', {
    key: `${styleId}:composite:14:1:2.pbf`,
    styleId,
    sourceId: 'composite',
    data: bytes(),
    size: 8,
  });
  await put('glyphs', { key: `${styleId}::DIN Pro/0-255.pbf`, styleId, data: bytes(), size: 8 });
  await put('sprites', { key: `${styleId}::sprite.png`, styleId, data: bytes(), size: 8 });
  await put('fonts', { key: `${styleId}:font.pbf`, styleId, data: bytes(), size: 8 });
  await put('models', { key: `${styleId}::model::tree`, styleId, data: bytes(), size: 8 });
};

const keysIn = async (store: (typeof STORES)[number]) => {
  const db = await dbPromise;
  return (await db.getAllKeys(store as 'tiles')).map(String);
};

describe('deleting styles', () => {
  beforeEach(async () => {
    const db = await dbPromise;
    for (const store of STORES) await db.clear(store as 'tiles');
  });

  it('getStyleStorageSizes totals tiles and other resources for each style', async () => {
    await seed('abc');
    await seed('abc_def');
    expect(await getStyleStorageSizes()).toEqual({
      abc: { tiles: 8, resources: 32 },
      abc_def: { tiles: 8, resources: 32 },
    });
  });

  it('deleteStyleById removes the style and all its stored data', async () => {
    await seed('abc');
    await deleteStyleById('abc');
    for (const store of STORES) {
      expect({ store, keys: await keysIn(store) }).toEqual({ store, keys: [] });
    }
  });

  it("deleteStyleById leaves other styles' data alone, even with a similar id", async () => {
    await seed('abc');
    await seed('abc_def');
    await deleteStyleById('abc');
    for (const store of STORES) {
      const keys = await keysIn(store);
      expect(keys).toHaveLength(1);
      expect(keys[0].startsWith('abc_def')).toBe(true);
    }
  });

  it('deleteStyles removes every style and all their stored data', async () => {
    await seed('abc');
    await seed('xyz');
    await deleteStyles();
    for (const store of STORES) {
      expect({ store, keys: await keysIn(store) }).toEqual({ store, keys: [] });
    }
  });
});
