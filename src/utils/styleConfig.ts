/**
 * Mapbox GL v3 style-config helpers.
 *
 * Mapbox Standard is one style with switchable features: most of its layers set
 * `layout.visibility` from `["config", key]` expressions backed by `style.schema`
 * defaults. These helpers work out which sources the style actually needs for
 * the current config, so features that are switched off aren't downloaded and
 * features that are switched on aren't skipped.
 */

import type { BaseStyle } from '@/types/style';
import { logger } from '@/utils/logger';

const configLogger = logger.scope('StyleConfig');

type ConfigValues = Record<string, unknown>;

/** Sentinel for an expression that can't be decided from config alone. */
const UNKNOWN = Symbol('unknown');

interface ConfigStyle {
  schema?: Record<string, { default?: unknown }>;
  imports?: unknown[];
  sources?: Record<string, unknown>;
  layers?: unknown[];
  iconsets?: Record<string, { source?: string }>;
  terrain?: { source?: string };
}

/**
 * True for styles whose feature set is config-driven: they declare a `schema`,
 * or were flattened from `imports` (whose config is already resolved into the
 * layers). Other styles are never filtered by config.
 */
export function isConfigDrivenStyle(style: unknown): boolean {
  const s = style as ConfigStyle | null | undefined;
  if (!s) return false;
  return (
    (s.schema !== undefined && Object.keys(s.schema).length > 0) ||
    (Array.isArray(s.imports) && s.imports.length > 0)
  );
}

function evaluate(expr: unknown, config: ConfigValues): unknown {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr as [unknown, ...unknown[]];
  switch (op) {
    case 'literal':
      return args[0];
    case 'config': {
      const key = args[0];
      return typeof key === 'string' && key in config ? config[key] : UNKNOWN;
    }
    case '!': {
      const value = evaluate(args[0], config);
      return typeof value === 'boolean' ? !value : UNKNOWN;
    }
    case 'all':
    case 'any': {
      const decisive = op === 'any';
      let sawUnknown = false;
      for (const arg of args) {
        const value = evaluate(arg, config);
        if (value === decisive) return decisive;
        if (typeof value !== 'boolean') sawUnknown = true;
      }
      return sawUnknown ? UNKNOWN : !decisive;
    }
    case '==':
    case '!=': {
      const a = evaluate(args[0], config);
      const b = evaluate(args[1], config);
      if (a === UNKNOWN || b === UNKNOWN) return UNKNOWN;
      return op === '==' ? a === b : a !== b;
    }
    case 'case': {
      // ["case", cond, out, cond, out, ..., fallback]
      for (let i = 0; i < args.length - 1; i += 2) {
        const condition = evaluate(args[i], config);
        if (typeof condition !== 'boolean') return UNKNOWN;
        if (condition) return evaluate(args[i + 1], config);
      }
      return evaluate(args[args.length - 1], config);
    }
    case 'match': {
      // ["match", input, label, out, label, out, ..., fallback]
      const input = evaluate(args[0], config);
      if (input === UNKNOWN) return UNKNOWN;
      for (let i = 1; i < args.length - 1; i += 2) {
        const label = args[i];
        if (Array.isArray(label) ? label.includes(input) : label === input) {
          return evaluate(args[i + 1], config);
        }
      }
      return evaluate(args[args.length - 1], config);
    }
    default:
      return UNKNOWN;
  }
}

function collectIconsetIds(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectIconsetIds(item, ids);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const iconset = record.iconset as { id?: unknown } | undefined;
    if (iconset && typeof iconset.id === 'string') ids.add(iconset.id);
    for (const item of Object.values(record)) collectIconsetIds(item, ids);
  }
}

/**
 * Sources a config-driven style uses under its current config (`active`), and
 * those it references but only from hidden layers or unused iconsets (`inactive`).
 *
 * Deliberately errs towards keeping sources: a visibility expression that can't
 * be decided counts as visible. Sources nothing in the style references
 * (`extraSources`, ones a caller adds at runtime) are in neither set.
 */
export function classifySources(style: unknown): { active: Set<string>; inactive: Set<string> } {
  const inactive = new Set<string>();
  const active = new Set<string>();
  if (!isConfigDrivenStyle(style)) return { active, inactive };

  const s = style as ConfigStyle;
  const config: ConfigValues = {};
  for (const [key, entry] of Object.entries(s.schema ?? {})) {
    if (entry && typeof entry === 'object' && 'default' in entry) config[key] = entry.default;
  }

  const activeIconsets = new Set<string>();

  for (const layer of (s.layers ?? []) as Array<{
    source?: unknown;
    layout?: { visibility?: unknown };
  }>) {
    const visible = evaluate(layer?.layout?.visibility ?? 'visible', config) !== 'none';
    if (typeof layer?.source === 'string') {
      inactive.add(layer.source);
      if (visible) active.add(layer.source);
    }
    if (visible) {
      // The whole layer, since `appearances` can also name an iconset.
      collectIconsetIds(layer, activeIconsets);
    }
  }

  for (const [id, iconset] of Object.entries(s.iconsets ?? {})) {
    if (typeof iconset?.source !== 'string') continue;
    inactive.add(iconset.source);
    if (activeIconsets.has(id)) active.add(iconset.source);
  }

  if (typeof s.terrain?.source === 'string') active.add(s.terrain.source);

  for (const id of active) inactive.delete(id);
  return { active, inactive };
}

/** The sources {@link classifySources} found to be unneeded under the current config. */
export function findInactiveSources(style: unknown): Set<string> {
  return classifySources(style).inactive;
}

/**
 * Write config values into a style's `schema` defaults. `["config", key]` reads
 * those defaults at render time, so this one edit drives both what gets
 * downloaded and what the stored style shows offline. Keys the schema doesn't
 * declare are ignored with a warning.
 */
export function applyStyleConfig(style: BaseStyle, config: ConfigValues): void {
  const schema = (style as ConfigStyle).schema;
  for (const [key, value] of Object.entries(config)) {
    const entry = schema?.[key];
    if (entry && typeof entry === 'object') {
      entry.default = value;
    } else {
      configLogger.warn(`Ignoring styleConfig "${key}": the style's schema doesn't declare it`);
    }
  }
}
