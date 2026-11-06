---
sidebar_position: 2
title: Mapbox GL and Standard
---

# Mapbox GL and Standard

## Set up

Mapbox GL needs the Service Worker script on your site. [Getting started](../getting-started.md#mapbox-gl-js) covers the setup. Pass your token so the library can reach `mapbox://` URLs:

```ts
await offlineManager.downloadRegion(region, { accessToken: mapboxgl.accessToken });
```

Both this option and the control's `accessToken` accept `null`, so you can pass `mapboxgl.accessToken` directly.

:::caution[Don't load MapLibre on the same page]
Loading MapLibre GL 6 alongside Mapbox GL leaves Mapbox maps blank. If your app offers both, load one renderer per page.
:::

Use a current `mapbox-gl`. The Standard style needs 3.30 or later, and the library caches decoder files from 3.34. On a version with different decoder paths, 3D models and right-to-left text may not work offline.

## What gets saved for Standard

The Mapbox Standard style has features you can switch on and off through its config. To save space, the download only includes what the current config shows.

| Feature | Config property | On by default | Downloaded by default |
|---|---|---|---|
| 2.5D buildings | `show3dBuildings` | Yes | Yes |
| 3D landmark models | `show3dLandmarks` | Yes | Yes |
| Trees | `show3dTrees` | Yes | Yes |
| Terrain | | Yes | Yes |
| Detailed building facades | `show3dFacades` | No | No |
| Landmark icons | `showLandmarkIcons` | No | No |
| HD roads and 3D bridges | `showHdRoads` | No | No |
| Indoor maps | `showIndoor` | No | No |

## Turn features on

Pass `styleConfig` to change what's saved and what's drawn offline:

```ts
await offlineManager.downloadRegion(region, {
  accessToken: mapboxgl.accessToken,
  styleConfig: {
    showLandmarkIcons: true,
    show3dFacades: true,
    lightPreset: 'dusk',
  },
});
```

Values are saved as the stored style's defaults, so they apply to the whole style, not just this region. A property the style doesn't have is ignored with a warning. You can also change the font: `styleConfig: { font: 'Roboto' }` downloads that font's weights.

To save every source and decide later, pass `tileOptions: { skipInactiveSources: false }`.

## See 2.5D buildings

If you don't see buildings, check these first:

- **Zoom in to 15 or more.** Standard draws no buildings below that, even online.
- **Download up to at least zoom 15.** A region that stops at 14 has no building data. The control's form warns about this.
- **Tilt the map.** Looking straight down, buildings look flat. Right-drag or Ctrl-drag to tilt, or set `pitch` on the map.

3D landmark models, like the Burj Khalifa, come from their own tiles at zoom 14. A large model tile can take several seconds to appear, with a plain building shown until then.

## Space

Standard's extras can be large. These are approximate sizes from single tiles:

| Data | Size |
|---|---|
| 3D building tile (zoom 14, big city) | 1-5 MB |
| Landmark icon tile (zoom 10) | 1-2 MB |
| Facade tile (zoom 15, big city) | 100-300 KB |
| HD road tile (zoom 14) | About 70 KB |

## What won't work offline

- **Floor selection on indoor maps.** You can download indoor tiles, but choosing a floor isn't available offline.
- **Features you didn't download.** Turning on a feature offline only works if its tiles were saved. Light presets need no extra data, so you can change them offline with `map.setConfigProperty('basemap', 'lightPreset', 'night')`.
- **Other scripts' labels in some fonts.** The library downloads common Unicode blocks. Labels in others, such as Khmer, are left blank offline, without affecting the rest of the map.
- **Styles that wrap Standard through `imports`.** The library flattens these, and that doesn't carry over `iconsets` or terrain. Use the `mapbox://styles/mapbox/standard` URL directly.

## Upgrading stored regions

Downloads made with older versions of the library can have wrong terrain heights, missing 3D buildings and missing fallback fonts. Tile URLs are saved with the style, so a fresh download alone won't fix this. Delete the style, which also removes its regions and data, then download them again:

```ts
await offlineManager.deleteStyle('mapbox-standard');
await offlineManager.downloadRegion(region, { accessToken: mapboxgl.accessToken });
```
