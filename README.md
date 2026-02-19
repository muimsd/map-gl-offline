# Map GL Offline 🗺️

[![npm version](https://badge.fury.io/js/map-gl-offline.svg)](https://badge.fury.io/js/map-gl-offline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

**[Documentation](https://map-gl-offline.netlify.app)** | **[Live Demo](https://map-gl-offline-demo.netlify.app)**

A comprehensive **TypeScript** library for **MapLibre GL JS** and **Mapbox GL JS** that enables complete offline map functionality with vector/raster tiles, styles, fonts, sprites, and glyphs stored in IndexedDB. Features include Mapbox Standard style support, advanced analytics, intelligent cleanup, i18n (English & Arabic with RTL), and a modern glassmorphic UI control.

## 🎬 Demo

![Map GL Offline Demo](assets/map-gl-offline-demo.gif)

*Download regions, load offline styles, and navigate maps without an internet connection.*

## ✨ Features

### 🎯 Core Offline Capabilities

- 🗺️ **Complete Offline Maps**: Download and store entire map regions with polygon-based selection
- 🎯 **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and retrieval with zoom-level optimization
- 🔤 **Font & Glyph Support**: Comprehensive font and glyph management with Unicode range support
- 🎨 **Sprite Management**: Handle map sprites and icons offline with multi-resolution support (@1x, @2x)
- 📊 **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations

### 🌐 Mapbox GL JS Support

- 🔗 **mapbox:// Protocol Resolution**: Automatic resolution of `mapbox://` style, source, sprite, and glyph URLs
- 🏙️ **Mapbox Standard Style**: Full support including 3D models, raster-dem terrain, and import-based style resolution
- 🌅 **Day/Night Light Presets**: Toggle between day and night lighting in Mapbox Standard style
- 🌧️ **Weather Controls**: Rain and snow effects for Mapbox Standard style
- 🔍 **Auto-detection**: Automatically detects whether a style is Mapbox or MapLibre and applies the correct handling

### 🎨 Modern UI Control

- 🖼️ **Glassmorphic Design**: Beautiful modern interface with glassmorphism effects and smooth animations
- 🌓 **Dark/Light Theme**: Automatic theme switching with system preference detection
- 📍 **Polygon Drawing**: Interactive polygon tool for precise region selection
- 📊 **Live Progress**: Real-time download progress with detailed statistics
- 🎯 **Region Management**: Easy-to-use interface for managing multiple offline regions
- ⚡ **Responsive**: Mobile-friendly design that adapts to all screen sizes
- 🌍 **Internationalization**: English and Arabic language support with full RTL layout

### 🛠️ Technical Excellence

- 💾 **IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- 🔧 **Full TypeScript**: Complete type definitions, interfaces, and compile-time safety
- ⚡ **Performance Optimized**: Concurrent downloads, async/await patterns, and memory-efficient operations
- 🧹 **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies
- 🔄 **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation
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

For Mapbox styles, you will also need a Mapbox access token from [Mapbox](https://www.mapbox.com/).

## 🚀 Quick Start

### MapLibre GL JS

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css';

const styleUrl = 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY';

const map = new maplibregl.Map({
  container: 'map',
  style: styleUrl,
  center: [-74.006, 40.7128],
  zoom: 12,
});

const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const control = new OfflineManagerControl(offlineManager, {
    styleUrl,
    theme: 'dark',
    showBbox: true,
    mapLib: maplibregl, // enables idb:// protocol in web workers
  });
  map.addControl(control, 'top-right');
});
```

### Mapbox GL JS

```typescript
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-offline/dist/style.css';

mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [-74.006, 40.7128],
  zoom: 12,
});

const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const control = new OfflineManagerControl(offlineManager, {
    styleUrl: 'mapbox://styles/mapbox/standard',
    theme: 'dark',
    showBbox: true,
    accessToken: mapboxgl.accessToken,
  });
  map.addControl(control, 'top-right');
});
```

The UI control provides:

- 📍 **Polygon drawing** for region selection
- 📊 **Download progress** tracking
- 🗂️ **Region management** (view, delete)
- 🌓 **Theme toggle** (dark/light mode)
- 📈 **Storage analytics**
- 🌍 **Language switcher** (English / Arabic with RTL)

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

**Maintenance Methods:**

- `cleanupOldTiles(maxAge: number)` - Remove tiles older than specified age
- `cleanupOldFonts(maxAge: number)` - Remove old font data
- `cleanupExpiredRegions()` - Remove regions past expiration date
- `verifyAndRepairTiles()` - Verify tile integrity and repair if possible
- `startAutoCleanup(options)` - Enable automatic cleanup
- `stopAutoCleanup()` - Disable automatic cleanup

### OfflineManagerControl

UI control for MapLibre GL JS and Mapbox GL JS with glassmorphic design.

**Constructor:**

```typescript
const offlineManager = new OfflineMapManager();

const control = new OfflineManagerControl(offlineManager, {
  styleUrl: 'https://example.com/style.json', // Map style URL (required)
  theme?: 'light' | 'dark',                   // UI theme (default: 'dark')
  showBbox?: boolean,                          // Show region bounding boxes (default: false)
  accessToken?: string,                        // Mapbox access token (for mapbox:// URLs)
  mapLib?: MapLibProtocol,                     // Map library module (e.g. maplibregl) for idb:// protocol
});
```

**Features:**

- Interactive polygon drawing for region selection
- Real-time download progress tracking
- Region management (view, delete)
- Theme toggle (dark/light mode)
- Storage analytics display
- Language switcher (English / Arabic with RTL support)
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
│   │   └── translations/  # i18n (English, Arabic)
│   ├── utils/             # Utilities & helpers
│   └── types/             # TypeScript definitions
├── examples/
│   └── maplibre/          # Live example app
└── tests/                 # Test suites
```

## 📞 Support & Links

- 📚 [Documentation](https://map-gl-offline.netlify.app)
- 🎮 [Live Demo](https://map-gl-offline-demo.netlify.app)
- 🐛 [Report Issues](https://github.com/muimsd/map-gl-offline/issues)
- 💬 [Discussions](https://github.com/muimsd/map-gl-offline/discussions)
- ⭐ [Feature Requests](https://github.com/muimsd/map-gl-offline/issues/new)
- 🌟 [Star on GitHub](https://github.com/muimsd/map-gl-offline)

## 🔄 Recent Updates

### v0.2.0 (Latest)

- ✅ **Mapbox GL JS Support**: Full support for Mapbox styles, including `mapbox://` protocol URL resolution
- ✅ **Mapbox Standard Style**: 3D models, raster-dem terrain, and import-based style resolution
- ✅ **Day/Night Light Presets**: Toggle between day and night lighting for Mapbox Standard
- ✅ **Rain & Snow Weather**: Weather effect controls for Mapbox Standard style
- ✅ **Import Resolver**: Automatic resolution of Mapbox Standard `imports` in styles
- ✅ **Internationalization**: English and Arabic language support with full RTL layout
- ✅ **Auto-detection**: Automatically detects Mapbox vs MapLibre styles

### v0.1.0

- ✅ **Fractional Zoom Fix**: Fixed tile loading at fractional zoom levels
- ✅ **Modern UI**: Glassmorphic design with dark/light theme
- ✅ **Polygon Drawing**: Interactive region selection tool
- ✅ **Enhanced Analytics**: Comprehensive storage insights
- ✅ **Performance**: Optimized downloads and memory usage
- ✅ **TypeScript**: Full type safety throughout

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## 🙏 Acknowledgments

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) - Open-source map rendering engine
- [Mapbox GL JS](https://github.com/mapbox/mapbox-gl-js) - Commercial map rendering engine
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Browser storage API
- [Tilebelt](https://github.com/mapbox/tilebelt) - Tile coordinate utilities
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📄 License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)

---

<div align="center">

**Made with ❤️ for the mapping community**

[📖 Documentation](https://map-gl-offline.netlify.app) • [🎮 Live Demo](https://map-gl-offline-demo.netlify.app) • [⭐ Star on GitHub](https://github.com/muimsd/map-gl-offline)

</div>
