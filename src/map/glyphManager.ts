import { dbPromise } from '@/src/storage/indexedDbManager';

export interface Glyph {
  id: string;
  data: string; // Base64 encoded glyph data
}

export interface GlyphMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

export async function downloadGlyphs(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download glyphs');
    }
    const glyphs: Glyph[] = await response.json();
    
    const db = await dbPromise;
    const tx = db.transaction('glyphs', 'readwrite');
    const store = tx.objectStore('glyphs');
    
    for (const glyph of glyphs) {
      await store.put(glyph);
    }
    
    await tx.oncomplete;
    console.log('Glyphs downloaded and stored successfully');
  } catch (error) {
    console.error('Error downloading glyphs:', error);
  }
}

export async function loadGlyphs(): Promise<Glyph[]> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('glyphs', 'readonly');
    const store = tx.objectStore('glyphs');
    const glyphs = await store.getAll();
    await tx.oncomplete;
    return glyphs;
  } catch (error) {
    console.error('Error loading glyphs:', error);
    return [];
  }
}

export async function deleteGlyphs(): Promise<void> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('glyphs', 'readwrite');
    const store = tx.objectStore('glyphs');
    await store.clear();
    await tx.oncomplete;
    console.log('Glyphs deleted successfully');
  } catch (error) {
    console.error('Error deleting glyphs:', error);
  }
}