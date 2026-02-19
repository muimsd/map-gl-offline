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
└── utils/
    ├── index.ts                # Utility exports
    ├── logger.ts               # Logging utility
    ├── constants.ts            # Configuration constants
    ├── errorHandling.ts        # Error utilities
    ├── formatting.ts           # Format utilities (escapeHtml, etc.)
    ├── validation.ts           # Validation helpers
    ├── styleUtils.ts           # Style manipulation
    ├── styleProviderUtils.ts   # Mapbox/MapLibre provider detection & URL resolution
    ├── importResolver.ts       # Mapbox Standard style import resolution
    ├── tileKey.ts              # Tile key generation
    ├── download.ts             # Download utilities
    ├── idbFetchHandler.ts      # idb:// protocol fetch handler
    ├── convertStyleForSW.ts    # Style conversion for Service Worker mode
    ├── swRegistration.ts       # Service Worker registration
    ├── cleanupCompressedTiles.ts # Compressed tile cleanup
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

| Module | Responsibility |
|-------|----------------|
| `BaseManager` | Core initialization, database access |
| `RegionManagement` | CRUD operations for regions |
| `StyleManagement` | Style loading, patching, caching |
| `AnalyticsManagement` | Storage statistics and insights |
| `CleanupManagement` | Cleanup expired data |
| `ImportExportManagement` | Import/export to various formats |
| `MaintenanceManagement` | Verification, repair tasks |
| `ResourceManagement` | Tile, font, sprite management |

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

#### TileService

Handles tile downloading, storage, and retrieval:

```typescript
// Key operations
await TileService.downloadTiles(sourceUrl, bounds, minZoom, maxZoom, options);
await TileService.getTile(z, x, y, sourceId);
await TileService.deleteTilesForRegion(regionId);
```

#### FontService

Manages font/glyph resources:

```typescript
await FontService.downloadFonts(fontUrl, fontStacks, options);
await FontService.getGlyph(fontStack, range);
```

#### SpriteService

Handles map sprites:

```typescript
await SpriteService.downloadSprites(spriteUrl, options);
await SpriteService.getSprite(spriteUrl, resolution);
```

#### StyleService

Manages map styles:

```typescript
await StyleService.saveStyle(styleId, styleJson);
const style = await loadStyleById(styleId);
const patched = patchStyleForOffline(style, styleId);
```

### Storage Layer

#### IndexedDB Manager

Provides a clean API over IndexedDB using the `idb` library:

```typescript
// Database structure (version 3)
const db = await openDB('offline-map-db', DB_VERSION, {
  upgrade(db, oldVersion, _newVersion, transaction) {
    // Create stores for fresh installs
    const stores = ['regions', 'tiles', 'styles', 'sprites', 'glyphs', 'fonts'];
    for (const store of stores) {
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'key' });
      }
    }

    // Migration: v2 -> v3: move regions into styles.regions[]
    if (oldVersion > 0 && oldVersion < 3) {
      migrateRegionsToStyles(transaction);
    }
  },
});
```

Object stores:

| Store | Purpose | Notes |
|-------|---------|-------|
| `styles` | Map styles with embedded `regions[]` array | Primary region storage |
| `tiles` | Vector/raster tile data | Keyed by `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}` |
| `sprites` | Sprite images and JSON | |
| `glyphs` | Font glyph data (PBF ranges) | |
| `fonts` | Font files | |
| `regions` | **(deprecated)** Legacy region storage | Only kept for migration; regions live in `styles.regions[]` |

Key features:
- Transaction management
- Cursor iteration for large datasets
- Schema migrations (v1 -> v2 -> v3)
- Quota checking

## Data Flow

### Download Flow

```
User initiates download
        │
        ▼
┌───────────────────┐
│ OfflineMapManager │
│   .addRegion()    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐     ┌──────────────┐
│  StyleService     │────▶│ Fetch style  │
│  .downloadStyle() │     │ JSON         │
└────────┬──────────┘     └──────────────┘
         │
         ▼
┌───────────────────┐     ┌──────────────┐
│  SpriteService    │────▶│ Fetch sprite │
│  .downloadSprites │     │ images & JSON│
└────────┬──────────┘     └──────────────┘
         │
         ▼
┌───────────────────┐     ┌──────────────┐
│  FontService      │────▶│ Fetch glyphs │
│  .downloadFonts() │     │ for each font│
└────────┬──────────┘     └──────────────┘
         │
         ▼
┌───────────────────┐     ┌──────────────┐
│  TileService      │────▶│ Fetch tiles  │
│  .downloadTiles() │     │ in batches   │
└────────┬──────────┘     └──────────────┘
         │
         ▼
┌───────────────────┐
│  IndexedDB        │
│  (all data stored)│
└───────────────────┘
```

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

For offline resources, the library uses a custom `idb://` protocol:

```
idb://tiles/{styleId}/{sourceId}/{z}/{x}/{y}
idb://fonts/{styleId}/{fontStack}/{range}
idb://sprites/{styleId}/{spriteName}[@2x]
idb://styles/{styleId}
```

The fetch interceptor converts these to IndexedDB lookups.

## Tile Key Format

Tiles are stored with composite keys for efficient lookup:

```typescript
// Key format: {styleId}:{sourceId}:{z}:{x}:{y}.{extension}
const key = `${styleId}:${sourceId}:${z}:${x}:${y}.${extension}`;

// Examples
const key = "mapbox-streets-v12:mapbox.mapbox-streets-v8:14:4824:6159.pbf";
const rasterKey = "satellite:mapbox.satellite:12:1204:1540.jpg";
```

Supported tile extensions: `pbf`, `mvt`, `png`, `jpg`, `jpeg`, `webp`, `glb`.

## Mapbox Standard Style Processing

The library supports Mapbox GL v3+ styles that use the `imports` array (e.g., Mapbox Standard). The `importResolver` recursively fetches imported styles and flattens their sources, layers, sprites, and glyphs into the outer style so the existing download pipeline works unchanged.

Key capabilities:
- **Import resolution**: Resolves nested `imports[]` up to 5 levels deep (per Mapbox spec)
- **Config merging**: Applies `config` overrides from imports (e.g., `lightPreset`, font settings)
- **Mapbox CDN URL rewriting**: Rewrites Mapbox CDN raster tile URLs to use the correct API format with access tokens
- **3D model sources**: Handles `model` source types and `glb` tile extensions used by Mapbox Standard
- **raster-dem sources**: Supports terrain DEM sources for 3D terrain rendering

## Error Handling

Errors are categorized for appropriate handling:

```typescript
enum ErrorType {
  NETWORK = 'network',      // Network failures
  QUOTA = 'quota',          // Storage quota exceeded
  VALIDATION = 'validation', // Invalid input
  DATABASE = 'database',     // IndexedDB errors
  UNKNOWN = 'unknown',       // Unexpected errors
}
```

## Logging

Scoped logging with configurable levels:

```typescript
const logger = createLogger('ComponentName');

logger.debug('Detailed info');  // Dev only
logger.info('General info');     // Always
logger.warn('Warning');          // Always
logger.error('Error', error);    // Always
```

## Configuration

Centralized constants prevent magic numbers:

```typescript
// src/utils/constants.ts
export const DB_NAME = 'offline-map-db';
export const DB_VERSION = 3;

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
