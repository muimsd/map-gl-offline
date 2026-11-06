/**
 * The demo's map collar: latitude and longitude ticks along the map's edge and
 * a coordinate readout below it, as in the margin of a printed map sheet.
 * Demo only; nothing here ships in the library.
 */

/** The parts of a MapLibre or Mapbox GL map the collar reads. */
export interface CollarMap {
  getBounds(): {
    getWest(): number;
    getEast(): number;
    getNorth(): number;
    getSouth(): number;
  } | null;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  project(lngLat: [number, number]): { x: number; y: number };
  on(event: string, listener: () => void): unknown;
}

const INTERVALS = [
  0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 45,
];
const MIN_LON_TICK_GAP_PX = 96;
const MIN_LAT_TICK_GAP_PX = 56;

/** The smallest round interval that keeps ticks at least `minGap` degrees apart. */
export function tickInterval(minGap: number): number {
  return INTERVALS.find(interval => interval >= minGap) ?? INTERVALS[INTERVALS.length - 1];
}

/** Round multiples of `interval` between `min` and `max`. */
export function ticksBetween(min: number, max: number, interval: number): number[] {
  const ticks: number[] = [];
  const last = Math.floor(max / interval);
  for (let i = Math.ceil(min / interval); i <= last; i++) {
    ticks.push(Number((i * interval).toFixed(6)));
  }
  return ticks;
}

function decimalsFor(interval: number): number {
  const text = String(interval);
  const point = text.indexOf('.');
  return point === -1 ? 0 : text.length - point - 1;
}

export function formatLng(lng: number, decimals: number): string {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return `${Math.abs(wrapped).toFixed(decimals)}° ${wrapped < 0 ? 'W' : 'E'}`;
}

export function formatLat(lat: number, decimals: number): string {
  return `${Math.abs(lat).toFixed(decimals)}° ${lat < 0 ? 'S' : 'N'}`;
}

function drawTicks(strip: HTMLElement, positions: Array<{ at: number; label: string }>): void {
  const axis = strip.dataset.axis === 'lat' ? 'top' : 'left';
  strip.replaceChildren(
    ...positions.map(({ at, label }) => {
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.style[axis] = `${at}px`;
      tick.textContent = label;
      return tick;
    })
  );
}

/** Keep the collar in step with `map`. */
export function attachCollar(map: CollarMap): void {
  const lonStrip = document.getElementById('collar-lon');
  const latStrip = document.getElementById('collar-lat');
  const position = document.getElementById('readout-position');
  const zoom = document.getElementById('readout-zoom');
  if (!lonStrip || !latStrip || !position || !zoom) return;

  const render = () => {
    const center = map.getCenter();
    position.textContent = `${formatLat(center.lat, 4)}, ${formatLng(center.lng, 4)}`;
    zoom.textContent = `Zoom ${map.getZoom().toFixed(2)}`;

    // A straight edge only has one longitude or latitude when the map is flat
    // and north-up, so ticks would mislead on a tilted or turned map.
    const bounds = map.getBounds();
    const isSquareOn = map.getBearing() === 0 && map.getPitch() === 0;
    const width = lonStrip.clientWidth;
    const height = latStrip.clientHeight;
    if (!bounds || !isSquareOn || width === 0) {
      drawTicks(lonStrip, []);
      drawTicks(latStrip, []);
      return;
    }

    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    const lonStep = tickInterval(((east - west) / width) * MIN_LON_TICK_GAP_PX);
    drawTicks(
      lonStrip,
      ticksBetween(west, east, lonStep).map(lng => ({
        at: map.project([lng, center.lat]).x,
        label: formatLng(lng, decimalsFor(lonStep)),
      }))
    );

    if (height === 0) {
      drawTicks(latStrip, []);
      return;
    }
    const latStep = tickInterval(((north - south) / height) * MIN_LAT_TICK_GAP_PX);
    drawTicks(
      latStrip,
      ticksBetween(south, north, latStep).map(lat => ({
        at: map.project([center.lng, lat]).y,
        label: formatLat(lat, decimalsFor(latStep)),
      }))
    );
  };

  map.on('move', render);
  map.on('resize', render);
  map.on('load', render);
  render();
}
