/**
 * Region Control Component
 * Manages region selection, form modal, and saves
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { PolygonControl, PolygonControlOptions } from './PolygonControl';
import { RegionFormModal, RegionFormData, RegionFormOptions } from '../modals/regionFormModal';
import { DownloadManager } from '../managers/downloadManager';
import { ModalManager } from '../modals/ModalManager';
import { icons } from '../../utils/icons';

export interface RegionControlOptions {
  map: MaplibreMap;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  container: HTMLDivElement;
  onRegionSaved?: () => void;
  styleUrl: string;
}

export class RegionControl {
  private map: MaplibreMap;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private container: HTMLDivElement;
  private saveButton: HTMLButtonElement | undefined;
  private polygonControl: PolygonControl | undefined;
  private regionFormModal: RegionFormModal | undefined;
  private options: RegionControlOptions;
  private isActive = false;

  constructor(options: RegionControlOptions) {
    this.map = options.map;
    this.downloadManager = options.downloadManager;
    this.modalManager = options.modalManager;
    this.container = options.container;
    this.options = options;
  }

  /**
   * Start region selection mode
   */
  public startSelection(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.createSaveButton();

    const polygonOptions: PolygonControlOptions = {
      onSave: (bounds, area) => this.showRegionForm(bounds, area),
      onCancel: () => this.cancelSelection(),
    };

    this.polygonControl = new PolygonControl(this.map, polygonOptions);
    this.polygonControl.enter();
  }

  /**
   * Cancel region selection
   */
  public cancelSelection(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.polygonControl?.exit();
    this.polygonControl = undefined;
    this.removeSaveButton();
    this.modalManager.close();
  }

  /**
   * Create save polygon button
   */
  private createSaveButton(): void {
    if (this.saveButton) return;

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className =
      'maplibregl-ctrl-icon offline-manager-control mt-0.5 bg-gradient-to-br from-green-600 to-green-700 border border-green-700 rounded-sm cursor-pointer relative w-[29px] h-[29px] flex items-center justify-center hover:from-green-700 hover:to-green-800 transition-all duration-200';
    this.saveButton.innerHTML = icons.check({ size: 16, color: 'white' });
    this.saveButton.title = 'Save Selected Region';
    this.saveButton.addEventListener('click', () => this.handleSaveClick());

    this.container.appendChild(this.saveButton);
  }

  /**
   * Remove save button
   */
  private removeSaveButton(): void {
    if (this.saveButton && this.saveButton.parentNode) {
      this.saveButton.parentNode.removeChild(this.saveButton);
      this.saveButton = undefined;
    }
  }

  /**
   * Handle save button click
   */
  private handleSaveClick(): void {
    if (this.polygonControl) {
      this.polygonControl.triggerSave();
    }
  }

  /**
   * Show region form modal
   */
  private showRegionForm(bounds: [number, number, number, number], area: number): void {
    const formOptions: RegionFormOptions = {
      bounds,
      area,
      onSave: async (formData: RegionFormData) => this.handleRegionSave(formData),
      onCancel: () => this.handleFormCancel(),
      styleUrl: this.options.styleUrl,
      onThemeToggle: () => this.options.onRegionSaved?.(),
    };

    this.regionFormModal = new RegionFormModal(formOptions);
    const modal = this.regionFormModal.show();
    this.modalManager.show(modal);
  }

  /**
   * Handle form cancellation
   */
  private handleFormCancel(): void {
    this.modalManager.close();
    // Stay in polygon selection mode for further adjustments
  }

  /**
   * Handle region save from form
   */
  private async handleRegionSave(formData: RegionFormData): Promise<void> {
    try {
      this.modalManager.close();
      this.cancelSelection();

      await this.downloadManager.downloadRegion(formData);
      this.options.onRegionSaved?.();
    } catch (error) {
      console.error('Error saving region:', error);
      // TODO: Show error modal
    }
  }

  /**
   * Check if region selection is active
   */
  public isSelectionActive(): boolean {
    return this.isActive;
  }

  /**
   * Update the style URL for new regions
   */
  public updateStyleUrl(newStyleUrl: string): void {
    this.options.styleUrl = newStyleUrl;
    console.warn(`📍 RegionControl style URL updated to: ${newStyleUrl}`);
  }

  /**
   * Cleanup when control is removed
   */
  public cleanup(): void {
    this.cancelSelection();
  }
}
