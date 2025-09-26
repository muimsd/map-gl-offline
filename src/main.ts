import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from './index';
import { StyleSwitcherControl, type StyleItem } from 'map-gl-style-switcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-style-switcher/dist/map-gl-style-switcher.css';

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
    styleUrl: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=REDACTED_API_KEY',
    description: 'OSM style',
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
