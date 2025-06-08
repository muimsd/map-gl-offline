import type { IControl, Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import { area, bboxPolygon, difference, convertArea } from '@turf/turf';
import { featureCollection, polygon } from '@turf/helpers';
import { OfflineMapManager } from '../managers/offlineMapManager';
import type { StoredRegion, DownloadOptions } from '../types';

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
  private isDrawing = false;
  private currentRegionArea = 0;
  private currentDownloads: Map<string, DownloadProgress> = new Map();
  private offlineManager: OfflineMapManager;

  constructor(offlineManager: OfflineMapManager) {
    this.offlineManager = offlineManager;
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this.container.style.position = 'relative';    // Create the main button with progress indicator
    this.createMainButton();
    
    // Create the modal panel
    this.createModalPanel();
    
    // Set up event listeners
    this.setupEventListeners();

    this.container.appendChild(this.button!);

    // Append panel to document body for modal behavior
    document.body.appendChild(this.panel!);

    return this.container;
  }

  private createMainButton(): void {
    this.button = document.createElement('button');
    this.button.className = 'maplibregl-ctrl-icon';
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'Offline Map Manager');
    this.button.style.background = 'white';
    this.button.style.border = 'none';
    this.button.style.cursor = 'pointer';
    this.button.style.width = '29px';
    this.button.style.height = '29px';
    this.button.style.display = 'flex';
    this.button.style.alignItems = 'center';
    this.button.style.justifyContent = 'center';
    this.button.style.position = 'relative';
    this.button.style.borderRadius = '2px';

    // Main icon
    const icon = document.createElement('span');
    icon.innerHTML = '📱';
    icon.style.fontSize = '16px';
    this.button.appendChild(icon);

    // Progress badge
    this.progressBadge = document.createElement('span');
    this.progressBadge.style.position = 'absolute';
    this.progressBadge.style.top = '-5px';
    this.progressBadge.style.right = '-5px';
    this.progressBadge.style.background = '#dc3545';
    this.progressBadge.style.color = 'white';
    this.progressBadge.style.borderRadius = '10px';
    this.progressBadge.style.fontSize = '10px';
    this.progressBadge.style.fontWeight = 'bold';
    this.progressBadge.style.padding = '2px 6px';
    this.progressBadge.style.minWidth = '18px';
    this.progressBadge.style.textAlign = 'center';
    this.progressBadge.style.display = 'none';
    this.progressBadge.style.zIndex = '1';
    this.button.appendChild(this.progressBadge);
  }

  private createModalPanel(): void {
    this.panel = document.createElement('div');
    this.panel.className = 'offline-manager-panel';
    this.panel.style.position = 'fixed';
    this.panel.style.top = '50%';
    this.panel.style.left = '50%';
    this.panel.style.transform = 'translate(-50%, -50%)';
    this.panel.style.background = 'white';
    this.panel.style.border = '1px solid #ccc';
    this.panel.style.borderRadius = '12px';
    this.panel.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
    this.panel.style.padding = '0';
    this.panel.style.minWidth = '500px';
    this.panel.style.maxWidth = '600px';
    this.panel.style.maxHeight = '80vh';
    this.panel.style.overflowY = 'auto';
    this.panel.style.display = 'none';
    this.panel.style.zIndex = '10000';
    this.panel.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  }

  private setupEventListeners(): void {
    this.button!.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePanel();
    });

    // Make methods available globally for button callbacks
    (window as any).offlineManagerControl = this;
  }  onRemove(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    this.map = undefined;
    
    // Clean up global reference
    delete (window as any).offlineManagerControl;
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

    await this.renderPanel();
  }

  public closePanel(): void {
    if (!this.panel) return;

    this.isOpen = false;
    this.panel.style.display = 'none';

    // Stop drawing mode if active
    if (this.isDrawing) {
      this.stopDrawing();
    }
  }

  private async renderPanel(): Promise<void> {
    if (!this.panel) return;

    try {
      this.panel.innerHTML = '<div style="text-align: center; padding: 40px;">Loading...</div>';

      const regions = await this.offlineManager.listStoredRegions();
      const analytics = await this.offlineManager.getComprehensiveStorageAnalytics();

      const html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700;">Offline Map Manager</h2>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">${regions.length} regions • ${this.formatBytes(analytics.totalStorageSize)} total</p>
            </div>
            <button onclick="offlineManagerControl.closePanel()" 
                    style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; backdrop-filter: blur(10px);">
              ×
            </button>
          </div>
        </div>

        <div style="padding: 20px;">
          <!-- Action Buttons -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <button onclick="offlineManagerControl.startDrawing()" 
                    style="background: linear-gradient(135deg, #42e695 0%, #3bb2b8 100%); color: white; border: none; border-radius: 8px; padding: 14px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s;">
              <span>📍</span> Add New Region
            </button>
            <button onclick="offlineManagerControl.cleanupExpired()" 
                    style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; border: none; border-radius: 8px; padding: 14px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s;">
              <span>🧹</span> Cleanup
            </button>
          </div>

          <!-- Current Drawing Area (if drawing) -->
          ${this.isDrawing ? this.renderDrawingArea() : ''}

          <!-- Active Downloads -->
          ${this.renderActiveDownloads()}

          <!-- Regions List -->
          <div style="margin-top: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">Downloaded Regions</h3>
            ${this.renderRegionsList(regions)}
          </div>
        </div>
      `;

      this.panel.innerHTML = html;
    } catch (error) {
      console.error('Error rendering panel:', error);
      this.panel.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <h3 style="color: #dc3545; margin-bottom: 16px;">Error Loading Data</h3>
          <p style="color: #666; margin-bottom: 20px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onclick="offlineManagerControl.renderPanel()" 
                  style="background: #007bff; color: white; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
    }
  }

  private renderDrawingArea(): string {
    return `
      <div style="background: #e8f5e8; border: 2px dashed #28a745; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; color: #155724; font-size: 16px; font-weight: 600;">🎯 Drawing Mode Active</h4>
          <button onclick="offlineManagerControl.stopDrawing()" 
                  style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">
            Cancel
          </button>
        </div>
        <p style="margin: 0 0 8px 0; color: #155724; font-size: 14px;">Pan and zoom to select your desired area, then click download.</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #155724; font-weight: 600;">Area: ${this.currentRegionArea} km²</span>
          <button onclick="offlineManagerControl.downloadCurrentRegion()" 
                  style="background: #28a745; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer;">
            📥 Download Region
          </button>
        </div>
      </div>
    `;
  }

  private renderActiveDownloads(): string {
    if (this.currentDownloads.size === 0) return '';

    let html = `
      <div style="background: #e3f2fd; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px; font-weight: 600;">⬇️ Active Downloads</h4>
    `;

    for (const [regionId, progress] of this.currentDownloads) {
      html += `
        <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600; color: #333;">${regionId}</span>
            <span style="font-weight: 600; color: #1565c0;">${progress.percentage}%</span>
          </div>
          <div style="background: #e0e0e0; border-radius: 10px; height: 8px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #42a5f5, #1e88e5); height: 100%; width: ${progress.percentage}%; transition: width 0.3s;"></div>
          </div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${progress.currentResource}</div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  private renderRegionsList(regions: StoredRegion[]): string {
    if (regions.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
          <h4 style="margin: 0 0 8px 0;">No Downloaded Regions</h4>
          <p style="margin: 0; font-size: 14px;">Add a new region to get started</p>
        </div>
      `;
    }

    let html = '<div style="display: grid; gap: 12px;">';

    for (const region of regions) {
      const isExpired = region.expiry && Date.now() > region.expiry;
      html += `
        <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background: ${isExpired ? '#fff5f5' : 'white'}; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #333;">${region.name || region.id}</h4>
              <div style="font-size: 13px; color: #666;">
                <span>📍 Zoom ${region.minZoom}-${region.maxZoom}</span>
                <span style="margin-left: 12px;">⏰ ${region.expiry ? new Date(region.expiry).toLocaleDateString() : 'No expiry'}</span>
              </div>
            </div>
            <button onclick="offlineManagerControl.focusRegion('${region.id}')" 
                    style="background: #f8f9fa; color: #333; border: 1px solid #dee2e6; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 500;">
              Focus on map
            </button>
          </div>
          
          ${isExpired ? '<div style="background: #f8d7da; color: #721c24; padding: 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 12px;">⚠️ EXPIRED</div>' : ''}
          
          <div style="display: flex; gap: 8px;">
            <button onclick="offlineManagerControl.deleteRegion('${region.id}')" 
                    style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; cursor: pointer; font-weight: 500;">
              🗑️ Delete
            </button>
            <button onclick="offlineManagerControl.showRegionDetails('${region.id}')" 
                    style="background: #6c757d; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; cursor: pointer; font-weight: 500;">
              📊 Details
            </button>
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  public startDrawing(): void {
    if (!this.map) return;

    this.isDrawing = true;
    this.closePanel();

    // Set up drawing polygon visualization
    this.updateDrawingPolygon();

    // Listen for map moves to update polygon
    this.map.on('move', this.updateDrawingPolygon.bind(this));
    this.map.on('zoom', this.updateDrawingPolygon.bind(this));
  }

  public stopDrawing(): void {
    if (!this.map) return;

    this.isDrawing = false;

    // Remove event listeners
    this.map.off('move', this.updateDrawingPolygon.bind(this));
    this.map.off('zoom', this.updateDrawingPolygon.bind(this));

    // Remove drawing layers
    if (this.map.getLayer('leftoverPolygon')) {
      this.map.removeLayer('leftoverPolygon');
    }
    if (this.map.getSource('leftoverPolygon')) {
      this.map.removeSource('leftoverPolygon');
    }

    this.currentRegionArea = 0;
  }

  private updateDrawingPolygon(): void {
    if (!this.map || !this.isDrawing) return;

    const bboxArray = this.map.getBounds().toArray() as [number, number][];
    if (!bboxArray) return;

    const [minLng, minLat] = bboxArray[0];
    const [maxLng, maxLat] = bboxArray[1];

    const lngDiff = (maxLng - minLng) * 0.2;
    const latDiff = (maxLat - minLat) * 0.2;

    const clippedBbox = [minLng + lngDiff, minLat + latDiff, maxLng - lngDiff, maxLat - latDiff];

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

    const clippedPolygonAreaM2 = area(clippedPolygon);
    const clippedPolygonAreaKM2 = convertArea(clippedPolygonAreaM2, 'meters', 'kilometers');
    this.currentRegionArea = parseFloat(clippedPolygonAreaKM2.toFixed(2));

    const leftoverPolygon = difference(featureCollection([originalPolygon, clippedPolygon]));

    if (!leftoverPolygon) {
      console.error('Failed to compute the difference between polygons');
      return;
    }

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
  }

  public async downloadCurrentRegion(): Promise<void> {
    if (!this.map || !this.isDrawing) return;

    const bounds = this.map.getBounds().toArray();
    const [minLng, minLat] = bounds[0];
    const [maxLng, maxLat] = bounds[1];

    // Apply margin to bounds
    const lngDiff = (maxLng - minLng) * 0.2;
    const latDiff = (maxLat - minLat) * 0.2;

    const adjustedBounds: [[number, number], [number, number]] = [
      [minLng + lngDiff, minLat + latDiff],
      [maxLng - lngDiff, maxLat - latDiff],
    ];

    const regionName = prompt(
      'Enter a name for this region:',
      `Region ${new Date().toLocaleDateString()}`
    );
    if (!regionName) return;

    const regionId = `region_${Date.now()}`;

    // Add to downloads tracking
    this.currentDownloads.set(regionId, {
      regionId,
      completed: 0,
      total: 100,
      percentage: 0,
      currentResource: 'Initializing...',
    });

    this.updateProgressBadge();
    this.stopDrawing();

    try {
      const downloadOptions: DownloadOptions = {
        onProgress: progress => {
          const downloadProgress = this.currentDownloads.get(regionId);
          if (downloadProgress) {
            downloadProgress.completed = progress.completed;
            downloadProgress.total = progress.total;
            downloadProgress.percentage = Math.round((progress.completed / progress.total) * 100);
            downloadProgress.currentResource =
              progress.currentTile || progress.currentFont || 'Processing...';
            this.updateProgressBadge();

            // Update panel if open
            if (this.isOpen) {
              this.renderPanel();
            }
          }
        },
      };

      await this.offlineManager.loadRegion({
        id: regionId,
        bounds: adjustedBounds,
        minZoom: this.map.getZoom() - 2,
        maxZoom: this.map.getZoom() + 2,
        name: regionName,
        ...downloadOptions,
      });

      // Download completed
      this.currentDownloads.delete(regionId);
      this.updateProgressBadge();

      alert(`Region "${regionName}" downloaded successfully!`);

      if (this.isOpen) {
        this.renderPanel();
      }
    } catch (error) {
      console.error('Error downloading region:', error);
      this.currentDownloads.delete(regionId);
      this.updateProgressBadge();
      alert(
        `Error downloading region: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private updateProgressBadge(): void {
    if (!this.progressBadge) return;

    if (this.currentDownloads.size === 0) {
      this.progressBadge.style.display = 'none';
    } else {
      const totalProgress =
        Array.from(this.currentDownloads.values()).reduce(
          (sum, download) => sum + download.percentage,
          0
        ) / this.currentDownloads.size;

      this.progressBadge.textContent = `${Math.round(totalProgress)}%`;
      this.progressBadge.style.display = 'block';
      this.progressBadge.style.background = totalProgress === 100 ? '#28a745' : '#007bff';
    }
  }

  public async focusRegion(regionId: string): Promise<void> {
    if (!this.map) return;

    try {
      const region = await this.offlineManager.getStoredRegion(regionId);
      if (region && region.bounds) {
        this.map.fitBounds(region.bounds, { padding: 50 });
        this.closePanel();
      }
    } catch (error) {
      console.error('Error focusing region:', error);
    }
  }

  public async deleteRegion(regionId: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete this region?`)) {
      return;
    }

    try {
      await this.offlineManager.deleteRegion(regionId);
      await this.renderPanel();
    } catch (error) {
      console.error('Error deleting region:', error);
      alert(`Error deleting region: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async showRegionDetails(regionId: string): Promise<void> {
    try {
      const region = await this.offlineManager.getStoredRegion(regionId);
      if (!region) {
        this.showErrorInModal('Region not found');
        return;
      }

      const regionSize = await this.offlineManager.getRegionSize(regionId);
      
      // Calculate region area from bounds if available
      let regionArea = 'Unknown';
      if (region.bounds) {
        const [minLng, minLat] = region.bounds[0];
        const [maxLng, maxLat] = region.bounds[1];
        const regionPolygon = polygon([
          [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ],
        ]);
        const areaM2 = area(regionPolygon);
        const areaKM2 = convertArea(areaM2, 'meters', 'kilometers');
        regionArea = `${parseFloat(areaKM2.toFixed(2))} km²`;
      }

      this.showRegionDetailsModal(region, regionSize, regionArea);
    } catch (error) {
      console.error('Error showing region details:', error);
      this.showErrorInModal(`Error loading details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private showRegionDetailsModal(region: StoredRegion, regionSize: number, regionArea: string): void {
    if (!this.panel) return;

    const isExpired = region.expiry && Date.now() > region.expiry;
    
    const html = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="offlineManagerControl.renderPanel()" 
                    style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; backdrop-filter: blur(10px);">
              ←
            </button>
            <div>
              <h2 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700;">Region Details</h2>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">${region.name || region.id}</p>
            </div>
          </div>
          <button onclick="offlineManagerControl.closePanel()" 
                  style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; backdrop-filter: blur(10px);">
            ×
          </button>
        </div>
      </div>

      <div style="padding: 24px;">
        ${isExpired ? `
          <div style="background: #fee; border: 2px solid #fcc; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
              <h4 style="margin: 0 0 4px 0; color: #d63384; font-weight: 600;">Region Expired</h4>
              <p style="margin: 0; color: #721c24; font-size: 14px;">This region has expired and may not work properly</p>
            </div>
          </div>
        ` : ''}

        <!-- Region Information Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Geographic Info</h4>
            <div style="space-y: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6c757d;">Area:</span>
                <span style="font-weight: 600; color: #333;">${regionArea}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6c757d;">Min Zoom:</span>
                <span style="font-weight: 600; color: #333;">${region.minZoom}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6c757d;">Max Zoom:</span>
                <span style="font-weight: 600; color: #333;">${region.maxZoom}</span>
              </div>
            </div>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Storage Info</h4>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6c757d;">Size:</span>
                <span style="font-weight: 600; color: #333;">${this.formatBytes(regionSize)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6c757d;">Style:</span>
                <span style="font-weight: 600; color: #333;">${region.styleId || 'Default'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 16px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Timeline</h4>
          <div style="position: relative;">
            <div style="position: absolute; left: 16px; top: 0; bottom: 0; width: 2px; background: #dee2e6;"></div>
            
            <div style="display: flex; align-items: center; margin-bottom: 16px; position: relative;">
              <div style="width: 32px; height: 32px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; z-index: 1;">
                <span style="color: white; font-size: 16px;">📅</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 2px;">Created</div>
                <div style="color: #6c757d; font-size: 14px;">${region.created ? new Date(region.created).toLocaleString() : 'Unknown'}</div>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; position: relative;">
              <div style="width: 32px; height: 32px; background: ${isExpired ? '#dc3545' : region.expiry ? '#ffc107' : '#6c757d'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; z-index: 1;">
                <span style="color: white; font-size: 16px;">${isExpired ? '⚠️' : region.expiry ? '⏰' : '∞'}</span>
              </div>
              <div>
                <div style="font-weight: 600; color: #333; margin-bottom: 2px;">
                  ${isExpired ? 'Expired' : region.expiry ? 'Expires' : 'No Expiry'}
                </div>
                <div style="color: #6c757d; font-size: 14px;">
                  ${region.expiry ? new Date(region.expiry).toLocaleString() : 'This region never expires'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bounds Information (if available) -->
        ${region.bounds ? `
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Boundaries</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-family: monospace; font-size: 13px;">
              <div>
                <span style="color: #6c757d;">Southwest:</span><br>
                <span style="font-weight: 600;">${region.bounds[0][1].toFixed(6)}, ${region.bounds[0][0].toFixed(6)}</span>
              </div>
              <div>
                <span style="color: #6c757d;">Northeast:</span><br>
                <span style="font-weight: 600;">${region.bounds[1][1].toFixed(6)}, ${region.bounds[1][0].toFixed(6)}</span>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <button onclick="offlineManagerControl.focusRegion('${region.id}')" 
                  style="background: #007bff; color: white; border: none; border-radius: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🎯</span> Focus Map
          </button>
          <button onclick="offlineManagerControl.deleteRegion('${region.id}')" 
                  style="background: #dc3545; color: white; border: none; border-radius: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🗑️</span> Delete
          </button>
          <button onclick="offlineManagerControl.renderPanel()" 
                  style="background: #6c757d; color: white; border: none; border-radius: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>←</span> Back
          </button>
        </div>
      </div>
    `;

    this.panel.innerHTML = html;
  }

  private showErrorInModal(message: string): void {
    if (!this.panel) return;

    const html = `
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="offlineManagerControl.renderPanel()" 
                    style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; backdrop-filter: blur(10px);">
              ←
            </button>
            <div>
              <h2 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700;">Error</h2>
              <p style="margin: 0; opacity: 0.9; font-size: 14px;">Something went wrong</p>
            </div>
          </div>
          <button onclick="offlineManagerControl.closePanel()" 
                  style="background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; backdrop-filter: blur(10px);">
            ×
          </button>
        </div>
      </div>

      <div style="padding: 40px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
        <h3 style="margin: 0 0 16px 0; color: #dc3545;">Error</h3>
        <p style="color: #666; margin-bottom: 24px; line-height: 1.5;">${message}</p>
        <button onclick="offlineManagerControl.renderPanel()" 
                style="background: #007bff; color: white; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;">
          ← Back to Regions
        </button>
      </div>
    `;

    this.panel.innerHTML = html;
  }

  public async cleanupExpired(): Promise<void> {
    if (!confirm('Remove all expired regions?')) return;

    try {
      const cleanedCount = await this.offlineManager.cleanupExpiredRegions();
      alert(`Cleaned up ${cleanedCount} expired regions`);
      await this.renderPanel();
    } catch (error) {
      console.error('Error cleaning up:', error);
      alert(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  public async refresh(): Promise<void> {
    if (this.isOpen) {
      await this.renderPanel();
    }
  }
}
