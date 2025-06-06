import { dbPromise } from '../storage/indexedDbManager';
import mapboxgl from 'mapbox-gl';
import maplibregl from 'maplibre-gl';
import { downloadFonts } from './fontManager';
import { downloadSprites } from './spriteManager';
import { generateGlyphUrlsFromStyle } from '../utils';

export async function downloadStyles(
  stylesUrl: string,
): Promise<mapboxgl.Style | maplibregl.Style | null> {
  try {
    const response = await fetch(stylesUrl);
    if (!response.ok) {
      throw new Error('Failed to download styles');
    }
    const style = await response.json();

    // Check if style already exists in the database
    const db = await dbPromise;
    const existingStyle = await db.get('styles', style.id);
    
    if (existingStyle && typeof existingStyle === 'object' && 'style' in existingStyle) {
      console.log(`Style ${style.id} already exists in database, using existing version`);
      return existingStyle.style;
    }

    // Style doesn't exist, proceed with download and processing
    console.log(`Downloading new style: ${style.id}`);

    // Fetch and store sources inside the style object
    for (const sourceKey of Object.keys(style.sources)) {
      const source = style.sources[sourceKey];

      if (source.url) {
        try {
          const sourceResponse = await fetch(source.url);
          if (sourceResponse.ok) {
            const sourceURL = await sourceResponse.json();
            style.sources[sourceKey].url = sourceURL; // Embed source data
          } else {
            console.warn(`Failed to fetch source for ${sourceKey}`);
          }
        } catch (error) {
          console.error(`Error fetching source for ${sourceKey}:`, error);
        }
      }
    }

    // Save the style with embedded sources
    const tx = db.transaction('styles', 'readwrite');
    const store = tx.objectStore('styles');
    await store.put({ ...style, key: style.id }); // Use in-line key for compatibility
    await tx.done;

    console.log('Downloaded style with sources saved successfully');

    // Download fonts (glyphs) for the style (only for new styles)
    if (style && style.glyphs) {
      const fontUrls = generateGlyphUrlsFromStyle(style, style.glyphs);
      await downloadFonts(fontUrls, style.id);
      style.fonts = fontUrls;
    }
    // Download sprites for the style (only for new styles)
    if (style && style.sprite) {
      const spriteBase = style.sprite;
      const spriteVariants = [
        `${spriteBase}.json`,
        `${spriteBase}.png`,
        `${spriteBase}@2x.json`,
        `${spriteBase}@2x.png`,
      ];
      await downloadSprites(style.id, spriteVariants);
      style.sprites = spriteVariants;
    }

    return style;
  } catch (error) {
    console.error('Error downloading styles:', error);
    return null;
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
    await db.delete('styles', styleId);
    console.log(`Style with ID ${styleId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting style with ID ${styleId}:`, error);
  }
}
