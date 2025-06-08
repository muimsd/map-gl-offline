import { useRef, useEffect } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
//@ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);
  const offlineManager = useRef<OfflineMapManager | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // stops map from initializing more than once
    const lng = 35;
    const lat = 41;
    const zoom = 10;
    map.current = new Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
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
    map.current.addControl(
      new OfflineManagerControl(offlineManager.current, { theme: 'dark' }) as any, 
      'top-right'
    );
  }, []);



  // For testing: manual cleanup
  const handleCleanup = async () => {
    // const offlineManager = new OfflineMapManager();
    // const cleanedCount = await offlineManager.cleanupExpiredRegions();
    // alert(`Manual cleanup removed ${cleanedCount} expired regions`);
  };
  return (
    <div style={{ width: '100vw', height: '100vh' }} ref={mapContainer}>
    </div>
  );
}

export default App;
