/**
 * Panel Renderer Component
 * Handles rendering of the main offline manager panel
 * Refactored to use modular components
 */

import { OfflineMapManager } from '../../managers/offlineMapManager';
import { DownloadManager } from './DownloadManager';
import { ModalManager } from '../modals/ModalManager';
import { RegionDetailsModal } from '../modals/RegionDetailsModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { ImportExportModal } from '../modals/ImportExportModal';
import { formatBytes } from '../../utils/formatting';
import { themeManager } from '../ThemeManager';
import { icons } from '../../utils/icons';

// Import modular components
import { List, ListItemConfig } from '../components/shared/List';
import { Button } from '../components/shared/Button';
import { BaseComponent } from '../components/shared/BaseComponent';

export interface PanelRendererOptions {
  offlineManager: OfflineMapManager;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  onClose: () => void;
  onAddRegion: () => void;
  onFocusRegion: (regionId: string) => void;
}

export class PanelRenderer extends BaseComponent {
  private offlineManager: OfflineMapManager;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private options: PanelRendererOptions;
  
  // UI Components
  private headerContainer?: HTMLElement;
  private actionButtonsContainer?: HTMLElement;
  private regionsList?: List;
  private downloadProgressContainer?: HTMLElement;

  constructor(options: PanelRendererOptions) {
    super({});
    this.offlineManager = options.offlineManager;
    this.downloadManager = options.downloadManager;
    this.modalManager = options.modalManager;
    this.options = options;
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden';
    return container;
  }

  /**
   * Render the main panel content
   */
  public async render(panelElement: HTMLDivElement): Promise<void> {
    if (!panelElement) return;

    try {
      // Clear and setup container
      panelElement.innerHTML = '';
      panelElement.appendChild(this.element);

      // Load data
      const [regions, analytics] = await Promise.all([
        this.offlineManager.listStoredRegions(),
        this.offlineManager.getComprehensiveStorageAnalytics(),
      ]);

      // Render components
      await this.renderHeader(regions, analytics);
      await this.renderActionButtons();
      await this.renderDownloadProgress();
      await this.renderRegionsList(regions);

    } catch (error) {
      console.error('Error rendering panel:', error);
      this.renderErrorState(panelElement);
    }
  }

  /**
   * Render header section
   */
  private async renderHeader(regions: any[], analytics: any): Promise<void> {
    if (this.headerContainer) {
      this.element.removeChild(this.headerContainer);
    }

    this.headerContainer = document.createElement('div');
    this.headerContainer.className = 'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700';

    // Title section
    const titleSection = document.createElement('div');
    titleSection.innerHTML = `
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Offline Manager</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        ${regions.length} regions • ${formatBytes(analytics.totalStorageSize)} total
      </p>
    `;

    // Actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'flex items-center gap-2';

    // Theme toggle button
    const themeButton = new Button({
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
      icon: this.getThemeIcon(),
      title: 'Toggle theme',
      onClick: () => this.handleThemeToggle()
    });

    // Close button
    const closeButton = new Button({
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
      icon: icons.x({ size: 16, color: 'currentColor' }),
      title: 'Close',
      onClick: this.options.onClose
    });

    actionsSection.appendChild(themeButton.getElement());
    actionsSection.appendChild(closeButton.getElement());

    this.headerContainer.appendChild(titleSection);
    this.headerContainer.appendChild(actionsSection);
    this.element.appendChild(this.headerContainer);
  }

  /**
   * Render action buttons section
   */
  private async renderActionButtons(): Promise<void> {
    if (this.actionButtonsContainer) {
      this.element.removeChild(this.actionButtonsContainer);
    }

    this.actionButtonsContainer = document.createElement('div');
    this.actionButtonsContainer.className = 'flex gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700';

    // Add Region button
    const addRegionButton = new Button({
      text: 'Add Region',
      variant: 'primary',
      icon: icons.plus({ size: 16, color: 'white' }),
      onClick: this.options.onAddRegion
    });

    // Refresh button
    const refreshButton = new Button({
      text: 'Refresh',
      variant: 'secondary',
      icon: icons.refresh({ size: 16, color: 'currentColor' }),
      onClick: () => this.refresh()
    });

    this.actionButtonsContainer.appendChild(addRegionButton.getElement());
    this.actionButtonsContainer.appendChild(refreshButton.getElement());
    this.element.appendChild(this.actionButtonsContainer);
  }

  /**
   * Render download progress section
   */
  private async renderDownloadProgress(): Promise<void> {
    // Remove existing if present
    if (this.downloadProgressContainer) {
      this.element.removeChild(this.downloadProgressContainer);
      this.downloadProgressContainer = undefined;
    }

    // Only show if there are active downloads
    if (this.downloadManager?.hasActiveDownloads()) {
      this.downloadProgressContainer = document.createElement('div');
      this.downloadProgressContainer.className = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700';
      
      const downloads = this.downloadManager.getCurrentDownloads();
      const progressHTML = this.createDownloadProgressHTML(downloads);
      this.downloadProgressContainer.innerHTML = progressHTML;
      
      this.element.appendChild(this.downloadProgressContainer);
    }
  }

  /**
   * Render regions list
   */
  private async renderRegionsList(regions: any[]): Promise<void> {
    // Remove existing list
    if (this.regionsList) {
      this.regionsList.destroy();
    }

    // Create regions list items
    const listItems: ListItemConfig[] = regions.map(region => ({
      id: region.id,
      data: region,
      template: this.createRegionItemTemplate(region),
      actions: [
        {
          label: 'Details',
          action: 'show-details',
          icon: icons.infoCircle({ size: 12, color: 'currentColor' })
        },
        {
          label: 'Focus',
          action: 'focus-region',
          icon: icons.focus({ size: 12, color: 'currentColor' })
        },
        {
          label: 'Import/Export',
          action: 'import-export',
          icon: icons.deviceFloppy({ size: 12, color: 'currentColor' })
        },
        {
          label: 'Delete',
          action: 'delete-region',
          variant: 'danger',
          icon: icons.trash({ size: 12, color: 'currentColor' })
        }
      ]
    }));

    // Create list component
    this.regionsList = new List({
      className: 'flex-1 px-6 py-4 overflow-y-auto',
      items: listItems,
      emptyText: 'No offline regions found. Click "Add Region" to get started.',
      onItemAction: this.handleRegionAction.bind(this),
      onItemClick: (itemId: string, item: any) => this.handleShowRegionDetails(itemId)
    });

    this.element.appendChild(this.regionsList.getElement());
  }

  /**
   * Create region item template
   */
  private createRegionItemTemplate(region: any): string {
    return `
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <h3 class="font-medium text-gray-900 dark:text-white">${region.name}</h3>
          <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ${region.bounds ? `${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)} to ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}` : 'No bounds'}
          </div>
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>Zoom: ${region.minZoom}-${region.maxZoom}</span>
            ${region.downloadedAt ? `<span>Downloaded: ${new Date(region.downloadedAt).toLocaleDateString()}</span>` : ''}
            ${region.size ? `<span>Size: ${formatBytes(region.size)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create download progress HTML
   */
  private createDownloadProgressHTML(downloads: Map<string, any>): string {
    const downloadArray = Array.from(downloads.values());
    return `
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
          Active Downloads (${downloadArray.length})
        </h3>
        <div class="space-y-2">
          ${downloadArray.map(download => `
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-800 dark:text-blue-200">${download.regionName || download.id}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 transition-all duration-300" style="width: ${download.progress || 0}%"></div>
                </div>
                <span class="text-blue-700 dark:text-blue-300 min-w-[3rem]">${Math.round(download.progress || 0)}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Handle region actions
   */
  private handleRegionAction(action: string, regionId: string, regionData: any): void {
    switch (action) {
      case 'show-details':
        this.handleShowRegionDetails(regionId);
        break;
      case 'focus-region':
        this.options.onFocusRegion(regionId);
        break;
      case 'import-export':
        this.handleImportExport(regionId, regionData);
        break;
      case 'delete-region':
        this.handleDeleteRegion(regionId);
        break;
      default:
        console.warn('Unknown region action:', action);
    }
  }

  /**
   * Handle showing region details
   */
  private async handleShowRegionDetails(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: any) => r.id === regionId);
      
      if (!region) return;

      const detailsModal = new RegionDetailsModal({
        region,
        onFocus: () => {
          this.modalManager.close();
          this.options.onFocusRegion(regionId);
        },
        onClose: () => {
          this.modalManager.close();
        },
      });

      const modal = detailsModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      console.error('Error showing region details:', error);
    }
  }

  /**
   * Handle deleting a region
   */
  private async handleDeleteRegion(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: any) => r.id === regionId);
      
      if (!region) return;

      const confirmModal = new ConfirmationModal({
        title: 'Delete Region',
        message: `Are you sure you want to delete the region "${region.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            await this.offlineManager.deleteRegion(regionId);
            this.modalManager.close();
            // Refresh the panel to show updated regions
            await this.refresh();
          } catch (error) {
            console.error('Failed to delete region:', error);
            // Could show error modal here
          }
        },
        onCancel: () => {
          this.modalManager.close();
        },
      });

      const modal = confirmModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      console.error('Error deleting region:', error);
    }
  }

  /**
   * Handle import/export functionality
   */
  private async handleImportExport(regionId: string, regionData: any): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: any) => r.id === regionId);
      
      if (!region) return;

      const importExportModal = new ImportExportModal({
        region,
        onClose: () => {
          this.modalManager.close();
        },
        onExport: (result) => {
          console.log('Export completed:', result);
          // Handle export result - could show success message
          this.offlineManager.downloadExportedRegion(result);
        },
        onImport: (result) => {
          console.log('Import completed:', result);
          // Refresh the panel to show updated regions
          this.refresh();
        },
        exportRegion: async (regionId: string, format: 'json' | 'pmtiles' | 'mbtiles', options?) => {
          // Delegate to offline manager's export functionality
          switch (format) {
            case 'json':
              return await this.offlineManager.exportRegionAsJSON(regionId, options);
            case 'pmtiles':
              return await this.offlineManager.exportRegionAsPMTiles(regionId, options as any);
            case 'mbtiles':
              return await this.offlineManager.exportRegionAsMBTiles(regionId, options as any);
            default:
              throw new Error(`Unsupported export format: ${format}`);
          }
        },
        importRegion: async (data) => {
          // Delegate to offline manager's import functionality
          return await this.offlineManager.importRegion(data);
        }
      });

      const modal = importExportModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      console.error('Error showing import/export modal:', error);
    }
  }

  /**
   * Handle theme toggle
   */
  private handleThemeToggle(): void {
    const currentTheme = themeManager.getTheme();
    const newTheme = currentTheme.mode === 'dark' ? 'light' : 'dark';
    themeManager.setTheme(newTheme);
    
    // Refresh to update theme
    this.refresh();
  }

  /**
   * Get theme icon based on current theme
   */
  private getThemeIcon(): string {
    const currentTheme = themeManager.getTheme();
    if (currentTheme.mode === 'dark') {
      return icons.sun({ size: 16, color: 'currentColor' });
    } else {
      return icons.moon({ size: 16, color: 'currentColor' });
    }
  }

  /**
   * Render error state
   */
  private renderErrorState(panelElement: HTMLDivElement): void {
    panelElement.innerHTML = `
      <div class="flex items-center justify-center h-full text-red-600 dark:text-red-400">
        <div class="text-center">
          <p class="text-lg font-medium">Error loading content</p>
          <p class="text-sm mt-2">Please try again</p>
        </div>
      </div>
    `;
  }

  /**
   * Refresh the panel content
   */
  public async refresh(): Promise<void> {
    // Re-render with current container
    const container = this.element.parentElement as HTMLDivElement;
    if (container) {
      await this.render(container);
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  public destroy(): void {
    if (this.regionsList) {
      this.regionsList.destroy();
    }
    super.destroy();
  }
}
