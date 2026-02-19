import * as maplibregl from 'maplibre-gl';
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl, configureProxy } from './index';
import { StyleSwitcherControl, type StyleItem } from 'map-gl-style-switcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-style-switcher/dist/map-gl-style-switcher.css';

// Configure proxy for CARTO tiles (required for local development)
configureProxy({
  tiles: {
    'tiles-a.basemaps.cartocdn.com': '/tiles/carto-a',
    'tiles-b.basemaps.cartocdn.com': '/tiles/carto-b',
    'tiles-c.basemaps.cartocdn.com': '/tiles/carto-c',
    'tiles-d.basemaps.cartocdn.com': '/tiles/carto-d',
    'tiles.basemaps.cartocdn.com': '/tiles/carto-a',
  },
  fonts: {
    'tiles.basemaps.cartocdn.com': '/fonts/carto',
  },
});

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || '';
const MAPBOX_ACCESS_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || localStorage.getItem('mapbox-access-token') || '';

// Tab elements
const tabMaplibre = document.getElementById('tab-maplibre')!;
const tabMapbox = document.getElementById('tab-mapbox')!;
const containerMaplibre = document.getElementById('map-maplibre')!;
const containerMapbox = document.getElementById('map-mapbox')!;

let maplibreMap: maplibregl.Map | null = null;
let mapboxMap: mapboxgl.Map | null = null;
let activeTab: 'maplibre' | 'mapbox' = 'maplibre';

// ---------- Tab switching ----------

function setActiveTab(tab: 'maplibre' | 'mapbox') {
  activeTab = tab;
  localStorage.setItem('active-map-tab', tab);

  const activeClasses = 'bg-blue-600 text-white';
  const inactiveClasses = 'bg-gray-200 text-gray-700 hover:bg-gray-300';

  if (tab === 'maplibre') {
    tabMaplibre.className = `tab-btn px-4 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${activeClasses}`;
    tabMapbox.className = `tab-btn px-4 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${inactiveClasses}`;
    containerMaplibre.classList.remove('hidden');
    containerMapbox.classList.add('hidden');
    if (!maplibreMap) initMaplibre();
    else maplibreMap.resize();
  } else {
    tabMapbox.className = `tab-btn px-4 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${activeClasses}`;
    tabMaplibre.className = `tab-btn px-4 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${inactiveClasses}`;
    containerMapbox.classList.remove('hidden');
    containerMaplibre.classList.add('hidden');
    if (!mapboxMap) initMapbox();
    else mapboxMap.resize();
  }
}

tabMaplibre.addEventListener('click', () => setActiveTab('maplibre'));
tabMapbox.addEventListener('click', () => setActiveTab('mapbox'));

// ---------- MapLibre GL ----------

interface StyleSwitcherControlOptions {
  styles: StyleItem[];
  theme: 'light' | 'dark';
  showLabels: boolean;
  showImages: boolean;
  activeStyleId: string;
  onBeforeStyleChange?: (from: StyleItem, to: StyleItem) => void;
  onAfterStyleChange?: (from: StyleItem, to: StyleItem) => void;
}

function initMaplibre() {
  const styles: StyleItem[] = [
    {
      id: 'liberty',
      name: 'Liberty',
      image:
        'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png',
      styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      description: 'Liberty style from OpenFreeMap',
    },
    {
      id: 'bright',
      name: 'Bright',
      image:
        'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/positron.png',
      styleUrl: 'https://tiles.openfreemap.org/styles/bright',
      description: 'Bright style from OpenFreeMap',
    },
    {
      id: 'positron',
      name: 'Positron',
      image:
        'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/positron.png',
      styleUrl: 'https://tiles.openfreemap.org/styles/positron',
      description: 'Positron style from OpenFreeMap',
    },
    {
      id: 'arcgis-hybrid',
      name: 'ArcGIS Hybrid',
      image:
        'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/arcgis-hybrid.png',
      styleUrl:
        'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/arcgis_hybrid.json',
      description: 'Hybrid Satellite style from ESRI',
    },
    {
      id: 'osm-maptiler',
      name: 'OSM-MapTiler',
      image:
        'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png',
      styleUrl: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_API_KEY}`,
      description: 'OSM style from MapTiler',
    },
  ];
  const defaultStyle = styles[0];

  maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js',
    true
  );

  const map = new maplibregl.Map({
    container: 'map-maplibre',
    style: defaultStyle.styleUrl,
    center: [55.2708, 25.2048],
    zoom: 14,
    attributionControl: false,
  });
  maplibreMap = map;

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

  const offlineManager = new OfflineMapManager();
  const offlineManagerControl = new OfflineManagerControl(offlineManager, {
    styleUrl: defaultStyle.styleUrl,
    theme: 'light',
    showBbox: true,
    mapLib: maplibregl as any,
  });

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    }),
    'top-right'
  );

  map.addControl(offlineManagerControl, 'top-right');

  const mapContainer = map.getContainer();
  mapContainer.style.position = 'relative';

  const chipsContainer = document.createElement('div');
  chipsContainer.className =
    'bottom-chips-container absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-[999]';
  mapContainer.appendChild(chipsContainer);

  const zoomDisplay = document.createElement('div');
  zoomDisplay.className =
    'glass-panel rounded-full px-5 py-2.5 font-sans text-sm font-semibold text-gray-800 dark:text-white whitespace-nowrap flex items-center gap-2.5 pointer-events-none transition-all shadow-lg backdrop-blur-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-gray-900/60';

  const zoomIcon = document.createElement('span');
  zoomIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600 dark:text-primary-400"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`;
  zoomDisplay.appendChild(zoomIcon);

  const zoomText = document.createElement('span');
  zoomText.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
  zoomDisplay.appendChild(zoomText);
  chipsContainer.appendChild(zoomDisplay);

  map.on('zoom', () => {
    zoomText.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
  });

  const styleSwitcher = new StyleSwitcherControl({
    styles,
    theme: 'light',
    showLabels: true,
    showImages: true,
    activeStyleId: defaultStyle.id,
    onBeforeStyleChange: (_from: StyleItem, _to: StyleItem): void => {},
    onAfterStyleChange: (_from: StyleItem, to: StyleItem): void => {
      map.setStyle(to.styleUrl, { diff: false });
      offlineManagerControl.updateStyleUrl(to.styleUrl);
    },
  } as StyleSwitcherControlOptions);
  map.addControl(styleSwitcher, 'top-left');
}

// ---------- Mapbox GL ----------

const MAPBOX_STYLES: { id: string; name: string; url: string }[] = [
  { id: 'streets-v12', name: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'outdoors-v12', name: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'light-v11', name: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'dark-v11', name: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite-v9', name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-v9' },
  {
    id: 'satellite-streets-v12',
    name: 'Satellite Streets',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
  },
  { id: 'standard', name: 'Standard', url: 'mapbox://styles/mapbox/standard' },
];

function showMapboxTokenPrompt() {
  containerMapbox.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <svg class="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h2 class="text-xl font-bold text-gray-800 mb-2">Mapbox Access Token Required</h2>
        <p class="text-gray-500 text-sm mb-6">Enter your Mapbox access token to use the Mapbox GL map. You can find it at
          <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">account.mapbox.com</a>.
        </p>
        <form id="mapbox-token-form" class="flex flex-col gap-3">
          <input id="mapbox-token-input" type="text" placeholder="pk.eyJ1Ijo..." spellcheck="false" autocomplete="off"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button type="submit"
            class="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm cursor-pointer">
            Save &amp; Load Map
          </button>
        </form>
      </div>
    </div>`;

  const form = document.getElementById('mapbox-token-form')!;
  const input = document.getElementById('mapbox-token-input') as HTMLInputElement;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const token = input.value.trim();
    if (!token) return;
    localStorage.setItem('mapbox-access-token', token);
    // Reload the page so the token is picked up globally
    window.location.reload();
  });
}

function initMapbox() {
  if (!MAPBOX_ACCESS_TOKEN) {
    showMapboxTokenPrompt();
    return;
  }

  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

  const defaultMapboxStyle = MAPBOX_STYLES[0];

  const map = new mapboxgl.Map({
    container: 'map-mapbox',
    style: defaultMapboxStyle.url,
    center: [55.2708, 25.2048],
    zoom: 14,
    attributionControl: false,
  });
  mapboxMap = map;

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
    }),
    'top-right'
  );

  const offlineManager = new OfflineMapManager();
  const offlineManagerControl = new OfflineManagerControl(offlineManager, {
    styleUrl: defaultMapboxStyle.url,
    accessToken: MAPBOX_ACCESS_TOKEN,
    theme: 'light',
    showBbox: true,
  });
  map.addControl(offlineManagerControl as unknown as mapboxgl.IControl, 'top-right');

  // Style switcher for Mapbox
  const switcherContainer = document.createElement('div');
  switcherContainer.className =
    'mapboxgl-ctrl mapboxgl-ctrl-group bg-white rounded-lg shadow-md p-2';

  const select = document.createElement('select');
  select.className =
    'text-sm font-medium text-gray-700 bg-white border-none cursor-pointer outline-none';
  for (const s of MAPBOX_STYLES) {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name;
    if (s.id === defaultMapboxStyle.id) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    const selected = MAPBOX_STYLES.find(s => s.id === select.value);
    if (selected) {
      (
        map as unknown as { setStyle: (style: string, options?: { diff?: boolean }) => void }
      ).setStyle(selected.url, { diff: false });
      offlineManagerControl.updateStyleUrl(selected.url);
    }
  });
  switcherContainer.appendChild(select);

  // Wrap in an IControl-compatible object
  const styleSwitcherControl: mapboxgl.IControl = {
    onAdd() {
      return switcherContainer;
    },
    onRemove() {
      switcherContainer.remove();
    },
  };
  map.addControl(styleSwitcherControl, 'top-left');

  // Zoom chip
  const mapContainer = map.getContainer();
  mapContainer.style.position = 'relative';

  const chipsContainer = document.createElement('div');
  chipsContainer.className =
    'bottom-chips-container absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-[999]';
  mapContainer.appendChild(chipsContainer);

  const zoomDisplay = document.createElement('div');
  zoomDisplay.className =
    'glass-panel rounded-full px-5 py-2.5 font-sans text-sm font-semibold text-gray-800 dark:text-white whitespace-nowrap flex items-center gap-2.5 pointer-events-none transition-all shadow-lg backdrop-blur-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-gray-900/60';

  const zoomIcon = document.createElement('span');
  zoomIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary-600 dark:text-primary-400"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`;
  zoomDisplay.appendChild(zoomIcon);

  const zoomText = document.createElement('span');
  zoomText.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
  zoomDisplay.appendChild(zoomText);
  chipsContainer.appendChild(zoomDisplay);

  map.on('zoom', () => {
    zoomText.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
  });

  // ---------- Standard style mode controls (Mapbox GL JS v3+ only) ----------

  const supportsStandardMode =
    typeof (map as any).setConfigProperty === 'function' &&
    typeof (map as any).setRain === 'function' &&
    typeof (map as any).setSnow === 'function';

  if (!supportsStandardMode) return;

  const zoomBasedReveal = (value: number) => [
    'interpolate',
    ['linear'],
    ['zoom'],
    11,
    0.0,
    13,
    value,
  ];

  const RAIN_PARAMS = {
    density: zoomBasedReveal(0.6),
    intensity: 0.5,
    color: '#a5c8d0',
    opacity: 0.6,
    vignette: zoomBasedReveal(0.4),
    direction: [0, 80],
    'droplet-size': [1.5, 12.0],
    'distortion-strength': zoomBasedReveal(0.5),
    'center-thinning': 0.57,
  };

  const SNOW_PARAMS = {
    density: zoomBasedReveal(0.85),
    intensity: 1.0,
    'center-thinning': 0.1,
    direction: [0, 50],
    opacity: 1.0,
    color: '#ffffff',
    'flake-size': [1.5, 4.0],
    vignette: zoomBasedReveal(0.3),
    'vignette-color': '#ffffff',
  };

  type LightPreset = 'day' | 'night' | 'dawn' | 'dusk';
  type WeatherMode = 'none' | 'rain' | 'snow';

  let currentLightPreset: LightPreset = 'day';
  let currentWeather: WeatherMode = 'none';
  let isStandardStyle = defaultMapboxStyle.id === 'standard';

  const lightBtns: HTMLButtonElement[] = [];
  const weatherBtns: Map<WeatherMode, HTMLButtonElement> = new Map();

  function applyLightPreset(preset: LightPreset) {
    currentLightPreset = preset;
    (map as any).setConfigProperty('basemap', 'lightPreset', preset);
    for (const btn of lightBtns) {
      btn.classList.toggle('active', btn.dataset.preset === preset);
    }
  }

  function applyWeather(weather: WeatherMode) {
    currentWeather = weather;
    (map as any).setRain(null);
    (map as any).setSnow(null);
    if (weather === 'rain') (map as any).setRain(RAIN_PARAMS);
    if (weather === 'snow') (map as any).setSnow(SNOW_PARAMS);
    for (const [mode, btn] of weatherBtns) {
      btn.classList.toggle('active', mode === weather);
    }
  }

  function updateModeBarVisibility(show: boolean) {
    if (show) {
      modeControlBar.classList.remove('hidden');
      modeControlBar.classList.add('mode-bar-enter');
    } else {
      modeControlBar.classList.add('hidden');
      modeControlBar.classList.remove('mode-bar-enter');
      currentLightPreset = 'day';
      currentWeather = 'none';
      for (const btn of lightBtns) {
        btn.classList.toggle('active', btn.dataset.preset === 'day');
      }
      for (const [, btn] of weatherBtns) {
        btn.classList.remove('active');
      }
    }
  }

  // Build mode control bar DOM
  const modeControlBar = document.createElement('div');
  modeControlBar.className =
    'glass-panel rounded-full px-4 py-2 flex items-center gap-2 shadow-lg backdrop-blur-xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-gray-900/60 hidden';

  const lightPresets: { preset: LightPreset; label: string }[] = [
    { preset: 'day', label: 'Day' },
    { preset: 'dawn', label: 'Dawn' },
    { preset: 'dusk', label: 'Dusk' },
    { preset: 'night', label: 'Night' },
  ];

  for (const { preset, label } of lightPresets) {
    const btn = document.createElement('button');
    btn.className = `mode-chip-btn${preset === 'day' ? ' active' : ''}`;
    btn.dataset.preset = preset;
    btn.textContent = label;
    btn.addEventListener('click', () => applyLightPreset(preset));
    modeControlBar.appendChild(btn);
    lightBtns.push(btn);
  }

  const divider = document.createElement('div');
  divider.className = 'w-px h-5 bg-gray-300/60 dark:bg-white/15 mx-1';
  modeControlBar.appendChild(divider);

  const weatherModes: { mode: 'rain' | 'snow'; label: string }[] = [
    { mode: 'rain', label: 'Rain' },
    { mode: 'snow', label: 'Snow' },
  ];

  for (const { mode, label } of weatherModes) {
    const btn = document.createElement('button');
    btn.className = 'mode-chip-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      applyWeather(currentWeather === mode ? 'none' : mode);
    });
    modeControlBar.appendChild(btn);
    weatherBtns.set(mode, btn);
  }

  chipsContainer.appendChild(modeControlBar);

  // Show mode bar if starting with Standard style
  if (isStandardStyle) {
    updateModeBarVisibility(true);
  }

  // Wire style switcher to toggle mode bar
  select.addEventListener('change', () => {
    const selected = MAPBOX_STYLES.find(s => s.id === select.value);
    if (selected) {
      isStandardStyle = selected.id === 'standard';
      updateModeBarVisibility(isStandardStyle);
    }
  });

  // Re-apply mode settings after style reload
  map.on('style.load', () => {
    if (isStandardStyle) {
      applyLightPreset(currentLightPreset);
      applyWeather(currentWeather);
    }
  });
}

// ---------- Initialize saved or default tab ----------
const savedTab = localStorage.getItem('active-map-tab') as 'maplibre' | 'mapbox' | null;
setActiveTab(savedTab === 'mapbox' ? 'mapbox' : 'maplibre');
