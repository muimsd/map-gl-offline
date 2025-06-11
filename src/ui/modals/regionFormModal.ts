/**
 * Region Form Modal Component
 * Handles the form for creating new offline regions
 * Refactored to use modular components
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import { icons } from '../../utils/icons';
import { themeManager } from '../ThemeManager';

export interface RegionFormData {
  name: string;
  minZoom: number;
  maxZoom: number;
  styleUrl: string;
  bounds: [number, number, number, number];
}

export interface RegionFormOptions {
  bounds: [number, number, number, number];
  area: number;
  onSave: (formData: RegionFormData) => Promise<void>;
  onCancel: () => void;
  onThemeToggle?: () => void;
  getCurrentStyleUrl: () => string;
}

export class RegionFormModal {
  private options: RegionFormOptions;
  private modal?: Modal;
  private nameInput?: HTMLInputElement;
  private minZoomInput?: HTMLInputElement;
  private maxZoomInput?: HTMLInputElement;
  private styleUrlInput?: HTMLInputElement;

  constructor(options: RegionFormOptions) {
    this.options = options;
  }

  /**
   * Show the region form modal
   */
  public show(): HTMLDivElement {
    const { bounds, area } = this.options;

    const modalConfig: ModalConfig = {
      title: 'Download Offline Region',
      subtitle: `Selected area: ${area} km²`,
      size: 'lg',
      closable: true,
      showThemeToggle: true,
      onClose: this.options.onCancel,
      onThemeToggle: this.options.onThemeToggle
    };

    this.modal = new Modal(modalConfig);

    // Create form content
    const form = this.createForm(bounds, area);
    this.modal.setContent(form);

    // Create footer with action buttons
    const footer = this.createFooter();
    this.modal.setFooter(footer);

    this.modal.show();
    return this.modal.getElement() as HTMLDivElement;
  }

  /**
   * Create the form content
   */
  private createForm(bounds: [number, number, number, number], area: number): HTMLElement {
    const [west, south, east, north] = bounds;
    const styleUrl = this.options.getCurrentStyleUrl();

    const form = document.createElement('div');
    form.className = 'flex flex-col gap-4';

    // Region name input
    const nameGroup = document.createElement('div');
    nameGroup.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Region Name:
      </label>
    `;
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter region name...';
    this.nameInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    nameGroup.appendChild(this.nameInput);
    form.appendChild(nameGroup);

    // Zoom range inputs
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'grid grid-cols-2 gap-2';

    const minZoomDiv = document.createElement('div');
    minZoomDiv.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Min Zoom:
      </label>
    `;
    this.minZoomInput = document.createElement('input');
    this.minZoomInput.type = 'number';
    this.minZoomInput.value = '1';
    this.minZoomInput.min = '0';
    this.minZoomInput.max = '20';
    this.minZoomInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    minZoomDiv.appendChild(this.minZoomInput);

    const maxZoomDiv = document.createElement('div');
    maxZoomDiv.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Max Zoom:
      </label>
    `;
    this.maxZoomInput = document.createElement('input');
    this.maxZoomInput.type = 'number';
    this.maxZoomInput.value = '14';
    this.maxZoomInput.min = '0';
    this.maxZoomInput.max = '20';
    this.maxZoomInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    maxZoomDiv.appendChild(this.maxZoomInput);

    zoomGroup.appendChild(minZoomDiv);
    zoomGroup.appendChild(maxZoomDiv);
    form.appendChild(zoomGroup);

    // Style URL input
    const styleGroup = document.createElement('div');
    styleGroup.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Style URL:
      </label>
    `;
    this.styleUrlInput = document.createElement('input');
    this.styleUrlInput.type = 'text';
    this.styleUrlInput.value = styleUrl;
    this.styleUrlInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    styleGroup.appendChild(this.styleUrlInput);
    form.appendChild(styleGroup);

    // Region info display
    const infoGroup = document.createElement('div');
    infoGroup.className = 'grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-sm border border-gray-200 dark:border-gray-600';
    infoGroup.innerHTML = `
      <div>
        <strong class="text-gray-900 dark:text-white">Area:</strong>
        <div class="text-gray-600 dark:text-gray-400 text-sm">${area} km²</div>
      </div>
      <div>
        <strong class="text-gray-900 dark:text-white">Bounds:</strong>
        <div class="text-gray-600 dark:text-gray-400 text-xs">
          ${west.toFixed(4)}, ${south.toFixed(4)}<br>
          ${east.toFixed(4)}, ${north.toFixed(4)}
        </div>
      </div>
    `;
    form.appendChild(infoGroup);

    return form;
  }

  /**
   * Create the footer with action buttons
   */
  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'flex gap-2 justify-end';

    // Cancel button
    const cancelButton = new Button({
      text: 'Cancel',
      variant: 'secondary',
      onClick: () => {
        this.modal?.hide();
        this.options.onCancel();
      }
    });

    // Save button
    const saveButton = new Button({
      text: 'Download Region',
      variant: 'primary',
      icon: icons.download({ size: 16, color: 'white' }),
      onClick: () => this.handleSave()
    });

    footer.appendChild(cancelButton.getElement());
    footer.appendChild(saveButton.getElement());

    return footer;
  }

  /**
   * Handle form save
   */
  private async handleSave(): Promise<void> {
    try {
      const formData: RegionFormData = {
        name: this.nameInput?.value || `Region ${Date.now()}`,
        minZoom: parseInt(this.minZoomInput?.value || '1'),
        maxZoom: parseInt(this.maxZoomInput?.value || '14'),
        styleUrl: this.styleUrlInput?.value || this.options.getCurrentStyleUrl(),
        bounds: this.options.bounds,
      };

      this.modal?.hide();
      await this.options.onSave(formData);
    } catch (error) {
      console.error('Error saving region:', error);
      // TODO: Show error notification
    }
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    this.modal?.hide();
  }

  /**
   * Destroy the modal
   */
  public destroy(): void {
    this.modal?.destroy();
  }

  /**
   * Handle form cancel - kept for backward compatibility
   */
  public cancel(): void {
    this.hide();
    this.options.onCancel();
  }

  /**
   * Handle form save - kept for backward compatibility
   */
  public async save(): Promise<void> {
    await this.handleSave();
  }

  /**
   * Close the modal - kept for backward compatibility
   */
  public close(): void {
    this.hide();
  }
}
