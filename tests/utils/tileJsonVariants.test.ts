import { selectTileJsonVariant } from '../../src/utils/styleProviderUtils';

const BASE = 'https://a.tiles.mapbox.com/3dtiles/v1/b/{z}/{x}/{y}.glb?access_token=pk.t';

/** The shape `mapbox.mapbox-3dbuildings-v1` returns. */
const buildings = () => ({
  tiles: [BASE],
  capabilities: ['draco'],
  maxzoom: 14,
  variants: [
    { capabilities: ['meshopt'], tiles: ['mapbox://3dtiles/b-meshopt/{z}/{x}/{y}.glb'] },
    { capabilities: ['meshopt-v2+lod'], tiles: ['mapbox://3dtiles/b-lod/{z}/{x}/{y}.glb'] },
  ],
});

describe('selectTileJsonVariant', () => {
  it('prefers meshopt-v2+lod and resolves its URL with the token', () => {
    const result = selectTileJsonVariant(buildings());
    expect(result.tiles).toEqual([
      'https://api.mapbox.com/3dtiles/v1/b-lod/{z}/{x}/{y}.glb?access_token=pk.t',
    ]);
    expect(result.maxzoom).toBe(14);
  });

  it('falls back to meshopt', () => {
    const tileJson = buildings();
    tileJson.variants = tileJson.variants.slice(0, 1);
    expect(selectTileJsonVariant(tileJson).tiles[0]).toContain('/3dtiles/v1/b-meshopt/');
  });

  it('ignores variants needing several capabilities, like the renderer', () => {
    const tileJson = buildings();
    tileJson.variants = [
      { capabilities: ['meshopt', 'other'], tiles: ['mapbox://3dtiles/x/{z}/{x}/{y}.glb'] },
    ];
    expect(selectTileJsonVariant(tileJson).tiles).toEqual([BASE]);
  });

  it('leaves TileJSON without usable variants alone', () => {
    const plain = { tiles: [BASE] };
    expect(selectTileJsonVariant(plain)).toBe(plain);
    const noTiles = { tiles: [BASE], variants: [{ capabilities: ['meshopt'] }] };
    expect(selectTileJsonVariant(noTiles)).toBe(noTiles);
    const malformed = { tiles: [BASE], variants: [null] };
    expect(selectTileJsonVariant(malformed)).toBe(malformed);
  });

  it('copes with a base URL that has no query', () => {
    const tileJson = { ...buildings(), tiles: ['https://a.tiles.mapbox.com/b/{z}/{x}/{y}.glb'] };
    expect(selectTileJsonVariant(tileJson).tiles[0]).toBe(
      'https://api.mapbox.com/3dtiles/v1/b-lod/{z}/{x}/{y}.glb'
    );
  });
});
