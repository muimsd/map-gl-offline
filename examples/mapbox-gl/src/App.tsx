import { useRef, useEffect, useState } from 'react';
import mapboxgl, { Map, NavigationControl } from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'mapbox-gl/dist/mapbox-gl.css';

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<Map | null>(null);
  const offlineManager = useRef<OfflineMapManager | null>(null);
  const [token, setToken] = useState<string>(
    localStorage.getItem('mapbox_token') || ''
  );
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    if (map.current || !mapContainer.current || !token) return;

    mapboxgl.accessToken = token;

    const styleUrl = 'mapbox://styles/mapbox/streets-v12';

    map.current = new Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [44.3763, 33.2788],
      zoom: 11,
    });

    offlineManager.current = new OfflineMapManager();

    map.current.addControl(
      new NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      })
    );

    map.current.addControl(
      new OfflineManagerControl(offlineManager.current, {
        styleUrl,
        theme: 'dark',
      }) as unknown as mapboxgl.IControl,
      'top-right'
    );
  }, [token]);

  if (!token) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Mapbox GL JS Example</h2>
          <p>Enter your Mapbox access token to continue:</p>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="pk...."
            style={{
              width: '400px',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              color: '#000',
            }}
          />
          <br />
          <button
            onClick={() => {
              if (tokenInput.trim()) {
                localStorage.setItem('mapbox_token', tokenInput.trim());
                setToken(tokenInput.trim());
              }
            }}
            style={{
              marginTop: '12px',
              padding: '8px 24px',
              fontSize: '14px',
              cursor: 'pointer',
              backgroundColor: '#4264fb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            Load Map
          </button>
        </div>
      </div>
    );
  }

  return <div style={{ width: '100vw', height: '100vh' }} ref={mapContainer}></div>;
}

export default App;
