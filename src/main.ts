// filepath: /Users/muimsd/projects/opensource/map-gl-offline/src/main.ts
import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager } from './map/offlineManager';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // Example style
  center: [0, 0],
  zoom: 2,
});

const offlineManager = new OfflineMapManager();

map.on('load', async () => {
  console.log('Map loaded');
  // Get the style URL from the map instance
  const styleUrl =
    map.getStyle().sprite ||
    map.getStyle().metadata?.['mapbox:origin'] ||
    map.getStyle().metadata?.['mapbox:style'];

  console.log('Style URL:', styleUrl);
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
