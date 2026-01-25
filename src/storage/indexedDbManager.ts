import { openDB } from 'idb';
import { OfflineMapDB } from '../types';

export const dbPromise = openDB<OfflineMapDB>('offline-map-db', 2, {
  upgrade(db, _oldVersion, _newVersion, _transaction) {
    // Note: 'regions' store is deprecated - regions are now stored inside styles.regions[]
    // Keeping for backward compatibility with existing databases
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
  },
});
