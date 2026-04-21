---
sidebar_position: 5
---

# Examples

Practical examples for common use cases with `map-gl-offline`.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Mapbox GL JS](#mapbox-gl-js)
- [Extra Tile Sources](#extra-tile-sources)
- [Region Management](#region-management)
- [Import/Export](#importexport)
- [Offline Detection](#offline-detection)
- [Storage Management](#storage-management)
- [Error Handling](#error-handling)
- [Internationalization](#internationalization)
- [Advanced Patterns](#advanced-patterns)

---

## Basic Usage

### Minimal Setup

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [0, 0],
  zoom: 2,
});

const manager = new OfflineMapManager();
const control = new OfflineManagerControl(manager, {
  styleUrl: 'https://demotiles.maplibre.org/style.json',
});

map.addControl(control, 'top-right');
```

### Programmatic Download

Call `downloadRegion` to run the full pipeline (style → sprites → glyphs → tiles → metadata) with per-phase progress. `addRegion` on its own only stores metadata.

```typescript
const manager = new OfflineMapManager();

await manager.downloadRegion(
  {
    id: 'nyc',
    name: 'New York City',
    bounds: [[-74.259, 40.477], [-73.700, 40.917]],
    minZoom: 10,
    maxZoom: 15,
    styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  },
  {
    onProgress: ({ phase, percentage, message }) => {
      updateProgressBar(percentage);
      updateStatusText(`[${phase}] ${message ?? ''}`);
    },
  },
);
```

---

## Mapbox GL JS

Mapbox GL JS requires a Service Worker for offline tile serving. See the [Getting Started](./getting-started#basic-setup-with-mapbox-gl-js) guide for setup instructions.

### Basic Mapbox Setup

```typescript
import mapboxgl from 'mapbox-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'map-gl-offline/style.css';

mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-74.006, 40.7128],
  zoom: 12,
});

const manager = new OfflineMapManager();
const control = new OfflineManagerControl(manager, {
  styleUrl: 'mapbox://styles/mapbox/streets-v12',
  accessToken: mapboxgl.accessToken,
  theme: 'dark',
});

map.addControl(control, 'top-right');
```

### Mapbox Standard Style with 3D Buildings

The Mapbox Standard style uses imports and 3D building extrusions. The library automatically resolves imported styles for offline storage.

```typescript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [-73.985, 40.748],
  zoom: 15,
  pitch: 60,
  bearing: -17,
});

const manager = new OfflineMapManager();
const control = new OfflineManagerControl(manager, {
  styleUrl: 'mapbox://styles/mapbox/standard',
  accessToken: mapboxgl.accessToken,
});

map.addControl(control, 'top-right');

// Download a region with 3D buildings. The tile downloader probes each
// source before committing — sparse Mapbox tilesets (indoor, landmark-POIs,
// procedural-buildings) that return 404 for most coordinates are
// automatically dropped, keeping the console clean.
await manager.downloadRegion(
  {
    id: 'manhattan-3d',
    name: 'Manhattan 3D',
    bounds: [[-74.02, 40.70], [-73.95, 40.78]],
    minZoom: 12,
    maxZoom: 16,
    styleUrl: 'mapbox://styles/mapbox/standard',
  },
  {
    accessToken: mapboxgl.accessToken,
    provider: 'mapbox',
    onProgress: ({ phase, percentage }) => console.log(`[${phase}] ${percentage.toFixed(0)}%`),
  },
);
```

### Day/Night Light Presets

Mapbox Standard style supports light presets for different times of day. Use `setConfigProperty` on the map instance after loading the style.

```typescript
// Available presets: 'day', 'dawn', 'dusk', 'night'
map.on('style.load', () => {
  // Set the light preset to night mode
  map.setConfigProperty('basemap', 'lightPreset', 'night');
});

// Toggle between presets
function setLightPreset(preset: 'day' | 'dawn' | 'dusk' | 'night') {
  map.setConfigProperty('basemap', 'lightPreset', preset);
}
```

### Rain and Snow Weather Controls

Mapbox GL JS v3+ supports weather effects with the Standard style. These work with offline maps once the style is loaded from IndexedDB.

```typescript
// Enable rain
map.setRain({ intensity: 0.4, color: '#a0c4e8' });

// Enable snow
map.setSnow({ intensity: 0.6, color: '#ffffff' });

// Clear weather effects
map.setRain(null);
map.setSnow(null);

// Example: toggle weather based on user selection
function setWeather(mode: 'none' | 'rain' | 'snow') {
  map.setRain(null);
  map.setSnow(null);

  if (mode === 'rain') {
    map.setRain({ intensity: 0.4, color: '#a0c4e8' });
  } else if (mode === 'snow') {
    map.setSnow({ intensity: 0.6, color: '#ffffff' });
  }
}
```

---

## Extra Tile Sources

Save additional vector or raster tile layers alongside the style's own sources. This is useful when you have custom overlay layers that are not part of the base map style.

### Download Region with Extra Vector Layers

```typescript
await manager.downloadRegion({
  id: 'downtown-with-layers',
  name: 'Downtown + Custom Layers',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://example.com/style.json',
  extraSources: [
    {
      id: 'buildings-3d',
      type: 'vector',
      tiles: ['https://tiles.example.com/buildings/{z}/{x}/{y}.pbf'],
      minzoom: 13,
      maxzoom: 16,
    },
    {
      id: 'transit-lines',
      type: 'vector',
      tiles: ['https://tiles.example.com/transit/{z}/{x}/{y}.mvt'],
      minzoom: 8,
      maxzoom: 16,
      attribution: '&copy; Transit Authority',
    },
  ],
});
```

### Extract Sources from Live Map

When using the UI control, the region form automatically discovers tile sources from the live map and presents them as checkboxes for the user to select. For programmatic use:

```typescript
// Get all sources from the current map style
const style = map.getStyle();
const extraSources = Object.entries(style.sources)
  .filter(([, source]) => {
    const s = source as { type: string; tiles?: string[] };
    return ['vector', 'raster', 'raster-dem'].includes(s.type) && s.tiles?.length;
  })
  .map(([id, source]) => {
    const s = source as { type: string; tiles: string[]; minzoom?: number; maxzoom?: number };
    return { id, type: s.type, tiles: s.tiles, minzoom: s.minzoom, maxzoom: s.maxzoom };
  });

// Use the extracted sources in a region download
await manager.downloadRegion({
  id: 'full-offline',
  name: 'Full Offline Region',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]],
  minZoom: 10,
  maxZoom: 16,
  styleUrl: 'https://example.com/style.json',
  extraSources,
});
```

### UI Control with Source Selection

When using the `OfflineManagerControl`, the region download form automatically shows all tile sources from the map as selectable checkboxes. Users can pick which additional layers to include in the offline region.

```typescript
const control = new OfflineManagerControl(manager, {
  styleUrl: 'https://example.com/style.json',
  mapLib: maplibregl,
});
map.addControl(control, 'top-right');

// When the user draws a region and opens the download form,
// all vector/raster sources on the map are shown as checkboxes.
// Selected sources are downloaded alongside the base style tiles.
```

---

## Region Management

### Download Multiple Regions

```typescript
const regions = [
  { id: 'downtown', name: 'Downtown', bounds: [[-74.02, 40.70], [-73.97, 40.75]] },
  { id: 'brooklyn', name: 'Brooklyn', bounds: [[-74.04, 40.57], [-73.85, 40.74]] },
  { id: 'queens', name: 'Queens', bounds: [[-73.96, 40.68], [-73.70, 40.81]] },
];

for (const region of regions) {
  await manager.downloadRegion(
    {
      ...region,
      minZoom: 10,
      maxZoom: 14,
      styleUrl: STYLE_URL,
    },
    {
      onProgress: ({ percentage }) => console.log(`${region.name}: ${percentage.toFixed(0)}%`),
    },
  );
}
```

### List and Display Regions

```typescript
const regions = await manager.listStoredRegions();

regions.forEach(region => {
  console.log(`
    ID: ${region.id}
    Name: ${region.name}
    Created: ${new Date(region.created).toLocaleDateString()}
    Expires: ${region.expiry ? new Date(region.expiry).toLocaleDateString() : 'Never'}
    Bounds: ${JSON.stringify(region.bounds)}
  `);
});
```

### Delete Region with Confirmation

```typescript
async function deleteRegionWithConfirm(regionId: string) {
  const region = await manager.getStoredRegion(regionId);
  if (!region) return;

  const confirmed = confirm(`Delete "${region.name}"? This cannot be undone.`);
  if (confirmed) {
    await manager.deleteRegion(regionId);
    console.log(`Deleted region: ${regionId}`);
  }
}
```

---

## Import/Export

### Export to JSON for Backup

```typescript
async function backupRegion(regionId: string) {
  const result = await manager.exportRegionAsJSON(regionId, {
    includeStyle: true,
    includeTiles: true,
    includeSprites: true,
    includeFonts: true,
    onProgress: (p) => {
      console.log(`Exporting: ${p.percentage}% - ${p.stage}`);
    },
  });

  // Trigger browser download
  manager.downloadExportedRegion(result);

  console.log(`Exported ${result.statistics.tilesExported} tiles (${result.size} bytes)`);
}
```

### Export to PMTiles for Web Deployment

```typescript
async function exportForCDN(regionId: string) {
  const result = await manager.exportRegionAsPMTiles(regionId, {
    compression: 'gzip',
    metadata: {
      attribution: '© OpenStreetMap contributors',
      version: '1.0.0',
      description: 'Offline map tiles',
    },
  });

  // Upload to CDN or save
  await uploadToS3(result.blob, `maps/${result.filename}`);
}
```

### Import from File

```typescript
// HTML: <input type="file" id="import-file" accept=".json,.pmtiles,.mbtiles">

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Determine format from extension
  const ext = file.name.split('.').pop().toLowerCase();
  const format = ext === 'json' ? 'json' :
                 ext === 'pmtiles' ? 'pmtiles' : 'mbtiles';

  try {
    const result = await manager.importRegion({
      file,
      format,
      overwrite: false,
    });

    if (result.success) {
      alert(`Imported "${result.regionId}" with ${result.statistics.tilesImported} tiles`);
    } else {
      alert(`Import failed: ${result.message}`);
    }
  } catch (error) {
    alert(`Import error: ${error.message}`);
  }
});
```

### Transfer Between Devices

```typescript
// Device A: Export
async function exportForTransfer() {
  const regions = await manager.listStoredRegions();
  const exports = [];

  for (const region of regions) {
    const result = await manager.exportRegionAsJSON(region.id);
    exports.push({
      regionId: region.id,
      blob: result.blob,
      filename: result.filename,
    });
  }

  // Create zip or transfer individually
  return exports;
}

// Device B: Import
async function importFromTransfer(files: File[]) {
  for (const file of files) {
    await manager.importRegion({
      file,
      format: 'json',
      overwrite: true,
    });
  }
}
```

---

## Offline Detection

### Basic Offline Handling

```typescript
const manager = new OfflineMapManager();
const control = new OfflineManagerControl(manager, { styleUrl: STYLE_URL });

map.addControl(control);

// Detect offline and load cached data
window.addEventListener('offline', async () => {
  console.log('Network offline');
  await control.loadOfflineStyles();
});

window.addEventListener('online', () => {
  console.log('Network restored');
  // Optionally refresh or sync
});
```

### Service Worker Integration

```typescript
// In your service worker
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let map-gl-offline handle tile requests
  if (url.pathname.includes('/tiles/')) {
    // The library's fetch interceptor handles this
    return;
  }

  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

### Progressive Enhancement

```typescript
class OfflineMapApp {
  private manager: OfflineMapManager;
  private isOnline = navigator.onLine;

  constructor() {
    this.manager = new OfflineMapManager();
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private async handleOffline() {
    this.isOnline = false;
    this.showOfflineBanner();

    // Check if we have cached data
    const regions = await this.manager.listStoredRegions();
    if (regions.length === 0) {
      this.showNoDataWarning();
    }
  }

  private handleOnline() {
    this.isOnline = true;
    this.hideOfflineBanner();
  }

  private showOfflineBanner() {
    document.getElementById('offline-banner')?.classList.remove('hidden');
  }

  private hideOfflineBanner() {
    document.getElementById('offline-banner')?.classList.add('hidden');
  }
}
```

---

## Storage Management

### Monitor Storage Usage

```typescript
async function getStorageInfo() {
  const analytics = await manager.getComprehensiveStorageAnalytics();

  console.log(`
    Total Size: ${formatBytes(analytics.totalStorageSize)}
    Tiles: ${analytics.tiles.count} (${formatBytes(analytics.tiles.totalSize)})
    Fonts: ${analytics.fonts.count} (${formatBytes(analytics.fonts.totalSize)})
    Sprites: ${analytics.sprites.count} (${formatBytes(analytics.sprites.totalSize)})
  `);

  // Show recommendations
  analytics.recommendations.forEach(rec => console.log(`Recommendation: ${rec}`));

  return analytics;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### Automatic Cleanup Strategy

```typescript
class StorageManager {
  private manager: OfflineMapManager;
  private maxStorageMB = 500;

  constructor(manager: OfflineMapManager) {
    this.manager = manager;
    this.startAutoCleanup();
  }

  private async startAutoCleanup() {
    // Cleanup daily
    await this.manager.setupAutoCleanup({
      intervalHours: 24,
      maxAge: 30, // 30 days
    });

    // Also check storage quota periodically
    setInterval(() => this.checkQuota(), 60 * 60 * 1000); // Hourly
  }

  private async checkQuota() {
    const analytics = await this.manager.getComprehensiveStorageAnalytics();
    const usedMB = analytics.totalStorageSize / (1024 * 1024);

    if (usedMB > this.maxStorageMB * 0.9) {
      console.warn('Storage quota near limit, cleaning up...');
      await this.manager.performSmartCleanup({ maxAge: 7 });
    }
  }
}
```

### Clear All Data

```typescript
async function clearAllOfflineData() {
  const confirmed = confirm('Delete all offline map data? This cannot be undone.');
  if (!confirmed) return;

  const regions = await manager.listStoredRegions();

  for (const region of regions) {
    await manager.deleteRegion(region.id);
  }

  console.log(`Cleared ${regions.length} regions`);
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import { categorizeError, getUserErrorMessage, ErrorType } from 'map-gl-offline';

async function downloadWithRetry(regionOptions: OfflineRegionOptions, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await manager.downloadRegion(regionOptions);
      return; // Success
    } catch (error) {
      lastError = error as Error;
      const errorType = categorizeError(error);
      const message = getUserErrorMessage(error);

      console.error(`Attempt ${attempt}/${maxRetries} failed: ${message}`);

      switch (errorType) {
        case ErrorType.NETWORK:
          // Wait and retry for network errors
          await sleep(1000 * attempt);
          continue;

        case ErrorType.QUOTA:
          // Try to free up space
          await manager.performSmartCleanup({ maxAge: 7 });
          continue;

        case ErrorType.VALIDATION:
          // Invalid input, don't retry
          throw error;

        default:
          // Unknown error, retry with backoff
          await sleep(1000 * attempt);
          continue;
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### User-Friendly Error Messages

```typescript
async function downloadRegion(options: OfflineRegionOptions) {
  try {
    await manager.downloadRegion(options);
    showToast('Region downloaded successfully!', 'success');
  } catch (error) {
    const message = getUserErrorMessage(error);

    if (message.includes('quota')) {
      showToast('Storage full. Please delete some regions first.', 'error');
    } else if (message.includes('network')) {
      showToast('Network error. Check your connection and try again.', 'error');
    } else {
      showToast(`Download failed: ${message}`, 'error');
    }
  }
}
```

---

## Internationalization

### Language Switching

The library includes built-in i18n support with English and Arabic translations.

```typescript
import { i18n, t } from 'map-gl-offline';

// Get current language
console.log(i18n.getLanguage()); // 'en'

// Switch to Arabic (RTL layout is applied automatically)
i18n.setLanguage('ar');

// Get a translated string
const label = t('downloadRegion'); // Translated text for the current language

// List available languages
const languages = i18n.getAvailableLanguages();
// [{ code: 'en', name: 'English', nativeName: 'English' },
//  { code: 'ar', name: 'Arabic', nativeName: 'العربية' }]
```

### React to Language Changes

```typescript
import { i18n } from 'map-gl-offline';

// Subscribe to language changes and update UI
const unsubscribe = i18n.subscribe(() => {
  console.log('Language changed to:', i18n.getLanguage());
  console.log('Is RTL:', i18n.isRTL());
  // Re-render your custom UI components here
});

// Unsubscribe when no longer needed
unsubscribe();
```

### Language Selector UI

```typescript
import { i18n } from 'map-gl-offline';

function createLanguageSelector(container: HTMLElement) {
  const select = document.createElement('select');

  for (const lang of i18n.getAvailableLanguages()) {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.nativeName;
    option.selected = lang.code === i18n.getLanguage();
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    i18n.setLanguage(select.value as 'en' | 'ar');
  });

  container.appendChild(select);
}
```

---

## Advanced Patterns

### Custom Progress UI

```typescript
class DownloadProgressUI {
  private element: HTMLElement;

  constructor(containerId: string) {
    this.element = document.getElementById(containerId)!;
  }

  async downloadWithProgress(options: OfflineRegionOptions) {
    this.show();
    this.updatePhase('Preparing...');

    try {
      await manager.downloadRegion(options, {
        onProgress: (progress) => {
          this.updateProgress(progress.percentage);
          this.updatePhase(progress.message || `Downloading ${progress.phase}...`);
          this.updateDetails(`${progress.completed}/${progress.total}`);
        },
      });

      this.updatePhase('Complete!');
      await this.delay(1000);
    } finally {
      this.hide();
    }
  }

  private show() {
    this.element.classList.remove('hidden');
  }

  private hide() {
    this.element.classList.add('hidden');
  }

  private updateProgress(percentage: number) {
    const bar = this.element.querySelector('.progress-bar') as HTMLElement;
    bar.style.width = `${percentage}%`;
  }

  private updatePhase(text: string) {
    const phase = this.element.querySelector('.phase-text') as HTMLElement;
    phase.textContent = text;
  }

  private updateDetails(text: string) {
    const details = this.element.querySelector('.details-text') as HTMLElement;
    details.textContent = text;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Region Presets

```typescript
const REGION_PRESETS = {
  'new-york': {
    name: 'New York City',
    bounds: [[-74.259, 40.477], [-73.700, 40.917]] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 15,
  },
  'los-angeles': {
    name: 'Los Angeles',
    bounds: [[-118.668, 33.704], [-117.785, 34.337]] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 15,
  },
  'london': {
    name: 'London',
    bounds: [[-0.510, 51.286], [0.334, 51.692]] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 15,
  },
};

async function downloadPreset(presetId: keyof typeof REGION_PRESETS) {
  const preset = REGION_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);

  await manager.downloadRegion({
    id: presetId,
    ...preset,
    styleUrl: STYLE_URL,
  });
}
```

### Sync with Remote Server

```typescript
class RegionSync {
  private manager: OfflineMapManager;
  private apiUrl: string;

  constructor(manager: OfflineMapManager, apiUrl: string) {
    this.manager = manager;
    this.apiUrl = apiUrl;
  }

  async syncFromServer() {
    // Get server regions
    const response = await fetch(`${this.apiUrl}/regions`);
    const serverRegions = await response.json();

    // Get local regions
    const localRegions = await this.manager.listStoredRegions();
    const localIds = new Set(localRegions.map(r => r.id));

    // Download missing regions
    for (const serverRegion of serverRegions) {
      if (!localIds.has(serverRegion.id)) {
        console.log(`Downloading missing region: ${serverRegion.name}`);
        await this.manager.downloadRegion(serverRegion);
      }
    }
  }

  async syncToServer() {
    const localRegions = await this.manager.listStoredRegions();

    for (const region of localRegions) {
      const result = await this.manager.exportRegionAsJSON(region.id);

      await fetch(`${this.apiUrl}/regions/${region.id}`, {
        method: 'PUT',
        body: result.blob,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
```
