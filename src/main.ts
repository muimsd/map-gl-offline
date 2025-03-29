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
    [34.97256123524991, 40.996721656078336],
    [34.981376429930464, 41.00112029961136],
  ],
});

const offlineManager = new OfflineMapManager();

async function handleOffline() {
  //   Example usage of OfflineMapManager
  await offlineManager.addRegion({
    id: 'world',
    name: 'World',
    multipleRegions: true,
    styleUrl: styleURL,
    bounds: [
      [34.97256123524991, 40.996721656078336],
      [34.981376429930464, 41.00112029961136],
    ],
    minZoom: 0,
    maxZoom: 6,
  });

  console.log('Style URL:', styleURL);
}
// Attach the function to the global scope
(window as any).handleOffline = handleOffline;
map.on('load', async () => {
  console.log('Map loaded');
  // Get the style URL from the map instance
  // const styleURL = map.getStyle()?.styleUrl;
  handleOffline();
});
