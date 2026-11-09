# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0] - 2026-11-09

> **Mapbox Standard audit.** Checked against the live style (modified 2026-10-08) with a real download and a DNS-blocked offline render. **Re-download Mapbox Standard regions** to get correct terrain and fallback fonts.

### Fixed

- **Failed downloads could look finished.** A region where every tile failed, as with an expired token, was saved as complete. `downloadRegion` now rejects, and the control shows the error. Errors whose URL happened to contain `404` were also counted as sparse tiles and not failures.
- **`downloadRegion` accepted invalid zoom ranges.** It saved regions with `minZoom` above `maxZoom` or `NaN`. It now rejects them, along with non-integer zooms, and the region form explains the problem.
- **The selection box missed the nearest part of a tilted map.** On a tilted or rotated map it now sits in the middle of the view.
- **Style sizes in the panel left out fonts, icons and 3D models**, so a style holding 34 MB could report 1 MB. Shared tiles were also counted once per region.
- **MapLibre logged an empty error for each missing tile** when the map moved outside a saved region. Missing tiles are now treated as "no tile here".
- **Style names containing `:` or `/`** could make deleting one style remove another's data, or break the stored style's URLs. Those characters now become `-` in new style keys.
- **The panel's scrollbar stayed light in dark mode**, and the header said "1 regions".
- **A failed download could leave a feature switched on with no data.** `styleConfig` was saved before the tiles, and stayed when the download failed. A failed or cancelled download now undoes its config change and removes the tiles it stored that no other region uses.
- **Downloading a style again lost its config and extra sources.** `downloadStyle` replaced the stored copy, so `styleConfig` values and regions' `extraSources` vanished. They're now carried over.
- **A 3D model that failed to download was never retried**, and offline it pointed at storage that didn't have it. Models now keep their upstream URLs until they're stored.
- **Deleting a style during a download left its tiles behind**, with no style to delete them through. The download now removes them and says the style was deleted.
- **Deleting the style on screen left the map blank.** The control now shows that style online again, and does the same when deleting a style's last region.
- **The progress badge could go backwards** with several downloads at once. It now counts finished downloads as 100% until all are done.
- **The panel could miss updates** when a refresh arrived during another, leaving an old progress row or a missing region.
- **Loading a Mapbox Standard style on a MapLibre map** produced a page of validation errors. The control now explains that the style needs Mapbox GL.
- **`cancelDownload` didn't stop anything.** It now aborts the download.
- The header total now includes the style documents, matching the per-style totals. Styles without a `name` are titled from their URL, not a generated id. Form labels are linked to their fields for screen readers.
- **Terrain elevations were wrong offline.** `/raster/v1/` DEM URLs were rewritten to `/v4/`, which serves a 256px palette PNG: in one tile, elevations were off by 46 m on average and up to 207 m, and the size didn't match the style's `tileSize: 514`. These URLs now stay on `/raster/v1/` with an `sku` session token.
- **3D models and RTL text needed the network.** Mapbox GL fetches its Draco and meshopt decoders, RTL text and procedural-building modules from api.mapbox.com at render time. `downloadRegion` now caches them, and the Service Worker serves them.
- **Non-Latin labels were blank.** `text-font` parsing missed fallback fonts in Mapbox Standard's config-built stacks, so only `DIN Pro` was stored, and its empty Arabic and Devanagari ranges were served as matches. Fallback fonts are now downloaded, and handlers skip empty ranges.
- **A missing glyph range blanked a tile's labels.** Handlers returned 404, and Mapbox GL fails a tile's whole glyph request when one range errors. They now return an empty range.
- **Expression operands could be read as fonts**, such as `zoom` in `["step", ["zoom"], ...]`.
- **Programmatic downloads kept `is-active-floor` expressions on the now-flat Mapbox Standard style**, which fail validation on older Mapbox GL.

- **3D buildings could be missing offline.** Mapbox GL renders from a tileset's meshopt `variants`, but downloads used the base tileset, which can be empty where the variant has data: central Dubai has no base tile, so buildings like the Burj Khalifa fell back to plain blocks. Downloads now use the same variant as the renderer. Tile URLs are saved with the style, so **delete an already-stored Mapbox Standard style and download it again** to pick this up.
- **Download percentages were wrong.** The panel's progress froze for the whole download, and the button badge restarted in each phase, going from 99% back to 0% and disappearing before 100%. Both now show one overall percentage that only moves forward and ends at 100, and the panel adds the current phase's counts, such as "Tiles: 64 of 128". Sprite progress no longer assumes every style has five files. `DownloadRegionProgress` gains `overallPercentage`; `percentage` still reports the current phase.
- **Dark panels had light scrollbars and native controls**, a regression from the redesign.
- **Deleting a style left its data behind.** `deleteStyle`, the panel's Delete Style button, `cleanupOldStyles` and `deleteStyles` removed only the style's entry, stranding its tiles, fonts, glyphs, sprites and models in storage with no way to reach them. They now remove all of it. Data stranded by earlier versions stays until the browser's site data is cleared or `resetOfflineMapDB()` is called.
- **The progress badge covered the map button and could disappear.** It's now beside the button instead of on it, and it's no longer removed when a download finishes, which hid progress for later downloads in the same session.
- **The demo's Mapbox tab was blank on Mapbox GL 3.34.** MapLibre GL 6 stamps `_classRegistryKey` onto the built-in `Set` and `Error`, which breaks Mapbox GL's worker messaging on the same page. The demo now loads one renderer per page, and switching tabs reloads it. Apps loading both renderers need to do the same.

### Deprecated

- **`multipleRegions` and `deleteOnExpiry`** on `OfflineRegionOptions`. Nothing has ever read them, so they have no effect.

### Documentation

- **Rewritten around tasks**, with guides replacing the Configuration and Examples pages, which now redirect. Corrects claims that had gone stale: MapLibre 6 has no default export or `maplibre-gl.js` script, `multipleRegions` has no effect, and `setConfigProperty` does work on stored Mapbox Standard styles.
- **`npm run check:docs`** compiles every TypeScript example in the docs and README against the library's types, and runs in CI.

### Added

- **`DownloadRegionOptions.styleConfig`** sets a config-driven style's values, such as `{ showLandmarkIcons: true }`, for both the download and offline rendering.
- **`TileDownloadOptions.skipInactiveSources`** (default `true`) skips sources only used by features the style's config has off. HD roads, 3D bridges and landmark icon tiles no longer download by default for Mapbox Standard.
- **`runtimeAssetsCached`** on `DownloadRegionResult`.
- **`npm run check:mapbox-standard`** reports when the live style or installed renderer moves past a known baseline.
- **`DownloadRegionOptions.signal`** cancels a download with an `AbortSignal`. See [Cancel a download](https://map-gl-offline.netlify.app/docs/guides/downloading-regions#cancel-a-download).
- **The region form warns when a Mapbox Standard region would have no buildings**, which is when Max Zoom is below 15.

### Changed

- **Redesigned UI.** The offline manager's panels, forms and controls move from blue gradients and glass to a flat palette drawn from printed survey maps: spruce, map-paper mist and revision magenta. Class names are unchanged, so integrations keep working, but anything overriding the old colours may need adjusting. The stylesheet no longer sets `color` and `background-color` on the host page's `:root`. The demo is rebuilt as a full-screen map sheet with live coordinate ticks.
- **Dependencies upgraded to their latest versions**, including majors: `i18next` 26, TypeScript 6, Babel 8, `puppeteer` 25 and `@types/node` 26. TypeScript stays on 6 because `ts-jest` and `typescript-eslint` don't support 7 yet. The stub `@types/maplibre-gl` is gone, since `maplibre-gl` ships its own types.
- **Default `sql.js` wasm URL** now matches the installed 1.15.2.
- **`test:ci` passes `--no-watchman`.** A crashing Watchman made Jest exit 0 without running any tests.
- Known-sparse Mapbox tilesets now download, without probing, when a switched-on feature needs them.
- `mapbox-gl` dev dependency is now 3.34. The demo no longer calls `mapboxgl.setRTLTextPlugin`, which 3.34 removed.

## [0.8.9] - 2026-08-24

> **Documentation-vs-implementation audit.** A page-by-page pass over the README and the docs site against the actual package surface. Two of the findings were bugs in the package rather than the prose: the 0.8.8 sparse-tileset allowlist named a tileset id that doesn't exist, so a third of the feature never fired; and the UMD bundle the docs point CDN users at expected globals that no CDN provides.

### Fixed

- **`MAPBOX_STANDARD_SPARSE_TILESETS` named a non-existent tileset.** The landmark-POI entry was `mapbox.landmark-pois-v1`, but the live Mapbox Standard style declares `mapbox://mapbox.mapbox-landmark-pois-v1` (doubled `mapbox` segment). `urlReferencesKnownSparseTileset` anchors on delimiters, so the entry never matched and that source still issued probe requests — the exact 404 noise 0.8.8 set out to remove. Verified against `GET /styles/v1/mapbox/standard`; `mapbox.indoor-v3` and `mapbox.procedural-buildings-v1` were already correct.
- **The UMD build was unusable from a CDN.** `idb`, `@mapbox/tilebelt`, `i18next` and the four `@turf/*` packages were marked external for every output, including UMD. None of them publish a UMD global, so `<script src=".../index.umd.js">` — the usage documented in the README, intro and getting-started pages — loaded and then failed at the first IndexedDB call. The UMD output is now built from its own Rollup config that bundles them; only `mapbox-gl` / `maplibre-gl` (which the page loads itself) and `sql.js` stay external. `dist/index.umd.js` grows from ~660 KB to ~925 KB; the ESM and CJS builds are unchanged.
- **MBTiles import/export from the UMD build.** `getSqlJs()` dynamically imports the `sql.js` bare specifier, which no CDN page can resolve. It now falls back to the `initSqlJs` global that sql.js's own `<script>` build defines, and throws a message naming both options when neither is available.

### Changed

- **`TileDownloadOptions.maxConcurrency` and `FontDownloadOptions.maxConcurrency` are marked `@deprecated`.** Neither downloader has ever read them — `batchSize` is the effective concurrency for tiles, fonts and sprites (each batch is issued in parallel), while glyphs do use a `maxConcurrency` worker pool. The fields stay so existing callers keep type-checking.
- **`TileDownloadOptions.probeSourcesBeforeDownload` doc comment** described the pre-0.8.x single-probe behaviour ("probe one representative tile", "one probe HTTP request per source"). It has probed three tiles with a majority rule since 0.8.x.

### Added

- **`scripts/check-umd.mjs`**, run as part of `npm run build:lib`: fails the build if the UMD wrapper declares any external module beyond `mapbox-gl` / `maplibre-gl` / `sql.js`.
- **Style Management section in the API reference.** `downloadStyle`, `downloadMapboxStyle`, `downloadMapLibreStyle`, `downloadStyleWithAutoDetection`, `listStyles`, `loadStyleById`, `getStyleStats`, `deleteStyle` and `cleanupOldStyles` are part of `OfflineMapManager` but were undocumented. Also adds `getModelStats` / `cleanupOldModels`, `DownloadRegionOptions.skipModels`, and `modelResult` on `DownloadRegionResult`.

### Documentation

- **`deleteRegion` semantics** were documented as "delete a region and all its associated resources". It actually deletes only tiles no remaining region covers — unless it was the style's last region, in which case the style and *all* its tiles, sprites, glyphs and fonts go too. Both paths are now spelled out.
- **`stopAutoCleanup()` with no argument** stops *every* auto-cleanup (identical to `stopAllAutoCleanup()`); the reference claimed it stopped only a default one.
- **`patchStyleForOffline`** was shown as `patchStyleForOffline(styleJson, styleId)`. The second parameter is `downloadId`; `styleId` is the fifth. Full signature and per-parameter semantics documented, along with `normalizeSpriteProperty`.
- **Configuration → "CSS Custom Properties"** documented a `--panel-bg` / `--button-bg` / `--text-primary` variable API that does not exist anywhere in the stylesheet. Replaced with how the control is actually styled: compiled Tailwind utilities, the `.offline-manager-control` scope, class-based `.dark` on `<html>`, and the `.glass-panel` / `.glass-input` helpers.
- **Architecture** — file tree listed `ui/modals/importExportModal.ts` (the file is `mbtilesModal.ts`) and a `BaseManager` module that isn't one; the test tree omitted several suites. "Performance Considerations" claimed streaming I/O and IndexedDB secondary indexes — the stores are keyed by a single composite `key` with no indexes at all.
- **`listRegions()`** returns the same records as `listStoredRegions()`, just typed as `OfflineRegionOptions`; it was described as returning data "without database metadata".
- **`cleanupOldStyles` / `deleteStyle`** delete the style record only, leaving tiles and other resources in place — now stated explicitly.
- **Mapbox URL resolution table** gained the `mapbox://models/…` row and a note about `rewriteMapboxCdnTileUrl`.
- The corrected landmark-POI tileset id is reflected in the README, the API reference, `TileDownloadOptions` doc comments and `.claude/CLAUDE.md`.

### Tests

- `+52`: `urlReferencesKnownSparseTileset` now pins all three Mapbox Standard sparse tileset ids across the three URL forms they can appear in, and asserts dense siblings (`mapbox.mapbox-landmark-icons-v1`, `mapbox.mapbox-streets-v8`) are not caught. New `tests/dist/umdBundle.test.ts` evaluates the built UMD bundle at global scope with no page-provided dependencies and asserts the documented exports exist and reach IndexedDB; it skips when `dist/` hasn't been built. The three probe tests were re-pointed at a non-allowlisted source so they exercise the probe path rather than the pre-skip. Total: 1808 passing.

## [0.8.8] - 2026-05-23

> **Pre-skip Mapbox Standard sparse sub-tilesets.** Mapbox Standard composites in three sources that are sparse-by-design across the planet — `mapbox.indoor-v3`, `mapbox.landmark-pois-v1`, `mapbox.procedural-buildings-v1` (the middle id was wrong — see 0.8.9) — which only have tiles where indoor venues / landmark POIs / 3D buildings actually exist. The downstream probe pass already detected and skipped them for most regions, but the probe HTTP requests themselves logged 404s in devtools (browsers log all non-2xx network responses at the protocol layer; nothing JS can suppress that). 0.8.8 hard-skips these sources *before* issuing any network request.

### Added

- **`MAPBOX_STANDARD_SPARSE_TILESETS`** constant in `src/utils/constants.ts` listing the three sparse tilesets.
- **`urlReferencesKnownSparseTileset(template)`** helper exported from `@/services/tileService` — matches `mapbox://<tileset>`, resolved `/v4/<tileset>.json` (TileJSON), and resolved `/v4/<tileset>/{z}/{x}/{y}...` (tile template) forms.
- **`TileDownloadOptions.skipKnownSparseSources?: boolean`** (default: `true`). Set `false` to attempt these sources anyway — the existing probe pass will still skip them for sparse-for-this-region cases, but the probe 404s will reappear in devtools.

### Changed

- Tile-download planning in `tileService.ts` now checks each source's tile templates against the sparse allowlist before the probe step. Sources matching one of the allowed tileset IDs are dropped entirely with an `info`-level log; no probe or download request is issued.

### Tests

- `+2` tests in `tileService.download.test.ts`: one verifies the default pre-skip (no fetch hits for any sparse tileset); the other verifies `skipKnownSparseSources: false` opts back into the probe path. Total: 1756 passing.

## [0.8.7] - 2026-05-23

> **TypeScript ergonomics for Mapbox callers.** Two small but annoying friction points reported by a Mapbox + TypeScript user: `mapboxgl.accessToken` couldn't be passed directly because its type is `string | null | undefined`, and inline `bounds` literals on a separate `cities` array widened to `number[][]` instead of the required tuple. Both fixed.

### Changed

- **`accessToken` accepts `string | null`** wherever it appears on the public surface — `OfflineRegionOptions` / `DownloadRegionOptions`, `StyleDownloadOptions`, `OfflineManagerControlOptions`, and the `downloadStyle` / `downloadMapboxStyle` manager methods. `null` is treated the same as omitted (every consumer already used `||` to coerce). This matches Mapbox GL's own `accessToken: string | null` typing so `accessToken: mapboxgl.accessToken` works without a cast.

### Added

- **`BoundingBox` type alias** exported from the public API: `type BoundingBox = [[number, number], [number, number]]`. Use it when you build region lists in a separate array — `Array<{ id: string; bounds: BoundingBox }>` keeps TypeScript from widening the inline coordinate literals to `number[][]`.
- README section **"Multi-region downloads (global overview + city detail)"** with a full TypeScript example covering `BoundingBox`, the `multipleRegions` flag, and the two-tier (low-zoom planet + high-zoom cities) pattern. Includes a warning against attempting to download the whole globe at high zoom.

### Internal

- Widened a handful of internal pass-through accessToken positions (`downloadStyleWithProvider`, `RegionControl`, `RegionFormModal`, `createStyleEntry` metadata) so the new public types compose cleanly without casts at boundaries. One `?? undefined` coercion added in `PanelManager` where a stored token feeds back into form data typed `string | undefined`.

## [0.8.2] - 2026-04-24

> **Refactor: build offline Service Worker from TypeScript source.** The SW (`public/idb-offline-sw.js`) and the main-thread fetch handler (`src/utils/idbFetchHandler.ts`) previously implemented the same routing logic twice — tile/glyph/sprite/model/tilejson resolution, region-by-style lookup, candidate-key building. Every fix had to land in both files, and the SW quietly missed its `model` handler for two releases because of it. Now both sides import pure helpers from `src/sw/shared.ts`, and the SW itself is compiled by esbuild from `src/sw/offline-sw.ts` into a single self-contained `public/idb-offline-sw.js`. No runtime behavior change.

### Added

- `src/sw/shared.ts` — pure helpers used by both the SW and the main-thread handler: `makeTileKey`, `tileFallbackExtensions`, `parseTileYExt`, `findStyleByRegionIdIn`, `parseGlyphPath`, `glyphCandidateKeys`, `spriteCandidateKeys`, `modelCandidateKeys`, `matchTileJsonSource`, `buildOfflineTileJson`, `deriveTileExtensionFromTiles`, `isGzipped`.
- `src/sw/offline-sw.ts` — Service Worker entrypoint in TypeScript. Imports from `shared.ts`, uses the raw IndexedDB API (no `idb` library available in the SW global).
- `scripts/build-sw.mjs` — esbuild-based build step that bundles `offline-sw.ts` → `public/idb-offline-sw.js` as a single-file IIFE with all shared helpers inlined.
- `npm run build:sw-src` — runs the new build step. Wired into `npm run build` before `build:lib`. **Re-run this whenever `src/sw/*.ts` changes** (so the checked-in `public/idb-offline-sw.js` stays current).
- `tests/sw/shared.test.ts` — 37 unit tests for every helper in `shared.ts`.

### Changed

- `src/utils/idbFetchHandler.ts` now imports candidate-key builders, the tilejson source matcher, and `buildOfflineTileJson` from `@/sw/shared`. The glyph/sprite/model/tilesjson switch arms dropped ~100 lines of duplicated logic.
- `TILE_FALLBACK_EXTENSIONS` now includes `glb` (previously only in the main-thread handler). Harmless on the SW side — it falls through the same store lookup and returns 404 when no match, same as before.
- `public/idb-offline-sw.js` is now a **build artefact**. Still checked in so the dev server (vite) and npm consumers see a current copy without running our build, but hand edits will be overwritten. A banner at the top of the output calls this out.

### Internal

- Shipping `public/idb-offline-sw.js` from source means it grew from 13.0 KB to 12.7 KB hand-written to 13.2 KB bundled — roughly identical, with the helpers inlined.

## [0.8.1] - 2026-04-23

> **Bug-fix release: Mapbox Standard offline rendering.** `setStyle()` of a downloaded Standard region used to hang forever with `"Style is not done loading"` because two indoor-only expressions (`is-active-floor`, `floor-level`) that Mapbox GL v3 evaluates against `map.indoor.activeFloors` at filter-compile time were left intact when the `imports` wrapper was stripped. Two smaller correctness issues were fixed in the same pass.

### Fixed

- **Mapbox Standard style failed to load offline.** `resolveImports` now rewrites `["is-active-floor"]` and `["is-active-floor", <id>]` → `false` and `["floor-level"]` → `0` before the flattened style is stored, so the filters validate without the `imports` parent context. Existing regions downloaded with 0.8.0 are also healed — `sanitizeIndoorExpressions()` runs at load time in both `PanelManager.handleLoadStyle` and `OfflineManagerControl.loadOfflineStyle`, so **re-downloading is not required**.
- **Offline Service Worker was missing its `model` handler.** `public/idb-offline-sw.js` only handled `tile / glyph / sprite / tilesjson`, so any worker-scoped request for a Mapbox Standard 3D-model `.glb` (trees, wind turbines) 400'd. Main-thread fetches worked because `window.fetch` is intercepted by `idbFetchHandler`, but `new Worker(...).fetch(...)` paths and the native v3 model-loader path didn't. Added `handleModel` mirroring the sprite resolver — tries `{styleId}::model::{name}` first, then `{downloadId}::model::{name}`, returns `Content-Type: model/gltf-binary` (or the stored content-type).
- **Tile-extension regex only captured the first dotted segment.** For Mapbox v4 URLs like `.../{z}/{x}/{y}.vector.pbf`, `patchStyleForOffline` produced `idb://.../{y}.vector` but `tileService.extractExtension` stored the key under `.pbf`. Every tile fetch missed the primary key and went through `idbFetchHandler`'s pbf/mvt/png/jpg/webp fallback loop before resolving. Both sites now share a single `extractTileExtensionFromUrl(url)` helper in `src/utils/tileKey.ts` that captures the last extension before `?`, `#`, or end. (Regions downloaded on 0.8.0 still work — they just keep taking the fallback-loop path until re-downloaded.)

### Added

- Exported `sanitizeIndoorExpressions(style)` from `@/utils/importResolver` — idempotent, safe to call on any style object.
- Exported `extractTileExtensionFromUrl(url)` from `@/utils/tileKey` — single source of truth; `deriveTileExtension(tiles)` now delegates to it.

### Tests

- +15 tests: 6 for `sanitizeIndoorExpressions`, 4 for the SW `model` handler (missing / default content-type / stored content-type override / region-id resolution), 5 for `extractTileExtensionFromUrl` (single-segment, multi-dot, query, fragment, empty). Total: 1717 passing.

## [0.8.0] - 2026-04-22

> **Breaking release focused on import/export.** The JSON and PMTiles export paths shipped in 0.7.0 and earlier were never standards-compliant — JSON produced a bespoke format nothing else reads, and the PMTiles implementation just wrapped that JSON in a `.pmtiles` extension. Both are removed. MBTiles is the only supported format now, and it's finally the real thing: v1.3-compliant SQLite that opens directly in QGIS, tippecanoe, and maplibre-native without conversion.

### Migrating from 0.7.x

1. Replace `manager.exportRegionAsJSON(id)` / `manager.exportRegionAsPMTiles(id)` with `manager.exportRegionAsMBTiles(id)`. The returned `ExportResult.blob` is now a binary SQLite file (`application/x-sqlite3`), and `ExportResult.filename` ends in `.mbtiles`.
2. Update file inputs from `accept=".json,.pmtiles,.mbtiles"` to `accept=".mbtiles"` (or equivalent MIME types).
3. In calls to `manager.importRegion({...})`, remove `format: 'json' | 'pmtiles'` (only `'mbtiles'` is valid now) and drop any `includeStyle` / `includeTiles` / `includeSprites` / `includeFonts` / `compression` options on the export side (gone from `ImportExportOptions`).
4. If you self-host, call `configureSqlJs({ wasmUrl })` once on startup to point at your `sql-wasm.wasm`. Otherwise the library fetches it from jsDelivr at first use.
5. If you depended on sprite or font counts in `ImportResult.statistics` / `ExportResult.statistics`, they're always `0` now — the fields are kept for source-compatibility but MBTiles is tiles-only.

### Added

- **Real binary MBTiles import/export** via `sql.js`. `exportRegionAsMBTiles` produces a v1.3-compliant SQLite archive with `metadata` + `tiles` tables, `tile_row` flipped to TMS, vector tiles gzipped, and a `json` metadata row containing `vector_layers` derived from the offline style's sources. Exports from this library now **open directly in QGIS, tippecanoe, and maplibre-native** — the previous `.mbtiles` files rendered as empty layers because vector tiles weren't gzipped and `json.vector_layers` was missing.
- `importRegion({ format: 'mbtiles' })` parses the same binary format back, un-gzipping vector tiles so the offline fetch handler keeps serving them raw.
- `configureSqlJs({ wasmUrl?, wasmBinary? })` to override how `sql.js` loads its WebAssembly. Default is `https://cdn.jsdelivr.net/npm/sql.js@<ver>/dist/`; set `wasmUrl` to self-host or `wasmBinary` (Node / pre-fetched setups).
- Validation on import: non-SQLite files and SQLite files missing the required `metadata`/`tiles` tables are rejected up front with a clear error (e.g. `"Not a valid MBTiles file: missing SQLite header"`) instead of a cryptic one from `sql.js`.
- `onProgress` callback on `RegionImportData` with `preparing → importing → complete` stages, matching the existing export progress API.
- **MBTiles Import/Export modal** — focused, same size/density as the region-form modal. Reachable from the Import/Export action button on every region row. Shows a file picker (`accept=".mbtiles"`), optional new-region-name override, overwrite toggle, and progress bar.
- End-to-end integration test at the public `OfflineMapManager` surface (`exportRegionAsMBTiles → importRegion → listStoredRegions` round-trip verified against real binary SQLite bytes).

### Removed (breaking)

- **`OfflineMapManager.exportRegionAsJSON`** and **`exportRegionAsPMTiles`** — use `exportRegionAsMBTiles` instead.
- **Types**: `PMTilesExportOptions`, `SpriteExportData`, `FontExportData` deleted. `ImportExportOptions.format` / `.compression` / `.includeStyle` / `.includeTiles` / `.includeSprites` / `.includeFonts` fields removed (they only applied to the deleted JSON path); the interface is now `{ onProgress? }`.
- **Literal narrowing**: `RegionImportData.format`, `ExportResult.format`, `RegionExportData.metadata.format` all narrowed from `'json' | 'pmtiles' | 'mbtiles'` to `'mbtiles'`.
- **UI translations**: `importExport.*` string keys replaced with the new `mbtiles.*` namespace. If you shipped custom translations, rename keys accordingly.
- **Package keyword `pmtiles`** dropped; `mbtiles` kept.

### Changed

- `PanelManager`'s region-row action button for import/export is now un-commented and visible by default.
- `ExportResult.blob` content-type is `application/x-sqlite3` (was `application/vnd.mapbox-vector-tile`, which was wrong for a SQLite container).
- MBTiles `type` metadata is `baselayer` for vector tiles (QGIS renders as a map) and `overlay` for raster — previously hardcoded to `overlay`.

### Fixed

- **`cleanupOldFonts` / `cleanupOldSprites` / `cleanupOldGlyphs` silently ignored their `styleId` argument.** Passing a styleId would wipe that resource type across *every* style rather than scoping the cleanup. Now the underlying services filter by `resourceKeyBelongsToStyle(key, styleId)` when a style is supplied — the public signature on `OfflineMapManager` is unchanged, only the behavior is corrected.
- **Docs corrected**: the IDB structure section in `configuration.md` and `architecture.md` claimed `DB_VERSION: 3` with a `regions` store; the library has been on v4 (with the `models` store and no legacy `regions` store) since 0.7.0. The `idb://` URL shapes documented in `architecture.md` were inverted (`idb://tiles/{styleId}/…` instead of the actual `idb://{styleId}/tile/…`). The logger section in `configuration.md` called a non-existent `logger.setLogLevel()` with a non-existent `LogLevel.NONE`; the real API is `logger.setLevel()` / `configureLogger()` with `LogLevel.SILENT`. `verifyAndRepair{Fonts,Sprites,Glyphs}` signatures in `api-reference.md` claimed a `styleId` argument that the code never accepted.

### Dependencies

- Runtime: added `sql.js ^1.14.1`. Lazy-loaded via dynamic `import()` — only joins bundles that actually call MBTiles code, so JSON-only consumers pre-0.8.0 don't pay the ~1 MB WASM tax. Vite code-splits it into its own chunk (~40 KB JS + ~1 MB WASM).
- Dev: `@types/sql.js ^1.4.11`.

## [0.7.0] - 2026-04-21

> Completes offline support for the **Mapbox Standard** style. The gaps at 0.6.0 (3D models, `raster-array` sources, `iconset.pbf`) are all closed.

### Added

- **3D model download pipeline**: `OfflineMapManager.downloadRegion` now fetches every `.glb` referenced by `style.models` (Mapbox Standard declares 32 tree / wind-turbine models). New `models` IndexedDB store (DB version 3 → 4, additive migration — no data moved). New `'models'` phase in `DownloadRegionPhase` with per-phase `onProgress`. Skippable via `DownloadRegionOptions.skipModels`.
- **`modelService`** exported from the public entry point: `downloadModels`, `getModel`, `getModelStats`, `cleanupOldModels`, `verifyAndRepairModels`, `modelKeyBelongsToStyle`. Also exposed on `OfflineMapManager` / `ResourceService` as `downloadModelsWithOptions`, `getModelStats`, `cleanupOldModels`, `verifyAndRepairModels`.
- **`raster-array` source type** accepted by `tileService.extractTileSources` and `PanelManager`'s maxzoom guard. Used by Mapbox Standard's `mapbox-landmarks` source (`mapbox.mapbox-landmark-icons-v1`).
- **`iconset.pbf` companion fetch**: when a resolved sprite URL matches the Mapbox Standard pattern (`api.mapbox.com/styles/v1/<owner>/<style>/<hash>/sprite`), the region downloader appends an `iconset.pbf` URL to the sprite download list. Non-Mapbox providers are unaffected.
- `patchStyleForOffline` rewrites `style.models` entries to `idb://<styleId>/model/<name>`. Accepts both Mapbox Standard's string-valued shape (`{ "name": "mapbox://..." }`) and the older/generic `{ "name": { "uri": "..." } }` shape.
- `idbFetchHandler` handles the new `idb://<styleId>/model/<name>` URL form with `Content-Type: model/gltf-binary`.
- `convertStyleForSW` handles both model value shapes when rewriting `idb://` URLs to `/__offline__/` for the Service Worker path.
- `deleteStyleResources` now clears the `models` store for the style being deleted.

### Changed

- **DB_VERSION: 3 → 4.** Migration creates the new `models` store via the existing `createStores` helper. No data migration is needed. Existing offline data is preserved.
- **`DownloadRegionPhase`** widened to include `'models'`. `DownloadProgress.phase` in the UI control's progress callback likewise adds `'models'`.
- `BaseStyle.models` type loosened to accept both `string` and `{uri}` values, reflecting Mapbox Standard's actual shape.

### Breaking

**None.** All additions are backwards-compatible.

## [0.6.0] - 2026-04-21

> Upgrading from 0.5.x? See the [migration guide](https://map-gl-offline.netlify.app/docs/migration-0.6).


### Added

- **Programmatic `downloadRegion` API**: `OfflineMapManager.downloadRegion(region, options?)` runs the full pipeline (style → sprites → glyphs → tiles → metadata) and returns a `DownloadRegionResult`. Per-phase `onProgress` callback with `{ phase, completed, total, percentage, message }`. `loadRegion` is now a thin alias that forwards to `downloadRegion` (was previously a stub logging "loadTiles function not yet implemented"). Closes #18.
- **Sparse-source probing**: `TileDownloadOptions.probeSourcesBeforeDownload` (default `true`) fetches 3 representative tiles per source (start/middle/end) before committing its full plan; sources whose majority return 404 are skipped entirely. Eliminates the 404 flood for composite styles like Mapbox Standard that reference sparse tilesets (`mapbox.indoor-v3`, `mapbox.mapbox-landmark-pois-v1`, `mapbox.procedural-buildings-v1`). Adapts per-region without a static skip list.
- **Storage resilience**: new `OfflineMapDBVersionError` class and `resetOfflineMapDB()` helper. When the on-disk IDB is at a higher schema version than the library supports (common in shared-origin dev environments or after downgrades), `dbPromise` now throws a typed, actionable error instead of an opaque `DOMException: VersionError`.
- **Shared resource-key helper**: `resourceKeyBelongsToStyle(key, styleId)` exported for advanced callers; uses delimiter-aware prefix matching to avoid cross-style collisions.
- **Shared region-listing helper**: `loadAllStoredRegions()` exported as a single source-of-truth for flattening `styles.regions[]` across all stored styles.

### Changed

- **`addRegion` semantics clarified**: `addRegion` only stores metadata and patches the style to `idb://` URLs. For tile/sprite/glyph downloads, use the new `downloadRegion`.
- **`expiry` treated as absolute timestamp**: `addRegion` now stores `region.expiry` verbatim (matching the `OfflineRegionOptions` type doc and all consuming readers in cleanup/UI code). Previous behavior stored `Date.now() + region.expiry`, corrupting absolute timestamps into far-future garbage dates.
- **ID-based region dedup**: `addRegion` now upserts by `region.id` (was deduping by bounds). Two regions sharing bounds but with distinct ids are both persisted; a repeated `id` is replaced in place (original `created` preserved, `updated` refreshed).
- **UI `DownloadManager.downloadRegion` delegates to the service**: ~370 lines of orchestration removed from the UI layer; UI progress callbacks preserved.
- **`AnalyticsService.getAll*Stats` simplified**: now 1-line delegations to the underlying `get*Stats` functions. Previously re-derived lossy shapes from analytics; now returns full rich stats (populated `fonts[]`, `sprites[]`, `corruptedFonts[]`, etc.).
- **`OfflineMapManager` class boilerplate collapsed**: replaces 50+ `declare public X: Module['X']` fields with class/interface declaration merging. Adding a new module method no longer requires editing `src/managers/offlineMapManager/index.ts`.

### Fixed

- **Cross-style resource-deletion collision**: deleting style `"abc"` no longer collaterally wipes glyphs/sprites/fonts of sibling styles like `"abc_def"` (the previous `startsWith("abc_")` match was over-eager).
- **Font deletion narrower than glyph/sprite**: fonts, glyphs, and sprites now all use the same delimiter-aware prefix match.
- **`loadOfflineStyles` / `loadStylesFromIDB` duplication**: inlined the private wrapper into the single public call-site; removed the `loadSpecificOfflineStyle` alias (was documented as "alias for `loadOfflineStyle()`" with zero callers).
- **Duplicate region-listing implementations**: `RegionService.listRegions`, `RegionService.listStoredRegions`, and `CleanupService.getAllRegions` now all delegate to a single shared `loadAllStoredRegions()` helper.
- **IndexedDB `VersionError` cascade**: caught at the module-level `openDB` call and converted to a typed `OfflineMapDBVersionError` that consumers can inspect for a clean recovery path.
- **Mapbox token UX (dev harness only)**: invalid `VITE_MAPBOX_ACCESS_TOKEN` or localStorage-stored tokens are now pre-flighted against the style URL; on 401, the bad token is cleared and the user is re-prompted instead of the Mapbox SDK emitting noisy errors.

### Breaking

- **`ResourceService.getXxxStatistics` → `getXxxStats`**: `getTileStatistics`, `getFontStatistics`, `getSpriteStatistics`, `getGlyphStatistics` renamed to `getTileStats`, `getFontStats`, `getSpriteStats`, `getGlyphStats` (matching the underlying service functions). These are methods on `ResourceService` / `OfflineMapManager`; update any direct calls.
- **`OfflineManagerControl.loadSpecificOfflineStyle` removed**: was documented as a trivial alias for `loadOfflineStyle(styleId)`. Use `loadOfflineStyle(styleId)` directly.
- **`addRegion` no longer downloads tiles**: callers that expected `addRegion` to download should switch to `downloadRegion`. `addRegion` now upserts by id (see above) rather than silently skipping on bounds match.
- **`region.expiry` interpreted as absolute timestamp**: callers that were passing a duration (days in ms) will now need to compute `Date.now() + duration` themselves. Callers that were correctly passing an absolute timestamp will get the behavior the type always promised.

## [0.5.3] - 2026-03-08

### Changed

- **Bundle Size**: Reduced ESM bundle from 783 KB to 565 KB (28% reduction) by externalizing `i18next` and replacing `@turf/turf` monorepo with individual packages (`@turf/area`, `@turf/bbox-polygon`, `@turf/difference`, `@turf/helpers`)
- **Removed Unused Dependency**: Removed `@tabler/icons` (unused, saved 47 MB install size)

### Fixed

- **Expired Region Cleanup**: `forceCleanupExpiredRegions` now checks actual `region.expiry` timestamps instead of deleting all regions
- **Region Size Calculation**: `getRegionSize` now correctly filters tiles by zoom range using parsed tile keys
- **Expiry Distribution**: Analytics now uses actual `region.expiry` field instead of `lastModified` for expiry categorization
- **Auto-Cleanup Shutdown**: `stopAllAutoCleanup` now correctly clears all interval IDs
- **Import Tile Keys**: Imported tiles now use the standard `createTileKey()` format (`{styleId}:{sourceId}:{z}:{x}:{y}.{ext}`)
- **Import Atomicity**: Region imports now use a single IndexedDB transaction for consistency
- **PMTiles Bounds Validation**: Import now validates bounds values with `isFinite()` checks
- **PMTiles Null Safety**: PMTiles parser handles missing header fields gracefully
- **Style Resource Deletion**: `deleteStyleResources` uses delimiter-aware prefix matching to avoid deleting resources from styles with similar ID prefixes
- **Double IDB Read**: `addRegion` eliminated redundant database fetch for style entry
- **Style Stats Filtering**: `getStyleStats` now accepts optional `styleId` parameter for per-style statistics
- **Failed Import Cache**: Style service dynamic import resets on failure instead of caching rejected promises
- **Progress Off-by-One**: Style management progress callback no longer fires at `completed === 0`
- **HTML Tile Detection**: Improved error page detection to catch all HTML tag names (not just `<!` and `<?`)
- **DB Migration Race Condition**: IndexedDB v2-to-v3 migration groups regions by styleId for single read-modify-write per style
- **DB Migration Guard**: Migration now checks that required stores exist before attempting data migration
- **Maintenance Regions**: `performCompleteMaintenance` now uses `listStoredRegions` to get proper `styleId` on regions
- **XSS Prevention**: Import/export modal escapes user-provided region data in HTML templates

- All source imports converted from relative paths (`../`) to `@/` path alias for consistency
- Dynamic imports in `regionService` converted to static imports for better tree-shaking
- Removed dead code: `countGlyphsInData`, `calculateCompressionRatio` from glyph service; `extractSpriteMetadata`, `isProbablySpritesheet` from sprite service
- Removed redundant database reads in sprite verification and download flows

## [0.5.2] - 2025-12-31

### Added

- **CLI Command**: `npx map-gl-offline init` to copy the Service Worker file (`idb-offline-sw.js`) into your project's public directory
- **Vite Plugin**: `offlineSwPlugin()` to automatically copy the Service Worker on each build
- **Mapbox GL Example**: Full React + Vite example app for Mapbox GL JS with offline support

### Fixed

- **Example Versions**: Updated `map-gl-offline` version references in example projects
- **Style CSS Imports**: Fixed `style.css` import paths in documentation and examples
- **Mapbox accessToken**: Pass `accessToken` to `OfflineManagerControl` in the Mapbox example

## [0.5.1] - 2025-12-30

### Added

- **UMD Build**: Added `mapgloffline` global for `<script>` tag usage
- **RTL Text Plugin**: Added RTL text plugin support for Mapbox GL JS
- **Mapbox Token Prompt**: Interactive access token prompt in the demo with `localStorage` persistence
- **Clear Token Button**: Button to clear the stored Mapbox access token

### Fixed

- **API References**: Fixed outdated API references in documentation
- **Input Text Color**: Changed input text color to black in the Mapbox token prompt for better visibility

## [0.5.0] - 2025-12-30

### Added

- **Mapbox GL JS Support**: Full compatibility with Mapbox GL JS v2/v3 including `mapbox://` protocol resolution, correct CSS prefix detection, and tab switching in the dev server
- **Mapbox Standard Style**: Offline support for Mapbox Standard style with 3D building extrusions, raster-dem terrain, and import-based style resolution
- **Day/Night Light Presets**: Light preset controls (day, dawn, dusk, night) for Mapbox Standard style via `setConfigProperty`
- **Rain/Snow Weather Controls**: Weather effects (rain, snow) for Mapbox Standard style via `setRain`/`setSnow`
- **Import Resolver**: Automatic resolution and flattening of `imports` in Mapbox Standard and other import-based styles for offline storage
- **Mapbox Resource Extraction**: Offline storage of Mapbox sprites, glyphs, and fonts with proper URL rewriting
- **HTTP Cache Expiry**: Cache expiry support for Mapbox CDN resources
- **NonRetryableError**: Error class for failures that should not be retried (e.g., 404s, invalid styles)
- **Internationalization**: Built-in i18n with English and Arabic translations, RTL layout support, and language change subscriptions
- **Type Safety Improvements**: Enhanced TypeScript types across the codebase
- **XSS Prevention**: `escapeHtml` utility for sanitizing user content in UI templates
- **Event Listener Cleanup**: Proper cleanup of all event listeners on control removal
- **Tests**: Added tests for tile coordinate generation, extension extraction, and maxzoom capping

### Fixed

- **Mapbox CDN Raster URLs**: Rewrite Mapbox CDN raster tile URLs for correct offline retrieval
- **Maxzoom Capping**: Cap tile download maxzoom to source TileJSON maxzoom to avoid requesting non-existent tiles
- **Zoom Range Gaps**: Fix gaps in zoom range coverage when source maxzoom is lower than requested maxzoom
- **Import Stripping**: Strip `imports` from offline styles so Mapbox GL JS v3 does not re-fetch them at runtime
- **JSON Parsing in addProtocol**: Parse JSON responses (TileJSON, sprite atlas) in the `idb://` protocol handler
- **Negative Result Caching**: Remove negative result caching that prevented retries after transient failures
- **Tile Extension Mismatch**: Fix tile extension mismatch between stored and requested tiles
- **Missing Glyph Ranges**: Ensure all required Unicode glyph ranges are downloaded
- **Array Sprites**: Support array-format sprite definitions in styles
- **29 Bugs from Codebase Audit**: Resolved issues found during comprehensive audit including cursor handling, transaction safety, and edge cases
- **CSS Prefix for Mapbox GL JS**: Use correct `mapboxgl-` CSS prefix when running with Mapbox GL JS
- **`mapbox://` URL Resolution**: Properly resolve `mapbox://` style, source, sprite, and glyph URLs using the access token

---

## [0.1.0] - 2025-11-30

### Added

#### Core Features
- **Complete Offline Map Support**: Download and store entire map regions with polygon-based selection
- **Smart Tile Management**: Efficient vector/raster tile downloading, caching, and retrieval with zoom-level optimization
- **Font & Glyph Support**: Comprehensive font and glyph management with Unicode range support
- **Sprite Management**: Multi-resolution sprite support (@1x, @2x) with intelligent caching
- **Real-time Analytics**: Detailed storage analytics, performance metrics, and optimization recommendations
- **Import/Export**: Support for JSON, PMTiles, and MBTiles formats for data portability
- **Data Portability**: Seamless transfer of offline maps between devices and applications

#### Modern UI Control
- **Glassmorphic Design**: Beautiful modern interface with glassmorphism effects and smooth animations
- **Dark/Light Theme**: Automatic theme switching with system preference detection and manual toggle
- **Polygon Drawing**: Interactive polygon tool for precise region selection
- **Live Progress Tracking**: Real-time download progress with detailed statistics and visual feedback
- **Region Management**: Easy-to-use interface for managing multiple offline regions
- **Responsive Design**: Mobile-friendly UI that adapts to all screen sizes

#### Technical Features
- **IndexedDB Storage**: Efficient browser storage with quota management and transaction safety
- **Full TypeScript Support**: Complete type definitions, interfaces, and compile-time safety
- **Performance Optimized**: Concurrent downloads, async/await patterns, and memory-efficient operations
- **Intelligent Cleanup**: Smart cleanup of expired data with customizable policies
- **Robust Error Handling**: Comprehensive error recovery, retry mechanisms, and graceful degradation
- **Enhanced Logging**: Detailed debugging with zoom-level specific logging (Z12 tracking)

### Fixed

- **Fractional Zoom Tiles**: Fixed tile loading at fractional zoom levels (12.000001-12.99999)
  - MapLibre requests tiles with fractional zoom (e.g., 12.5)
  - Tiles are stored with integer zoom (12)
  - Added `Math.floor()` to zoom level parsing in `idbFetchHandler.ts`
- **Sprite Loading**: Corrected sprite key format for proper offline sprite retrieval
- **Theme Toggle**: Fixed event listener attachment in Modal component
- **Modal Sizing**: Unified sizing logic between Modal and Panel components
- **Dark Mode**: Fixed input styling, header gradients, and nested backgrounds
- **Zoom Display**: Positioned zoom level indicator properly within map bounds

### Technical Improvements

- **Logger System**: Centralized logging with scoped loggers and configurable log levels
- **Constants**: Centralized configuration values and magic numbers
- **Error Utilities**: Consistent error handling and categorization
- **Type Safety**: Enhanced TypeScript types and JSDoc documentation
- **Code Quality**: Reduced console.log usage, fixed unused variables, improved maintainability

### Dependencies

- **Core**: `@mapbox/tilebelt`, `idb`, `@turf/area`, `@turf/bbox-polygon`, `@turf/difference`, `@turf/helpers`, `i18next`
- **Build**: TypeScript, Rollup, Vite
- **Styling**: Tailwind CSS v4
- **Peer Dependencies**: MapLibre GL JS >=1.0.0 or Mapbox GL JS >=2.0.0 (optional)

---

For more details, see the [README](README.md) and [documentation](https://map-gl-offline.netlify.app).

[0.5.3]: https://github.com/muimsd/map-gl-offline/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/muimsd/map-gl-offline/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/muimsd/map-gl-offline/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/muimsd/map-gl-offline/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/muimsd/map-gl-offline/releases/tag/v0.1.0
