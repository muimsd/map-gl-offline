---
sidebar_position: 6
---

# Architecture

This document describes the internal architecture of `map-gl-offline`.

## Overview

`map-gl-offline` is designed with a modular, service-oriented architecture that separates concerns into distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  UI Control      │  │  OfflineMapManager                   │ │
│  │  (OfflineManager │  │  (Main API)                          │ │
│  │   Control)       │  │                                      │ │
│  └────────┬─────────┘  └──────────────────┬───────────────────┘ │
│           │                                │                     │
├───────────┴────────────────────────────────┴─────────────────────┤
│                           Services                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Tile   │ │  Font   │ │ Sprite  │ │  Style  │ │ Region  │   │
│  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
├───────┴───────────┴───────────┴───────────┴───────────┴─────────┤
│                        Storage Layer                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    IndexedDB Manager                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │  tiles  │ │  fonts  │ │ sprites │ │ styles  │ ...     │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── index.ts                    # Main exports
├── main.ts                     # Development entry point
├── managers/
│   └── offlineMapManager/      # Main manager (modular)
│       ├── index.ts            # Composed manager class
│       ├── base.ts             # Base functionality
│       ├── modules.ts          # Module composition
│       ├── regionManagement.ts # Region operations
│       ├── styleManagement.ts  # Style operations
│       ├── analyticsManagement.ts
│       ├── cleanupManagement.ts
│       ├── importExportManagement.ts
│       ├── maintenanceManagement.ts
│       └── resourceManagement.ts
├── services/
│   ├── tileService.ts          # Tile download/storage
│   ├── fontService.ts          # Font/glyph download
│   ├── glyphService.ts         # Glyph range management
│   ├── spriteService.ts        # Sprite download
│   ├── styleService.ts         # Style management
│   ├── regionService.ts        # Region CRUD
│   ├── modelService.ts         # 3D model (.glb) download/storage
│   ├── analyticsService.ts     # Storage analytics
│   ├── cleanupService.ts       # Data cleanup
│   ├── maintenanceService.ts   # Maintenance tasks
│   ├── importExportService.ts  # Import/export
│   └── resourceService.ts      # Resource management
├── storage/
│   └── indexedDbManager.ts     # IndexedDB wrapper
├── types/
│   ├── index.ts                # Type exports
│   ├── database.ts             # IndexedDB schema types
│   ├── region.ts               # Region types
│   ├── tile.ts                 # Tile types
│   ├── font.ts                 # Font types
│   ├── glyph.ts                # Glyph types
│   ├── sprite.ts               # Sprite types
│   ├── model.ts                # 3D model types
│   ├── style.ts                # Style types
│   ├── progress.ts             # Progress types
│   ├── cleanup.ts              # Cleanup types
│   ├── import-export.ts        # Import/export types
│   ├── maintenance.ts          # Maintenance types
│   └── ui.ts                   # UI types
├── ui/
│   ├── offlineManagerControl.ts # Main UI control
│   ├── ThemeManager.ts         # Theme management
│   ├── translations/           # Internationalization (i18n)
│   │   ├── index.ts            # I18nManager, language registration
│   │   ├── en.ts               # English translations
│   │   └── ar.ts               # Arabic translations (RTL)
│   ├── components/             # UI components
│   │   ├── shared/             # Reusable components
│   │   │   ├── BaseComponent.ts
│   │   │   ├── Button.ts
│   │   │   ├── LanguageSelector.ts
│   │   │   ├── List.ts
│   │   │   ├── MapControlButton.ts
│   │   │   ├── Modal.ts
│   │   │   ├── Panel.ts
│   │   │   ├── PanelContent.ts
│   │   │   └── RegionDrawingTool.ts
│   │   ├── DownloadProgress.ts
│   │   ├── PanelActions.ts
│   │   ├── PanelHeader.ts
│   │   └── RegionList.ts
│   ├── controls/               # Map controls
│   │   ├── polygonControl.ts
│   │   └── regionControl.ts
│   ├── managers/               # UI state managers
│   │   ├── ControlButtonManager.ts
│   │   ├── PanelManager.ts
│   │   └── downloadManager.ts
│   ├── modals/                 # Modal dialogs
│   │   ├── modalManager.ts
│   │   ├── regionFormModal.ts
│   │   ├── regionDetailsModal.ts
│   │   ├── importExportModal.ts
│   │   └── confirmationModal.ts
│   └── utils/
│       └── keyboardNav.ts      # Keyboard navigation helpers
├── sw/
│   ├── offline-sw.ts           # Service Worker entry (compiled to public/idb-offline-sw.js)
│   └── shared.ts               # Pure helpers shared with idbFetchHandler
└── utils/
    ├── index.ts                # Utility exports
    ├── logger.ts               # Logging utility
    ├── constants.ts            # Configuration constants
    ├── errorHandling.ts        # Error utilities
    ├── formatting.ts           # Format utilities (escapeHtml, etc.)
    ├── validation.ts           # Validation helpers
    ├── styleUtils.ts           # Style manipulation
    ├── styleProviderUtils.ts   # Mapbox/MapLibre provider detection & URL resolution
    ├── importResolver.ts       # Import resolution + sanitizeIndoorExpressions
    ├── tileKey.ts              # Tile key generation + extractTileExtensionFromUrl
    ├── download.ts             # Download utilities
    ├── idbFetchHandler.ts      # idb:// protocol fetch handler (main thread)
    ├── convertStyleForSW.ts    # Style conversion for Service Worker mode
    ├── swRegistration.ts       # Service Worker registration
    ├── cleanupCompressedTiles.ts # Compressed tile cleanup
    ├── sqlJsLoader.ts          # Lazy sql.js loader for MBTiles
    ├── proxyConfig.ts          # CORS proxy configuration
    ├── cssPrefix.ts            # CSS class prefixing
    └── icons.ts                # Icon definitions
```

## Core Components

### OfflineMapManager

The main API for programmatic access. It uses a module composition pattern where each management domain is a factory function that returns an interface of methods. All module methods are assigned onto the manager instance via `Object.assign`:

```typescript
// Composition pattern for the main manager
class OfflineMapManager implements OfflineMapManagerModules {
  constructor(overrides: OfflineManagerServiceOverrides = {}) {
    this.services = createManagerServices(overrides);
    this.modules = createOfflineMapManagerModules(this.services);
    Object.assign(this, this.modules);
  }
}
```

Each module provides specific functionality:

| Module                   | Responsibility                                |
| ------------------------ | --------------------------------------------- |
| `BaseManager`            | Core initialization, database access          |
| `RegionManagement`       | CRUD operations for regions                   |
| `StyleManagement`        | Style loading, patching, caching              |
| `AnalyticsManagement`    | Storage statistics and insights               |
| `CleanupManagement`      | Cleanup expired data                          |
| `ImportExportManagement` | Round-trip regions as binary MBTiles (SQLite) |
| `MaintenanceManagement`  | Verification, repair tasks                    |
| `ResourceManagement`     | Tile, font, sprite management                 |

### OfflineManagerControl

The MapLibre GL JS control that provides the UI. Implements the `IControl` interface:

```typescript
interface IControl {
  onAdd(map: Map): HTMLElement;
  onRemove(): void;
}
```

Internal components:

- **ButtonManager**: Control button with progress badge
- **PanelManager**: Main panel rendering and state
- **RegionControl**: Polygon drawing and region selection
- **DownloadManager**: Download coordination and progress
- **ModalManager**: Modal dialog lifecycle

### Services

Services handle specific data types and operations:

- **TileService** - Tile downloading, storage, and retrieval
- **FontService** - Font/glyph resource management
- **SpriteService** - Map sprite downloading and caching
- **StyleService** - Map style management and offline patching

See the [API Reference](./api-reference#services) for usage examples of each service.

### Storage Layer

#### IndexedDB Manager

Provides a clean API over IndexedDB using the `idb` library:

```typescript
// Database structure (version 4)
const db = await openDB('offline-map-db', DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    // Create stores for fresh installs (`regions` is deprecated but still created)
    const stores = ['regions', 'tiles', 'styles', 'sprites', 'glyphs', 'fonts', 'models'];
    for (const store of stores) {
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'key' });
      }
    }

    // Migration: v2 -> v3: move regions into styles.regions[]
    if (oldVersion > 0 && oldVersion < 3) {
      migrateRegionsToStyles(transaction);
    }
    // v3 -> v4 adds the `models` store; no data movement needed.
  },
});
```

Object stores:

| Store     | Purpose                                    | Notes                                                       |
| --------- | ------------------------------------------ | ----------------------------------------------------------- |
| `styles`  | Map styles with embedded `regions[]` array | Primary region storage                                      |
| `tiles`   | Vector/raster tile data                    | Keyed by `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}`     |
| `sprites` | Sprite images and JSON                     |                                                             |
| `glyphs`  | Font glyph data (PBF ranges)               |                                                             |
| `fonts`   | Font files                                 |                                                             |
| `models`  | 3D model assets (`.glb`)                   | Added in DB v4. Keyed by `{styleId}::model::{modelName}`.   |
| `regions` | **(deprecated)** Legacy region storage     | Only kept for migration; regions live in `styles.regions[]` |

Key features:

- Transaction management
- Cursor iteration for large datasets
- Schema migrations (v2 -> v3 -> v4)
- Quota checking

## Data Flow

### Download Flow

```
User initiates download
        │
        ▼
┌────────────────────────┐
│   OfflineMapManager    │
│    .downloadRegion()   │    ← primary programmatic entry point
└────────────┬───────────┘       (emits per-phase onProgress events)
             │
             ▼
┌──────────────────────────────┐     ┌────────────────┐
│    StyleService              │────▶│ Fetch style    │
│  .downloadStyleWithProvider()│     │ (if missing)   │
│     (phase: 'style')         │     └────────────────┘
└────────────┬─────────────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│    SpriteService       │────▶│ Fetch sprite   │
│   .downloadSprites()   │     │ images + JSON  │
│    (phase: 'sprites')  │     └────────────────┘
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│    GlyphService        │────▶│ Fetch glyphs   │
│    .downloadGlyphs()   │     │ for each font  │
│    (phase: 'glyphs')   │     └────────────────┘
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│    ModelService        │────▶│ Fetch 3D model │
│    .downloadModels()   │     │ assets (.glb)  │
│    (phase: 'models')   │     └────────────────┘
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│  Source probe (3 tiles │────▶│ Skip sparse    │
│  per source, majority  │     │ sources whose  │
│  rule)                 │     │ probes 404     │
└────────────┬───────────┘     └────────────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│    TileService         │────▶│ Fetch tiles    │
│    .downloadTiles()    │     │ in batches     │
│    (phase: 'tiles')    │     └────────────────┘
└────────────┬───────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────┐
│  RegionService         │────▶│ Persist region │
│  .addRegion()          │     │ metadata; patch│
│  (phase: 'metadata')   │     │ style to idb://│
└────────────┬───────────┘     └────────────────┘
             │
             ▼
┌────────────────────────┐
│     IndexedDB          │
│  (all data stored)     │
└────────────────────────┘
```

`addRegion` is the final metadata-only step of the pipeline — it can also be called directly when you want to record a region without downloading assets (e.g. after manually importing tiles via `importRegion`). Most callers use `downloadRegion` instead.

### Offline Load Flow

The library patches styles to use `idb://` protocol URLs, then intercepts those requests to serve data from IndexedDB. Two interception strategies are supported:

1. **`addProtocol` (MapLibre GL JS)**: Registers an `idb://` protocol handler via `maplibregl.addProtocol()`. This is the preferred approach for MapLibre.
2. **Service Worker (Mapbox GL JS v3)**: Since Mapbox GL JS does not support `addProtocol`, the library registers a Service Worker that intercepts `idb://` requests. Styles are converted to use Service Worker-compatible URLs via `convertStyleForSW`.

```
Map requests idb:// URL
        │
        ├──── MapLibre ────▶ addProtocol handler
        │                          │
        ├──── Mapbox GL ───▶ Service Worker
        │                          │
        ▼                          ▼
┌───────────────────┐    ┌───────────────────┐
│ idbFetchHandler   │    │ idbFetchHandler   │
│ parses URL type   │    │ parses URL type   │
└────────┬──────────┘    └────────┬──────────┘
         │                        │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
┌───────┐ ┌───────┐  ┌───────────┐ ┌────────┐
│ tiles │ │glyphs │  │  sprites  │ │ styles │
└───┬───┘ └───┬───┘  └─────┬─────┘ └────┬───┘
    │         │            │            │
    └─────────┴────────────┴────────────┘
                    │
                    ▼
           ┌───────────────┐
           │  IndexedDB    │
           │  lookup       │
           └───────┬───────┘
                   │
                   ▼
           ┌───────────────┐
           │ Return as     │
           │ Response obj  │
           └───────────────┘
```

## URL Protocol

For offline resources, the library uses a custom `idb://` protocol. The authority segment is the `styleId`, followed by a resource-kind segment and resource-specific path:

```
idb://{styleId}/tile/{sourceId}/{z}/{x}/{y}.{ext}
idb://{styleId}/glyph/{fontstack}/{range}.pbf
idb://{styleId}/sprite/{spriteName}          # optionally @2x and .png / .json
idb://{styleId}/model/{modelName}
idb://{styleId}/tilesjson/{encodedUrl}       # stored TileJSON responses
```

Styles themselves are loaded through `OfflineManagerControl.loadOfflineStyle(styleId)`, which reads the style from IndexedDB directly rather than via the protocol.

The fetch interceptor (MapLibre `addProtocol` / Mapbox Service Worker) converts these to IndexedDB lookups. For Mapbox GL JS the Service Worker path uses `/__offline__/{styleId}/tile/…` etc. internally, which `convertStyleForServiceWorker` rewrites from `idb://` on style load.

## Import Path Alias

All source files use the `@/` path alias (mapped to `src/*` in `tsconfig.json`) instead of relative paths. This provides consistent, refactor-friendly imports:

```typescript
// All imports use the @/ alias
import { loadStyles } from '@/services/styleService';
import { createTileKey, parseTileKey } from '@/utils/tileKey';
import { escapeHtml } from '@/utils/formatting';
```

## Tile Key Format

Tiles are stored with composite keys for efficient lookup. Use the `createTileKey()` utility from `src/utils/tileKey.ts` for consistent key generation:

```typescript
// Key format: {styleId}:{sourceId}:{z}:{x}:{y}.{extension}
import { createTileKey, parseTileKey } from 'map-gl-offline';

const key = createTileKey(x, y, z, styleId, sourceId, extension);

// Examples
const key = 'mapbox-streets-v12:mapbox.mapbox-streets-v8:14:4824:6159.pbf';
const rasterKey = 'satellite:mapbox.satellite:12:1204:1540.jpg';
```

Supported tile extensions: `pbf`, `mvt`, `png`, `jpg`, `jpeg`, `webp`, `glb`.

## Mapbox Standard Style Processing

The library supports Mapbox GL v3+ styles that use the `imports` array (e.g., Mapbox Standard). The `importResolver` recursively fetches imported styles and flattens their sources, layers, sprites, and glyphs into the outer style so the existing download pipeline works unchanged.

Key capabilities:

- **Import resolution**: Resolves nested `imports[]` up to 5 levels deep (per Mapbox spec)
- **Config merging**: Applies `config` overrides from imports (e.g., `lightPreset`, font settings)
- **Indoor-expression sanitization**: Rewrites `["is-active-floor"]` → `false` and `["floor-level"]` → `0` in layer filters. These expressions read `map.indoor.activeFloors` at filter-compile time; stripping the `imports` wrapper for offline rendering would otherwise crash `setStyle()` with `"Cannot read properties of null (reading 'activeFloors')"`. The sanitizer runs automatically from `resolveImports` (download) and at style load time (for regions downloaded on 0.8.0 before the fix landed).
- **Mapbox CDN URL rewriting**: Rewrites Mapbox CDN raster tile URLs to use the correct API format with access tokens
- **3D model sources**: Handles `model` source types and `glb` tile extensions used by Mapbox Standard. Models are stored keyed `{styleId}::model::{name}` and served from IDB at runtime as `idb://{styleId}/model/{name}` (or `/__offline__/{styleId}/model/{name}` via the Service Worker).
- **raster-dem sources**: Supports terrain DEM sources for 3D terrain rendering

**Known limitation**: the Mapbox API returns Standard with the `imports` wrapper already expanded, so the stored offline style is flat. Runtime config APIs like `map.setConfigProperty('basemap', 'lightPreset', 'night')` have no visible effect offline — the style is baked to the schema default (`"day"`) at download time. Re-downloading after toggling the preset is the current workaround.

## Service Worker

For Mapbox GL v3 (which lacks `addProtocol`), worker-scoped resource fetches can't be intercepted by a `window.fetch` override. The library ships an offline Service Worker that catches `/__offline__/{downloadId}/{type}/{path}` requests and serves them from IndexedDB.

- **Source**: `src/sw/offline-sw.ts` (TypeScript, 0.8.2+). Compiled by `scripts/build-sw.mjs` (esbuild) into a single self-contained `public/idb-offline-sw.js` with all helpers inlined — no import statements in the output since SW globals can't load ESM modules. The output is checked in so vite serves a current copy and npm consumers don't need to run our build.
- **Shared helpers**: `src/sw/shared.ts` holds pure key-computation functions (`makeTileKey`, `tileFallbackExtensions`, `findStyleByRegionIdIn`, `glyphCandidateKeys`, `spriteCandidateKeys`, `modelCandidateKeys`, `matchTileJsonSource`, `buildOfflineTileJson`, …). Both the SW and `src/utils/idbFetchHandler.ts` (main-thread) import them so a fix to the fallback order or candidate keys lands in one place.
- **Rebuilding**: `npm run build:sw-src` when `src/sw/*.ts` changes. `npm run build` runs it automatically.
- **Resource types handled**: `tile`, `glyph`, `sprite`, `model`, `tilesjson`. (0.8.1 added `model` — before that, worker-scoped `.glb` fetches for Mapbox Standard 3D trees / wind turbines 400'd.)

## Error Handling

Errors are categorized for appropriate handling:

```typescript
enum ErrorType {
  NETWORK = 'NETWORK', // Transient network failures (retryable)
  CORS = 'CORS', // CORS policy errors (not retryable)
  STORAGE = 'STORAGE', // IndexedDB or storage-related errors
  VALIDATION = 'VALIDATION', // Invalid input/configuration
  PARSE = 'PARSE', // JSON parsing or data format errors
  QUOTA = 'QUOTA', // Storage quota exceeded
  UNKNOWN = 'UNKNOWN', // Uncategorized errors
}
```

## Logging

Scoped logging with configurable levels:

```typescript
import { logger } from 'map-gl-offline';

// Create a scoped logger for a component
const log = logger.scope('ComponentName');

log.debug('Detailed info'); // Dev only
log.info('General info'); // Always
log.warn('Warning'); // Always
log.error('Error', error); // Always
```

## Configuration

Centralized constants prevent magic numbers:

```typescript
// src/utils/constants.ts
export const DB_NAME = 'offline-map-db';
export const DB_VERSION = 4;

export const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10,
  MAX_CONCURRENCY: 5,
  MAX_RETRIES: 3,
  TIMEOUT: 10000,
  RETRY_DELAY: 1000,
};

export const TILE_CONFIG = {
  MIN_ZOOM: 0,
  MAX_ZOOM: 24,
  DEFAULT_EXTENSION: 'pbf',
  SUPPORTED_EXTENSIONS: ['pbf', 'mvt', 'png', 'jpg', 'jpeg', 'webp', 'glb'],
};

export const MAPBOX_API = {
  BASE_URL: 'https://api.mapbox.com',
  STYLES_PATH: '/styles/v1',
  FONTS_PATH: '/fonts/v1',
  TILES_PATH: '/v4',
  MODELS_PATH: '/models/v1',
  PROTOCOL: 'mapbox://',
};
```

## Testing Strategy

```
tests/
├── services/               # Service unit tests
│   ├── tileService.test.ts
│   ├── fontService.test.ts
│   ├── glyphService.test.ts
│   ├── spriteService.test.ts
│   ├── styleService.test.ts
│   ├── regionService.test.ts
│   ├── cleanupService.test.ts
│   ├── analyticsService.test.ts
│   ├── maintenanceService.test.ts
│   ├── importExportService.test.ts
│   └── resourceService.test.ts
├── storage/                # Storage layer tests
│   └── indexedDbManager.test.ts
├── utils/                  # Utility tests
├── ui/                     # UI component tests
│   ├── offlineManagerControl.test.ts
│   ├── ThemeManager.test.ts
│   ├── components/
│   ├── controls/
│   ├── managers/
│   └── modals/
├── integration/            # Integration tests
│   └── serviceIntegration.test.ts
├── e2e/                    # End-to-end tests
│   └── downloadTiles.test.ts
├── offlineManager.test.ts  # Main manager tests
└── setup.ts                # Test setup (fake-indexeddb)
```

Key testing patterns:

- Mock IndexedDB with `fake-indexeddb`
- Mock fetch for network tests
- Jest for unit/integration tests
- Puppeteer for E2E tests

## Performance Considerations

1. **Batch Downloads**: Tiles downloaded in configurable batches to avoid overwhelming the browser
2. **Concurrent Limits**: Respects browser's connection limits (6 per host)
3. **Memory Management**: Streams large data instead of loading into memory
4. **Lazy Loading**: Services loaded on demand
5. **Efficient Queries**: IndexedDB indexes for common lookups

## Security Considerations

1. **No Credentials Storage**: API keys should be handled by the application
2. **CORS Handling**: Development proxy for local testing
3. **Quota Limits**: Respects browser storage quotas
4. **Data Validation**: Input validation before storage
5. **XSS Prevention**: User-provided data (region names, IDs) is sanitized with `escapeHtml()` before rendering in HTML templates
