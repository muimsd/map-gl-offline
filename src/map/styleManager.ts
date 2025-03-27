import { dbPromise } from '@/storage/indexedDbManager';

export async function downloadStyles(stylesUrl: string): Promise<string[]> {
  try {
    const response = await fetch(stylesUrl);
    if (!response.ok) {
      throw new Error('Failed to download styles');
    }
    const styles = await response.json();

    const db = await dbPromise;
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');

    const storedStyleIds: string[] = [];
    for (const style of styles) {
      const styleWithId = { ...style, id: style.id || crypto.randomUUID() }; // Ensure each style has an ID
      await store.put(styleWithId);
      storedStyleIds.push(styleWithId.id); // Collect the ID of the stored style
    }

    await tx.oncomplete;
    console.log('Styles downloaded and stored successfully');
    return storedStyleIds; // Return the IDs of the stored styles
  } catch (error) {
    console.error('Error downloading styles:', error);
    return [];
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

export async function loadStyleById(styleId: string): Promise<any | null> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readonly');
    const store = tx.objectStore('styles');
    const style = await store.get(styleId); // Fetch the style by ID
    await tx.oncomplete;
    return style || null; // Return the style or null if not found
  } catch (error) {
    console.error(`Error loading style with ID ${styleId}:`, error);
    return null;
  }
}

export async function deleteStyles(): Promise<void> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');
    await store.clear();
    await tx.oncomplete;
    console.log('All styles deleted successfully');
  } catch (error) {
    console.error('Error deleting styles:', error);
  }
}

export async function deleteStyleById(styleId: string): Promise<void> {
  try {
    const db = await dbPromise;
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');
    await store.delete(styleId); // Delete the style by ID
    await tx.oncomplete;
    console.log(`Style with ID ${styleId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting style with ID ${styleId}:`, error);
  }
}
