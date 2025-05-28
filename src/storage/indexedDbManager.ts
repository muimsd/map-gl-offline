import { openDB } from 'idb';
import { OfflineMapDB } from '../types';

export const dbPromise = openDB<OfflineMapDB>('offline-map-db', 1, {
  upgrade(db) {
    db.createObjectStore('regions', { keyPath: 'key' });
    db.createObjectStore('tiles', { keyPath: 'key' }); // out-of-line keys
    db.createObjectStore('sprites', { keyPath: 'key' }); // out-of-line keys
    db.createObjectStore('styles', { keyPath: 'key' }); // out-of-line keys
    db.createObjectStore('fonts', { keyPath: 'key' }); // out-of-line keys
  },
});
