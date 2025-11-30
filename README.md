# Map GL Offline 🗺️

[![npm version](https://badge.fury.io/js/map-gl-offline.svg)](https://badge.fury.io/js/map-gl-offline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

> **⚠️ Development Notice**: This package is currently under active development and is optimized for **MapLibre GL JS**. Mapbox GL JS support is planned for future releases.

A comprehensive **TypeScript** library for **MapLibre GL JS** that enables complete offline map functionality with vector/raster tiles, styles, fonts, sprites, and glyphs stored in IndexedDB. Features include advanced analytics, import/export capabilities, intelligent cleanup, and a modern glassmorphic UI control.

## ✨ Features

### 🎯 Core Offline Capabilities

- 🗺️ **Complete Offline Maps**: Download and store entire map regions with polygon-based selection
- 🎯 **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and retrieval with zoom-level optimization
- 🔤 **Font & Glyph Support**: Comprehensive font and glyph management with Unicode range support
- 🎨 **Sprite Management**: Handle map sprites and icons offline with multi-resolution support (@1x, @2x)
- 📊 **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations
- 📤 **Import/Export**: Export regions to JSON, PMTiles, and MBTiles formats for data portability
- 🔄 **Data Portability**: Seamless transfer of offline maps between devices and applications

### 🎨 Modern UI Control

- 🖼️ **Glassmorphic Design**: Beautiful modern interface with glassmorphism effects and smooth animations
- 🌓 **Dark/Light Theme**: Automatic theme switching with system preference detection
- 📍 **Polygon Drawing**: Interactive polygon tool for precise region selection
- 📊 **Live Progress**: Real-time download progress with detailed statistics
- 🎯 **Region Management**: Easy-to-use interface for managing multiple offline regions
- ⚡ **Responsive**: Mobile-friendly design that adapts to all screen sizes

### 🛠️ Technical Excellence

- 💾 **IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- 🔧 **Full TypeScript**: Complete type definitions, interfaces, and compile-time safety
- ⚡ **Performance Optimized**: Concurrent downloads, async/await patterns, and memory-efficient operations
- 🧹 **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies
- 🔄 **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation
- 🗜️ **Multiple Formats**: Support for JSON, PMTiles, and MBTiles export/import
- 🔍 **Enhanced Logging**: Detailed debugging with zoom-level specific logging (Z12 tracking)

## 📦 Installation

```bash
npm install map-gl-offline
# or
yarn add map-gl-offline
# or
pnpm add map-gl-offline
```

## 🔑 Environment Setup

For development or when using Maptiler styles, create a `.env` file:

```env
VITE_MAPTILER_API_KEY=your_api_key_here
```

Get a free API key from [Maptiler](https://www.maptiler.com/).

## 🚀 Quick Start

### Basic Usage with UI Control

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css'; // Import UI styles

// Initialize map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY',
  center: [-74.006, 40.7128],
  zoom: 12,
});

// Add offline control to map
map.on('load', () => {
  const offlineControl = new OfflineManagerControl({
    position: 'top-right',
  });
  map.addControl(offlineControl);
});
```

The UI control provides:

- 📍 **Polygon drawing** for region selection
- 📊 **Download progress** tracking
- 🗂️ **Region management** (view, delete, export)
- 🌓 **Theme toggle** (dark/light mode)
- 📈 **Storage analytics**

### Programmatic Usage

```typescript
import { OfflineMapManager } from 'map-gl-offline';

// Initialize the offline manager
const offlineManager = new OfflineMapManager();

// Download a map region for offline use
await offlineManager.addRegion({
  id: 'downtown',
  name: 'Downtown Area',
  bounds: [
    [-74.0559, 40.7128], // Southwest [lng, lat]
    [-74.0059, 40.7628], // Northeast [lng, lat]
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  onProgress: progress => {
    console.log(`Progress: ${progress.percentage}%`);
    console.log(`Current: ${progress.message}`);
  },
});

// Retrieve and use stored region
const region = await offlineManager.getRegion('downtown');
if (region) {
  map.setStyle(region.offlineStyle); // Apply offline style
}

// List all regions
const regions = await offlineManager.listStoredRegions();
console.log(`Stored regions:`, regions);

// Delete a region
await offlineManager.deleteRegion('downtown');
```

### Import/Export Functionality

Export and import offline regions for backup, sharing, or cross-device usage:

```typescript
// Export region to JSON
const jsonExport = await offlineManager.exportRegionAsJSON('downtown', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
  onProgress: progress => {
    console.log(`Export: ${progress.percentage}% - ${progress.stage}`);
  },
});

// Download exported file
const url = URL.createObjectURL(jsonExport.blob);
const a = document.createElement('a');
a.href = url;
a.download = jsonExport.filename;
a.click();
URL.revokeObjectURL(url);

// Export to PMTiles (web-optimized format)
const pmtilesExport = await offlineManager.exportRegionAsPMTiles('downtown', {
  compression: 'gzip',
  metadata: { attribution: 'Custom map data', version: '1.0' },
});

// Export to MBTiles (SQLite-based, industry standard)
const mbtilesExport = await offlineManager.exportRegionAsMBTiles('downtown', {
  format: 'pbf',
  compression: 'gzip',
  metadata: { description: 'Offline map for mobile app' },
});

// Import region from file
const fileInput = document.querySelector('#fileInput');
fileInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (file) {
    const result = await offlineManager.importRegion({
      file,
      format: 'json', // or 'pmtiles', 'mbtiles'
      overwrite: true,
      newRegionId: 'imported-downtown',
      newRegionName: 'Imported Downtown',
    });

    if (result.success) {
      console.log(`Imported: ${result.regionId}`);
      console.log(`Stats:`, result.statistics);
    }
  }
});
```

**Export Format Comparison:**

| Format  | Best For                      | Pros                                     | Cons                   |
| ------- | ----------------------------- | ---------------------------------------- | ---------------------- |
| JSON    | Development, debugging        | Human-readable, easy to inspect          | Larger file size       |
| PMTiles | Web deployment, CDN           | Efficient HTTP range requests, optimized | Specialized format     |
| MBTiles | GIS tools, cross-platform use | SQLite-based, widely supported, mature   | Requires SQLite parser |

### Analytics & Monitoring

```typescript
// Get comprehensive storage analytics
const analytics = await offlineManager.getComprehensiveStorageAnalytics();
console.log(`Total storage: ${analytics.totalStorageSize} bytes`);
console.log(`Tiles: ${analytics.tiles.count} (${analytics.tiles.totalSize} bytes)`);
console.log(`Fonts: ${analytics.fonts.count} (${analytics.fonts.totalSize} bytes)`);
console.log(`Sprites: ${analytics.sprites.count} (${analytics.sprites.totalSize} bytes)`);
console.log(`Recommendations:`, analytics.recommendations);
```

### Cleanup & Maintenance

```typescript
// Clean up old tiles (7 days)
const tileCleanup = await offlineManager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000);
console.log(`Cleaned ${tileCleanup} old tiles`);

// Verify and repair tiles
const verification = await offlineManager.verifyAndRepairTiles();
console.log(`Valid: ${verification.validTiles}, Corrupted: ${verification.corruptedTiles}`);

// Start automatic cleanup
offlineManager.startAutoCleanup({
  interval: 24 * 60 * 60 * 1000, // Daily
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

## 📚 API Reference

### OfflineMapManager

Main class for managing offline maps.

**Constructor:**

```typescript
const manager = new OfflineMapManager(options?: {
  autoCleanup?: boolean;
  cleanupInterval?: number;
});
```

**Core Methods:**

- `addRegion(options: OfflineRegionOptions)` - Download and store a map region
- `getRegion(id: string)` - Retrieve a stored region by ID
- `deleteRegion(id: string)` - Delete a specific region and its resources
- `listStoredRegions()` - List all stored regions with metadata
- `updateRegion(id: string, updates: Partial<OfflineRegionOptions>)` - Update region settings

**Analytics Methods:**

- `getComprehensiveStorageAnalytics()` - Get detailed storage statistics
- `getRegionAnalytics(regionId: string)` - Get analytics for specific region
- `getTileStats()` - Get tile-specific statistics
- `getFontStats()` - Get font statistics
- `getSpriteStats()` - Get sprite statistics

**Import/Export Methods:**

- `exportRegionAsJSON(regionId: string, options?)` - Export to JSON format
- `exportRegionAsPMTiles(regionId: string, options?)` - Export to PMTiles format
- `exportRegionAsMBTiles(regionId: string, options?)` - Export to MBTiles format
- `importRegion(data: RegionImportData)` - Import from file (JSON/PMTiles/MBTiles)

**Maintenance Methods:**

- `cleanupOldTiles(maxAge: number)` - Remove tiles older than specified age
- `cleanupOldFonts(maxAge: number)` - Remove old font data
- `cleanupExpiredRegions()` - Remove regions past expiration date
- `verifyAndRepairTiles()` - Verify tile integrity and repair if possible
- `startAutoCleanup(options)` - Enable automatic cleanup
- `stopAutoCleanup()` - Disable automatic cleanup

### OfflineManagerControl

UI control for MapLibre GL with glassmorphic design.

**Constructor:**

```typescript
const control = new OfflineManagerControl({
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark' | 'auto';
});
```

**Features:**

- Interactive polygon drawing for region selection
- Real-time download progress tracking
- Region management (view, delete, export)
- Theme toggle (dark/light mode)
- Storage analytics display
- Responsive mobile-friendly design

## 🔧 Configuration Options

### OfflineRegionOptions

```typescript
interface OfflineRegionOptions {
  id: string; // Unique region identifier
  name?: string; // Human-readable name
  bounds: [[number, number], [number, number]]; // [[lng, lat], [lng, lat]]
  minZoom: number; // Minimum zoom level (e.g., 10)
  maxZoom: number; // Maximum zoom level (e.g., 16)
  styleUrl: string; // Map style URL
  onProgress?: (progress: ProgressInfo) => void; // Progress callback
  expiresAt?: number; // Expiration timestamp (ms)
  autoDelete?: boolean; // Auto-delete on expiration
}
```

### Import/Export Options

```typescript
interface ExportOptions {
  includeStyle?: boolean; // Include style data (default: true)
  includeTiles?: boolean; // Include tiles (default: true)
  includeSprites?: boolean; // Include sprites (default: true)
  includeFonts?: boolean; // Include fonts (default: true)
  onProgress?: (progress: ExportProgress) => void;
}

interface PMTilesExportOptions extends ExportOptions {
  compression?: 'gzip' | 'brotli' | 'none';
  clustered?: boolean;
  metadata?: Record<string, any>;
}

interface MBTilesExportOptions extends ExportOptions {
  format?: 'pbf' | 'png' | 'jpg';
  compression?: 'gzip' | 'none';
  metadata?: Record<string, any>;
}

interface RegionImportData {
  file: File;
  format: 'json' | 'pmtiles' | 'mbtiles';
  overwrite?: boolean;
  newRegionId?: string;
  newRegionName?: string;
}
```

## 🎯 Use Cases

- 🏔️ **Outdoor & Recreation Apps**: Hiking, camping, and adventure apps with offline trail maps
- 📱 **Field Data Collection**: Survey and data collection in remote areas
- 🚨 **Emergency Response**: Critical map access during network outages
- ✈️ **Travel Apps**: Tourist apps with offline city maps
- 🚗 **Fleet Management**: Vehicle tracking with offline map fallback
- 📊 **Asset Management**: Field service apps with offline capability
- 🎓 **Educational Apps**: Geography and learning apps with downloadable maps
- 🏗️ **Construction & Engineering**: Site management with offline blueprints
- 💾 **Bandwidth Optimization**: Reduce data costs by pre-downloading maps
- 🔄 **Multi-Device Sync**: Share offline maps across devices and platforms

## 💡 Best Practices

### Performance Optimization

```typescript
// Balance quality vs storage with appropriate zoom levels
const region = {
  minZoom: 10, // Don't go too low (tile count grows exponentially)
  maxZoom: 16, // Don't go too high (diminishing returns)
  bounds: [
    /* ... */
  ],
};

// Monitor storage usage
const analytics = await manager.getComprehensiveStorageAnalytics();
if (analytics.totalStorageSize > 500 * 1024 * 1024) {
  // 500MB
  console.warn('High storage usage detected');
  await manager.cleanupExpiredRegions();
}

// Use progressive loading for better UX
const progressiveDownload = {
  priorityZoomLevels: [12, 13, 11, 14, 10, 15, 16],
  onProgress: p => updateUI(p),
};
```

### Error Handling

```typescript
try {
  await manager.addRegion(regionOptions);
} catch (error) {
  if (error.message.includes('quota')) {
    console.error('Storage quota exceeded');
    await manager.cleanupExpiredRegions();
  } else if (error.message.includes('network')) {
    console.error('Network error. Retrying...');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Storage Management

```typescript
// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Used: ${usage} / ${quota} bytes`);
}

// Regular cleanup
await manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000); // 7 days

// Auto-cleanup on startup
manager.startAutoCleanup({
  interval: 24 * 60 * 60 * 1000, // Daily
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

## 🔍 Troubleshooting

### Storage Quota Issues

```typescript
// Check quota
const { usage, quota } = await navigator.storage.estimate();
if (usage / quota > 0.9) {
  await manager.cleanupExpiredRegions();
}

// Request persistent storage
if (navigator.storage?.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`Persistent storage: ${isPersisted}`);
}
```

### Import/Export Issues

```typescript
// Validate file before import
const validFormats = ['json', 'pmtiles', 'mbtiles'];
const ext = file.name.split('.').pop();
if (!validFormats.includes(ext)) {
  throw new Error(`Unsupported format: ${ext}`);
}

// Handle large files
if (file.size > 100 * 1024 * 1024) {
  // 100MB
  console.warn('Large file - import may take time');
}
```

### Performance Issues

```typescript
// Reduce concurrency for slower devices
const lightOptions = {
  maxConcurrency: 2,
  batchSize: 10,
  timeout: 30000,
};

// Use smaller regions
const smallerRegion = {
  minZoom: 11, // Start at higher zoom
  maxZoom: 15, // End at lower zoom
};
```

## 🌐 Browser Compatibility

| Browser | Version | Support |
| ------- | ------- | ------- |
| Chrome  | 51+     | ✅      |
| Firefox | 45+     | ✅      |
| Safari  | 10+     | ✅      |
| Edge    | 79+     | ✅      |
| Mobile  | Modern  | ✅      |

**Requirements:**

- IndexedDB support
- ES2015+ JavaScript
- Async/await support
- Web Workers (optional, for background tasks)

## 📄 License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/muimsd/map-gl-offline.git
cd map-gl-offline

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Build library
pnpm build

# Run example app
cd examples/maplibre
pnpm install
pnpm dev
```

### Project Structure

```
map-gl-offline/
├── src/
│   ├── managers/          # Core offline manager
│   ├── services/          # Tile, font, sprite services
│   ├── storage/           # IndexedDB management
│   ├── ui/                # UI components & controls
│   ├── utils/             # Utilities & helpers
│   └── types/             # TypeScript definitions
├── examples/
│   └── maplibre/          # Live example app
└── tests/                 # Test suites
```

## 📞 Support & Links

- 🐛 [Report Issues](https://github.com/muimsd/map-gl-offline/issues)
- 💬 [Discussions](https://github.com/muimsd/map-gl-offline/discussions)
- 📚 [Documentation](https://github.com/muimsd/map-gl-offline)
- ⭐ [Feature Requests](https://github.com/muimsd/map-gl-offline/issues/new)
- 🌟 [Star on GitHub](https://github.com/muimsd/map-gl-offline)

## 🔄 Recent Updates

### v0.1.0 (Latest)

- ✅ **Fractional Zoom Fix**: Fixed tile loading at fractional zoom levels
- ✅ **Modern UI**: Glassmorphic design with dark/light theme
- ✅ **Polygon Drawing**: Interactive region selection tool
- ✅ **Import/Export**: JSON, PMTiles, and MBTiles support
- ✅ **Enhanced Analytics**: Comprehensive storage insights
- ✅ **Performance**: Optimized downloads and memory usage
- ✅ **TypeScript**: Full type safety throughout

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## 🙏 Acknowledgments

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) - Open-source map rendering engine
- [PMTiles](https://github.com/protomaps/PMTiles) - Cloud-optimized map tile format
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Browser storage API
- [Tilebelt](https://github.com/mapbox/tilebelt) - Tile coordinate utilities

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📄 License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)

---

<div align="center">

**Made with ❤️ for the mapping community**

[⭐ Star on GitHub](https://github.com/muimsd/map-gl-offline) • [📖 Documentation](https://github.com/muimsd/map-gl-offline) • [🐛 Report Bug](https://github.com/muimsd/map-gl-offline/issues)

</div>
