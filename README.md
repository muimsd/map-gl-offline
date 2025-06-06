# Map GL Offline

[![npm version](https://badge.fury.io/js/map-gl-offline.svg)](https://badge.fury.io/js/map-gl-offline)
[![CI](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml/badge.svg)](https://github.com/muimsd/map-gl-offline/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/muimsd/map-gl-offline/branch/main/graph/badge.svg)](https://codecov.io/gh/muimsd/map-gl-offline)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive npm package for **Mapbox GL JS** and **MapLibre GL JS** that enables offline storage and usage of vector and raster tiles, sprites, styles, fonts (glyphs), and entire map regions with advanced analytics and management capabilities.

## ✨ Features

- 🗺️ **Complete Offline Maps**: Download and store entire map regions for offline use
- 🎯 **Smart Tile Management**: Efficient tile downloading, caching, and cleanup
- 🔤 **Font & Glyph Support**: Comprehensive font and glyph management with analytics
- 🎨 **Sprite Management**: Handle map sprites and icons offline
- 📊 **Advanced Analytics**: Detailed storage analytics and optimization recommendations
- 🧹 **Automatic Cleanup**: Smart cleanup of expired data with customizable policies
- 💾 **IndexedDB Storage**: Efficient browser storage with quota management
- 🔧 **TypeScript Support**: Full TypeScript definitions and type safety
- ⚡ **Performance Optimized**: Concurrent downloads with progress tracking
- 🛠️ **Developer Friendly**: Comprehensive API with extensive customization options

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
  }
});

// Use the offline region in your map
const region = await offlineManager.getRegion('my-region');
if (region) {
  // Apply offline style to your map
  map.setStyle(region.style);
}
```

### Advanced Analytics

```typescript
// Get comprehensive storage analytics
const analytics = await offlineManager.getComprehensiveStorageAnalytics();
console.log(`Total storage used: ${analytics.totalStorageSize} bytes`);
console.log(`Storage recommendations:`, analytics.recommendations);

// Get specific analytics for different components
const glyphAnalytics = await offlineManager.getGlyphAnalytics();
const fontAnalytics = await offlineManager.getFontAnalytics();
const tileStats = await offlineManager.getAllTileStats();
```

### Cleanup and Maintenance

```typescript
// Setup automatic cleanup (runs every hour by default)
const cleanupInterval = offlineManager.startAutoCleanup({
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  cleanupInterval: 60 * 60 * 1000   // 1 hour in milliseconds
});

// Manual cleanup
const cleanupResult = await offlineManager.cleanupExpiredRegions();
console.log(`Cleaned up ${cleanupResult} expired regions`);

// Stop automatic cleanup when needed
clearInterval(cleanupInterval);
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
