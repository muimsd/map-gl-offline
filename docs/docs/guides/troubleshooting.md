---
sidebar_position: 6
title: Troubleshooting
---

# Troubleshooting

## A Mapbox map is blank

You see the background colour, but no roads or labels, and possibly nothing in the console.

**MapLibre is loaded on the same page.** MapLibre GL 6 marks the browser's built-in `Set` and `Error` in a way that breaks Mapbox GL's messages to its worker. The only sign is a map `error` event saying `Cannot read properties of undefined (reading 'omit')`, so listen for it:

```ts
map.on('error', event => console.error(event.error));
```

Load only one renderer per page. If your app offers both, import each on demand and reload the page when switching. The mark can't be removed once it's made.

## `Worker failed to load` on MapLibre

MapLibre 6 looks for its worker next to its own module, which bundlers move. [Getting started](../getting-started.md#maplibre-gl-js) shows the fix.

## `default` is not exported by maplibre-gl

MapLibre 6 has no default export. Use `import * as maplibregl from 'maplibre-gl'`.

## Service Worker activation timed out, or 404 on `idb-offline-sw.js`

The script has to be at your site's root:

- Run `npx map-gl-offline init` to copy it to `public/`.
- Check that `/idb-offline-sw.js` opens in the browser.
- Use HTTPS or `localhost`. Browsers don't run Service Workers elsewhere.
- A site served from a sub-path isn't handled by default, because the worker registers with the scope `/`.

A hard reload (Shift-reload) bypasses the Service Worker for that page load, so stored tiles won't load until a normal reload.

## Nothing draws offline

- **The region wasn't finished.** A region only appears in `listStoredRegions` once its download completes.
- **You're outside the region.** Only its bounds were downloaded, and anywhere else stays blank.
- **The page isn't controlled by the Service Worker yet (Mapbox).** Reload once while online.
- **The token was missing.** Without `accessToken`, `mapbox://` resources can't download. Check `result.tileResult.errors`.

## Buildings are missing

See [See 2.5D buildings](./mapbox.md#see-25d-buildings). In short: zoom to 15 or more, download up to at least 15, and tilt the map.

## Labels are missing

- **All labels:** the style's fonts didn't download. Check `result.glyphResult`, and look for the console warning `Glyph not found for any font`.
- **Some scripts:** the default ranges cover common Unicode blocks, not all of them. Use `glyphRanges` to add others, as 256-wide blocks such as `'6016-6271'`.
- **Skipped on purpose:** `skipGlyphs: true` leaves all fonts out.

Right-to-left text needs its own module. On current Mapbox GL the library caches it. On MapLibre, your app loads it with `setRTLTextPlugin`, which fetches from a URL, so host that file somewhere available offline.

## Tile count looks too high or too low

Sources are downloaded separately, so a style with three sources needs about three times the tiles at the same zoom. Sources also have their own zoom limits, so a raster or terrain source stops at its own maximum. Sparse or switched-off sources are skipped: see [Keep the console quiet](./downloading-regions.md#keep-the-console-quiet) and [What gets saved for Standard](./mapbox.md#what-gets-saved-for-standard).

## `Insufficient storage space for tile download`

Downloads check for 500 MB free before starting. Free up space with [cleanup](./storage.md#remove-old-data), or pass `tileOptions: { storageQuotaCheck: false }` if you know the region is small.

## CORS errors while downloading

The tile server has to allow requests from your site. If it doesn't, send requests through your own proxy with `configureProxy`:

```ts
import { configureProxy } from 'map-gl-offline';

configureProxy({
  tiles: { 'tiles.example.com': '/proxy/tiles' },
  fonts: { 'fonts.example.com': '/proxy/fonts' },
});
```

## `OfflineMapDBVersionError`

Another app on the same origin created the database with a newer version. See [Recover from an incompatible database](./storage.md#recover-from-an-incompatible-database).
