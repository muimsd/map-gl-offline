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
`OfflineMapManager.downloadRegion(region, options?)` is the primary programmatic entry point. It runs the full pipeline (style → sprites → glyphs → models → tiles → metadata) with per-phase `onProgress`. `loadRegion` is an alias.

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

`tsc` does not rewrite path aliases in emitted declarations, so `build:types` runs `tsc-alias` after `tsc` to rewrite `@/` to relative paths in the published `.d.ts`. Do **not** drop `tsc-alias` from `build:types` — without it every shipped declaration imports from an unresolvable `@/...` path and consumer types silently degrade to `any`.

### OfflineMapManager class shape
The class uses class/interface declaration merging — every method from the `*Management` module interfaces is attached at runtime via `Object.assign(this, this.modules)` in the constructor. Adding a new method to a `*Management` interface makes it automatically available on `OfflineMapManager` with no edits to `src/managers/offlineMapManager/index.ts`.

### Import/Export is MBTiles-only
`OfflineMapManager.exportRegionAsMBTiles(regionId, options?)` / `importRegion({ file, format: 'mbtiles', ... })` are the public surface. No JSON or PMTiles paths — they were removed in 0.8.0 once we confirmed JSON produced non-standard files and the PMTiles impl was fake. Invariants for the MBTiles writer in `src/services/importExportService.ts`:

- Vector tiles (`pbf`/`mvt`) are gzipped on export via `CompressionStream('gzip')` — idempotent on already-gzipped bytes. On import they're gunzipped so the offline fetch handler keeps serving raw PBF. Raster tiles pass through untouched.
- `tile_row` is flipped to TMS on export and back to XYZ on import via `flipY(y, z) = (2^z - 1) - y`.
- For vector exports, the `json` metadata row is required by QGIS / tippecanoe / maplibre-native. `buildVectorJsonMetadata` derives `vector_layers` from the offline style's sources (populated by `styleService`'s TileJSON expansion) and filters by the source ids that actually contributed tiles.
- `type` metadata is `baselayer` for vector, `overlay` for raster.
- `parseMBTiles` validates the SQLite magic header (`"SQLite format 3"`) and the presence of `metadata` / `tiles` tables up front, so a non-MBTiles file renamed to `.mbtiles` gets a clear error instead of a cryptic one from sql.js.

`sql.js` is dynamically imported so it only ships with bundles that call MBTiles code. Default wasm source is jsDelivr; override with `configureSqlJs({ wasmUrl })` or `configureSqlJs({ wasmBinary })`. Tests use `wasmBinary` from `node_modules/sql.js/dist/sql-wasm.wasm` and polyfill `CompressionStream` / `DecompressionStream` from `node:stream/web` in `tests/setup.ts`.

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
9. Referencing `exportRegionAsJSON` or `exportRegionAsPMTiles` — both were removed in 0.8.0. MBTiles is the only supported format; use `exportRegionAsMBTiles` / `importRegion({ format: 'mbtiles' })`.
10. Skipping the gzip step for vector tiles in MBTiles output — QGIS/tippecanoe will reject the file. `gzipBytes` in `importExportService.ts` is idempotent, so it's safe to always call.
11. Exporting vector tiles without populating `metadata.json` — QGIS can't resolve `vector_layers` without it. `buildVectorJsonMetadata` derives the value from the offline style.
12. Hand-writing raw `"start-end"` glyph ranges — `GLYPH_CONFIG.COMPREHENSIVE_RANGES` is generated from `GLYPH_COVERAGE_SPANS` in `constants.ts`. Glyph servers only accept 256-aligned blocks (`k*256`–`k*256+255`); strict ones (MapTiler) reject anything else with HTTP 400. To extend coverage, add a Unicode span — never an output range.
13. Closing GitHub issues without explicit instruction — never run `gh issue close`, and never use auto-closing keywords (`Fixes #NN`, `Closes #NN`, `Resolves #NN`) in commit messages or PR descriptions, since those auto-close the issue on merge. The maintainer closes issues themselves. Leave fixed issues open and say they're ready to close; reference issues with non-closing forms (`Refs #NN`, `Re #NN`, or plain `#NN`). Only close when explicitly told to.
14. Typing `OfflineManagerControl`'s public/`IControl` surface with a renderer-specific `Map` — the control supports both MapLibre and Mapbox GL. `onAdd` takes the structural `ControlMap` so the class stays assignable to *both* libraries' `IControl` (callers need no cast). Keep public control signatures renderer-agnostic; `src/main.ts` adds the control to a Mapbox map cast-free as the compile-time guard.
15. Typing a public-surface `accessToken` as just `string` — match upstream Mapbox GL's `accessToken: string | null` so callers can pass `mapboxgl.accessToken` directly without a cast. All public types (`OfflineRegionOptions`, `DownloadRegionOptions`, `StyleDownloadOptions`, `OfflineManagerControlOptions`, manager methods, and any internal pass-through types they hit) widen to `string | null`. Treat `null` as omitted — every consumer already uses `||`/`??` to coerce, so no runtime change is needed when widening a new surface.
16. Passing `mapLib: mapboxgl` to `OfflineManagerControl` in Mapbox GL JS v3 examples — Mapbox GL v3 has **no** `addProtocol`/`removeProtocol`, so it doesn't satisfy the `MapLibProtocol` shape and TypeScript will reject it. Omit `mapLib` entirely for Mapbox; the library falls back to the Service Worker path (registered automatically when no mapLib is provided) for offline tile serving. Only pass `mapLib` for MapLibre GL (`mapLib: maplibregl`), where `addProtocol` exists and lets the `idb://` scheme work inside web workers too.
17. Trying to "fix" or suppress 404s from `mapbox.indoor-v3`, `mapbox.mapbox-landmark-pois-v1`, or `mapbox.procedural-buildings-v1` at the fetch / logging layer — you can't. Browsers log all non-2xx network responses at the protocol layer before JS sees the response; no fetch wrapping suppresses that. Instead, drop these three sources from the download plan *before* any request is issued. The allowlist lives in `MAPBOX_STANDARD_SPARSE_TILESETS` (`src/utils/constants.ts`) and the matcher in `urlReferencesKnownSparseTileset` (`src/services/tileService.ts`) handles all three URL forms (`mapbox://<id>`, resolved `/v4/<id>.json`, resolved `/v4/<id>/{z}/{x}/{y}`). To add a newly-discovered sparse tileset, extend the constant — don't try to detect sparseness dynamically. Copy tileset ids verbatim from the live style (`GET /styles/v1/mapbox/standard`): the landmark-POI one is `mapbox.mapbox-landmark-pois-v1` with a doubled `mapbox` segment, and since the matcher is delimiter-anchored, an approximate id silently never matches. `tests/services/tileService.test.ts` pins all three.
18. Adding a runtime dependency to the UMD `external` list — `dist/index.umd.js` is what the docs point CDN users at, and a CDN page has no module resolver. `idb`, `@mapbox/tilebelt`, `i18next` and the `@turf/*` packages publish no UMD global, so externalizing one produces a bundle that loads and then fails at the first call into it. `rollup.config.js` builds UMD from its own config whose `umdExternal` allows only `mapbox-gl` / `maplibre-gl` / `sql.js`; `scripts/check-umd.mjs` (wired into `build:lib`) fails the build otherwise. `sql.js` stays external because it's ~1.5 MB and lazily imported — `getSqlJs()` falls back to the `initSqlJs` global for CDN pages.
19. Putting a test under `tests/dist/` — the root `.gitignore` has a bare `dist/` rule, so anything there is silently untracked. Built-artifact tests live in `tests/bundle/` and must skip themselves when `dist/` is absent (`existsSync` + `describe.skip`), since `npm run validate` runs the suite before `npm run build`.
