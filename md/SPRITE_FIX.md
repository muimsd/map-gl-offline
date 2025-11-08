# Sprite 404 Fix

## Problem
Sprites were returning 404 errors: `Resource not found in IDB: idb://voyager/sprite/sprite@2x.json`

## Root Cause
**Key format mismatch** between sprite storage and lookup:

### How Sprites Are Stored
The `SpriteService.createSpriteKey()` creates keys in format:
```
voyager::sprite.json
voyager::sprite@2x.json
voyager::sprite.png
voyager::sprite@2x.png
```

### How MapLibre Requests Sprites
When the style is patched to use `idb://voyager/sprite/sprite`, MapLibre appends variants:
```
idb://voyager/sprite/sprite.json      → looking for voyager::sprite.json
idb://voyager/sprite/sprite@2x.json   → looking for voyager::sprite@2x.json
idb://voyager/sprite/sprite.png       → looking for voyager::sprite.png
idb://voyager/sprite/sprite@2x.png    → looking for voyager::sprite@2x.png
```

### The Bug
The lookup code in `idbFetchHandler.ts` was generating candidate keys like:
- `voyager:sprite:sprite@2x.json` (wrong - extra "sprite:")
- `voyager::sprite:sprite@2x.json` (wrong - double sprite)
- etc.

But NOT checking the correct format: `voyager::sprite@2x.json`

## The Fix
Updated sprite lookup in `idbFetchHandler.ts` to prioritize the correct key format:

```typescript
const spriteCandidateKeys = Array.from(
  new Set([
    // New format: downloadId::spriteName (e.g., "voyager::sprite@2x.json")
    `${downloadId}::${decodedResourcePath}`,
    
    // Legacy format: downloadId:spriteName
    `${downloadId}:${decodedResourcePath}`,
    
    // ... other fallbacks
  ])
);
```

Now when MapLibre requests `idb://voyager/sprite/sprite@2x.json`:
- `downloadId` = "voyager"
- `decodedResourcePath` = "sprite@2x.json"
- First candidate key = `voyager::sprite@2x.json` ✅

## How to Test

### 1. Check Browser Console
You should see logs like:
```
🎨 Looking for sprite with key: voyager:sprite:sprite@2x.json
🎨 Sprite candidates for "sprite@2x.json": ["voyager::sprite@2x.json", ...]
✅ Found sprite using key: voyager::sprite@2x.json
```

### 2. Use Debug Script
Open browser console and run:
```javascript
// Copy and paste debug-sprites.js content
```

This will show:
- Total sprites in database
- All sprite keys stored
- URLs and sizes

### 3. Verify Sprites Were Downloaded
In the UI:
1. Download a region with a style
2. Check the download progress shows "Downloading sprites"
3. After download completes, check storage

Expected console output during download:
```
Starting to download X sprites in batches of 10
Sprite URLs and their generated keys:
  https://...sprite.json -> voyager::sprite.json
  https://...sprite@2x.json -> voyager::sprite@2x.json
  https://...sprite.png -> voyager::sprite.png
  https://...sprite@2x.png -> voyager::sprite@2x.png
```

### 4. Test Offline Mode
1. Download a region
2. Reload the page (sprites should load from cache)
3. Go offline (disconnect network)
4. Load the region - sprites should appear

## What If Sprites Still Don't Work?

### Scenario 1: No sprites in database
**Problem**: The download didn't include sprites
**Solution**: Delete the region and re-download. Check console for sprite download logs.

### Scenario 2: Sprites stored with old keys
**Problem**: Downloaded before this fix
**Solution**: 
1. Delete the region
2. Clear the sprites: 
   ```javascript
   (async () => {
     const db = await indexedDB.open('offline-map-db', 2);
     const tx = db.transaction(['sprites'], 'readwrite');
     await tx.objectStore('sprites').clear();
   })();
   ```
3. Re-download the region

### Scenario 3: Still getting 404s
**Problem**: Different key format issue
**Check**:
1. Open `debug-sprites.js` to see actual keys
2. Compare with requested keys in 404 errors
3. Add more fallback keys if needed

## Related Files
- `src/services/spriteService.ts` - Downloads and stores sprites
- `src/utils/idbFetchHandler.ts` - Retrieves sprites for MapLibre
- `src/utils/styleUtils.ts` - Patches style sprite URLs

## Testing Checklist
- [x] Build completes without errors
- [x] Sprite lookup uses correct key format
- [ ] Download region and verify sprites appear in console
- [ ] Verify sprites load from IndexedDB (no network requests)
- [ ] Test offline mode with sprites
- [ ] Verify @1x and @2x variants both work
