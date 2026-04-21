---
sidebar_position: 1
slug: /
---

# map-gl-offline

**[Live Demo](https://map-gl-offline-demo.netlify.app)** | **[GitHub](https://github.com/muimsd/map-gl-offline)** | **[npm](https://www.npmjs.com/package/map-gl-offline)**

A comprehensive **TypeScript** library for **MapLibre GL JS** and **Mapbox GL JS** that enables complete offline map functionality.

## Features

### Core Offline Capabilities

- **Complete Offline Maps** - Download and store entire map regions with polygon-based selection
- **Smart Tile Management** - Efficient vector/raster tile downloading, caching, and retrieval
- **Extra Layer Support** - Save additional vector (MVT/PBF) and raster tile sources alongside the style
- **Font & Glyph Support** - Comprehensive font and glyph management with Unicode range support
- **Sprite Management** - Handle map sprites and icons offline with multi-resolution support
- **Real-time Analytics** - Detailed storage analytics and optimization recommendations
- **Import/Export** - Export regions to JSON, PMTiles, and MBTiles formats

### Map Library Support

- **MapLibre GL JS** - Full support with `addProtocol` for seamless `idb://` tile serving
- **Mapbox GL JS** - Full support via Service Worker for offline tile serving, including Mapbox Standard style, 3D models, and weather controls (rain/snow, day/night lighting)

### Modern UI Control

- **Glassmorphic Design** - Beautiful modern interface with smooth animations
- **Dark/Light Theme** - Automatic theme switching with system preference detection
- **Polygon Drawing** - Interactive polygon tool for precise region selection
- **Live Progress** - Real-time download progress with detailed statistics
- **Responsive** - Mobile-friendly design that adapts to all screen sizes
- **i18n & RTL** - Built-in internationalization with English and Arabic, including full RTL layout support

### Technical Excellence

- **IndexedDB Storage** - Efficient browser storage with quota management
- **Full TypeScript** - Complete type definitions and compile-time safety
- **Performance Optimized** - Concurrent downloads and memory-efficient operations
- **Robust Error Handling** - Comprehensive error recovery and retry mechanisms

## Quick Start

```bash
npm install map-gl-offline
```

### CDN (UMD)

```html
<script src="https://unpkg.com/map-gl-offline/dist/index.umd.js"></script>
<link rel="stylesheet" href="https://unpkg.com/map-gl-offline/style.css" />
<script>
  const manager = new mapgloffline.OfflineMapManager();
</script>
```

### MapLibre GL JS

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/style.css';

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
    mapLib: maplibregl, // enables idb:// protocol in web workers
  });
  map.addControl(control, 'top-right');
});
```

### Mapbox GL JS

Mapbox GL JS v3 requires a Service Worker for offline tile serving. Set it up using one of these methods:

```bash
# CLI (recommended)
npx map-gl-offline init
```

Or use the Vite plugin to auto-copy on each build:

```js
// vite.config.js
import { offlineSwPlugin } from 'map-gl-offline/vite-plugin';

export default defineConfig({
  plugins: [offlineSwPlugin()],
});
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
    accessToken: mapboxgl.accessToken,
  });
  map.addControl(control, 'top-right');
});
```

:::tip
When using MapLibre, pass `mapLib: maplibregl` in the control options to register the `idb://` protocol in web workers. For Mapbox GL JS, the control automatically falls back to a Service Worker.
:::

### Programmatic download (no UI)

Skip the UI control and drive the pipeline directly. `downloadRegion` runs the full flow (**style → sprites → glyphs → tiles → metadata**) with per-phase progress.

```typescript
import { OfflineMapManager } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();

await offlineManager.downloadRegion(
  {
    id: 'sf',
    name: 'San Francisco',
    bounds: [[-122.5, 37.7], [-122.3, 37.9]],
    minZoom: 10,
    maxZoom: 14,
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  },
  {
    onProgress: ({ phase, percentage }) => {
      console.log(`[${phase}] ${percentage.toFixed(1)}%`);
    },
  },
);
```

See [Getting Started](/docs/getting-started) for more, or the [API reference](/docs/api-reference) for every option.

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

## Support

If you find this project useful, consider buying me a coffee!

<a href="https://www.buymeacoffee.com/muimsd" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style={{height: '60px', width: '217px'}} /></a>

## License

MIT © [Muhammad Imran Siddique](https://github.com/muimsd)
