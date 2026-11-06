---
sidebar_position: 5
title: MBTiles
---

# MBTiles

Regions can be exported to and imported from [MBTiles](https://github.com/mapbox/mbtiles-spec), a SQLite format that tools like QGIS, tippecanoe and MapLibre Native can read.

## Export

```ts
const result = await offlineManager.exportRegionAsMBTiles('downtown', {
  onProgress: ({ stage, percentage }) => console.log(stage, percentage),
});

console.log(result.filename, result.size);
offlineManager.downloadExportedRegion(result); // Saves the file in the browser
```

`result.blob` holds the file, if you'd rather upload it.

Two things to know:

- **One source per file.** MBTiles holds one tile for each position, so a file can't hold several sources. The export picks the source with the most tiles, or the one you name with `sourceId`.
- **Only this region's tiles.** When a style has several regions, the file only includes tiles inside this region's bounds and zoom range.

The file holds tiles and metadata, not the style, sprites or fonts.

| Option | Description |
|---|---|
| `sourceId` | Which source to export |
| `format` | `pbf`, `png` or `jpg`, written to the file's metadata |
| `metadata` | Extra rows for the file's `metadata` table |
| `onProgress` | Called with `{ stage, percentage, message }` |

## Import

```ts
const input = document.querySelector<HTMLInputElement>('input[type=file]');
const file = input?.files?.[0];

if (file) {
  const result = await offlineManager.importRegion({
    file,
    format: 'mbtiles',
    newRegionName: 'Imported area',
    overwrite: false,
  });
  console.log(result.message, result.statistics.tilesImported);
}
```

| Option | Description |
|---|---|
| `file` | Required. The `.mbtiles` file. |
| `format` | Required. Always `'mbtiles'`. |
| `newRegionId`, `newRegionName` | Replace the id and name from the file |
| `overwrite` | Replace an existing region with the same id |
| `onProgress` | Called with `{ stage, percentage, message }` |

A file that isn't really MBTiles fails with a clear error.

## Loading sql.js

MBTiles support uses [sql.js](https://github.com/sql-js/sql.js), which is only loaded when you call these methods. Its WebAssembly file comes from jsDelivr by default. To work offline or host it yourself, configure this before exporting or importing:

```ts
import { configureSqlJs } from 'map-gl-offline';

configureSqlJs({ wasmUrl: '/assets/sql.js/' });
```

`wasmUrl` is the folder holding `sql-wasm.wasm`. You can also pass the file's contents as `wasmBinary`.

The UMD build doesn't bundle sql.js, so on a page without a bundler, add its script tag first:

```html
<script src="https://cdn.jsdelivr.net/npm/sql.js/dist/sql-wasm.js"></script>
```
