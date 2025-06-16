/**
 * Panel Renderer Component
 * Handles rendering of the main offline manager panel
 * Refactored to use modular components
 */

import { OfflineMapManager } from '../../managers/offlineMapManager';
import { DownloadManager } from './downloadManager';
import { ModalManager } from '../modals/ModalManager';
import { RegionDetailsModal } from '../modals/regionDetailsModal';
import { ConfirmationModal } from '../modals/confirmationModal';
import { ImportExportModal } from '../modals/importExportModal';
import { formatBytes } from '../../utils/formatting';
import { themeManager } from '../ThemeManager';
import { icons } from '../../utils/icons';

// Import modular components
import { List, ListItemConfig } from '../components/shared/List';
import { Button } from '../components/shared/Button';
import { BaseComponent } from '../components/shared/BaseComponent';
// Patch the style for offline use (convert URLs to idb:// URLs)
import { patchStyleForOffline } from '../../utils/styleUtils';
import type { IControl, Map as MaplibreMap } from 'maplibre-gl';

export interface PanelRendererOptions {
  offlineManager: OfflineMapManager;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  onClose: () => void;
  onAddRegion: () => void;
  onFocusRegion: (regionId: string) => void;
  showBbox?: boolean;
  map?: MaplibreMap;
}

export class PanelRenderer extends BaseComponent {
  private offlineManager: OfflineMapManager;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private options: PanelRendererOptions;
  private map?: MaplibreMap;

  // UI Components
  private headerContainer?: HTMLElement;
  private actionButtonsContainer?: HTMLElement;
  private regionsList?: List;
  private downloadProgressContainer?: HTMLElement;
  
  // Debounce mechanism
  private refreshTimeout?: NodeJS.Timeout;
  private isRefreshing = false;

  constructor(options: PanelRendererOptions) {
    super({});
    this.offlineManager = options.offlineManager;
    this.downloadManager = options.downloadManager;
    this.modalManager = options.modalManager;
    this.options = options;
    this.map = options.map;
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className =
      'h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden';
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

      console.log('📊 Panel data loaded:', { regions, analytics });

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
    this.headerContainer.className =
      'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700';

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
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full',
      icon: this.getThemeIcon(),
      title: 'Toggle theme',
      onClick: () => this.handleThemeToggle(),
    });

    // Close button
    const closeButton = new Button({
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full',
      icon: icons.x({ size: 16, color: 'currentColor' }),
      title: 'Close',
      onClick: this.options.onClose,
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
    this.actionButtonsContainer.className =
      'flex gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700';

    // Add Region button
    const addRegionButton = new Button({
      text: 'Add Region',
      variant: 'primary',
      icon: icons.plus({ size: 16, color: 'white' }),
      onClick: this.options.onAddRegion,
    });

    // Refresh button
    const refreshButton = new Button({
      text: 'Refresh',
      variant: 'secondary',
      icon: icons.refresh({ size: 16, color: 'currentColor' }),
      onClick: () => this.refresh(),
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
      this.downloadProgressContainer.className =
        'px-6 py-4 border-b border-gray-200 dark:border-gray-700';

      const downloads = this.downloadManager.getCurrentDownloads();
      const progressHTML = this.createDownloadProgressHTML(downloads);
      this.downloadProgressContainer.innerHTML = progressHTML;

      this.element.appendChild(this.downloadProgressContainer);
    }
  }

  /**
   * Render styles list with regions grouped under each style
   */
  private async renderRegionsList(regions: any[]): Promise<void> {
    console.log('🗂️ Rendering regions list with regions:', regions);
    
    // Remove existing list
    if (this.regionsList) {
      this.regionsList.destroy();
    }

    try {
      // Load styles from IndexedDB and get stats
      const { loadStyles, getStyleStats } = await import('../../services/styleService');
      const styles = await loadStyles();
      const statsResult = await getStyleStats();
      console.log('🎨 Loaded styles:', styles);
      console.log('📈 Style stats:', statsResult);
      
      const sizeMap: Record<string, number> = {};
      statsResult.styles.forEach(s => {
        sizeMap[s.id] = s.size;
      });

      // Group regions by style ID
      const regionsByStyle = this.groupRegionsByStyle(regions);
      console.log('📊 Regions grouped by style:', regionsByStyle);

      // Create styles and regions list
      const listItems: ListItemConfig[] = [];

      // If we have stored styles, show them with their regions
      if (styles.length > 0) {
        for (const style of styles) {
          const styleRegions = regionsByStyle[style.key] || [];
          const dbSize = sizeMap[style.key] || 0;
          // Add style item with embedded regions and DB size
          const styleWithSize = { ...style, dbSize };
          listItems.push({
            id: `style-${style.key}`,
            data: { ...styleWithSize, isStyle: true },
            template: this.createCompleteStyleTemplate(styleWithSize, styleRegions),
            actions: [
              {
                label: 'Load Style',
                action: 'load-style',
                icon: icons.cloud({ size: 12, color: 'currentColor' }),
              },
              {
                label: 'Delete Style',
                action: 'delete-style',
                variant: 'danger',
                icon: icons.trash({ size: 12, color: 'currentColor' }),
              },
            ],
          });
        }
      }

      // Add regions without styles (orphaned regions)
      const orphanedRegions = regionsByStyle['unknown'] || regionsByStyle[''] || [];
      if (orphanedRegions.length > 0) {
        // Add header for orphaned regions
        listItems.push({
          id: 'orphaned-header',
          data: { isOrphanedHeader: true },
          template: this.createOrphanedRegionsHeaderTemplate(orphanedRegions),
          actions: [],
        });

        // Add orphaned regions
        orphanedRegions.forEach(region => {
          listItems.push({
            id: region.id,
            data: region,
            template: this.createRegionItemTemplate(region, false),
            actions: [
              {
                label: 'Details',
                action: 'show-details',
                icon: icons.infoCircle({ size: 12, color: 'currentColor' }),
              },
              {
                label: 'Focus',
                action: 'focus-region',
                icon: icons.focus({ size: 12, color: 'currentColor' }),
              },
              // {
              //   label: 'Import/Export',
              //   action: 'import-export',
              //   icon: icons.deviceFloppy({ size: 12, color: 'currentColor' })
              // },
              {
                label: 'Delete',
                action: 'delete-region',
                variant: 'danger',
                icon: icons.trash({ size: 12, color: 'currentColor' }),
              },
            ],
          });
        });
      }

      // Create list component
      this.regionsList = new List({
        className: 'flex-1 px-6 py-4 overflow-y-auto',
        items: listItems,
        emptyText: 'No offline styles or regions found. Click "Add Region" to get started.',
        onItemAction: this.handleItemAction.bind(this),
        onItemClick: (itemId: string, item: any) => {
          if (item.isStyle) {
            // Handle style click - could expand/collapse or other action
            return;
          }
          if (!item.isOrphanedHeader) {
            this.handleShowRegionDetails(itemId);
          }
        },
      });

      this.element.appendChild(this.regionsList.getElement());

      // Add event delegation for embedded region action buttons
      this.addRegionActionEventListeners();
    } catch (error) {
      console.error('Error loading styles or rendering list:', error);
      // Fallback to simple regions list
      this.renderFallbackRegionsList(regions);
    }
  }

  /**
   * Create region item template
   */
  private createRegionItemTemplate(region: any, isGrouped: boolean = false): string {
    const containerClass = isGrouped
      ? 'bg-slate-50 dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-600'
      : 'bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow duration-150';

    return `
      <div class="${containerClass}">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h4 class="font-medium text-slate-800 dark:text-slate-100 text-sm">
              ${region.name}
            </h4>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ${region.bounds ? `${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)} to ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}` : 'No bounds'}
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
              <span>Zoom: ${region.minZoom}-${region.maxZoom}</span>
              ${region.downloadedAt ? `<span>Downloaded: ${new Date(region.downloadedAt).toLocaleDateString()}</span>` : ''}
              ${region.size ? `<span>Size: ${formatBytes(region.size)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create complete style template with header, HR, and regions
   */
  private createCompleteStyleTemplate(style: any, regions: any[]): string {
    const regionCount = regions.length;
    const totalSize = regions.reduce((sum, region) => sum + (region.size || 0), 0);

    // Style header HTML
    const styleHeader = `
      <div class="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl p-0 mb-4 overflow-hidden shadow-sm">
        <!-- Style Header -->
        <div class="p-4 bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-700 dark:to-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-base">
                ${style.style?.name || style.key || 'Unnamed Style'}
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Style ID: ${style.key}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                ${regionCount} region${regionCount === 1 ? '' : 's'} • ${formatBytes(totalSize)}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Stored Style Size: ${formatBytes(style.dbSize || 0)}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-emerald-500 dark:text-emerald-400">
                ${icons.map({ size: 24, color: 'currentColor' })}
              </div>
            </div>
          </div>
        </div>
        
        <!-- HR Separator -->
        <hr class="border-slate-200 dark:border-slate-600 border-t">
        
        <!-- Regions List -->
        ${regions.map(region => this.createRegionItemForStyle(region)).join('')}
      </div>
    `;

    return styleHeader;
  }

  /**
   * Create region item specifically for embedding within a style container
   */
  private createRegionItemForStyle(region: any): string {
    return `
      <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer region-item transition-colors duration-150" data-region-id="${region.id}">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h4 class="font-medium text-slate-800 dark:text-slate-100 text-sm">
              ${region.name}
            </h4>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ${region.bounds ? `${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)} to ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}` : 'No bounds'}
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
              <span>Zoom: ${region.minZoom}-${region.maxZoom}</span>
              ${region.downloadedAt ? `<span>Downloaded: ${new Date(region.downloadedAt).toLocaleDateString()}</span>` : ''}
              ${region.size ? `<span>Size: ${formatBytes(region.size)}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <button class="region-action-btn p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors duration-150" data-action="show-details" data-region-id="${region.id}" title="Details">
              ${icons.infoCircle({ size: 14, color: 'currentColor' })}
            </button>
            <button class="region-action-btn p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors duration-150" data-action="focus-region" data-region-id="${region.id}" title="Focus">
              ${icons.focus({ size: 14, color: 'currentColor' })}
            </button>
            <!-- <button class="region-action-btn p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 transition-colors duration-150" data-action="import-export" data-region-id="${region.id}" title="Import/Export">
              ${icons.deviceFloppy({ size: 14, color: 'currentColor' })}
            </button> -->
            <button class="region-action-btn p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors duration-150" data-action="delete-region" data-region-id="${region.id}" title="Delete">
              ${icons.trash({ size: 14, color: 'currentColor' })}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create style item template with load button
   */
  private createStyleItemTemplate(style: any, regions: any[]): string {
    const regionCount = regions.length;
    const totalSize = regions.reduce((sum, region) => sum + (region.size || 0), 0);

    return `
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-0 mb-4 overflow-hidden">
        <!-- Style Header -->
        <div class="p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-blue-900 dark:text-blue-100 text-base">
                ${style.style?.name || style.key || 'Unnamed Style'}
              </h3>
              <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Style ID: ${style.key}
              </p>
              <p class="text-sm text-blue-600 dark:text-blue-400 mt-1">
                ${regionCount} region${regionCount === 1 ? '' : 's'} • ${formatBytes(totalSize)}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-blue-400 dark:text-blue-500">
                ${icons.map({ size: 24, color: 'currentColor' })}
              </div>
            </div>
          </div>
        </div>
        
        <!-- HR Separator -->
        <hr class="border-blue-200 dark:border-blue-800 border-t">
        
        <!-- Regions will be added after this div -->
      </div>
    `;
  }

  /**
   * Create orphaned regions header template
   */
  private createOrphanedRegionsHeaderTemplate(regions: any[]): string {
    return `
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-amber-800 dark:text-amber-200 text-sm">
              Regions without Style
            </h3>
            <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
              ${regions.length} region${regions.length === 1 ? '' : 's'} not associated with any style
            </p>
          </div>
          <div class="text-amber-500 dark:text-amber-400">
            ${icons.alertTriangle({ size: 16, color: 'currentColor' })}
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
          ${downloadArray
            .map(
              download => `
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-800 dark:text-blue-200">${download.regionName || download.id}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 transition-all duration-300" style="width: ${download.progress || 0}%"></div>
                </div>
                <span class="text-blue-700 dark:text-blue-300 min-w-[3rem]">${Math.round(download.progress || 0)}%</span>
              </div>
            </div>
          `
            )
            .join('')}
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
        onExport: result => {
          console.log('Export completed:', result);
          // Handle export result - could show success message
          this.offlineManager.downloadExportedRegion(result);
        },
        onImport: result => {
          console.log('Import completed:', result);
          // Refresh the panel to show updated regions
          this.refresh();
        },
        exportRegion: async (
          regionId: string,
          format: 'json' | 'pmtiles' | 'mbtiles',
          options?
        ) => {
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
        importRegion: async data => {
          // Delegate to offline manager's import functionality
          return await this.offlineManager.importRegion(data);
        },
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
   * Add event listeners for embedded region action buttons
   */
  private addRegionActionEventListeners(): void {
    const listElement = this.regionsList?.getElement();
    if (!listElement) return;

    // Add event delegation for region action buttons
    listElement.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const actionButton = target.closest('.region-action-btn') as HTMLElement;

      if (actionButton) {
        event.preventDefault();
        event.stopPropagation();

        const action = actionButton.dataset.action;
        const regionId = actionButton.dataset.regionId;

        if (action && regionId) {
          // Find the region data from the stored regions
          this.handleEmbeddedRegionAction(action, regionId);
        }
      }

      // Handle region item click (for details)
      const regionItem = target.closest('.region-item') as HTMLElement;
      if (regionItem && !actionButton) {
        const regionId = regionItem.dataset.regionId;
        if (regionId) {
          this.handleShowRegionDetails(regionId);
        }
      }
    });
  }

  /**
   * Handle actions for embedded region buttons
   */
  private async handleEmbeddedRegionAction(action: string, regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: any) => r.id === regionId);

      if (!region) {
        console.warn('Region not found:', regionId);
        return;
      }

      // Use the existing region action handler
      this.handleRegionAction(action, regionId, region);
    } catch (error) {
      console.error('Error handling embedded region action:', error);
    }
  }

  /**
   * Fallback renderer for regions list when styles fail to load
   */
  private async renderFallbackRegionsList(regions: any[]): Promise<void> {
    // Remove existing list
    if (this.regionsList) {
      this.regionsList.destroy();
    }

    const listItems: ListItemConfig[] = regions.map(region => ({
      id: region.id,
      data: region,
      template: this.createRegionItemTemplate(region, false),
      actions: [
        {
          label: 'Details',
          action: 'show-details',
          icon: icons.infoCircle({ size: 12, color: 'currentColor' }),
        },
        {
          label: 'Focus',
          action: 'focus-region',
          icon: icons.focus({ size: 12, color: 'currentColor' }),
        },
        // {
        //   label: 'Import/Export',
        //   action: 'import-export',
        //   icon: icons.deviceFloppy({ size: 12, color: 'currentColor' })
        // },
        {
          label: 'Delete',
          action: 'delete-region',
          variant: 'danger',
          icon: icons.trash({ size: 12, color: 'currentColor' }),
        },
      ],
    }));

    // Create list component
    this.regionsList = new List({
      className: 'flex-1 px-6 py-4 overflow-y-auto',
      items: listItems,
      emptyText: 'No offline regions found. Click "Add Region" to get started.',
      onItemAction: this.handleItemAction.bind(this),
      onItemClick: (itemId: string, item: any) => {
        this.handleShowRegionDetails(itemId);
      },
    });

    this.element.appendChild(this.regionsList.getElement());
  }

  /**
   * Refresh the panel content
   */
  public async refresh(): Promise<void> {
    // Debounce mechanism to prevent multiple rapid refreshes
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    if (this.isRefreshing) {
      console.log('🔄 Refresh already in progress, skipping...');
      return;
    }

    this.refreshTimeout = setTimeout(async () => {
      await this.performRefresh();
    }, 100); // 100ms debounce
  }

  /**
   * Perform the actual refresh
   */
  private async performRefresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;
    
    try {
      // Clear the current element content before re-rendering
      this.element.innerHTML = '';
      
      // Reset component references to avoid stale references
      this.headerContainer = undefined;
      this.actionButtonsContainer = undefined;
      this.downloadProgressContainer = undefined;
      if (this.regionsList) {
        this.regionsList.destroy();
        this.regionsList = undefined;
      }

      // Load fresh data
      const [regions, analytics] = await Promise.all([
        this.offlineManager.listStoredRegions(),
        this.offlineManager.getComprehensiveStorageAnalytics(),
      ]);

      console.log('🔄 Refreshing panel data:', { regions, analytics });

      // Re-render components
      await this.renderHeader(regions, analytics);
      await this.renderActionButtons();
      await this.renderDownloadProgress();
      await this.renderRegionsList(regions);
    } catch (error) {
      console.error('Error refreshing panel:', error);
      this.renderErrorState(this.element as HTMLDivElement);
    } finally {
      this.isRefreshing = false;
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

  /**
   * Group regions by style ID
   */
  private groupRegionsByStyle(regions: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    regions.forEach(region => {
      const styleId = region.styleId || 'unknown';
      if (!grouped[styleId]) {
        grouped[styleId] = [];
      }
      grouped[styleId].push(region);
    });

    return grouped;
  }

  /**
   * Handle actions for both styles and regions
   */
  private handleItemAction(action: string, itemId: string, itemData: any): void {
    if (itemData.isStyle) {
      this.handleStyleAction(action, itemId, itemData);
    } else {
      this.handleRegionAction(action, itemId, itemData);
    }
  }

  /**
   * Handle style-specific actions
   */
  private async handleStyleAction(action: string, styleId: string, styleData: any): Promise<void> {
    switch (action) {
      case 'load-style':
        await this.handleLoadStyle(styleData);
        break;
      case 'delete-style':
        await this.handleDeleteStyle(styleId, styleData);
        break;
      default:
        console.warn('Unknown style action:', action);
    }
  }

  /**
   * Handle loading a style to the map
   */
  private async handleLoadStyle(styleData: any): Promise<void> {
    if (!this.map) {
      console.warn('Map not available for loading style');
      return;
    }

    try {
      console.log('🎨 Loading style to map:', styleData.key);
      console.log('🔍 Style data structure:', {
        hasStyle: !!styleData.style,
        styleKeys: styleData.style ? Object.keys(styleData.style) : [],
        sources: styleData.style?.sources ? Object.keys(styleData.style.sources) : [],
        layers: styleData.style?.layers ? styleData.style.layers.length : 0
      });

      // Check if the style has the necessary structure
      if (!styleData.style) {
        console.error('❌ Style data is missing the "style" property');
        return;
      }

      if (!styleData.style.sources) {
        console.error('❌ Style is missing sources');
        return;
      }

      console.log('🔧 Patching style for offline use...');
      const patchedStyle = patchStyleForOffline(styleData.style, styleData.key);
      
      console.log('✅ Style patched successfully');
      console.log('🔍 Patched style sources:', Object.keys(patchedStyle.sources || {}));
      
      // Apply the patched style to the map
      console.log('🗺️ Applying style to map...');
      this.map.setStyle(patchedStyle as any);

      console.log('✅ Voyager/Style loaded successfully with offline patches');
    } catch (error) {
      console.error('❌ Error loading style to map:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        styleData: styleData
      });
    }
  }

  /**
   * Handle deleting a style
   */
  private async handleDeleteStyle(styleId: string, styleData: any): Promise<void> {
    try {
      const confirmModal = new ConfirmationModal({
        title: 'Delete Style',
        message: `Are you sure you want to delete the style "${styleData.style?.name || styleData.key}"? This action cannot be undone and will affect associated regions.`,
        confirmText: 'Delete Style',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            const { deleteStyleById } = await import('../../services/styleService');
            await deleteStyleById(styleData.key);
            this.modalManager.close();
            // Refresh the panel
            await this.refresh();
          } catch (error) {
            console.error('Failed to delete style:', error);
          }
        },
        onCancel: () => {
          this.modalManager.close();
        },
      });

      const modal = confirmModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      console.error('Error deleting style:', error);
    }
  }
}
