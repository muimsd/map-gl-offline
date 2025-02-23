import { dbPromise } from '@/src/storage/indexedDbManager';
import { fetchResource } from '@/src/utils';
import { OfflineMapDB } from '../types';

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
