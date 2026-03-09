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

#### `addRegion(options: OfflineRegionOptions): Promise<void>`

Download and store a map region for offline use.

```typescript
await manager.addRegion({
  id: 'my-region',
  name: 'My Region',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://example.com/style.json',
  onProgress: (progress) => console.log(progress.percentage),
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
  console.log(`Oldest: ${analytics.oldestRegion.id}, created ${new Date(analytics.oldestRegion.created)}`);
}
if (analytics.largestRegion) {
  console.log(`Largest: ${analytics.largestRegion.id}, ${analytics.largestRegion.size} bytes`);
}

// Expiry distribution
const { expired, expiringWithin24h, expiringWithin7d, neverExpiring } = analytics.expiryDistribution;
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

#### `getTileStatistics(styleId: string): Promise<TileStats>`

Get tile-specific statistics for a given style.

#### `getFontStatistics(styleId: string): Promise<EnhancedFontStats>`

Get font statistics for a given style.

#### `getSpriteStatistics(styleId: string): Promise<EnhancedSpriteStats>`

Get sprite statistics for a given style.

### Import/Export Methods

The library supports three export formats: **JSON** (full-fidelity, includes all resources), **PMTiles** (web-optimized tile archive), and **MBTiles** (SQLite-based, widely compatible with GIS tools).

#### `exportRegionAsJSON(regionId: string, options?: ImportExportOptions): Promise<ExportResult>`

Export a region to JSON format. This is the most complete format, supporting tiles, styles, sprites, and fonts. Best for backup/restore workflows within map-gl-offline.

```typescript
const result = await manager.exportRegionAsJSON('my-region', {
  includeStyle: true,   // default: true
  includeTiles: true,   // default: true
  includeSprites: true, // default: true
  includeFonts: true,   // default: true
  onProgress: (p) => {
    console.log(`[${p.stage}] ${p.percentage}% - ${p.message}`);
    // [preparing] 0% - Preparing export...
    // [exporting] 30% - Exporting tiles...
    // [complete] 100% - Export complete!
  },
});

console.log(`Exported ${result.statistics.tilesExported} tiles (${result.size} bytes)`);
```

#### `exportRegionAsPMTiles(regionId: string, options?: ImportExportOptions & PMTilesExportOptions): Promise<ExportResult>`

Export a region to PMTiles format. PMTiles is a cloud-optimized tile archive format designed for efficient HTTP range request access. Exports tiles only (no sprites or fonts).

```typescript
const result = await manager.exportRegionAsPMTiles('my-region', {
  compression: 'gzip',  // 'gzip' | 'brotli' | 'none'
  clustered: true,       // optimize tile ordering
  metadata: { attribution: 'My Data', version: '1.0' },
  onProgress: (p) => console.log(`${p.percentage}%`),
});
```

#### `exportRegionAsMBTiles(regionId: string, options?: ImportExportOptions & MBTilesExportOptions): Promise<ExportResult>`

Export a region to MBTiles format. MBTiles is a SQLite-based tile storage specification widely used by GIS tools like QGIS, TileMill, and Mapbox Studio. Exports tiles only.

```typescript
const result = await manager.exportRegionAsMBTiles('my-region', {
  format: 'pbf',        // 'pbf' | 'png' | 'jpg'
  compression: 'gzip',  // 'gzip' | 'none'
  metadata: { description: 'Offline map data' },
  onProgress: (p) => console.log(`${p.percentage}%`),
});
```

#### `downloadExportedRegion(exportResult: ExportResult): void`

Convenience method to trigger a browser download of an export result. Creates a temporary link and clicks it, then cleans up the object URL.

```typescript
const result = await manager.exportRegionAsJSON('my-region');
manager.downloadExportedRegion(result);
// Browser download dialog appears with the exported file
```

#### `importRegion(data: RegionImportData): Promise<ImportResult>`

Import a region from a file. Supports all three formats (JSON, PMTiles, MBTiles). The imported data is stored in IndexedDB alongside existing regions.

```typescript
const result = await manager.importRegion({
  file: selectedFile,           // File object from <input type="file">
  format: 'json',              // 'json' | 'pmtiles' | 'mbtiles'
  overwrite: true,             // replace existing region with same ID
  newRegionId: 'imported-region',   // optional: override the region ID
  newRegionName: 'Imported Region', // optional: override the region name
});

if (result.success) {
  console.log(`Imported to region: ${result.regionId}`);
  console.log(`Tiles: ${result.statistics.tilesImported}`);
  console.log(`Sprites: ${result.statistics.spritesImported}`);
  console.log(`Fonts: ${result.statistics.fontsImported}`);
} else {
  console.error(`Import failed: ${result.message}`);
}
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
  maxAge: 14,                    // Delete regions older than 14 days
  maxStorageSize: 500 * 1024 * 1024, // Keep total storage under 500MB
  maxRegions: 10,                // Keep at most 10 regions
  priorityPatterns: ['downtown', 'home'], // Protect regions matching these patterns
  onProgress: (progress) => {
    console.log(`[${progress.phase}] ${progress.completed}/${progress.total} - ${progress.message}`);
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

#### `cleanupOldFonts(styleId?: string, options?: { maxAge?: number }): Promise<unknown>`

Remove font data older than the specified age.

#### `cleanupOldSprites(styleId?: string, options?: { maxAge?: number }): Promise<unknown>`

Remove sprite data older than the specified age.

#### `cleanupOldGlyphs(styleId?: string, options?: { maxAge?: number }): Promise<unknown>`

Remove glyph data older than the specified age.

#### `setupAutoCleanup(options?: RegionCleanupOptions & { intervalHours?: number }): Promise<string>`

Set up automatic periodic cleanup. Returns a cleanup ID that can be used to stop this specific auto-cleanup. The cleanup runs using the smart cleanup algorithm with the provided options.

```typescript
const cleanupId = await manager.setupAutoCleanup({
  intervalHours: 24,             // Run every 24 hours (default)
  maxAge: 30,                    // Delete regions older than 30 days
  maxStorageSize: 1024 * 1024 * 1024, // 1GB limit
  priorityPatterns: ['important'],
});

// Later, stop this specific auto-cleanup
await manager.stopAutoCleanup(cleanupId);
```

#### `startEnhancedAutoCleanup(intervalHours?: number, options?: RegionCleanupOptions): Promise<string>`

Alternative auto-cleanup setup with separate interval and options parameters. Returns a cleanup ID.

```typescript
const cleanupId = await manager.startEnhancedAutoCleanup(12, { // Every 12 hours
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

#### `verifyAndRepairFonts(styleId: string, options?: { removeCorrupted?: boolean }): Promise<{ verified: number; repaired: number; removed: number }>`

Verify font integrity for a style and optionally remove corrupted entries.

```typescript
const result = await manager.verifyAndRepairFonts('style_123', { removeCorrupted: true });
console.log(`Verified: ${result.verified}, Repaired: ${result.repaired}, Removed: ${result.removed}`);
```

#### `verifyAndRepairSprites(styleId: string, options?: { autoRepair?: boolean }): Promise<{ verified: number; repaired: number; removed: number }>`

Verify sprite integrity for a style and optionally auto-repair.

#### `verifyAndRepairGlyphs(styleId: string, options?: { removeCorrupted?: boolean }): Promise<{ verified: number; repaired: number; removed: number }>`

Verify glyph integrity for a style and optionally remove corrupted entries.

### Maintenance Methods

#### `performCompleteMaintenance(options?: MaintenanceOptions): Promise<MaintenanceResults>`

Run a comprehensive maintenance operation that can include cleanup, integrity verification, storage optimization, and report generation. Each stage is optional and configurable.

```typescript
const results = await manager.performCompleteMaintenance({
  cleanupExpired: true,     // Stage 1: Clean up expired regions
  verifyIntegrity: true,    // Stage 2: Verify fonts, sprites, and glyphs
  optimizeStorage: true,    // Stage 3: Remove old resources (30+ days)
  generateReport: true,     // Stage 4: Generate comprehensive analytics report
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

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `styleUrl` | `string` | `'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'` | URL of the map style used for new region downloads |
| `theme` | `'light' \| 'dark'` | `'dark'` | UI theme. The user's choice is persisted in `localStorage` and takes precedence over this default on subsequent loads |
| `showBbox` | `boolean` | `false` | Show a blue bounding box polygon on the map when focusing on a region |
| `accessToken` | `string` | `undefined` | Mapbox access token (required for `mapbox://` URLs) |
| `mapLib` | `MapLibProtocol` | `undefined` | Map library module (e.g., `maplibregl`) for registering the `idb://` protocol in web workers |

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

#### `loadSpecificOfflineStyle(styleId: string): Promise<void>`

Alias for `loadOfflineStyle()`. Loads a specific offline style by ID.

```typescript
await control.loadSpecificOfflineStyle('style_1234567890');
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
  /** Include style data (default: true) */
  includeStyle?: boolean;
  /** Include tiles (default: true) */
  includeTiles?: boolean;
  /** Include sprites (default: true) */
  includeSprites?: boolean;
  /** Include fonts (default: true) */
  includeFonts?: boolean;
  /** Export format */
  format?: 'json' | 'pmtiles' | 'mbtiles';
  /** Enable compression */
  compression?: boolean;
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
  /** Export format used */
  format: 'json' | 'pmtiles' | 'mbtiles';
  /** Suggested filename for download */
  filename: string;
  /** The exported data as a Blob */
  blob: Blob;
  /** Total size in bytes */
  size: number;
  /** Export statistics */
  statistics: {
    tilesExported: number;
    spritesExported: number;
    fontsExported: number;
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
  /** Import statistics */
  statistics: {
    tilesImported: number;
    spritesImported: number;
    fontsImported: number;
    totalSize: number;
  };
}
```

### PMTilesExportOptions

```typescript
interface PMTilesExportOptions {
  /** Compression algorithm */
  compression?: 'gzip' | 'brotli' | 'none';
  /** Optimize tile ordering for clustered access */
  clustered?: boolean;
  /** Additional metadata to embed in the PMTiles header */
  metadata?: Record<string, unknown>;
}
```

### MBTilesExportOptions

```typescript
interface MBTilesExportOptions {
  /** Tile data format */
  format?: 'pbf' | 'png' | 'jpg';
  /** Compression for tile data */
  compression?: 'gzip' | 'none';
  /** Additional metadata for the MBTiles metadata table */
  metadata?: Record<string, unknown>;
}
```

### RegionImportData

```typescript
interface RegionImportData {
  /** The file to import (from <input type="file">) */
  file: File;
  /** File format to parse */
  format: 'json' | 'pmtiles' | 'mbtiles';
  /** Overwrite existing region with the same ID */
  overwrite?: boolean;
  /** Override the region ID from the file */
  newRegionId?: string;
  /** Override the region name from the file */
  newRegionName?: string;
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
  onProgress: (p) => console.log(p),
});

// Or using the service instance directly
const stats = await tileService.getTileStats('style_123');
```

### FontService

```typescript
import { fontService } from 'map-gl-offline';

// Download fonts/glyphs for a style
await fontService.downloadFonts(glyphUrl, fontStacks, styleId, {
  onProgress: (p) => console.log(p),
});
```

### SpriteService

```typescript
import { spriteService } from 'map-gl-offline';

// Download sprites for a style
await spriteService.downloadSprites(spriteUrl, styleId, {
  onProgress: (p) => console.log(p),
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
import {
  DB_NAME,
  DOWNLOAD_DEFAULTS,
  TILE_CONFIG,
  ERROR_MESSAGES
} from 'map-gl-offline';

const batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE; // 10
const maxZoom = TILE_CONFIG.MAX_ZOOM; // 24
```

### Error Handling

```typescript
import {
  categorizeError,
  getUserErrorMessage,
  safeExecute,
  ErrorType
} from 'map-gl-offline';

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
