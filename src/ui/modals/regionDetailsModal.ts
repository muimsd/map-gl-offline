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
    content.className = 'flex flex-col gap-5';

    content.innerHTML = `
      <div class="glass-input p-4 rounded-xl border-0 bg-gray-50/50 dark:bg-gray-800/50">
        <h3 class="m-0 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
          ${region.name}
        </h3>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="glass-input p-4 rounded-xl border-0 bg-gray-50/30 dark:bg-gray-800/30">
          <label class="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Bounds
          </label>
          <div class="text-sm font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
            ${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)}<br>
            ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}
          </div>
        </div>
        
        <div class="glass-input p-4 rounded-xl border-0 bg-gray-50/30 dark:bg-gray-800/30">
          <label class="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Zoom Range
          </label>
          <div class="text-lg font-semibold text-gray-900 dark:text-white">
            ${region.minZoom} - ${region.maxZoom}
          </div>
        </div>
      </div>
      
      ${
        region.created
          ? `
        <div class="glass-input p-4 rounded-xl border-0 bg-gray-50/30 dark:bg-gray-800/30">
          <label class="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Created
          </label>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
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
