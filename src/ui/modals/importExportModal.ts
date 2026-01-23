/**
 * Import/Export Modal Component
 * Handles import/export operations for regions
 * Refactored to use modular Modal component for consistency
 */

import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import { icons } from '../../utils/icons';
import { logger } from '../../utils/logger';
import { t, i18n } from '../translations';
import type {
  StoredRegion,
  ImportExportOptions,
  ExportResult,
  ImportResult,
  RegionImportData,
} from '../../types';

const modalLogger = logger.scope('ImportExportModal');

export interface ImportExportModalOptions {
  region: StoredRegion;
  onClose: () => void;
  onExport?: (result: ExportResult) => void;
  onImport?: (result: ImportResult) => void;
  exportRegion?: (
    regionId: string,
    format: 'json' | 'pmtiles' | 'mbtiles',
    options?: ImportExportOptions
  ) => Promise<ExportResult>;
  importRegion?: (data: RegionImportData) => Promise<ImportResult>;
}

export class ImportExportModal {
  private modal?: Modal;
  private options: ImportExportModalOptions;
  private isExporting = false;
  private isImporting = false;

  // Form elements
  private exportFormatSelect?: HTMLSelectElement;
  private includeStyleCheckbox?: HTMLInputElement;
  private includeTilesCheckbox?: HTMLInputElement;
  private includeSpritesCheckbox?: HTMLInputElement;
  private includeFontsCheckbox?: HTMLInputElement;
  private exportProgressBar?: HTMLDivElement;
  private exportProgressText?: HTMLParagraphElement;
  private exportButton?: HTMLButtonElement;

  private importFileInput?: HTMLInputElement;
  private importNameInput?: HTMLInputElement;
  private importOverwriteCheckbox?: HTMLInputElement;
  private importProgressBar?: HTMLDivElement;
  private importProgressText?: HTMLParagraphElement;
  private importButton?: HTMLButtonElement;

  constructor(options: ImportExportModalOptions) {
    this.options = options;
  }

  public show(): HTMLDivElement {
    const modalConfig: ModalConfig = {
      title: t('importExport.regionTitle'),
      subtitle: this.options.region.name || this.options.region.id,
      size: 'md',
      closable: true,
      onClose: () => this.hide(),
    };

    this.modal = new Modal(modalConfig);

    // Create content
    const content = this.createContent();
    this.modal.setContent(content);

    // Create footer with close button
    const footer = this.createFooter();
    this.modal.setFooter(footer);

    this.modal.show();
    this.attachEventListeners();

    return this.modal.getElement() as HTMLDivElement;
  }

  public hide(): void {
    this.modal?.hide();
    this.options.onClose();
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'flex flex-col gap-6';
    if (i18n.isRTL()) {
      content.setAttribute('dir', 'rtl');
    }

    // Region Info Card
    const infoCard = this.createRegionInfoCard();
    content.appendChild(infoCard);

    // Export/Import Grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 gap-6';

    // Export Section
    const exportSection = this.createExportSection();
    gridContainer.appendChild(exportSection);

    // Import Section
    const importSection = this.createImportSection();
    gridContainer.appendChild(importSection);

    content.appendChild(gridContainer);

    // Format Guide
    const formatGuide = this.createFormatGuide();
    content.appendChild(formatGuide);

    return content;
  }

  private createRegionInfoCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'p-5 glass-input rounded-xl border-0 bg-gray-50/50 dark:bg-gray-800/50';

    card.innerHTML = `
      <h4 class="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        ${icons.mapPin({ size: 16, color: 'currentColor' })}
        ${t('importExport.regionInfo')}
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="p-3 rounded-lg bg-white/40 dark:bg-black/20">
          <span class="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">${t('importExport.id')}</span>
          <div class="text-gray-900 dark:text-white font-mono text-xs break-all mt-1">${this.options.region.id}</div>
        </div>
        <div class="p-3 rounded-lg bg-white/40 dark:bg-black/20">
          <span class="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">${t('importExport.name')}</span>
          <div class="text-gray-900 dark:text-white font-medium mt-1">${this.options.region.name || t('importExport.unnamed')}</div>
        </div>
        <div class="p-3 rounded-lg bg-white/40 dark:bg-black/20">
          <span class="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">${t('importExport.zoom')}</span>
          <div class="text-gray-900 dark:text-white font-medium mt-1">Z${this.options.region.minZoom}-${this.options.region.maxZoom}</div>
        </div>
        <div class="p-3 rounded-lg bg-white/40 dark:bg-black/20">
          <span class="font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">${t('importExport.created')}</span>
          <div class="text-gray-900 dark:text-white font-medium mt-1">${new Date(this.options.region.created).toLocaleDateString()}</div>
        </div>
      </div>
    `;

    return card;
  }

  private createExportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className =
      'glass-input p-6 rounded-xl border-0 bg-white/40 dark:bg-gray-800/40 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300';

    // Gradient accent
    const accent = document.createElement('div');
    accent.className = `absolute top-0 ${i18n.isRTL() ? 'right-0' : 'left-0'} w-1 h-full bg-blue-500 opacity-50`;
    section.appendChild(accent);

    const header = document.createElement('h3');
    header.className =
      'text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2.5';
    header.innerHTML = `
      <div class="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
        ${icons.upload({ size: 20, color: 'currentColor' })}
      </div>
      ${t('importExport.exportRegion')}
    `;
    section.appendChild(header);

    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-5';

    // Format Selection
    const formatGroup = document.createElement('div');
    const formatLabel = document.createElement('label');
    formatLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
    formatLabel.textContent = t('importExport.exportFormat');

    this.exportFormatSelect = document.createElement('select');
    this.exportFormatSelect.className =
      'w-full px-4 py-3 rounded-xl text-sm glass-input text-gray-900 dark:text-white bg-white/50 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all';
    this.exportFormatSelect.innerHTML = `
      <option value="json">${t('importExport.formatJson')}</option>
      <option value="pmtiles">${t('importExport.formatPmtiles')}</option>
      <option value="mbtiles">${t('importExport.formatMbtiles')}</option>
    `;

    const formatHint = document.createElement('p');
    formatHint.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 ml-1';
    formatHint.textContent = t('importExport.formatHint');

    formatGroup.appendChild(formatLabel);
    formatGroup.appendChild(this.exportFormatSelect);
    formatGroup.appendChild(formatHint);
    formContainer.appendChild(formatGroup);

    // Export Options
    const optionsGroup = document.createElement('div');
    const optionsLabel = document.createElement('label');
    optionsLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3';
    optionsLabel.textContent = t('importExport.includeComponents');

    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';

    const createCheckbox = (text: string, checked = true) => {
      const label = document.createElement('label');
      label.className =
        'flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.className =
        'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 dark:bg-gray-700';

      const span = document.createElement('span');
      span.className = 'text-sm text-gray-700 dark:text-gray-300 font-medium';
      span.textContent = text;

      label.appendChild(input);
      label.appendChild(span);

      return { label, input };
    };

    const styleCheck = createCheckbox(t('importExport.styleConfig'));
    this.includeStyleCheckbox = styleCheck.input;
    checkboxContainer.appendChild(styleCheck.label);

    const tilesCheck = createCheckbox(t('importExport.mapTiles'));
    this.includeTilesCheckbox = tilesCheck.input;
    checkboxContainer.appendChild(tilesCheck.label);

    const spritesCheck = createCheckbox(t('importExport.spritesIcons'));
    this.includeSpritesCheckbox = spritesCheck.input;
    checkboxContainer.appendChild(spritesCheck.label);

    const fontsCheck = createCheckbox(t('importExport.fontsGlyphs'));
    this.includeFontsCheckbox = fontsCheck.input;
    checkboxContainer.appendChild(fontsCheck.label);

    optionsGroup.appendChild(optionsLabel);
    optionsGroup.appendChild(checkboxContainer);
    formContainer.appendChild(optionsGroup);

    // Export Progress (hidden by default)
    const progressContainer = document.createElement('div');
    progressContainer.className = 'hidden';

    const progressBarContainer = document.createElement('div');
    progressBarContainer.className =
      'bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden';

    this.exportProgressBar = document.createElement('div');
    this.exportProgressBar.className = 'bg-blue-600 h-2 rounded-full transition-all duration-300';
    this.exportProgressBar.style.width = '0%';

    progressBarContainer.appendChild(this.exportProgressBar);

    this.exportProgressText = document.createElement('p');
    this.exportProgressText.className = 'text-sm text-gray-600 dark:text-gray-400';
    this.exportProgressText.textContent = t('importExport.preparingExport');

    progressContainer.appendChild(progressBarContainer);
    progressContainer.appendChild(this.exportProgressText);
    formContainer.appendChild(progressContainer);

    // Export Button
    const exportButton = new Button({
      text: t('importExport.exportRegion'),
      variant: 'primary',
      icon: icons.download({ size: 16, color: 'white' }),
      className: 'w-full py-2.5 text-base shadow-lg shadow-blue-500/20', // Premium button styles
      onClick: () => this.handleExport(),
    });
    this.exportButton = exportButton.getElement() as HTMLButtonElement;
    formContainer.appendChild(this.exportButton);

    section.appendChild(formContainer);
    return section;
  }

  private createImportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className =
      'glass-input p-6 rounded-xl border-0 bg-white/40 dark:bg-gray-800/40 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300';

    // Gradient accent
    const accent = document.createElement('div');
    accent.className = `absolute top-0 ${i18n.isRTL() ? 'right-0' : 'left-0'} w-1 h-full bg-green-500 opacity-50`;
    section.appendChild(accent);

    const header = document.createElement('h3');
    header.className =
      'text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2.5';
    header.innerHTML = `
      <div class="p-2 bg-green-500/10 rounded-lg text-green-600 dark:text-green-400">
        ${icons.upload({ size: 20, color: 'currentColor' })}
      </div>
      ${t('importExport.importRegion')}
    `;
    section.appendChild(header);

    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-5';

    // File Selection
    const fileGroup = document.createElement('div');
    const fileLabel = document.createElement('label');
    fileLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
    fileLabel.textContent = t('importExport.selectFile');

    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.json,.pmtiles,.mbtiles';
    this.importFileInput.className =
      'w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-400 glass-input transition-all cursor-pointer';

    const fileHint = document.createElement('p');
    fileHint.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 ml-1';
    fileHint.textContent = t('importExport.fileFormatsHint');

    fileGroup.appendChild(fileLabel);
    fileGroup.appendChild(this.importFileInput);
    fileGroup.appendChild(fileHint);
    formContainer.appendChild(fileGroup);

    // New Name
    const nameGroup = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
    nameLabel.textContent = t('importExport.newRegionName');

    this.importNameInput = document.createElement('input');
    this.importNameInput.type = 'text';
    this.importNameInput.placeholder = t('importExport.newRegionNamePlaceholder');
    this.importNameInput.className =
      'w-full px-4 py-3 rounded-xl text-sm glass-input text-gray-900 dark:text-white bg-white/50 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all';

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.importNameInput);
    formContainer.appendChild(nameGroup);

    // Import Options
    const overwriteLabel = document.createElement('label');
    overwriteLabel.className =
      'flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors';

    this.importOverwriteCheckbox = document.createElement('input');
    this.importOverwriteCheckbox.type = 'checkbox';
    this.importOverwriteCheckbox.className =
      'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 focus:ring-2 dark:bg-gray-700';

    const overwriteSpan = document.createElement('span');
    overwriteSpan.className = 'text-sm text-gray-700 dark:text-gray-300 font-medium';
    overwriteSpan.textContent = t('importExport.overwriteIfExists');

    overwriteLabel.appendChild(this.importOverwriteCheckbox);
    overwriteLabel.appendChild(overwriteSpan);
    formContainer.appendChild(overwriteLabel);

    // Import Progress (hidden by default)
    const progressContainer = document.createElement('div');
    progressContainer.className = 'hidden';

    const progressBarContainer = document.createElement('div');
    progressBarContainer.className =
      'bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden';

    this.importProgressBar = document.createElement('div');
    this.importProgressBar.className = 'bg-green-600 h-2 rounded-full transition-all duration-300';
    this.importProgressBar.style.width = '0%';

    progressBarContainer.appendChild(this.importProgressBar);

    this.importProgressText = document.createElement('p');
    this.importProgressText.className = 'text-sm text-gray-600 dark:text-gray-400';
    this.importProgressText.textContent = t('importExport.preparingImport');

    progressContainer.appendChild(progressBarContainer);
    progressContainer.appendChild(this.importProgressText);
    formContainer.appendChild(progressContainer);

    // Import Button
    const importButton = new Button({
      text: t('importExport.importRegion'),
      variant: 'success', // Assuming 'success' variant exists in Button component, if not might need style adjustment. Assuming it works based on previous code.
      icon: icons.upload({ size: 16, color: 'white' }),
      className: 'w-full py-2.5 text-base shadow-lg shadow-green-500/20',
      disabled: true,
      onClick: () => this.handleImport(),
    });
    this.importButton = importButton.getElement() as HTMLButtonElement;
    formContainer.appendChild(this.importButton);

    section.appendChild(formContainer);
    return section;
  }

  private createFormatGuide(): HTMLElement {
    const guide = document.createElement('div');
    guide.className = 'p-5 mt-4 glass-input rounded-xl border-0 bg-blue-50/40 dark:bg-blue-900/20';

    guide.innerHTML = `
      <h4 class="text-sm font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
        ${icons.infoCircle({ size: 16, color: 'currentColor' })}
        ${t('importExport.formatGuide')}
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div class="p-3 rounded-lg bg-white/50 dark:bg-black/20">
          <div class="font-bold text-base text-blue-800 dark:text-blue-300 mb-1">JSON</div>
          <div class="text-blue-700 dark:text-blue-400 leading-relaxed">${t('importExport.jsonDesc')}</div>
        </div>
        <div class="p-3 rounded-lg bg-white/50 dark:bg-black/20">
          <div class="font-bold text-base text-blue-800 dark:text-blue-300 mb-1">PMTiles</div>
          <div class="text-blue-700 dark:text-blue-400 leading-relaxed">${t('importExport.pmtilesDesc')}</div>
        </div>
        <div class="p-3 rounded-lg bg-white/50 dark:bg-black/20">
          <div class="font-bold text-base text-blue-800 dark:text-blue-300 mb-1">MBTiles</div>
          <div class="text-blue-700 dark:text-blue-400 leading-relaxed">${t('importExport.mbtilesDesc')}</div>
        </div>
      </div>
    `;

    return guide;
  }

  private attachEventListeners(): void {
    // Enable import button when file is selected
    if (this.importFileInput && this.importButton) {
      this.importFileInput.addEventListener('change', () => {
        if (this.importFileInput?.files && this.importFileInput.files.length > 0) {
          if (this.importButton) {
            this.importButton.disabled = false;
          }
        } else {
          if (this.importButton) {
            this.importButton.disabled = true;
          }
        }
      });
    }
  }

  private async handleExport(): Promise<void> {
    if (this.isExporting || !this.options.exportRegion) return;

    this.isExporting = true;
    if (this.exportButton) this.exportButton.disabled = true;

    try {
      const format = this.exportFormatSelect?.value as 'json' | 'pmtiles' | 'mbtiles';
      const options: ImportExportOptions = {
        includeStyle: this.includeStyleCheckbox?.checked ?? true,
        includeTiles: this.includeTilesCheckbox?.checked ?? true,
        includeSprites: this.includeSpritesCheckbox?.checked ?? true,
        includeFonts: this.includeFontsCheckbox?.checked ?? true,
      };

      // Show progress
      const progressContainer = this.exportProgressBar?.parentElement?.parentElement;
      if (progressContainer) {
        progressContainer.classList.remove('hidden');
      }

      const result = await this.options.exportRegion(this.options.region.id, format, options);

      if (this.exportProgressBar) {
        this.exportProgressBar.style.width = '100%';
      }
      if (this.exportProgressText) {
        this.exportProgressText.textContent = t('importExport.exportComplete');
      }

      this.options.onExport?.(result);

      // Hide modal after short delay
      setTimeout(() => this.hide(), 1500);
    } catch (error) {
      modalLogger.error('Export error:', error instanceof Error ? error.message : String(error));
      if (this.exportProgressText) {
        this.exportProgressText.textContent = t('importExport.exportFailed');
        this.exportProgressText.classList.add('text-red-600', 'dark:text-red-400');
      }
    } finally {
      this.isExporting = false;
      if (this.exportButton) this.exportButton.disabled = false;
    }
  }

  private async handleImport(): Promise<void> {
    if (this.isImporting || !this.options.importRegion || !this.importFileInput?.files?.[0]) return;

    this.isImporting = true;
    if (this.importButton) this.importButton.disabled = true;

    try {
      const file = this.importFileInput.files[0];
      const overwrite = this.importOverwriteCheckbox?.checked ?? false;

      // Show progress
      const progressContainer = this.importProgressBar?.parentElement?.parentElement;
      if (progressContainer) {
        progressContainer.classList.remove('hidden');
      }

      // Determine format from file extension
      const format = file.name.endsWith('.pmtiles')
        ? 'pmtiles'
        : file.name.endsWith('.mbtiles')
          ? 'mbtiles'
          : 'json';

      const data: RegionImportData = {
        file,
        format,
        overwrite,
      };

      const result = await this.options.importRegion(data);

      if (this.importProgressBar) {
        this.importProgressBar.style.width = '100%';
      }
      if (this.importProgressText) {
        this.importProgressText.textContent = t('importExport.importComplete');
      }

      this.options.onImport?.(result);

      // Hide modal after short delay
      setTimeout(() => this.hide(), 1500);
    } catch (error) {
      modalLogger.error('Import error:', error instanceof Error ? error.message : String(error));
      if (this.importProgressText) {
        this.importProgressText.textContent = t('importExport.importFailed');
        this.importProgressText.classList.add('text-red-600', 'dark:text-red-400');
      }
    } finally {
      this.isImporting = false;
      if (this.importButton) this.importButton.disabled = false;
    }
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    if (i18n.isRTL()) {
      footer.setAttribute('dir', 'rtl');
    }

    const closeButton = new Button({
      text: t('app.close'),
      variant: 'secondary',
      onClick: () => this.hide(),
    });
    footer.appendChild(closeButton.getElement());

    return footer;
  }

  public destroy(): void {
    this.modal?.destroy();
  }
}
