---
sidebar_position: 7
---

# Migrating to 0.6.0

0.6.0 introduces the programmatic `downloadRegion` API and ships fixes for several long-standing bugs in region storage, cleanup, and on-disk resilience. This page covers every change that might affect an existing 0.5.x integration.

## New public APIs

These are additive and do not break anything.

### `OfflineMapManager.downloadRegion(region, options?)`

Runs the full offline pipeline (style → sprites → glyphs → tiles → metadata) and returns a `DownloadRegionResult`. This is the new primary entry point for programmatic downloads.

```typescript
await offlineManager.downloadRegion(
  {
    id: 'downtown',
    name: 'Downtown',
    bounds: [
      [-74.05, 40.71],
      [-74.0, 40.76],
    ],
    minZoom: 10,
    maxZoom: 16,
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  },
  {
    onProgress: ({ phase, percentage, message }) => {
      console.log(`[${phase}] ${percentage.toFixed(1)}% ${message ?? ''}`);
    },
  }
);
```

`loadRegion` is an alias for `downloadRegion` (it was a stub in 0.5.x that logged `"loadTiles function not yet implemented"` — it now works).

### `TileDownloadOptions.probeSourcesBeforeDownload`

Default `true`. Before downloading a source's full tile plan, the library fetches 3 representative tiles (start / middle / end). Sources whose majority return 404 are skipped entirely. This eliminates the 404 flood from composite styles like Mapbox Standard that reference sparse tilesets (`mapbox.indoor-v3`, `mapbox.mapbox-landmark-pois-v1`, `mapbox.procedural-buildings-v1`). Pass `false` to include every source regardless:

```typescript
await offlineManager.downloadRegion(region, {
  tileOptions: { probeSourcesBeforeDownload: false },
});
```

### Storage resilience

```typescript
import { dbPromise, OfflineMapDBVersionError, resetOfflineMapDB } from 'map-gl-offline';

try {
  await dbPromise;
} catch (err) {
  if (err instanceof OfflineMapDBVersionError) {
    if (confirm('Offline storage is incompatible with this version. Clear it?')) {
      await resetOfflineMapDB(); // destructive
      location.reload();
    }
  }
}
```

### Other exports

- `loadAllStoredRegions()` — shared region flattening helper.
- `resourceKeyBelongsToStyle(key, styleId)` — delimiter-aware prefix match for cleanup logic.
- `normalizeSpriteProperty(sprite)` — normalize a style's `sprite` field (string or array) into a uniform `{id, url}[]`.

## Breaking changes

### `addRegion` no longer downloads tiles

In 0.5.x the intent was ambiguous; `addRegion` stored metadata and patched the style, but users assumed it also fetched tiles (it didn't — there was a `TODO` for `loadTiles`).

**0.6.0 makes this explicit**: `addRegion` stores metadata only. Use `downloadRegion` to fetch assets.

```diff
- await manager.addRegion({ id, name, bounds, minZoom, maxZoom, styleUrl });
+ await manager.downloadRegion({ id, name, bounds, minZoom, maxZoom, styleUrl });
```

### `region.expiry` is an absolute timestamp

The `OfflineRegionOptions.expiry` type doc has always said "ms since epoch". In 0.5.x, `addRegion` incorrectly stored `Date.now() + region.expiry`, corrupting callers who followed the type. All reads (cleanup, analytics, UI) treat `expiry` as an absolute timestamp.

**0.6.0 fixes the write to match**.

```diff
  await manager.downloadRegion({
    // ...
-   expiry: 30 * 24 * 60 * 60 * 1000,                     // duration-in-ms (broken)
+   expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,         // absolute timestamp
  });
```

If you omit `expiry`, it still defaults to `now + 30 days`.

### Region dedup is now id-based

0.5.x silently refused to persist a new region if another region on the same style had identical bounds (despite downloading its tiles). That orphaned tiles whose owning region never got recorded, and the new `id` couldn't be used for `deleteRegion`.

**0.6.0 upserts by `region.id`**. Two regions with the same bounds but distinct ids are both persisted. Repeating an id replaces the previous entry in place (`created` preserved, `updated` refreshed).

### `ResourceService.getXxxStatistics` renamed to `getXxxStats`

Matches the naming of the underlying service functions (`getTileStats`, `getFontStats`, …). This affects direct `ResourceService` callers and the `OfflineMapManager` methods of the same name.

```diff
- const stats = await offlineManager.getTileStatistics(styleId);
+ const stats = await offlineManager.getTileStats(styleId);

- const fonts = await offlineManager.getFontStatistics();
+ const fonts = await offlineManager.getFontStats();

- const sprites = await offlineManager.getSpriteStatistics();
+ const sprites = await offlineManager.getSpriteStats();

- const glyphs = await offlineManager.getGlyphStatistics();
+ const glyphs = await offlineManager.getGlyphStats();
```

### `OfflineManagerControl.loadSpecificOfflineStyle` removed

Was documented as "Alias for `loadOfflineStyle()`" with no distinct behavior. Use `loadOfflineStyle(styleId)` directly.

```diff
- await control.loadSpecificOfflineStyle('style_1234567890');
+ await control.loadOfflineStyle('style_1234567890');
```

## Bug fixes (no API change, may affect behavior)

- **Cross-style resource deletion**: deleting style `"abc"` no longer collaterally wipes glyphs/sprites/fonts of sibling styles like `"abc_def"`. Font deletion now uses the same delimiter-aware match as glyphs and sprites (via the shared `resourceKeyBelongsToStyle()` helper).
- **Incompatible on-disk DB**: `dbPromise` throws `OfflineMapDBVersionError` instead of a raw `DOMException`, unblocking recovery UX.
- **Lossy `getAll*Stats`**: `AnalyticsService.getAllFontStats` / `getAllSpriteStats` used to return empty `fonts[]` / `sprites[]` arrays by re-deriving from analytics. 0.6.0 returns the full rich stats.
- **Glyph progress jump**: the UI-facing glyph progress no longer pre-emits a synthetic estimate that jumped once the real total arrived.

## Quick compatibility check

Running the following grep on your codebase will surface most call-sites that need an update:

```bash
grep -rn "addRegion\|loadSpecificOfflineStyle\|getTileStatistics\|getFontStatistics\|getSpriteStatistics\|getGlyphStatistics" src/
```

For each hit, decide whether you wanted metadata-only (keep `addRegion`) or the full pipeline (switch to `downloadRegion`), and rename any `*Statistics` calls to `*Stats`.
