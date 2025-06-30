import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import { themeManager } from './ThemeManager';
import { idbFetchHandler } from '../utils/idbFetchHandler';

// Import refactored modular components
import { ButtonManager } from './managers/ControlButtonManager';
import { PanelRenderer } from './managers/PanelManager';
import { RegionControl } from './controls/RegionControl';
import { DownloadManager } from './managers/downloadManager';
import { ModalManager } from './modals/ModalManager';
import maplibregl from 'maplibre-gl';

export interface OfflineManagerControlOptions {
  styleUrl: string;
  theme?: 'light' | 'dark';
  showBbox?: boolean; // Optional flag to show bounding boxes on map
}

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
  // Bounding box layer for regions
  private bboxLayerAdded = false;
  // Store original fetch to restore on cleanup
  private originalFetch: typeof window.fetch;

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
   * Setup fetch interceptor to handle idb:// URLs
   */
  private setupFetchInterceptor(): void {
    const self = this;
    // console.log('🔧 Setting up fetch interceptor for idb:// URLs');

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';

      // console.log(`📡 Fetch intercepted: ${method} ${url}`);

      if (url.startsWith('idb://')) {
        // console.log(`🎯 Routing to IDB handler: ${method} ${url}`);

        // You can access POST data here if needed
        if (method === 'POST' && init?.body) {
          // console.log(`📝 POST body:`, init.body);
        }

        return idbFetchHandler(url, init);
      }

      // console.log(`🌐 Using original fetch: ${method} ${url}`);
      return self.originalFetch(input, init);
    };
  }

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
        console.warn('Error removing bbox layer:', error);
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
    console.log(`✅ Region saved, refreshing panel`);
    // Use the panel's refresh method instead of renderPanel to avoid conflicts
    if (this.panelRenderer) {
      this.panelRenderer.refresh();
    }
  }

  /**
   * Handle progress updates from download manager
   */
  private handleProgressUpdate(downloads: Map<string, any>): void {
    // Only update the download progress section, don't refresh the entire panel
    // The PanelRenderer will handle this through renderDownloadProgress()
    if (this.panelRenderer) {
      // Don't refresh the entire panel for progress updates, just log
      console.log(`📊 Download progress update:`, downloads.size, 'active downloads');
    }
  }

  /**
   * Handle download completion
   */
  private handleDownloadComplete(regionId: string): void {
    console.log(`✅ Download completed for region: ${regionId}`);
    // Use the panel's refresh method instead of renderPanel to avoid conflicts
    if (this.panelRenderer) {
      this.panelRenderer.refresh();
    }
  }

  /**
   * Handle download error
   */
  private handleDownloadError(regionId: string, error: any): void {
    console.error(`Download error for region ${regionId}:`, error);
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
      .listRegions()
      .then((regions: any[]) => {
        console.log('[fitBounds] Available region IDs:', regions.map((r: any) => r.id));
        console.log('[fitBounds] Requested regionId:', regionId);
        const region = regions.find((r: any) => r.id === regionId);
        if (!region) {
          console.warn(`[fitBounds] Region with id ${regionId} not found.`);
          return;
        }
        console.log(`[fitBounds] Focusing region:`, region);
        if (region.bounds) {
          // Validate bounds format
          const bounds = region.bounds;
          const isValid = Array.isArray(bounds) && bounds.length === 2 &&
            Array.isArray(bounds[0]) && bounds[0].length === 2 &&
            Array.isArray(bounds[1]) && bounds[1].length === 2 &&
            bounds[0].every(Number.isFinite) && bounds[1].every(Number.isFinite);
          if (!isValid) {
            console.error(`[fitBounds] Invalid bounds for region`, bounds);
            return;
          }
          console.log(`[fitBounds] Calling map.fitBounds with:`, bounds);
          // Fit map to region bounds
          this.map!.fitBounds(bounds as [[number, number], [number, number]], {
            padding: 20,
            duration: 1000,
          });

          // Show bounding box if enabled
          if (this.options.showBbox) {
            this.showRegionBoundingBox(region);
          }
        } else {
          console.warn(`[fitBounds] Region has no bounds property:`, region);
        }
      })
      .catch((error: any) => {
        console.error('Error focusing region:', error);
      });
  }

  /**
   * Show bounding box for a region on the map
   */
  private showRegionBoundingBox(region: any): void {
    if (!this.map || !region.bounds) return;

    const sourceId = 'region-bbox-source';
    const layerId = 'region-bbox-layer';

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
      console.warn('Could not add bbox layer:', error);
    }
  }

  /**
   * Remove bounding box from the map
   */
  private removeRegionBoundingBox(): void {
    if (!this.map) return;

    const sourceId = 'region-bbox-source';
    const source = this.map.getSource(sourceId) as any;

    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }

  /**
   * Load offline style for a specific style ID
   */
  async loadOfflineStyle(styleId: string): Promise<void> {
    if (!this.map) {
      console.warn('Map not available for loading offline style');
      return;
    }

    try {
      console.log(`🔄 Loading offline style: ${styleId}`);

      const { loadStyleById } = await import('../services/styleService');
      const { patchStyleForOffline } = await import('../utils/styleUtils');

      // Load the style from IndexedDB
      const styleEntry = await loadStyleById(styleId);

      if (!styleEntry) {
        console.error(`Style ${styleId} not found in IndexedDB`);
        return;
      }

      // Patch the style for offline use
      const patchedStyle = patchStyleForOffline(styleEntry.style, styleId);

      console.log(`🎨 Applying patched offline style for: ${styleId}`);
      console.log('Patched style sources:', Object.keys(patchedStyle.sources || {}));

      // Apply the patched style to the map
      this.map.setStyle(patchedStyle as any);

      console.log(`✅ Offline style ${styleId} loaded successfully`);
    } catch (error) {
      console.error(`❌ Error loading offline style ${styleId}:`, error);
    }
  }

  /**
   * Load styles from IndexedDB and apply to map
   */
  private async loadStylesFromIDB(): Promise<void> {
    if (!this.map) {
      console.warn('Map not available for loading IDB styles');
      return;
    }

    try {
      // Import the loadStyles function from styleService
      const { loadStyles } = await import('../services/styleService');

      // Get stored styles from IndexedDB
      const styles = await loadStyles();

      if (styles.length === 0) {
        console.warn('No styles found in IndexedDB');
        alert('No offline styles available. Please download a style first.');
        return;
      }

      // If only one style, load it directly
      if (styles.length === 1) {
        const styleToLoad = styles[0];
        console.log('Loading single available style:', styleToLoad.key);
        await this.loadOfflineStyle(styleToLoad.key);
        this.renderPanel();
        return;
      }

      // Multiple styles - show selection dialog
      console.log(`Found ${styles.length} offline styles available`);
      this.showStyleSelectionModal(styles);
    } catch (error) {
      console.error('Error loading styles from IDB:', error);
    }
  }

  /**
   * Show modal to select which style to load
   */
  private showStyleSelectionModal(styles: any[]): void {
    // Create a simple selection modal
    const modal = document.createElement('div');
    modal.className = 'offline-modal-overlay';
    modal.innerHTML = `
      <div class="offline-modal">
        <div class="offline-modal-header">
          <h3>Select Offline Style</h3>
          <button class="offline-modal-close">&times;</button>
        </div>
        <div class="offline-modal-body">
          <p>Choose which offline style to load:</p>
          <div class="offline-style-list">
            ${styles
              .map(
                style => `
              <button class="offline-style-option" data-style-id="${style.key}">
                <div class="style-name">${style.style.name || style.key}</div>
                <div class="style-info">
                  ${style.regions?.length || 0} regions • 
                  ${Object.keys(style.style.sources || {}).length} sources
                </div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector('.offline-modal-close');
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // Style selection
    const styleButtons = modal.querySelectorAll('.offline-style-option');
    styleButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const styleId = button.getAttribute('data-style-id');
        if (styleId) {
          document.body.removeChild(modal);
          console.log(`User selected style: ${styleId}`);
          await this.loadOfflineStyle(styleId);
          this.renderPanel();
        }
      });
    });

    // Close on overlay click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  }

  /**
   * Public method to load offline styles - can be called from outside
   */
  async loadOfflineStyles(): Promise<void> {
    await this.loadStylesFromIDB();
  }

  /**
   * Public method to load a specific offline style by ID
   */
  async loadSpecificOfflineStyle(styleId: string): Promise<void> {
    await this.loadOfflineStyle(styleId);
  }

  /**
   * Update the current style URL for the offline manager
   */
  updateStyleUrl(newStyleUrl: string): void {
    this.options.styleUrl = newStyleUrl;
    console.log(`🔄 Offline manager style URL updated to: ${newStyleUrl}`);

    // Update any active regions or downloads to use the new style
    if (this.regionControl) {
      // Update region control with new style URL
      this.regionControl.updateStyleUrl(newStyleUrl);
    }
  }

  /**
   * Get the current style URL
   */
  getCurrentStyleUrl(): string {
    return this.options.styleUrl;
  }
}
