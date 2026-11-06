---
sidebar_position: 3
title: API reference
---

# API reference

Everything below is exported from `map-gl-offline`, and types ship with the package. `OfflineMapManager` is also the default export.

## OfflineMapManager

```ts
import { OfflineMapManager } from 'map-gl-offline';

const offlineManager = new OfflineMapManager();
```

### Regions

| Method | Returns | Description |
|---|---|---|
| `downloadRegion(region, options?)` | `Promise<DownloadRegionResult>` | Download everything a region needs. [Guide](./guides/downloading-regions.md) |
| `loadRegion(region, options?)` | `Promise<DownloadRegionResult>` | Another name for `downloadRegion` |
| `addRegion(region)` | `Promise<void>` | Save a region's details only. Downloads nothing. |
| `deleteRegion(regionId, styleId?)` | `Promise<void>` | Delete a region, keeping what other regions need |
| `getStoredRegion(regionId)` | `Promise<StoredRegion \| null>` | Get one region |
| `listStoredRegions()` | `Promise<StoredRegion[]>` | List regions with their storage details |
| `listRegions()` | `Promise<OfflineRegionOptions[]>` | List regions as they were defined |
| `getRegionSize(regionId, styleId?)` | `Promise<number>` | A region's tile size in bytes |

### Styles

| Method | Returns | Description |
|---|---|---|
| `downloadStyle(url, options?)` | `Promise<StyleDownloadResult>` | Download a style. `options` adds `provider`, `accessToken` and `forceProvider`. |
| `downloadMapboxStyle(url, token?, options?)` | `Promise<StyleDownloadResult>` | Download as a Mapbox style |
| `downloadMapLibreStyle(url, options?)` | `Promise<StyleDownloadResult>` | Download as a MapLibre style |
| `downloadStyleWithAutoDetection(url, options?)` | `Promise<StyleDownloadResult>` | Work out the provider from the URL |
| `loadStyleById(styleId)` | `Promise<StyleEntry \| null>` | Get a stored style |
| `listStyles()` | `Promise<StyleEntry[]>` | List stored styles |
| `getStyleStats(styleId)` | `Promise<EnhancedStyleStats>` | Sizes and counts for a style |
| `deleteStyle(styleId)` | `Promise<void>` | Delete a style, all its regions, and everything stored for them |
| `cleanupOldStyles(maxAgeDays?)` | `Promise<number>` | Delete old styles, returning how many |

### Analytics

| Method | Returns |
|---|---|
| `getComprehensiveStorageAnalytics()` | `Promise<StorageAnalyticsReport>` |
| `getRegionAnalytics()` | `Promise<RegionAnalytics>` |
| `getTileStats()`, `getFontStats()`, `getSpriteStats()`, `getGlyphStats()`, `getModelStats()` | Stats for one kind of data |
| `getFontAnalytics()`, `getSpriteAnalytics()`, `getGlyphAnalytics()` | More detail on one kind of data |

### Cleanup and maintenance

| Method | Returns | Description |
|---|---|---|
| `cleanupExpiredRegions()` | `Promise<number>` | Delete regions last updated over 30 days ago. Doesn't read `expiry`. |
| `forceCleanupExpiredRegions()` | `Promise<number>` | Delete regions past their `expiry` |
| `performSmartCleanup(options?)` | `Promise<CleanupResult>` | Delete by age, count and size limits |
| `setupAutoCleanup(options?)` | `Promise<string>` | Start scheduled cleanup, returning its id. `options` adds `intervalHours`. |
| `startEnhancedAutoCleanup(intervalHours?, options?)` | `Promise<string>` | Start scheduled smart cleanup |
| `stopAutoCleanup(cleanupId?)` | `Promise<void>` | Stop a schedule |
| `stopAllAutoCleanup()` | `Promise<void>` | Stop every schedule |
| `cleanupOldFonts(maxAge?)`, `cleanupOldSprites(maxAge?)`, `cleanupOldGlyphs(maxAge?)`, `cleanupOldModels(maxAge?)` | Number deleted | Delete old resources of one kind |
| `verifyAndRepairFonts()`, `verifyAndRepairSprites()`, `verifyAndRepairGlyphs()`, `verifyAndRepairModels()` | `{ verified, repaired, removed }` | Check one kind and remove damaged entries |
| `performCompleteMaintenance(options?)` | `Promise<MaintenanceResults>` | Clean up, verify and report in one call |

### Import and export

| Method | Returns | Description |
|---|---|---|
| `exportRegionAsMBTiles(regionId, options?)` | `Promise<ExportResult>` | Export to MBTiles. [Guide](./guides/mbtiles.md) |
| `importRegion(importData)` | `Promise<ImportResult>` | Import an MBTiles file |
| `downloadExportedRegion(exportResult)` | `void` | Save an export as a file in the browser |

### Individual resources

Most apps should use `downloadRegion`. These download one kind of resource: `downloadTilesWithOptions`, `downloadFontsWithOptions`, `downloadSpritesWithOptions`, `downloadGlyphsWithOptions`, `downloadModelsWithOptions`. `loadGlyphsForStyle` reads stored glyphs.

## OfflineManagerControl

```ts
new OfflineManagerControl(offlineManager, options);
```

See [The offline control](./guides/ui-control.md) for its options.

| Method | Description |
|---|---|
| `updateStyleUrl(url)` | Change the style that new downloads use |
| `getCurrentStyleUrl()` | Get that style |
| `loadOfflineStyle(styleId)` | Show a stored style on the map |
| `loadOfflineStyles()` | Show the stored style, asking which one if there are several |
| `onAdd(map)`, `onRemove()` | Called by the map when you add or remove the control |

## Types

### OfflineRegionOptions

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Required. Unique within a style. Reusing one replaces that region. |
| `name` | `string` | Required. Display name. |
| `bounds` | `BoundingBox` | Required. `[[west, south], [east, north]]` |
| `minZoom`, `maxZoom` | `number` | Required. Zoom range to download. |
| `styleUrl` | `string` | The style. Required by `downloadRegion`. |
| `styleId` | `string` | Use a style that's already stored |
| `expiry` | `number` | Absolute time in milliseconds since the epoch. Defaults to 30 days from now. |
| `extraSources` | `ExtraSource[]` | More tile sources to save. [Guide](./guides/downloading-regions.md#add-your-own-layers) |
| `tileExtension` | `string` | Force one tile extension for every source. Rarely needed. |
| `multipleRegions`, `deleteOnExpiry` | `boolean` | Deprecated, with no effect. Regions already coexist, keyed by `id`. To delete expired regions, use `forceCleanupExpiredRegions`. |

### DownloadRegionOptions

| Property | Type | Description |
|---|---|---|
| `onProgress` | `(p: DownloadRegionProgress) => void` | [Progress updates](./guides/downloading-regions.md#show-progress) |
| `accessToken` | `string \| null` | Mapbox token, needed for `mapbox://` URLs |
| `provider` | `'mapbox' \| 'maplibre' \| 'auto'` | Defaults to `'auto'` |
| `styleConfig` | `Record<string, unknown>` | [Style config values](./guides/mapbox.md#turn-features-on) |
| `skipSprites`, `skipGlyphs`, `skipModels` | `boolean` | Leave out a phase. Default `false`. |
| `glyphRanges` | `string[]` | Font ranges to download, as 256-wide blocks. Defaults to common Unicode blocks. |
| `tileOptions` | `TileDownloadOptions` | See below |

### DownloadRegionResult

| Property | Description |
|---|---|
| `regionId`, `styleId` | The ids used |
| `tileResult` | `totalTiles`, `downloadedTiles`, `skippedTiles`, `failedTiles`, `totalSize`, `errors` and more |
| `styleResult`, `spriteResults`, `glyphResult`, `modelResult` | Results of each phase, when it ran |
| `runtimeAssetsCached` | Mapbox GL decoder files in the offline cache. Undefined for other styles. |

### TileDownloadOptions

| Property | Default | Description |
|---|---|---|
| `batchSize` | `20` in `downloadRegion` | Tiles fetched at once |
| `maxRetries` | `3` | Retries for each tile |
| `retryDelay` | `1000` | Milliseconds before retrying |
| `timeout` | `10000` | Milliseconds for each tile |
| `skipExisting` | `false` in `downloadRegion` | Leave tiles that are already stored |
| `storageQuotaCheck` | `true` | Refuse to start under 500 MB free |
| `probeSourcesBeforeDownload` | `true` | [Skip sources](./guides/downloading-regions.md#keep-the-console-quiet) whose sample tiles are mostly missing |
| `skipKnownSparseSources` | `true` | Skip Mapbox's sparse tilesets unless a switched-on feature needs them |
| `skipInactiveSources` | `true` | Skip sources only hidden features use |
| `priorityZoomLevels` | | Zoom levels to fetch first |
| `bandwidthLimit` | | Slow downloads down |
| `validateTiles` | `false` | Reject empty or invalid tiles |
| `compressTiles` | `false` | Compress image tiles before storing |
| `onProgress` | | Progress for this phase only |

### Other types

| Type | Shape |
|---|---|
| `BoundingBox` | `[[west, south], [east, north]]` |
| `ExtraSource` | `{ id, tiles, type?, minzoom?, maxzoom?, attribution? }`. `type` is `vector`, `raster` or `raster-dem`. |
| `RegionCleanupOptions` | `{ maxAge?, maxStorageSize?, maxRegions?, priorityPatterns?, onProgress? }`. Age in days, size in bytes. |
| `CleanupResult` | `{ scannedRegions, expiredRegions, deletedRegions, preservedRegions, freedSpace, errors, recommendations }` |
| `StorageAnalyticsReport` | `{ tiles, fonts, sprites, glyphs, models, regions, totalStorageSize, storageByType, recommendations }` |
| `MaintenanceOptions` | `{ cleanupExpired?, verifyIntegrity?, optimizeStorage?, generateReport?, onProgress? }` |
| `ExportResult` | `{ success, format, filename, blob, size, statistics }` |
| `ImportResult` | `{ success, regionId, message, warnings?, statistics }` |

## Functions

| Function | Description |
|---|---|
| `idbFetchHandler(url)` | Answer an `idb://` URL from IndexedDB, as a `Response` |
| `registerOfflineServiceWorker(url?)` | Register the Service Worker. Defaults to `/idb-offline-sw.js`. |
| `unregisterOfflineServiceWorker()` | Remove it |
| `convertStyleForServiceWorker(style)` | Rewrite a stored style's URLs for the Service Worker |
| `configureProxy({ tiles?, fonts? })` | Send requests for certain hosts through your proxy |
| `configureSqlJs({ wasmUrl?, wasmBinary? })` | Set where sql.js loads from |
| `resetOfflineMapDB()` | Delete the database and everything in it |
| `detectStyleProvider(url, style?)` | Returns `'mapbox'` or `'maplibre'` |
| `resolveMapboxUrl(url, token)` | Turn a `mapbox://` URL into an HTTPS one |
| `i18n`, `t(key, options?)` | [Language](./guides/ui-control.md#language) and translated text |

`dbPromise` resolves to the open database, and `OfflineMapDBVersionError` is the error it throws when the version is incompatible. The services behind the manager, such as `tileService`, are also exported for advanced use.

## Command line and Vite

| | Description |
|---|---|
| `npx map-gl-offline init` | Copy the Service Worker script to `public/` |
| `offlineSwPlugin()` from `map-gl-offline/vite-plugin` | Do the same on every Vite build |
