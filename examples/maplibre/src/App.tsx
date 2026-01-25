import { useRef, useEffect } from 'react';
import maplibregl, { Map, NavigationControl } from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
//@ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';

// Set up RTL text plugin ONCE at module level (before any map is created)
// This must be outside of React components to avoid multiple calls
const rtlPluginUrl = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
try {
  maplibregl.setRTLTextPlugin(rtlPluginUrl, true);
  console.log('RTL Text Plugin registered');
} catch (e) {
  // Plugin might already be loaded
  console.log('RTL Text Plugin already registered or error:', e);
}

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);
  const offlineManager = useRef<OfflineMapManager | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // stops map from initializing more than once
    // Center on Baghdad, Iraq to see Arabic labels
    const lng = 44.3763;
    const lat = 33.2788;
    const zoom = 11;

    map.current = new Map({
      container: mapContainer.current,
      // Using OpenFreeMap which has Arabic labels
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [lng, lat],
      zoom: zoom,
    });

    // Initialize offline manager
    offlineManager.current = new OfflineMapManager();

    // Add zoom and rotation controls to the map.
    map.current.addControl(
      new NavigationControl({
        visualizePitch: true,
        visualizeRoll: true,
        showZoom: true,
        showCompass: true,
      })
    );

    // Add the offline manager control with dark theme
    const styleUrl = 'https://tiles.openfreemap.org/styles/bright';
    map.current.addControl(
      new OfflineManagerControl(offlineManager.current, {
        styleUrl,
        theme: 'dark'
      }) as unknown as maplibregl.IControl,
      'top-right'
    );
  }, []);
  return <div style={{ width: '100vw', height: '100vh' }} ref={mapContainer}></div>;
}

export default App;
