import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import { icons } from '../utils/icons';
import { themeManager, generateCSSCustomProperties } from './themes';
import { createHeader } from './header';
import { createActionButtons } from './actionButtons';
import { createDownloadProgressSection } from './downloadProgress';
import { createRegionsList } from './regionsList';
import { createButton, createInput, createModal } from './components';
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
        title: 'Offline Regions',
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
    if (!this.map) return;

    const bounds = this.map.getBounds();

    const modalContent = `
      <div style="margin-bottom: var(--theme-spacing-md);">
        <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold);">Region Name:</label>
        <input type="text" id="region-name" placeholder="Enter region name..." 
               style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm);">
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--theme-spacing-sm); margin-bottom: var(--theme-spacing-lg);">
        <div>
          <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold);">Min Zoom:</label>
          <input type="number" id="min-zoom" value="1" min="0" max="22" 
                 style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm);">
        </div>
        <div>
          <label style="display: block; margin-bottom: var(--theme-spacing-xs); font-weight: var(--theme-font-weight-semibold);">Max Zoom:</label>
          <input type="number" id="max-zoom" value="14" min="0" max="22" 
                 style="width: 100%; padding: var(--theme-spacing-sm); border: 1px solid var(--theme-border); border-radius: var(--theme-radius-sm); font-size: var(--theme-font-size-sm);">
        </div>
      </div>
      
      <div style="display: flex; gap: var(--theme-spacing-sm); justify-content: flex-end;">
        <button onclick="offlineManagerControl.closeModal()" 
                style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-text-muted); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
          Cancel
        </button>
        <button onclick="offlineManagerControl.handleRegionSave()" 
                style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-primary); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
          Download Region
        </button>
      </div>
    `;

    const modal = createModal({
      title: 'Add New Offline Region',
      subtitle: 'Define the area and zoom levels to download for offline use',
      isOpen: true,
      size: 'md',
      showThemeToggle: true,
      onClose: () => this.closeModal(),
      onThemeToggle: () => {
        themeManager.toggleTheme();
        this.renderPanel(); // Re-render panel to reflect theme change
      },
      children: modalContent,
    });

    this.showModal(modal);
  }

  public async handleRegionSave(): Promise<void> {
    const nameInput = document.getElementById('region-name') as HTMLInputElement;
    const minZoomInput = document.getElementById('min-zoom') as HTMLInputElement;
    const maxZoomInput = document.getElementById('max-zoom') as HTMLInputElement;

    if (!nameInput?.value.trim() || !this.map) {
      alert('Please enter a region name');
      return;
    }

    const regionName = nameInput.value.trim();
    const minZoom = parseInt(minZoomInput?.value || '1');
    const maxZoom = parseInt(maxZoomInput?.value || '14');

    // Convert LngLatBounds to the expected tuple format
    const bounds = this.map.getBounds();
    const boundsArray: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    try {
      // Close modal and show loading state
      this.closeModal();

      if (this.panel) {
        this.panel.innerHTML = `
          <div style="
            height: 100%;
            display: flex;
            flex-direction: column;
            background: var(--theme-surface);
            border-radius: var(--theme-radius-xl);
            overflow: hidden;
          ">
            <div style="
              background: linear-gradient(135deg, var(--theme-info) 0%, var(--theme-info-hover) 100%);
              color: var(--theme-text-inverse);
              padding: var(--theme-spacing-lg);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="text-align: center;">
                <h2 style="margin: 0; font-size: var(--theme-font-size-lg); font-weight: var(--theme-font-weight-bold);">
                  Downloading Region...
                </h2>
                <p style="margin: var(--theme-spacing-xs) 0 0 0; opacity: 0.9; font-size: var(--theme-font-size-sm);">
                  Please wait while we download the map tiles
                </p>
              </div>
            </div>
            <div style="
              flex: 1;
              padding: var(--theme-spacing-lg);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="text-align: center;">
                <div style="
                  width: 40px;
                  height: 40px;
                  border: 3px solid var(--theme-border-light);
                  border-top: 3px solid var(--theme-primary);
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                  margin: 0 auto var(--theme-spacing-lg) auto;
                "></div>
                <p style="color: var(--theme-text-secondary); margin: 0;">Starting download...</p>
              </div>
            </div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
      }

      // Start the download
      await this.offlineManager.addRegion({
        id: Date.now().toString(), // Generate unique ID
        name: regionName,
        bounds: [
          [boundsArray[0], boundsArray[1]], // [west, south]
          [boundsArray[2], boundsArray[3]], // [east, north]
        ],
        minZoom,
        maxZoom,
        styleUrl: this.map.getStyle().sources
          ? (this.map.getStyle() as any).metadata?.['mapbox:origin'] ||
            'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
          : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      });

      // Initialize progress tracking (simulated for now)
      const regionId = Date.now().toString();
      this.currentDownloads.set(regionId, {
        regionId,
        completed: 0,
        total: 100,
        percentage: 0,
        currentResource: 'Download started...',
      });

      this.updateProgressBadge();

      // Simulate completion after a delay
      setTimeout(() => {
        this.currentDownloads.delete(regionId);
        this.updateProgressBadge();
        if (this.isOpen) {
          this.renderPanel();
        }
      }, 3000);

      this.renderPanel();
    } catch (error) {
      console.error('Error downloading region:', error);
      alert('Error downloading region: ' + (error as Error).message);
      this.renderPanel();
    }
  }

  private updateDownloadProgress(regionId: string, progress: any): void {
    const downloadProgress: DownloadProgress = {
      regionId,
      completed: progress.completed || 0,
      total: progress.total || 0,
      percentage: progress.percentage || 0,
      currentResource: progress.currentResource || 'Processing...',
    };

    this.currentDownloads.set(regionId, downloadProgress);
    this.updateProgressBadge();

    if (this.isOpen) {
      this.renderPanel();
    }

    // Remove from tracking when complete
    if (progress.percentage >= 100) {
      setTimeout(() => {
        this.currentDownloads.delete(regionId);
        this.updateProgressBadge();
        if (this.isOpen) {
          this.renderPanel();
        }
      }, 2000);
    }
  }

  private updateProgressBadge(): void {
    if (!this.progressBadge) return;

    const activeDownloads = this.currentDownloads.size;

    if (activeDownloads > 0) {
      this.progressBadge.textContent = activeDownloads.toString();
      this.progressBadge.style.display = 'block';
    } else {
      this.progressBadge.style.display = 'none';
    }
  }

  public async focusRegion(regionId: string): Promise<void> {
    if (!this.map) return;

    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find(r => r.id === regionId);

      if (region && region.bounds) {
        // Create LngLatBounds from the stored bounds
        // bounds format: [[west, south], [east, north]]
        const lngLatBounds = new (window as any).maplibregl.LngLatBounds(
          [region.bounds[0][0], region.bounds[0][1]], // southwest
          [region.bounds[1][0], region.bounds[1][1]] // northeast
        );

        this.map.fitBounds(lngLatBounds, {
          padding: 50,
          duration: 1000,
        });

        this.closePanel();
      }
    } catch (error) {
      console.error('Error focusing region:', error);
    }
  }

  public async deleteRegion(regionId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this region? This cannot be undone.')) {
      return;
    }

    try {
      await this.offlineManager.deleteRegion(regionId);
      this.renderPanel();
    } catch (error) {
      console.error('Error deleting region:', error);
      alert('Error deleting region: ' + (error as Error).message);
    }
  }

  public async showRegionDetails(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find(r => r.id === regionId);

      if (!region) {
        alert('Region not found');
        return;
      }

      const regionSize = await this.offlineManager.getRegionSize(regionId);

      const modalContent = `
        <div style="margin-bottom: var(--theme-spacing-md);">
          <strong style="color: var(--theme-text);">Storage Size:</strong> 
          <span style="color: var(--theme-text-secondary);">${formatBytes(regionSize)}</span>
        </div>
        
        <div style="margin-bottom: var(--theme-spacing-md);">
          <strong style="color: var(--theme-text);">Zoom Levels:</strong> 
          <span style="color: var(--theme-text-secondary);">${region.minZoom || 'N/A'} - ${region.maxZoom || 'N/A'}</span>
        </div>
        
        <div style="margin-bottom: var(--theme-spacing-md);">
          <strong style="color: var(--theme-text);">Created:</strong> 
          <span style="color: var(--theme-text-secondary);">${region.created ? formatDate(region.created) : 'Unknown'}</span>
        </div>
        
        ${
          region.bounds
            ? `
          <div style="margin-bottom: var(--theme-spacing-lg);">
            <strong style="color: var(--theme-text);">Bounds:</strong><br>
            <small style="font-family: monospace; color: var(--theme-text-secondary); margin-top: var(--theme-spacing-xs); display: block;">
              SW: [${region.bounds[0][0].toFixed(6)}, ${region.bounds[0][1].toFixed(6)}]<br>
              NE: [${region.bounds[1][0].toFixed(6)}, ${region.bounds[1][1].toFixed(6)}]
            </small>
          </div>
        `
            : ''
        }
        
        <div style="display: flex; gap: var(--theme-spacing-sm); justify-content: flex-end;">
          <button onclick="offlineManagerControl.focusRegion('${regionId}')" 
                  style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-primary); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
            Focus on Map
          </button>
          <button onclick="offlineManagerControl.deleteRegion('${regionId}')" 
                  style="padding: var(--theme-spacing-sm) var(--theme-spacing-md); background: var(--theme-error); color: var(--theme-text-inverse); border: none; border-radius: var(--theme-radius-sm); cursor: pointer; font-size: var(--theme-font-size-sm);">
            Delete Region
          </button>
        </div>
      `;

      const modal = createModal({
        title: region.name || 'Unnamed Region',
        subtitle: `Region details and management options`,
        isOpen: true,
        size: 'md',
        showThemeToggle: true,
        onClose: () => this.closeModal(),
        onThemeToggle: () => {
          themeManager.toggleTheme();
          this.renderPanel(); // Re-render panel to reflect theme change
        },
        children: modalContent,
      });

      this.showModal(modal);
    } catch (error) {
      console.error('Error showing region details:', error);
      alert('Error loading region details: ' + (error as Error).message);
    }
  }

  private handlePanelClick(event: Event): void {
    // Event delegation for panel clicks - prevent event bubbling issues
    const target = event.target as HTMLElement;
    
    // Handle button clicks based on data attributes or classes
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      const button = target.tagName === 'BUTTON' ? target : target.closest('button');
      if (button) {
        // Let the onclick handlers work as they are
        return;
      }
    }
  }
}
