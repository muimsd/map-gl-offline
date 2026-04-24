---
sidebar_position: 2
---

# Getting Started

This guide will help you get up and running with `map-gl-offline` quickly.

## Installation

```bash
npm install map-gl-offline
# or
yarn add map-gl-offline
# or
pnpm add map-gl-offline
```

### CDN (UMD)

For use without a bundler, include via `<script>` tag. The library is exposed as the `mapgloffline` global (like `mapboxgl` / `maplibregl`):

```html
<script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />

<script src="https://unpkg.com/map-gl-offline/dist/index.umd.js"></script>
<link rel="stylesheet" href="https://unpkg.com/map-gl-offline/style.css" />

<script>
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
  });

  const manager = new mapgloffline.OfflineMapManager();
  map.on('load', () => {
    const control = new mapgloffline.OfflineManagerControl(manager, {
      styleUrl: 'https://demotiles.maplibre.org/style.json',
      mapLib: maplibregl,
    });
    map.addControl(control, 'top-right');
  });
</script>
```

## Peer Dependencies

`map-gl-offline` requires either MapLibre GL JS or Mapbox GL JS as a peer dependency:

```bash
# For MapLibre GL JS
npm install maplibre-gl

# For Mapbox GL JS
npm install mapbox-gl
```

## Basic Setup with MapLibre GL JS

### 1. Import the Required Modules

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';

// Import styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/style.css';
```

### 2. Initialize the Map

```typescript
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY',
  center: [-74.006, 40.7128],
  zoom: 12,
});
```

### 3. Add the Offline Control

```typescript
const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const offlineControl = new OfflineManagerControl(offlineManager, {
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY',
    theme: 'dark',
    showBbox: true,
    mapLib: maplibregl, // enables idb:// protocol in web workers
  });

  map.addControl(offlineControl, 'top-right');
});
```

:::tip
Pass `mapLib: maplibregl` in the options to register the `idb://` protocol handler in MapLibre's web workers. This allows tiles, glyphs, and sprites to be served directly from IndexedDB.
:::

## Basic Setup with Mapbox GL JS

### 1. Copy the Service Worker

Mapbox GL JS v3 does not support `addProtocol`, so offline tile serving uses a **Service Worker** fallback. Copy `idb-offline-sw.js` to your public directory so it is served at the root (`/idb-offline-sw.js`).

**Option 1: CLI (recommended)**

```bash
npx map-gl-offline init
```

**Option 2: Vite plugin** (auto-copies on each build)

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

### 2. Import the Required Modules

```typescript
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';

// Import styles
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-offline/style.css';
```

### 3. Initialize the Map

```typescript
mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [-74.006, 40.7128],
  zoom: 12,
});
```

### 4. Add the Offline Control

```typescript
const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const offlineControl = new OfflineManagerControl(offlineManager, {
    styleUrl: 'mapbox://styles/mapbox/standard',
    accessToken: mapboxgl.accessToken,
    theme: 'dark',
    showBbox: true,
  });

  map.addControl(offlineControl, 'top-right');
});
```

:::note
The control automatically registers the Service Worker when `mapLib` is not provided or lacks `addProtocol`. MapLibre GL JS has built-in `addProtocol` support, so it does not need the Service Worker.
:::

## UI Control Features

The built-in UI control provides:

- Interactive polygon drawing for region selection
- Real-time download progress tracking
- Region management (view, delete, import/export)
- Theme toggle (dark/light mode)
- Storage analytics display
- Language switcher (English / Arabic with RTL support)

## Programmatic Usage (No UI)

For more control, use the `OfflineMapManager` directly. Call `downloadRegion` to run the full pipeline (style → sprites → glyphs → tiles → metadata):

```typescript
const offlineManager = new OfflineMapManager();

// Download a region end-to-end
await offlineManager.downloadRegion(
  {
    id: 'downtown',
    name: 'Downtown Area',
    bounds: [
      [-74.0559, 40.7128], // Southwest [lng, lat]
      [-74.0059, 40.7628], // Northeast [lng, lat]
    ],
    minZoom: 10,
    maxZoom: 16,
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  },
  {
    onProgress: ({ phase, percentage }) => {
      console.log(`[${phase}] ${percentage.toFixed(1)}%`);
    },
  }
);

// List stored regions
const regions = await offlineManager.listStoredRegions();
console.log('Stored regions:', regions);

// Retrieve a stored region
const region = await offlineManager.getStoredRegion('downtown');
if (region) {
  console.log(`Region: ${region.name}, created: ${new Date(region.created).toLocaleDateString()}`);
}

// Delete a region
await offlineManager.deleteRegion('downtown');
```

## Environment Setup

Create a `.env` file with your API keys:

```env
# For MapTiler styles (MapLibre)
VITE_MAPTILER_API_KEY=your_maptiler_key_here

# For Mapbox GL JS
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

Get a free API key from [MapTiler](https://www.maptiler.com/) or an access token from [Mapbox](https://www.mapbox.com/).

## HTML Setup

Ensure your HTML has a container for the map:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline Map Demo</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
      #map {
        width: 100%;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

## Next Steps

- Read the [API Reference](./api-reference) for detailed documentation
- Check out [Examples](./examples) for more use cases
- Learn about [Configuration](./configuration) options
- Understand the [Architecture](./architecture) of the library
