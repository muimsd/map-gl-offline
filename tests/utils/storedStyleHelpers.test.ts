/**
 * Helpers that keep a stored style usable: extra sources, model URLs, which
 * renderer it needs, and what to call it.
 */
import {
  injectExtraSources,
  isMapboxGlMap,
  needsMapboxGl,
  restoreUnstoredModels,
  stashOriginalModels,
} from '../../src/utils/styleUtils';
import { styleDisplayName } from '../../src/utils/formatting';

describe('injectExtraSources', () => {
  it('adds missing sources and leaves existing ones alone', () => {
    const style = { sources: { base: { type: 'vector' } } as Record<string, unknown> };
    injectExtraSources(style, [
      { id: 'base', tiles: ['https://other/{z}/{x}/{y}.pbf'] },
      { id: 'hillshade', type: 'raster', tiles: ['https://h/{z}/{x}/{y}.png'], maxzoom: 12 },
    ]);
    expect(style.sources.base).toEqual({ type: 'vector' });
    expect(style.sources.hillshade).toEqual({
      type: 'raster',
      tiles: ['https://h/{z}/{x}/{y}.png'],
      maxzoom: 12,
    });
  });
});

describe('model URLs', () => {
  const freshEntry = () => ({
    style: {
      models: {
        tree: 'mapbox://models/mapbox/tree.glb',
        turbine: { uri: 'mapbox://models/mapbox/turbine.glb' },
      } as Record<string, unknown>,
    },
    originalModels: undefined as Record<string, unknown> | undefined,
  });

  it('points models that were not stored back at their upstream URLs', () => {
    const entry = freshEntry();
    stashOriginalModels(entry);
    // What patching does: every model to idb://.
    entry.style.models = {
      tree: 'idb://s/model/tree',
      turbine: { uri: 'idb://s/model/turbine' },
    };

    restoreUnstoredModels(entry, new Set(['tree']));

    expect(entry.style.models.tree).toBe('idb://s/model/tree');
    expect(entry.style.models.turbine).toEqual({ uri: 'mapbox://models/mapbox/turbine.glb' });
  });

  it('stashes only once, and never from an already patched style', () => {
    const entry = freshEntry();
    stashOriginalModels(entry);
    const first = entry.originalModels;
    entry.style.models.tree = 'idb://s/model/tree';
    stashOriginalModels(entry);
    expect(entry.originalModels).toBe(first);

    const patched = {
      style: { models: { tree: 'idb://s/model/tree' } },
      originalModels: undefined,
    };
    stashOriginalModels(patched);
    expect(patched.originalModels).toBeUndefined();
  });
});

describe('needsMapboxGl and isMapboxGlMap', () => {
  it('flags Mapbox-only style features', () => {
    expect(needsMapboxGl({ version: 8, schema: {} })).toBe(true);
    expect(needsMapboxGl({ version: 8, models: {} })).toBe(true);
    expect(needsMapboxGl({ version: 8, sources: {}, layers: [] })).toBe(false);
  });

  it('recognises a Mapbox GL map by setConfigProperty', () => {
    expect(isMapboxGlMap({ setConfigProperty: () => {} })).toBe(true);
    expect(isMapboxGlMap({ setStyle: () => {} })).toBe(false);
    expect(isMapboxGlMap(undefined)).toBe(false);
  });
});

describe('styleDisplayName', () => {
  it("uses the style's name when it has one", () => {
    expect(styleDisplayName({ key: 'k', style: { name: 'Streets' } })).toBe('Streets');
  });

  it('falls back to the URL, then the key', () => {
    expect(
      styleDisplayName({
        key: 'style-1',
        originalUrl: 'https://tiles.openfreemap.org/styles/liberty',
      })
    ).toBe('liberty');
    expect(
      styleDisplayName({
        key: 'style-2',
        originalUrl: 'https://example.com/maps/dark/style.json?x=1',
      })
    ).toBe('dark');
    expect(styleDisplayName({ key: 'style-3' })).toBe('style-3');
  });
});
