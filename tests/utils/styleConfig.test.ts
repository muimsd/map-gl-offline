import {
  applyStyleConfig,
  findInactiveSources,
  isConfigDrivenStyle,
} from '../../src/utils/styleConfig';
import type { BaseStyle } from '../../src/types/style';

/** The parts of the live Mapbox Standard style that decide which sources are needed. */
const standardLike = () => ({
  schema: {
    show3dObjects: { default: true },
    showHdRoads: { default: false },
    showLandmarkIcons: { default: false },
    theme: { default: 'default' },
  },
  iconsets: { landmarks: { type: 'source', source: 'mapbox-landmarks' } },
  terrain: { source: 'mapbox-dem' },
  sources: {
    composite: {},
    'mapbox-dem': {},
    'mapbox-hd-roads': {},
    'mapbox-landmark-pois': {},
    'mapbox-landmarks': {},
    '3dbuildings': {},
    extra: {},
  },
  layers: [
    { id: 'land', source: 'composite' },
    {
      id: 'hd',
      source: 'mapbox-hd-roads',
      layout: { visibility: ['case', ['config', 'showHdRoads'], 'visible', 'none'] },
    },
    {
      id: 'landmark-icon',
      source: 'mapbox-landmark-pois',
      layout: {
        visibility: ['case', ['config', 'showLandmarkIcons'], 'visible', 'none'],
        'icon-image': ['image', ['get', 'icon_name'], { iconset: { id: 'landmarks' } }],
      },
    },
    {
      id: 'buildings',
      source: '3dbuildings',
      layout: { visibility: ['case', ['all', ['config', 'show3dObjects']], 'visible', 'none'] },
    },
  ],
});

describe('isConfigDrivenStyle', () => {
  it('recognises styles with a schema or imports', () => {
    expect(isConfigDrivenStyle({ schema: { a: {} } })).toBe(true);
    expect(isConfigDrivenStyle({ imports: [{ id: 'basemap' }] })).toBe(true);
  });

  it('rejects plain styles', () => {
    expect(isConfigDrivenStyle({})).toBe(false);
    expect(isConfigDrivenStyle({ schema: {}, imports: [] })).toBe(false);
    expect(isConfigDrivenStyle(null)).toBe(false);
  });
});

describe('findInactiveSources', () => {
  it('reports sources whose features are off, including the iconset source', () => {
    expect(Array.from(findInactiveSources(standardLike())).sort()).toEqual([
      'mapbox-hd-roads',
      'mapbox-landmark-pois',
      'mapbox-landmarks',
    ]);
  });

  it('keeps an iconset source and its layer source once the feature is on', () => {
    const style = standardLike();
    style.schema.showLandmarkIcons.default = true;
    expect(Array.from(findInactiveSources(style))).toEqual(['mapbox-hd-roads']);
  });

  it('keeps the terrain source even with no layers on it', () => {
    expect(findInactiveSources(standardLike()).has('mapbox-dem')).toBe(false);
  });

  it('keeps sources nothing in the style references', () => {
    expect(findInactiveSources(standardLike()).has('extra')).toBe(false);
  });

  it('never filters a style without config', () => {
    const style = {
      sources: { a: {} },
      layers: [{ id: 'hidden', source: 'a', layout: { visibility: 'none' } }],
    };
    expect(findInactiveSources(style).size).toBe(0);
  });

  it('keeps a source when one of its layers is visible', () => {
    const style = {
      schema: { off: { default: false } },
      sources: { a: {} },
      layers: [
        { id: 'hidden', source: 'a', layout: { visibility: 'none' } },
        { id: 'shown', source: 'a' },
      ],
    };
    expect(findInactiveSources(style).size).toBe(0);
  });

  it('counts a visibility it cannot decide as visible', () => {
    const cases = [
      ['case', ['config', 'notInSchema'], 'visible', 'none'],
      ['case', ['>', ['zoom'], 3], 'visible', 'none'],
      ['case', ['all', ['config', 'on'], ['config', 'notInSchema']], 'visible', 'none'],
    ];
    for (const visibility of cases) {
      const style = {
        schema: { on: { default: true } },
        sources: { a: {} },
        layers: [{ id: 'l', source: 'a', layout: { visibility } }],
      };
      expect(findInactiveSources(style).size).toBe(0);
    }
  });

  it.each([
    ['all short-circuits on false', ['case', ['all', ['config', 'off'], ['config', 'x']], 'visible', 'none']],
    ['any with all false', ['case', ['any', ['config', 'off']], 'visible', 'none']],
    ['negation', ['case', ['!', ['config', 'on']], 'visible', 'none']],
    ['equality', ['case', ['==', ['config', 'theme'], 'other'], 'visible', 'none']],
    ['inequality', ['case', ['!=', ['config', 'theme'], 'dark'], 'visible', 'none']],
    ['match', ['match', ['config', 'theme'], 'dark', 'none', 'visible']],
    ['match with label list', ['match', ['config', 'theme'], ['dark', 'dim'], 'none', 'visible']],
    ['case fallback', ['case', ['config', 'off'], 'visible', ['literal', 'none']]],
  ])('evaluates %s as hidden', (_name, visibility) => {
    const style = {
      schema: { on: { default: true }, off: { default: false }, theme: { default: 'dark' } },
      sources: { a: {} },
      layers: [{ id: 'l', source: 'a', layout: { visibility } }],
    };
    expect(findInactiveSources(style).has('a')).toBe(true);
  });

  it('uses literal visibility on a style flattened from imports', () => {
    const style = {
      imports: [{ id: 'basemap' }],
      sources: { 'basemap/hd': {} },
      layers: [{ id: 'basemap/l', source: 'basemap/hd', layout: { visibility: 'none' } }],
    };
    expect(Array.from(findInactiveSources(style))).toEqual(['basemap/hd']);
  });
});

describe('applyStyleConfig', () => {
  it('writes values into schema defaults, which findInactiveSources then reads', () => {
    const style = standardLike();
    applyStyleConfig(style as unknown as BaseStyle, { showHdRoads: true });
    expect(style.schema.showHdRoads.default).toBe(true);
    expect(findInactiveSources(style).has('mapbox-hd-roads')).toBe(false);
  });

  it('ignores keys the schema does not declare', () => {
    const style = standardLike();
    applyStyleConfig(style as unknown as BaseStyle, { notAKey: true });
    expect(style.schema).toEqual(standardLike().schema);
  });

  it('tolerates a style with no schema', () => {
    expect(() => applyStyleConfig({} as BaseStyle, { a: 1 })).not.toThrow();
  });
});
