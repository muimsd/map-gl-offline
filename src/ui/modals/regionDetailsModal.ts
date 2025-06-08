/**
 * Region Details Modal Component
 * Shows detailed information about a specific region
 */

import { createModal } from '../components';
import { themeManager } from '../themes';
import { formatDate } from '../../utils/formatting';

export interface RegionDetailsOptions {
  region: any;
  onClose: () => void;
  onFocus: (regionId: string) => void;
  onThemeToggle?: () => void;
}

export class RegionDetailsModal {
  private options: RegionDetailsOptions;
  private modal: HTMLDivElement | undefined;

  constructor(options: RegionDetailsOptions) {
    this.options = options;
  }

  /**
   * Show the region details modal
   */
  public show(): HTMLDivElement {
    const { region } = this.options;

    const modalContent = `
      <div class="flex flex-col gap-4">
        <div>
          <h3 class="m-0 mb-2 text-gray-900 dark:text-white text-lg">
            ${region.name}
          </h3>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
              Bounds:
            </label>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              ${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)}<br>
              ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}
            </div>
          </div>
          
          <div>
            <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
              Zoom Range:
            </label>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              ${region.minZoom} - ${region.maxZoom}
            </div>
          </div>
        </div>
        
        ${
          region.downloadedAt
            ? `
          <div>
            <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
              Downloaded:
            </label>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              ${formatDate(region.downloadedAt)}
            </div>
          </div>
        `
            : ''
        }
        
        <div class="flex gap-2 justify-end mt-4">
          <button onclick="regionDetailsModal.focusRegion()" 
                  class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white border-0 rounded-sm cursor-pointer text-sm transition-colors duration-200">
            Focus on Map
          </button>
          <button onclick="regionDetailsModal.close()" 
                  class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 rounded-sm cursor-pointer text-sm transition-all duration-200">
            Close
          </button>
        </div>
      </div>
    `;

    this.modal = createModal({
      title: 'Region Details',
      isOpen: true,
      size: 'md',
      showThemeToggle: false,
      onClose: () => this.close(),
      onThemeToggle: this.options.onThemeToggle,
      children: modalContent,
    });

    // Make this instance available globally for onclick handlers
    (window as any).regionDetailsModal = this;

    return this.modal!;
  }

  /**
   * Focus on the region in the map
   */
  public focusRegion(): void {
    this.options.onFocus(this.options.region.id);
    this.close();
  }

  /**
   * Close the modal
   */
  public close(): void {
    this.options.onClose();
    this.cleanup();
  }

  /**
   * Cleanup global references
   */
  private cleanup(): void {
    delete (window as any).regionDetailsModal;
  }
}
