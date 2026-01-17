/**
 * Region Form Modal Component
 * Handles the form for creating new offline regions
 * Refactored to use modular components
 */

// import { MaplibreMap } from 'maplibre-gl';
import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import { icons } from '../../utils/icons';
import { logger } from '../../utils/logger';

const formLogger = logger.scope('RegionFormModal');
// import { themeManager } from '../managers/themeManager.js';

export interface RegionFormData {
  name: string;
  minZoom: number;
  maxZoom: number;
  styleUrl: string;
  bounds: [number, number, number, number];
  // Enhanced Mapbox GL support
  provider?: 'mapbox' | 'maplibre' | 'auto';
  accessToken?: string;
}

export interface RegionFormOptions {
  bounds: [number, number, number, number];
  area: number;
  onSave: (formData: RegionFormData) => Promise<void>;
  onCancel: () => void;
  onThemeToggle?: () => void;
  styleUrl: string;
}

export class RegionFormModal {
  private options: RegionFormOptions;
  private modal?: Modal;
  private nameInput?: HTMLInputElement;
  private minZoomInput?: HTMLInputElement;
  private maxZoomInput?: HTMLInputElement;
  private styleUrlInput?: HTMLInputElement;
  // Enhanced Mapbox GL support
  private providerSelect?: HTMLSelectElement;
  private accessTokenInput?: HTMLInputElement;
  private accessTokenGroup?: HTMLDivElement;

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
      size: 'md',
      closable: true,
      showThemeToggle: true,
      onClose: this.options.onCancel,
      onThemeToggle: this.options.onThemeToggle,
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
    const styleUrl = this.options.styleUrl;

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
    this.nameInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
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
    this.minZoomInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
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
    this.maxZoomInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
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
    this.styleUrlInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
    this.styleUrlInput.addEventListener('input', () => this.handleStyleUrlChange());
    styleGroup.appendChild(this.styleUrlInput);
    form.appendChild(styleGroup);

    // Provider selection
    const providerGroup = document.createElement('div');
    providerGroup.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Style Provider:
      </label>
    `;
    this.providerSelect = document.createElement('select');
    this.providerSelect.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
    this.providerSelect.innerHTML = `
      <option value="auto">Auto-detect</option>
      <option value="mapbox">Mapbox GL (requires access token)</option>
      <option value="maplibre">MapLibre GL (open source)</option>
    `;
    this.providerSelect.addEventListener('change', () => this.handleProviderChange());
    providerGroup.appendChild(this.providerSelect);

    // Add provider info
    const providerInfo = document.createElement('div');
    providerInfo.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
    providerInfo.textContent = 'Auto-detect will analyze the style URL to determine the provider';
    providerGroup.appendChild(providerInfo);

    form.appendChild(providerGroup);

    // Access Token input (initially hidden)
    this.accessTokenGroup = document.createElement('div');
    this.accessTokenGroup.className = 'hidden';
    this.accessTokenGroup.innerHTML = `
      <label class="block mb-1 font-semibold text-gray-900 dark:text-white">
        Mapbox Access Token:
        <span class="text-xs font-normal text-gray-500 dark:text-gray-400">(Required for Mapbox GL styles)</span>
      </label>
    `;
    this.accessTokenInput = document.createElement('input');
    this.accessTokenInput.type = 'password';
    this.accessTokenInput.placeholder = 'pk.eyJ1...';
    this.accessTokenInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
    this.accessTokenGroup.appendChild(this.accessTokenInput);

    // Add access token help text
    const tokenHelp = document.createElement('div');
    tokenHelp.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
    tokenHelp.innerHTML = `
      Get your access token from <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Mapbox Account</a>
    `;
    this.accessTokenGroup.appendChild(tokenHelp);

    form.appendChild(this.accessTokenGroup);

    // Initialize provider detection
    this.detectProviderFromUrl();

    // Region info display
    const infoGroup = document.createElement('div');
    infoGroup.className =
      'grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700';
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
   * Handle style URL changes to auto-detect provider
   */
  private handleStyleUrlChange(): void {
    this.detectProviderFromUrl();
  }

  /**
   * Handle provider selection changes
   */
  private handleProviderChange(): void {
    const provider = this.providerSelect?.value;
    this.toggleAccessTokenVisibility(provider === 'mapbox');
  }

  /**
   * Auto-detect provider from style URL
   */
  private detectProviderFromUrl(): void {
    const styleUrl = this.styleUrlInput?.value || '';

    // Simple detection logic
    if (styleUrl.includes('mapbox.com') || styleUrl.includes('api.mapbox.com')) {
      if (this.providerSelect) this.providerSelect.value = 'mapbox';
      this.toggleAccessTokenVisibility(true);
    } else if (
      styleUrl.includes('maplibre') ||
      styleUrl.includes('maptiler') ||
      styleUrl.includes('carto')
    ) {
      if (this.providerSelect) this.providerSelect.value = 'maplibre';
      this.toggleAccessTokenVisibility(false);
    } else {
      if (this.providerSelect) this.providerSelect.value = 'auto';
      this.toggleAccessTokenVisibility(false);
    }
  }

  /**
   * Toggle access token input visibility
   */
  private toggleAccessTokenVisibility(show: boolean): void {
    if (this.accessTokenGroup) {
      if (show) {
        this.accessTokenGroup.classList.remove('hidden');
      } else {
        this.accessTokenGroup.classList.add('hidden');
      }
    }
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
      },
    });

    // Save button
    const saveButton = new Button({
      text: 'Download Region',
      variant: 'primary',
      icon: icons.download({ size: 16, color: 'white' }),
      onClick: () => this.handleSave(),
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
        styleUrl: this.styleUrlInput?.value || this.options.styleUrl,
        bounds: this.options.bounds,
        // Enhanced Mapbox GL support
        provider: this.providerSelect?.value as 'mapbox' | 'maplibre' | 'auto',
        accessToken: this.accessTokenInput?.value || undefined,
      };

      this.modal?.hide();
      await this.options.onSave(formData);
    } catch (error) {
      formLogger.error('Error saving region:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save region: ${errorMessage}`);
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
