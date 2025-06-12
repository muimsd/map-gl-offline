import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import { OfflineMapManager } from '../managers/offlineMapManager';
import { themeManager } from './ThemeManager';

// Import refactored modular components
import { ButtonManager } from './managers/ControlButtonManager';
import { PanelRenderer } from './managers/PanelManager';
import { RegionControl } from './controls/RegionControl';
import { DownloadManager } from './managers/DownloadManager';
import { ModalManager } from './modals/ModalManager';

export interface OfflineManagerControlOptions {
  theme?: 'light' | 'dark';
}

export class OfflineManagerControl implements IControl {
  private map: MaplibreMap | undefined;
  private panel: HTMLDivElement | undefined;
  private isOpen = false;
  private offlineManager: OfflineMapManager;

  // Refactored component managers
  private buttonManager: ButtonManager | undefined;
  private panelRenderer: PanelRenderer | undefined;
  private regionControl: RegionControl | undefined;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager = new ModalManager();

  constructor(
    offlineManager: OfflineMapManager,
    options: OfflineManagerControlOptions = { theme: 'dark' }
  ) {
    this.offlineManager = offlineManager;

    // Set initial theme if provided
    if (options?.theme) {
      themeManager.setTheme(options.theme);
    }

    // Initialize download manager
    this.downloadManager = new DownloadManager({
      offlineManager: this.offlineManager,
      onProgressUpdate: downloads => this.handleProgressUpdate(downloads),
      onDownloadComplete: regionId => this.handleDownloadComplete(regionId),
      onDownloadError: (regionId, error) => this.handleDownloadError(regionId, error),
      updateButton: (text, disabled) => this.updateButton(text, disabled),
      updateProgressBadge: (text, visible) => this.updateProgressBadge(text, visible),
    });
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
    });

    // Initialize region control
    this.regionControl = new RegionControl({
      map: this.map,
      downloadManager: this.downloadManager,
      modalManager: this.modalManager,
      container: this.buttonManager.getContainer(),
      onRegionSaved: () => this.handleRegionSaved(),
      getCurrentStyleUrl: () => this.getCurrentStyleUrl(),
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

    // Remove panel from DOM
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }

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
    // Refresh panel to show new region
    this.renderPanel();
  }

  /**
   * Handle progress updates from download manager
   */
  private handleProgressUpdate(downloads: Map<string, any>): void {
    // Panel will be automatically updated through the PanelRenderer
    this.renderPanel();
  }

  /**
   * Handle download completion
   */
  private handleDownloadComplete(regionId: string): void {
    this.renderPanel();
  }

  /**
   * Handle download error
   */
  private handleDownloadError(regionId: string, error: any): void {
    console.error(`Download error for region ${regionId}:`, error);
    this.renderPanel();
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
   * Get current style URL from map
   */
  private getCurrentStyleUrl(): string {
    if (!this.map) return '';
    try {
      const style = this.map.getStyle();
      return (style as any).metadata?.['mapbox:origin'] || style.metadata?.styleUrl;
    } catch (error) {
      return '';
    }
  }
}
