import type { StoredRegion, ImportExportOptions, ExportResult, ImportResult, RegionImportData } from '../../types';

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
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 class="text-xl font-semibold text-gray-900">
            Import/Export: ${this.options.region.name || this.options.region.id}
          </h2>
          <button type="button" class="close-btn text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Export Section -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                </svg>
                Export Region
              </h3>
              
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                  <select class="export-format w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="json">JSON (Complete)</option>
                    <option value="pmtiles">PMTiles (Tiles Only)</option>
                    <option value="mbtiles">MBTiles (Tiles Only)</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-gray-700">Include Components</label>
                  <div class="space-y-2">
                    <label class="flex items-center">
                      <input type="checkbox" class="include-style mr-2" checked>
                      <span class="text-sm text-gray-700">Style Configuration</span>
                    </label>
                    <label class="flex items-center">
                      <input type="checkbox" class="include-tiles mr-2" checked>
                      <span class="text-sm text-gray-700">Tiles</span>
                    </label>
                    <label class="flex items-center">
                      <input type="checkbox" class="include-sprites mr-2" checked>
                      <span class="text-sm text-gray-700">Sprites & Icons</span>
                    </label>
                    <label class="flex items-center">
                      <input type="checkbox" class="include-fonts mr-2" checked>
                      <span class="text-sm text-gray-700">Fonts & Glyphs</span>
                    </label>
                  </div>
                </div>

                <div class="export-progress hidden">
                  <div class="bg-gray-200 rounded-full h-2 mb-2">
                    <div class="export-progress-bar bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p class="export-progress-text text-sm text-gray-600">Preparing export...</p>
                </div>

                <button class="export-btn w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                  Export Region
                </button>
              </div>
            </div>

            <!-- Import Section -->
            <div class="space-y-4">
              <h3 class="text-lg font-medium text-gray-900 flex items-center">
                <svg class="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                Import Region
              </h3>

              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                  <input type="file" class="import-file w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                         accept=".json,.pmtiles,.mbtiles">
                  <p class="mt-1 text-xs text-gray-500">Supports JSON, PMTiles, and MBTiles formats</p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">New Region Name (Optional)</label>
                  <input type="text" class="import-name w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                         placeholder="Leave empty to use original name">
                </div>

                <div class="flex items-center">
                  <input type="checkbox" class="import-overwrite mr-2">
                  <label class="text-sm text-gray-700">Overwrite if region exists</label>
                </div>

                <div class="import-progress hidden">
                  <div class="bg-gray-200 rounded-full h-2 mb-2">
                    <div class="import-progress-bar bg-green-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p class="import-progress-text text-sm text-gray-600">Preparing import...</p>
                </div>

                <button class="import-btn w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors" disabled>
                  Import Region
                </button>
              </div>
            </div>
          </div>

          <!-- Region Info -->
          <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Current Region Info</h4>
            <div class="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span class="font-medium">ID:</span> ${this.options.region.id}
              </div>
              <div>
                <span class="font-medium">Name:</span> ${this.options.region.name || 'Unnamed'}
              </div>
              <div>
                <span class="font-medium">Zoom:</span> ${this.options.region.minZoom}-${this.options.region.maxZoom}
              </div>
              <div>
                <span class="font-medium">Created:</span> ${new Date(this.options.region.created).toLocaleDateString()}
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
