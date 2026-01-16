/**
 * Region Details Modal Component
 * Shows detailed information about a specific region
 * Refactored to use modular components
 */

import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import { icons } from '../../utils/icons';
import { formatDate } from '../../utils/formatting';
import { StoredRegion } from '../../types/region';

export interface RegionDetailsOptions {
  region: StoredRegion;
  onClose: () => void;
  onFocus: (regionId: string) => void;
  onThemeToggle?: () => void;
}

export class RegionDetailsModal {
  private options: RegionDetailsOptions;
  private modal?: Modal;

  constructor(options: RegionDetailsOptions) {
    this.options = options;
  }

  /**
   * Show the region details modal
   */
  public show(): HTMLDivElement {
    const { region } = this.options;

    const modalConfig: ModalConfig = {
      title: 'Region Details',
      size: 'sm',
      closable: true,
      showThemeToggle: false,
      onClose: this.options.onClose,
      onThemeToggle: this.options.onThemeToggle,
    };

    this.modal = new Modal(modalConfig);

    // Create content
    const content = this.createContent(region);
    this.modal.setContent(content);

    // Create footer with action buttons
    const footer = this.createFooter();
    this.modal.setFooter(footer);

    this.modal.show();
    return this.modal.getElement() as HTMLDivElement;
  }

  /**
   * Create the modal content
   */
  private createContent(region: StoredRegion): HTMLElement {
    const content = document.createElement('div');
    content.className = 'flex flex-col gap-4';

    content.innerHTML = `
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
        region.created
          ? `
        <div>
          <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
            Created:
          </label>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            ${formatDate(region.created)}
          </div>
        </div>
      `
          : ''
      }
    `;

    return content;
  }

  /**
   * Create the footer with action buttons
   */
  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'flex gap-2 justify-end';

    // Focus button
    const focusButton = new Button({
      text: 'Focus on Map',
      variant: 'secondary',
      icon: icons.focus({ size: 16, color: 'currentColor' }),
      onClick: () => this.focusRegion(),
    });

    // Close button
    const closeButton = new Button({
      text: 'Close',
      variant: 'primary',
      onClick: () => this.close(),
    });

    footer.appendChild(focusButton.getElement());
    footer.appendChild(closeButton.getElement());

    return footer;
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
    this.modal?.hide();
    this.options.onClose();
  }
}
