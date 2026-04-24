/**
 * Tests for src/sw/shared.ts — the pure helpers shared between the
 * Service Worker (`src/sw/offline-sw.ts`) and the main-thread fetch handler
 * (`src/utils/idbFetchHandler.ts`).
 *
 * All helpers are deterministic and IDB-free; test them directly.
 */

import {
  OFFLINE_PREFIX,
  DB_NAME,
  TILE_FALLBACK_EXTENSIONS,
  buildOfflineTileJson,
  deriveTileExtensionFromTiles,
  findStyleByRegionIdIn,
  glyphCandidateKeys,
  isGzipped,
  makeTileKey,
  matchTileJsonSource,
  modelCandidateKeys,
  parseGlyphPath,
  parseTileYExt,
  spriteCandidateKeys,
  tileFallbackExtensions,
  type StyleEntryLike,
} from '../../src/sw/shared';

describe('sw/shared constants', () => {
  it('exposes the known offline URL prefix', () => {
    expect(OFFLINE_PREFIX).toBe('/__offline__/');
  });

  it('exposes the IDB database name', () => {
    expect(DB_NAME).toBe('offline-map-db');
  });

  it('lists the tile-fallback extensions in descending likelihood', () => {
    expect([...TILE_FALLBACK_EXTENSIONS]).toEqual(['pbf', 'mvt', 'png', 'jpg', 'webp', 'glb']);
  });
});

describe('makeTileKey', () => {
  it('matches the canonical `{style}:{src}:{z}:{x}:{y}.{ext}` format', () => {
    expect(makeTileKey(10, 20, 5, 'std', 'composite', 'pbf')).toBe('std:composite:5:10:20.pbf');
  });
});

describe('tileFallbackExtensions', () => {
  it('strips the requested extension from the fallback list', () => {
    expect(tileFallbackExtensions('pbf')).toEqual(['mvt', 'png', 'jpg', 'webp', 'glb']);
    expect(tileFallbackExtensions('glb')).toEqual(['pbf', 'mvt', 'png', 'jpg', 'webp']);
  });

  it('returns the full list when the requested extension is unknown', () => {
    expect(tileFallbackExtensions('xyz')).toEqual([...TILE_FALLBACK_EXTENSIONS]);
  });
});

describe('parseTileYExt', () => {
  it('parses single-segment extensions', () => {
    expect(parseTileYExt('5678.pbf')).toEqual({ y: 5678, ext: 'pbf' });
  });

  it('parses multi-dot extensions like Mapbox v4 `.vector.pbf`', () => {
    expect(parseTileYExt('5678.vector.pbf')).toEqual({ y: 5678, ext: 'vector.pbf' });
  });

  it('rejects paths without a numeric y', () => {
    expect(parseTileYExt('abc.pbf')).toBeNull();
  });

  it('rejects paths without an extension', () => {
    expect(parseTileYExt('5678')).toBeNull();
  });
});

describe('findStyleByRegionIdIn', () => {
  const entries: StyleEntryLike[] = [
    { key: 'voyager', regions: [{ id: 'region-v', regionId: 'region-v' }] },
    { key: 'standard', regions: [{ id: 'region-s' }] },
    { key: 'stale', regions: [] },
  ];

  it('matches on region.id', () => {
    expect(findStyleByRegionIdIn(entries, 'region-s')?.key).toBe('standard');
  });

  it('matches on region.regionId', () => {
    expect(findStyleByRegionIdIn(entries, 'region-v')?.key).toBe('voyager');
  });

  it('returns null when no match is found', () => {
    expect(findStyleByRegionIdIn(entries, 'missing')).toBeNull();
  });

  it('skips entries without a regions array', () => {
    const partial: StyleEntryLike[] = [{ key: 'no-regions' }];
    expect(findStyleByRegionIdIn(partial, 'anything')).toBeNull();
  });
});

describe('parseGlyphPath', () => {
  it('parses comma-separated fontstacks with a range', () => {
    expect(parseGlyphPath('DIN Pro Regular,Arial Unicode MS/0-255.pbf')).toEqual({
      fontstacks: ['DIN Pro Regular', 'Arial Unicode MS'],
      rangePart: '0-255.pbf',
    });
  });

  it('defaults the range to 0-255.pbf when missing', () => {
    expect(parseGlyphPath('DIN Pro Regular')).toEqual({
      fontstacks: ['DIN Pro Regular'],
      rangePart: '0-255.pbf',
    });
  });

  it('filters out empty fontstack entries', () => {
    expect(parseGlyphPath(',A,,/0-255.pbf')).toEqual({
      fontstacks: ['A'],
      rangePart: '0-255.pbf',
    });
  });
});

describe('glyphCandidateKeys', () => {
  it('returns styleId variants before downloadId variants', () => {
    const keys = glyphCandidateKeys('std', 'region-s', 'DIN Pro', '0-255.pbf');
    // When the path already ends in .pbf, the normalized and raw glyphPath are
    // identical so dedup collapses them. The styleId variant still comes
    // before the downloadId variant in priority order.
    expect(keys[0]).toBe('std::DIN Pro/0-255.pbf');
    expect(keys.indexOf('region-s::DIN Pro/0-255.pbf')).toBeGreaterThan(0);
    expect(keys.indexOf('region-s::DIN Pro/0-255.pbf')).toBeLessThan(
      keys.indexOf('DIN Pro/0-255.pbf')
    );
  });

  it('appends .pbf when the range part is missing the extension', () => {
    const keys = glyphCandidateKeys('std', 'region-s', 'DIN Pro', '0-255');
    expect(keys).toContain('std::DIN Pro/0-255.pbf');
    expect(keys).toContain('std::DIN Pro/0-255');
  });
});

describe('spriteCandidateKeys', () => {
  it('tries both :: and : separators, plus extensionless variants', () => {
    const keys = spriteCandidateKeys('std', 'region-s', 'sprite@2x.png');
    expect(keys).toEqual(
      expect.arrayContaining([
        'std::sprite@2x.png',
        'std:sprite@2x.png',
        'std::sprite@2x',
        'std:sprite@2x',
        'region-s::sprite@2x.png',
        'region-s:sprite@2x.png',
        'sprite@2x.png',
      ])
    );
  });
});

describe('modelCandidateKeys', () => {
  it('tries styleId before downloadId', () => {
    expect(modelCandidateKeys('std', 'region-s', 'maple1-lod1')).toEqual([
      'std::model::maple1-lod1',
      'region-s::model::maple1-lod1',
    ]);
  });

  it('deduplicates when styleId equals downloadId', () => {
    expect(modelCandidateKeys('std', 'std', 'maple1-lod1')).toEqual(['std::model::maple1-lod1']);
  });
});

describe('matchTileJsonSource', () => {
  const sources = {
    composite: { type: 'vector', url: 'mapbox://mapbox.streets-v8' },
    imagery: {
      type: 'raster',
      __originalTilesetUrl: 'https://api.mapbox.com/v4/mapbox.satellite.json',
    },
  };

  it('matches on source id first', () => {
    expect(matchTileJsonSource(sources, 'composite')?.sourceId).toBe('composite');
  });

  it('falls back to source.url', () => {
    expect(matchTileJsonSource(sources, 'mapbox://mapbox.streets-v8')?.sourceId).toBe('composite');
  });

  it('falls back to source.__originalTilesetUrl', () => {
    expect(
      matchTileJsonSource(sources, 'https://api.mapbox.com/v4/mapbox.satellite.json')?.sourceId
    ).toBe('imagery');
  });

  it('returns null on no match', () => {
    expect(matchTileJsonSource(sources, 'missing')).toBeNull();
  });

  it('ignores non-object source values', () => {
    expect(matchTileJsonSource({ junk: 'not an object' }, 'junk')).toBeNull();
  });
});

describe('buildOfflineTileJson', () => {
  const config = {
    tiles: ['https://.../{z}/{x}/{y}.vector.pbf'],
    minzoom: 0,
    maxzoom: 14,
    vector_layers: [{ id: 'water' }],
  };

  it('emits an idb:// tile URL when scheme="idb"', () => {
    const json = buildOfflineTileJson(config, 'dl', 'composite', 'pbf', 'idb');
    expect(json.tiles).toEqual(['idb://dl/tile/composite/{z}/{x}/{y}.pbf']);
  });

  it('emits an absolute /__offline__/ URL when scheme="offline"', () => {
    const json = buildOfflineTileJson(
      config,
      'dl',
      'composite',
      'pbf',
      'offline',
      'https://example.com'
    );
    expect(json.tiles).toEqual([
      'https://example.com/__offline__/dl/tile/composite/{z}/{x}/{y}.pbf',
    ]);
  });

  it('copies vector_layers and other tilejson fields through unchanged', () => {
    const json = buildOfflineTileJson(config, 'dl', 'composite', 'pbf', 'idb');
    expect(json.vector_layers).toEqual([{ id: 'water' }]);
    expect(json.minzoom).toBe(0);
    expect(json.maxzoom).toBe(14);
  });

  it('defaults tilejson version to 2.2.0', () => {
    const json = buildOfflineTileJson({}, 'dl', 'composite', 'pbf', 'idb');
    expect(json.tilejson).toBe('2.2.0');
  });
});

describe('deriveTileExtensionFromTiles', () => {
  it('extracts the last dotted segment', () => {
    expect(deriveTileExtensionFromTiles(['https://.../{z}/{x}/{y}.vector.pbf'])).toBe('pbf');
  });

  it('handles query strings', () => {
    expect(deriveTileExtensionFromTiles(['https://.../{y}.png?k=v'])).toBe('png');
  });

  it('defaults to pbf when input is empty or non-string', () => {
    expect(deriveTileExtensionFromTiles([])).toBe('pbf');
    expect(deriveTileExtensionFromTiles(undefined)).toBe('pbf');
    expect(deriveTileExtensionFromTiles([42])).toBe('pbf');
  });
});

describe('isGzipped', () => {
  it('detects the gzip magic bytes 1f 8b', () => {
    const buf = new Uint8Array([0x1f, 0x8b, 0, 0, 0]).buffer;
    expect(isGzipped(buf)).toBe(true);
  });

  it('returns false for non-gzip data', () => {
    const buf = new Uint8Array([0x00, 0x01]).buffer;
    expect(isGzipped(buf)).toBe(false);
  });

  it('returns false for empty buffers', () => {
    expect(isGzipped(new ArrayBuffer(0))).toBe(false);
    expect(isGzipped(new ArrayBuffer(1))).toBe(false);
  });
});
