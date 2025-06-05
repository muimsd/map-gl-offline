import { dbPromise } from '../storage/indexedDbManager';
import { fetchResource } from '../utils';

export async function downloadFonts(
  fontUrls: string[],
  downloadId?: string,
): Promise<void> {
  const db = await dbPromise;

  // Use a CORS proxy for development only
  const corsProxy = 'https://api.allorigins.win/raw?url=';

  for (const url of fontUrls) {
    try {
      // Prepend the CORS proxy to the font URL
      const proxiedUrl = url.startsWith('http') ? corsProxy + url : url;
      const fontData = await fetchResource(proxiedUrl);
      const fileName = url.split('/').pop() || url;
      const key = downloadId ? `${downloadId}::${fileName}` : fileName;
      await db.put('fonts', { key, data: fontData } as any); // Do not pass key as a separate argument
    } catch (e) {
      console.warn(`Font not found or failed to fetch: ${url}`);
    }
  }
}

export async function loadFonts(
  fontUrls: string[],
  downloadId?: string,
): Promise<void> {
  const db = await dbPromise;

  for (const url of fontUrls) {
    const key = downloadId ? `${downloadId}::${url}` : url;
    const fontData = await db.get('fonts', key);
    if (fontData) {
      // Logic to add font data to the map
      console.log(`Loaded font from ${key}`);
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
  // Example: get all keys and filter by styleId prefix
  // const allKeys = await db.getAllKeys('fonts');
  // const styleKeys = allKeys.filter(k => k.startsWith(styleId + '::'));
  // for (const key of styleKeys) { ... }
  console.log(`Would load fonts for styleId: ${styleId}`);
}

export async function deleteFontsByStyleId(styleId: string): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('fonts');
  const styleKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(styleId + '::'),
  );
  for (const key of styleKeys) {
    await db.delete('fonts', key);
    console.log(`Deleted font: ${key}`);
  }
}

export async function loadFontsByDownloadId(downloadId: string): Promise<void> {
  const db = await dbPromise;
  const allKeys = await db.getAllKeys('fonts');
  const keysToLoad = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(downloadId + '::'),
  );
  for (const key of keysToLoad) {
    const fontData = await db.get('fonts', key);
    if (fontData) {
      // Logic to add font data to the map
      console.log(`Loaded font from ${key}`);
    }
  }
}
