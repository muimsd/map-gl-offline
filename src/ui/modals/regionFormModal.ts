/**
 * Region Form Modal Component
 * Handles the form for creating new offline regions
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import { createModal } from '../components';
import { themeManager } from '../themes';

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
  private modal: HTMLDivElement | undefined;

  constructor(options: RegionFormOptions) {
    this.options = options;
  }

  /**
   * Show the region form modal
   */
  public show(): HTMLDivElement {
    const { bounds, area, getCurrentStyleUrl } = this.options;
    const [west, south, east, north] = bounds;
    const styleUrl = getCurrentStyleUrl();

    const modalContent = `
      <div class="flex flex-col gap-4 h-full">
        <div>
          <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
            Region Name:
          </label>
          <input type="text" id="region-name" placeholder="Enter region name..." 
                 class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
        
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
              Min Zoom:
            </label>
            <input type="number" id="min-zoom" value="1" min="0" max="20"
                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          <div>
            <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
              Max Zoom:
            </label>
            <input type="number" id="max-zoom" value="14" min="0" max="20"
                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
        </div>

        <div>
          <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
            Style URL:
          </label>
          <input type="text" id="style-url" value="${styleUrl}" 
                 class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        </div>
        
        <div class="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-sm border border-gray-200 dark:border-gray-600">
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
        </div>
        
        <div class="flex gap-2 justify-end mt-4">
          <button onclick="regionFormModal.cancel()" 
                  class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white border-0 rounded-sm cursor-pointer text-sm transition-colors duration-200">
            Cancel
          </button>
          <button onclick="regionFormModal.save()" 
                  class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 rounded-sm cursor-pointer text-sm transition-all duration-200">
            Download Region
          </button>
        </div>
      </div>
    `;

    this.modal = createModal({
      title: 'Download Offline Region',
      subtitle: `Selected area: ${area} km²`,
      isOpen: true,
      size: 'lg',
      showThemeToggle: true,
      onClose: () => this.cancel(),
      onThemeToggle: this.options.onThemeToggle,
      children: modalContent,
    });

    // Make this instance available globally for onclick handlers
    (window as any).regionFormModal = this;

    return this.modal!;
  }

  /**
   * Handle form save
   */
  public async save(): Promise<void> {
    try {
      const nameInput = document.getElementById('region-name') as HTMLInputElement;
      const minZoomInput = document.getElementById('min-zoom') as HTMLInputElement;
      const maxZoomInput = document.getElementById('max-zoom') as HTMLInputElement;
      const styleUrlInput = document.getElementById('style-url') as HTMLInputElement;

      const formData: RegionFormData = {
        name: nameInput?.value || `Region ${Date.now()}`,
        minZoom: parseInt(minZoomInput?.value || '1'),
        maxZoom: parseInt(maxZoomInput?.value || '14'),
        styleUrl: styleUrlInput?.value || this.options.getCurrentStyleUrl(),
        bounds: this.options.bounds,
      };

      await this.options.onSave(formData);
    } catch (error) {
      console.error('Error saving region:', error);
      // TODO: Show error notification
    }
  }

  /**
   * Handle form cancel
   */
  public cancel(): void {
    this.options.onCancel();
    this.cleanup();
  }

  /**
   * Close the modal and cleanup
   */
  public close(): void {
    this.cleanup();
  }

  /**
   * Cleanup global references
   */
  private cleanup(): void {
    delete (window as any).regionFormModal;
  }
}
