/**
 * Utility for detecting the correct CSS class prefix based on the map library.
 *
 * MapLibre GL JS uses `maplibregl-ctrl*` classes while Mapbox GL JS uses
 * `mapboxgl-ctrl*`. This module inspects the map container to determine which
 * library is in use and returns the appropriate prefix.
 */

export type CssPrefix = 'maplibregl' | 'mapboxgl';

/**
 * Detect the CSS class prefix by checking the map container's class list.
 * Both MapLibre and Mapbox add a distinguishing class (`maplibregl-map` or
 * `mapboxgl-map`) to the container element.
 *
 * Defaults to `'maplibregl'` when neither class is present.
 */
export function detectCssPrefix(mapContainer: HTMLElement): CssPrefix {
  return mapContainer.classList.contains('mapboxgl-map') ? 'mapboxgl' : 'maplibregl';
}
