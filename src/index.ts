/**
 * map-gl-offline
 *
 * A TypeScript library for offline map storage with MapLibre GL JS.
 * Enables comprehensive offline storage and usage of vector/raster tiles,
 * sprites, styles, fonts (glyphs), and entire map regions.
 *
 * @packageDocumentation
 * @module map-gl-offline
 *
 * @example Basic usage
 * ```typescript
 * import { OfflineMapManager } from 'map-gl-offline';
 * import maplibregl from 'maplibre-gl';
 *
 * const map = new maplibregl.Map({
 *   container: 'map',
 *   style: 'https://tiles.openfreemap.org/styles/liberty'
 * });
 *
 * const offlineManager = new OfflineMapManager(map);
 *
 * // Download a region for offline use
 * await offlineManager.downloadRegion({
 *   name: 'San Francisco',
 *   bounds: [[-122.5, 37.7], [-122.3, 37.9]],
 *   minZoom: 10,
 *   maxZoom: 14,
 *   styleUrl: 'https://tiles.openfreemap.org/styles/liberty'
 * });
 * ```
 *
 * @example Using the UI Control
 * ```typescript
 * import { OfflineManagerControl } from 'map-gl-offline';
 * import 'map-gl-offline/style.css';
 *
 * map.addControl(new OfflineManagerControl());
 * ```
 */

// Main manager - the primary entry point for most users
export { OfflineMapManager } from './managers/offlineMapManager';

// Services - for advanced usage and direct service access
export * from './services/tileService';
export * from './services/fontService';
export * from './services/glyphService';
export * from './services/spriteService';
export * from './services/cleanupService';
export * from './services/styleService';
export * from './services/regionService';
export * from './services/resourceService';
export * from './services/analyticsService';
export * from './services/maintenanceService';
export * from './services/importExportService';

// Storage - for direct database access
export * from './storage/indexedDbManager';

// Types - all TypeScript interfaces and types
export * from './types';

// Utilities - helper functions and constants
export * from './utils';

// Default export for convenience
export { OfflineMapManager as default } from './managers/offlineMapManager';

// UI Control - MapLibre/Mapbox control for offline management
export { OfflineManagerControl } from './ui/offlineManagerControl';
export type { MapLibProtocol } from './ui/offlineManagerControl';

// Internationalization
export { i18n, t } from './ui/translations';
export type { SupportedLanguage, TranslationKey } from './ui/translations';
