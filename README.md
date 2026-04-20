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
- 🧩 **Extra Tile Sources**: Save additional vector (MVT/PBF) and raster tile layers alongside the style's own sources
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

### CDN (UMD)

For use via `<script>` tag, the library is available as the `mapgloffline` global (similar to `mapboxgl` and `maplibregl`):

```html
<script src="https://unpkg.com/map-gl-offline/dist/index.umd.js"></script>
<link rel="stylesheet" href="https://unpkg.com/map-gl-offline/style.css" />
<script>
  const manager = new mapgloffline.OfflineMapManager();
  const control = new mapgloffline.OfflineManagerControl(manager, {
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  });
  map.addControl(control, 'top-right');
</script>
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
import 'map-gl-offline/style.css';

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

Mapbox GL JS v3 does not support `addProtocol`, so offline tile serving uses a **Service Worker** fallback. You need to copy `idb-offline-sw.js` to your project's public directory so it is served at the root (`/idb-offline-sw.js`).

**Option 1: CLI (recommended)**

```bash
npx map-gl-offline init
```

**Option 2: Vite plugin**

```js
// vite.config.js
import { offlineSwPlugin } from 'map-gl-offline/vite-plugin';

export default defineConfig({
  plugins: [offlineSwPlugin()],
});
```

**Option 3: Manual copy**

```bash
cp node_modules/map-gl-offline/dist/idb-offline-sw.js public/idb-offline-sw.js
```

```typescript
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-offline/style.css';

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
    // No mapLib needed - Mapbox GL JS v3 lacks addProtocol,
    // so the library auto-registers a Service Worker fallback
  });
  map.addControl(control, 'top-right');
});
```

> **Note:** MapLibre GL JS has built-in `addProtocol` support, so it does not need the Service Worker. Only Mapbox GL JS requires this extra step.

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

// Retrieve a stored region
const region = await offlineManager.getStoredRegion('downtown');
if (region) {
  console.log(`Region: ${region.name}, created: ${new Date(region.created).toLocaleDateString()}`);
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
// Clean up expired regions
const deletedCount = await offlineManager.cleanupExpiredRegions();
console.log(`Cleaned ${deletedCount} expired regions`);

// Verify and repair fonts
const verification = await offlineManager.verifyAndRepairFonts('style_123', { removeCorrupted: true });
console.log(`Verified: ${verification.verified}, Repaired: ${verification.repaired}, Removed: ${verification.removed}`);

// Set up automatic cleanup (runs every 24 hours)
const cleanupId = await offlineManager.setupAutoCleanup({
  intervalHours: 24,
  maxAge: 30, // days
});
```

## 📚 API Reference

### OfflineMapManager

Main class for managing offline maps.

**Constructor:**

```typescript
const manager = new OfflineMapManager(overrides?: OfflineManagerServiceOverrides);
```

The constructor accepts optional service overrides for dependency injection (advanced usage). For most cases, use the default: `new OfflineMapManager()`.

**Core Methods:**

- `addRegion(options: OfflineRegionOptions)` - Download and store a map region
- `getStoredRegion(id: string)` - Retrieve a stored region by ID
- `deleteRegion(id: string)` - Delete a specific region and its resources
- `listStoredRegions()` - List all stored regions with metadata
- `listRegions()` - List all region options

**Analytics Methods:**

- `getComprehensiveStorageAnalytics()` - Get detailed storage statistics
- `getRegionAnalytics()` - Get aggregate analytics across all regions
- `getTileStats(styleId?: string)` - Get tile statistics (optionally filtered by style)
- `getFontStats()` - Get font statistics
- `getSpriteStats()` - Get sprite statistics
- `getGlyphStats()` - Get glyph statistics

**Cleanup & Maintenance Methods:**

- `cleanupExpiredRegions()` - Remove regions past expiration date
- `performSmartCleanup(options)` - Intelligent cleanup with configurable criteria
- `cleanupOldFonts(styleId?, options?)` - Remove old font data
- `cleanupOldSprites(styleId?, options?)` - Remove old sprite data
- `cleanupOldGlyphs(styleId?, options?)` - Remove old glyph data
- `verifyAndRepairFonts(styleId, options?)` - Verify font integrity
- `verifyAndRepairSprites(styleId, options?)` - Verify sprite integrity
- `verifyAndRepairGlyphs(styleId, options?)` - Verify glyph integrity
- `setupAutoCleanup(options)` - Enable automatic periodic cleanup
- `stopAutoCleanup(cleanupId?)` - Disable a specific auto-cleanup
- `stopAllAutoCleanup()` - Disable all auto-cleanups
- `performCompleteMaintenance(options?)` - Run comprehensive maintenance

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
  name: string; // Human-readable name (required)
  bounds: [[number, number], [number, number]]; // [[lng, lat], [lng, lat]]
  minZoom: number; // Minimum zoom level (e.g., 10)
  maxZoom: number; // Maximum zoom level (e.g., 16)
  styleUrl?: string; // Map style URL
  expiry?: number; // Expiration timestamp (ms since epoch)
  deleteOnExpiry?: boolean; // Auto-delete on expiration
  multipleRegions?: boolean; // Part of a multi-region download
  tileExtension?: string; // Tile extension (pbf, mvt, png, etc.)
  extraSources?: ExtraSource[]; // Additional tile sources to download alongside the style
}

interface ExtraSource {
  id: string; // Unique source identifier
  type?: 'vector' | 'raster' | 'raster-dem'; // Defaults to 'vector'
  tiles: string[]; // Tile URL templates with {z}/{x}/{y}
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
}
```

### Extra Tile Sources

Save additional vector or raster layers (e.g. custom overlays) alongside the style's own sources:

```typescript
await manager.addRegion({
  id: 'downtown',
  name: 'Downtown',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]],
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
  ],
});
```

When using the `OfflineManagerControl`, the region download form auto-discovers tile sources on the live map and shows them as checkboxes — users pick which extra layers to include.

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
  console.warn('High storage usage detected');
  await manager.performSmartCleanup({ maxStorageSize: 500 * 1024 * 1024 });
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

Contributions are welcome!

### Development Setup

```bash
# Clone repository
git clone https://github.com/muimsd/map-gl-offline.git
cd map-gl-offline

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build library
npm run build

# Run MapLibre example app
cd examples/maplibre
npm install
npm run dev
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
├── bin/                   # CLI (map-gl-offline init) & Vite plugin
├── examples/
│   ├── maplibre/          # MapLibre GL JS example app
│   └── mapbox-gl/         # Mapbox GL JS example app
├── docs/                  # Docusaurus documentation site
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

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

**v0.5.5 (Latest):** Extra tile source selection for offline regions — pick additional vector/raster layers to download alongside the style's own sources.

**v0.5.3:** 28% bundle size reduction (783 KB to 565 KB), 20+ bug fixes, XSS prevention, import atomicity, `@/` path alias for all imports.

**v0.5.2:** CLI command (`npx map-gl-offline init`), Vite plugin for Service Worker, Mapbox GL example app.

**v0.5.0:** Mapbox GL JS support, Standard style with 3D/terrain, day/night presets, rain/snow, i18n (English & Arabic with RTL).

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

<a href="https://www.buymeacoffee.com/muimsd" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

</div>
