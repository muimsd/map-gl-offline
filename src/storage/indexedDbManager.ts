import { openDB } from 'idb';
import { OfflineMapDB } from '../types';

export const dbPromise = openDB<OfflineMapDB>('offline-map-db', 1, {
  upgrade(db) {
    db.createObjectStore('regions', { keyPath: 'key' });
    db.createObjectStore('tiles'); // out-of-line keys
    db.createObjectStore('sprites'); // out-of-line keys
    db.createObjectStore('styles'); // out-of-line keys
    db.createObjectStore('fonts'); // out-of-line keys
  },
});
