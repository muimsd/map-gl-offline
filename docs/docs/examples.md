---
sidebar_position: 5
---

# Examples

Practical examples for common use cases with `map-gl-offline`.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Region Management](#region-management)
- [Import/Export](#importexport)
- [Offline Detection](#offline-detection)
- [Storage Management](#storage-management)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)

---

## Basic Usage

### Minimal Setup

```typescript
import maplibregl from 'maplibre-gl';
import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'map-gl-offline/dist/style.css';

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

```typescript
const manager = new OfflineMapManager();

// Download New York City area
await manager.addRegion({
  id: 'nyc',
  name: 'New York City',
  bounds: [[-74.259, 40.477], [-73.700, 40.917]],
  minZoom: 10,
  maxZoom: 15,
  styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  onProgress: (progress) => {
    updateProgressBar(progress.percentage);
    updateStatusText(progress.message);
  },
});
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
  await manager.addRegion({
    ...region,
    minZoom: 10,
    maxZoom: 14,
    styleUrl: STYLE_URL,
    onProgress: (p) => console.log(`${region.name}: ${p.percentage}%`),
  });
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

### Update Region Metadata

```typescript
// Extend expiration
await manager.updateRegion('nyc', {
  expiry: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
  name: 'New York City (Extended)',
});
```

### Delete Region with Confirmation

```typescript
async function deleteRegionWithConfirm(regionId: string) {
  const region = await manager.getRegion(regionId);
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

  // Trigger download
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(url);

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

  private startAutoCleanup() {
    // Cleanup daily
    this.manager.startAutoCleanup({
      interval: 24 * 60 * 60 * 1000,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Also check storage quota periodically
    setInterval(() => this.checkQuota(), 60 * 60 * 1000); // Hourly
  }

  private async checkQuota() {
    const analytics = await this.manager.getComprehensiveStorageAnalytics();
    const usedMB = analytics.totalStorageSize / (1024 * 1024);

    if (usedMB > this.maxStorageMB * 0.9) {
      console.warn('Storage quota near limit, cleaning up...');
      await this.manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000);
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
      await manager.addRegion(regionOptions);
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
          await manager.cleanupOldTiles(7 * 24 * 60 * 60 * 1000);
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
    await manager.addRegion(options);
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
      await manager.addRegion({
        ...options,
        onProgress: (progress) => {
          this.updateProgress(progress.percentage);
          this.updatePhase(progress.message || 'Downloading...');
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

  await manager.addRegion({
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
        await this.manager.addRegion(serverRegion);
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
