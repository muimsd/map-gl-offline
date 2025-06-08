import type { IControl, Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import { icons } from '../utils/icons';
import { themeManager, generateCSSCustomProperties } from './themes';
import { createHeader } from './header';
import { createActionButtons } from './actionButtons';
import { createDownloadProgressSection } from './downloadProgress';
import { createRegionsList } from './regionsList';
import { createButton, createInput, createModal } from './components';
import { area, bboxPolygon, difference, convertArea } from '@turf/turf';
import { featureCollection, polygon } from '@turf/helpers';
// import { formatBytes, formatDate } from '../utils/formatting';
import type { StoredRegion } from '../types';

// Inline formatting functions to avoid import issues
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date: number | Date): string {
  if (typeof date === 'number') {
    return new Date(date).toLocaleDateString();
  }
  return date.toLocaleDateString();
}

interface DownloadProgress {
  regionId: string;
  completed: number;
  total: number;
  percentage: number;
  currentResource: string;
}

export class OfflineManagerControl implements IControl {
  private map: MaplibreMap | undefined;
  private container: HTMLDivElement | undefined;
  private button: HTMLButtonElement | undefined;
  private progressBadge: HTMLSpanElement | undefined;
  private panel: HTMLDivElement | undefined;
  private isOpen = false;
  private currentDownloads: Map<string, DownloadProgress> = new Map();
  private offlineManager: OfflineMapManager;
  private activeModal: HTMLDivElement | undefined;

  // Polygon selection state
  private isPolygonMode = false;
  private polygonControl: HTMLDivElement | undefined;
  private currentPolygonArea = 0;
  private currentBounds: [number, number, number, number] | null = null;

  constructor(
    offlineManager: OfflineMapManager,
    options: { theme?: 'light' | 'dark' } = { theme: 'dark' }
  ) {
    this.offlineManager = offlineManager;

    // Set initial theme if provided
    if (options?.theme) {
      themeManager.setTheme(options.theme);
    }

    this.applyGlobalStyles();
  }

  private applyGlobalStyles(): void {
    const theme = themeManager.getTheme();

    let styleElement = document.getElementById('offline-manager-theme-styles') as HTMLStyleElement;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'offline-manager-theme-styles';
      document.head.appendChild(styleElement);
    }

    // Generate CSS custom properties and wrap them in :root selector
    const cssProperties = generateCSSCustomProperties(theme);
    styleElement.textContent = `
      :root {
        ${cssProperties}
      }
      
      /* Ensure the offline manager control inherits theme variables */
      .offline-manager-control {
        ${cssProperties}
      }
      
      /* Apply theme variables to all children */
      .offline-manager-control * {
        --theme-spacing-xs: ${theme.spacing.xs};
        --theme-spacing-sm: ${theme.spacing.sm};
        --theme-spacing-md: ${theme.spacing.md};
        --theme-spacing-lg: ${theme.spacing.lg};
        --theme-spacing-xl: ${theme.spacing.xl};
        --theme-spacing-xxl: ${theme.spacing.xxl};
      }
    `;

    // Debug: Log to console to verify CSS variables are being applied
    // console.log('Applied theme:', theme.mode, 'with properties:', cssProperties);
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;

    // Apply global styles first before creating any elements
    this.applyGlobalStyles();

    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group offline-manager-control';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.style.position = 'relative';
    this.button.innerHTML = icons.cloud({ size: 20, color: 'black' });
    this.button.title = 'Offline Map Manager';

    this.progressBadge = document.createElement('span');
    this.progressBadge.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      background: var(--theme-info);
      color: var(--theme-text-inverse);
      border-radius: var(--theme-radius-full);
      padding: var(--theme-spacing-xs) var(--theme-spacing-sm);
      font-size: var(--theme-font-size-xs);
      font-weight: var(--theme-font-weight-bold);
      display: none;
      min-width: 16px;
      text-align: center;
      box-shadow: var(--theme-shadow-md);
    `;
    this.button.appendChild(this.progressBadge);

    this.panel = document.createElement('div');
    this.panel.className = 'offline-manager-control';
    this.panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(90vw, 600px);
      height: min(80vh, 500px);
      background: var(--theme-surface);
      border: 1px solid var(--theme-border);
      border-radius: var(--theme-radius-xl);
      box-shadow: var(--theme-shadow-xl);
      display: none;
      z-index: 1000;
      overflow: hidden;
      font-family: var(--theme-font-family);
      font-size: var(--theme-font-size-sm);
    `;

    this.button.addEventListener('click', this.togglePanel.bind(this));
    this.container.appendChild(this.button);
    // Append panel to document body for proper centering and full-screen modal behavior
    document.body.appendChild(this.panel);

    // Add event delegation for better event handling
    this.panel.addEventListener('click', this.handlePanelClick.bind(this));

    // Make methods available globally for onclick handlers
    (window as any).offlineManagerControl = this;

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    this.closeModal();
    this.map = undefined;
    delete (window as any).offlineManagerControl;
  }

  public closeModal(): void {
    if (this.activeModal && this.activeModal.parentNode) {
      this.activeModal.parentNode.removeChild(this.activeModal);
      this.activeModal = undefined;
    }
  }

  private showModal(modal: HTMLDivElement): void {
    this.closeModal();
    this.activeModal = modal;
    // Ensure modal has proper theme class
    modal.classList.add('offline-manager-control');
    document.body.appendChild(modal);
  }

  private togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.panel) {
      if (this.isOpen) {
        this.panel.style.display = 'block';
        this.renderPanel();
      } else {
        this.panel.style.display = 'none';
      }
    }
  }

  private closePanel(): void {
    this.isOpen = false;
    if (this.panel) {
      this.panel.style.display = 'none';
    }
  }

  private async renderPanel(): Promise<void> {
    if (!this.panel) return;

    try {
      const [regions, analytics] = await Promise.all([
        this.offlineManager.listStoredRegions(),
        this.offlineManager.getComprehensiveStorageAnalytics(),
      ]);

      const headerElement = createHeader({
        title: 'Offline Manager',
        subtitle: `${regions.length} regions • ${formatBytes(analytics.totalStorageSize)} total`,
        onClose: () => this.closePanel(),
        onToggleTheme: () => {
          console.log('Toggling theme');
          themeManager.toggleTheme();
          this.applyGlobalStyles();
          this.renderPanel();
        },
      });

      const actionButtonsElement = createActionButtons({
        onAddRegion: () => this.showSimpleAddForm(),
        onRefresh: () => this.renderPanel(),
      });

      let downloadProgressSection = '';
      if (this.currentDownloads.size > 0) {
        const progressElement = createDownloadProgressSection({
          downloads: this.currentDownloads,
        });
        downloadProgressSection = progressElement.outerHTML;
      }

      const regionsListElement = createRegionsList({
        regions,
        onFocusRegion: (regionId: string) => this.focusRegion(regionId),
        onDeleteRegion: (regionId: string) => this.deleteRegion(regionId),
        onShowRegionDetails: (regionId: string) => this.showRegionDetails(regionId),
        formatBytes,
      });

      // Clear panel and rebuild with proper event handling
      this.panel.innerHTML = '';

      // Create main container
      const mainContainer = document.createElement('div');
      mainContainer.style.cssText = `
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--theme-surface);
        border-radius: var(--theme-radius-xl);
        overflow: hidden;
      `;

      // Create content container
      const contentContainer = document.createElement('div');
      contentContainer.style.cssText = `
        flex: 1;
        padding: var(--theme-spacing-lg);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--theme-spacing-lg);
      `;

      // Append header (with working event listeners)
      mainContainer.appendChild(headerElement);

      // Append action buttons
      contentContainer.appendChild(actionButtonsElement);

      // Append download progress if exists
      if (downloadProgressSection) {
        const progressDiv = document.createElement('div');
        progressDiv.innerHTML = downloadProgressSection;
        contentContainer.appendChild(progressDiv.firstElementChild as HTMLElement);
      }

      // Append regions list
      contentContainer.appendChild(regionsListElement);

      // Append content to main container
      mainContainer.appendChild(contentContainer);

      // Append main container to panel
      this.panel.appendChild(mainContainer);
    } catch (error) {
      console.error('Error rendering panel:', error);

      // Clear panel and create error state with working event handlers
      this.panel.innerHTML = '';

      // Create main container
      const errorContainer = document.createElement('div');
      errorContainer.style.cssText = `
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--theme-surface);
        border-radius: var(--theme-radius-xl);
        overflow: hidden;
      `;

      // Create error header
      const errorHeader = document.createElement('div');
      errorHeader.style.cssText = `
        background: linear-gradient(135deg, var(--theme-error) 0%, var(--theme-error-hover) 100%);
        color: var(--theme-text-inverse);
        padding: var(--theme-spacing-lg);
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;

      const headerContent = document.createElement('div');
      headerContent.innerHTML = `
        <h2 style="margin: 0; font-size: var(--theme-font-size-lg); font-weight: var(--theme-font-weight-bold);">
          Error Loading Regions
        </h2>
        <p style="margin: var(--theme-spacing-xs) 0 0 0; opacity: 0.9; font-size: var(--theme-font-size-sm);">
          Unable to load offline regions data
        </p>
      `;

      const closeButton = createButton({
        variant: 'ghost',
        size: 'sm',
        icon: 'x',
        children: '',
        onClick: () => this.closePanel(),
        style: {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          color: 'var(--theme-text-inverse)',
          width: '36px',
          height: '36px',
          padding: '0',
          borderRadius: '50%',
        },
      });

      errorHeader.appendChild(headerContent);
      errorHeader.appendChild(closeButton);

      // Create error content
      const errorContent = document.createElement('div');
      errorContent.style.cssText = `
        flex: 1;
        padding: var(--theme-spacing-lg);
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--theme-spacing-lg);
      `;

      const errorMessage = document.createElement('p');
      errorMessage.style.cssText = `
        color: var(--theme-error);
        font-size: var(--theme-font-size-md);
        margin: 0;
      `;
      errorMessage.textContent = 'Error loading offline regions';

      const retryButton = createButton({
        variant: 'primary',
        size: 'md',
        children: 'Retry',
        onClick: () => this.renderPanel(),
        style: {
          fontSize: 'var(--theme-font-size-md)',
          fontWeight: 'var(--theme-font-weight-semibold)',
        },
      });

      errorContent.appendChild(errorMessage);
      errorContent.appendChild(retryButton);

      errorContainer.appendChild(errorHeader);
      errorContainer.appendChild(errorContent);

      this.panel.appendChild(errorContainer);
    }
  }

  private showSimpleAddForm(): void {
    // Enter polygon selection mode
    this.enterPolygonMode();
  }

  /**
   * Enter polygon selection mode
   */
  private enterPolygonMode(): void {
    if (!this.map) return;

    this.isPolygonMode = true;
    this.closePanel(); // Close the main panel

    // Create polygon control UI
    this.createPolygonControl();

    // Add polygon visualization
    this.updatePolygonVisualization();

    // Add map event listeners
    this.map.on('moveend', this.handleMapMoveEnd.bind(this));
    this.map.on('zoomend', this.handleMapMoveEnd.bind(this));
  }

  /**
   * Exit polygon selection mode
   */
  private exitPolygonMode(): void {
    if (!this.map) return;

    this.isPolygonMode = false;

    // Remove polygon control UI
    if (this.polygonControl && this.polygonControl.parentNode) {
      this.polygonControl.parentNode.removeChild(this.polygonControl);
      this.polygonControl = undefined;
    }

    // Remove polygon visualization
    this.removePolygonVisualization();

    // Remove map event listeners
    this.map.off('moveend', this.handleMapMoveEnd.bind(this));
    this.map.off('zoomend', this.handleMapMoveEnd.bind(this));

    this.currentBounds = null;
    this.currentPolygonArea = 0;
  }

  /**
   * Create the polygon control UI
   */
  private createPolygonControl(): void {
    if (!this.map) return;

    this.polygonControl = document.createElement('div');
    this.polygonControl.className = 'offline-manager-control';
    this.polygonControl.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: var(--theme-surface);
      border: 1px solid var(--theme-border);
      border-radius: var(--theme-radius-lg);
      box-shadow: var(--theme-shadow-lg);
      padding: var(--theme-spacing-md);
      z-index: 1000;
      font-family: var(--theme-font-family);
      min-width: 250px;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--theme-spacing-sm);
      padding-bottom: var(--theme-spacing-sm);
      border-bottom: 1px solid var(--theme-border);
    `;

    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0;
      font-size: var(--theme-font-size-md);
      font-weight: var(--theme-font-weight-semibold);
      color: var(--theme-text);
    `;
    title.textContent = 'Select Region';

    const closeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: 'x',
      children: '',
      onClick: () => this.exitPolygonMode(),
      style: {
        width: '24px',
        height: '24px',
        padding: '0',
      },
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `
      margin-bottom: var(--theme-spacing-md);
      font-size: var(--theme-font-size-sm);
      color: var(--theme-text-secondary);
    `;

    const areaInfo = document.createElement('div');
    areaInfo.id = 'polygon-area-info';
    areaInfo.style.cssText = `
      margin-bottom: var(--theme-spacing-xs);
      font-weight: var(--theme-font-weight-medium);
      color: var(--theme-text);
    `;

    const instruction = document.createElement('div');
    instruction.textContent = 'Move and zoom the map to adjust the selection area';
    instruction.style.cssText = `
      font-size: var(--theme-font-size-xs);
      color: var(--theme-text-muted);
    `;

    infoSection.appendChild(areaInfo);
    infoSection.appendChild(instruction);

    // Create save button
    const saveButton = createButton({
      variant: 'primary',
      size: 'md',
      children: 'Save Polygon',
      onClick: () => this.showRegionForm(),
      style: {
        width: '100%',
        background:
          'linear-gradient(135deg, var(--theme-success) 0%, var(--theme-success-hover) 100%)',
      },
    });

    this.polygonControl.appendChild(header);
    this.polygonControl.appendChild(infoSection);
    this.polygonControl.appendChild(saveButton);

    // Add to map container
    const mapContainer = this.map.getContainer();
    mapContainer.appendChild(this.polygonControl);
  }

  /**
   * Handle map move/zoom events
   */
  private handleMapMoveEnd(): void {
    if (this.isPolygonMode) {
      this.updatePolygonVisualization();
    }
  }

  /**
   * Update polygon visualization based on current map bounds
   */
  private updatePolygonVisualization(): void {
    if (!this.map) return;

    const bboxArray = this.map.getBounds().toArray() as [number, number][];
    if (!bboxArray) return;

    const [minLng, minLat] = bboxArray[0];
    const [maxLng, maxLat] = bboxArray[1];

    const lngDiff = (maxLng - minLng) * 0.2;
    const latDiff = (maxLat - minLat) * 0.2;

    const clippedBbox = [minLng + lngDiff, minLat + latDiff, maxLng - lngDiff, maxLat - latDiff];

    // Store current bounds for later use
    this.currentBounds = clippedBbox as [number, number, number, number];

    const clippedPolygon = bboxPolygon([
      clippedBbox[0],
      clippedBbox[1],
      clippedBbox[2],
      clippedBbox[3],
    ]);

    const originalPolygon = polygon([
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ]);

    // Calculate area
    const clippedPolygonAreaM2 = area(clippedPolygon);
    const clippedPolygonAreaKM2 = convertArea(clippedPolygonAreaM2, 'meters', 'kilometers');
    this.currentPolygonArea = parseFloat(clippedPolygonAreaKM2.toFixed(2));

    // Update area info in UI
    const areaInfo = document.getElementById('polygon-area-info');
    if (areaInfo) {
      areaInfo.textContent = `Area: ${this.currentPolygonArea} km²`;
    }

    const leftoverPolygon = difference(featureCollection([originalPolygon, clippedPolygon]));

    if (!leftoverPolygon) {
      console.error('Failed to compute the difference between polygons');
      return;
    }

    // Update map visualization
    if (this.map.getSource('leftoverPolygon')) {
      (this.map.getSource('leftoverPolygon') as GeoJSONSource).setData(leftoverPolygon);
    } else {
      this.map.addSource('leftoverPolygon', {
        type: 'geojson',
        data: leftoverPolygon,
      });

      this.map.addLayer({
        id: 'leftoverPolygon',
        type: 'fill',
        source: 'leftoverPolygon',
        layout: {},
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.7,
        },
      });
    }

    // Add selection polygon visualization
    if (this.map.getSource('selectionPolygon')) {
      (this.map.getSource('selectionPolygon') as GeoJSONSource).setData(clippedPolygon);
    } else {
      this.map.addSource('selectionPolygon', {
        type: 'geojson',
        data: clippedPolygon,
      });

      this.map.addLayer({
        id: 'selectionPolygon',
        type: 'line',
        source: 'selectionPolygon',
        layout: {},
        paint: {
          'line-color': 'var(--theme-primary)',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });
    }
  }

  /**
   * Remove polygon visualization from map
   */
  private removePolygonVisualization(): void {
    if (!this.map) return;

    // Remove layers and sources
    if (this.map.getLayer('leftoverPolygon')) {
      this.map.removeLayer('leftoverPolygon');
    }
    if (this.map.getLayer('selectionPolygon')) {
      this.map.removeLayer('selectionPolygon');
    }
    if (this.map.getSource('leftoverPolygon')) {
      this.map.removeSource('leftoverPolygon');
    }
    if (this.map.getSource('selectionPolygon')) {
      this.map.removeSource('selectionPolygon');
    }
  }

  /**
   * Show the region form with calculated bounds and area
   */
  private showRegionForm(): void {
    if (!this.map || !this.currentBounds) return;

    const [west, south, east, north] = this.currentBounds;
    const styleUrl = this.getCurrentStyleUrl();

    const modalContent = `
      <div style="display: flex; flex-direction: column; gap: var(--theme-spacing-md); height: '100%'">
        <div>
          <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
            Region Name:
          </label>
          <input type="text" id="region-name" placeholder="Enter region name..." 
                 style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm); color: var(--theme-text); background: var(--theme-surface);">
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--theme-spacing-sm);">
          <div>
            <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
              Min Zoom:
            </label>
            <input type="number" id="min-zoom" value="1" min="0" max="20"
                   style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm); color: var(--theme-text); background: var(--theme-surface);">
          </div>
          <div>
            <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
              Max Zoom:
            </label>
            <input type="number" id="max-zoom" value="14" min="0" max="20"
                   style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm); color: var(--theme-text); background: var(--theme-surface);">
          </div>
        </div>

        <div>
          <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
            Style URL:
          </label>
          <input type="text" id="style-url" value="${styleUrl}" 
                 style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm); color: var(--theme-text); background: var(--theme-surface);">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--theme-spacing-sm); padding: var(--theme-spacing-sm); background: var(--theme-background-secondary); border-radius: var(--theme-radius-sm); border: 1px solid var(--theme-border);">
          <div>
            <strong style="color: var(--theme-text);">Area:</strong>
            <div style="color: var(--theme-text-secondary); font-size: var(--theme-font-size-sm);">${this.currentPolygonArea} km²</div>
          </div>
          <div>
            <strong style="color: var(--theme-text);">Bounds:</strong>
            <div style="color: var(--theme-text-secondary); font-size: var(--theme-font-size-xs);">
              ${west.toFixed(4)}, ${south.toFixed(4)}<br>
              ${east.toFixed(4)}, ${north.toFixed(4)}
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: var(--theme-spacing-sm); justify-content: flex-end; margin-top: var(--theme-spacing-md);">
          <button onclick="offlineManagerControl.cancelRegionForm()" 
                  style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-text-muted); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
            Cancel
          </button>
          <button onclick="offlineManagerControl.handleRegionSave()" 
                  style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary-hover) 100%); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
            Download Region
          </button>
        </div>
      </div>
    `;

    const modal = createModal({
      title: 'Download Offline Region',
      subtitle: `Selected area: ${this.currentPolygonArea} km²`,
      isOpen: true,
      size: 'lg',
      showThemeToggle: true,
      onClose: () => this.cancelRegionForm(),
      onThemeToggle: () => {
        themeManager.toggleTheme();
        this.renderPanel(); // Re-render panel to reflect theme change
      },
      children: modalContent,
    });

    this.showModal(modal);
  }

  /**
   * Cancel region form and return to polygon mode
   */
  public cancelRegionForm(): void {
    this.closeModal();
    // Stay in polygon mode for further adjustments
  }

  /**
   * Get current style URL from map
   */
  private getCurrentStyleUrl(): string {
    if (!this.map) return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

    try {
      const style = this.map.getStyle();
      return (
        (style as any).metadata?.['mapbox:origin'] ||
        style.metadata?.styleUrl ||
        'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
      );
    } catch (error) {
      return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
    }
  }

  /**
   * Handle region save from form
   */
  public async handleRegionSave(): Promise<void> {
    if (!this.currentBounds) return;

    try {
      const nameInput = document.getElementById('region-name') as HTMLInputElement;
      const minZoomInput = document.getElementById('min-zoom') as HTMLInputElement;
      const maxZoomInput = document.getElementById('max-zoom') as HTMLInputElement;
      const styleUrlInput = document.getElementById('style-url') as HTMLInputElement;

      const [west, south, east, north] = this.currentBounds;
      const regionConfig = {
        id: `region`,
        name: nameInput?.value || `Region ${Date.now()}`,
        bounds: [
          [west, south],
          [east, north],
        ] as [[number, number], [number, number]],
        minZoom: parseInt(minZoomInput?.value || '1'),
        maxZoom: parseInt(maxZoomInput?.value || '14'),
        styleUrl: styleUrlInput?.value || this.getCurrentStyleUrl(),
      };

      // Close form and exit polygon mode
      this.closeModal();
      this.exitPolygonMode();

      // Start download with progress tracking
      await this.downloadRegionWithProgress(regionConfig);
    } catch (error) {
      console.error('Error saving region:', error);
      // TODO: Show error modal
    }
  }

  /**
   * Download region with progress tracking
   */
  private async downloadRegionWithProgress(regionConfig: any): Promise<void> {
    const regionId = regionConfig.id;

    try {
      // Show progress in button
      if (this.button) {
        this.button.textContent = 'Downloading...';
        this.button.disabled = true;
      }

      // Setup progress tracking
      const progressHandler = (progress: any) => {
        const percentage = Math.round((progress.completed / progress.total) * 100);

        // Update progress badge
        if (this.progressBadge) {
          this.progressBadge.textContent = `${percentage}%`;
          this.progressBadge.style.display = 'block';
        }

        // Update button text
        if (this.button) {
          this.button.textContent = `Downloading... ${percentage}%`;
        }

        // Store progress for modal display
        this.currentDownloads.set(regionId, {
          regionId,
          completed: progress.completed,
          total: progress.total,
          percentage,
          currentResource: progress.currentResource || '',
        });
      };

      // Add region (note: addRegion only takes one parameter)
      await this.offlineManager.addRegion(regionConfig);

      // Download complete
      this.currentDownloads.delete(regionId);

      // Reset UI
      if (this.button) {
        this.button.textContent = 'Offline Maps';
        this.button.disabled = false;
      }

      if (this.progressBadge) {
        this.progressBadge.style.display = 'none';
      }

      // Refresh panel to show new region
      await this.renderPanel();
    } catch (error) {
      console.error('Error downloading region:', error);

      // Reset UI on error
      this.currentDownloads.delete(regionId);
      if (this.button) {
        this.button.textContent = 'Offline Maps';
        this.button.disabled = false;
      }
      if (this.progressBadge) {
        this.progressBadge.style.display = 'none';
      }
    }
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
        const region = regions.find((r: any) => r.id === regionId);
        if (region && region.bounds) {
          // Fit map to region bounds
          this.map!.fitBounds(region.bounds, {
            padding: 20,
            duration: 1000,
          });
        }
      })
      .catch((error: any) => {
        console.error('Error focusing region:', error);
      });
  }

  /**
   * Delete a region
   */
  private async deleteRegion(regionId: string): Promise<void> {
    try {
      // Show confirmation modal
      const confirmed = await this.showConfirmationModal(
        'Delete Region',
        'Are you sure you want to delete this region? This will remove all downloaded map data for this area.',
        'Delete',
        'Cancel'
      );

      if (confirmed) {
        await this.offlineManager.deleteRegion(regionId);
        await this.renderPanel(); // Refresh the panel
      }
    } catch (error: any) {
      console.error('Error deleting region:', error);
    }
  }

  /**
   * Show region details in a modal
   */
  private showRegionDetails(regionId: string): void {
    this.offlineManager
      .listRegions()
      .then((regions: any[]) => {
        const region = regions.find((r: any) => r.id === regionId);
        if (!region) return;

        const modalContent = `
        <div style="display: flex; flex-direction: column; gap: var(--theme-spacing-md);">
          <div>
            <h3 style="margin: 0 0 var(--theme-spacing-sm) 0; color: var(--theme-text); font-size: var(--theme-font-size-lg);">
              ${region.name}
            </h3>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--theme-spacing-md);">
            <div>
              <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
                Bounds:
              </label>
              <div style="font-size: var(--theme-font-size-sm); color: var(--theme-text-secondary);">
                ${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)}<br>
                ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}
              </div>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
                Zoom Range:
              </label>
              <div style="font-size: var(--theme-font-size-sm); color: var(--theme-text-secondary);">
                ${region.minZoom} - ${region.maxZoom}
              </div>
            </div>
          </div>
          
          ${
            region.downloadedAt
              ? `
            <div>
              <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold); color: var(--theme-text);">
                Downloaded:
              </label>
              <div style="font-size: var(--theme-font-size-sm); color: var(--theme-text-secondary);">
                ${formatDate(region.downloadedAt)}
              </div>
            </div>
          `
              : ''
          }
          
          <div style="display: flex; gap: var(--theme-spacing-sm); justify-content: flex-end; margin-top: var(--theme-spacing-md);">
            <button onclick="offlineManagerControl.closeModal(); offlineManagerControl.focusRegion('${region.id}')" 
                    style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-text-muted); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
              Focus on Map
            </button>
            <button onclick="offlineManagerControl.closeModal()" 
                    style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary-hover) 100%); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
              Close
            </button>
          </div>
        </div>
      `;

        const modal = createModal({
          title: 'Region Details',
          isOpen: true,
          size: 'md',
          showThemeToggle: true,
          onClose: () => this.closeModal(),
          onThemeToggle: () => {
            themeManager.toggleTheme();
            this.renderPanel();
          },
          children: modalContent,
        });

        this.showModal(modal);
      })
      .catch((error: any) => {
        console.error('Error showing region details:', error);
      });
  }

  /**
   * Show confirmation modal
   */
  private showConfirmationModal(
    title: string,
    message: string,
    confirmText: string,
    cancelText: string
  ): Promise<boolean> {
    return new Promise(resolve => {
      const modalContent = `
        <div style="display: flex; flex-direction: column; gap: var(--theme-spacing-lg);">
          <p style="margin: 0; color: var(--theme-text); line-height: 1.5;">
            ${message}
          </p>
          
          <div style="display: flex; gap: var(--theme-spacing-sm); justify-content: flex-end;">
            <button onclick="offlineManagerControl.closeModal(); offlineManagerControl.resolveConfirmation(false)" 
                    style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-text-muted); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
              ${cancelText}
            </button>
            <button onclick="offlineManagerControl.closeModal(); offlineManagerControl.resolveConfirmation(true)" 
                    style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: linear-gradient(135deg, var(--theme-danger) 0%, var(--theme-danger-hover) 100%); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      // Store resolver for confirmation
      this.confirmationResolver = resolve;

      const modal = createModal({
        title,
        isOpen: true,
        size: 'sm',
        showThemeToggle: false,
        onClose: () => {
          this.closeModal();
          resolve(false);
        },
        children: modalContent,
      });

      this.showModal(modal);
    });
  }

  private confirmationResolver?: (value: boolean) => void;

  /**
   * Resolve confirmation modal
   */
  public resolveConfirmation(result: boolean): void {
    if (this.confirmationResolver) {
      this.confirmationResolver(result);
      this.confirmationResolver = undefined;
    }
  }
}
