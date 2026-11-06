---
sidebar_position: 4
title: Architecture
---

# Architecture

For anyone working on the library itself, or curious how it works. `.claude/CLAUDE.md` in the repository records the rules behind these decisions in more detail.

## Layout

```text
src/
  index.ts          Public exports
  managers/         OfflineMapManager, assembled from one module per area
  services/         Download and storage logic for each kind of data
  storage/          IndexedDB setup and migrations
  sw/               The Service Worker, and helpers it shares with the main thread
  ui/               The control, panel, modals and translations
  utils/            Style patching, URL handling, tile maths and constants
  styles/           style.css ships with the library; demo.css is the demo's
  main.ts, sheet/   The demo page
bin/                The init command and Vite plugin
scripts/            Build and check scripts
```

`OfflineMapManager` merges its modules at runtime with `Object.assign`, so a method added to a module's interface becomes available on the class.

## The download pipeline

`downloadRegion` in `regionService.ts` runs these phases in order:

1. **Style.** Fetch the style, flatten any `imports`, and copy each source's TileJSON into it. It's reused if already stored.
2. **Sprites.** The standard four files, plus `iconset.pbf` for Mapbox-hosted sprites.
3. **Glyphs.** Every font named in `text-font`, including fallbacks, for each Unicode block in `GLYPH_CONFIG`.
4. **Models.** Each `.glb` in `style.models`, plus the Mapbox GL decoder files, which go in the Cache API.
5. **Tiles.** Plan by source, then fetch in batches.
6. **Metadata.** `addRegion` saves the region and rewrites the style's URLs.

Region progress maps each phase onto a fixed share of `overallPercentage`, using `PHASE_PROGRESS_RANGES`.

### Which tiles get planned

Each source goes through these checks in `tileService.ts`:

- **Is it needed?** `classifySources` works out whether a visible layer or iconset uses it under the style's config.
- **Is it known to be sparse?** Tilesets in `MAPBOX_STANDARD_SPARSE_TILESETS` are skipped unless a switched-on feature needs them, because any request would log a 404 in the browser.
- **Which zooms?** `sourceZoomRange` applies. A source whose `maxzoom` is below the region's `minZoom` still needs its `maxzoom` tiles, which the renderer enlarges.
- **Does it have data here?** Three sample tiles are requested, and the source is skipped if most are missing.

TileJSON is read through `selectTileJsonVariant`, so plans use the same tileset the renderer does. `/raster/v1/` URLs keep their path and gain an `sku` token, because `/v4/` serves a different, lower-quality terrain tile.

## Storage

The database is `offline-map-db`. Its version is `DB_VERSION`, and migrations are in `indexedDbManager.ts`.

| Store | Holds | Key |
|---|---|---|
| `styles` | Styles, each with its regions in `regions[]` | Style id |
| `tiles` | Tile data | `{styleId}:{sourceId}:{z}:{x}:{y}.{ext}` |
| `glyphs` | Font ranges | `{styleId}::{fontstack}/{range}.pbf` |
| `sprites` | Sprite files | `{styleId}::{file}` |
| `models` | 3D models | `{styleId}::model::{name}` |
| `fonts` | Font files | `{styleId}:...` |
| `regions` | Deprecated, kept for migration only | |

Style-level resources are stored once per style, whichever regions use them. `tileBelongsToRegion` decides which region a tile belongs to, by bounds and zoom.

## Serving offline

A stored style's URLs point at IndexedDB, keyed by style id so they survive deleting any one region:

```text
idb://{styleId}/tile/{sourceId}/{z}/{x}/{y}.{ext}
idb://{styleId}/glyph/{fontstack}/{range}.pbf
idb://{styleId}/sprite/sprite
idb://{styleId}/model/{name}
```

`patchStyleForOffline` writes these. It runs each time a region is added, so it has to be repeatable: it stashes each source's original values once and always patches from those.

| | MapLibre GL | Mapbox GL |
|---|---|---|
| Mechanism | `addProtocol('idb', ...)` | Service Worker |
| URLs | `idb://` | `/__offline__/`, from `convertStyleForServiceWorker` |
| Handler | `idbFetchHandler.ts` | `sw/offline-sw.ts`, built to `public/idb-offline-sw.js` |

Pure logic shared by the two handlers lives in `sw/shared.ts`. Missing glyph ranges get an empty response and not a 404, because one failed range makes the renderer drop every label in that tile.

## Theming

`style.css` remaps Tailwind's colour scales in `@theme`, so components keep ordinary utility classes. `blue-*` is the magenta accent, and `gray-*` the spruce neutrals.

## Working on the project

```bash
npm install
npm run dev                    # The demo
npm test                       # Unit tests
npm run typecheck && npm run lint
npm run build                  # The library
npm run check:demo             # Build the demo and check both tabs draw
npm run check:docs             # Compile the examples in these docs
npm run check:mapbox-standard  # Compare the live Standard style with a known baseline
```

`check:demo` and `check:mapbox-standard` need `VITE_MAPBOX_ACCESS_TOKEN`, in the environment or `.env`.
