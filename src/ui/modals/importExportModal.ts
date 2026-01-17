/**
 * Import/Export Modal Component
 * Handles import/export operations for regions
 * Refactored to use modular Modal component for consistency
 */

import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import { icons } from '../../utils/icons';
import { logger } from '../../utils/logger';
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
      title: 'Import/Export Region',
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
    card.className =
      'p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700';

    card.innerHTML = `
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        ${icons.mapPin({ size: 16, color: 'currentColor' })}
        Region Information
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300">ID:</span>
          <div class="text-gray-600 dark:text-gray-400 break-all">${this.options.region.id}</div>
        </div>
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Name:</span>
          <div class="text-gray-600 dark:text-gray-400">${this.options.region.name || 'Unnamed'}</div>
        </div>
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Zoom:</span>
          <div class="text-gray-600 dark:text-gray-400">Z${this.options.region.minZoom}-${this.options.region.maxZoom}</div>
        </div>
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Created:</span>
          <div class="text-gray-600 dark:text-gray-400">${new Date(this.options.region.created).toLocaleDateString()}</div>
        </div>
      </div>
    `;

    return card;
  }

  private createExportSection(): HTMLElement {
    const section = document.createElement('div');
    section.className =
      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6';

    const header = document.createElement('h3');
    header.className =
      'text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2';
    header.innerHTML = `
      ${icons.upload({ size: 20, color: 'rgb(59 130 246)' })}
      Export Region
    `;
    section.appendChild(header);

    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-4';

    // Format Selection
    const formatGroup = document.createElement('div');
    const formatLabel = document.createElement('label');
    formatLabel.className = 'block text-sm font-medium text-gray-900 dark:text-white mb-2';
    formatLabel.textContent = 'Export Format';

    this.exportFormatSelect = document.createElement('select');
    this.exportFormatSelect.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
    this.exportFormatSelect.innerHTML = `
      <option value="json">JSON - Complete data (recommended)</option>
      <option value="pmtiles">PMTiles - Web optimized tiles</option>
      <option value="mbtiles">MBTiles - Industry standard</option>
    `;

    const formatHint = document.createElement('p');
    formatHint.className = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
    formatHint.textContent = 'Choose format based on your use case';

    formatGroup.appendChild(formatLabel);
    formatGroup.appendChild(this.exportFormatSelect);
    formatGroup.appendChild(formatHint);
    formContainer.appendChild(formatGroup);

    // Export Options
    const optionsGroup = document.createElement('div');
    const optionsLabel = document.createElement('label');
    optionsLabel.className = 'block text-sm font-medium text-gray-900 dark:text-white mb-2';
    optionsLabel.textContent = 'Include Components';

    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'space-y-2';

    const createCheckbox = (text: string, checked = true) => {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.className =
        'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 dark:bg-gray-700';

      const span = document.createElement('span');
      span.className = 'text-sm text-gray-700 dark:text-gray-300';
      span.textContent = text;

      label.appendChild(input);
      label.appendChild(span);

      return { label, input };
    };

    const styleCheck = createCheckbox('Style Configuration');
    this.includeStyleCheckbox = styleCheck.input;
    checkboxContainer.appendChild(styleCheck.label);

    const tilesCheck = createCheckbox('Map Tiles');
    this.includeTilesCheckbox = tilesCheck.input;
    checkboxContainer.appendChild(tilesCheck.label);

    const spritesCheck = createCheckbox('Sprites & Icons');
    this.includeSpritesCheckbox = spritesCheck.input;
    checkboxContainer.appendChild(spritesCheck.label);

    const fontsCheck = createCheckbox('Fonts & Glyphs');
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
    this.exportProgressText.textContent = 'Preparing export...';

    progressContainer.appendChild(progressBarContainer);
    progressContainer.appendChild(this.exportProgressText);
    formContainer.appendChild(progressContainer);

    // Export Button
    const exportButton = new Button({
      text: 'Export Region',
      variant: 'primary',
      icon: icons.download({ size: 16, color: 'white' }),
      className: 'w-full',
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
      'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6';

    const header = document.createElement('h3');
    header.className =
      'text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2';
    header.innerHTML = `
      ${icons.upload({ size: 20, color: 'rgb(34 197 94)' })}
      Import Region
    `;
    section.appendChild(header);

    const formContainer = document.createElement('div');
    formContainer.className = 'space-y-4';

    // File Selection
    const fileGroup = document.createElement('div');
    const fileLabel = document.createElement('label');
    fileLabel.className = 'block text-sm font-medium text-gray-900 dark:text-white mb-2';
    fileLabel.textContent = 'Select File';

    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.json,.pmtiles,.mbtiles';
    this.importFileInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-400';

    const fileHint = document.createElement('p');
    fileHint.className = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
    fileHint.textContent = 'Supports JSON, PMTiles, and MBTiles formats';

    fileGroup.appendChild(fileLabel);
    fileGroup.appendChild(this.importFileInput);
    fileGroup.appendChild(fileHint);
    formContainer.appendChild(fileGroup);

    // New Name
    const nameGroup = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-sm font-medium text-gray-900 dark:text-white mb-2';
    nameLabel.textContent = 'New Region Name (Optional)';

    this.importNameInput = document.createElement('input');
    this.importNameInput.type = 'text';
    this.importNameInput.placeholder = 'Leave empty to use original name';
    this.importNameInput.className =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.importNameInput);
    formContainer.appendChild(nameGroup);

    // Import Options
    const overwriteLabel = document.createElement('label');
    overwriteLabel.className = 'flex items-center gap-2';

    this.importOverwriteCheckbox = document.createElement('input');
    this.importOverwriteCheckbox.type = 'checkbox';
    this.importOverwriteCheckbox.className =
      'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2 dark:bg-gray-700';

    const overwriteSpan = document.createElement('span');
    overwriteSpan.className = 'text-sm text-gray-700 dark:text-gray-300';
    overwriteSpan.textContent = 'Overwrite if region exists';

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
    this.importProgressText.textContent = 'Preparing import...';

    progressContainer.appendChild(progressBarContainer);
    progressContainer.appendChild(this.importProgressText);
    formContainer.appendChild(progressContainer);

    // Import Button
    const importButton = new Button({
      text: 'Import Region',
      variant: 'success',
      icon: icons.upload({ size: 16, color: 'white' }),
      className: 'w-full',
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
    guide.className =
      'p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800';

    guide.innerHTML = `
      <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
        ${icons.infoCircle({ size: 16, color: 'currentColor' })}
        Format Guide
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div class="font-medium text-blue-800 dark:text-blue-300">JSON</div>
          <div class="text-blue-700 dark:text-blue-400">Complete data, human-readable, best for development</div>
        </div>
        <div>
          <div class="font-medium text-blue-800 dark:text-blue-300">PMTiles</div>
          <div class="text-blue-700 dark:text-blue-400">Web-optimized, efficient serving, cloud-friendly</div>
        </div>
        <div>
          <div class="font-medium text-blue-800 dark:text-blue-300">MBTiles</div>
          <div class="text-blue-700 dark:text-blue-400">Industry standard, SQLite-based, cross-platform</div>
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
        this.exportProgressText.textContent = 'Export complete!';
      }

      this.options.onExport?.(result);

      // Hide modal after short delay
      setTimeout(() => this.hide(), 1500);
    } catch (error) {
      modalLogger.error('Export error:', error instanceof Error ? error.message : String(error));
      if (this.exportProgressText) {
        this.exportProgressText.textContent = 'Export failed. Please try again.';
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
        this.importProgressText.textContent = 'Import complete!';
      }

      this.options.onImport?.(result);

      // Hide modal after short delay
      setTimeout(() => this.hide(), 1500);
    } catch (error) {
      modalLogger.error('Import error:', error instanceof Error ? error.message : String(error));
      if (this.importProgressText) {
        this.importProgressText.textContent = 'Import failed. Please try again.';
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

    const closeButton = new Button({
      text: 'Close',
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
