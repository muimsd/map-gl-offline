import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager } from './map/offlineManager';
import 'maplibre-gl/dist/maplibre-gl.css';
const styleURL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const map = new maplibregl.Map({
  container: 'map',
  style: styleURL, // Example style
  //   center: [0, 0],
  //   zoom: 10,
  bounds: [
    34.76475524902282, 40.864516064381775, 35.235244750976044,
    41.13471472990187,
  ],
});

const offlineManager = new OfflineMapManager();

map.on('load', async () => {
  console.log('Map loaded');
  // Get the style URL from the map instance
  //   const styleURL = map.getStyle()?.styleUrl;

  console.log('Style URL:', styleURL);
  // Example usage of OfflineMapManager
  await offlineManager.addRegion({
    id: 'world',
    name: 'World',
    multipleRegions: true,
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    bounds: [
      [-180, -85],
      [180, 85],
    ],
    minZoom: 0,
    maxZoom: 6,
  });
});
