---
sidebar_position: 1
slug: /
title: Introduction
---

# map-gl-offline

Save a map area to the browser, then keep using it with no connection. map-gl-offline works with [MapLibre GL JS](https://maplibre.org/) and [Mapbox GL JS](https://www.mapbox.com/mapbox-gljs), and stores everything in IndexedDB.

A saved region includes everything the map needs to draw: the style, tiles, sprites, fonts and 3D models.

## Two ways to use it

**Add the control** for a ready-made interface. People draw an area on the map, choose zoom levels and download it, then manage what they've saved from a panel.

```ts
map.addControl(new OfflineManagerControl(offlineManager, { styleUrl, mapLib: maplibregl }));
```

**Call the API** to download regions from your own code, with no UI.

```ts
await offlineManager.downloadRegion(
  {
    id: 'downtown',
    name: 'Downtown',
    bounds: [
      [-74.02, 40.7],
      [-73.97, 40.75],
    ],
    minZoom: 10,
    maxZoom: 16,
    styleUrl,
  },
  { onProgress: ({ overallPercentage }) => console.log(`${Math.round(overallPercentage)}%`) }
);
```

## How it works

1. **Download.** `downloadRegion` fetches the style, then its sprites, fonts, 3D models and tiles, and saves them to IndexedDB.
2. **Rewrite.** The saved copy of the style has its URLs changed to point at IndexedDB, such as `idb://my-style/tile/...`.
3. **Serve.** When the map asks for those URLs, the library answers from IndexedDB. MapLibre does this through `addProtocol`. Mapbox GL has no `addProtocol`, so it uses a Service Worker that you add to your site.

## Before you start

- **Storage is limited.** Browsers cap IndexedDB, and each extra zoom level multiplies the tile count by about four. See [Choosing zoom levels](./guides/downloading-regions.md#choosing-zoom-levels).
- **Check your map provider's terms.** Some providers restrict offline use or bulk downloads of their data.
- **MapLibre and Mapbox can't share a page.** Load one renderer per page. See [Troubleshooting](./guides/troubleshooting.md#a-mapbox-map-is-blank).

## Where to go next

- [Getting started](./getting-started.md): install the library and save your first region.
- [Downloading regions](./guides/downloading-regions.md): the API, progress, and displaying a region from code.
- [Mapbox GL and Standard](./guides/mapbox.md): Service Worker setup and Standard's optional features.
- [Live demo](https://map-gl-offline-demo.netlify.app): try it in your browser.
