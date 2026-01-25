import { openDB } from 'idb';
import { OfflineMapDB } from '../types';
import { DB_NAME, DB_VERSION } from '../utils/constants';

export const dbPromise = openDB<OfflineMapDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    // Create stores if they don't exist (for fresh installs)
    if (!db.objectStoreNames.contains('regions')) {
      db.createObjectStore('regions', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('tiles')) {
      db.createObjectStore('tiles', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('styles')) {
      db.createObjectStore('styles', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('sprites')) {
      db.createObjectStore('sprites', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('glyphs')) {
      db.createObjectStore('glyphs', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('fonts')) {
      db.createObjectStore('fonts', { keyPath: 'key' });
    }

    // Migration from v2 to v3: Move regions from 'regions' store to styles.regions[]
    if (oldVersion < 3 && oldVersion > 0) {
      const regionsStore = transaction.objectStore('regions');
      const stylesStore = transaction.objectStore('styles');

      // Get all regions and migrate them to their respective styles
      regionsStore.getAll().then(async regions => {
        for (const region of regions) {
          const styleId = region.styleId;
          if (!styleId) continue;

          try {
            const style = await stylesStore.get(styleId);
            if (style) {
              // Add region to style's regions array
              style.regions = style.regions || [];
              // Check if region already exists in style
              const exists = style.regions.some((r: { id: string }) => r.id === region.id);
              if (!exists) {
                style.regions.push({
                  id: region.id,
                  name: region.name,
                  bounds: region.bounds,
                  styleUrl: region.styleUrl,
                  minZoom: region.minZoom,
                  maxZoom: region.maxZoom,
                  created: region.created,
                  expiry: region.expiry,
                  tileExtension: region.tileExtension,
                });
                await stylesStore.put(style);
              }
            }
            // Delete the migrated region from the old store
            await regionsStore.delete(region.key);
          } catch {
            // Continue with other regions if one fails
          }
        }
      });
    }
  },
});
