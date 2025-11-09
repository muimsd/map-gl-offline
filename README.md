# Map GL Offline

[![npm version](https://badge.fury.io/js/map-gl-offline.svg)](https://badge.fury.io/js/map-gl-offline)
[![CI](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml/badge.svg)](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/muimsd/map-gl-offline/branch/main/graph/badge.svg)](https://codecov.io/gh/muimsd/map-gl-offline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **⚠️ Development Notice**: This package is currently under active development and is only available for **MapLibre GL JS**. Mapbox GL JS support is planned for future releases.

A **TypeScript-compatible** npm package for **MapLibre GL JS** that enables comprehensive offline storage and usage of vector/raster tiles, sprites, styles, fonts (glyphs), and entire map regions with advanced analytics, intelligent cleanup, and robust error handling.

## ✨ Features

### 🎯 **Core Offline Capabilities**

- 🗺️ **Complete Offline Maps**: Download and store entire map regions for offline use
- 🎯 **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and cleanup with zoom-level optimization
- 🔤 **Advanced Font & Glyph Support**: Comprehensive font and glyph management with Unicode range analytics
- 🎨 **Sprite Management**: Handle map sprites and icons offline with multi-resolution support (@1x, @2x)
- 📊 **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations
- 📤 **Import/Export Support**: Export regions to JSON, PMTiles, and MBTiles formats, and import them back
- 🔄 **Data Portability**: Transfer offline maps between devices and applications seamlessly

### 🛠️ **Technical Excellence**

- 💾 **Modern IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- 🔧 **Full TypeScript Support**: Complete type definitions, interfaces, and compile-time safety
- ⚡ **Performance Optimized**: Concurrent downloads, modern async/await patterns, and memory-efficient operations
- 🧹 **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies and background processing
- 🔄 **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation
- 🗜️ **Multiple Export Formats**: Support for JSON, PMTiles, and MBTiles export formats

### 🎨 **Developer Experience**

- 🛠️ **Developer Friendly**: Comprehensive API with extensive customization options and detailed documentation
- 📈 **Progress Tracking**: Real-time download progress with detailed feedback
- 🔍 **Debugging Support**: Enhanced logging, error reporting, and diagnostics
- 🧪 **Production Ready**: Battle-tested with comprehensive error handling and memory management

## 📦 Installation

```bash
npm install map-gl-offline
# or
yarn add map-gl-offline
# or
pnpm add map-gl-offline
```

## � Environment Setup

For development or if using Maptiler styles, create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env
```

Then add your Maptiler API key:

```env
VITE_MAPTILER_API_KEY=your_api_key_here
```

Get a free API key from [Maptiler](https://www.maptiler.com/).

## �🚀 Quick Start

### Basic Usage

```typescript
import { OfflineMapManager } from 'map-gl-offline';

// Initialize the offline manager
const offlineManager = new OfflineMapManager();

// Download a map region for offline use
await offlineManager.addRegion({
  id: 'my-region',
  name: 'Downtown Area',
  bounds: [
    [-74.0559, 40.7128], // Southwest coordinates [lng, lat]
    [-74.0059, 40.7628], // Northeast coordinates [lng, lat]
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11',
  onProgress: progress => {
    console.log(`Download progress: ${progress.percentage}%`);
    console.log(`Current: ${progress.message}`);
  },
});

// Use the offline region in your map
const region = await offlineManager.getRegion('my-region');
if (region) {
  // Apply offline style to your map
  map.setStyle(region.style);
}
```

### Import/Export Functionality

Export and import offline regions for data portability and backup:

```typescript
import { OfflineMapManager } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();

// Export region to JSON format
const jsonExport = await offlineManager.exportRegionAsJSON('my-region', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
  onProgress: progress => {
    console.log(`Export progress: ${progress.percentage}%`);
    console.log(`Stage: ${progress.stage}, Message: ${progress.message}`);
  },
});

// Download the exported file
const url = URL.createObjectURL(jsonExport.blob);
const a = document.createElement('a');
a.href = url;
a.download = jsonExport.filename;
a.click();

// Export region to PMTiles format (optimized for web serving)
const pmtilesExport = await offlineManager.exportRegionAsPMTiles('my-region', {
  compression: 'gzip',
  metadata: {
    attribution: 'Custom map data',
    version: '1.0',
  },
});

// Export region to MBTiles format (SQLite-based, industry standard)
const mbtilesExport = await offlineManager.exportRegionAsMBTiles('my-region', {
  format: 'pbf',
  compression: 'gzip',
  metadata: {
    description: 'Offline map region for mobile app',
  },
});

// Import region from file
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const importResult = await offlineManager.importRegion({
      file,
      format: 'json', // or 'pmtiles', 'mbtiles'
      overwrite: true,
      newRegionId: 'imported-region',
      newRegionName: 'Imported Downtown Area',
    });

    if (importResult.success) {
      console.log(`Successfully imported region: ${importResult.regionId}`);
      console.log(`Statistics:`, importResult.statistics);
    } else {
      console.error(`Import failed: ${importResult.message}`);
    }
  }
});
```

#### Export Format Guide

**JSON Format** - Best for development and debugging

- ✅ Human-readable and editable
- ✅ Complete data preservation
- ✅ Easy to inspect and modify
- ❌ Larger file size
- 📄 Use for: Development, debugging, data analysis

**PMTiles Format** - Optimized for web serving

- ✅ Efficient web serving without servers
- ✅ HTTP range request support
- ✅ Good compression ratios
- ❌ Specialized format
- 🌐 Use for: Web applications, CDN distribution

**MBTiles Format** - Industry standard

- ✅ SQLite-based, widely supported
- ✅ Compatible with many mapping tools
- ✅ Mature ecosystem
- ❌ Requires SQLite support
- 🗺️ Use for: GIS applications, mobile apps, cross-platform compatibility

### Service-Level Usage (Advanced)

```typescript
import {
  downloadTiles,
  downloadFonts,
  downloadSprites,
  downloadStyles,
  getComprehensiveStorageAnalytics,
} from 'map-gl-offline';

// Download tiles for a specific region
const tileResult = await downloadTiles(
  {
    bounds: [
      [-74.0559, 40.7128],
      [-74.0059, 40.7628],
    ],
    minZoom: 10,
    maxZoom: 16,
  },
  styleData,
  'style-id',
  {
    onProgress: progress => console.log(`Tiles: ${progress.percentage}%`),
    batchSize: 10,
    maxRetries: 3,
  }
);

// Download fonts with advanced options
const fontResult = await downloadFonts(
  ['https://fonts.example.com/font1.pbf', 'https://fonts.example.com/font2.pbf'],
  'download-id',
  {
    onProgress: progress => console.log(`Fonts: ${progress.percentage}%`),
    includeMetadata: true,
    maxConcurrency: 5,
  }
);

// Download sprites (all resolutions)
const spriteResult = await downloadSprites(
  [
    'https://example.com/sprite.json',
    'https://example.com/sprite.png',
    'https://example.com/sprite@2x.json',
    'https://example.com/sprite@2x.png',
  ],
  {
    skipExisting: true,
    maxRetries: 3,
  }
);
```

### Advanced Analytics & Monitoring

````typescript
// Get comprehensive storage analytics
const analytics = await getComprehensiveStorageAnalytics();
console.log(`Total storage used: ${analytics.totalStorageSize} bytes`);
console.log(`Tiles: ${analytics.tiles.count} tiles, ${analytics.tiles.totalSize} bytes`);
console.log(`Fonts: ${analytics.fonts.count} fonts, ${analytics.fonts.totalSize} bytes`);
console.log(`Glyphs: ${analytics.glyphs.count} glyphs, ${analytics.glyphs.totalSize} bytes`);
console.log(`Sprites: ${analytics.sprites.count} sprites, ${analytics.sprites.totalSize} bytes`);
console.log(`Storage recommendations:`, analytics.recommendations);

// Get specific analytics for different components
const glyphStats = await getGlyphStats();
console.log(`Glyph fonts by stack:`, glyphStats.fontsByStack);
console.log(`Glyph size by stack:`, glyphStats.sizeByStack);

const fontStats = await getFontStats();
console.log(`Font types:`, fontStats.fontsByType);
console.log(`Corrupted fonts:`, fontStats.corruptedFonts);

const tileStats = await getAllTileStats();
console.log(`Zoom level distribution:`, tileStats.zoomLevelStats);
console.log(`Oldest tile:`, tileStats.oldestTile);
console.log(`Newest tile:`, tileStats.newestTile);

const styleStats = await getStyleStats();
console.log(`Total styles:`, styleStats.count);
console.log(`Source types:`, styleStats.sourceTypes);
console.log(`Layer types:`, styleStats.layerTypes);
({}, {
  skipExisting: true,
  maxRetries: 3
});

// Advanced import/export operations
import { ImportExportService } from 'map-gl-offline';

const importExportService = new ImportExportService();

// Direct export operations with full control
const exportResult = await importExportService.exportRegionAsJSON('region-id', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: false, // Skip sprites to reduce file size
  includeFonts: true,
  onProgress: (progress) => {
    console.log(`Export Stage: ${progress.stage}`);
    console.log(`Progress: ${progress.percentage}%`);
    if (progress.currentItem) {
      console.log(`Current: ${progress.currentItem}`);
    }
  }
});

// Handle export result
if (exportResult.success) {
  console.log(`Export completed: ${exportResult.filename}`);
  console.log(`File size: ${exportResult.size} bytes`);
  console.log(`Statistics:`, exportResult.statistics);

  // Save or process the blob
  const url = URL.createObjectURL(exportResult.blob);
  // ... handle download
} else {
  console.error('Export failed');
}
````

### Advanced Analytics & Monitoring

```typescript
// Get comprehensive storage analytics
const analytics = await getComprehensiveStorageAnalytics();
console.log(`Total storage used: ${analytics.totalStorageSize} bytes`);
console.log(`Tiles: ${analytics.tiles.count} tiles, ${analytics.tiles.totalSize} bytes`);
console.log(`Fonts: ${analytics.fonts.count} fonts, ${analytics.fonts.totalSize} bytes`);
console.log(`Glyphs: ${analytics.glyphs.count} glyphs, ${analytics.glyphs.totalSize} bytes`);
console.log(`Sprites: ${analytics.sprites.count} sprites, ${analytics.sprites.totalSize} bytes`);
```

### Cleanup and Maintenance

```typescript
import {
  cleanupOldTiles,
  cleanupOldFonts,
  cleanupOldSprites,
  verifyAndRepairTiles,
  verifyAndRepairFonts,
  verifyAndRepairSprites,
} from 'map-gl-offline';

// Comprehensive cleanup with options
const tileCleanup = await cleanupOldTiles(7 * 24 * 60 * 60 * 1000); // 7 days
console.log(`Cleaned up ${tileCleanup} old tiles`);

const fontCleanup = await cleanupOldFonts(30); // 30 days
console.log(`Cleaned up ${fontCleanup} old fonts`);

const spriteCleanup = await cleanupOldSprites(30); // 30 days
console.log(`Cleaned up ${spriteCleanup} old sprites`);

// Verification and repair operations
const tileVerification = await verifyAndRepairTiles();
console.log(
  `Tiles: ${tileVerification.validTiles} valid, ${tileVerification.corruptedTiles} corrupted, ${tileVerification.repairedTiles} repaired`
);

const fontVerification = await verifyAndRepairFonts();
console.log(
  `Fonts: ${fontVerification.validFonts} valid, ${fontVerification.corruptedFonts} corrupted`
);

// Style management
import { cleanupOldStyles, verifyAndValidateStyles } from 'map-gl-offline';

const styleCleanup = await cleanupOldStyles({
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  maxCount: 10, // Keep max 10 styles
  keepIds: ['important-style-1', 'important-style-2'], // Never delete these
  onProgress: progress => console.log(`Cleanup progress: ${progress.completed}/${progress.total}`),
});

const styleVerification = await verifyAndValidateStyles({
  autoRepair: true,
  onProgress: progress =>
    console.log(`Verification progress: ${progress.completed}/${progress.total}`),
});
```

## 📚 API Reference

### OfflineMapManager

The main class for managing offline maps.

#### Methods

- `addRegion(options)` - Download and store a map region
- `getRegion(id)` - Retrieve a stored region
- `deleteRegion(id)` - Delete a specific region
- `listRegions()` - List all stored regions
- `getComprehensiveStorageAnalytics()` - Get detailed storage analytics
- `cleanupExpiredRegions()` - Clean up expired regions
- `startAutoCleanup(options)` - Start automatic cleanup

#### Import/Export Methods

- `exportRegionAsJSON(regionId, options?)` - Export region to JSON format
- `exportRegionAsPMTiles(regionId, options?)` - Export region to PMTiles format
- `exportRegionAsMBTiles(regionId, options?)` - Export region to MBTiles format
- `importRegion(importData)` - Import region from file (JSON, PMTiles, or MBTiles)

### Analytics Methods

- `getGlyphAnalytics(styleId?)` - Get glyph analytics (global or per-style)
- `getFontAnalytics()` - Get font analytics across all styles
- `getAllTileStats()` - Get tile storage statistics
- `getStyleAnalytics()` - Get style analytics and recommendations

## 🔧 Configuration Options

### Region Download Options

```typescript
interface OfflineRegionOptions {
  id: string;
  name?: string;
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  styleUrl: string;
  tileOptions?: {
    maxConcurrency?: number;
    retries?: number;
    timeout?: number;
  };
  fontOptions?: {
    maxConcurrency?: number;
    includeMetadata?: boolean;
  };
  spriteOptions?: {
    retries?: number;
    timeout?: number;
  };
  onProgress?: (progress: DownloadProgress) => void;
  expiresAt?: number;
  autoDelete?: boolean;
}
```

### Import/Export Options

```typescript
interface ImportExportOptions {
  includeStyle?: boolean; // Include style data (default: true)
  includeTiles?: boolean; // Include tile data (default: true)
  includeSprites?: boolean; // Include sprite data (default: true)
  includeFonts?: boolean; // Include font data (default: true)
  format?: 'json' | 'pmtiles' | 'mbtiles';
  compression?: boolean; // Enable compression
  onProgress?: (progress: ImportExportProgress) => void;
}

interface RegionImportData {
  file: File; // File to import
  format: 'json' | 'pmtiles' | 'mbtiles';
  overwrite?: boolean; // Overwrite existing region
  newRegionId?: string; // New region ID (optional)
  newRegionName?: string; // New region name (optional)
}

interface PMTilesExportOptions {
  compression?: 'gzip' | 'brotli' | 'none';
  clustered?: boolean;
  metadata?: Record<string, any>;
}

interface MBTilesExportOptions {
  format?: 'pbf' | 'png' | 'jpg';
  compression?: 'gzip' | 'none';
  metadata?: Record<string, any>;
}
```

### Cleanup Options

```typescript
interface CleanupOptions {
  maxAge?: number; // Max age in milliseconds
  maxCount?: number; // Max number of regions to keep
  maxSize?: number; // Max total size in bytes
  keepIds?: string[]; // Region IDs to always preserve
  onProgress?: (progress) => void;
}
```

## 🎯 Use Cases

- **Offline Map Applications**: Build apps that work without internet connectivity
- **Field Data Collection**: Collect data in remote areas without network access
- **Emergency Response**: Ensure map access during network outages
- **Bandwidth Optimization**: Reduce data usage by pre-downloading maps
- **Performance Enhancement**: Faster map loading with pre-cached tiles
- **Data Portability**: Transfer offline maps between devices and applications
- **Backup & Archive**: Create backup copies of critical map regions
- **Multi-Platform Deployment**: Export maps for use across different mapping platforms
- **Content Distribution**: Package and distribute map data for offline applications

## 💡 Best Practices

### Performance Optimization

```typescript
// Use appropriate zoom levels to balance quality vs storage
const region = {
  bounds: [
    [-74.0559, 40.7128],
    [-74.0059, 40.7628],
  ],
  minZoom: 10, // Don't go too low (increases tile count exponentially)
  maxZoom: 16, // Don't go too high (diminishing returns)
  // ... other options
};

// Configure concurrent downloads based on device capabilities
const options = {
  maxConcurrency: navigator.hardwareConcurrency || 4,
  batchSize: 20,
  // ... other options
};

// Monitor storage usage
const analytics = await offlineManager.getComprehensiveStorageAnalytics();
if (analytics.totalStorageSize > 500 * 1024 * 1024) {
  // 500MB
  console.warn('High storage usage detected');
  // Consider cleanup or user notification
}
```

### Error Handling

```typescript
try {
  const result = await offlineManager.addRegion(regionOptions);
} catch (error) {
  if (error.message.includes('storage')) {
    // Handle storage quota exceeded
    console.error('Storage quota exceeded. Consider cleanup.');
    await offlineManager.cleanupExpiredRegions();
  } else if (error.message.includes('network')) {
    // Handle network errors
    console.error('Network error. Check connectivity.');
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Import/Export Best Practices

```typescript
// For large regions, export in chunks or exclude heavy data
const lightExport = await offlineManager.exportRegionAsJSON('region-id', {
  includeTiles: false, // Skip tiles for faster export
  includeStyle: true,
  includeSprites: true,
  includeFonts: true,
});

// Use PMTiles for web deployment
const webExport = await offlineManager.exportRegionAsPMTiles('region-id', {
  compression: 'gzip',
  metadata: {
    attribution: 'Your attribution',
    version: '1.0',
  },
});

// Always handle import errors gracefully
const importResult = await offlineManager.importRegion(importData);
if (!importResult.success) {
  console.error('Import failed:', importResult.message);
  // Show user-friendly error message
}
```

## 🔧 Troubleshooting

### Common Issues

**Storage Quota Exceeded**

```typescript
// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate();
  console.log(`Used: ${estimate.usage}, Available: ${estimate.quota}`);
}

// Clean up old data
await offlineManager.cleanupExpiredRegions();
```

**Import/Export Failures**

```typescript
// Verify file format
const fileExtension = file.name.split('.').pop();
const expectedFormats = ['json', 'pmtiles', 'mbtiles'];
if (!expectedFormats.includes(fileExtension)) {
  throw new Error(`Unsupported file format: ${fileExtension}`);
}

// Check file size before import
if (file.size > 100 * 1024 * 1024) {
  // 100MB
  console.warn('Large file detected. Import may take time.');
}
```

**Performance Issues**

```typescript
// Reduce concurrent downloads for slower devices
const options = {
  maxConcurrency: 2, // Reduce from default
  batchSize: 10, // Smaller batches
  timeout: 30000, // Increase timeout
};

// Use priority zoom levels for progressive loading
const progressiveOptions = {
  priorityZoomLevels: [12, 13, 11, 14, 10, 15, 16],
  // ... other options
};
```

## 🤝 Browser Compatibility

- Chrome 51+
- Firefox 45+
- Safari 10+
- Edge 79+
- Mobile browsers with IndexedDB support

## 📄 License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/muimsd/map-gl-offline.git
cd map-gl-offline

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the library
pnpm build

# Run example
cd examples/maplibre
pnpm install
pnpm dev
```

## 📞 Support

- 🐛 [Report Issues](https://github.com/muimsd/map-gl-offline/issues)
- 💬 [Discussions](https://github.com/muimsd/map-gl-offline/discussions)
- 📚 [Documentation](https://github.com/muimsd/map-gl-offline/wiki)
- ⭐ [Feature Requests](https://github.com/muimsd/map-gl-offline/issues/new?template=feature_request.md)

## 🔄 Changelog

### Latest Features

- ✅ **Import/Export Support** - Export regions to JSON, PMTiles, and MBTiles formats
- ✅ **Enhanced Analytics** - Comprehensive storage analytics and optimization recommendations
- ✅ **Improved Error Handling** - Better error recovery and user feedback
- ✅ **Performance Optimizations** - Faster downloads and more efficient storage

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## 🙏 Acknowledgments

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) - Open-source map rendering engine
- [PMTiles](https://github.com/protomaps/PMTiles) - Cloud-optimized map tile format
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Browser storage API
- [Tilebelt](https://github.com/mapbox/tilebelt) - Tile coordinate utilities

## 📝 Tile Download Manager: Feature TODOs

- [ ] **Download Progress & Status**: Show real-time progress (tiles downloaded / total, percent complete), estimated time remaining, and indicate which zoom levels and sources are being downloaded.
- [ ] **Pause, Resume, and Cancel**: Allow users to pause/resume/cancel downloads and persist download state for resuming after reload.
- [ ] **Retry & Error Handling**: Automatically retry failed tile downloads, show a summary of failed/missing tiles, and allow retrying only those.
- [ ] **Storage Management**: Show storage usage by offline tiles and allow users to delete specific regions, zoom levels, or sources.
- [ ] **Coverage Visualization**: Display a map overlay showing offline coverage and highlight missing/incomplete areas.
- [ ] **Advanced Selection**: Let users select custom areas (draw polygon/rectangle) and zoom ranges for download; support multiple sources/layers in a single region.
- [ ] **Background/Batch Download**: Download tiles in the background with throttling and batch requests for efficiency.
- [ ] **Export/Import**: Allow users to export downloaded tiles/regions and import on another device.
- [ ] **Versioning & Updates**: Detect and update changed tiles/styles for a region and notify users of changes.
- [ ] **Offline Diagnostics**: Add a diagnostics panel to list missing tiles, corrupted entries, or storage issues, and provide a “verify offline coverage” tool.
