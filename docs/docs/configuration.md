---
sidebar_position: 4
---

# Configuration

This guide covers all configuration options available in `map-gl-offline`.

## OfflineMapManager Configuration

### Constructor Options

```typescript
const manager = new OfflineMapManager({
  autoCleanup: true,
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoCleanup` | `boolean` | `false` | Automatically cleanup expired tiles and regions |
| `cleanupInterval` | `number` | `86400000` | Interval between cleanups in milliseconds |

## OfflineManagerControl Configuration

### Constructor Options

```typescript
const control = new OfflineManagerControl(offlineManager, {
  styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  theme: 'dark',
  showBbox: true,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `styleUrl` | `string` | Carto Voyager | Map style URL for new region downloads |
| `theme` | `'light' \| 'dark'` | `'dark'` | UI theme for the control panel |
| `showBbox` | `boolean` | `false` | Show bounding box overlay when focusing on regions |

## Region Configuration

### OfflineRegionOptions

When downloading a region, you can configure various options:

```typescript
await manager.addRegion({
  // Required
  id: 'unique-region-id',
  name: 'Human Readable Name',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]], // [[west, south], [east, north]]
  minZoom: 10,
  maxZoom: 16,

  // Optional
  styleUrl: 'https://example.com/style.json',
  expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
  deleteOnExpiry: true,
  multipleRegions: false,

  // Callbacks
  onProgress: (progress) => {
    console.log(`${progress.percentage}% - ${progress.message}`);
  },
});
```

### Region Options Reference

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the region |
| `name` | `string` | Yes | Human-readable display name |
| `bounds` | `[[lng, lat], [lng, lat]]` | Yes | Geographic bounds (southwest, northeast) |
| `minZoom` | `number` | Yes | Minimum zoom level to download (e.g., 10) |
| `maxZoom` | `number` | Yes | Maximum zoom level to download (e.g., 16) |
| `styleUrl` | `string` | No | Map style URL to use |
| `expiry` | `number` | No | Expiration timestamp (ms since epoch) |
| `deleteOnExpiry` | `boolean` | No | Auto-delete when expired (default: false) |
| `multipleRegions` | `boolean` | No | Part of a multi-region download |
| `onProgress` | `function` | No | Progress callback function |

## Export Configuration

### JSON Export

```typescript
await manager.exportRegionAsJSON('region-id', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
  onProgress: (progress) => console.log(progress),
});
```

### PMTiles Export

```typescript
await manager.exportRegionAsPMTiles('region-id', {
  compression: 'gzip', // 'gzip' | 'brotli' | 'none'
  clustered: false,
  metadata: {
    attribution: 'Your Attribution',
    version: '1.0.0',
    description: 'Custom metadata',
  },
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
});
```

### MBTiles Export

```typescript
await manager.exportRegionAsMBTiles('region-id', {
  format: 'pbf', // 'pbf' | 'png' | 'jpg'
  compression: 'gzip', // 'gzip' | 'none'
  metadata: {
    name: 'My Map',
    description: 'Offline map data',
    version: '1.0',
    type: 'baselayer', // 'baselayer' | 'overlay'
    format: 'pbf',
  },
});
```

## Import Configuration

```typescript
await manager.importRegion({
  file: selectedFile,
  format: 'json', // 'json' | 'pmtiles' | 'mbtiles'
  overwrite: false, // Replace existing region with same ID
  newRegionId: 'custom-id', // Override the region ID
  newRegionName: 'Custom Name', // Override the region name
});
```

## Cleanup Configuration

### Manual Cleanup

```typescript
// Cleanup tiles older than 7 days
await manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000);

// Cleanup fonts older than 30 days
await manager.cleanupOldFonts(30 * 24 * 60 * 60 * 1000);

// Cleanup expired regions
await manager.cleanupExpiredRegions();
```

### Automatic Cleanup

```typescript
manager.startAutoCleanup({
  interval: 24 * 60 * 60 * 1000, // Run every 24 hours
  maxAge: 30 * 24 * 60 * 60 * 1000, // Delete data older than 30 days
});

// Stop auto cleanup
manager.stopAutoCleanup();
```

### Advanced Cleanup Options

```typescript
const result = await manager.cleanupWithOptions({
  maxAge: 30, // Days
  maxStorageSize: 500 * 1024 * 1024, // 500MB max
  maxRegions: 10, // Keep at most 10 regions
  priorityPatterns: ['important-*', 'favorite-*'], // Preserve these
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.completed}/${progress.total}`);
  },
});

console.log(`Freed ${result.freedSpace} bytes`);
```

## Download Configuration

### Default Download Settings

The library uses these defaults for downloads:

```typescript
const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10, // Concurrent downloads
  MAX_RETRIES: 3, // Retry attempts per item
  TIMEOUT: 10000, // Request timeout (ms)
  RETRY_DELAY: 1000, // Delay between retries (ms)
};
```

### Tile Configuration

```typescript
const TILE_CONFIG = {
  MIN_ZOOM: 0,
  MAX_ZOOM: 22,
  TILE_SIZE: 256,
  MAX_CONCURRENT: 6, // Browser limit
};
```

## Storage Configuration

### IndexedDB Settings

The library uses IndexedDB with the following structure:

- **Database Name**: `map-gl-offline`
- **Stores**:
  - `tiles` - Map tiles (indexed by z/x/y)
  - `styles` - Style JSON documents
  - `sprites` - Sprite images and JSON
  - `fonts` - Font/glyph data
  - `regions` - Region metadata

### Storage Quota Management

```typescript
// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Using ${usage} of ${quota} bytes`);

  // Warning at 90% usage
  if (usage / quota > 0.9) {
    console.warn('Storage nearly full');
    await manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000);
  }
}

// Request persistent storage (won't be auto-cleared)
if (navigator.storage?.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`Persistent storage: ${isPersisted}`);
}
```

## Theme Configuration

The UI control supports theme customization:

```typescript
// Set theme on initialization
const control = new OfflineManagerControl(manager, {
  theme: 'dark', // or 'light'
});

// Theme is persisted to localStorage
// Key: 'offline-manager-theme'
```

### CSS Custom Properties

You can customize the appearance using CSS:

```css
.offline-manager-control {
  /* Panel styling */
  --panel-bg: rgba(255, 255, 255, 0.95);
  --panel-border: rgba(0, 0, 0, 0.1);
  --panel-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Button styling */
  --button-bg: #3b82f6;
  --button-hover: #2563eb;
  --button-text: white;

  /* Text colors */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
}

/* Dark theme overrides */
.dark .offline-manager-control {
  --panel-bg: rgba(31, 41, 55, 0.95);
  --panel-border: rgba(255, 255, 255, 0.1);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
}
```

## Logging Configuration

```typescript
import { logger, LogLevel } from 'map-gl-offline';

// Set log level
logger.setLogLevel(LogLevel.DEBUG); // Show all logs
logger.setLogLevel(LogLevel.INFO); // Info and above
logger.setLogLevel(LogLevel.WARN); // Warnings and errors only
logger.setLogLevel(LogLevel.ERROR); // Errors only
logger.setLogLevel(LogLevel.NONE); // Disable logging

// Create scoped logger
const myLogger = logger.scope('MyComponent');
myLogger.debug('This is a debug message');
```

In production, the log level automatically defaults to `INFO`.

## Environment Variables

For Vite-based projects:

```env
# .env file
VITE_MAPTILER_API_KEY=your_api_key
VITE_MAPBOX_ACCESS_TOKEN=your_token
```

Access in code:

```typescript
const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
const styleUrl = `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`;
```
