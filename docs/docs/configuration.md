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

| Option        | Type                | Default       | Description                                                                  |
| ------------- | ------------------- | ------------- | ---------------------------------------------------------------------------- |
| `styleUrl`    | `string`            | Carto Voyager | Map style URL for new region downloads                                       |
| `theme`       | `'light' \| 'dark'` | `'dark'`      | UI theme for the control panel                                               |
| `showBbox`    | `boolean`           | `false`       | Show bounding box overlay when focusing on regions                           |
| `accessToken` | `string \| null`    | `undefined`   | Mapbox access token (required for `mapbox://` URLs). Accepts `null` (since 0.8.7) so `mapboxgl.accessToken` works directly. |
| `mapLib`      | `MapLibProtocol`    | `undefined`   | Map library module that exposes `addProtocol`/`removeProtocol` — pass `maplibregl` to enable `idb://` resolution inside MapLibre's web workers. Omit for Mapbox GL JS v3 (it has no `addProtocol`); the control falls back to a Service Worker. |

## Region Configuration

### OfflineRegionOptions

When downloading a region, you can configure various options:

```typescript
await manager.downloadRegion(
  {
    // Required
    id: 'unique-region-id',
    name: 'Human Readable Name',
    bounds: [
      [-74.05, 40.71],
      [-74.0, 40.76],
    ], // [[west, south], [east, north]]
    minZoom: 10,
    maxZoom: 16,

    // Optional
    styleUrl: 'https://example.com/style.json',
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // absolute timestamp (ms since epoch)
    deleteOnExpiry: true,
    multipleRegions: false,
    // tileExtension: 'pbf' — Usually unnecessary; the style patcher extracts
    // per-source extensions from tile URL patterns. Only set this when you
    // need to force one extension for every source in the region.
  },
  {
    onProgress: ({ phase, percentage, message }) => {
      console.log(`[${phase}] ${percentage.toFixed(1)}% - ${message ?? ''}`);
    },
  }
);
```

> `addRegion` is still available for callers that want to record metadata without downloading assets (e.g., after a manual tile import). Most callers should use `downloadRegion`.

See the [API Reference](./api-reference#offlineregionoptions) for the full `OfflineRegionOptions` type definition.

## Export Configuration

Regions are exported as binary **MBTiles** (SQLite) — v1.3-compliant, with vector tiles gzipped, `tile_row` flipped to TMS, and `json.vector_layers` derived from the offline style so the file opens cleanly in QGIS, tippecanoe, maplibre-native, etc.

```typescript
await manager.exportRegionAsMBTiles('region-id', {
  format: 'pbf', // 'pbf' | 'png' | 'jpg' — goes into metadata.format
  metadata: {
    attribution: 'Your Attribution',
    description: 'Custom metadata', // merged into the metadata table
  },
  onProgress: progress => console.log(progress),
});
```

### Configuring the sql.js WASM loader

`sql.js` is loaded lazily on the first export/import call. By default the library fetches `sql-wasm.wasm` from jsDelivr — override if you self-host:

```typescript
import { configureSqlJs } from 'map-gl-offline';

configureSqlJs({ wasmUrl: '/static/sql-wasm/' });
// or pre-fetched binary:
configureSqlJs({ wasmBinary: myArrayBuffer });
```

## Import Configuration

```typescript
await manager.importRegion({
  file: selectedFile, // <input type="file" accept=".mbtiles">
  format: 'mbtiles', // only supported format
  overwrite: false, // replace existing region with same id
  newRegionId: 'custom-id', // override the region id from the file
  newRegionName: 'Custom Name',
  onProgress: p => console.log(p.message),
});
```

Non-SQLite files (e.g. a JSON renamed to `.mbtiles`) and SQLite files missing the required `metadata`/`tiles` tables are rejected up front with a descriptive error.

## Cleanup Configuration

### Manual Cleanup

```typescript
// Cleanup regions older than 30 days
await manager.cleanupExpiredRegions();

// Force cleanup regions past their actual expiry timestamp
await manager.forceCleanupExpiredRegions();

// Perform smart cleanup with options
await manager.performSmartCleanup({ maxAge: 30 }); // days
```

### Automatic Cleanup

```typescript
// Setup auto cleanup with interval
const cleanupId = await manager.setupAutoCleanup({
  intervalHours: 24, // Run every 24 hours
  maxAge: 30, // Remove data older than 30 days
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

Omitted download options fall back to these values:

```typescript
import { DOWNLOAD_DEFAULTS } from 'map-gl-offline';

const DOWNLOAD_DEFAULTS = {
  BATCH_SIZE: 10, // Tiles per batch — each batch is issued in parallel
  MAX_CONCURRENCY: 5, // Glyph worker-pool size
  MAX_RETRIES: 3, // Retry attempts per item
  TIMEOUT: 10000, // Request timeout (ms)
  RETRY_DELAY: 1000, // Delay between retries (ms)
};
```

`DOWNLOAD_DEFAULTS` is exported as a reference for these values; each service declares its own matching defaults, so overriding the constant object at runtime changes nothing — pass the option instead.

Concurrency is controlled per resource type: tiles, fonts and sprites download in parallel batches of `batchSize`, while glyphs use a `maxConcurrency` worker pool. `maxConcurrency` on `TileDownloadOptions` / `FontDownloadOptions` is retained for backwards compatibility but is not read — set `batchSize` there instead.

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
- **Database Version**: `4`
- **Stores**:
  - `tiles` - Map tiles (keyed as `{styleId}:{sourceId}:{z}:{x}:{y}.{extension}`)
  - `styles` - Style JSON documents with embedded `regions[]` array
  - `sprites` - Sprite images and JSON
  - `glyphs` - Font glyph data (PBF ranges)
  - `fonts` - Font files
  - `models` - 3D model assets (e.g. Mapbox Standard trees / wind turbines); added in DB v4

The legacy `regions` store is still created for backward compatibility and migration, but it is deprecated and no longer written to. Regions have lived inside `styles.regions[]` since v3.

On upgrade, the DB migrates additively — no data is moved and existing offline content is preserved. If the on-disk schema is newer than the library supports (common in shared-origin dev environments), `dbPromise` throws `OfflineMapDBVersionError`; call `resetOfflineMapDB()` to recover (destructive — wipes all stored offline data).

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

### Customizing the appearance

The control is styled with **Tailwind utility classes compiled into `map-gl-offline/style.css`** — there are no themeable CSS custom properties to set. Restyle it by overriding the shipped rules with your own stylesheet loaded after `style.css`.

Every element the control renders carries the `offline-manager-control` class, so it makes a reliable scope:

```css
/* Loaded after `import 'map-gl-offline/style.css'` */
.offline-manager-control {
  font-family: 'IBM Plex Sans', sans-serif;
}

/* The control button in the map's control group */
.maplibregl-ctrl.offline-manager-control button,
.mapboxgl-ctrl.offline-manager-control button {
  border-radius: 9999px;
}
```

Dark mode is **class-based**: `ThemeManager` toggles `.dark` on `<html>` (`document.documentElement`), and the stylesheet's dark variant is defined as `@custom-variant dark (&:where(.dark, .dark *))`. Scope your dark overrides the same way:

```css
.dark .offline-manager-control {
  color-scheme: dark;
}
```

Two composed utility classes are available if you're building UI that should match the panel:

| Class          | What it applies                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| `.glass-panel` | Translucent white/gray-900 background, backdrop blur, hairline border, shadow |
| `.glass-input` | Translucent input background, blur, and focus transition                      |

RTL layout is handled by the `[dir="rtl"]` / `.rtl` rules in `style.css`, which the i18n manager applies to `.offline-manager-control` elements when Arabic is active.

## Internationalization (i18n)

The UI control includes a built-in internationalization system powered by [i18next](https://www.i18next.com/). The user's language choice is persisted in `localStorage` under the key `offline-manager-language`.

### Supported Languages

| Code | Language | Native Name | Direction |
| ---- | -------- | ----------- | --------- |
| `en` | English  | English     | LTR       |
| `ar` | Arabic   | العربية     | RTL       |

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

`LanguageSelector` is an internal component used by `OfflineManagerControl`; it is not exported from the package's public API. The snippet below illustrates its shape for reference.

```typescript
// Internal component — not exported from 'map-gl-offline'.
const selector = new LanguageSelector({
  onChange: language => {
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

| Prefix           | Purpose              | Example                                 |
| ---------------- | -------------------- | --------------------------------------- |
| `app.*`          | General UI strings   | `app.title`, `app.cancel`               |
| `theme.*`        | Theme switcher       | `theme.light`, `theme.dark`             |
| `language.*`     | Language switcher    | `language.select`                       |
| `header.*`       | Panel header         | `header.subtitle`                       |
| `actions.*`      | Action buttons       | `actions.addRegion`                     |
| `regionForm.*`   | Download form        | `regionForm.name`, `regionForm.minZoom` |
| `regionList.*`   | Region list display  | `regionList.empty`, `regionList.zoom`   |
| `delete.*`       | Delete confirmations | `delete.regionTitle`                    |
| `importExport.*` | Import/export modal  | `importExport.exportFormat`             |
| `download.*`     | Download progress    | `download.phase.tiles`                  |
| `error.*`        | Error messages       | `error.downloadFailed`                  |
| `warning.*`      | Warning messages     | `warning.compressedTiles`               |
| `validation.*`   | Form validation      | `validation.required`                   |

Interpolation uses double curly braces: `{{variableName}}`. For example, `'header.subtitle': '{{count}} regions • {{size}} total'`.

---

## Style Provider Detection

The library automatically detects the map style provider (Mapbox, MapLibre/MapTiler/Carto, or custom) and handles provider-specific URL resolution, authentication, and source processing.

### Supported Providers

| Provider   | Detection Criteria                                                                                                                         | Authentication              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `mapbox`   | URL contains `mapbox://`, `mapbox.com`, or `api.mapbox.com`; or style JSON has Mapbox-specific properties (`owner`, `draft`, `visibility`) | Requires access token       |
| `maplibre` | URL contains `maplibre`, `maptiler`, or `carto`                                                                                            | API key via query parameter |
| `auto`     | Default when no provider can be determined                                                                                                 | Varies                      |

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

| Mapbox URL Pattern                              | Resolved URL                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `mapbox://styles/{user}/{id}`                   | `https://api.mapbox.com/styles/v1/{user}/{id}?access_token={token}`                   |
| `mapbox://{tileset}`                            | `https://api.mapbox.com/v4/{tileset}.json?access_token={token}`                       |
| `mapbox://sprites/{user}/{id}`                  | `https://api.mapbox.com/styles/v1/{user}/{id}/sprite?access_token={token}`            |
| `mapbox://fonts/{user}/{fontstack}/{range}.pbf` | `https://api.mapbox.com/fonts/v1/{user}/{fontstack}/{range}.pbf?access_token={token}` |
| `mapbox://models/{user}/{file}.glb`             | `https://api.mapbox.com/models/v1/{user}/{file}.glb?access_token={token}`             |

The `mapbox://{tileset}` row is the fallback: any `mapbox://` URL that isn't a `styles/`, `sprites/`, `fonts/` or `models/` path is treated as a tileset id. A separate helper, `rewriteMapboxCdnTileUrl`, rewrites `*.tiles.mapbox.com/raster/v1/…` tile URLs onto `api.mapbox.com/v4/…`, because the CDN raster path requires an SKU session token that only the Mapbox GL JS SDK can mint.

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
  // e.g., ['Mapbox sources detected but no access token found - authentication may be required']
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

:::caution Offline limitation

`setConfigProperty` has **no visible effect for offline-loaded Mapbox Standard regions**. The Mapbox API returns Standard with its `imports` wrapper already expanded, so the library stores a flat style where `["config", "lightPreset"]` expressions have been statically resolved to the schema default (`"day"`) at download time. To change the preset, re-download the region with the desired config applied, or toggle online before going offline.

This also applies to other Standard config knobs (`theme`, `show3dObjects`, `showPlaceLabels`, etc.) once offline.

:::

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

These runtime settings do not affect offline storage — the library stores the base style and tiles; weather effects are applied client-side. They work whether the map is online or serving from IndexedDB.

### Utility Exports (0.8.1+)

Two utilities are exported for advanced integrations where you're manipulating offline styles directly:

#### `sanitizeIndoorExpressions(style)`

```typescript
import { sanitizeIndoorExpressions } from 'map-gl-offline';

sanitizeIndoorExpressions(myOfflineStyle);
```

Rewrites `["is-active-floor"]` / `["is-active-floor", <id>]` → `false` and `["floor-level"]` → `0` in every layer's filter / paint / layout. These indoor-only expressions read `map.indoor.activeFloors` at filter-compile time in Mapbox GL v3; when the `imports` wrapper is stripped for offline rendering they crash `setStyle()`. The library calls this automatically from `resolveImports` (download) and at style load time (for regions downloaded on 0.8.0 before the fix), so you only need it when you're loading a style outside the library's load paths. Idempotent — safe to call multiple times.

#### `extractTileExtensionFromUrl(url)`

```typescript
import { extractTileExtensionFromUrl } from 'map-gl-offline';

extractTileExtensionFromUrl('https://.../{z}/{x}/{y}.vector.pbf?access_token=...');
// => 'pbf'
extractTileExtensionFromUrl('https://.../{z}/{x}/{y}.glb');
// => 'glb'
```

Returns the last dotted segment before `?` / `#` / end, defaulting to `"pbf"`. This is the shared helper that both `patchStyleForOffline` (URL rewriter) and `tileService.extractExtension` (key generator) call so they can't disagree. Before 0.8.1 they used different regexes, and the mismatch made every Mapbox v4 tile fetch take the fallback-extension loop before resolving.

---

## Logging Configuration

```typescript
import { logger, configureLogger, LogLevel } from 'map-gl-offline';

// Set via the helper (recommended — future-proof if the config shape grows):
configureLogger({ level: LogLevel.DEBUG }); // all logs
configureLogger({ level: LogLevel.INFO }); // info + warn + error
configureLogger({ level: LogLevel.WARN }); // warnings + errors
configureLogger({ level: LogLevel.ERROR }); // errors only
configureLogger({ level: LogLevel.SILENT }); // disable logging entirely

// Or call the underlying method directly:
logger.setLevel(LogLevel.DEBUG);

// Create a scoped logger:
const myLogger = logger.scope('MyComponent');
myLogger.debug('This is a debug message');
```

`LogLevel` values: `SILENT` (-1), `ERROR` (0), `WARN` (1), `INFO` (2), `DEBUG` (3). Production defaults to `ERROR`; development defaults to `DEBUG`.

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
