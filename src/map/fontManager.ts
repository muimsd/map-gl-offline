import { dbPromise } from '@/storage/indexedDbManager';
import { fetchResource } from '@/utils';
import { OfflineMapDB } from '@/types';

export async function downloadFonts(fontUrls: string[]): Promise<void> {
  const db = await dbPromise;

  for (const url of fontUrls) {
    const fontData = await fetchResource(url);
    await db.put('fonts', { key: url, value: fontData } as any);
  }
}

export async function loadFonts(fontUrls: string[]): Promise<void> {
  const db = await dbPromise;

  for (const url of fontUrls) {
    const fontData = await db.get('fonts', url);
    if (fontData) {
      // Logic to add font data to the map
      console.log(`Loaded font from ${url}`);
    }
  }
}

export async function deleteFonts(fontUrls: string[]): Promise<void> {
  const db = await dbPromise;

  for (const url of fontUrls) {
    await db.delete('fonts', url);
  }
}

export async function loadFontsByStyleId(styleId: string): Promise<void> {
  const db = await dbPromise;
  // Example: get all keys and filter by styleId prefix
  // const allKeys = await db.getAllKeys('fonts');
  // const styleKeys = allKeys.filter(k => k.startsWith(styleId + '::'));
  // for (const key of styleKeys) { ... }
  console.log(`Would load fonts for styleId: ${styleId}`);
}

export async function deleteFontsByStyleId(styleId: string): Promise<void> {
  const db = await dbPromise;
  // Example: get all keys and delete those with styleId prefix
  // const allKeys = await db.getAllKeys('fonts');
  // const styleKeys = allKeys.filter(k => k.startsWith(styleId + '::'));
  // for (const key of styleKeys) { await db.delete('fonts', key); }
  console.log(`Would delete fonts for styleId: ${styleId}`);
}
