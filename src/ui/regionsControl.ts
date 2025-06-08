import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import type { StoredRegion } from '../types';

export class RegionsControl implements IControl {
  private map: MaplibreMap | undefined;
  private container: HTMLDivElement | undefined;
  private button: HTMLButtonElement | undefined;
  private panel: HTMLDivElement | undefined;
  private backdrop: HTMLDivElement | undefined;
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

    // Create the panel as a centered modal
    this.panel = document.createElement('div');
    this.panel.className = 'regions-panel';
    this.panel.style.position = 'fixed';
    this.panel.style.top = '50%';
    this.panel.style.left = '50%';
    this.panel.style.transform = 'translate(-50%, -50%)';
    this.panel.style.background = 'white';
    this.panel.style.border = '1px solid #ccc';
    this.panel.style.borderRadius = '8px';
    this.panel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    this.panel.style.padding = '20px';
    this.panel.style.minWidth = '400px';
    this.panel.style.maxWidth = '500px';
    this.panel.style.maxHeight = '70vh';
    this.panel.style.overflowY = 'auto';
    this.panel.style.display = 'none';
    this.panel.style.zIndex = '10000';
    this.panel.style.backdropFilter = 'blur(5px)';

    // Create backdrop overlay
    const backdrop = document.createElement('div');
    backdrop.className = 'regions-modal-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.width = '100%';
    backdrop.style.height = '100%';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '9999';
    backdrop.style.display = 'none';

    // Close modal when clicking backdrop
    backdrop.addEventListener('click', () => {
      this.closePanel();
    });

    this.backdrop = backdrop;

    this.button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePanel();
    });

    this.container.appendChild(this.button);

    // Append backdrop and panel to document body for modal behavior
    document.body.appendChild(backdrop);
    document.body.appendChild(this.panel);

    return this.container;
  }

  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
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
    if (!this.panel || !this.backdrop) return;

    this.isOpen = true;
    this.backdrop.style.display = 'block';
    this.panel.style.display = 'block';

    // Load and display regions
    await this.loadRegions();
  }

  public closePanel(): void {
    if (!this.panel || !this.backdrop) return;

    this.isOpen = false;
    this.backdrop.style.display = 'none';
    this.panel.style.display = 'none';
  }

  private async loadRegions(): Promise<void> {
    if (!this.panel) return;

    try {
      this.panel.innerHTML =
        '<div style="text-align: center; padding: 10px;">Loading regions...</div>';

      const regions = await this.offlineManager.listStoredRegions();
      const analytics = await this.offlineManager.getComprehensiveStorageAnalytics();

      if (regions.length === 0) {
        this.panel.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
            <h3 style="margin: 0; font-size: 18px; color: #333; font-weight: 600;">Downloaded Regions</h3>
            <button onclick="regionsControl.closePanel()" 
                    style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;">
              ×
            </button>
          </div>
          <div style="text-align: center; color: #666; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 15px;">📱</div>
            <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #333;">No Downloaded Regions</h4>
            <p style="margin: 0; font-size: 14px;">Download a region to see it here</p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
          <div>
            <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #333; font-weight: 600;">Downloaded Regions (${regions.length})</h3>
            <div style="font-size: 13px; color: #666;">
              Total Storage: ${this.formatBytes(analytics.totalStorageSize)}
            </div>
          </div>
          <button onclick="regionsControl.closePanel()" 
                  style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ×
          </button>
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
          <div style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 12px; padding: 15px; background: ${isExpired ? '#fff5f5' : '#f9f9f9'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <strong style="font-size: 14px; color: #333; font-weight: 600;">${region.name || region.id}</strong>
              <button onclick="regionsControl.focusRegion('${region.id}')" 
                      style="background: #007bff; color: white; border: none; border-radius: 5px; padding: 5px 10px; font-size: 11px; cursor: pointer; font-weight: 500;">
                Focus
              </button>
            </div>
            <div style="font-size: 12px; color: #666; line-height: 1.4; margin-bottom: 10px;">
              <div style="margin-bottom: 3px;">📍 Zoom: ${region.minZoom}-${region.maxZoom}</div>
              <div style="margin-bottom: 3px;">💾 Size: ${this.formatBytes(regionSize)}</div>
              <div style="color: ${isExpired ? '#d63384' : '#666'}">⏰ ${expiryText}</div>
              ${isExpired ? '<div style="color: #d63384; font-weight: bold; margin-top: 5px;">⚠️ EXPIRED</div>' : ''}
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="regionsControl.deleteRegion('${region.id}')" 
                      style="background: #dc3545; color: white; border: none; border-radius: 5px; padding: 5px 12px; font-size: 11px; cursor: pointer; font-weight: 500;">
                Delete
              </button>
              <button onclick="regionsControl.showRegionDetails('${region.id}')" 
                      style="background: #6c757d; color: white; border: none; border-radius: 5px; padding: 5px 12px; font-size: 11px; cursor: pointer; font-weight: 500;">
                Details
              </button>
            </div>
          </div>
        `;
      }

      // Add cleanup button
      html += `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #e0e0e0;">
          <button onclick="regionsControl.cleanupExpired()" 
                  style="background: #fd7e14; color: white; border: none; border-radius: 6px; padding: 10px 15px; font-size: 13px; cursor: pointer; width: 100%; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            🧹 Cleanup Expired Regions
          </button>
        </div>
      `;

      this.panel.innerHTML = html;
    } catch (error) {
      console.error('Error loading regions:', error);
      this.panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
          <h3 style="margin: 0; font-size: 18px; color: #333; font-weight: 600;">Error</h3>
          <button onclick="regionsControl.closePanel()" 
                  style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ×
          </button>
        </div>
        <div style="text-align: center; color: #d63384; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
          <h4 style="margin: 0 0 10px 0; font-size: 16px;">Error Loading Regions</h4>
          <p style="margin: 0; font-size: 14px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
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
      alert(
        `Error loading region details: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
