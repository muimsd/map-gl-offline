/**
 * Runtime contract for the UMD bundle the docs point CDN users at.
 *
 * `dist/` is a build artifact, so these tests skip when it hasn't been built.
 * The static equivalent (no external module ids in the UMD wrapper) runs as
 * part of `npm run build` via `scripts/check-umd.mjs`.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const UMD_PATH = resolve(__dirname, '..', '..', 'dist', 'index.umd.js');
const built = existsSync(UMD_PATH);
const describeIfBuilt = built ? describe : describe.skip;

describeIfBuilt('dist/index.umd.js', () => {
  // The globals a CDN page actually has. Deliberately no `idb`, `i18next`,
  // `tilebelt` or `turf*` — those ship no UMD build, so the bundle must
  // carry its own copies.
  let lib: Record<string, unknown>;

  beforeAll(() => {
    // jsdom ships no matchMedia; the theme manager reads it at module load.
    if (typeof window.matchMedia !== 'function') {
      (window as unknown as Record<string, unknown>).matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      });
    }

    const source = readFileSync(UMD_PATH, 'utf8');
    // Evaluate at global scope, exactly like a <script> tag: no module
    // wrapper, no bundler-provided dependencies.
    new Function(source)();
    lib = (globalThis as unknown as Record<string, Record<string, unknown>>).mapgloffline;
  });

  it('exposes the documented `mapgloffline` global', () => {
    expect(lib).toBeDefined();
    expect(typeof lib.OfflineMapManager).toBe('function');
    expect(typeof lib.OfflineManagerControl).toBe('function');
  });

  it.each([
    'dbPromise',
    'resetOfflineMapDB',
    'OfflineMapDBVersionError',
    'loadAllStoredRegions',
    'resourceKeyBelongsToStyle',
    'configureSqlJs',
    'createTileKey',
    'parseTileKey',
    'deriveTileExtension',
    'extractTileExtensionFromUrl',
    'patchStyleForOffline',
    'normalizeSpriteProperty',
    'hasImports',
    'resolveImports',
    'sanitizeIndoorExpressions',
    'detectStyleProvider',
    'resolveMapboxUrl',
    'isMapboxProtocol',
    'extractAccessToken',
    'processStyleSources',
    'validateStyleForProvider',
    'categorizeError',
    'getUserErrorMessage',
    'safeExecute',
    'ErrorType',
    'logger',
    'configureLogger',
    'LogLevel',
    'i18n',
    't',
    'DB_NAME',
    'DOWNLOAD_DEFAULTS',
    'TILE_CONFIG',
    'ERROR_MESSAGES',
    'tileService',
    'downloadTiles',
    'fontService',
    'spriteService',
    'loadStyles',
    'loadStyleById',
  ])('exports %s (documented in the API reference)', name => {
    expect(lib[name]).toBeDefined();
  });

  it('runs bundled dependency code without page-provided globals', async () => {
    // Reaches IndexedDB through the bundled `idb` copy. When `idb` is left
    // external (as it was before 0.8.9) the CDN page has no such global and
    // this rejects instead of resolving.
    const manager = new (lib.OfflineMapManager as new () => {
      listRegions: () => Promise<unknown[]>;
    })();
    await expect(manager.listRegions()).resolves.toEqual(expect.any(Array));

    expect((lib.createTileKey as (...a: unknown[]) => string)(1, 2, 3, 'style', 'src', 'pbf')).toBe(
      'style:src:3:1:2.pbf'
    );
  });
});
