import { openDB } from 'idb';
import { OfflineMapDB } from '../types';

export const dbPromise = openDB<OfflineMapDB>('offline-map-db', 1, {
  upgrade(db) {
    db.createObjectStore('regions', { keyPath: 'id' });
    db.createObjectStore('tiles', { keyPath: 'key' });
    db.createObjectStore('sprites', { keyPath: 'key' });
    db.createObjectStore('styles', { keyPath: 'key' });
    db.createObjectStore('fonts', { keyPath: 'key' });
  },
});