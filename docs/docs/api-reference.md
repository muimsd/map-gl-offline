---
sidebar_position: 3
---

# API Reference

Complete API documentation for `map-gl-offline`.

The library is available as:

- **ES modules**: `import { OfflineMapManager } from 'map-gl-offline'`
- **CommonJS**: `const { OfflineMapManager } = require('map-gl-offline')`
- **UMD global**: `mapgloffline.OfflineMapManager` (via `<script>` tag)

## OfflineMapManager

The main class for managing offline map data programmatically.

### Constructor

```typescript
const manager = new OfflineMapManager(overrides?: OfflineManagerServiceOverrides);
```

The constructor accepts optional service overrides for dependency injection (advanced usage). For most cases, use the default: `new OfflineMapManager()`.

### Region Management Methods

#### `downloadRegion(region: OfflineRegionOptions, options?: DownloadRegionOptions): Promise<DownloadRegionResult>`

Run the full offline-region pipeline: downloads the style (if not already stored), sprites, glyphs, tiles, then persists region metadata. Progress is reported per phase via `options.onProgress`.

```typescript
await manager.downloadRegion(
  {
    id: 'my-region',
    name: 'My Region',
    bounds: [
      [-74.05, 40.71],
      [-74.0, 40.76],
    ],
    minZoom: 10,
    maxZoom: 16,
    styleUrl: 'https://example.com/style.json',
  },
  {
    onProgress: ({ phase, completed, total, percentage, message }) => {
      // phase: 'style' | 'sprites' | 'glyphs' | 'tiles' | 'metadata'
      console.log(`[${phase}] ${completed}/${total} (${percentage.toFixed(1)}%)`);
    },
  }
);
```

**`DownloadRegionOptions`:**

| Option        | Type                                  | Description                                                                           |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `onProgress`  | `(p: DownloadRegionProgress) => void` | Called with `{ phase, completed, total, percentage, message? }` during each phase.    |
| `provider`    | `'auto' \| 'mapbox' \| 'maplibre'`    | Style provider hint when fetching the style. Defaults to `'auto'`.                    |
| `accessToken` | `string`                              | Mapbox access token; required for `mapbox://` URLs.                                   |
| `skipSprites` | `boolean`                             | Skip the sprite-download phase. Default `false`.                                      |
| `skipGlyphs`  | `boolean`                             | Skip the glyph-download phase. Default `false`.                                       |
| `glyphRanges` | `string[]`                            | Override Unicode glyph ranges. Defaults to `GLYPH_CONFIG.COMPREHENSIVE_RANGES`.       |
| `tileOptions` | `TileDownloadOptions`                 | Forwarded to the tile download step (e.g. `probeSourcesBeforeDownload`, `batchSize`). |

**`DownloadRegionResult`** includes `regionId`, `styleId`, `styleResult?`, `spriteResults`, `glyphResult?`, and `tileResult`.

#### `loadRegion(region: OfflineRegionOptions, options?: DownloadRegionOptions): Promise<DownloadRegionResult>`

Alias for `downloadRegion`. Kept for naming parity with native offline APIs.

#### `addRegion(options: OfflineRegionOptions): Promise<void>`

Store region metadata inside its style entry and patch the style's URLs to `idb://` for offline use. Does **not** fetch tiles, sprites, or glyphs — for the full pipeline, use `downloadRegion`. The region's `expiry`, if supplied, is stored as an absolute timestamp (ms since epoch); omit it to default to 30 days from now. If a region with the same `id` already exists on the style it is replaced in place (`created` preserved, `updated` refreshed).

```typescript
// Metadata-only; style must already be downloaded.
await manager.addRegion({
  id: 'my-region',
  name: 'My Region',
  bounds: [
    [-74.05, 40.71],
    [-74.0, 40.76],
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://example.com/style.json',
});
```

Both `addRegion` and `downloadRegion` accept `extraSources` for additional tile sources not declared by the style:

```typescript
await manager.downloadRegion({
  id: 'my-region',
  name: 'My Region',
  bounds: [
    [-74.05, 40.71],
    [-74.0, 40.76],
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://example.com/style.json',
  extraSources: [
    {
      id: 'buildings',
      type: 'vector',
      tiles: ['https://tiles.example.com/buildings/{z}/{x}/{y}.pbf'],
      minzoom: 13,
      maxzoom: 16,
    },
    {
      id: 'custom-overlay',
      type: 'vector',
      tiles: ['https://tiles.example.com/overlay/{z}/{x}/{y}.mvt'],
    },
  ],
});
```

#### `getStoredRegion(id: string): Promise<StoredRegion | null>`

Retrieve a stored region by its ID.

```typescript
const region = await manager.getStoredRegion('my-region');
if (region) {
  console.log(`Region: ${region.name}, created: ${region.created}`);
}
```

#### `listStoredRegions(): Promise<StoredRegion[]>`

List all stored regions with their metadata.

```typescript
const regions = await manager.listStoredRegions();
regions.forEach(r => console.log(`${r.name}: ${r.id}`));
```

#### `deleteRegion(id: string): Promise<void>`

Delete a specific region and all its associated resources.

```typescript
await manager.deleteRegion('my-region');
```

#### `listRegions(): Promise<OfflineRegionOptions[]>`

List all region options (without database metadata).

```typescript
const regions = await manager.listRegions();
regions.forEach(r => console.log(`${r.name}: ${r.id}`));
```

### Analytics Methods

#### `getComprehensiveStorageAnalytics(): Promise<StorageAnalyticsReport>`

Get a comprehensive analytics report covering all resource types (tiles, fonts, sprites, glyphs), region statistics, and storage recommendations. Aggregates data across all stored styles.

```typescript
const report = await manager.getComprehensiveStorageAnalytics();

// Overall storage
console.log(`Total storage: ${report.totalStorageSize} bytes`);
console.log(`Storage by type:`, report.storageByType);
// { tiles: 52428800, fonts: 1048576, sprites: 524288, glyphs: 2097152 }

// Per-resource statistics
console.log(`Tiles: ${report.tiles.count}, avg size: ${report.tiles.averageSize}`);
console.log(`Fonts: ${report.fonts.count}`);
console.log(`Sprites: ${report.sprites.count}`);
console.log(`Glyphs: ${report.glyphs.count}`);

// Region summary
console.log(`Regions: ${report.regions.totalRegions}`);
console.log(`Expired: ${report.regions.expiryDistribution.expired}`);

// Actionable recommendations
report.recommendations.forEach(rec => console.log(`- ${rec}`));
// e.g., "High tile count (65000). Consider reducing zoom levels or region sizes."
// e.g., "3 expired regions found. Run cleanup to free storage."
```

#### `getRegionAnalytics(): Promise<RegionAnalytics>`

Get aggregate analytics across all stored regions, including size distribution, age tracking, and expiry status.

```typescript
const analytics = await manager.getRegionAnalytics();

console.log(`Total regions: ${analytics.totalRegions}`);
console.log(`Total size: ${analytics.totalSize} bytes`);
console.log(`Average size: ${analytics.averageSize} bytes`);

// Age tracking
if (analytics.oldestRegion) {
  console.log(
    `Oldest: ${analytics.oldestRegion.id}, created ${new Date(analytics.oldestRegion.created)}`
  );
}
if (analytics.largestRegion) {
  console.log(`Largest: ${analytics.largestRegion.id}, ${analytics.largestRegion.size} bytes`);
}

// Expiry distribution
const { expired, expiringWithin24h, expiringWithin7d, neverExpiring } =
  analytics.expiryDistribution;
console.log(`Expired: ${expired}, expiring soon: ${expiringWithin24h + expiringWithin7d}`);

// Breakdown by style
console.log(`Regions by style:`, analytics.regionsByStyle);
// { "style_abc123": 3, "style_def456": 1 }
```

#### `getRegionSize(regionId: string, styleId?: string): Promise<number>`

Get the total storage size (in bytes) used by a specific region's tiles.

```typescript
const sizeInBytes = await manager.getRegionSize('my-region');
console.log(`Region uses ${(sizeInBytes / 1024 / 1024).toFixed(1)} MB`);
```

#### `getTileStats(styleId?: string): Promise<TileStats>`

Get tile statistics. Pass a `styleId` to filter; omit to aggregate across all styles.

#### `getFontStats(): Promise<EnhancedFontStats>`

Get font statistics aggregated across all styles.

#### `getSpriteStats(): Promise<EnhancedSpriteStats>`

Get sprite statistics aggregated across all styles.

#### `getGlyphStats(): Promise<EnhancedGlyphStats>`

Get glyph statistics aggregated across all styles.

### Tile Download Options

Options that `downloadRegion` forwards to the tile downloader (or that you can pass directly to `downloadTiles` / `ResourceService.downloadTilesWithOptions`).

| Option                       | Type       | Default | Description                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probeSourcesBeforeDownload` | `boolean`  | `true`  | Fetch 3 representative tiles (start, middle, end) per source before committing its full plan. Majority-404 sources are dropped entirely. Keeps the console clean for composite styles (e.g. Mapbox Standard) that reference sparse tilesets like `indoor-v3` or `landmark-pois-v1` that only have data at specific locations. |
| `skipExisting`               | `boolean`  | `true`  | Skip tiles already present in IndexedDB.                                                                                                                                                                                                                                                                                      |
| `batchSize`                  | `number`   | `10`    | Concurrent tiles per batch.                                                                                                                                                                                                                                                                                                   |
| `maxRetries`                 | `number`   | `3`     | Per-tile retry count before giving up.                                                                                                                                                                                                                                                                                        |
| `timeout`                    | `number`   | `10000` | Per-tile fetch timeout in ms.                                                                                                                                                                                                                                                                                                 |
| `retryDelay`                 | `number`   | `1000`  | Base delay between retries.                                                                                                                                                                                                                                                                                                   |
| `bandwidthLimit`             | `number`   | —       | KB/s ceiling to throttle downloads.                                                                                                                                                                                                                                                                                           |
| `validateTiles`              | `boolean`  | `false` | Validate tile payloads after download.                                                                                                                                                                                                                                                                                        |
| `compressTiles`              | `boolean`  | `false` | Compress tiles before storage.                                                                                                                                                                                                                                                                                                |
| `priorityZoomLevels`         | `number[]` | `[]`    | Download these zoom levels first.                                                                                                                                                                                                                                                                                             |
| `storageQuotaCheck`          | `boolean`  | `true`  | Refuse to start if available storage is below the safety floor.                                                                                                                                                                                                                                                               |

### Storage Resilience

Top-level exports for handling incompatible on-disk state (e.g. after a version downgrade, or when another app shares the IDB name on the same origin).

#### `OfflineMapDBVersionError`

Typed subclass of `Error` thrown from `dbPromise` when the existing database schema is newer than this build supports. Exposes `requestedVersion` and `existingVersion` fields and a message referencing the recovery helper.

#### `resetOfflineMapDB(): Promise<void>`

Destructive helper that deletes the `offline-map-db` IndexedDB database and all stored offline data. Intended as the recovery path after catching an `OfflineMapDBVersionError`.

```typescript
import { dbPromise, OfflineMapDBVersionError, resetOfflineMapDB } from 'map-gl-offline';

try {
  await dbPromise;
} catch (err) {
  if (err instanceof OfflineMapDBVersionError) {
    if (confirm('Offline storage is incompatible. Clear it?')) {
      await resetOfflineMapDB();
      location.reload();
    }
  }
}
```

#### `loadAllStoredRegions(): Promise<StoredRegion[]>`

Flatten every stored style's `regions[]` into a single `StoredRegion[]` (populated with `key`, `styleId`, `created`, `lastModified`, `expiry`). Shared by `RegionService.listStoredRegions` and `CleanupService.getAllRegions`; exposed publicly for advanced callers that want direct DB access.

#### `resourceKeyBelongsToStyle(key: string, styleId: string): boolean`

Delimiter-aware prefix match used by the cleanup paths. Returns `true` for `styleId` or `styleId:…` (the canonical key format) but not for sibling styles that share a prefix (e.g. `"abc_def:foo"` does not belong to style `"abc"`). Fixes a long-standing data-loss bug in resource cleanup.

### Import/Export Methods

Regions are exchanged as **MBTiles** — a SQLite-based tile container understood by QGIS, tippecanoe, maplibre-native, and every other mainstream GIS tool. Exports are v1.3-compliant: vector tiles are gzipped, `tile_row` is flipped to TMS, and vector exports emit the required `json` metadata (with `vector_layers`) derived from the offline style.

The MBTiles machinery is lazy-loaded — `sql.js` only joins your bundle when a user triggers an export or import.

#### `exportRegionAsMBTiles(regionId: string, options?: ImportExportOptions & MBTilesExportOptions): Promise<ExportResult>`

Export a region to a binary MBTiles file. Vector tiles are gzipped automatically (idempotent — already-gzipped tiles pass through untouched) and raster tiles are written verbatim.

```typescript
const result = await manager.exportRegionAsMBTiles('my-region', {
  format: 'pbf', // 'pbf' | 'png' | 'jpg' — written to metadata.format
  metadata: { attribution: 'My Data' }, // extra rows for the metadata table
  onProgress: p => console.log(`[${p.stage}] ${p.percentage}% — ${p.message}`),
});

console.log(`Exported ${result.statistics.tilesExported} tiles (${result.size} bytes)`);
// result.blob is the .mbtiles file, result.filename ends in '.mbtiles'
```

The resulting file contains:

- `metadata` rows: `name`, `type` (`baselayer` for vector, `overlay` for raster), `version`, `description`, `format`, `bounds`, `center`, `minzoom`, `maxzoom`, and (for vector) `json` with `vector_layers`.
- `tiles` rows: `zoom_level`, `tile_column`, `tile_row` (TMS-flipped), `tile_data` (gzipped PBF for vector).

#### `downloadExportedRegion(exportResult: ExportResult): void`

Convenience method to trigger a browser download of an export result. Creates a temporary link, clicks it, and revokes the object URL.

```typescript
const result = await manager.exportRegionAsMBTiles('my-region');
manager.downloadExportedRegion(result);
```

#### `importRegion(data: RegionImportData): Promise<ImportResult>`

Import a region from an MBTiles file. The file's SQLite header is validated up front (so a JSON file renamed to `.mbtiles` fails with a clear error rather than a cryptic one from sql.js). Gzipped vector tiles are decompressed on the way in so the offline fetch handler can keep serving them raw.

```typescript
const result = await manager.importRegion({
  file: selectedFile, // File from <input type="file" accept=".mbtiles">
  format: 'mbtiles', // only supported format
  overwrite: true, // replace existing region with same id
  newRegionId: 'imported-region', // optional: override the stored region id
  newRegionName: 'Imported Region', // optional: override the stored name
  onProgress: p => console.log(p.message),
});

if (result.success) {
  console.log(`Imported ${result.statistics.tilesImported} tiles into ${result.regionId}`);
} else {
  console.error(`Import failed: ${result.message}`);
}
```

#### `configureSqlJs(config: { wasmUrl?: string; wasmBinary?: ArrayBuffer | Uint8Array })`

Optional — controls how `sql.js` loads its WebAssembly. By default the library fetches `sql-wasm.wasm` from jsDelivr at call time. Call this before the first export/import to override.

```typescript
import { configureSqlJs } from 'map-gl-offline';

// Self-hosted wasm (recommended for production)
configureSqlJs({ wasmUrl: '/static/sql-wasm/' });

// Or, for Node / offline-first setups, pre-fetched binary
configureSqlJs({ wasmBinary: myPreloadedBuffer });
```

### Cleanup Methods

#### `cleanupExpiredRegions(): Promise<number>`

Remove regions older than 30 days. Returns the number of deleted regions.

```typescript
const deletedCount = await manager.cleanupExpiredRegions();
console.log(`Cleaned up ${deletedCount} expired regions`);
```

#### `forceCleanupExpiredRegions(): Promise<number>`

Force cleanup of all regions that have passed their `expiry` timestamp. Unlike `cleanupExpiredRegions` (which uses a 30-day age threshold), this method checks the actual `region.expiry` field and only deletes regions whose expiry has elapsed. Returns the number of deleted regions.

```typescript
const deletedCount = await manager.forceCleanupExpiredRegions();
console.log(`Force-deleted ${deletedCount} expired regions`);
```

#### `performSmartCleanup(options?: RegionCleanupOptions): Promise<CleanupResult>`

Run an intelligent cleanup process with configurable criteria. The smart cleanup algorithm works in three phases:

1. **Scanning** - Enumerates all stored regions
2. **Analyzing** - Categorizes regions by age and priority
3. **Cleaning** - Deletes expired/excess regions, preserving priority patterns

Priority patterns protect important regions from deletion. Non-priority expired regions are deleted first, then oldest non-priority regions are removed to meet storage/count limits.

```typescript
const result = await manager.performSmartCleanup({
  maxAge: 14, // Delete regions older than 14 days
  maxStorageSize: 500 * 1024 * 1024, // Keep total storage under 500MB
  maxRegions: 10, // Keep at most 10 regions
  priorityPatterns: ['downtown', 'home'], // Protect regions matching these patterns
  onProgress: progress => {
    console.log(
      `[${progress.phase}] ${progress.completed}/${progress.total} - ${progress.message}`
    );
    // [scanning] 0/100 - Scanning offline regions...
    // [analyzing] 30/100 - Analyzing region data...
    // [cleaning] 75/100 - Deleted region: Old Region
  },
});

console.log(`Scanned: ${result.scannedRegions}`);
console.log(`Expired: ${result.expiredRegions}`);
console.log(`Deleted: ${result.deletedRegions}`);
console.log(`Preserved: ${result.preservedRegions}`);
console.log(`Freed: ${(result.freedSpace / 1024 / 1024).toFixed(1)} MB`);
result.recommendations.forEach(rec => console.log(`Tip: ${rec}`));
```

#### `cleanupOldFonts(styleId?: string, options?: { maxAge?: number }): Promise<number>`

Remove font entries older than `options.maxAge` days (default 30). When `styleId` is passed, only fonts belonging to that style (per the delimiter-aware `resourceKeyBelongsToStyle` match — so `style-a` does not match sibling `style-a_other`) are eligible. Returns the number of deleted entries.

```typescript
// Clean up every style's old fonts:
await manager.cleanupOldFonts();

// Clean up only one style's fonts older than 7 days:
await manager.cleanupOldFonts('my-style-id', { maxAge: 7 });
```

#### `cleanupOldSprites(styleId?: string, options?: { maxAge?: number }): Promise<number>`

Same contract as `cleanupOldFonts`, for the `sprites` store.

#### `cleanupOldGlyphs(styleId?: string, options?: { maxAge?: number }): Promise<number>`

Same contract as `cleanupOldFonts`, for the `glyphs` store.

#### `setupAutoCleanup(options?: RegionCleanupOptions & { intervalHours?: number }): Promise<string>`

Set up automatic periodic cleanup. Returns a cleanup ID that can be used to stop this specific auto-cleanup. The cleanup runs using the smart cleanup algorithm with the provided options.

```typescript
const cleanupId = await manager.setupAutoCleanup({
  intervalHours: 24, // Run every 24 hours (default)
  maxAge: 30, // Delete regions older than 30 days
  maxStorageSize: 1024 * 1024 * 1024, // 1GB limit
  priorityPatterns: ['important'],
});

// Later, stop this specific auto-cleanup
await manager.stopAutoCleanup(cleanupId);
```

#### `startEnhancedAutoCleanup(intervalHours?: number, options?: RegionCleanupOptions): Promise<string>`

Alternative auto-cleanup setup with separate interval and options parameters. Returns a cleanup ID.

```typescript
const cleanupId = await manager.startEnhancedAutoCleanup(12, {
  // Every 12 hours
  maxAge: 7,
  maxRegions: 5,
});
```

#### `stopAutoCleanup(cleanupId?: string): Promise<void>`

Stop a specific auto-cleanup by its ID. If no ID is provided, stops only the cleanup associated with the default.

#### `stopAllAutoCleanup(): Promise<void>`

Stop all running auto-cleanup intervals.

```typescript
await manager.stopAllAutoCleanup();
```

### Verification Methods

These methods scan every stored entry in their respective store (across all styles), recompute each entry's integrity, remove unrecoverable ones, and fix the rest. They don't take a style filter — pass `manager.deleteStyle(styleId)` if you want to isolate a style.

#### `verifyAndRepairFonts(): Promise<{ verified: number; repaired: number; removed: number }>`

Verify every stored font entry, repair recoverable metadata, and remove corrupted entries.

```typescript
const result = await manager.verifyAndRepairFonts();
console.log(
  `Verified: ${result.verified}, Repaired: ${result.repaired}, Removed: ${result.removed}`
);
```

#### `verifyAndRepairSprites(): Promise<{ verified: number; repaired: number; removed: number }>`

Same shape, for the `sprites` store.

#### `verifyAndRepairGlyphs(): Promise<{ verified: number; repaired: number; removed: number }>`

Same shape, for the `glyphs` store.

#### `verifyAndRepairModels(): Promise<{ verified: number; repaired: number; removed: number }>`

Same shape, for the `models` store (Mapbox Standard `.glb` assets). Added in DB v4.

### Maintenance Methods

#### `performCompleteMaintenance(options?: MaintenanceOptions): Promise<MaintenanceResults>`

Run a comprehensive maintenance operation that can include cleanup, integrity verification, storage optimization, and report generation. Each stage is optional and configurable.

```typescript
const results = await manager.performCompleteMaintenance({
  cleanupExpired: true, // Stage 1: Clean up expired regions
  verifyIntegrity: true, // Stage 2: Verify fonts, sprites, and glyphs
  optimizeStorage: true, // Stage 3: Remove old resources (30+ days)
  generateReport: true, // Stage 4: Generate comprehensive analytics report
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${(progress * 100).toFixed(0)}%`);
    // "Cleaning up expired regions: 0%"
    // "Verifying resource integrity: 25%"
    // "Optimizing storage: 50%"
    // "Generating analytics report: 75%"
    // "Maintenance complete: 100%"
  },
});

console.log(`Completed in ${results.totalTimeMs}ms`);

// Cleanup results (if cleanupExpired was true)
if (results.cleanupResults) {
  console.log(`Deleted ${results.cleanupResults.deletedRegions} regions`);
  console.log(`Freed ${results.cleanupResults.freedSpace} bytes`);
}

// Integrity results (if verifyIntegrity was true)
if (results.integrityResults) {
  const { fonts, sprites, glyphs } = results.integrityResults;
  console.log(`Fonts - corrupted: ${fonts.corrupted}, repaired: ${fonts.repaired}`);
  console.log(`Sprites - corrupted: ${sprites.corrupted}, repaired: ${sprites.repaired}`);
  console.log(`Glyphs - corrupted: ${glyphs.corrupted}, repaired: ${glyphs.repaired}`);
}

// Optimization results (if optimizeStorage was true)
if (results.optimizationResults) {
  console.log(`Freed ${results.optimizationResults.freedSpace} bytes`);
  console.log(`Optimized ${results.optimizationResults.optimizedResources} resources`);
}

// Full analytics report (if generateReport was true)
if (results.analyticsReport) {
  console.log(`Total storage: ${results.analyticsReport.totalStorageSize} bytes`);
  results.analyticsReport.recommendations.forEach(r => console.log(`- ${r}`));
}
```

---

## OfflineManagerControl

UI control for MapLibre GL JS and Mapbox GL JS that provides a complete interface for downloading, managing, and loading offline map regions. Implements the `IControl` interface compatible with both MapLibre and Mapbox GL.

The control automatically intercepts `window.fetch` to serve offline resources from IndexedDB when URLs use the `idb://` protocol, enabling seamless offline map rendering without any additional configuration.

### Constructor

```typescript
const control = new OfflineManagerControl(
  offlineManager: OfflineMapManager,
  options?: OfflineManagerControlOptions
);
```

**Options:**

| Property      | Type                | Default                                                          | Description                                                                                                           |
| ------------- | ------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `styleUrl`    | `string`            | `'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'` | URL of the map style used for new region downloads                                                                    |
| `theme`       | `'light' \| 'dark'` | `'dark'`                                                         | UI theme. The user's choice is persisted in `localStorage` and takes precedence over this default on subsequent loads |
| `showBbox`    | `boolean`           | `false`                                                          | Show a blue bounding box polygon on the map when focusing on a region                                                 |
| `accessToken` | `string`            | `undefined`                                                      | Mapbox access token (required for `mapbox://` URLs)                                                                   |
| `mapLib`      | `MapLibProtocol`    | `undefined`                                                      | Map library module (e.g., `maplibregl`) for registering the `idb://` protocol in web workers                          |

```typescript
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();
const control = new OfflineManagerControl(offlineManager, {
  styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  theme: 'dark',
  showBbox: true,
});

map.addControl(control, 'top-right');
```

### Methods

#### `onAdd(map: MaplibreMap): HTMLElement`

Called when the control is added to a map (IControl interface). Sets up the fetch interceptor, creates the control button, and initializes all internal component managers.

```typescript
map.addControl(control, 'top-right');
```

#### `onRemove(): void`

Called when the control is removed from a map (IControl interface). Cleans up all resources including DOM elements, map layers, event listeners, and restores the original `window.fetch`.

```typescript
map.removeControl(control);
```

#### `loadOfflineStyle(styleId: string): Promise<void>`

Load a specific offline style by its ID and apply it to the map. The style is retrieved from IndexedDB and patched for offline use (resource URLs are converted to the `idb://` protocol).

```typescript
await control.loadOfflineStyle('style_1234567890');
```

#### `loadOfflineStyles(): Promise<void>`

Load offline styles from IndexedDB. If only one style is stored, it is loaded automatically. If multiple styles exist, a selection modal is displayed for the user to choose.

```typescript
await control.loadOfflineStyles();
```

#### `updateStyleUrl(newStyleUrl: string): void`

Update the style URL used for new region downloads. Also updates the internal region control so subsequent downloads use the new style.

```typescript
control.updateStyleUrl('https://example.com/dark-style.json');
```

#### `getCurrentStyleUrl(): string`

Get the currently configured style URL.

```typescript
const url = control.getCurrentStyleUrl();
```

---

## Types

### OfflineRegionOptions

```typescript
interface OfflineRegionOptions {
  /** Unique region identifier */
  id: string;
  /** Human-readable region name */
  name: string;
  /** Geographic bounds: [[west, south], [east, north]] */
  bounds: [[number, number], [number, number]];
  /** Minimum zoom level to download */
  minZoom: number;
  /** Maximum zoom level to download */
  maxZoom: number;
  /** URL to the map style JSON */
  styleUrl?: string;
  /** Whether this region is part of a multi-region download */
  multipleRegions?: boolean;
  /** Expiry timestamp (ms since epoch) */
  expiry?: number;
  /** Auto-delete on expiration */
  deleteOnExpiry?: boolean;
  /** Tile extension (pbf, mvt, png, jpg, etc.) */
  tileExtension?: string;
  /** Additional tile sources to download alongside the style's own sources */
  extraSources?: ExtraSource[];
}
```

### ExtraSource

Defines an additional tile source to download alongside the style's own sources. This allows saving extra vector (MVT/PBF) or raster layers for a region.

```typescript
interface ExtraSource {
  /** Unique identifier for this source (used as sourceId in tile keys and style sources) */
  id: string;
  /** Source type. Defaults to 'vector'. */
  type?: 'vector' | 'raster' | 'raster-dem';
  /** Tile URL template(s) with {z}, {x}, {y} placeholders */
  tiles: string[];
  /** Minimum zoom level for this source */
  minzoom?: number;
  /** Maximum zoom level for this source */
  maxzoom?: number;
  /** Attribution string for this source */
  attribution?: string;
}
```

### StoredRegion

```typescript
interface StoredRegion extends OfflineRegionOptions {
  /** Database key */
  key: string;
  /** Associated style ID */
  styleId: string;
  /** Creation timestamp */
  created: number;
  /** Expiry timestamp */
  expiry: number;
  /** Last modification timestamp */
  lastModified: number;
  /** Tile extension (mvt, pbf, png, etc.) */
  tileExtension?: string;
}
```

### DownloadProgress

```typescript
interface DownloadProgress {
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current item being processed */
  currentItem?: string;
  /** Progress message */
  message?: string;
  /** List of errors encountered */
  errors: string[];
}
```

### ImportExportOptions

```typescript
interface ImportExportOptions {
  /** Progress callback */
  onProgress?: (progress: ImportExportProgress) => void;
}
```

### ImportExportProgress

```typescript
interface ImportExportProgress {
  /** Current stage of the operation */
  stage: 'preparing' | 'exporting' | 'importing' | 'processing' | 'complete';
  /** Progress percentage (0-100) */
  percentage: number;
  /** Human-readable status message */
  message: string;
  /** Current item being processed (e.g., "14/205/103") */
  currentItem?: string;
  /** Total number of items in this stage */
  totalItems?: number;
  /** Number of completed items in this stage */
  completedItems?: number;
}
```

### ExportResult

```typescript
interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** Always 'mbtiles' — the only supported export format */
  format: 'mbtiles';
  /** Suggested filename for download (ends in .mbtiles) */
  filename: string;
  /** The exported data as a Blob (application/x-sqlite3) */
  blob: Blob;
  /** Total size in bytes */
  size: number;
  statistics: {
    tilesExported: number;
    spritesExported: number; // always 0, kept for compatibility
    fontsExported: number; // always 0, kept for compatibility
  };
}
```

### ImportResult

```typescript
interface ImportResult {
  /** Whether the import succeeded */
  success: boolean;
  /** The region ID of the imported data */
  regionId: string;
  /** Status message */
  message: string;
  /** Non-fatal warnings */
  warnings?: string[];
  statistics: {
    tilesImported: number;
    spritesImported: number; // always 0
    fontsImported: number; // always 0
    totalSize: number;
  };
}
```

### MBTilesExportOptions

```typescript
interface MBTilesExportOptions {
  /** Tile data format written to metadata.format */
  format?: 'pbf' | 'png' | 'jpg';
  /** Additional rows for the MBTiles metadata table (JSON-stringified if non-string) */
  metadata?: Record<string, unknown>;
}
```

### RegionImportData

```typescript
interface RegionImportData {
  /** MBTiles file (from <input type="file" accept=".mbtiles">) */
  file: File;
  /** Only 'mbtiles' is supported */
  format: 'mbtiles';
  /** Overwrite existing region with the same id */
  overwrite?: boolean;
  /** Override the region id stored in the file */
  newRegionId?: string;
  /** Override the region name stored in the file */
  newRegionName?: string;
  /** Progress callback */
  onProgress?: (progress: ImportExportProgress) => void;
}
```

### RegionCleanupOptions

```typescript
interface RegionCleanupOptions {
  /** Maximum region age in days (default: 30) */
  maxAge?: number;
  /** Maximum total storage size in bytes */
  maxStorageSize?: number;
  /** Maximum number of regions to keep */
  maxRegions?: number;
  /** Region ID/name patterns to protect from deletion */
  priorityPatterns?: string[];
  /** Progress callback for cleanup phases */
  onProgress?: (progress: {
    phase: 'scanning' | 'analyzing' | 'cleaning';
    completed: number;
    total: number;
    message: string;
  }) => void;
}
```

### CleanupResult

```typescript
interface CleanupResult {
  /** Total regions scanned */
  scannedRegions: number;
  /** Number of regions identified as expired */
  expiredRegions: number;
  /** Number of regions actually deleted */
  deletedRegions: number;
  /** Number of regions preserved */
  preservedRegions: number;
  /** Total storage freed in bytes */
  freedSpace: number;
  /** Errors encountered during cleanup */
  errors: string[];
  /** Actionable recommendations */
  recommendations: string[];
}
```

### MaintenanceOptions

```typescript
interface MaintenanceOptions {
  /** Enable Stage 1: Clean up expired regions */
  cleanupExpired?: boolean;
  /** Enable Stage 2: Verify integrity of fonts, sprites, and glyphs */
  verifyIntegrity?: boolean;
  /** Enable Stage 3: Optimize storage by removing old resources */
  optimizeStorage?: boolean;
  /** Enable Stage 4: Generate comprehensive analytics report */
  generateReport?: boolean;
  /** Progress callback (stage name, 0-1 progress) */
  onProgress?: (stage: string, progress: number) => void;
}
```

### MaintenanceResults

```typescript
interface MaintenanceResults {
  /** Results from expired region cleanup (Stage 1) */
  cleanupResults?: CleanupResult;
  /** Results from integrity verification (Stage 2) */
  integrityResults?: {
    tiles: { errors: number; fixed: number };
    fonts: { corrupted: number; repaired: number };
    sprites: { corrupted: number; repaired: number };
    glyphs: { corrupted: number; repaired: number };
  };
  /** Results from storage optimization (Stage 3) */
  optimizationResults?: {
    freedSpace: number;
    optimizedResources: number;
  };
  /** Full analytics report (Stage 4) */
  analyticsReport?: StorageAnalyticsReport;
  /** Total wall-clock time in milliseconds */
  totalTimeMs: number;
}
```

### StorageAnalyticsReport

```typescript
interface StorageAnalyticsReport {
  /** Tile statistics */
  tiles: TileStats;
  /** Font statistics */
  fonts: EnhancedFontStats;
  /** Sprite statistics */
  sprites: EnhancedSpriteStats;
  /** Glyph statistics */
  glyphs: EnhancedGlyphStats;
  /** Region analytics */
  regions: RegionAnalytics;
  /** Total storage used across all resource types (bytes) */
  totalStorageSize: number;
  /** Storage breakdown: { tiles, fonts, sprites, glyphs } in bytes */
  storageByType: Record<string, number>;
  /** Actionable storage recommendations */
  recommendations: string[];
}
```

### RegionAnalytics

```typescript
interface RegionAnalytics {
  /** Total number of stored regions */
  totalRegions: number;
  /** Total size of all regions in bytes */
  totalSize: number;
  /** Average region size in bytes */
  averageSize: number;
  /** Oldest region by creation date */
  oldestRegion?: { id: string; created: number };
  /** Newest region by creation date */
  newestRegion?: { id: string; created: number };
  /** Largest region by storage size */
  largestRegion?: { id: string; size: number };
  /** Smallest region by storage size */
  smallestRegion?: { id: string; size: number };
  /** Count of regions grouped by style ID */
  regionsByStyle: Record<string, number>;
  /** Distribution of regions by expiry status */
  expiryDistribution: {
    expired: number;
    expiringWithin24h: number;
    expiringWithin7d: number;
    neverExpiring: number;
  };
}
```

---

## Services

The library exports individual services for fine-grained control:

### TileService

```typescript
import { tileService, downloadTiles } from 'map-gl-offline';

// Using the convenience function
await downloadTiles(region, style, styleId, {
  onProgress: p => console.log(p),
});

// Or using the service instance directly
const stats = await tileService.getTileStats('style_123');
```

### FontService

```typescript
import { fontService } from 'map-gl-offline';

// Download fonts for a style — fontUrls is an array of font file URLs
await fontService.downloadFonts(fontUrls, styleId, {
  onProgress: p => console.log(p),
});
```

### SpriteService

```typescript
import { spriteService } from 'map-gl-offline';

// Download sprites for a style
await spriteService.downloadSprites(spriteUrl, styleId, {
  onProgress: p => console.log(p),
});
```

### StyleService

```typescript
import { loadStyles, loadStyleById } from 'map-gl-offline';

// Load all stored styles
const styles = await loadStyles();

// Load a specific style
const style = await loadStyleById('style_123');
```

---

## Utilities

### Logger

```typescript
import { logger } from 'map-gl-offline';

const myLogger = logger.scope('MyComponent');
myLogger.debug('Debug info');
myLogger.info('Info message');
myLogger.warn('Warning');
myLogger.error('Error', error);
```

### Constants

```typescript
import { DB_NAME, DOWNLOAD_DEFAULTS, TILE_CONFIG, ERROR_MESSAGES } from 'map-gl-offline';

const batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE; // 10
const maxZoom = TILE_CONFIG.MAX_ZOOM; // 24
```

### Error Handling

```typescript
import { categorizeError, getUserErrorMessage, safeExecute, ErrorType } from 'map-gl-offline';

const type = categorizeError(error);
const message = getUserErrorMessage(error);

const result = await safeExecute(async () => {
  return await riskyOperation();
}, 'OperationName');
```

### Style Utilities

```typescript
import { patchStyleForOffline } from 'map-gl-offline';

// Convert a style for offline use
const offlineStyle = patchStyleForOffline(styleJson, styleId);
```

### Import Resolution

```typescript
import { hasImports, resolveImports, sanitizeIndoorExpressions } from 'map-gl-offline';
```

#### `hasImports(style: unknown): boolean`

True when `style.imports` is a non-empty array. Use it to decide whether to call `resolveImports`.

#### `resolveImports(style: BaseStyle, accessToken: string, options?): Promise<BaseStyle>`

Recursively fetches every import listed in `style.imports[]`, flattens sources / layers / sprite / glyphs / models into the outer style, resolves `["config", <key>]` expressions using each import's schema defaults + the caller's config overrides, and runs `sanitizeIndoorExpressions` at the end. Mutates and returns the passed style.

Options: `{ maxRetries?: number; timeoutMs?: number }`. Defaults: 3 retries, 30 s timeout. Imports nest up to 5 deep per Mapbox spec.

In practice the Mapbox API returns Standard already-expanded, so `hasImports()` is false for that URL and `resolveImports` is a no-op. The function stays useful for manually-assembled styles and for other providers that ship the unexpanded form.

#### `sanitizeIndoorExpressions(style: BaseStyle): void`

Walks `style.layers[]` and rewrites `["is-active-floor"]` / `["is-active-floor", id]` → `false` and `["floor-level"]` → `0` everywhere they appear (inside filter / paint / layout sub-expressions too). In Mapbox GL v3 these expressions read `map.indoor.activeFloors` at filter-compile time; without the runtime `imports` wrapper the read throws and `setStyle()` hangs with `"Style is not done loading"`. The library calls this automatically — both at the end of `resolveImports` (download path) and at style load time in `PanelManager.handleLoadStyle` / `OfflineManagerControl.loadOfflineStyle` (heals regions downloaded on 0.8.0 without re-downloading).

Idempotent.

### Tile Key Utilities

```typescript
import {
  createTileKey,
  parseTileKey,
  deriveTileExtension,
  extractTileExtensionFromUrl,
} from 'map-gl-offline';
```

#### `createTileKey(x, y, z, styleId, sourceId, ext): string`

Returns `{styleId}:{sourceId}:{z}:{x}:{y}.{ext}` — the canonical tile-store key.

#### `parseTileKey(key: string): { styleId, sourceId, z, x, y, ext } | null`

Inverse of `createTileKey`. Returns null for malformed keys.

#### `deriveTileExtension(tiles: unknown): string`

Takes a source's `tiles` array, returns the extension of the first URL (or `"pbf"`). Used when generating per-source tile URL templates.

#### `extractTileExtensionFromUrl(url: string): string`

Returns the last dotted segment of the URL path before `?` / `#` / end. For Mapbox v4 `.vector.pbf` URLs this gives `"pbf"` — which matches what `tileService.extractExtension` stores the tile key under. Added in 0.8.1 to dedupe an extract-regex that used to live (incompatibly) in two places; `deriveTileExtension` now delegates to it.
