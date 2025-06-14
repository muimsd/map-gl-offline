import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from './index';
import 'maplibre-gl/dist/maplibre-gl.css';

const styleURL = 'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/arcgis_hybrid.json';
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
// Add navigation controls (zoom in/out, compass, pitch/rotate)
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add scale control
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

const offlineManager = new OfflineMapManager();
const offlineManagerControl = new OfflineManagerControl(offlineManager, {
  styleUrl: styleURL,
  theme: 'light',
  showBbox: true,
});

// Add geolocate control
map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
    showUserLocation: true,
  }),
  'top-right'
);

// Add our custom offline manager control
map.addControl(offlineManagerControl, 'top-right');
// map.on('load', async () => {
//   console.log('Map loaded');
//   // get style url from the map instance
// const styleUrl = map?._options?.style;
// console.log('Style URL:', styleUrl);
// });
// Start automatic cleanup of expired regions (runs every hour)
// offlineManager.setupAutoCleanup();

// Optional: manually trigger cleanup
async function manualCleanup() {
  const cleanedCount = await offlineManager.cleanupExpiredRegions();
  console.warn(`Manual cleanup removed ${cleanedCount} expired regions`);
}

async function handleOffline() {
  // Example usage of OfflineMapManager
  await offlineManager.addRegion({
    id: 'test-region',
    name: 'Test Downtown Area',
    multipleRegions: true,
    styleUrl: styleURL,
    bounds: [
      [34.97256123524991, 40.996721656078336],
      [34.981376429930464, 41.00112029961136],
    ],
    minZoom: 0,
    maxZoom: 6,
    deleteOnExpiry: true, // This region will be auto-deleted when expired
  });

  console.warn('Region download initiated');

  // Refresh the offline manager control to show the new region
  // await offlineManagerControl.refresh(); // Method doesn't exist
}

//   // // Example: check region expiry
//   // const expiryInfo = await offlineManager.getRegionExpiry('world');
//   // if (expiryInfo) {
//   //   console.warn(`Region expires: ${new Date(expiryInfo.expiry).toISOString()}`);
//   //   console.warn(`Is expired: ${expiryInfo.expired}`);

//   //   // Example: extend expiry if needed
//   //   if (expiryInfo.expired) {
//   //     // await offlineManager.extendRegionExpiry('world');
//   //     console.warn('Extended region expiry');
//   //   }
//   // }
// }
// map.on('load', async () => {
//   console.log('Map loaded');
//   // Get the style URL from the map instance
//   // const styleURL = map.getStyle()?.styleUrl;
//   handleOffline();
// });
