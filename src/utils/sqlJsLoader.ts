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

/**
 * Lazily initialise `sql.js`. The underlying module is loaded via dynamic
 * `import()` so it only ships with bundles that actually call MBTiles code.
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = (async () => {
    const mod = (await import('sql.js')) as unknown as {
      default: (config?: Record<string, unknown>) => Promise<SqlJsStatic>;
    };
    const initSqlJs = mod.default;

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
