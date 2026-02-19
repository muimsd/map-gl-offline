---
sidebar_position: 4
---

# Configuration

This guide covers all configuration options available in `map-gl-offline`.

## OfflineMapManager Configuration

### Constructor

```typescript
const manager = new OfflineMapManager();
```

The constructor accepts optional `OfflineManagerServiceOverrides` for dependency injection (advanced usage). For most use cases, create the manager with no arguments.

## OfflineManagerControl Configuration

### Constructor Options

```typescript
const control = new OfflineManagerControl(offlineManager, {
  styleUrl: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY',
  theme: 'dark',
  showBbox: true,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `styleUrl` | `string` | Carto Voyager | Map style URL for new region downloads |
| `theme` | `'light' \| 'dark'` | `'dark'` | UI theme for the control panel |
| `showBbox` | `boolean` | `false` | Show bounding box overlay when focusing on regions |
| `accessToken` | `string` | `undefined` | Mapbox access token (required for `mapbox://` URLs) |
| `mapLib` | `MapLibProtocol` | `undefined` | Map library module (e.g., `maplibregl`) for `idb://` protocol in web workers |

## Region Configuration

### OfflineRegionOptions

When downloading a region, you can configure various options:

```typescript
await manager.addRegion({
  // Required
  id: 'unique-region-id',
  name: 'Human Readable Name',
  bounds: [[-74.05, 40.71], [-74.00, 40.76]], // [[west, south], [east, north]]
  minZoom: 10,
  maxZoom: 16,

  // Optional
  styleUrl: 'https://example.com/style.json',
  expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
  deleteOnExpiry: true,
  multipleRegions: false,
  tileExtension: 'pbf', // default: auto-detected from style

  // Callbacks
  onProgress: (progress) => {
    console.log(`${progress.percentage}% - ${progress.message}`);
  },
});
```

### Region Options Reference

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the region |
| `name` | `string` | Yes | Human-readable display name |
| `bounds` | `[[lng, lat], [lng, lat]]` | Yes | Geographic bounds (southwest, northeast) |
| `minZoom` | `number` | Yes | Minimum zoom level to download (e.g., 10) |
| `maxZoom` | `number` | Yes | Maximum zoom level to download (e.g., 16) |
| `styleUrl` | `string` | No | Map style URL to use |
| `expiry` | `number` | No | Expiration timestamp (ms since epoch) |
| `deleteOnExpiry` | `boolean` | No | Auto-delete when expired (default: false) |
| `multipleRegions` | `boolean` | No | Part of a multi-region download |
| `tileExtension` | `string` | No | Tile extension (pbf, mvt, png, jpg, etc.) |
| `onProgress` | `function` | No | Progress callback function |

## Export Configuration

### JSON Export

```typescript
await manager.exportRegionAsJSON('region-id', {
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
  onProgress: (progress) => console.log(progress),
});
```

### PMTiles Export

```typescript
await manager.exportRegionAsPMTiles('region-id', {
  compression: 'gzip', // 'gzip' | 'brotli' | 'none'
  clustered: false,
  metadata: {
    attribution: 'Your Attribution',
    version: '1.0.0',
    description: 'Custom metadata',
  },
  includeStyle: true,
  includeTiles: true,
  includeSprites: true,
  includeFonts: true,
});
```

### MBTiles Export

```typescript
await manager.exportRegionAsMBTiles('region-id', {
  format: 'pbf', // 'pbf' | 'png' | 'jpg'
  compression: 'gzip', // 'gzip' | 'none'
  metadata: {
    name: 'My Map',
    description: 'Offline map data',
    version: '1.0',
    type: 'baselayer', // 'baselayer' | 'overlay'
    format: 'pbf',
  },
});
```

## Import Configuration

```typescript
await manager.importRegion({
  file: selectedFile,
  format: 'json', // 'json' | 'pmtiles' | 'mbtiles'
  overwrite: false, // Replace existing region with same ID
  newRegionId: 'custom-id', // Override the region ID
  newRegionName: 'Custom Name', // Override the region name
});
```

## Cleanup Configuration

### Manual Cleanup

```typescript
// Cleanup expired regions (removes regions past their expiry date)
await manager.cleanupExpiredRegions();

// Perform smart cleanup with options
await manager.performSmartCleanup({ maxAge: 30 }); // days
```

### Automatic Cleanup

```typescript
// Setup auto cleanup with interval
const cleanupId = await manager.setupAutoCleanup({
  intervalHours: 24, // Run every 24 hours
  maxAge: 30,        // Remove data older than 30 days
});

// Stop a specific auto cleanup
await manager.stopAutoCleanup(cleanupId);

// Stop all auto cleanups
await manager.stopAllAutoCleanup();
```

### Region Analytics

```typescript
// Get storage analytics per region
const analytics = await manager.getRegionAnalytics();

// Get size of a specific region
const size = await manager.getRegionSize(regionId);
```

## Download Configuration

### Default Download Settings

The library uses these defaults for downloads:

```typescript
const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10,       // Tiles per batch
  MAX_CONCURRENCY: 5,   // Concurrent downloads
  MAX_RETRIES: 3,       // Retry attempts per item
  TIMEOUT: 10000,       // Request timeout (ms)
  RETRY_DELAY: 1000,    // Delay between retries (ms)
};
```

### Tile Configuration

```typescript
const TILE_CONFIG = {
  MIN_ZOOM: 0,
  MAX_ZOOM: 24,
  DEFAULT_EXTENSION: 'pbf',
  SUPPORTED_EXTENSIONS: ['pbf', 'mvt', 'png', 'jpg', 'jpeg', 'webp', 'glb'],
};
```

## Storage Configuration

### IndexedDB Settings

The library uses IndexedDB with the following structure:

- **Database Name**: `offline-map-db`
- **Database Version**: `3`
- **Stores**:
  - `tiles` - Map tiles (keyed as `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}`)
  - `styles` - Style JSON documents with embedded `regions[]` array
  - `sprites` - Sprite images and JSON
  - `glyphs` - Font glyph data (PBF ranges)
  - `fonts` - Font files
  - `regions` - **(deprecated)** Legacy region storage; regions now live in `styles.regions[]`

### Storage Quota Management

```typescript
// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Using ${usage} of ${quota} bytes`);

  // Warning at 90% usage
  if (usage / quota > 0.9) {
    console.warn('Storage nearly full');
    await manager.performSmartCleanup({ maxAge: 7 });
  }
}

// Request persistent storage (won't be auto-cleared)
if (navigator.storage?.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`Persistent storage: ${isPersisted}`);
}
```

## Theme Configuration

The UI control supports theme customization:

```typescript
// Set theme on initialization
const control = new OfflineManagerControl(manager, {
  theme: 'dark', // or 'light'
});

// Theme is persisted to localStorage
// Key: 'offline-manager-theme'
```

### CSS Custom Properties

You can customize the appearance using CSS:

```css
.offline-manager-control {
  /* Panel styling */
  --panel-bg: rgba(255, 255, 255, 0.95);
  --panel-border: rgba(0, 0, 0, 0.1);
  --panel-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Button styling */
  --button-bg: #3b82f6;
  --button-hover: #2563eb;
  --button-text: white;

  /* Text colors */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
}

/* Dark theme overrides */
.dark .offline-manager-control {
  --panel-bg: rgba(31, 41, 55, 0.95);
  --panel-border: rgba(255, 255, 255, 0.1);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
}
```

## Internationalization (i18n)

The UI control includes a built-in internationalization system powered by [i18next](https://www.i18next.com/). The user's language choice is persisted in `localStorage` under the key `offline-manager-language`.

### Supported Languages

| Code | Language | Native Name | Direction |
|------|----------|-------------|-----------|
| `en` | English | English | LTR |
| `ar` | Arabic | العربية | RTL |

### Programmatic Language Control

```typescript
import { i18n, t } from 'map-gl-offline';

// Get current language
const lang = i18n.getLanguage(); // 'en' | 'ar'

// Change language
i18n.setLanguage('ar');

// Check if current language is RTL
const isRTL = i18n.isRTL(); // true for Arabic

// Translate a key
const title = t('app.title'); // 'Offline Manager' or 'مدير الخرائط غير المتصلة'

// Translate with interpolation
const subtitle = t('header.subtitle', { count: 3, size: '12 MB' });
// '3 regions • 12 MB total'

// Get all available languages
const languages = i18n.getAvailableLanguages();
// [{ code: 'en', name: 'English', nativeName: 'English' },
//  { code: 'ar', name: 'Arabic', nativeName: 'العربية' }]

// Subscribe to language changes
const unsubscribe = i18n.subscribe(() => {
  console.log('Language changed to:', i18n.getLanguage());
  // Re-render your UI here
});

// Later, unsubscribe
unsubscribe();
```

### RTL Support

When an RTL language (Arabic) is active, the control automatically:
- Sets `dir="rtl"` on all `.offline-manager-control` elements
- Adds the `rtl` CSS class for layout adjustments
- Mirrors the LanguageSelector dropdown positioning (opens from the left instead of right)

### LanguageSelector Component

The built-in `LanguageSelector` component renders a dropdown in the control panel header. It displays the current language code (e.g., "EN") and a globe icon. Clicking opens a dropdown listing all available languages with both their native name and English name.

```typescript
import { LanguageSelector } from 'map-gl-offline';

const selector = new LanguageSelector({
  onChange: (language) => {
    console.log(`User switched to: ${language}`);
  },
});

// Add to a container
container.appendChild(selector.getElement());

// Clean up when done
selector.destroy();
```

### Adding a New Language

To add a new language to the i18n system:

1. **Create a translation file** at `src/ui/translations/{code}.ts` (e.g., `fr.ts` for French). Copy the structure from `en.ts` and translate all values:

```typescript
// src/ui/translations/fr.ts
export const fr = {
  'app.title': 'Gestionnaire hors ligne',
  'app.close': 'Fermer',
  // ... translate all keys from en.ts
} as const;
```

2. **Register the language** in `src/ui/translations/index.ts`:

```typescript
import { fr } from './fr';

// Add to SupportedLanguage type
export type SupportedLanguage = 'en' | 'ar' | 'fr';

// Add to i18next resources
i18next.init({
  // ...
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    fr: { translation: fr },
  },
});

// If the language is RTL, add to the rtlLanguages array
const rtlLanguages: SupportedLanguage[] = ['ar'];
```

3. **Add to the available languages list** in the `getAvailableLanguages()` method of `I18nManager`:

```typescript
getAvailableLanguages() {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
  ];
}
```

### Translation Key Categories

Translation keys are organized by category using dot notation:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `app.*` | General UI strings | `app.title`, `app.cancel` |
| `theme.*` | Theme switcher | `theme.light`, `theme.dark` |
| `language.*` | Language switcher | `language.select` |
| `header.*` | Panel header | `header.subtitle` |
| `actions.*` | Action buttons | `actions.addRegion` |
| `regionForm.*` | Download form | `regionForm.name`, `regionForm.minZoom` |
| `regionList.*` | Region list display | `regionList.empty`, `regionList.zoom` |
| `delete.*` | Delete confirmations | `delete.regionTitle` |
| `importExport.*` | Import/export modal | `importExport.exportFormat` |
| `download.*` | Download progress | `download.phase.tiles` |
| `error.*` | Error messages | `error.downloadFailed` |
| `warning.*` | Warning messages | `warning.compressedTiles` |
| `validation.*` | Form validation | `validation.required` |

Interpolation uses double curly braces: `{{variableName}}`. For example, `'header.subtitle': '{{count}} regions - {{size}} total'`.

---

## Style Provider Detection

The library automatically detects the map style provider (Mapbox, MapLibre/MapTiler/Carto, or custom) and handles provider-specific URL resolution, authentication, and source processing.

### Supported Providers

| Provider | Detection Criteria | Authentication |
|----------|-------------------|----------------|
| `mapbox` | URL contains `mapbox://`, `mapbox.com`, or `api.mapbox.com`; or style JSON has Mapbox-specific properties (`owner`, `draft`, `visibility`) | Requires access token |
| `maplibre` | URL contains `maplibre`, `maptiler`, or `carto` | API key via query parameter |
| `auto` | Default when no provider can be determined | Varies |

```typescript
type StyleProvider = 'mapbox' | 'maplibre' | 'auto';
```

### Auto-Detection

When adding a region with the UI control, the style provider is auto-detected from the style URL. Users can also manually select the provider in the download form.

```typescript
import { detectStyleProvider } from 'map-gl-offline';

// Detection from URL alone
detectStyleProvider('mapbox://styles/mapbox/streets-v12'); // 'mapbox'
detectStyleProvider('https://api.mapbox.com/styles/v1/...'); // 'mapbox'
detectStyleProvider('https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'); // 'maplibre'
detectStyleProvider('https://api.maptiler.com/maps/streets/style.json'); // 'maplibre'
detectStyleProvider('https://my-server.com/style.json'); // 'auto'

// Detection from URL + style content (more accurate)
const style = await fetch(styleUrl).then(r => r.json());
detectStyleProvider(styleUrl, style); // checks style.sources for mapbox.com URLs
```

### Mapbox URL Resolution

The library resolves `mapbox://` protocol URLs to their HTTPS API equivalents:

| Mapbox URL Pattern | Resolved URL |
|-------------------|--------------|
| `mapbox://styles/{user}/{id}` | `https://api.mapbox.com/styles/v1/{user}/{id}?access_token={token}` |
| `mapbox://{tileset}` | `https://api.mapbox.com/v4/{tileset}.json?access_token={token}` |
| `mapbox://sprites/{user}/{id}` | `https://api.mapbox.com/styles/v1/{user}/{id}/sprite?access_token={token}` |
| `mapbox://fonts/{user}/{fontstack}/{range}.pbf` | `https://api.mapbox.com/fonts/v1/{user}/{fontstack}/{range}.pbf?access_token={token}` |

```typescript
import { resolveMapboxUrl, isMapboxProtocol } from 'map-gl-offline';

if (isMapboxProtocol(url)) {
  const httpsUrl = resolveMapboxUrl(url, 'pk.your_access_token');
}
```

### Token Extraction

Access tokens can be extracted from existing URLs:

```typescript
import { extractAccessToken } from 'map-gl-offline';

const token = extractAccessToken(
  'https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=pk.abc123'
);
// 'pk.abc123'
```

### Style Source Processing

When downloading a region, the library processes all source URLs in the style JSON to ensure they include authentication and resolve any protocol-specific URLs:

```typescript
import { processStyleSources } from 'map-gl-offline';

// Resolves all mapbox:// URLs in sources, sprite, and glyphs
const processedStyle = processStyleSources(style, 'mapbox', 'pk.your_token');
```

This handles:
- `mapbox://` source URLs in `sources[*].url`
- `mapbox://` tile URLs in `sources[*].tiles[]`
- `mapbox://` sprite URLs in `style.sprite`
- `mapbox://` glyph URLs in `style.glyphs`
- Adding `access_token` query parameters to Mapbox API URLs

### Style Validation

Validate a style for provider-specific requirements:

```typescript
import { validateStyleForProvider } from 'map-gl-offline';

const result = validateStyleForProvider(style, 'mapbox');

if (!result.isValid) {
  console.error('Errors:', result.errors);
  // e.g., ['Style has no sources', 'Style has no layers']
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
  // e.g., ['Mapbox sources detected but no access token found']
}
```

---

## Mapbox Standard Style Configuration

When using Mapbox Standard or other import-based styles, the library automatically resolves and flattens the `imports` array during download. No additional configuration is needed for offline storage.

### Light Presets (Day/Night)

Mapbox Standard supports configurable light presets via the `lightPreset` config property. These are applied at runtime using the Mapbox GL JS API:

```typescript
// Set a light preset on the map (requires Mapbox GL JS v3+)
map.setConfigProperty('basemap', 'lightPreset', 'day');
```

Available presets: `day`, `night`, `dawn`, `dusk`

### Rain and Snow Controls

Mapbox GL JS v3+ supports weather effects that can be applied at runtime:

```typescript
// Enable rain
map.setRain({ intensity: 0.5, color: '#ffffff' });

// Enable snow
map.setSnow({ intensity: 0.3, color: '#ffffff' });

// Clear weather effects
map.setRain(null);
map.setSnow(null);
```

These runtime settings do not affect offline storage -- the library stores the base style and tiles; weather effects are applied client-side.

---

## Logging Configuration

```typescript
import { logger, LogLevel } from 'map-gl-offline';

// Set log level
logger.setLogLevel(LogLevel.DEBUG); // Show all logs
logger.setLogLevel(LogLevel.INFO); // Info and above
logger.setLogLevel(LogLevel.WARN); // Warnings and errors only
logger.setLogLevel(LogLevel.ERROR); // Errors only
logger.setLogLevel(LogLevel.NONE); // Disable logging

// Create scoped logger
const myLogger = logger.scope('MyComponent');
myLogger.debug('This is a debug message');
```

In production, the log level automatically defaults to `INFO`.

## Environment Variables

For Vite-based projects:

```env
# .env file
VITE_MAPTILER_API_KEY=your_api_key
VITE_MAPBOX_ACCESS_TOKEN=your_token
```

Access in code:

```typescript
const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
const styleUrl = `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`;
```
