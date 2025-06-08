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

  constructor(offlineManager: OfflineMapManager) {
    this.offlineManager = offlineManager;
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

    styleElement.textContent = generateCSSCustomProperties(theme);
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.style.position = 'relative';
    this.button.innerHTML = icons.mapPin({ size: 20, color: '#333' });
    this.button.title = 'Offline Map Manager';

    this.progressBadge = document.createElement('span');
    this.progressBadge.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      background: #007bff;
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: bold;
      display: none;
      min-width: 16px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    this.button.appendChild(this.progressBadge);

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      top: 40px;
      right: 0;
      width: 400px;
      max-height: 600px;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      display: none;
      z-index: 1000;
      overflow: hidden;
      font-family: var(--font-family);
    `;

    this.button.addEventListener('click', this.togglePanel.bind(this));
    this.container.appendChild(this.button);
    this.container.appendChild(this.panel);

    // Make methods available globally for onclick handlers
    (window as any).offlineManagerControl = this;

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.map = undefined;
    delete (window as any).offlineManagerControl;
  }

  private togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.panel) {
      this.panel.style.display = this.isOpen ? 'block' : 'none';
      if (this.isOpen) {
        this.renderPanel();
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
        this.offlineManager.getComprehensiveStorageAnalytics()
      ]);

      const header = createHeader({
        title: 'Offline Regions',
        subtitle: `${regions.length} regions • ${formatBytes(analytics.totalStorageSize)} total`,
        onClose: () => this.closePanel(),
        onToggleTheme: () => {
          themeManager.toggleTheme();
          this.applyGlobalStyles();
          this.renderPanel();
        }
      });

      const actionButtons = createActionButtons({
        onAddRegion: () => this.showSimpleAddForm(),
        onRefresh: () => this.renderPanel(),
      });

      let downloadProgressSection = '';
      if (this.currentDownloads.size > 0) {
        const progressElement = createDownloadProgressSection({
          downloads: this.currentDownloads
        });
        downloadProgressSection = progressElement.outerHTML;
      }

      const regionsList = createRegionsList({
        regions,
        onFocusRegion: (regionId: string) => this.focusRegion(regionId),
        onDeleteRegion: (regionId: string) => this.deleteRegion(regionId),
        onShowRegionDetails: (regionId: string) => this.showRegionDetails(regionId),
        formatBytes,
      });

      this.panel.innerHTML = `
        ${header}
        ${actionButtons}
        ${downloadProgressSection}
        ${regionsList}
      `;

    } catch (error) {
      console.error('Error rendering panel:', error);
      this.panel.innerHTML = `
        <div style="padding: var(--spacing-md); text-align: center; color: var(--color-danger);">
          <p>Error loading offline regions</p>
          <button onclick="offlineManagerControl.renderPanel()" style="margin-top: var(--spacing-sm);">
            Retry
          </button>
        </div>
      `;
    }
  }

  private showSimpleAddForm(): void {
    if (!this.map || !this.panel) return;

    const bounds = this.map.getBounds();
    
    this.panel.innerHTML = `
      <div style="padding: var(--spacing-lg);">
        <h3 style="margin: 0 0 var(--spacing-md) 0;">Add New Region</h3>
        
        <div style="margin-bottom: var(--spacing-md);">
          <label style="display: block; margin-bottom: var(--spacing-xs);">Region Name:</label>
          <input type="text" id="region-name" placeholder="Enter region name..." 
                 style="width: 100%; padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-md);">
          <div>
            <label style="display: block; margin-bottom: var(--spacing-xs);">Min Zoom:</label>
            <input type="number" id="min-zoom" value="1" min="0" max="22" 
                   style="width: 100%; padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
          </div>
          <div>
            <label style="display: block; margin-bottom: var(--spacing-xs);">Max Zoom:</label>
            <input type="number" id="max-zoom" value="14" min="0" max="22" 
                   style="width: 100%; padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
          </div>
        </div>
        
        <div style="display: flex; gap: var(--spacing-sm);">
          <button onclick="offlineManagerControl.renderPanel()" 
                  style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-secondary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
            Cancel
          </button>
          <button onclick="offlineManagerControl.handleRegionSave()" 
                  style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
            Download
          </button>
        </div>
      </div>
    `;
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
      bounds.getNorth()
    ];

    try {
      // Show loading state
      if (this.panel) {
        this.panel.innerHTML = `
          <div style="padding: var(--spacing-lg); text-align: center;">
            <p>Starting download...</p>
          </div>
        `;
      }

      // Start the download
      await this.offlineManager.addRegion({
        id: Date.now().toString(), // Generate unique ID
        name: regionName,
        bounds: [
          [boundsArray[0], boundsArray[1]], // [west, south]
          [boundsArray[2], boundsArray[3]]  // [east, north]
        ],
        minZoom,
        maxZoom,
        styleUrl: this.map.getStyle().sources ? 
          (this.map.getStyle() as any).metadata?.['mapbox:origin'] || 
          'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' :
          'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
      });

      // Initialize progress tracking (simulated for now)
      const regionId = Date.now().toString();
      this.currentDownloads.set(regionId, {
        regionId,
        completed: 0,
        total: 100,
        percentage: 0,
        currentResource: 'Download started...'
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
      currentResource: progress.currentResource || 'Processing...'
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
          [region.bounds[1][0], region.bounds[1][1]]  // northeast
        );
        
        this.map.fitBounds(lngLatBounds, {
          padding: 50,
          duration: 1000
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
      
      if (!region || !this.panel) {
        alert('Region not found');
        return;
      }

      const regionSize = await this.offlineManager.getRegionSize(regionId);
      
      this.panel.innerHTML = `
        <div style="padding: var(--spacing-lg);">
          <h3 style="margin: 0 0 var(--spacing-md) 0;">${region.name || 'Unnamed Region'}</h3>
          
          <div style="margin-bottom: var(--spacing-md);">
            <strong>Storage Size:</strong> ${formatBytes(regionSize)}
          </div>
          
          <div style="margin-bottom: var(--spacing-md);">
            <strong>Zoom Levels:</strong> ${region.minZoom || 'N/A'} - ${region.maxZoom || 'N/A'}
          </div>
          
          <div style="margin-bottom: var(--spacing-md);">
            <strong>Created:</strong> ${region.created ? formatDate(region.created) : 'Unknown'}
          </div>
          
          ${region.bounds ? `
            <div style="margin-bottom: var(--spacing-md);">
              <strong>Bounds:</strong><br>
              <small style="font-family: monospace;">
                SW: [${region.bounds[0][0].toFixed(6)}, ${region.bounds[0][1].toFixed(6)}]<br>
                NE: [${region.bounds[1][0].toFixed(6)}, ${region.bounds[1][1].toFixed(6)}]
              </small>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: var(--spacing-sm);">
            <button onclick="offlineManagerControl.renderPanel()" 
                    style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-secondary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
              Back
            </button>
            <button onclick="offlineManagerControl.focusRegion('${regionId}')" 
                    style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
              Focus
            </button>
            <button onclick="offlineManagerControl.deleteRegion('${regionId}')" 
                    style="padding: var(--spacing-sm) var(--spacing-md); background: var(--color-danger); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">
              Delete
            </button>
          </div>
        </div>
      `;

    } catch (error) {
      console.error('Error showing region details:', error);
      alert('Error loading region details: ' + (error as Error).message);
    }
  }
}
