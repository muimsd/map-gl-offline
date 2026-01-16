import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from './index';
import { StyleSwitcherControl, type StyleItem } from 'map-gl-style-switcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-style-switcher/dist/map-gl-style-switcher.css';

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY || '';

const styles: StyleItem[] = [
  {
    id: 'voyager',
    name: 'Voyager',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/voyager.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    description: 'Voyager style from Carto',
  },
  {
    id: 'positron',
    name: 'Positron',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/positron.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    description: 'Positron style from Carto',
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/dark.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    description: 'Dark style from Carto',
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
    id: 'osm',
    name: 'OSM',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png',
    styleUrl:
      'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json',
    description: 'OSM style',
  },
  {
    id: 'osm-maptiler',
    name: 'OSM-MapTiler',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png',
    styleUrl: `https://api.maptiler.com/maps/openstreetmap/style.json?key=${MAPTILER_API_KEY}`,
    description: 'OSM style',
  },
  {
    id: 'basic',
    name: 'Basic',
    image:
      'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/positron.png',
    styleUrl: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_API_KEY}`,
    description: 'Basic style from MapTiler',
  },
];
const defaultStyle = styles[0];

const map = new maplibregl.Map({
  container: 'map',
  style: defaultStyle.styleUrl, // Example style
  center: [55.2708, 25.2048], // Dubai coordinates
  zoom: 14,
  attributionControl: false,
});
// Add navigation controls (zoom in/out, compass, pitch/rotate)
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add attribution control with compact mode
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

const offlineManager = new OfflineMapManager();
const offlineManagerControl = new OfflineManagerControl(offlineManager, {
  styleUrl: defaultStyle.styleUrl,
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

// Add style switcher control
interface StyleSwitcherControlOptions {
  styles: StyleItem[];
  theme: 'light' | 'dark';
  showLabels: boolean;
  showImages: boolean;
  activeStyleId: string;
  onBeforeStyleChange?: (from: StyleItem, to: StyleItem) => void;
  onAfterStyleChange?: (from: StyleItem, to: StyleItem) => void;
}

// Create chips container for bottom indicators (zoom, area, etc.)
const mapContainer = map.getContainer();
mapContainer.style.position = 'relative'; // Ensure map container has relative positioning

const chipsContainer = document.createElement('div');
chipsContainer.className = 'bottom-chips-container absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-[999]';
mapContainer.appendChild(chipsContainer);

// Create zoom display chip
const zoomDisplay = document.createElement('div');
zoomDisplay.className =
  'offline-manager-control bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-xl px-4 py-2 font-sans text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap flex items-center gap-2 pointer-events-none';

const zoomIcon = document.createElement('span');
zoomIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`;
zoomDisplay.appendChild(zoomIcon);

const zoomText = document.createElement('span');
zoomText.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
zoomDisplay.appendChild(zoomText);

// Add zoom chip to container
chipsContainer.appendChild(zoomDisplay);

// Update zoom display on zoom changes
map.on('zoom', () => {
  const zoomLevel = map.getZoom().toFixed(2);
  zoomText.textContent = `Zoom: ${zoomLevel}`;

  // Current zoom level tracking for debugging
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Current zoom level: ${zoomLevel}`);
  }
});

const styleSwitcher: StyleSwitcherControl = new StyleSwitcherControl({
  styles: styles,
  theme: 'light',
  showLabels: true,
  showImages: true,
  activeStyleId: defaultStyle.id,
  onBeforeStyleChange: (_from: StyleItem, _to: StyleItem): void => {
    // Changing style from _from.name to _to.name
  },
  onAfterStyleChange: (_from: StyleItem, to: StyleItem): void => {
    map.setStyle(to.styleUrl);
    // Update offline manager style URL
    offlineManagerControl.updateStyleUrl(to.styleUrl);
    // Style changed to to.name and offline manager updated
  },
} as StyleSwitcherControlOptions);
map.addControl(styleSwitcher, 'top-left');
