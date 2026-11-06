import { extractAllFontNames, extractFontNamesFromTextField } from '../../src/utils/styleUtils';

const schema = { font: { default: 'DIN Pro' } };
const medium = [['concat', ['config', 'font'], ' Medium'], 'Arial Unicode MS Bold'];
const regular = [['concat', ['config', 'font'], ' Regular'], 'Arial Unicode MS Regular'];

/** The shape of the live Mapbox Standard style's `text-font` values. */
const standardLike = () => ({
  schema,
  layers: [
    { layout: { 'text-font': medium } },
    { layout: { 'text-font': medium } },
    { layout: { 'text-font': regular } },
    { layout: {} },
  ],
});

describe('extractFontNamesFromTextField', () => {
  it('resolves config-built stacks against the schema, keeping the fallback', () => {
    expect(extractFontNamesFromTextField(medium, schema)).toEqual([
      'DIN Pro Medium',
      'Arial Unicode MS Bold',
    ]);
  });

  it('reads plain and literal stacks', () => {
    expect(extractFontNamesFromTextField(['A', 'B'])).toEqual(['A', 'B']);
    expect(extractFontNamesFromTextField(['literal', ['A', 'B']])).toEqual(['A', 'B']);
  });

  it('finds each stack in a branching expression', () => {
    const value = ['step', ['zoom'], ['literal', ['A']], 10, ['literal', ['B', 'C']]];
    expect(extractFontNamesFromTextField(value)).toEqual(['A', 'B', 'C']);
  });

  it("doesn't read an expression's operands as fonts", () => {
    const value = [
      'case',
      ['==', ['get', 'class'], 'park'],
      ['literal', ['A']],
      ['==', ['config', 'theme'], 'dark'],
      ['literal', ['B']],
      ['literal', ['C']],
    ];
    expect(extractFontNamesFromTextField(value)).toEqual(['A', 'B', 'C']);
  });

  it('drops an entry it cannot resolve', () => {
    expect(extractFontNamesFromTextField(medium)).toEqual(['Arial Unicode MS Bold']);
  });
});

describe('extractAllFontNames with a config-built stack', () => {
  it('returns both the configured font and its fallback', () => {
    expect(extractAllFontNames(standardLike()).sort()).toEqual([
      'Arial Unicode MS Bold',
      'Arial Unicode MS Regular',
      'DIN Pro Medium',
      'DIN Pro Regular',
    ]);
  });

  it('picks up a font changed through the schema', () => {
    const style = { ...standardLike(), schema: { font: { default: 'Roboto' } } };
    expect(extractAllFontNames(style)).toContain('Roboto Medium');
  });

  it('still expands weights when only the schema names a font', () => {
    expect(extractAllFontNames({ schema, layers: [] })).toContain('DIN Pro Bold');
  });
});
