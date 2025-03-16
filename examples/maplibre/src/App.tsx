import { useRef, useEffect } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);
  useEffect(() => {
    if (map.current || !mapContainer.current) return; // stops map from intializing more than once
    const lng = 35;
    const lat = 41;
    const zoom = 0;
    map.current = new Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [lng, lat],
      zoom: zoom,
    });
    // Add zoom and rotation controls to the map.
    map.current.addControl(
      new NavigationControl({
        visualizePitch: true,
        visualizeRoll: true,
        showZoom: true,
        showCompass: true,
      }),
    );
  }, []);
  return (
    <div style={{ width: '100wh', height: '100vh' }} ref={mapContainer}></div>
  );
}

export default App;
