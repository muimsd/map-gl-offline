/**
 * Region Drawing Component
 * Refactored from RegionControl to be more focused and reusable
 */

import { BaseComponent } from './BaseComponent';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { DownloadManager } from '../../managers/downloadManager';
import { ModalManager } from '../../modals/ModalManager';
import { RegionFormModal } from '../../modals/regionFormModal';

export interface RegionDrawingConfig {
  map: MaplibreMap;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  container: HTMLElement;
  onRegionSaved: () => void;
  getCurrentStyleUrl: () => string;
}

export class RegionDrawing extends BaseComponent {
  private map: MaplibreMap;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private drawingConfig: RegionDrawingConfig;
  private isDrawing = false;
  private drawingHandler: ((e: any) => void) | null = null;

  constructor(config: RegionDrawingConfig) {
    super({});
    this.map = config.map;
    this.downloadManager = config.downloadManager;
    this.modalManager = config.modalManager;
    this.drawingConfig = config;
  }

  protected createElement(): HTMLElement {
    // This component doesn't create its own DOM element
    // It manages map interactions
    return document.createElement('div');
  }

  /**
   * Start region selection mode
   */
  public startSelection(): void {
    if (this.isDrawing) return;

    this.isDrawing = true;
    this.setupDrawingMode();
  }

  /**
   * Stop region selection mode
   */
  public stopSelection(): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    this.cleanupDrawingMode();
  }

  private setupDrawingMode(): void {
    // Change cursor to crosshair
    this.map.getCanvas().style.cursor = 'crosshair';

    // Add drawing instructions
    this.showDrawingInstructions();

    // Setup click handler for region selection
    this.drawingHandler = (e: any) => this.handleMapClick(e);
    this.map.on('click', this.drawingHandler);

    // Add escape key handler
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.stopSelection();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  private cleanupDrawingMode(): void {
    // Reset cursor
    this.map.getCanvas().style.cursor = '';

    // Remove drawing instructions
    this.hideDrawingInstructions();

    // Remove click handler
    if (this.drawingHandler) {
      this.map.off('click', this.drawingHandler);
      this.drawingHandler = null;
    }
  }

  private showDrawingInstructions(): void {
    const instructions = document.createElement('div');
    instructions.id = 'drawing-instructions';
    instructions.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[1001]';
    instructions.innerHTML = `
      <div class="text-center">
        <div class="font-semibold">Drawing Mode Active</div>
        <div class="text-sm">Click on the map to select a region</div>
        <div class="text-xs mt-1">Press ESC to cancel</div>
      </div>
    `;
    document.body.appendChild(instructions);
  }

  private hideDrawingInstructions(): void {
    const instructions = document.getElementById('drawing-instructions');
    if (instructions) {
      instructions.remove();
    }
  }

  private handleMapClick(e: any): void {
    if (!this.isDrawing) return;

    // Get the clicked point
    const point = e.lngLat;
    
    // Get current bounds or create bounds around the point
    const bounds = this.createBoundsAroundPoint(point);

    // Stop drawing mode
    this.stopSelection();

    // Show region form with the selected bounds
    this.showRegionForm(bounds);
  }

  private createBoundsAroundPoint(center: any): [number, number, number, number] {
    // Create a small region around the clicked point
    const offset = 0.01; // roughly 1km
    
    return [
      center.lng - offset, // west
      center.lat - offset, // south
      center.lng + offset, // east
      center.lat + offset  // north
    ];
  }

  private showRegionForm(bounds: [number, number, number, number]): void {
    // Calculate approximate area in km²
    const area = this.calculateAreaFromBounds(bounds);
    
    const regionForm = new RegionFormModal({
      bounds,
      area,
      styleUrl: this.drawingConfig.getCurrentStyleUrl(),
      onSave: async (regionData: any) => {
        try {
          // Add the region using the download manager or offline manager
          const region = {
            ...regionData,
            id: `region_${Date.now()}`,
            bounds,
            styleUrl: this.drawingConfig.getCurrentStyleUrl(),
            createdAt: Date.now(),
          };

          // This would typically be handled by the offline manager
          // For now, we'll emit an event
          this.drawingConfig.onRegionSaved();
          
          return region;
        } catch (error) {
          console.error('Failed to save region:', error);
          throw error;
        }
      },
      onCancel: () => {
        // Form will handle cleanup
      },
    });

    const modalElement = regionForm.show();
    document.body.appendChild(modalElement);
  }

  /**
   * Calculate approximate area from bounds in km²
   * This is a simplified calculation for display purposes
   */
  private calculateAreaFromBounds(bounds: [number, number, number, number]): number {
    const [west, south, east, north] = bounds;
    
    // Convert degrees to approximate km using rough conversion
    // Note: This is simplified and doesn't account for projection distortion
    const degToKm = 111; // 1 degree ≈ 111 km
    const width = Math.abs(east - west) * degToKm;
    const height = Math.abs(north - south) * degToKm;
    const area = width * height;
    
    return Math.round(area * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if currently in drawing mode
   */
  public isInDrawingMode(): boolean {
    return this.isDrawing;
  }

  /**
   * Cleanup when component is destroyed
   */
  public cleanup(): void {
    this.stopSelection();
    this.destroy();
  }
}
