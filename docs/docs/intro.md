---
sidebar_position: 1
slug: /
---

# map-gl-offline

A comprehensive **TypeScript** library for **MapLibre GL JS** that enables complete offline map functionality.

## Features

### Core Offline Capabilities

- **Complete Offline Maps** - Download and store entire map regions with polygon-based selection
- **Smart Tile Management** - Efficient vector/raster tile downloading, caching, and retrieval
- **Font & Glyph Support** - Comprehensive font and glyph management with Unicode range support
- **Sprite Management** - Handle map sprites and icons offline with multi-resolution support
- **Real-time Analytics** - Detailed storage analytics and optimization recommendations
- **Import/Export** - Export regions to JSON, PMTiles, and MBTiles formats

### Modern UI Control

- **Glassmorphic Design** - Beautiful modern interface with smooth animations
- **Dark/Light Theme** - Automatic theme switching with system preference detection
- **Polygon Drawing** - Interactive polygon tool for precise region selection
- **Live Progress** - Real-time download progress with detailed statistics
- **Responsive** - Mobile-friendly design that adapts to all screen sizes

### Technical Excellence

- **IndexedDB Storage** - Efficient browser storage with quota management
- **Full TypeScript** - Complete type definitions and compile-time safety
- **Performance Optimized** - Concurrent downloads and memory-efficient operations
- **Robust Error Handling** - Comprehensive error recovery and retry mechanisms

## Quick Start

```bash
npm install map-gl-offline
```

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  center: [-74.006, 40.7128],
  zoom: 12,
});

const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const control = new OfflineManagerControl(offlineManager, {
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  });
  map.addControl(control, 'top-right');
});
```

## Use Cases

- **Outdoor & Recreation Apps** - Hiking, camping, and adventure apps with offline trail maps
- **Field Data Collection** - Survey and data collection in remote areas
- **Emergency Response** - Critical map access during network outages
- **Travel Apps** - Tourist apps with offline city maps
- **Fleet Management** - Vehicle tracking with offline map fallback

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 51+     | ✅ |
| Firefox | 45+     | ✅ |
| Safari  | 10+     | ✅ |
| Edge    | 79+     | ✅ |
| Mobile  | Modern  | ✅ |

## License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)
