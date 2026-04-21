# CLAUDE.md

This file provides guidance for Claude (AI assistant) when working with this codebase.

## Project Overview

**map-gl-offline** is a TypeScript library for offline map storage with MapLibre GL JS / Mapbox GL JS. It enables comprehensive offline storage of vector/raster tiles, sprites, styles, fonts (glyphs), and entire map regions.

## Tech Stack

- **Language**: TypeScript
- **Build**: Rollup, Vite
- **Testing**: Jest with fake-indexeddb
- **Linting**: ESLint + Prettier
- **Storage**: IndexedDB via `idb` library
- **UI**: Tailwind CSS (build-time only)

## Project Structure

```
src/
├── index.ts              # Main entry point, public API exports
├── managers/             # High-level managers (OfflineMapManager)
├── services/             # Core business logic services
│   ├── tileService.ts    # Tile downloading and storage
│   ├── styleService.ts   # Style management
│   ├── regionService.ts  # Region CRUD operations
│   ├── cleanupService.ts # Storage cleanup and analytics
│   └── ...
├── storage/
│   └── indexedDbManager.ts  # IndexedDB initialization and migrations
├── types/                # TypeScript type definitions
├── ui/                   # UI components and controls
│   ├── offlineManagerControl.ts  # MapLibre/Mapbox control
│   ├── components/       # Reusable UI components
│   ├── managers/         # UI state managers
│   └── translations/     # i18n (en, ar)
└── utils/                # Utility functions and constants
```

## Key Architectural Decisions

### Region Storage
Regions are stored inside `styles.regions[]` array, NOT in a separate `regions` table. The `regions` IndexedDB store is deprecated and only kept for migration purposes.

```typescript
// Correct: regions inside styles
const style = await db.get('styles', styleId);
const regions = style.regions; // Array of regions

// Wrong: don't use the regions store directly
// await db.get('regions', regionId); // Deprecated
```

### Database Version
Current DB version is **4**. Migrations are handled in `src/storage/indexedDbManager.ts`. When on-disk version > supported version, `dbPromise` throws `OfflineMapDBVersionError` (not raw `DOMException`); consumers can call `resetOfflineMapDB()` to recover.

v4 adds the `models` store for 3D model assets (Mapbox Standard trees / wind turbines). Stored entries are keyed `{styleId}::model::{modelName}` with ArrayBuffer data, served back via `idb://{styleId}/model/{name}` URLs in the fetch handler.

### Tile Keys
Tiles are keyed as: `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}`

Use `createTileKey()` from `src/utils/tileKey.ts` for consistent key generation.

### Region Download Pipeline
`OfflineMapManager.downloadRegion(region, options?)` is the primary programmatic entry point. It runs the full pipeline (style → sprites → glyphs → tiles → metadata) with per-phase `onProgress`. `loadRegion` is an alias.

`addRegion` only stores region metadata and patches the style's URLs to `idb://`. It does **not** fetch tiles, sprites, or glyphs. Most callers want `downloadRegion`.

Tile downloads probe each source with 3 representative tiles (start/middle/end) before committing the full plan; sources with majority-404 (sparse-for-this-region) are skipped. Disable via `tileOptions: { probeSourcesBeforeDownload: false }`.

### `OfflineRegionOptions.expiry`
`expiry` is an **absolute timestamp** (ms since epoch), matching the type doc. `addRegion` stores it verbatim. If omitted, it defaults to `Date.now() + 30 days`. Do not add `Date.now()` to caller-supplied values — that was a pre-0.6.0 bug that corrupted real timestamps.

### Region dedup
`addRegion` upserts by `region.id` (not bounds). Two regions sharing bounds with distinct ids both persist; repeated id → replaced in place (`created` preserved, `updated` refreshed).

### Resource-Key Boundaries
Font/glyph/sprite keys are `styleId:…` (single colon). For deletion/cleanup, use `resourceKeyBelongsToStyle(key, styleId)` from `src/services/regionService.ts`, not ad-hoc `startsWith`, to avoid collisions with sibling styles like `abc_def`.

### Import Aliases
All source files use the `@/` path alias (mapped to `src/*` in tsconfig.json). Use `@/` imports instead of relative paths (`../`):

```typescript
// Correct
import { loadStyles } from '@/services/styleService';

// Wrong
import { loadStyles } from '../services/styleService';
```

### OfflineMapManager class shape
The class uses class/interface declaration merging — every method from the `*Management` module interfaces is attached at runtime via `Object.assign(this, this.modules)` in the constructor. Adding a new method to a `*Management` interface makes it automatically available on `OfflineMapManager` with no edits to `src/managers/offlineMapManager/index.ts`.

## Common Commands

```bash
npm test              # Run all tests
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript compiler check
npm run build         # Build the library
npm run dev           # Start Vite dev server
```

## Testing

- Tests use `fake-indexeddb` for IndexedDB simulation
- Test files are in `tests/` directory, mirroring `src/` structure
- Always clear relevant stores in `beforeEach`:
  ```typescript
  beforeEach(async () => {
    const db = await dbPromise;
    await db.clear('styles');
    await db.clear('tiles');
    // Don't clear 'regions' - it's deprecated
  });
  ```

## Code Style

- Use Prettier for formatting (auto-runs on commit)
- Avoid non-null assertions (`!`) - use proper null checks
- Prefer `const` over `let`
- Use async/await over `.then()` chains (except in IndexedDB upgrade transactions)
- Use `@/` path alias for all imports (not relative `../` paths)
- No emojis in code unless explicitly requested

## Important Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Public API exports |
| `src/storage/indexedDbManager.ts` | DB initialization & migrations |
| `src/utils/constants.ts` | All magic numbers and config |
| `src/types/database.ts` | IndexedDB schema types |
| `src/services/cleanupService.ts` | Storage size calculations |
| `src/utils/tileKey.ts` | Tile key generation (`createTileKey`, `parseTileKey`) |
| `src/utils/formatting.ts` | XSS prevention (`escapeHtml`) |

## Commit Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Do NOT include Claude Code watermark in commits
- Keep commits focused and atomic

## Things to Avoid

1. Writing to the deprecated `regions` store
2. Using `async/await` inside IndexedDB `upgrade` callbacks (use IDBRequest callbacks)
3. Adding `db.clear('regions')` in new tests
4. Hardcoding DB version numbers (use `DB_VERSION` constant)
5. Treating `region.expiry` as a duration — it's an absolute timestamp (ms since epoch)
6. Using `addRegion` to download tiles — it's metadata-only; use `downloadRegion`
7. `startsWith(styleId + '_')` for resource cleanup — use `resourceKeyBelongsToStyle()`
8. Using the old `getXxxStatistics` names on `ResourceService` — they were renamed to `getXxxStats` in 0.6.0
