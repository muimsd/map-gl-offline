import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager } from './managers/offlineMapManager';
import { RegionsControl } from './ui/regionsControl';
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

// Add navigation controls (zoom in/out, compass, pitch/rotate)
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add fullscreen control
map.addControl(new maplibregl.FullscreenControl(), 'top-right');

// Add scale control
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// Add geolocate control
map.addControl(new maplibregl.GeolocateControl({
  positionOptions: {
    enableHighAccuracy: true
  },
  trackUserLocation: true,
  showUserLocation: true
}), 'top-right');

// Add our custom regions control
const regionsControl = new RegionsControl(offlineManager);
map.addControl(regionsControl, 'top-left');

// Make regionsControl available globally for button callbacks
(window as any).regionsControl = regionsControl;

// Start automatic cleanup of expired regions (runs every hour)
offlineManager.setupAutoCleanup();

// Optional: manually trigger cleanup
async function manualCleanup() {
  const cleanedCount = await offlineManager.cleanupExpiredRegions();
  console.warn(`Manual cleanup removed ${cleanedCount} expired regions`);
}

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
    deleteOnExpiry: true, // This region will be auto-deleted when expired
  });

  console.warn('Style URL:', styleURL);

  // Refresh the regions control to show the new region
  await regionsControl.refresh();

  // Example: check region expiry
  const expiryInfo = await offlineManager.getRegionExpiry('world');
  if (expiryInfo) {
    console.warn(`Region expires: ${new Date(expiryInfo.expiry).toISOString()}`);
    console.warn(`Is expired: ${expiryInfo.expired}`);

    // Example: extend expiry if needed
    if (expiryInfo.expired) {
      // await offlineManager.extendRegionExpiry('world');
      console.warn('Extended region expiry');
    }
  }
}
// Attach functions to the global scope
(window as Window & typeof globalThis & { handleOffline: () => Promise<void>; manualCleanup: () => Promise<void> }).handleOffline = handleOffline;
(window as Window & typeof globalThis & { handleOffline: () => Promise<void>; manualCleanup: () => Promise<void> }).manualCleanup = manualCleanup;
map.on('load', async () => {
  console.warn('Map loaded');
  // Get the style URL from the map instance
  // const styleURL = map.getStyle()?.styleUrl;
  handleOffline();
});
