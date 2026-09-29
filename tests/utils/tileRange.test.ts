import { getTileRangeAtZoom, isTileInRegion, sourceZoomRange } from '@/utils/tileRange';

describe('tileRange', () => {
  describe('getTileRangeAtZoom', () => {
    it('returns the tile range covering the bounds', () => {
      expect(
        getTileRangeAtZoom(
          [
            [-122.5, 37.5],
            [-122.0, 38.0],
          ],
          10
        )
      ).toEqual({
        minX: 163,
        maxX: 164,
        minY: 394,
        maxY: 396,
      });
    });
  });

  it('keeps an east edge on the antimeridian at the last column (no wrap to x=0)', () => {
    expect(
      getTileRangeAtZoom(
        [
          [90, -85],
          [180, 85],
        ],
        3
      )
    ).toEqual({
      minX: 6,
      maxX: 7,
      minY: 0,
      maxY: 7,
    });
  });

  it('clamps latitudes beyond the Mercator limit onto the grid', () => {
    expect(
      getTileRangeAtZoom(
        [
          [-180, -90],
          [180, 90],
        ],
        2
      )
    ).toEqual({
      minX: 0,
      maxX: 3,
      minY: 0,
      maxY: 3,
    });
  });

  describe('isTileInRegion', () => {
    const region = {
      bounds: [
        [-122.5, 37.5],
        [-122.0, 38.0],
      ] as [[number, number], [number, number]],
      minZoom: 5,
      maxZoom: 10,
    };

    it('accepts tiles inside the bounds and zoom range', () => {
      expect(isTileInRegion(10, 163, 395, region)).toBe(true);
    });

    it('rejects tiles outside the bounds', () => {
      expect(isTileInRegion(10, 100, 200, region)).toBe(false);
    });

    it('rejects tiles outside the zoom range', () => {
      expect(isTileInRegion(11, 327, 791, region)).toBe(false);
      expect(isTileInRegion(4, 2, 6, region)).toBe(false);
    });
  });

  describe('sourceZoomRange', () => {
    const region = { minZoom: 10, maxZoom: 14 };

    it('uses the region range for unbounded sources', () => {
      expect(sourceZoomRange(region)).toEqual({ min: 10, max: 14 });
    });

    it('intersects overlapping ranges', () => {
      expect(sourceZoomRange(region, 12, 16)).toEqual({ min: 12, max: 14 });
      expect(sourceZoomRange(region, 0, 12)).toEqual({ min: 10, max: 12 });
    });

    it('uses only the source maxzoom when the source ends below the region', () => {
      expect(sourceZoomRange(region, 0, 8)).toEqual({ min: 8, max: 8 });
      expect(sourceZoomRange(region, undefined, 8)).toEqual({ min: 8, max: 8 });
    });

    it('uses the source range when the source starts above the region', () => {
      expect(sourceZoomRange(region, 15, 16)).toEqual({ min: 15, max: 16 });
      expect(sourceZoomRange(region, 15)).toEqual({ min: 15, max: 15 });
    });

    it('rounds fractional source zooms inward', () => {
      expect(sourceZoomRange(region, 10.5, 13.5)).toEqual({ min: 11, max: 13 });
    });
  });
});
