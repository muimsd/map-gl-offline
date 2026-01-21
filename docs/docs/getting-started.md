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

## Peer Dependencies

`map-gl-offline` requires either MapLibre GL JS or Mapbox GL JS as a peer dependency:

```bash
# For MapLibre GL JS (recommended)
npm install maplibre-gl

# For Mapbox GL JS
npm install mapbox-gl
```

:::note
This package is currently optimized for MapLibre GL JS. Mapbox GL JS support is planned for future releases.
:::

## Basic Setup

### 1. Import the Required Modules

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';

// Import styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css';
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

### 3. Add the Offline Control (UI Method)

The easiest way to use `map-gl-offline` is with the built-in UI control:

```typescript
const offlineManager = new OfflineMapManager();

map.on('load', () => {
  const offlineControl = new OfflineManagerControl(offlineManager, {
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_API_KEY',
    theme: 'dark',
    showBbox: true,
  });

  map.addControl(offlineControl, 'top-right');
});
```

The UI control provides:
- Interactive polygon drawing for region selection
- Real-time download progress tracking
- Region management (view, delete, export)
- Theme toggle (dark/light mode)
- Storage analytics display

### 4. Programmatic Usage (No UI)

For more control, use the `OfflineMapManager` directly:

```typescript
const offlineManager = new OfflineMapManager();

// Download a region
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
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  },
});

// List stored regions
const regions = await offlineManager.listStoredRegions();
console.log('Stored regions:', regions);

// Load an offline region
const region = await offlineManager.getRegion('downtown');
if (region) {
  map.setStyle(region.offlineStyle);
}

// Delete a region
await offlineManager.deleteRegion('downtown');
```

## Environment Setup

For development or when using MapTiler styles, create a `.env` file:

```env
VITE_MAPTILER_API_KEY=your_api_key_here
```

Get a free API key from [MapTiler](https://www.maptiler.com/).

## HTML Setup

Ensure your HTML has a container for the map:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline Map Demo</title>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

## Complete Example

Here's a complete example putting it all together:

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css';

const STYLE_URL = 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY';

// Initialize map
const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: [-74.006, 40.7128],
  zoom: 12,
});

// Initialize offline manager
const offlineManager = new OfflineMapManager();

// Add offline control when map loads
map.on('load', () => {
  const offlineControl = new OfflineManagerControl(offlineManager, {
    styleUrl: STYLE_URL,
    theme: 'auto', // Uses system preference
    showBbox: true,
  });

  map.addControl(offlineControl, 'top-right');
});

// Handle offline detection
window.addEventListener('offline', async () => {
  console.log('Network offline - loading cached data');
  // The control will automatically serve cached resources
});

window.addEventListener('online', () => {
  console.log('Network online');
});
```

## Next Steps

- Read the [API Reference](./api-reference) for detailed documentation
- Check out [Examples](./examples) for more use cases
- Learn about [Configuration](./configuration) options
- Understand the [Architecture](./architecture) of the library
