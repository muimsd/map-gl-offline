# Gzip Decompression Fix

## Problem
Vector tiles downloaded from servers often arrive gzip-compressed (`Content-Encoding: gzip`). When these compressed tiles were stored directly in IndexedDB and later served to MapLibre GL, the library's protobuf parser would fail with:

```
Error: Unimplemented type: 4
  at Ws.skip
  at Ws.readFields
  at new VectorTile
```

This error occurs because the parser expects raw protobuf data but receives gzipped bytes.

## Solution
The library now automatically decompresses gzipped resources during download:

### Tiles (`tileService.ts`)
- Detect `content-encoding: gzip` header on tile responses
- Decompress using `DecompressionStream('gzip')` before storage
- Store uncompressed data in IndexedDB
- Clear `contentEncoding` field to avoid re-compression on serve

### Sprites (`spriteService.ts`)
- Same decompression logic for sprite images and JSON
- Handles both `sprite.json` and `sprite.png` variants

### Glyphs (`glyphService.ts`)
- Decompress glyph PBF files if received gzipped
- Log compression ratios for debugging

### Fetch Handler (`idbFetchHandler.ts`)
- Skip setting `Content-Encoding` header when serving decompressed tiles
- Only preserve non-gzip encoding metadata (e.g., `br`, `deflate`)

## Benefits
1. **Reliable offline parsing** - MapLibre receives uncompressed protobuf
2. **Simpler serving logic** - No runtime decompression needed
3. **Better debugging** - Stored tiles match expected format
4. **Storage transparency** - Consistent data format in IndexedDB

## Browser Support
Uses the standard [Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API):
- Chrome 80+
- Firefox 113+
- Safari 16.4+
- Edge 80+

Gracefully degrades by storing compressed data if decompression fails.

## Testing
After updating a region with gzipped tiles:
1. Clear existing tiles from the affected region
2. Re-download to trigger decompression
3. Verify tiles render without "Unimplemented type" errors
4. Check browser DevTools Network tab - responses should show decompressed sizes

## Migration
Existing compressed tiles in IndexedDB will continue to cause errors. Users have two options:

### Option 1: Clean up and re-download (Recommended)
```typescript
// Clear and re-download affected regions
await offlineManager.deleteRegion(regionId);
await offlineManager.downloadRegion({...regionConfig});
```

### Option 2: Use the cleanup utility
```typescript
import { cleanupCompressedTiles, countCompressedTiles } from 'map-gl-offline';

// First, check how many tiles are affected
const stats = await countCompressedTiles();
console.log(`Found ${stats.gzipped} gzipped tiles out of ${stats.total} total`);

// Then clean up the compressed tiles
const result = await cleanupCompressedTiles();
console.log(`Removed ${result.removed} compressed tiles`);

// Re-download to fill the gaps
await offlineManager.downloadRegion({...regionConfig});
```

### Browser Console Quick Check
```javascript
// Open DevTools Console and run:
const db = await indexedDB.databases();
console.log('IndexedDB databases:', db);

// Check a specific tile
const dbConn = await indexedDB.open('offline-map-db', 2);
// Then inspect tiles manually or use the cleanup utilities
```
