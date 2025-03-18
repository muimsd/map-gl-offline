import { dbPromise } from '@/src/storage/indexedDbManager';

export async function downloadStyles(): Promise<void> {
  const stylesUrl = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'; // Replace with the actual URL
  try {
    const response = await fetch(stylesUrl);
    if (!response.ok) {
      throw new Error('Failed to download styles');
    }
    const styles = await response.json();
    
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');
    
    for (const style of styles) {
      await store.put(style);
    }
    
    await tx.oncomplete;
    console.log('Styles downloaded and stored successfully');
  } catch (error) {
    console.error('Error downloading styles:', error);
  }
}

export async function loadStyles(): Promise<any[]> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readonly');
    const store = tx.objectStore('styles');
    const styles = await store.getAll();
    await tx.oncomplete;
    return styles;
  } catch (error) {
    console.error('Error loading styles:', error);
    return [];
  }
}

export async function deleteStyles(): Promise<void> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');
    await store.clear();
    await tx.oncomplete;
    console.log('Styles deleted successfully');
  } catch (error) {
    console.error('Error deleting styles:', error);
  }
}