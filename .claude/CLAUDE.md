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
Current DB version is **3**. Migrations are handled in `src/storage/indexedDbManager.ts`.

### Tile Keys
Tiles are keyed as: `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}`

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
- No emojis in code unless explicitly requested

## Important Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Public API exports |
| `src/storage/indexedDbManager.ts` | DB initialization & migrations |
| `src/utils/constants.ts` | All magic numbers and config |
| `src/types/database.ts` | IndexedDB schema types |
| `src/services/cleanupService.ts` | Storage size calculations |

## Commit Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Do NOT include Claude Code watermark in commits
- Keep commits focused and atomic

## Things to Avoid

1. Writing to the deprecated `regions` store
2. Using `async/await` inside IndexedDB `upgrade` callbacks (use IDBRequest callbacks)
3. Adding `db.clear('regions')` in new tests
4. Hardcoding DB version numbers (use `DB_VERSION` constant)
