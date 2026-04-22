/**
 * Region Form Modal Component
 * Handles the form for creating new offline regions
 * Refactored to use modular components
 */

// import { MaplibreMap } from 'maplibre-gl';
import { Modal, ModalConfig } from '@/ui/components/shared/Modal';
import { Button } from '@/ui/components/shared/Button';
import { icons } from '@/utils/icons';
import { logger } from '@/utils/logger';
import { escapeHtml } from '@/utils/formatting';
import { isMapboxHost } from '@/utils/styleProviderUtils';
import { t, i18n } from '@/ui/translations';

const formLogger = logger.scope('RegionFormModal');
// import { themeManager } from '@/ui/managers/themeManager.js';

export interface RegionFormData {
  name: string;
  minZoom: number;
  maxZoom: number;
  styleUrl: string;
  bounds: [number, number, number, number];
  // Enhanced Mapbox GL support
  provider?: 'mapbox' | 'maplibre' | 'auto';
  accessToken?: string;
  /** Additional tile sources to download alongside the style's own sources */
  extraSources?: import('@/types/region').ExtraSource[];
}

/**
 * A tile source discovered on the live map, presented to the user for selection.
 */
export interface MapTileSource {
  /** Source ID as it appears in the style */
  id: string;
  /** Source type */
  type: 'vector' | 'raster' | 'raster-dem';
  /** Tile URL templates */
  tiles: string[];
  /** Min zoom level */
  minzoom?: number;
  /** Max zoom level */
  maxzoom?: number;
  /** Attribution */
  attribution?: string;
}

export interface RegionFormOptions {
  bounds: [number, number, number, number];
  area: number;
  onSave: (formData: RegionFormData) => Promise<void>;
  onCancel: () => void;
  onThemeToggle?: () => void;
  styleUrl: string;
  accessToken?: string;
  /** Tile sources discovered from the live map for user selection */
  mapSources?: MapTileSource[];
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
  // Extra sources picker
  private sourceCheckboxes: Map<string, { checkbox: HTMLInputElement; source: MapTileSource }> =
    new Map();

  constructor(options: RegionFormOptions) {
    this.options = options;
  }

  /**
   * Show the region form modal
   */
  public show(): HTMLDivElement {
    const { bounds, area } = this.options;

    const modalConfig: ModalConfig = {
      title: t('regionForm.title'),
      subtitle: t('regionForm.subtitle', { area: area.toString() }),
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
    form.className = 'flex flex-col gap-6 py-2';
    if (i18n.isRTL()) {
      form.setAttribute('dir', 'rtl');
    }

    // Region info display (Moved to top for better context)
    const infoGroup = document.createElement('div');
    infoGroup.className =
      'grid grid-cols-2 gap-4 p-4 rounded-xl glass-input border border-gray-100/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50';
    infoGroup.innerHTML = `
      <div class="flex flex-col justify-center">
        <strong class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">${t('regionForm.area')}</strong>
        <div class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300">
          ${area.toLocaleString()} <span class="text-sm font-medium text-gray-500">km²</span>
        </div>
      </div>
      <div>
        <strong class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">${t('regionForm.bounds')}</strong>
        <div class="text-xs font-mono text-gray-600 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-black/20 p-2 rounded-lg">
          ${west.toFixed(4)}, ${south.toFixed(4)}<br>
          ${east.toFixed(4)}, ${north.toFixed(4)}
        </div>
      </div>
    `;
    form.appendChild(infoGroup);

    // Region name input
    const nameGroup = document.createElement('div');
    nameGroup.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.name')}
      </label>
    `;
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = t('regionForm.namePlaceholder');
    this.nameInput.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm';
    nameGroup.appendChild(this.nameInput);
    form.appendChild(nameGroup);

    // Zoom range inputs
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'grid grid-cols-2 gap-4';

    const minZoomDiv = document.createElement('div');
    minZoomDiv.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.minZoom')}
      </label>
    `;
    this.minZoomInput = document.createElement('input');
    this.minZoomInput.type = 'number';
    this.minZoomInput.value = '1';
    this.minZoomInput.min = '0';
    this.minZoomInput.max = '20';
    this.minZoomInput.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm';
    minZoomDiv.appendChild(this.minZoomInput);

    const maxZoomDiv = document.createElement('div');
    maxZoomDiv.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.maxZoom')}
      </label>
    `;
    this.maxZoomInput = document.createElement('input');
    this.maxZoomInput.type = 'number';
    this.maxZoomInput.value = '15';
    this.maxZoomInput.min = '0';
    this.maxZoomInput.max = '20';
    this.maxZoomInput.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm';
    maxZoomDiv.appendChild(this.maxZoomInput);

    zoomGroup.appendChild(minZoomDiv);
    zoomGroup.appendChild(maxZoomDiv);
    form.appendChild(zoomGroup);

    // Style URL input
    const styleGroup = document.createElement('div');
    styleGroup.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.styleUrl')}
      </label>
    `;
    this.styleUrlInput = document.createElement('input');
    this.styleUrlInput.type = 'text';
    this.styleUrlInput.value = styleUrl;
    this.styleUrlInput.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm';
    this.styleUrlInput.addEventListener('input', () => this.handleStyleUrlChange());
    styleGroup.appendChild(this.styleUrlInput);
    form.appendChild(styleGroup);

    // Provider selection
    const providerGroup = document.createElement('div');
    providerGroup.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.provider')}
      </label>
    `;
    this.providerSelect = document.createElement('select');
    this.providerSelect.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all appearance-none cursor-pointer shadow-sm';
    this.providerSelect.innerHTML = `
      <option value="auto">${t('regionForm.providerAuto')}</option>
      <option value="mapbox">${t('regionForm.providerMapbox')}</option>
      <option value="maplibre">${t('regionForm.providerMaplibre')}</option>
    `;
    this.providerSelect.addEventListener('change', () => this.handleProviderChange());
    providerGroup.appendChild(this.providerSelect);

    // Add provider info
    const providerInfo = document.createElement('div');
    providerInfo.className =
      'text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1 flex items-center gap-1';
    providerInfo.innerHTML = `${icons.infoCircle({ size: 12 })} ${t('regionForm.providerInfo')}`;
    providerGroup.appendChild(providerInfo);

    form.appendChild(providerGroup);

    // Access Token input
    this.accessTokenGroup = document.createElement('div');
    this.accessTokenGroup.className = 'hidden';
    this.accessTokenGroup.innerHTML = `
      <label class="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.accessToken')}
        <span class="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">${t('regionForm.accessTokenRequired')}</span>
      </label>
    `;
    this.accessTokenInput = document.createElement('input');
    this.accessTokenInput.type = 'password';
    this.accessTokenInput.placeholder = 'pk.eyJ1...';
    this.accessTokenInput.className =
      'w-full px-4 py-3 rounded-xl text-base glass-input text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-sm';
    if (this.options.accessToken) {
      this.accessTokenInput.value = this.options.accessToken;
    }
    this.accessTokenGroup.appendChild(this.accessTokenInput);

    // Add access token help text
    const tokenHelp = document.createElement('div');
    tokenHelp.className = 'text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1';
    tokenHelp.innerHTML = `
      ${t('regionForm.accessTokenHelp')} <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">Mapbox Account</a>
    `;
    this.accessTokenGroup.appendChild(tokenHelp);

    form.appendChild(this.accessTokenGroup);

    // Extra sources picker
    if (this.options.mapSources && this.options.mapSources.length > 0) {
      const sourcesSection = this.createSourcesPicker(this.options.mapSources);
      form.appendChild(sourcesSection);
    }

    // Initialize provider detection
    this.detectProviderFromUrl();

    return form;
  }

  /**
   * Create the extra sources picker section
   */
  private createSourcesPicker(sources: MapTileSource[]): HTMLElement {
    const group = document.createElement('div');
    group.className = 'flex flex-col gap-3';

    // Header with label and select all/deselect all
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
      <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        ${t('regionForm.extraSources')}
      </label>
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className =
      'text-xs text-primary-600 dark:text-primary-400 hover:underline cursor-pointer font-medium';
    toggleBtn.textContent = t('regionForm.selectAll');
    let allSelected = false;
    toggleBtn.addEventListener('click', () => {
      allSelected = !allSelected;
      for (const { checkbox } of this.sourceCheckboxes.values()) {
        checkbox.checked = allSelected;
      }
      toggleBtn.textContent = allSelected ? t('regionForm.deselectAll') : t('regionForm.selectAll');
    });
    header.appendChild(toggleBtn);
    group.appendChild(header);

    // Info text
    const info = document.createElement('div');
    info.className = 'text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1';
    info.innerHTML = `${icons.infoCircle({ size: 12 })} ${t('regionForm.extraSourcesInfo')}`;
    group.appendChild(info);

    // Source list
    const list = document.createElement('div');
    list.className =
      'flex flex-col gap-2 max-h-48 overflow-y-auto p-3 rounded-xl glass-input border border-gray-100/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50';

    for (const source of sources) {
      const row = document.createElement('label');
      row.className =
        'flex items-center gap-3 p-2 rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/40 cursor-pointer transition-colors';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className =
        'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500/50 cursor-pointer flex-shrink-0';
      checkbox.value = source.id;
      row.appendChild(checkbox);

      this.sourceCheckboxes.set(source.id, { checkbox, source });

      const details = document.createElement('div');
      details.className = 'flex flex-col min-w-0';

      const nameRow = document.createElement('div');
      nameRow.className = 'flex items-center gap-2';

      const name = document.createElement('span');
      name.className = 'text-sm font-medium text-gray-800 dark:text-gray-200 truncate';
      name.textContent = source.id;
      nameRow.appendChild(name);

      const typeKey = `regionForm.sourceType.${source.type}` as Parameters<typeof t>[0];
      const badge = document.createElement('span');
      badge.className =
        source.type === 'vector'
          ? 'text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium flex-shrink-0'
          : source.type === 'raster'
            ? 'text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium flex-shrink-0'
            : 'text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium flex-shrink-0';
      badge.textContent = t(typeKey);
      nameRow.appendChild(badge);

      details.appendChild(nameRow);

      // Zoom range info
      const zoomMin = source.minzoom ?? 0;
      const zoomMax = source.maxzoom ?? 22;
      const meta = document.createElement('span');
      meta.className = 'text-[11px] text-gray-500 dark:text-gray-400 truncate';
      meta.textContent = `z${zoomMin}-${zoomMax}`;
      if (source.tiles.length > 0) {
        try {
          const hostname = new URL(source.tiles[0]).hostname;
          meta.textContent += ` · ${escapeHtml(hostname)}`;
        } catch {
          // ignore invalid URLs
        }
      }
      details.appendChild(meta);

      row.appendChild(details);
      list.appendChild(row);
    }

    group.appendChild(list);
    return group;
  }

  /**
   * Get the selected extra sources from the picker
   */
  private getSelectedExtraSources(): import('@/types/region').ExtraSource[] {
    const selected: import('@/types/region').ExtraSource[] = [];
    for (const { checkbox, source } of this.sourceCheckboxes.values()) {
      if (checkbox.checked) {
        selected.push({
          id: source.id,
          type: source.type,
          tiles: source.tiles,
          minzoom: source.minzoom,
          maxzoom: source.maxzoom,
          attribution: source.attribution,
        });
      }
    }
    return selected;
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
    if (styleUrl.startsWith('mapbox://') || isMapboxHost(styleUrl)) {
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
    if (i18n.isRTL()) {
      footer.setAttribute('dir', 'rtl');
    }

    // Cancel button
    const cancelButton = new Button({
      text: t('app.cancel'),
      variant: 'secondary',
      onClick: () => {
        this.modal?.hide();
        this.options.onCancel();
      },
    });

    // Save button
    const saveButton = new Button({
      text: t('regionForm.downloadRegion'),
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
      const selectedSources = this.getSelectedExtraSources();

      const formData: RegionFormData = {
        name: this.nameInput?.value || `Region ${Date.now()}`,
        minZoom: parseInt(this.minZoomInput?.value || '1'),
        maxZoom: parseInt(this.maxZoomInput?.value || '15'),
        styleUrl: this.styleUrlInput?.value || this.options.styleUrl,
        bounds: this.options.bounds,
        // Enhanced Mapbox GL support
        provider: this.providerSelect?.value as 'mapbox' | 'maplibre' | 'auto',
        accessToken: this.accessTokenInput?.value || undefined,
        extraSources: selectedSources.length > 0 ? selectedSources : undefined,
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
