# Map GL Offline

[![npm version](https://badge.fury.io/js/map-gl-offline.svg)](https://badge.fury.io/js/map-gl-offline)
[![CI](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml/badge.svg)](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/muimsd/map-gl-offline/branch/main/graph/badge.svg)](https://codecov.io/gh/muimsd/map-gl-offline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **production-ready**, fully **TypeScript-compatible** npm package for **Mapbox GL JS** and **MapLibre GL JS** that enables comprehensive offline storage and usage of vector/raster tiles, sprites, styles, fonts (glyphs), and entire map regions with advanced analytics, intelligent cleanup, and robust error handling.



## ✨ Features

### 🎯 **Core Offline Capabilities**
- 🗺️ **Complete Offline Maps**: Download and store entire map regions for offline use
- 🎯 **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and cleanup with zoom-level optimization
- 🔤 **Advanced Font & Glyph Support**: Comprehensive font and glyph management with Unicode range analytics
- 🎨 **Sprite Management**: Handle map sprites and icons offline with multi-resolution support (@1x, @2x)
- 📊 **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations

### 🛠️ **Technical Excellence**
- 💾 **Modern IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- 🔧 **Full TypeScript Support**: Complete type definitions, interfaces, and compile-time safety
- ⚡ **Performance Optimized**: Concurrent downloads, modern async/await patterns, and memory-efficient operations
- 🧹 **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies and background processing
- 🔄 **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation

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

## 🚀 Quick Start

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
    [-74.0059, 40.7628]  // Northeast coordinates [lng, lat]
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11',
  onProgress: (progress) => {
    console.log(`Download progress: ${progress.percentage}%`);
    console.log(`Current: ${progress.message}`);
  }
});

// Use the offline region in your map
const region = await offlineManager.getRegion('my-region');
if (region) {
  // Apply offline style to your map
  map.setStyle(region.style);
}
```

### Service-Level Usage (Advanced)

```typescript
import { 
  downloadTiles, 
  downloadFonts, 
  downloadSprites, 
  downloadStyles,
  getComprehensiveStorageAnalytics 
} from 'map-gl-offline';

// Download tiles for a specific region
const tileResult = await downloadTiles(
  { bounds: [[-74.0559, 40.7128], [-74.0059, 40.7628]], minZoom: 10, maxZoom: 16 },
  styleData,
  'style-id',
  {
    onProgress: (progress) => console.log(`Tiles: ${progress.percentage}%`),
    batchSize: 10,
    maxRetries: 3
  }
);

// Download fonts with advanced options
const fontResult = await downloadFonts(
  ['https://fonts.example.com/font1.pbf', 'https://fonts.example.com/font2.pbf'],
  'download-id',
  {
    onProgress: (progress) => console.log(`Fonts: ${progress.percentage}%`),
    includeMetadata: true,
    maxConcurrency: 5
  }
);

// Download sprites (all resolutions)
const spriteResult = await downloadSprites([
  'https://example.com/sprite.json',
  'https://example.com/sprite.png',
  'https://example.com/sprite@2x.json',
  'https://example.com/sprite@2x.png'
], {
  skipExisting: true,
  maxRetries: 3
});
```

### Advanced Analytics & Monitoring

```typescript
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
```

### Cleanup and Maintenance

```typescript
import { 
  cleanupOldTiles, 
  cleanupOldFonts, 
  cleanupOldSprites,
  verifyAndRepairTiles,
  verifyAndRepairFonts,
  verifyAndRepairSprites
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
console.log(`Tiles: ${tileVerification.validTiles} valid, ${tileVerification.corruptedTiles} corrupted, ${tileVerification.repairedTiles} repaired`);

const fontVerification = await verifyAndRepairFonts();
console.log(`Fonts: ${fontVerification.validFonts} valid, ${fontVerification.corruptedFonts} corrupted`);

// Style management
import { cleanupOldStyles, verifyAndValidateStyles } from 'map-gl-offline';

const styleCleanup = await cleanupOldStyles({
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  maxCount: 10, // Keep max 10 styles
  keepIds: ['important-style-1', 'important-style-2'], // Never delete these
  onProgress: (progress) => console.log(`Cleanup progress: ${progress.completed}/${progress.total}`)
});

const styleVerification = await verifyAndValidateStyles({
  autoRepair: true,
  onProgress: (progress) => console.log(`Verification progress: ${progress.completed}/${progress.total}`)
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

### Cleanup Options

```typescript
interface CleanupOptions {
  maxAge?: number;          // Max age in milliseconds
  maxCount?: number;        // Max number of regions to keep
  maxSize?: number;         // Max total size in bytes
  keepIds?: string[];       // Region IDs to always preserve
  onProgress?: (progress) => void;
}
```

## 🎯 Use Cases

- **Offline Map Applications**: Build apps that work without internet connectivity
- **Field Data Collection**: Collect data in remote areas without network access
- **Emergency Response**: Ensure map access during network outages
- **Bandwidth Optimization**: Reduce data usage by pre-downloading maps
- **Performance Enhancement**: Faster map loading with pre-cached tiles

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

## 📞 Support

- 🐛 [Report Issues](https://github.com/muimsd/map-gl-offline/issues)
- 💬 [Discussions](https://github.com/muimsd/map-gl-offline/discussions)
- 📧 [Email Support](mailto:your-email@example.com)

## 🙏 Acknowledgments

- [Mapbox GL JS](https://github.com/mapbox/mapbox-gl-js)
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
