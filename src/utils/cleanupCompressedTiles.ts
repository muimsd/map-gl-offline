import { dbPromise } from '../storage/indexedDbManager';

export interface CompressedTileStats {
  total: number;
  gzipped: number;
  uncompressed: number;
}

export interface CompressedTileCleanupResult {
  checked: number;
  removed: number;
  errors: string[];
}

function isGzipCompressed(data: ArrayBuffer): boolean {
  if (data.byteLength < 2) return false;
  const view = new Uint8Array(data);
  return view[0] === 0x1f && view[1] === 0x8b;
}

export async function countCompressedTiles(): Promise<CompressedTileStats> {
  const db = await dbPromise;
  const tx = db.transaction(['tiles'], 'readonly');
  const store = tx.objectStore('tiles');
  
  let total = 0;
  let gzipped = 0;
  let uncompressed = 0;
  
  let cursor = await store.openCursor();
  
  while (cursor) {
    total++;
    
    const tile = cursor.value;
    if (tile.data && isGzipCompressed(tile.data)) {
      gzipped++;
    } else {
      uncompressed++;
    }
    
    cursor = await cursor.continue();
  }
  
  return { total, gzipped, uncompressed };
}

export async function cleanupCompressedTiles(): Promise<CompressedTileCleanupResult> {
  const db = await dbPromise;
  const tx = db.transaction(['tiles'], 'readwrite');
  const store = tx.objectStore('tiles');
  
  let checked = 0;
  let removed = 0;
  const errors: string[] = [];
  const keysToDelete: string[] = [];
  
  let cursor = await store.openCursor();
  
  while (cursor) {
    checked++;
    const tile = cursor.value;
    
    if (tile.data && isGzipCompressed(tile.data)) {
      keysToDelete.push(tile.key);
    }
    
    cursor = await cursor.continue();
  }
  
  for (const key of keysToDelete) {
    try {
      await store.delete(key);
      removed++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete compressed tile: ${key}`, error);
      errors.push(`${key}: ${message}`);
    }
  }
  
  await tx.done;
  
  return { checked, removed, errors };
}
