/**
 * Offline Manager Control for MapLibre GL JS.
 *
 * This module provides a MapLibre GL JS control for managing offline map regions.
 * It adds a UI button and panel to the map that allows users to:
 * - View downloaded offline regions
 * - Download new regions by selecting areas on the map
 * - Load offline styles for disconnected usage
 * - Delete regions to free up storage
 *
 * **Features:**
 * - Integrates seamlessly as a MapLibre GL control
 * - Intercepts fetch requests to serve offline resources from IndexedDB
 * - Supports light and dark themes
 * - Shows download progress across all phases (style, sprites, glyphs, tiles)
 * - Optional bounding box visualization for regions
 *
 * @example
 * ```ts
 * import { OfflineMapManager, OfflineManagerControl } from 'map-gl-offline';
 *
 * const offlineManager = new OfflineMapManager();
 * const control = new OfflineManagerControl(offlineManager, {
 *   styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
 *   theme: 'dark',
 *   showBbox: true,
 * });
 *
 * map.addControl(control, 'top-right');
 *
 * // Later, load offline styles when offline
 * await control.loadOfflineStyles();
 * ```
 *
 * @module offlineManagerControl
 */

import type { IControl, Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import { themeManager } from './ThemeManager';
import { idbFetchHandler } from '../utils/idbFetchHandler';
import { logger } from '../utils/logger';

// Import refactored modular components
import { ButtonManager } from './managers/ControlButtonManager';
import { PanelRenderer } from './managers/PanelManager';
import { RegionControl } from './controls/regionControl';
import { DownloadManager } from './managers/downloadManager';
import { ModalManager } from './modals/modalManager';
import maplibregl from 'maplibre-gl';

const controlLogger = logger.scope('OfflineControl');

/**
 * Configuration options for the OfflineManagerControl.
 *
 * @example
 * ```ts
 * const options: OfflineManagerControlOptions = {
 *   styleUrl: 'https://example.com/style.json',
 *   theme: 'dark',
 *   showBbox: true,
 * };
 * ```
 */
export interface OfflineManagerControlOptions {
  /** URL of the map style to use for new downloads */
  styleUrl: string;
  /** UI theme - 'light' or 'dark' */
  theme?: 'light' | 'dark';
  /** Whether to show bounding boxes when focusing on regions */
  showBbox?: boolean;
}

/**
 * MapLibre GL JS control for managing offline map regions.
 *
 * Implements the IControl interface to integrate with MapLibre GL maps.
 * Provides a complete UI for downloading, managing, and loading offline map data.
 *
 * The control automatically intercepts fetch requests to serve offline resources
 * from IndexedDB when available, enabling seamless offline map usage.
 *
 * @implements {IControl}
 */
export class OfflineManagerControl implements IControl {
  private map: MaplibreMap | undefined;
  private panel: HTMLDivElement | undefined;
  private isOpen = false;
  private offlineManager: OfflineMapManager;
  private options: OfflineManagerControlOptions;
  // Refactored component managers
  private buttonManager: ButtonManager | undefined;
  private panelRenderer: PanelRenderer | undefined;
  private regionControl: RegionControl | undefined;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager = new ModalManager();
  /** Whether the bounding box visualization layer has been added to the map */
  private bboxLayerAdded = false;
  /** Original window.fetch stored for cleanup/restoration */
  private originalFetch: typeof window.fetch;

  /**
   * Create a new OfflineManagerControl.
   *
   * @param offlineManager - The OfflineMapManager instance for storage operations
   * @param options - Configuration options for the control
   *
   * @example
   * ```ts
   * const control = new OfflineManagerControl(offlineManager, {
   *   styleUrl: 'https://example.com/style.json',
   *   theme: 'dark',
   * });
   * ```
   */
  constructor(
    offlineManager: OfflineMapManager,
    options: OfflineManagerControlOptions = {
      theme: 'dark', // Default theme
      styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // Default style URL
      showBbox: false, // Default to not showing bounding boxes
    }
  ) {
    this.offlineManager = offlineManager;

    // Set initial theme if provided
    if (options?.theme) {
      themeManager.setTheme(options.theme);
    }
    this.options = options;
    this.downloadManager = new DownloadManager({
      offlineManager: this.offlineManager,
      onProgressUpdate: downloads => this.handleProgressUpdate(downloads),
      onDownloadComplete: regionId => this.handleDownloadComplete(regionId),
      onDownloadError: (regionId, error) => this.handleDownloadError(regionId, error),
      updateButton: (text, disabled) => this.updateButton(text, disabled),
      updateProgressBadge: (text, visible) => this.updateProgressBadge(text, visible),
    });

    // Store original fetch and setup interceptor
    this.originalFetch = window.fetch.bind(window);
    this.setupFetchInterceptor();
  }

  /**
   * Setup fetch interceptor to handle idb:// URLs and development proxies.
   *
   * This method overrides window.fetch to:
   * 1. Intercept `idb://` URLs and serve from IndexedDB
   * 2. Proxy tile requests through the development server to avoid CORS issues
   *
   * The original fetch is restored when the control is removed.
   * @internal
   */
  private setupFetchInterceptor(): void {
    const originalFetch = this.originalFetch;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.startsWith('idb://')) {
        return idbFetchHandler(url, init);
      }

      // Development proxy for CORS issues (when running on localhost)
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        // Proxy Carto tile requests (tiles and TileJSON)
        const isTileRequest = /\/\d+\/\d+\/\d+\.(pbf|mvt|png|jpg|jpeg|webp)/.test(url);
        const isTileJsonRequest = url.includes('.json') && url.includes('basemaps.cartocdn.com');

        if (isTileRequest && url.includes('tiles-a.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles-a.basemaps.cartocdn.com', '/tiles/carto-a');
          return originalFetch(proxyUrl, init);
        }
        if (isTileRequest && url.includes('tiles-b.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles-b.basemaps.cartocdn.com', '/tiles/carto-b');
          return originalFetch(proxyUrl, init);
        }
        if (isTileRequest && url.includes('tiles-c.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles-c.basemaps.cartocdn.com', '/tiles/carto-c');
          return originalFetch(proxyUrl, init);
        }
        if (isTileRequest && url.includes('tiles-d.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles-d.basemaps.cartocdn.com', '/tiles/carto-d');
          return originalFetch(proxyUrl, init);
        }

        // Proxy TileJSON requests from tiles.basemaps.cartocdn.com
        if (isTileJsonRequest && url.includes('tiles.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles.basemaps.cartocdn.com', '/carto-api');
          return originalFetch(proxyUrl, init);
        }

        // Fallback for old format (tiles without subdomain)
        if (isTileRequest && url.includes('tiles.basemaps.cartocdn.com')) {
          const proxyUrl = url.replace('https://tiles.basemaps.cartocdn.com', '/tiles/carto-a');
          return originalFetch(proxyUrl, init);
        }

        // Proxy OpenStreetMap tile requests
        if (url.includes('tile.openstreetmap.org')) {
          const proxyUrl = url.replace('https://tile.openstreetmap.org', '/tiles/osm');
          return originalFetch(proxyUrl, init);
        }
      }

      return originalFetch(input, init);
    };
  }

  /**
   * Called when the control is added to a map.
   * Implements the IControl.onAdd interface method.
   *
   * @param map - The MapLibre GL map instance
   * @returns The control's container element
   */
  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;

    // Initialize button manager
    this.buttonManager = new ButtonManager({
      onTogglePanel: () => this.togglePanel(),
    });

    // Create panel element
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);

    // Initialize panel renderer
    this.panelRenderer = new PanelRenderer({
      offlineManager: this.offlineManager,
      downloadManager: this.downloadManager,
      modalManager: this.modalManager,
      onClose: () => this.closePanel(),
      onAddRegion: () => this.startRegionSelection(),
      onFocusRegion: (regionId: string) => this.focusRegion(regionId),
      showBbox: this.options.showBbox || false,
      map: this.map,
    });

    // Initialize region control
    this.regionControl = new RegionControl({
      map: this.map,
      downloadManager: this.downloadManager,
      modalManager: this.modalManager,
      container: this.buttonManager.getContainer(),
      onRegionSaved: () => this.handleRegionSaved(),
      styleUrl: this.options.styleUrl,
    });

    // Add event delegation for better event handling
    this.panel.addEventListener('click', this.handlePanelClick.bind(this));

    return this.buttonManager.getContainer();
  }

  /**
   * Called when the control is removed from a map.
   * Implements the IControl.onRemove interface method.
   *
   * Cleans up all resources including:
   * - Component managers (button, region control, modals)
   * - Map layers (bounding box visualization)
   * - DOM elements (panel)
   * - Fetch interceptor (restores original window.fetch)
   */
  onRemove(): void {
    // Cleanup all components
    this.buttonManager?.cleanup();
    this.regionControl?.cleanup();
    this.modalManager.close();

    // Remove bbox layer if added
    if (this.bboxLayerAdded && this.map) {
      try {
        if (this.map.getLayer('region-bbox-layer')) {
          this.map.removeLayer('region-bbox-layer');
        }
        if (this.map.getSource('region-bbox-source')) {
          this.map.removeSource('region-bbox-source');
        }
      } catch (error) {
        controlLogger.warn('Error removing bbox layer:', error);
      }
    }

    // Remove panel from DOM
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }

    // Restore original fetch
    window.fetch = this.originalFetch;

    this.map = undefined;
  }

  /**
   * Create panel element
   */
  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className =
      'offline-manager-control fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[min(90vw,600px)] h-[min(80vh,500px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl hidden z-[1000] overflow-hidden text-sm';
    return panel;
  }

  /**
   * Toggle panel visibility
   */
  private togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.panel) {
      if (this.isOpen) {
        // Cancel any active region selection when opening the panel
        if (this.regionControl?.isSelectionActive()) {
          this.regionControl.cancelSelection();
        }
        this.panel.classList.remove('hidden');
        this.renderPanel();
      } else {
        this.panel.classList.add('hidden');
      }
    }
  }

  /**
   * Close panel
   */
  private closePanel(): void {
    this.isOpen = false;
    if (this.panel) {
      this.panel.classList.add('hidden');
    }
  }

  /**
   * Render panel content
   */
  private async renderPanel(): Promise<void> {
    if (!this.panel || !this.panelRenderer) return;
    await this.panelRenderer.render(this.panel);
  }

  /**
   * Start region selection mode
   */
  private startRegionSelection(): void {
    this.closePanel();
    this.regionControl?.startSelection();
  }

  /**
   * Handle region saved event
   */
  private handleRegionSaved(): void {
    // Region saved, refreshing panel
    if (this.panelRenderer) {
      this.panelRenderer.refresh();
    }
  }

  /**
   * Handle progress updates from download manager
   */
  private handleProgressUpdate(
    downloads: Map<string, { percentage: number; phase?: string; currentResource?: string }>
  ): void {
    // Update the progress badge with the current download percentage
    if (downloads.size > 0) {
      // Get the first download's info (or average percentage if multiple)
      const firstDownload = downloads.values().next().value;
      let displayText = '';

      if (downloads.size === 1 && firstDownload) {
        // Show phase-specific progress for single download
        const phase = firstDownload.phase;
        const percentage = firstDownload.percentage;

        switch (phase) {
          case 'style':
            displayText = 'Style';
            break;
          case 'sprites':
            displayText = `Spr ${percentage}%`;
            break;
          case 'glyphs':
            displayText = `Gly ${percentage}%`;
            break;
          case 'tiles':
            displayText = `${percentage}%`;
            break;
          default:
            displayText = `${percentage}%`;
        }
      } else {
        // Multiple downloads - show average
        let totalPercentage = 0;
        for (const download of downloads.values()) {
          totalPercentage += download.percentage;
        }
        const avgPercentage = Math.round(totalPercentage / downloads.size);
        displayText = `${avgPercentage}%`;
      }

      this.updateProgressBadge(displayText, true);
    }
  }

  /**
   * Handle download completion
   */
  private handleDownloadComplete(_regionId: string): void {
    // Download completed for region
    if (this.panelRenderer) {
      this.panelRenderer.refresh();
    }
  }

  /**
   * Handle download error
   */
  private handleDownloadError(regionId: string, error: unknown): void {
    controlLogger.error(`Download error for region ${regionId}:`, error);
    // Use the panel's refresh method instead of renderPanel to avoid conflicts
    if (this.panelRenderer) {
      this.panelRenderer.refresh();
    }
  }

  /**
   * Update button state
   */
  private updateButton(text: string, disabled: boolean): void {
    if (text === 'Offline Maps' && !disabled) {
      this.buttonManager?.resetToDefault();
    } else {
      // For download states, we'll update the button text directly
      // This is a simplified approach for the refactored version
    }
  }

  /**
   * Update progress badge
   */
  private updateProgressBadge(text: string, visible: boolean): void {
    this.buttonManager?.updateProgressBadge(text, visible);
  }

  /**
   * Handle panel click events
   */
  private handlePanelClick(event: Event): void {
    // Prevent panel from closing when clicking inside
    event.stopPropagation();
  }

  /**
   * Focus on a specific region on the map
   */
  private focusRegion(regionId: string): void {
    if (!this.map) return;

    this.offlineManager
      .listStoredRegions()
      .then(regions => {
        controlLogger.debug(
          'Available region IDs:',
          regions.map(r => r.id)
        );
        controlLogger.debug('Requested regionId:', regionId);
        const region = regions.find(r => r.id === regionId);
        if (!region) {
          controlLogger.warn(`Region with id ${regionId} not found.`);
          return;
        }
        controlLogger.debug('Focusing region:', region);
        if (region.bounds) {
          // Validate bounds format
          const bounds = region.bounds;
          const isValid =
            Array.isArray(bounds) &&
            bounds.length === 2 &&
            Array.isArray(bounds[0]) &&
            bounds[0].length === 2 &&
            Array.isArray(bounds[1]) &&
            bounds[1].length === 2 &&
            bounds[0].every(Number.isFinite) &&
            bounds[1].every(Number.isFinite);
          if (!isValid) {
            controlLogger.error('Invalid bounds for region', bounds);
            return;
          }
          controlLogger.debug('Calling map.fitBounds with:', bounds);
          // Fit map to region bounds
          this.map?.fitBounds(bounds as [[number, number], [number, number]], {
            padding: 20,
            duration: 1000,
          });

          // Show bounding box if enabled
          if (this.options.showBbox) {
            this.showRegionBoundingBox(region);
          }
        } else {
          controlLogger.warn('Region has no bounds property:', region);
        }
      })
      .catch((error: unknown) => {
        controlLogger.error('Error focusing region:', error);
      });
  }

  /**
   * Show bounding box for a region on the map
   */
  private showRegionBoundingBox(region: { bounds?: number[][]; name?: string; id?: string }): void {
    if (!this.map || !region.bounds) return;

    const sourceId = 'region-bbox-source';

    // Remove existing bbox if present
    this.removeRegionBoundingBox();

    // Add bbox layer if not already added
    if (!this.bboxLayerAdded) {
      this.initializeBboxLayer();
    }

    const bounds = region.bounds;
    const coordinates = [
      [
        [bounds[0][0], bounds[0][1]], // SW
        [bounds[1][0], bounds[0][1]], // SE
        [bounds[1][0], bounds[1][1]], // NE
        [bounds[0][0], bounds[1][1]], // NW
        [bounds[0][0], bounds[0][1]], // SW (close)
      ],
    ];

    // Update the source with new bbox
    const source = this.map.getSource(sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {
          name: region.name,
          id: region.id,
        },
        geometry: {
          type: 'Polygon',
          coordinates,
        },
      });
    }

    // Auto-hide bbox after 5 seconds
    // setTimeout(() => {
    //   this.removeRegionBoundingBox();
    // }, 5000);
  }

  /**
   * Initialize bounding box layer on the map
   */
  private initializeBboxLayer(): void {
    if (!this.map || this.bboxLayerAdded) return;

    const sourceId = 'region-bbox-source';
    const layerId = 'region-bbox-layer';

    try {
      // Add source
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add layer
      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#3B82F6', // Blue color
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });

      this.bboxLayerAdded = true;
    } catch (error) {
      controlLogger.warn('Could not add bbox layer:', error);
    }
  }

  /**
   * Remove bounding box from the map
   */
  private removeRegionBoundingBox(): void {
    if (!this.map) return;

    const sourceId = 'region-bbox-source';
    const source = this.map.getSource(sourceId) as maplibregl.GeoJSONSource;

    if (source && 'setData' in source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }

  /**
   * Load an offline style by its ID and apply it to the map.
   *
   * This method retrieves the style from IndexedDB, patches it for offline use
   * (converting resource URLs to idb:// protocol), and applies it to the map.
   *
   * @param styleId - The unique identifier of the stored style
   *
   * @example
   * ```ts
   * // Load a specific offline style
   * await control.loadOfflineStyle('style_1234567890');
   * ```
   */
  async loadOfflineStyle(styleId: string): Promise<void> {
    if (!this.map) {
      controlLogger.warn('Map not available for loading offline style');
      return;
    }

    try {
      const { loadStyleById } = await import('../services/styleService');
      const { patchStyleForOffline } = await import('../utils/styleUtils');

      // Load the style from IndexedDB
      const styleEntry = await loadStyleById(styleId);

      if (!styleEntry) {
        controlLogger.error(`Style ${styleId} not found in IndexedDB`);
        return;
      }

      // Patch the style for offline use
      const patchedStyle = patchStyleForOffline(styleEntry.style, styleId);

      // Apply the patched style to the map
      this.map.setStyle(patchedStyle as StyleSpecification);
    } catch (error) {
      controlLogger.error(`Error loading offline style ${styleId}:`, error);
    }
  }

  /**
   * Load styles from IndexedDB and apply to map
   */
  private async loadStylesFromIDB(): Promise<void> {
    if (!this.map) {
      controlLogger.warn('Map not available for loading IDB styles');
      return;
    }

    try {
      // Import the loadStyles function from styleService
      const { loadStyles } = await import('../services/styleService');

      // Get stored styles from IndexedDB
      const styles = await loadStyles();

      if (styles.length === 0) {
        controlLogger.warn('No styles found in IndexedDB');
        alert('No offline styles available. Please download a style first.');
        return;
      }

      // If only one style, load it directly
      if (styles.length === 1) {
        const styleToLoad = styles[0];
        await this.loadOfflineStyle(styleToLoad.key);
        this.renderPanel();
        return;
      }

      // Multiple styles - show selection dialog
      this.showStyleSelectionModal(styles);
    } catch (error) {
      controlLogger.error('Error loading styles from IDB:', error);
    }
  }

  /**
   * Show modal to select which style to load
   */
  private showStyleSelectionModal(
    styles: { key: string; style: { name?: string; sources?: object }; regions?: unknown[] }[]
  ): void {
    // Create modal using consistent CSS classes
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop offline-manager-control';

    // Create backdrop for click-to-close
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop-inner';
    modal.appendChild(backdrop);

    // Create modal content
    const content = document.createElement('div');
    content.className = 'modal-content modal-sm';
    content.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Select Offline Style</h3>
        <button class="modal-close-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="text-gray-600 dark:text-gray-300 mb-4">Choose which offline style to load:</p>
        <div class="flex flex-col gap-2">
          ${styles
            .map(
              style => `
            <button class="w-full p-3 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" data-style-id="${style.key}">
              <div class="font-medium text-gray-900 dark:text-white">${style.style.name || style.key}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                ${style.regions?.length || 0} regions •
                ${Object.keys(style.style.sources || {}).length} sources
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    modal.appendChild(content);

    // Close on backdrop click
    backdrop.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Close button
    const closeBtn = content.querySelector('.modal-close-btn');
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Style selection
    const styleButtons = content.querySelectorAll('[data-style-id]');
    styleButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const styleId = button.getAttribute('data-style-id');
        if (styleId) {
          document.body.removeChild(modal);
          await this.loadOfflineStyle(styleId);
          this.renderPanel();
        }
      });
    });

    document.body.appendChild(modal);
  }

  /**
   * Load offline styles from IndexedDB and apply to the map.
   *
   * If only one style is available, it's loaded automatically.
   * If multiple styles exist, a selection modal is shown to the user.
   *
   * @example
   * ```ts
   * // Check for offline styles and load if available
   * await control.loadOfflineStyles();
   * ```
   */
  async loadOfflineStyles(): Promise<void> {
    await this.loadStylesFromIDB();
  }

  /**
   * Load a specific offline style by its ID.
   * Alias for `loadOfflineStyle()` for API clarity.
   *
   * @param styleId - The unique identifier of the stored style
   */
  async loadSpecificOfflineStyle(styleId: string): Promise<void> {
    await this.loadOfflineStyle(styleId);
  }

  /**
   * Update the style URL used for new region downloads.
   *
   * @param newStyleUrl - The new style URL to use
   *
   * @example
   * ```ts
   * // Switch to a different map style
   * control.updateStyleUrl('https://example.com/dark-style.json');
   * ```
   */
  updateStyleUrl(newStyleUrl: string): void {
    this.options.styleUrl = newStyleUrl;

    // Update any active regions or downloads to use the new style
    if (this.regionControl) {
      // Update region control with new style URL
      this.regionControl.updateStyleUrl(newStyleUrl);
    }
  }

  /**
   * Get the current style URL configured for new downloads.
   *
   * @returns The currently configured style URL
   */
  getCurrentStyleUrl(): string {
    return this.options.styleUrl;
  }
}
