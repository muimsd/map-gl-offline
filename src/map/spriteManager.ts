import { dbPromise } from '@/storage/indexedDbManager';

export async function downloadSprites(urls: string[]): Promise<void> {
  const db = await dbPromise;
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download sprite: ${url}`);
      continue;
    }
    const contentType = response.headers.get('content-type') || undefined;
    const data = await response.arrayBuffer();
    await db.put('sprites', { data, contentType }, url);
  }
}

export async function loadSprites(styleId?: string): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('sprites');
  let keysToLoad = allKeys;
  if (styleId) {
    keysToLoad = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
  }
  for (const key of keysToLoad) {
    const sprite = await db.get('sprites', key);
    if (sprite) {
      // Logic to add sprite data to the map or return it
      console.log(`Loaded sprite: ${key}`);
    }
  }
}

export async function deleteSprites(styleId?: string): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('sprites');
  let keysToDelete = allKeys;
  if (styleId) {
    keysToDelete = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
  }
  for (const key of keysToDelete) {
    await db.delete('sprites', key);
    console.log(`Deleted sprite: ${key}`);
  }
}