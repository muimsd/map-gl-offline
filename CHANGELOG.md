# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
