// idbFetchHandler.ts
// Intercepts idb:// URLs and serves resources from IndexedDB for MapLibre GL offline mode
import { dbPromise } from '../storage/indexedDbManager';
import { extractTileKey } from './index';

function hasDataProp(obj: unknown): obj is { data: ArrayBuffer } {
  return obj !== null && typeof obj === 'object' && 'data' in obj;
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
      // Extract tile coordinates from the resource path
      // Resource path is now tile key including extension
      const tileKey = decodeURIComponent(resourcePath);
      console.warn(`Looking for tile with key: ${tileKey}`);
       const tile = await db.get('tiles', tileKey);
       if (tile) {
         const data = hasDataProp(tile) ? tile.data : tile;
         return new Response(data, { status: 200 });
       }
       break;
    }
    case 'glyph': {
      // For glyphs, we use the new key format: stylename:fontstack_range.pbf
      // The resourcePath is in format: fontstack/range.pbf
      const pathParts = decodeURIComponent(resourcePath).split('/');
      if (pathParts.length >= 2) {
        const fontstack = pathParts[0];
        const rangeFile = pathParts[1]; // e.g., "0-255.pbf"
        const range = rangeFile.replace('.pbf', '');
        const glyphKey = `${downloadId}:${fontstack}_${range}.pbf`;
        
        console.warn(`Looking for glyph with key: ${glyphKey} (from URL: ${url})`);
        
        const font = await db.get('glyphs', glyphKey);
        if (font) {
          const data = hasDataProp(font) ? font.data : font;
          return new Response(data, { status: 200 });
        } else {
          // Fallback: try old format
          const oldKey = `${fontstack}/${range}`;
          const oldFont = await db.get('glyphs', oldKey);
          if (oldFont) {
            const data = hasDataProp(oldFont) ? oldFont.data : oldFont;
            return new Response(data, { status: 200 });
          }
        }
      }
      break;
    }
    case 'sprite': {
      // For sprites, we use the new key format: stylename:spritename.extension
      // The resourcePath contains the sprite name (e.g., "sprite.json", "sprite@2x.png")
      const spriteName = decodeURIComponent(resourcePath);
      
      // Generate the sprite key: stylename:spritename
      let spriteKey = `${downloadId}:${spriteName}`;
      
      // Handle different sprite file extensions for key generation
      if (spriteName === 'sprite.json') {
        spriteKey = `${downloadId}:sprite.json`;
      } else if (spriteName === 'sprite.png') {
        spriteKey = `${downloadId}:sprite.png`;
      } else if (spriteName === 'sprite@2x.json') {
        spriteKey = `${downloadId}:sprite@2x.json`;
      } else if (spriteName === 'sprite@2x.png') {
        spriteKey = `${downloadId}:sprite@2x.png`;
      }
      
      console.warn(`Looking for sprite with key: ${spriteKey} (from URL: ${url})`);
      
      const sprite = await db.get('sprites', spriteKey);
      if (sprite && sprite.data) {
        return new Response(sprite.data, {
          status: 200,
          headers: sprite.contentType ? { 'Content-Type': sprite.contentType } : undefined,
        });
      } else {
        console.warn(`Sprite not found with key: ${spriteKey}`);
        // Try to find sprite by searching all sprites with matching downloadId prefix
        const allSprites = await db.getAll('sprites');
        const matchingSprite = allSprites.find(s => s.key.startsWith(`${downloadId}:`) && s.url?.includes(spriteName));
        if (matchingSprite) {
          console.warn(`Found sprite by URL match: ${matchingSprite.key}`);
          return new Response(matchingSprite.data, {
            status: 200,
            headers: matchingSprite.contentType ? { 'Content-Type': matchingSprite.contentType } : undefined,
          });
        }
      }
      break;
    }
    case 'font': {
      // For fonts, we use the new key format: stylename:fontname.pbf
      const fontKey = `${downloadId}:${decodeURIComponent(resourcePath)}`;
      
      console.warn(`Looking for font with key: ${fontKey} (from URL: ${url})`);
      
      const font = await db.get('fonts', fontKey);
      if (font) {
        const data = hasDataProp(font) ? font.data : font;
        return new Response(data, { status: 200 });
      } else {
        // Fallback: search by URL or original key format
        const allFonts = await db.getAll('fonts');
        const matchingFont = allFonts.find(f => f.url === decodeURIComponent(resourcePath) || f.key.includes(resourcePath));
        if (matchingFont) {
          const data = hasDataProp(matchingFont) ? matchingFont.data : matchingFont;
          return new Response(data, { status: 200 });
        }
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
