import type { SqlJsStatic } from 'sql.js';

export interface SqlJsConfig {
  /** URL where `sql-wasm.wasm` (and any Emscripten runtime files) can be fetched from. */
  wasmUrl?: string;
  /** Pre-fetched WASM binary. Takes precedence over `wasmUrl`. Useful in Node / tests. */
  wasmBinary?: ArrayBuffer | Uint8Array;
}

const DEFAULT_WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/';

let currentConfig: SqlJsConfig = {};
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Override how `sql.js` loads its WebAssembly. Call once before any MBTiles
 * import/export is invoked. Resets any cached init.
 */
export function configureSqlJs(config: SqlJsConfig): void {
  currentConfig = { ...config };
  sqlJsPromise = null;
}

type InitSqlJs = (config?: Record<string, unknown>) => Promise<SqlJsStatic>;

/**
 * Resolve the `initSqlJs` factory.
 *
 * Bundler builds resolve the npm package via dynamic `import()`, so `sql.js`
 * only ships with bundles that actually call MBTiles code. The UMD/CDN build
 * has no module resolver, so the import throws there — fall back to the
 * `initSqlJs` global that sql.js's own `<script>` build defines.
 */
async function resolveInitSqlJs(): Promise<InitSqlJs> {
  try {
    const mod = (await import('sql.js')) as unknown as { default: InitSqlJs };
    if (typeof mod?.default === 'function') return mod.default;
  } catch {
    // Bare specifier not resolvable (UMD/CDN); fall through to the global.
  }

  const globalInit = (globalThis as { initSqlJs?: InitSqlJs }).initSqlJs;
  if (typeof globalInit === 'function') return globalInit;

  throw new Error(
    'sql.js could not be loaded. Install `sql.js` when bundling, or load ' +
      'https://cdn.jsdelivr.net/npm/sql.js/dist/sql-wasm.js before map-gl-offline ' +
      'when using the UMD build.'
  );
}

/**
 * Lazily initialise `sql.js`.
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = (async () => {
    const initSqlJs = await resolveInitSqlJs();

    const options: Record<string, unknown> = {};
    if (currentConfig.wasmBinary) {
      options.wasmBinary = currentConfig.wasmBinary;
    } else {
      const base = currentConfig.wasmUrl ?? DEFAULT_WASM_URL;
      options.locateFile = (file: string) =>
        base.endsWith('/') ? `${base}${file}` : `${base}/${file}`;
    }

    return initSqlJs(options);
  })();

  return sqlJsPromise;
}
