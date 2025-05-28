// idbFetchHandler.ts
// Intercepts idb:// URLs and serves resources from IndexedDB for MapLibre GL offline mode
import { dbPromise } from '@/storage/indexedDbManager';

export async function idbFetchHandler(url: string): Promise<Response> {
  const db = await dbPromise;
  // Parse the idb:// protocol
  // Example: idb://tiles/https%3A%2F%2Ftiles.example.com%2Fz%2Fx%2Fy.pbf
  const parsed = url.replace('idb://', '').split('/');
  const [type, ...rest] = parsed;
  const key = decodeURIComponent(rest.join('/'));

  switch (type) {
    case 'tiles': {
      const tile = await db.get('tiles', key);
      if (tile) return new Response(tile, { status: 200 });
      break;
    }
    case 'glyphs': {
      const font = await db.get('fonts', key);
      if (font) return new Response(font, { status: 200 });
      break;
    }
    case 'sprites': {
      const sprite = await db.get('sprites', key);
      if (sprite && sprite.value) {
        return new Response(sprite.value.data, {
          status: 200,
          headers: sprite.value.contentType ? { 'Content-Type': sprite.value.contentType } : undefined,
        });
      }
      break;
    }
    case 'tilesjson': {
      const style = await db.get('styles', key);
      if (style) return new Response(JSON.stringify(style), { status: 200, headers: { 'Content-Type': 'application/json' } });
      break;
    }
    default:
      break;
  }
  return new Response('Not found in IDB', { status: 404 });
}

// Usage: fetch('idb://tiles/https%3A%2F%2Ftiles.example.com%2Fz%2Fx%2Fy.pbf')
//   .then(idbFetchHandler)
//   .then(response => ...)
