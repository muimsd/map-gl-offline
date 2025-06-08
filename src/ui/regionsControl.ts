import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import type { StoredRegion } from '../types/region';

export class RegionsControl implements IControl {
  private map: MaplibreMap | undefined;
  private container: HTMLDivElement | undefined;
  private button: HTMLButtonElement | undefined;
  private panel: HTMLDivElement | undefined;
  private isOpen = false;
  private offlineManager: OfflineMapManager;

  constructor(offlineManager: OfflineMapManager) {
    this.offlineManager = offlineManager;
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.position = 'relative';

    // Create the button
    this.button = document.createElement('button');
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'View Downloaded Regions');
    this.button.innerHTML = '📱'; // Using emoji icon, can be replaced with SVG
    this.button.style.fontSize = '16px';
    this.button.style.background = 'none';
    this.button.style.border = 'none';
    this.button.style.cursor = 'pointer';
    this.button.style.width = '29px';
    this.button.style.height = '29px';
    this.button.style.display = 'flex';
    this.button.style.alignItems = 'center';
    this.button.style.justifyContent = 'center';

    // Create the panel
    this.panel = document.createElement('div');
    this.panel.className = 'regions-panel';
    this.panel.style.position = 'absolute';
    this.panel.style.top = '0';
    this.panel.style.right = '35px';
    this.panel.style.background = 'white';
    this.panel.style.border = '1px solid #ccc';
    this.panel.style.borderRadius = '4px';
    this.panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    this.panel.style.padding = '10px';
    this.panel.style.minWidth = '300px';
    this.panel.style.maxWidth = '400px';
    this.panel.style.maxHeight = '400px';
    this.panel.style.overflowY = 'auto';
    this.panel.style.display = 'none';
    this.panel.style.zIndex = '1000';

    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePanel();
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.container && !this.container.contains(e.target as Node)) {
        this.closePanel();
      }
    });

    this.container.appendChild(this.button);
    this.container.appendChild(this.panel);

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.map = undefined;
  }

  private async togglePanel(): Promise<void> {
    if (this.isOpen) {
      this.closePanel();
    } else {
      await this.openPanel();
    }
  }

  private async openPanel(): Promise<void> {
    if (!this.panel) return;
    
    this.isOpen = true;
    this.panel.style.display = 'block';
    
    // Load and display regions
    await this.loadRegions();
  }

  private closePanel(): void {
    if (!this.panel) return;
    
    this.isOpen = false;
    this.panel.style.display = 'none';
  }

  private async loadRegions(): Promise<void> {
    if (!this.panel) return;

    try {
      this.panel.innerHTML = '<div style="text-align: center; padding: 10px;">Loading regions...</div>';
      
      const regions = await this.offlineManager.listStoredRegions();
      const analytics = await this.offlineManager.getComprehensiveStorageAnalytics();
      
      if (regions.length === 0) {
        this.panel.innerHTML = `
          <div style="text-align: center; color: #666;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px;">No Downloaded Regions</h3>
            <p style="margin: 0; font-size: 12px;">Download a region to see it here</p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Downloaded Regions (${regions.length})</h3>
          <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
            Total Storage: ${this.formatBytes(analytics.totalStorageSize)}
          </div>
        </div>
      `;

      for (const region of regions) {
        const isExpired = region.expiry && Date.now() > region.expiry;
        const expiryText = region.expiry 
          ? `Expires: ${new Date(region.expiry).toLocaleDateString()}`
          : 'No expiry';

        // Get region size dynamically
        const regionSize = await this.offlineManager.getRegionSize(region.id);

        html += `
          <div style="border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px; padding: 8px; background: ${isExpired ? '#fff5f5' : '#f9f9f9'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
              <strong style="font-size: 12px; color: #333;">${region.name || region.id}</strong>
              <button onclick="regionsControl.focusRegion('${region.id}')" 
                      style="background: #007bff; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
                Focus
              </button>
            </div>
            <div style="font-size: 10px; color: #666; line-height: 1.3;">
              <div>Zoom: ${region.minZoom}-${region.maxZoom}</div>
              <div>Size: ${this.formatBytes(regionSize)}</div>
              <div style="color: ${isExpired ? '#d63384' : '#666'}">${expiryText}</div>
              ${isExpired ? '<div style="color: #d63384; font-weight: bold;">EXPIRED</div>' : ''}
            </div>
            <div style="margin-top: 5px;">
              <button onclick="regionsControl.deleteRegion('${region.id}')" 
                      style="background: #dc3545; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; margin-right: 5px;">
                Delete
              </button>
              <button onclick="regionsControl.showRegionDetails('${region.id}')" 
                      style="background: #6c757d; color: white; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
                Details
              </button>
            </div>
          </div>
        `;
      }

      // Add cleanup button
      html += `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
          <button onclick="regionsControl.cleanupExpired()" 
                  style="background: #fd7e14; color: white; border: none; border-radius: 3px; padding: 5px 10px; font-size: 11px; cursor: pointer; width: 100%;">
            Cleanup Expired Regions
          </button>
        </div>
      `;

      this.panel.innerHTML = html;
    } catch (error) {
      console.error('Error loading regions:', error);
      this.panel.innerHTML = `
        <div style="text-align: center; color: #d63384;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px;">Error Loading Regions</h3>
          <p style="margin: 0; font-size: 12px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Public methods for button callbacks
  public async focusRegion(regionId: string): Promise<void> {
    if (!this.map) return;
    
    try {
      const region = await this.offlineManager.getStoredRegion(regionId);
      if (region && region.bounds) {
        this.map.fitBounds(region.bounds, { padding: 50 });
      }
    } catch (error) {
      console.error('Error focusing region:', error);
    }
  }

  public async deleteRegion(regionId: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete region "${regionId}"?`)) {
      return;
    }

    try {
      await this.offlineManager.deleteRegion(regionId);
      await this.loadRegions(); // Refresh the list
    } catch (error) {
      console.error('Error deleting region:', error);
      alert(`Error deleting region: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async showRegionDetails(regionId: string): Promise<void> {
    try {
      const region = await this.offlineManager.getStoredRegion(regionId);
      if (!region) {
        alert('Region not found');
        return;
      }

      const regionSize = await this.offlineManager.getRegionSize(regionId);

      const details = `
Region Details:
- ID: ${region.id}
- Name: ${region.name || 'N/A'}
- Bounds: ${JSON.stringify(region.bounds)}
- Zoom: ${region.minZoom} - ${region.maxZoom}
- Size: ${this.formatBytes(regionSize)}
- Created: ${region.created ? new Date(region.created).toLocaleString() : 'N/A'}
- Last Modified: ${region.lastModified ? new Date(region.lastModified).toLocaleString() : 'N/A'}
- Expires: ${region.expiry ? new Date(region.expiry).toLocaleString() : 'Never'}
- Style ID: ${region.styleId || 'N/A'}
- Delete on Expiry: ${region.deleteOnExpiry ? 'Yes' : 'No'}
      `.trim();

      alert(details);
    } catch (error) {
      console.error('Error showing region details:', error);
      alert(`Error loading region details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async cleanupExpired(): Promise<void> {
    if (!confirm('Are you sure you want to cleanup all expired regions?')) {
      return;
    }

    try {
      const cleanedCount = await this.offlineManager.cleanupExpiredRegions();
      alert(`Cleaned up ${cleanedCount} expired regions`);
      await this.loadRegions(); // Refresh the list
    } catch (error) {
      console.error('Error cleaning up expired regions:', error);
      alert(`Error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method to refresh the regions list (can be called externally)
  public async refresh(): Promise<void> {
    if (this.isOpen) {
      await this.loadRegions();
    }
  }
}
