import { formatLat, formatLng, tickInterval, ticksBetween } from '../../src/sheet/collar';

describe('map collar', () => {
  it('picks the smallest round interval that fits', () => {
    expect(tickInterval(0.003)).toBe(0.005);
    expect(tickInterval(0.01)).toBe(0.01);
    expect(tickInterval(1000)).toBe(45);
  });

  it('lists round multiples inside the range, without float drift', () => {
    expect(ticksBetween(55.26, 55.301, 0.01)).toEqual([55.26, 55.27, 55.28, 55.29, 55.3]);
    expect(ticksBetween(-0.15, 0.15, 0.1)).toEqual([-0.1, 0, 0.1]);
    expect(ticksBetween(1.01, 1.09, 0.1)).toEqual([]);
  });

  it('labels hemispheres', () => {
    expect(formatLat(25.2, 1)).toBe('25.2° N');
    expect(formatLat(-33.9, 1)).toBe('33.9° S');
    expect(formatLng(55.27, 2)).toBe('55.27° E');
    expect(formatLng(-74, 0)).toBe('74° W');
  });

  it('wraps longitudes past the antimeridian', () => {
    expect(formatLng(190, 0)).toBe('170° W');
    expect(formatLng(-190, 0)).toBe('170° E');
  });
});
