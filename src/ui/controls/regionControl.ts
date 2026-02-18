/**
 * Region Control Component
 * Manages region selection, form modal, and saves
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { PolygonControl, PolygonControlOptions } from './polygonControl';
import { RegionFormModal, RegionFormData, RegionFormOptions } from '../modals/regionFormModal';
import { DownloadManager } from '../managers/downloadManager';
import { ModalManager } from '../modals/modalManager';
import { icons } from '../../utils/icons';
import { logger } from '../../utils/logger';
import type { CssPrefix } from '../../utils/cssPrefix';

const regionLogger = logger.scope('RegionControl');

export interface RegionControlOptions {
  map: MaplibreMap;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  container: HTMLDivElement;
  onRegionSaved?: () => void;
  styleUrl: string;
  accessToken?: string;
  cssPrefix?: CssPrefix;
}

export class RegionControl {
  private map: MaplibreMap;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private container: HTMLDivElement;
  private saveButton: HTMLButtonElement | undefined;
  private cancelButton: HTMLButtonElement | undefined;
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
    this.createSelectionButtons();

    const polygonOptions: PolygonControlOptions = {
      onSave: (bounds, area) => this.showRegionForm(bounds, area),
      onCancel: () => this.cancelSelection(),
      cssPrefix: this.options.cssPrefix,
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
    this.removeSelectionButtons();
    this.modalManager.close();
  }

  /**
   * Create save and cancel buttons for polygon selection
   */
  private createSelectionButtons(): void {
    if (this.saveButton || this.cancelButton) return;

    // Create cancel button (red X)
    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    const prefix = this.options.cssPrefix || 'maplibregl';
    this.cancelButton.className = `${prefix}-ctrl-icon offline-manager-control mt-0.5 bg-gradient-to-br from-red-600 to-red-700 border border-red-700 rounded-sm cursor-pointer relative w-[29px] h-[29px] flex items-center justify-center hover:from-red-700 hover:to-red-800 transition-all duration-200`;
    this.cancelButton.innerHTML = icons.x({ size: 16, color: 'white' });
    this.cancelButton.title = 'Cancel Selection';
    this.cancelButton.addEventListener('click', () => this.cancelSelection());

    // Create save button (green checkmark)
    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = `${prefix}-ctrl-icon offline-manager-control mt-0.5 bg-gradient-to-br from-green-600 to-green-700 border border-green-700 rounded-sm cursor-pointer relative w-[29px] h-[29px] flex items-center justify-center hover:from-green-700 hover:to-green-800 transition-all duration-200`;
    this.saveButton.innerHTML = icons.check({ size: 16, color: 'white' });
    this.saveButton.title = 'Save Selected Region';
    this.saveButton.addEventListener('click', () => this.handleSaveClick());

    // Add cancel button first, then save button
    this.container.appendChild(this.cancelButton);
    this.container.appendChild(this.saveButton);
  }

  /**
   * Remove selection buttons
   */
  private removeSelectionButtons(): void {
    if (this.cancelButton && this.cancelButton.parentNode) {
      this.cancelButton.parentNode.removeChild(this.cancelButton);
      this.cancelButton = undefined;
    }
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
      accessToken: this.options.accessToken,
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
      regionLogger.error('Error saving region:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save region: ${errorMessage}`);
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
    regionLogger.debug(`RegionControl style URL updated to: ${newStyleUrl}`);
  }

  /**
   * Cleanup when control is removed
   */
  public cleanup(): void {
    this.cancelSelection();
  }
}
