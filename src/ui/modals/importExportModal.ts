/**
 * Import/Export Modal Component
 * Handles import/export operations for regions
 */

import { icons } from '../../utils/icons';
import type { 
  StoredRegion, 
  ImportExportOptions, 
  ExportResult, 
  ImportResult, 
  RegionImportData 
} from '../../types';

export interface ImportExportModalOptions {
  region: StoredRegion;
  onClose: () => void;
  onExport?: (result: ExportResult) => void;
  onImport?: (result: ImportResult) => void;
  exportRegion?: (regionId: string, format: 'json' | 'pmtiles' | 'mbtiles', options?: ImportExportOptions) => Promise<ExportResult>;
  importRegion?: (data: RegionImportData) => Promise<ImportResult>;
}

export class ImportExportModal {
  private modal: HTMLDivElement;
  private options: ImportExportModalOptions;
  private isExporting = false;
  private isImporting = false;

  constructor(options: ImportExportModalOptions) {
    this.options = options;
    this.modal = this.createModal();
    this.attachEventListeners();
  }

  show(): HTMLDivElement {
    document.body.appendChild(this.modal);
    document.body.style.overflow = 'hidden';
    
    // Focus first input for accessibility
    const firstInput = this.modal.querySelector('input, button') as HTMLElement;
    if (firstInput) {
      firstInput.focus();
    }
    
    return this.modal;
  }

  hide(): void {
    if (this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    document.body.style.overflow = '';
    this.options.onClose();
  }

  private createModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            ${icons.deviceFloppy({ size: 24, color: 'currentColor' })}
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                Import/Export Region
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ${this.options.region.name || this.options.region.id}
              </p>
            </div>
          </div>
          <button type="button" class="close-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            ${icons.x({ size: 24, color: 'currentColor' })}
          </button>
        </div>

        <div class="p-6">
          <!-- Region Info Card -->
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
          </div>

          <!-- Export/Import Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Export Section -->
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                ${icons.upload({ size: 20, color: 'rgb(59 130 246)' })}
                Export Region
              </h3>
              
              <div class="space-y-4">
                <!-- Format Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Export Format
                  </label>
                  <select class="export-format w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="json">JSON - Complete data (recommended)</option>
                    <option value="pmtiles">PMTiles - Web optimized tiles</option>
                    <option value="mbtiles">MBTiles - Industry standard</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Choose format based on your use case</p>
                </div>

                <!-- Export Options -->
                <div class="export-options">
                  <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Include Components
                  </label>
                  <div class="space-y-2">
                    <label class="flex items-center gap-2">
                      <input type="checkbox" class="include-style rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800" checked>
                      <span class="text-sm text-gray-700 dark:text-gray-300">Style Configuration</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input type="checkbox" class="include-tiles rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800" checked>
                      <span class="text-sm text-gray-700 dark:text-gray-300">Map Tiles</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input type="checkbox" class="include-sprites rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800" checked>
                      <span class="text-sm text-gray-700 dark:text-gray-300">Sprites & Icons</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input type="checkbox" class="include-fonts rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800" checked>
                      <span class="text-sm text-gray-700 dark:text-gray-300">Fonts & Glyphs</span>
                    </label>
                  </div>
                </div>

                <!-- Export Progress -->
                <div class="export-progress hidden">
                  <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                    <div class="export-progress-bar bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p class="export-progress-text text-sm text-gray-600 dark:text-gray-400">Preparing export...</p>
                </div>

                <!-- Export Button -->
                <button class="export-btn w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-sm text-sm font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors duration-200">
                  ${icons.download({ size: 16, color: 'white' })}
                  Export Region
                </button>
              </div>
            </div>

            <!-- Import Section -->
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                ${icons.upload({ size: 20, color: 'rgb(34 197 94)' })}
                Import Region
              </h3>

              <div class="space-y-4">
                <!-- File Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Select File
                  </label>
                  <input type="file" class="import-file w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent file:mr-4 file:py-1 file:px-2 file:rounded-sm file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900 dark:file:text-green-400" 
                         accept=".json,.pmtiles,.mbtiles">
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Supports JSON, PMTiles, and MBTiles formats
                  </p>
                </div>

                <!-- New Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    New Region Name (Optional)
                  </label>
                  <input type="text" class="import-name w-full p-2 border border-gray-300 dark:border-gray-600 rounded-sm text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" 
                         placeholder="Leave empty to use original name">
                </div>

                <!-- Import Options -->
                <div>
                  <label class="flex items-center gap-2">
                    <input type="checkbox" class="import-overwrite rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 dark:bg-gray-800">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Overwrite if region exists</span>
                  </label>
                </div>

                <!-- Import Progress -->
                <div class="import-progress hidden">
                  <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                    <div class="import-progress-bar bg-green-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p class="import-progress-text text-sm text-gray-600 dark:text-gray-400">Preparing import...</p>
                </div>

                <!-- Import Button -->
                <button class="import-btn w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white border-0 rounded-sm text-sm font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>
                  ${icons.upload({ size: 16, color: 'white' })}
                  Import Region
                </button>
              </div>
            </div>
          </div>

          <!-- Format Guide -->
          <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  private attachEventListeners(): void {
    // Close modal
    const closeBtn = this.modal.querySelector('.close-btn') as HTMLElement;
    closeBtn?.addEventListener('click', () => this.hide());

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Export functionality
    const exportBtn = this.modal.querySelector('.export-btn') as HTMLButtonElement;
    const exportFormat = this.modal.querySelector('.export-format') as HTMLSelectElement;
    
    exportBtn?.addEventListener('click', () => this.handleExport());

    // Import functionality
    const importFile = this.modal.querySelector('.import-file') as HTMLInputElement;
    const importBtn = this.modal.querySelector('.import-btn') as HTMLButtonElement;
    
    importFile?.addEventListener('change', () => {
      importBtn.disabled = !importFile.files?.length;
    });

    importBtn?.addEventListener('click', () => this.handleImport());

    // Format change handling
    exportFormat?.addEventListener('change', () => {
      this.updateExportOptions();
    });

    this.updateExportOptions();
  }

  private updateExportOptions(): void {
    const format = (this.modal.querySelector('.export-format') as HTMLSelectElement)?.value;
    const styleCheckbox = this.modal.querySelector('.include-style') as HTMLInputElement;
    const spritesCheckbox = this.modal.querySelector('.include-sprites') as HTMLInputElement;
    const fontsCheckbox = this.modal.querySelector('.include-fonts') as HTMLInputElement;

    // Disable non-tile options for PMTiles and MBTiles
    if (format === 'pmtiles' || format === 'mbtiles') {
      styleCheckbox.disabled = true;
      spritesCheckbox.disabled = true;
      fontsCheckbox.disabled = true;
      styleCheckbox.checked = false;
      spritesCheckbox.checked = false;
      fontsCheckbox.checked = false;
    } else {
      styleCheckbox.disabled = false;
      spritesCheckbox.disabled = false;
      fontsCheckbox.disabled = false;
    }
  }

  private async handleExport(): Promise<void> {
    if (this.isExporting || !this.options.exportRegion) return;

    this.isExporting = true;
    const exportBtn = this.modal.querySelector('.export-btn') as HTMLButtonElement;
    const progressDiv = this.modal.querySelector('.export-progress') as HTMLElement;
    const progressBar = this.modal.querySelector('.export-progress-bar') as HTMLElement;
    const progressText = this.modal.querySelector('.export-progress-text') as HTMLElement;

    try {
      exportBtn.disabled = true;
      progressDiv.classList.remove('hidden');

      const format = (this.modal.querySelector('.export-format') as HTMLSelectElement).value as 'json' | 'pmtiles' | 'mbtiles';
      const includeStyle = (this.modal.querySelector('.include-style') as HTMLInputElement).checked;
      const includeTiles = (this.modal.querySelector('.include-tiles') as HTMLInputElement).checked;
      const includeSprites = (this.modal.querySelector('.include-sprites') as HTMLInputElement).checked;
      const includeFonts = (this.modal.querySelector('.include-fonts') as HTMLInputElement).checked;

      const options: ImportExportOptions = {
        format,
        includeStyle,
        includeTiles,
        includeSprites,
        includeFonts,
        onProgress: (progress) => {
          progressBar.style.width = `${progress.percentage}%`;
          progressText.textContent = progress.message;
        }
      };

      const result = await this.options.exportRegion(this.options.region.id, format, options);
      
      if (result.success) {
        progressText.textContent = 'Export complete! Download will start shortly...';
        
        // Auto-download
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.options.onExport?.(result);
        
        setTimeout(() => this.hide(), 1500);
      } else {
        throw new Error('Export failed');
      }

    } catch (error) {
      progressText.textContent = `Export failed: ${error instanceof Error ? error.message : String(error)}`;
      progressBar.style.width = '0%';
      console.error('Export error:', error instanceof Error ? error.message : String(error));
    } finally {
      this.isExporting = false;
      exportBtn.disabled = false;
      setTimeout(() => {
        progressDiv.classList.add('hidden');
        progressBar.style.width = '0%';
      }, 3000);
    }
  }

  private async handleImport(): Promise<void> {
    if (this.isImporting || !this.options.importRegion) return;

    const fileInput = this.modal.querySelector('.import-file') as HTMLInputElement;
    const nameInput = this.modal.querySelector('.import-name') as HTMLInputElement;
    const overwriteCheckbox = this.modal.querySelector('.import-overwrite') as HTMLInputElement;

    if (!fileInput.files?.length) return;

    this.isImporting = true;
    const importBtn = this.modal.querySelector('.import-btn') as HTMLButtonElement;
    const progressDiv = this.modal.querySelector('.import-progress') as HTMLElement;
    const progressBar = this.modal.querySelector('.import-progress-bar') as HTMLElement;
    const progressText = this.modal.querySelector('.import-progress-text') as HTMLElement;

    try {
      importBtn.disabled = true;
      progressDiv.classList.remove('hidden');

      const file = fileInput.files[0];
      const extension = file.name.split('.').pop()?.toLowerCase();
      let format: 'json' | 'pmtiles' | 'mbtiles';

      switch (extension) {
        case 'json':
          format = 'json';
          break;
        case 'pmtiles':
          format = 'pmtiles';
          break;
        case 'mbtiles':
          format = 'mbtiles';
          break;
        default:
          throw new Error('Unsupported file format');
      }

      const importData: RegionImportData = {
        file,
        format,
        overwrite: overwriteCheckbox.checked,
        newRegionName: nameInput.value.trim() || undefined
      };

      progressText.textContent = 'Reading file...';
      progressBar.style.width = '25%';

      const result = await this.options.importRegion(importData);

      if (result.success) {
        progressBar.style.width = '100%';
        progressText.textContent = `Import complete! ${result.statistics.tilesImported} tiles imported.`;
        
        this.options.onImport?.(result);
        
        setTimeout(() => this.hide(), 2000);
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      progressText.textContent = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
      progressBar.style.width = '0%';
      console.error('Import error:', error instanceof Error ? error.message : String(error));
    } finally {
      this.isImporting = false;
      importBtn.disabled = fileInput.files?.length ? false : true;
      setTimeout(() => {
        progressDiv.classList.add('hidden');
        progressBar.style.width = '0%';
      }, 3000);
    }
  }
}
