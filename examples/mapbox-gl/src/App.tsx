import { useRef, useEffect, useState } from 'react';
import mapboxgl, { Map, NavigationControl } from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'map-gl-offline/style.css';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set up RTL text plugin ONCE at module level (before any map is created)
// This must be outside of React components to avoid multiple calls
const rtlPluginUrl = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
try {
  mapboxgl.setRTLTextPlugin(rtlPluginUrl, undefined, true);
  console.log('RTL Text Plugin registered');
} catch (e) {
  // Plugin might already be loaded
  console.log('RTL Text Plugin already registered or error:', e);
}

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

    // Center on Baghdad, Iraq to see Arabic labels
    const styleUrl = 'mapbox://styles/mapbox/streets-v12';

    map.current = new Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [44.3763, 33.2788],
      zoom: 11,
    });

    // Initialize offline manager
    offlineManager.current = new OfflineMapManager();

    // Add zoom and rotation controls to the map.
    map.current.addControl(
      new NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      })
    );

    // Add the offline manager control with dark theme.
    // OfflineManagerControl satisfies both MapLibre's and Mapbox's IControl
    // (since 0.8.5) — no cast needed.
    map.current.addControl(
      new OfflineManagerControl(offlineManager.current, {
        styleUrl,
        theme: 'dark',
        mapLib: mapboxgl,
        accessToken: token,
      }),
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
