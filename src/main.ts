import * as maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from './index';
import { StyleSwitcherControl, type StyleItem } from 'map-gl-style-switcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-style-switcher/dist/map-gl-style-switcher.css';

const styles: StyleItem[] = [
  {
    id: 'voyager',
    name: 'Voyager',
    image: 'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/voyager.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    description: 'Voyager style from Carto',
  },
  {
    id: 'positron',
    name: 'Positron',
    image: 'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/positron.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    description: 'Positron style from Carto',
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter',
    image: 'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/dark.png',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    description: 'Dark style from Carto',
  },
  {
    id: 'arcgis-hybrid',
    name: 'ArcGIS Hybrid',
    image: 'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/arcgis-hybrid.png',
    styleUrl:
      'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/arcgis_hybrid.json',
    description: 'Hybrid Satellite style from ESRI',
  },
  {
    id: 'osm',
    name: 'OSM',
    image: 'https://raw.githubusercontent.com/muimsd/map-gl-style-switcher/refs/heads/main/public/osm.png',
    styleUrl:
      'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json',
    description: 'OSM style',
  },
];
const defaultStyle = styles[0];

const map = new maplibregl.Map({
  container: 'map',
  style: defaultStyle.styleUrl, // Example style
  //   center: [0, 0],
  //   zoom: 10,
  bounds: [
    [34.97256123524991, 40.996721656078336],
    [34.981376429930464, 41.00112029961136],
  ],
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
  onBeforeStyleChange: (from: StyleItem, to: StyleItem): void => {
    console.log('Changing style from', from.name, 'to', to.name);
  },
  onAfterStyleChange: (_from: StyleItem, to: StyleItem): void => {
    map.setStyle(to.styleUrl);
    console.log('Style changed to', to.name);
  },
} as StyleSwitcherControlOptions);
map.addControl(styleSwitcher, 'top-left');

// Debug utilities for testing region deletion
if (typeof window !== 'undefined') {
  (window as any).debugOfflineManager = {
    manager: offlineManager,
    async listRegions() {
      console.log('📋 Current regions:');
      const regions = await offlineManager.listStoredRegions();
      console.table(regions);
      return regions;
    },
    async deleteRegion(regionId: string) {
      console.log(`🗑️  Testing deletion of region: ${regionId}`);
      try {
        await offlineManager.deleteRegion(regionId);
        console.log('✅ Region deletion completed');
        // List regions after deletion
        return await this.listRegions();
      } catch (error) {
        console.error('❌ Region deletion failed:', error);
        throw error;
      }
    },
    async clearAllData() {
      console.log('🧹 Clearing all offline data...');
      const db = await import('./storage/indexedDbManager').then(m => m.dbPromise);
      const stores: ('styles' | 'tiles' | 'fonts' | 'glyphs' | 'sprites')[] = ['styles', 'tiles', 'fonts', 'glyphs', 'sprites'];
      for (const store of stores) {
        const tx = (await db).transaction(store, 'readwrite');
        await tx.store.clear();
      }
      console.log('✅ All data cleared');
    },
    async loadOfflineStyles() {
      console.log('🎨 Loading offline styles...');
      try {
        await offlineManagerControl.loadOfflineStyles();
        console.log('✅ Offline styles loaded');
      } catch (error) {
        console.error('❌ Failed to load offline styles:', error);
      }
    },
    async loadOfflineStyle(styleId: string) {
      console.log(`🎨 Loading specific offline style: ${styleId}`);
      try {
        await offlineManagerControl.loadSpecificOfflineStyle(styleId);
        console.log(`✅ Offline style ${styleId} loaded`);
      } catch (error) {
        console.error(`❌ Failed to load offline style ${styleId}:`, error);
      }
    }
  };
  
  console.log('🔧 Debug utilities available:');
  console.log('  - window.debugOfflineManager.listRegions() - List all regions');
  console.log('  - window.debugOfflineManager.deleteRegion(regionId) - Test region deletion');
  console.log('  - window.debugOfflineManager.clearAllData() - Clear all offline data');
  console.log('  - window.debugOfflineManager.loadOfflineStyles() - Load offline styles');
  console.log('  - window.debugOfflineManager.loadOfflineStyle(styleId) - Load specific style');
}
