import { useRef, useEffect, useState } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import { updatePolygons } from './utils';
//@ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { DisplayArea } from './DisplayArea';

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);
  const [area, setArea] = useState<number>(0);
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
    // Add zoom and rotation controls to the map.
    map.current.addControl(
      new NavigationControl({
        visualizePitch: true,
        visualizeRoll: true,
        showZoom: true,
        showCompass: true,
      }),
    );

    // Add the polygons to the map
    map.current.once('load', () => {
      updatePolygons(map, setArea);

      // Update the polygon coordinates when the zoom level changes
      map.current!.on('move', () => {
        updatePolygons(map, setArea);
      });
      // map.current!.on('moveend', () => { updatePolygons(map) });
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }} ref={mapContainer}>
      <DisplayArea area={area}></DisplayArea>
    </div>
  );
}

export default App;
