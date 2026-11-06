---
sidebar_position: 2
title: Getting started
---

# Getting started

## Install

Install the library alongside your map renderer:

```bash
npm install map-gl-offline maplibre-gl
# or
npm install map-gl-offline mapbox-gl
```

## MapLibre GL JS

```ts
import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/style.css';

const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';

const map = new maplibregl.Map({
  container: 'map',
  style: styleUrl,
  center: [-74.006, 40.7128],
  zoom: 12,
});

const control = new OfflineManagerControl(new OfflineMapManager(), {
  styleUrl,
  mapLib: maplibregl,
});
map.addControl(control, 'top-right');
```

Passing `mapLib` lets the library serve stored tiles through MapLibre's `addProtocol`.

:::note[MapLibre GL 6 and bundlers]
MapLibre 6 has no default export, so use `import * as maplibregl`. It also looks for its worker file next to its own module, which a bundler moves. If you see `Worker failed to load`, bundle the worker and set its URL. With Vite:

```ts
// In vite.config.ts, add: worker: { format: 'es' }
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
```
:::

## Mapbox GL JS

Mapbox GL has no `addProtocol`, so stored tiles are served by a Service Worker. Copy its script to your site's `public/` folder, using one of these:

```bash
npx map-gl-offline init
```

```ts
// Or copy it on every build, in vite.config.ts:
import { defineConfig } from 'vite';
import { offlineSwPlugin } from 'map-gl-offline/vite-plugin';

export default defineConfig({ plugins: [offlineSwPlugin()] });
```

Then add the control. Leave out `mapLib`, which tells the library to register the Service Worker:

```ts
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-offline/style.css';

mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
const styleUrl = 'mapbox://styles/mapbox/standard';

const map = new mapboxgl.Map({
  container: 'map',
  style: styleUrl,
  center: [-74.006, 40.7128],
  zoom: 12,
});

const control = new OfflineManagerControl(new OfflineMapManager(), {
  styleUrl,
  accessToken: mapboxgl.accessToken,
});
map.addControl(control, 'top-right');
```

The script must be served from your site's root, as `/idb-offline-sw.js`, and over HTTPS or on `localhost`.

## Save your first region

1. Select the cloud button on the map to open the offline manager.
2. Select **Add Region**, then drag the rectangle around the area you want.
3. Select the check mark, name the region and choose a zoom range. On Mapbox Standard, go up to at least zoom 15 to include buildings.
4. Select **Download Region**. The badge on the cloud button shows the progress.

To use it offline, open the manager and select **Load Style** on the stored style.

To do all of this from code instead, see [Downloading regions](./guides/downloading-regions.md).

## Without a bundler

The UMD build exposes a `mapgloffline` global and includes its own dependencies. MapLibre 6 only ships ES modules, so script tags need MapLibre 5:

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" />
<link rel="stylesheet" href="https://unpkg.com/map-gl-offline/style.css" />
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/map-gl-offline/dist/index.umd.js"></script>

<div id="map" style="height: 100vh"></div>
<script>
  const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
  const map = new maplibregl.Map({ container: 'map', style: styleUrl });

  map.addControl(
    new mapgloffline.OfflineManagerControl(new mapgloffline.OfflineMapManager(), {
      styleUrl,
      mapLib: maplibregl,
    }),
    'top-right'
  );
</script>
```

MBTiles import and export also need [sql.js](https://github.com/sql-js/sql.js) on the page. See [MBTiles](./guides/mbtiles.md#loading-sqljs).

## Browser support

The library needs IndexedDB and `DecompressionStream`, which means Chrome or Edge 80, Firefox 113, Safari 16.4 or later. Mapbox GL also needs Service Workers.
