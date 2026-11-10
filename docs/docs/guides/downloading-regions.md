---
sidebar_position: 1
title: Downloading regions
---

# Downloading regions

## Download a region

`downloadRegion` runs the whole download: style, sprites, fonts, 3D models, tiles, then saving the region.

```ts
import { OfflineMapManager } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();

const result = await offlineManager.downloadRegion({
  id: 'downtown',
  name: 'Downtown',
  bounds: [
    [-74.02, 40.7], // south-west: [longitude, latitude]
    [-73.97, 40.75], // north-east
  ],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
});

console.log(`${result.tileResult.downloadedTiles} tiles, ${result.tileResult.failedTiles} failed`);
```

A failed tile doesn't stop the download, so check `tileResult.failedTiles` and `tileResult.errors`. Downloading a region again with the same `id` replaces its entry and fetches its tiles again.

`loadRegion` is another name for `downloadRegion`. `addRegion` is different: it only saves the region's details and downloads nothing, so you rarely want it.

## Show progress

```ts
await offlineManager.downloadRegion(region, {
  onProgress: ({ phase, completed, total, overallPercentage }) => {
    progressBar.value = overallPercentage;
    if (phase === 'tiles' && total > 0) {
      statusText.textContent = `Tiles: ${completed} of ${total}`;
    }
  },
});
```

| Field | Meaning |
|---|---|
| `overallPercentage` | The whole download, 0 to 100. It only moves forward and reaches 100 when the region is saved. Use this for progress bars. |
| `phase` | `style`, `sprites`, `glyphs`, `models`, `tiles` or `metadata` |
| `completed`, `total` | Items in this phase. `total` is 0 while it's unknown, as it is for tiles until the plan is made. |
| `percentage` | This phase only. It starts again at 0 in each phase. |
| `message` | A short description, when there is one |

`overallPercentage` gives each phase a fixed share (tiles get most of it), so it estimates progress rather than measuring bytes.

## Cancel a download

Pass an `AbortSignal`, and abort it to stop:

```ts
const controller = new AbortController();
cancelButton.onclick = () => controller.abort();

try {
  await offlineManager.downloadRegion(region, { signal: controller.signal });
} catch (error) {
  if (!controller.signal.aborted) throw error;
}
```

A cancelled or failed download saves no region. It removes the tiles it stored that no other region uses, and undoes any `styleConfig` it applied. Cancelling takes effect within a request or two: the requests already in flight finish, and no new ones start. In the control, each download in progress has a **Cancel** button in the panel. If every tile fails, as with an expired token, `downloadRegion` rejects rather than saving an empty region.

## Choosing zoom levels

Each zoom level has about four times as many tiles as the one before, so `maxZoom` matters most.

| Zoom | Shows | Good for |
|---|---|---|
| 0-6 | Countries, major cities | A world overview |
| 7-11 | Cities, main roads | A country or region |
| 12-14 | Streets | A city |
| 15-16 | Buildings, footpaths | A neighbourhood |

Keep high zooms to small areas. A whole-planet download up to zoom 6 is about 5,500 tiles per source, while the same area up to zoom 15 would be over a billion.

Styles often only draw some features from a certain zoom. Mapbox Standard's buildings start at zoom 15, and a region that stops at 14 has no building data at all. The map can zoom past `maxZoom`, but it only enlarges the last tiles it has.

Downloads also refuse to start when the browser reports under 500 MB free. To turn that check off, pass `tileOptions: { storageQuotaCheck: false }`.

## Save a world overview plus city detail

Download a low-zoom world, then detailed cities. Regions can overlap, and tiles they share are stored once.

```ts
import { OfflineMapManager, type BoundingBox } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();
const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';

await offlineManager.downloadRegion({
  id: 'world',
  name: 'World overview',
  bounds: [
    [-180, -85.0511],
    [180, 85.0511],
  ],
  minZoom: 0,
  maxZoom: 6,
  styleUrl,
});

const cities: Array<{ id: string; name: string; bounds: BoundingBox }> = [
  {
    id: 'nyc',
    name: 'New York',
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
  },
  {
    id: 'london',
    name: 'London',
    bounds: [
      [-0.25, 51.43],
      [0.02, 51.57],
    ],
  },
];

for (const city of cities) {
  await offlineManager.downloadRegion({ ...city, minZoom: 7, maxZoom: 14, styleUrl });
}
```

## Add your own layers

Use `extraSources` to save tiles that aren't in the style, such as your own data overlay.

```ts
await offlineManager.downloadRegion({
  ...region,
  extraSources: [
    {
      id: 'parcels',
      type: 'vector',
      tiles: ['https://example.com/parcels/{z}/{x}/{y}.pbf'],
      minzoom: 10,
      maxzoom: 16,
    },
  ],
});
```

The tiles become available offline, but your app still adds the layer that draws them.

## Display a region from code

The [control](./ui-control.md) has `loadOfflineStyle(styleId)` for this. Without the control, read the stored style and tell the map how to reach IndexedDB.

**MapLibre:**

```ts
import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, idbFetchHandler } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();

maplibregl.addProtocol('idb', async params => {
  const response = await idbFetchHandler(params.url);
  if (!response.ok) throw new Error(`Not stored: ${params.url}`);
  const isJson =
    params.type === 'json' || response.headers.get('content-type')?.includes('json');
  return { data: isJson ? await response.json() : await response.arrayBuffer() };
});

const { styleId } = await offlineManager.downloadRegion(region);
const stored = await offlineManager.loadStyleById(styleId);

if (stored) {
  new maplibregl.Map({
    container: 'map',
    style: stored.style as unknown as maplibregl.StyleSpecification,
  });
}
```

**Mapbox GL:**

```ts
import mapboxgl from 'mapbox-gl';
import {
  OfflineMapManager,
  convertStyleForServiceWorker,
  registerOfflineServiceWorker,
} from 'map-gl-offline';

const offlineManager = new OfflineMapManager();
await registerOfflineServiceWorker();

const stored = await offlineManager.loadStyleById('mapbox-standard');

if (stored) {
  new mapboxgl.Map({
    container: 'map',
    style: convertStyleForServiceWorker(stored.style as never) as never,
  });
}
```

The page must be under the Service Worker's control when the map loads. That happens on the next load after it's first registered, so test by reloading.

## Manage regions

```ts
const regions = await offlineManager.listStoredRegions();
const region = await offlineManager.getStoredRegion('downtown');
const bytes = await offlineManager.getRegionSize('downtown', region?.styleId);

await offlineManager.deleteRegion('downtown', region?.styleId);
```

Region ids are only unique within a style, so pass the `styleId` when you have it.

`deleteRegion` keeps anything another region still needs. It removes tiles only this region used. If it was the style's last region, the style and all its tiles, sprites, fonts and models go too.

## Keep the console quiet

Some sources only have tiles in parts of the world. Before downloading a source, the library requests three sample tiles and skips the source if most are missing. Turn this off with `tileOptions: { probeSourcesBeforeDownload: false }`.

A source can be skipped wrongly if its tiles are clustered and the samples all miss. If a source you need is missing, turn the check off.
