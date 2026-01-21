---
sidebar_position: 3
---

# API Reference

Complete API documentation for `map-gl-offline`.

## OfflineMapManager

The main class for managing offline map data programmatically.

### Constructor

```typescript
const manager = new OfflineMapManager(options?: OfflineMapManagerOptions);
```

**Options:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `autoCleanup` | `boolean` | `false` | Enable automatic cleanup of expired data |
| `cleanupInterval` | `number` | `86400000` | Cleanup interval in ms (default: 24 hours) |

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

#### `getRegion(id: string): Promise<StoredRegion | null>`

Retrieve a stored region by its ID.

```typescript
const region = await manager.getRegion('my-region');
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

#### `updateRegion(id: string, updates: Partial<OfflineRegionOptions>): Promise<void>`

Update region settings (name, expiry, etc.).

```typescript
await manager.updateRegion('my-region', {
  name: 'Updated Name',
  expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

### Analytics Methods

#### `getComprehensiveStorageAnalytics(): Promise<StorageAnalytics>`

Get detailed storage statistics.

```typescript
const analytics = await manager.getComprehensiveStorageAnalytics();
console.log(`Total storage: ${analytics.totalStorageSize} bytes`);
console.log(`Tiles: ${analytics.tiles.count}`);
console.log(`Fonts: ${analytics.fonts.count}`);
console.log(`Sprites: ${analytics.sprites.count}`);
```

#### `getRegionAnalytics(regionId: string): Promise<RegionAnalytics>`

Get analytics for a specific region.

```typescript
const analytics = await manager.getRegionAnalytics('my-region');
console.log(`Region size: ${analytics.totalSize} bytes`);
```

#### `getTileStats(): Promise<TileStats>`

Get tile-specific statistics.

#### `getFontStats(): Promise<FontStats>`

Get font statistics.

#### `getSpriteStats(): Promise<SpriteStats>`

Get sprite statistics.

### Import/Export Methods

#### `exportRegionAsJSON(regionId: string, options?: ExportOptions): Promise<ExportResult>`

Export a region to JSON format.

```typescript
const result = await manager.exportRegionAsJSON('my-region', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
  onProgress: (p) => console.log(`${p.percentage}%`),
});

// Download the file
const url = URL.createObjectURL(result.blob);
const a = document.createElement('a');
a.href = url;
a.download = result.filename;
a.click();
URL.revokeObjectURL(url);
```

#### `exportRegionAsPMTiles(regionId: string, options?: PMTilesExportOptions): Promise<ExportResult>`

Export a region to PMTiles format (web-optimized).

```typescript
const result = await manager.exportRegionAsPMTiles('my-region', {
  compression: 'gzip',
  metadata: { attribution: 'My Data', version: '1.0' },
});
```

#### `exportRegionAsMBTiles(regionId: string, options?: MBTilesExportOptions): Promise<ExportResult>`

Export a region to MBTiles format (SQLite-based).

```typescript
const result = await manager.exportRegionAsMBTiles('my-region', {
  format: 'pbf',
  compression: 'gzip',
  metadata: { description: 'Offline map' },
});
```

#### `importRegion(data: RegionImportData): Promise<ImportResult>`

Import a region from a file.

```typescript
const result = await manager.importRegion({
  file: selectedFile,
  format: 'json', // or 'pmtiles', 'mbtiles'
  overwrite: true,
  newRegionId: 'imported-region',
  newRegionName: 'Imported Region',
});

if (result.success) {
  console.log(`Imported: ${result.statistics.tilesImported} tiles`);
}
```

### Maintenance Methods

#### `cleanupOldTiles(maxAge: number): Promise<number>`

Remove tiles older than the specified age (in milliseconds).

```typescript
const deletedCount = await manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000); // 7 days
console.log(`Cleaned ${deletedCount} old tiles`);
```

#### `cleanupOldFonts(maxAge: number): Promise<number>`

Remove font data older than the specified age.

#### `cleanupExpiredRegions(): Promise<CleanupResult>`

Remove regions that have passed their expiration date.

```typescript
const result = await manager.cleanupExpiredRegions();
console.log(`Deleted: ${result.deletedRegions}, Freed: ${result.freedSpace} bytes`);
```

#### `verifyAndRepairTiles(): Promise<VerificationResult>`

Verify tile integrity and attempt repairs if possible.

```typescript
const result = await manager.verifyAndRepairTiles();
console.log(`Valid: ${result.validTiles}, Corrupted: ${result.corruptedTiles}`);
```

#### `startAutoCleanup(options: AutoCleanupOptions): void`

Enable automatic cleanup of old data.

```typescript
manager.startAutoCleanup({
  interval: 24 * 60 * 60 * 1000, // Daily
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

#### `stopAutoCleanup(): void`

Disable automatic cleanup.

---

## OfflineManagerControl

UI control for MapLibre GL JS with glassmorphic design.

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
| `styleUrl` | `string` | Carto Voyager | URL of the map style for downloads |
| `theme` | `'light' \| 'dark'` | `'dark'` | UI theme |
| `showBbox` | `boolean` | `false` | Show bounding boxes when focusing regions |

### Methods

#### `onAdd(map: MaplibreMap): HTMLElement`

Called when the control is added to a map (IControl interface).

```typescript
map.addControl(control, 'top-right');
```

#### `onRemove(): void`

Called when the control is removed from a map (IControl interface).

```typescript
map.removeControl(control);
```

#### `loadOfflineStyle(styleId: string): Promise<void>`

Load a specific offline style by its ID.

```typescript
await control.loadOfflineStyle('style_1234567890');
```

#### `loadOfflineStyles(): Promise<void>`

Load offline styles (shows selection modal if multiple available).

```typescript
await control.loadOfflineStyles();
```

#### `updateStyleUrl(newStyleUrl: string): void`

Update the style URL for new downloads.

```typescript
control.updateStyleUrl('https://example.com/new-style.json');
```

#### `getCurrentStyleUrl(): string`

Get the current style URL.

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
  /** Progress callback */
  onProgress?: (progress: DownloadProgress) => void;
  /** Expiry timestamp (ms since epoch) */
  expiry?: number;
  /** Auto-delete on expiration */
  deleteOnExpiry?: boolean;
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

### ExportOptions

```typescript
interface ImportExportOptions {
  /** Include style data */
  includeStyle?: boolean;
  /** Include tiles */
  includeTiles?: boolean;
  /** Include sprites */
  includeSprites?: boolean;
  /** Include fonts */
  includeFonts?: boolean;
  /** Export format */
  format?: 'json' | 'pmtiles' | 'mbtiles';
  /** Enable compression */
  compression?: boolean;
  /** Progress callback */
  onProgress?: (progress: ImportExportProgress) => void;
}
```

### PMTilesExportOptions

```typescript
interface PMTilesExportOptions extends ExportOptions {
  compression?: 'gzip' | 'brotli' | 'none';
  clustered?: boolean;
  metadata?: Record<string, unknown>;
}
```

### MBTilesExportOptions

```typescript
interface MBTilesExportOptions extends ExportOptions {
  format?: 'pbf' | 'png' | 'jpg';
  compression?: 'gzip' | 'none';
  metadata?: Record<string, unknown>;
}
```

### RegionImportData

```typescript
interface RegionImportData {
  /** The file to import */
  file: File;
  /** File format */
  format: 'json' | 'pmtiles' | 'mbtiles';
  /** Overwrite existing region */
  overwrite?: boolean;
  /** New region ID */
  newRegionId?: string;
  /** New region name */
  newRegionName?: string;
}
```

### CleanupResult

```typescript
interface CleanupResult {
  scannedRegions: number;
  expiredRegions: number;
  deletedRegions: number;
  preservedRegions: number;
  freedSpace: number;
  errors: string[];
  recommendations: string[];
}
```

### RegionAnalytics

```typescript
interface RegionAnalytics {
  totalRegions: number;
  totalSize: number;
  averageSize: number;
  oldestRegion?: { id: string; created: number };
  newestRegion?: { id: string; created: number };
  largestRegion?: { id: string; size: number };
  smallestRegion?: { id: string; size: number };
  regionsByStyle: Record<string, number>;
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
import { TileService } from 'map-gl-offline';

// Download tiles for a region
await TileService.downloadTiles(sourceUrl, bounds, minZoom, maxZoom, {
  onProgress: (p) => console.log(p),
});
```

### FontService

```typescript
import { FontService } from 'map-gl-offline';

// Download fonts/glyphs
await FontService.downloadFonts(fontUrl, fontStacks, {
  onProgress: (p) => console.log(p),
});
```

### SpriteService

```typescript
import { SpriteService } from 'map-gl-offline';

// Download sprites
await SpriteService.downloadSprites(spriteUrl, {
  onProgress: (p) => console.log(p),
});
```

### StyleService

```typescript
import { StyleService, loadStyles, loadStyleById } from 'map-gl-offline';

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
const maxZoom = TILE_CONFIG.MAX_ZOOM; // 22
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
