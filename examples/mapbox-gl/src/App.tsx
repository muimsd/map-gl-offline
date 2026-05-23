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
    // accessToken accepts `string | null` (since 0.8.7), so `mapboxgl.accessToken`
    // — typed `string | null | undefined` by Mapbox GL — can be passed directly.
    // Note: `mapLib` is omitted because Mapbox GL v3 has no `addProtocol`; the
    // library falls back to a Service Worker for offline tile serving. See the
    // README "Mapbox GL JS" section for the one-time setup (`npx map-gl-offline init`).
    map.current.addControl(
      new OfflineManagerControl(offlineManager.current, {
        styleUrl,
        theme: 'dark',
        accessToken: mapboxgl.accessToken,
      }),
      'top-right'
    );

    // Programmatic two-tier download (uncomment to try): a low-zoom global
    // overview plus high-zoom detail per city. `BoundingBox` keeps inline
    // coordinate literals from widening to `number[][]`.
    //
    // import type { BoundingBox, DownloadRegionProgress } from 'map-gl-offline';
    //
    // const opts = {
    //   accessToken: mapboxgl.accessToken,
    //   onProgress: ({ phase, percentage }: DownloadRegionProgress) =>
    //     console.log(`[${phase}] ${percentage.toFixed(1)}%`),
    // };
    // await offlineManager.current.downloadRegion(
    //   {
    //     id: 'global-overview',
    //     name: 'Global overview',
    //     bounds: [[-180, -85.0511], [180, 85.0511]],
    //     minZoom: 0,
    //     maxZoom: 6,
    //     styleUrl,
    //     multipleRegions: true,
    //   },
    //   opts,
    // );
    // const cities: Array<{ id: string; name: string; bounds: BoundingBox }> = [
    //   { id: 'baghdad', name: 'Baghdad', bounds: [[44.30, 33.24], [44.45, 33.36]] },
    // ];
    // for (const city of cities) {
    //   await offlineManager.current.downloadRegion(
    //     { ...city, minZoom: 6, maxZoom: 14, styleUrl, multipleRegions: true },
    //     opts,
    //   );
    // }
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
