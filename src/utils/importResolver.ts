/**
 * Mapbox Standard Style Import Resolution
 *
 * Resolves the `imports` array in Mapbox GL v3+ styles by recursively fetching
 * imported styles and flattening their sources, layers, sprites, and glyphs
 * into the outer style. This allows the existing download pipeline to work
 * unchanged with import-based styles like Mapbox Standard.
 */

import { fetchWithRetry } from './download';
import { isMapboxProtocol, resolveMapboxUrl } from './styleProviderUtils';
import { logger } from './logger';
import type { BaseStyle } from '@/types/style';

const importLogger = logger.scope('ImportResolver');

/** Maximum recursion depth for nested imports (per Mapbox spec) */
const MAX_IMPORT_DEPTH = 5;

/** A single import entry in a style's `imports` array */
export interface StyleImport {
  id: string;
  url: string;
  data?: BaseStyle;
  config?: Record<string, unknown>;
}

/** Options for resolveImports */
export interface ResolveImportsOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Check if a style uses the imports architecture (Mapbox Standard, etc.)
 */
export function hasImports(style: unknown): boolean {
  if (!style || typeof style !== 'object') return false;
  const s = style as Record<string, unknown>;
  return Array.isArray(s.imports) && s.imports.length > 0;
}

/**
 * Recursively resolve all imports in a style, flattening sources, layers,
 * sprites, and glyphs into the outer style.
 *
 * The original `imports` array is preserved on the style for GL runtime usage.
 * Returns the mutated style.
 */
export async function resolveImports(
  style: BaseStyle,
  accessToken: string,
  options: ResolveImportsOptions = {}
): Promise<BaseStyle> {
  const { maxRetries = 3, timeoutMs = 30000 } = options;
  const visited = new Set<string>();

  const result = await resolveImportsRecursive(
    style,
    accessToken,
    visited,
    0,
    maxRetries,
    timeoutMs
  );

  return result;
}

async function resolveImportsRecursive(
  style: BaseStyle,
  accessToken: string,
  visited: Set<string>,
  depth: number,
  maxRetries: number,
  timeoutMs: number
): Promise<BaseStyle> {
  const imports = (style as Record<string, unknown>).imports as StyleImport[] | undefined;
  if (!imports || !Array.isArray(imports) || imports.length === 0) {
    return style;
  }

  if (depth >= MAX_IMPORT_DEPTH) {
    importLogger.warn(`Max import depth (${MAX_IMPORT_DEPTH}) reached, skipping further imports`);
    return style;
  }

  // Collect all flattened sources, layers from imports
  const flattenedSources: Record<string, unknown> = {};
  const flattenedLayers: unknown[] = [];
  let importedSprite: BaseStyle['sprite'] | Array<{ id: string; url: string }> | undefined;
  let importedGlyphs: string | undefined;
  let importedModels: BaseStyle['models'] | undefined;

  for (const importEntry of imports) {
    const { id: importId, url: importUrl } = importEntry;

    if (!importUrl || typeof importUrl !== 'string') {
      importLogger.warn(`Import "${importId}" has no URL, skipping`);
      continue;
    }

    // Resolve mapbox:// URLs
    let fetchUrl = importUrl;
    if (isMapboxProtocol(importUrl)) {
      fetchUrl = resolveMapboxUrl(importUrl, accessToken);
    }

    // Circular detection
    if (visited.has(fetchUrl)) {
      importLogger.warn(`Circular import detected for "${importId}" (${fetchUrl}), skipping`);
      continue;
    }
    visited.add(fetchUrl);

    importLogger.debug(`Resolving import "${importId}" from ${fetchUrl}`);

    let importedStyle: BaseStyle;
    try {
      // If inline data is provided, use it directly
      if (importEntry.data) {
        importedStyle = importEntry.data;
      } else {
        const response = await fetchWithRetry(fetchUrl, {
          retries: maxRetries,
          timeout: timeoutMs,
          retryDelay: 1000,
        });
        importedStyle = (await response.json()) as BaseStyle;
      }
    } catch (error) {
      importLogger.warn(
        `Failed to fetch import "${importId}" from ${fetchUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      continue;
    }

    // Recurse if the imported style itself has imports
    importedStyle = await resolveImportsRecursive(
      importedStyle,
      accessToken,
      visited,
      depth + 1,
      maxRetries,
      timeoutMs
    );

    // Flatten sources: prefix IDs with "{importId}/" to avoid collisions
    if (importedStyle.sources) {
      for (const [sourceId, sourceConfig] of Object.entries(importedStyle.sources)) {
        const prefixedId = `${importId}/${sourceId}`;
        flattenedSources[prefixedId] = sourceConfig;
      }
    }

    // Build config lookup: schema defaults + import config overrides
    const configValues = buildConfigLookup(importedStyle, importEntry.config);

    // Flatten layers: prefix layer IDs, update source references, resolve config expressions
    if (importedStyle.layers && Array.isArray(importedStyle.layers)) {
      for (const layer of importedStyle.layers) {
        const layerObj = layer as Record<string, unknown>;
        const prefixedLayer = deepClone(layerObj);

        // Prefix layer ID
        if (typeof prefixedLayer.id === 'string') {
          prefixedLayer.id = `${importId}/${prefixedLayer.id}`;
        }

        // Update source reference to match prefixed source ID
        if (typeof prefixedLayer.source === 'string') {
          prefixedLayer.source = `${importId}/${prefixedLayer.source}`;
        }

        // Resolve ["config", "key"] expressions using schema defaults and import overrides
        if (Object.keys(configValues).length > 0) {
          resolveConfigExpressions(prefixedLayer, configValues);
        }

        flattenedLayers.push(prefixedLayer);
      }
    }

    // Sprite: collect imported sprite
    if (importedStyle.sprite && !importedSprite) {
      importedSprite = importedStyle.sprite;
    }

    // Glyphs: collect imported glyphs
    if (importedStyle.glyphs && !importedGlyphs) {
      importedGlyphs = importedStyle.glyphs;
    }

    // Models: collect imported models
    if (importedStyle.models && !importedModels) {
      importedModels = importedStyle.models;
    }
  }

  // Merge into the outer style
  // Sources: outer sources take precedence, imported sources fill in
  style.sources = { ...flattenedSources, ...style.sources };

  // Layers: imported layers go first (bottom), outer layers on top
  const outerLayers = style.layers || [];
  style.layers = [...flattenedLayers, ...outerLayers];

  // Sprite: merge if both exist
  if (style.sprite && importedSprite) {
    style.sprite = mergeSprites(style.sprite, importedSprite);
  } else if (!style.sprite && importedSprite) {
    style.sprite = importedSprite;
  }

  // Glyphs: outer wins; if absent, use imported
  if (!style.glyphs && importedGlyphs) {
    style.glyphs = importedGlyphs;
  }

  // Models: outer wins; if absent, use imported
  if (!style.models && importedModels) {
    style.models = importedModels;
  }

  return style;
}

/**
 * Deep clone a plain object/array (JSON-safe values only).
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = deepClone(v);
  }
  return result as T;
}

/**
 * Build a config value lookup from an imported style's schema defaults
 * and the parent's config overrides.
 *
 * The schema is like: `{ "lightPreset": { "default": "day", "type": "string" }, ... }`
 * The config overrides are like: `{ "lightPreset": "night" }`
 */
function buildConfigLookup(
  importedStyle: BaseStyle,
  configOverrides?: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  // Start with schema defaults
  const schema = (importedStyle as Record<string, unknown>).schema as
    | Record<string, { default?: unknown }>
    | undefined;
  if (schema && typeof schema === 'object') {
    for (const [key, entry] of Object.entries(schema)) {
      if (entry && typeof entry === 'object' && 'default' in entry) {
        values[key] = entry.default;
      }
    }
  }

  // Apply config overrides (from import entry) on top
  if (configOverrides && typeof configOverrides === 'object') {
    for (const [key, value] of Object.entries(configOverrides)) {
      values[key] = value;
    }
  }

  return values;
}

/**
 * Recursively walk a layer object and replace `["config", "key"]` expressions
 * with the resolved config value.
 *
 * Also resolves more complex expressions that contain config references, like:
 * `["match", ["config", "theme"], "monochrome", "#ccc", "#fff"]`
 */
function resolveConfigExpressions(
  obj: Record<string, unknown>,
  configValues: Record<string, unknown>
): void {
  for (const key of Object.keys(obj)) {
    obj[key] = resolveValue(obj[key], configValues);
  }
}

function resolveValue(value: unknown, configValues: Record<string, unknown>): unknown {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
      resolveConfigExpressions(value as Record<string, unknown>, configValues);
    }
    return value;
  }

  // Check if this is a ["config", "key"] expression
  if (
    value.length === 2 &&
    value[0] === 'config' &&
    typeof value[1] === 'string' &&
    value[1] in configValues
  ) {
    const resolved = configValues[value[1]];
    importLogger.debug(`Resolved ["config", "${value[1]}"] → ${JSON.stringify(resolved)}`);
    return resolved;
  }

  // Recursively resolve sub-expressions (e.g., inside match/case/step)
  const resolved = value.map(item => resolveValue(item, configValues));

  // After resolving sub-expressions, try to evaluate simple expressions
  // e.g., ["match", "day", "day", true, false] can be evaluated statically
  return tryEvaluateExpression(resolved);
}

/**
 * Try to statically evaluate simple expressions after config values are resolved.
 * This handles common patterns like:
 * - ["match", <literal>, case1, val1, case2, val2, ..., fallback]
 * - ["case", <bool>, val1, val2]
 */
function tryEvaluateExpression(expr: unknown[]): unknown {
  if (expr.length === 0 || typeof expr[0] !== 'string') return expr;

  const op = expr[0];

  // ["match", input, label1, output1, label2, output2, ..., fallback]
  if (op === 'match' && expr.length >= 4 && !isExpression(expr[1])) {
    const input = expr[1];
    // Walk pairs: label, output
    for (let i = 2; i < expr.length - 1; i += 2) {
      const label = expr[i];
      const output = expr[i + 1];
      // label can be a single value or array of values
      if (Array.isArray(label)) {
        if (label.includes(input)) return output;
      } else if (label === input) {
        return output;
      }
    }
    // Return fallback (last element)
    return expr[expr.length - 1];
  }

  // ["case", condition, trueVal, falseVal]
  if (op === 'case') {
    // Simple 4-element case with resolved boolean condition
    if (expr.length === 4 && typeof expr[1] === 'boolean') {
      return expr[1] ? expr[2] : expr[3];
    }
    // Multi-branch case: ["case", cond1, val1, cond2, val2, ..., fallback]
    for (let i = 1; i < expr.length - 1; i += 2) {
      if (typeof expr[i] === 'boolean' && expr[i]) {
        return expr[i + 1];
      }
    }
    // If all conditions are false literals, return fallback
    const allCondResolved = (() => {
      for (let i = 1; i < expr.length - 1; i += 2) {
        if (typeof expr[i] !== 'boolean') return false;
      }
      return true;
    })();
    if (allCondResolved) return expr[expr.length - 1];
  }

  return expr;
}

/**
 * Check if a value is an unresolved expression (array starting with a string operator).
 */
function isExpression(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && typeof value[0] === 'string';
}

/**
 * Merge two sprite values into array format.
 * Handles string + string, string + array, array + string, array + array.
 */
function mergeSprites(
  outer: BaseStyle['sprite'],
  imported: BaseStyle['sprite'] | Array<{ id: string; url: string }>
): Array<{ id: string; url: string }> {
  const result: Array<{ id: string; url: string }> = [];

  // Add imported sprites first (bottom)
  if (typeof imported === 'string') {
    result.push({ id: 'imported', url: imported });
  } else if (Array.isArray(imported)) {
    for (const entry of imported as Array<{ id: string; url: string }>) {
      if (entry && typeof entry.url === 'string') {
        result.push(entry);
      }
    }
  }

  // Add outer sprites on top
  if (typeof outer === 'string') {
    result.push({ id: 'default', url: outer });
  } else if (Array.isArray(outer)) {
    for (const entry of outer as unknown as Array<{ id: string; url: string }>) {
      if (entry && typeof entry.url === 'string') {
        result.push(entry);
      }
    }
  }

  return result;
}
