// idbFetchHandler.ts
// Intercepts idb:// URLs and serves resources from IndexedDB for MapLibre GL offline mode
import { dbPromise } from '../storage/indexedDbManager';

function hasDataProp(obj: any): obj is { data: ArrayBuffer } {
  return obj && typeof obj === 'object' && 'data' in obj;
}

// idb://{downloadId}/tile/{url}
// idb://{downloadId}/glyph/{fontstack}/{range}.pbf
// idb://{downloadId}/sprite/{spriteName}
// idb://{downloadId}/tilesjson/{url}

export async function idbFetchHandler(url: string): Promise<Response> {
  const db = await dbPromise;
  const parsed = url.replace('idb://', '').split('/');
  const [downloadId, type, ...rest] = parsed;
  const resourcePath = rest.join('/');
  const key = `${downloadId}::${decodeURIComponent(resourcePath)}`;

  switch (type) {
    case 'tile': {
      const tile = await db.get('tiles', key);
      if (tile) {
        const data = hasDataProp(tile) ? tile.data : tile;
        return new Response(data, { status: 200 });
      }
      break;
    }
    case 'glyph': {
      const font = await db.get('fonts', key);
      if (font) {
        const data = hasDataProp(font) ? font.data : font;
        return new Response(data, { status: 200 });
      }
      break;
    }
    case 'sprite': {
      const sprite = await db.get('sprites', key);
      if (sprite && sprite.data) {
        return new Response(sprite.data, {
          status: 200,
          headers: sprite.contentType ? { 'Content-Type': sprite.contentType } : undefined,
        });
      }
      break;
    }
    case 'tilesjson': {
      const style = await db.get('styles', downloadId);
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
