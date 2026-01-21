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
│   ├── region.ts               # Region types
│   ├── tile.ts                 # Tile types
│   ├── font.ts                 # Font types
│   ├── sprite.ts               # Sprite types
│   ├── style.ts                # Style types
│   ├── progress.ts             # Progress types
│   ├── cleanup.ts              # Cleanup types
│   ├── import-export.ts        # Import/export types
│   └── ui.ts                   # UI types
├── ui/
│   ├── offlineManagerControl.ts # Main UI control
│   ├── ThemeManager.ts         # Theme management
│   ├── components/             # UI components
│   │   ├── shared/             # Reusable components
│   │   │   ├── BaseComponent.ts
│   │   │   ├── Button.ts
│   │   │   ├── Modal.ts
│   │   │   ├── Panel.ts
│   │   │   └── ...
│   │   ├── DownloadProgress.ts
│   │   ├── RegionList.ts
│   │   └── PanelHeader.ts
│   ├── controls/               # Map controls
│   │   ├── polygonControl.ts
│   │   └── regionControl.ts
│   ├── managers/               # UI state managers
│   │   ├── ControlButtonManager.ts
│   │   ├── PanelManager.ts
│   │   └── downloadManager.ts
│   └── modals/                 # Modal dialogs
│       ├── modalManager.ts
│       ├── regionFormModal.ts
│       ├── regionDetailsModal.ts
│       ├── importExportModal.ts
│       └── confirmationModal.ts
└── utils/
    ├── index.ts                # Utility exports
    ├── logger.ts               # Logging utility
    ├── constants.ts            # Configuration constants
    ├── errorHandling.ts        # Error utilities
    ├── formatting.ts           # Format utilities
    ├── validation.ts           # Validation helpers
    ├── styleUtils.ts           # Style manipulation
    ├── tileKey.ts              # Tile key generation
    ├── download.ts             # Download utilities
    ├── idbFetchHandler.ts      # IDB fetch interceptor
    └── icons.ts                # Icon definitions
```

## Core Components

### OfflineMapManager

The main API for programmatic access. It's composed of multiple mixins for modularity:

```typescript
// Composition pattern for the main manager
class OfflineMapManager extends compose(
  BaseManager,
  RegionManagement,
  StyleManagement,
  AnalyticsManagement,
  CleanupManagement,
  ImportExportManagement,
  MaintenanceManagement,
  ResourceManagement
) {}
```

Each mixin provides specific functionality:

| Mixin | Responsibility |
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
// Database structure
const db = await openDB('map-gl-offline', 1, {
  upgrade(db) {
    db.createObjectStore('tiles', { keyPath: 'key' });
    db.createObjectStore('fonts', { keyPath: 'key' });
    db.createObjectStore('sprites', { keyPath: 'key' });
    db.createObjectStore('styles', { keyPath: 'key' });
    db.createObjectStore('regions', { keyPath: 'id' });
  },
});
```

Key features:
- Transaction management
- Cursor iteration for large datasets
- Index-based queries
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

```
Network goes offline
        │
        ▼
┌───────────────────┐
│ Fetch interceptor │
│ detects idb:// URL│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ idbFetchHandler   │
│ parses URL type   │
└────────┬──────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
┌───────┐ ┌───────┐  ┌───────────┐ ┌────────┐
│ tiles │ │ fonts │  │  sprites  │ │ styles │
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
// Key format: {regionId}_{sourceId}_{z}_{x}_{y}
const key = `${regionId}_${sourceId}_${z}_${x}_${y}`;

// Example
const key = "nyc_openmaptiles_14_4824_6159";
```

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
export const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10,
  MAX_RETRIES: 3,
  TIMEOUT: 10000,
  RETRY_DELAY: 1000,
};

export const TILE_CONFIG = {
  MIN_ZOOM: 0,
  MAX_ZOOM: 22,
  TILE_SIZE: 256,
};

export const DB_CONFIG = {
  NAME: 'map-gl-offline',
  VERSION: 1,
};
```

## Testing Strategy

```
tests/
├── unit/
│   ├── services/           # Service unit tests
│   ├── storage/            # Storage layer tests
│   └── utils/              # Utility tests
├── integration/
│   ├── download.test.ts    # Full download flow
│   └── offline.test.ts     # Offline behavior
└── e2e/
    └── control.test.ts     # UI control tests
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
