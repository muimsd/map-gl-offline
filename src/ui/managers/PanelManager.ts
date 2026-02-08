/**
 * Panel Renderer Component
 * Handles rendering of the main offline manager panel
 * Refactored to use modular components
 */

import { OfflineMapManager } from '../../managers/offlineMapManager';
import { DownloadManager } from './downloadManager';
import { ModalManager } from '../modals/modalManager';
import { RegionDetailsModal } from '../modals/regionDetailsModal';
import { StoredRegion, StorageAnalyticsReport } from '../../types';
import { ConfirmationModal } from '../modals/confirmationModal';
import { ImportExportModal } from '../modals/importExportModal';
import { formatBytes, escapeHtml } from '../../utils/formatting';
import { themeManager } from '../ThemeManager';
import { logger } from '../../utils/logger';
import { i18n, t } from '../translations';

const panelLogger = logger.scope('PanelManager');

import { icons } from '../../utils/icons';
import type { MapboxStyle, StyleStorageItem } from '../../types/style';

// Import modular components
import { List, ListItemConfig } from '../components/shared/List';
import { Button } from '../components/shared/Button';
import { BaseComponent } from '../components/shared/BaseComponent';
import { LanguageSelector } from '../components/shared/LanguageSelector';

// Map type for MapLibre GL
type MaplibreMap = unknown;
// import { IControl } from 'maplibre-gl';

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
  private languageSelector?: LanguageSelector;

  // Debounce mechanism
  private refreshTimeout?: NodeJS.Timeout;
  private isRefreshing = false;

  // Language change unsubscribe function
  private unsubscribeLanguage?: () => void;

  // Stored event handler for cleanup
  private regionActionHandler?: (event: Event) => void;

  constructor(options: PanelRendererOptions) {
    super({});
    this.offlineManager = options.offlineManager;
    this.downloadManager = options.downloadManager;
    this.modalManager = options.modalManager;
    this.options = options;
    this.map = options.map;

    // Subscribe to language changes
    this.unsubscribeLanguage = i18n.subscribe(() => {
      this.refresh();
    });
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

      panelLogger.debug('Panel data loaded:', { regions, analytics });

      // Render components
      await this.renderHeader(regions, analytics);
      await this.renderActionButtons();
      await this.renderDownloadProgress();
      await this.renderRegionsList(regions);
    } catch (error) {
      panelLogger.error('Error rendering panel:', error);
      this.renderErrorState(panelElement);
    }
  }

  /**
   * Render header section
   */
  private async renderHeader(
    regions: StoredRegion[],
    analytics: StorageAnalyticsReport
  ): Promise<void> {
    if (this.headerContainer) {
      this.element.removeChild(this.headerContainer);
    }

    this.headerContainer = document.createElement('div');
    this.headerContainer.className =
      'flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700';

    // Apply RTL direction if needed
    if (i18n.isRTL()) {
      this.headerContainer.setAttribute('dir', 'rtl');
    }

    // Title section
    const titleSection = document.createElement('div');
    titleSection.innerHTML = `
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">${t('header.title')}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        ${t('header.subtitle', { count: regions.length, size: formatBytes(analytics.totalStorageSize) })}
      </p>
    `;

    // Actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'flex items-center gap-2';

    // Language selector
    this.languageSelector = new LanguageSelector({
      onChange: () => {
        // Language change is handled by subscription in constructor
      },
    });

    // Theme toggle button
    const themeButton = new Button({
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full',
      icon: this.getThemeIcon(),
      title: t('theme.toggle'),
      onClick: () => this.handleThemeToggle(),
    });

    // Close button
    const closeButton = new Button({
      className: 'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full',
      icon: icons.x({ size: 16, color: 'currentColor' }),
      title: t('app.close'),
      onClick: this.options.onClose,
    });

    actionsSection.appendChild(this.languageSelector.getElement());
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

    // Apply RTL direction if needed
    if (i18n.isRTL()) {
      this.actionButtonsContainer.setAttribute('dir', 'rtl');
    }

    // Add Region button
    const addRegionButton = new Button({
      text: t('actions.addRegion'),
      variant: 'primary',
      icon: icons.plus({ size: 16, color: 'white' }),
      onClick: this.options.onAddRegion,
    });

    // Refresh button
    const refreshButton = new Button({
      text: t('actions.refresh'),
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
      const progressHTML = this.createDownloadProgressHTML(
        downloads as unknown as Map<string, Record<string, unknown>>
      );
      this.downloadProgressContainer.innerHTML = progressHTML;

      this.element.appendChild(this.downloadProgressContainer);
    }
  }

  /**
   * Render styles list with regions grouped under each style
   */
  private async renderRegionsList(regions: StoredRegion[]): Promise<void> {
    panelLogger.debug('Rendering regions list with regions:', regions);

    // Remove existing list
    if (this.regionsList) {
      this.regionsList.destroy();
    }

    try {
      // Load styles from IndexedDB and get stats
      const { loadStyles, getStyleStats } = await import('../../services/styleService');
      const styles = await loadStyles();
      const statsResult = await getStyleStats();
      panelLogger.debug('Loaded styles:', styles);
      panelLogger.debug('Style stats:', statsResult);

      // Build style size map from stats
      const styleSizeMap: Record<string, number> = {};
      statsResult.styles.forEach(s => {
        styleSizeMap[s.id] = s.size;
      });

      // Fetch tile sizes for all regions (pass styleId for efficient lookup)
      const regionsWithSizes = await Promise.all(
        regions.map(async region => {
          const tileSize = await this.offlineManager.getRegionSize(region.id, region.styleId);
          return { ...region, tileSize };
        })
      );

      // Group regions by style ID
      const regionsByStyle = this.groupRegionsByStyle(regionsWithSizes);
      panelLogger.debug('Regions grouped by style:', regionsByStyle);

      // Create styles and regions list
      const listItems: ListItemConfig[] = [];

      // If we have stored styles, show them with their regions
      if (styles.length > 0) {
        for (const style of styles) {
          const styleRegions = regionsByStyle[style.key] || [];
          const styleJsonSize = styleSizeMap[style.key] || 0;
          const regionTilesSize = styleRegions.reduce(
            (sum, r) => sum + ((r as { tileSize?: number }).tileSize || 0),
            0
          );
          const totalSize = styleJsonSize + regionTilesSize;

          // Add style item with computed sizes
          const styleWithSizes = {
            ...style,
            styleJsonSize,
            regionTilesSize,
            totalSize,
          };
          listItems.push({
            id: `style-${style.key}`,
            data: { ...styleWithSizes, isStyle: true },
            template: this.createCompleteStyleTemplate(styleWithSizes, styleRegions),
            actions: [
              {
                label: t('actions.loadStyle'),
                action: 'load-style',
                icon: icons.cloud({ size: 12, color: 'currentColor' }),
              },
              {
                label: t('actions.fixTiles'),
                action: 'fix-compressed-tiles',
                variant: 'secondary',
                icon: icons.settings({ size: 12, color: 'currentColor' }),
              },
              {
                label: t('actions.deleteStyle'),
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
                label: t('app.details'),
                action: 'show-details',
                icon: icons.infoCircle({ size: 12, color: 'currentColor' }),
              },
              {
                label: t('app.focus'),
                action: 'focus-region',
                icon: icons.focus({ size: 12, color: 'currentColor' }),
              },
              // {
              //   label: 'Import/Export',
              //   action: 'import-export',
              //   icon: icons.deviceFloppy({ size: 12, color: 'currentColor' })
              // },
              {
                label: t('app.delete'),
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
        emptyText: t('regionList.empty'),
        onItemAction: this.handleItemAction.bind(this),
        onItemClick: (itemId: string, item: unknown) => {
          const itemObj = item as Record<string, unknown>;
          if (itemObj.isStyle) {
            // Handle style click - could expand/collapse or other action
            return;
          }
          if (!itemObj.isOrphanedHeader) {
            this.handleShowRegionDetails(itemId);
          }
        },
      });

      this.element.appendChild(this.regionsList.getElement());

      // Add event delegation for embedded region action buttons
      this.addRegionActionEventListeners();
    } catch (error) {
      panelLogger.error('Error loading styles or rendering list:', error);
      // Fallback to simple regions list
      this.renderFallbackRegionsList(regions);
    }
  }

  /**
   * Create region item template
   */
  private createRegionItemTemplate(
    region: StoredRegion & { downloadedAt?: number; size?: number },
    isGrouped: boolean = false
  ): string {
    const containerClass = isGrouped
      ? 'bg-slate-50 dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-600'
      : 'bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow duration-150';

    return `
      <div class="${containerClass}">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h4 class="font-medium text-slate-800 dark:text-slate-100 text-sm">
              ${escapeHtml(region.name)}
            </h4>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ${region.bounds ? `<span class="font-medium">SW:</span> ${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)} <span class="mx-1">→</span> <span class="font-medium">NE:</span> ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}` : t('panel.noBounds')}
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
              <span>${t('regionList.zoom')}: ${region.minZoom}-${region.maxZoom}</span>
              ${region.downloadedAt ? `<span>${t('regionList.downloaded')}: ${new Date(region.downloadedAt).toLocaleDateString()}</span>` : ''}
              ${region.size ? `<span>${t('regionList.size')}: ${formatBytes(region.size)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create complete style template with header, HR, and regions
   */
  private createCompleteStyleTemplate(
    style: {
      key: string;
      style?: { name?: string };
      styleJsonSize: number;
      regionTilesSize: number;
      totalSize: number;
    },
    regions: (StoredRegion & { tileSize?: number })[]
  ): string {
    const regionCount = regions.length;

    // Style header HTML
    const styleHeader = `
      <div class="bg-linear-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border border-slate-200 dark:border-slate-600 rounded-xl p-0 mb-4 overflow-hidden shadow-sm">
        <!-- Style Header -->
        <div class="p-4 bg-linear-to-r from-slate-100 to-gray-100 dark:from-slate-700 dark:to-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-base">
                ${escapeHtml(style.style?.name || style.key || t('style.unnamedStyle'))}
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
                ${t('regionList.styleId')}: ${escapeHtml(style.key)}
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                ${regionCount} region${regionCount === 1 ? '' : 's'} • ${t('regionList.totalSize')}: ${formatBytes(style.totalSize)}
              </p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
                ${t('regionList.tiles')}: ${formatBytes(style.regionTilesSize)} • ${t('regionList.styleData')}: ${formatBytes(style.styleJsonSize)}
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
  private createRegionItemForStyle(
    region: StoredRegion & { downloadedAt?: number; tileSize?: number }
  ): string {
    return `
      <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer region-item transition-colors duration-150" data-region-id="${escapeHtml(region.id)}">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <h4 class="font-medium text-slate-800 dark:text-slate-100 text-sm">
              ${escapeHtml(region.name)}
            </h4>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ${region.bounds ? `<span class="font-medium">SW:</span> ${region.bounds[0][1].toFixed(4)}, ${region.bounds[0][0].toFixed(4)} <span class="mx-1">→</span> <span class="font-medium">NE:</span> ${region.bounds[1][1].toFixed(4)}, ${region.bounds[1][0].toFixed(4)}` : t('panel.noBounds')}
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
              <span>${t('regionList.zoom')}: ${region.minZoom}-${region.maxZoom}</span>
              ${region.downloadedAt ? `<span>${t('regionList.downloaded')}: ${new Date(region.downloadedAt).toLocaleDateString()}</span>` : ''}
              ${region.tileSize ? `<span>${t('regionList.tiles')}: ${formatBytes(region.tileSize)}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <button class="region-action-btn p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors duration-150" data-action="show-details" data-region-id="${escapeHtml(region.id)}" title="${t('app.details')}">
              ${icons.infoCircle({ size: 14, color: 'currentColor' })}
            </button>
            <button class="region-action-btn p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors duration-150" data-action="focus-region" data-region-id="${escapeHtml(region.id)}" title="${t('app.focus')}">
              ${icons.focus({ size: 14, color: 'currentColor' })}
            </button>
            <button class="region-action-btn p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors duration-150" data-action="redownload-region" data-region-id="${escapeHtml(region.id)}" title="${t('actions.redownload')}">
              ${icons.download({ size: 14, color: 'currentColor' })}
            </button>
            <!-- <button class="region-action-btn p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 transition-colors duration-150" data-action="import-export" data-region-id="${escapeHtml(region.id)}" title="${t('actions.importExport')}">
              ${icons.deviceFloppy({ size: 14, color: 'currentColor' })}
            </button> -->
            <button class="region-action-btn p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors duration-150" data-action="delete-region" data-region-id="${escapeHtml(region.id)}" title="${t('app.delete')}">
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
  private createStyleItemTemplate(
    style: {
      key: string;
      style?: { name?: string };
      styleJsonSize: number;
      regionTilesSize: number;
      totalSize: number;
    },
    regions: (StoredRegion & { tileSize?: number })[]
  ): string {
    const regionCount = regions.length;

    return `
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-0 mb-4 overflow-hidden">
        <!-- Style Header -->
        <div class="p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-blue-900 dark:text-blue-100 text-base">
                ${escapeHtml(style.style?.name || style.key || t('style.unnamedStyle'))}
              </h3>
              <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                ${t('regionList.styleId')}: ${escapeHtml(style.key)}
              </p>
              <p class="text-sm text-blue-600 dark:text-blue-400 mt-1">
                ${regionCount} region${regionCount === 1 ? '' : 's'} • ${t('regionList.totalSize')}: ${formatBytes(style.totalSize)}
              </p>
              <p class="text-xs text-blue-500 dark:text-blue-500 mt-1">
                ${t('regionList.tiles')}: ${formatBytes(style.regionTilesSize)} • ${t('regionList.styleData')}: ${formatBytes(style.styleJsonSize)}
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
  private createOrphanedRegionsHeaderTemplate(regions: StoredRegion[]): string {
    return `
      <div class="bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-amber-800 dark:text-amber-200 text-sm">
              ${t('regionList.orphanedHeader')}
            </h3>
            <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
              ${t('regionList.orphanedDescription', { count: regions.length })}
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
  private createDownloadProgressHTML(downloads: Map<string, Record<string, unknown>>): string {
    const downloadArray = Array.from(downloads.values());
    return `
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
          ${t('download.activeCount', { count: downloadArray.length })}
        </h3>
        <div class="space-y-2">
          ${downloadArray
            .map(
              download => `
            <div class="flex items-center justify-between text-sm">
              <span class="text-blue-800 dark:text-blue-200">${escapeHtml(download.regionName || download.regionId)}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 transition-all duration-300" style="width: ${download.percentage || 0}%"></div>
                </div>
                <span class="text-blue-700 dark:text-blue-300 min-w-12">${Math.round((download.percentage as number) || 0)}%</span>
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
  private handleRegionAction(action: string, regionId: string, regionData: StoredRegion): void {
    switch (action) {
      case 'show-details':
        this.handleShowRegionDetails(regionId);
        break;
      case 'focus-region':
        this.options.onFocusRegion(regionId);
        break;
      case 'redownload-region':
        this.handleRedownloadRegion(regionId);
        break;
      case 'import-export':
        this.handleImportExport(regionId, regionData);
        break;
      case 'delete-region':
        this.handleDeleteRegion(regionId);
        break;
      default:
        panelLogger.warn('Unknown region action:', action);
    }
  }

  /**
   * Handle showing region details
   */
  private async handleShowRegionDetails(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: StoredRegion) => r.id === regionId);

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
      panelLogger.error('Error showing region details:', error);
    }
  }

  /**
   * Handle deleting a region
   */
  private async handleDeleteRegion(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: StoredRegion) => r.id === regionId);

      if (!region) return;

      const confirmModal = new ConfirmationModal({
        title: t('delete.regionTitle'),
        message: t('delete.regionMessage', { name: region.name }),
        confirmText: t('app.delete'),
        cancelText: t('app.cancel'),
        onConfirm: async () => {
          try {
            await this.offlineManager.deleteRegion(regionId);
            this.modalManager.close();
            // Refresh the panel to show updated regions
            await this.refresh();
          } catch (error) {
            panelLogger.error('Failed to delete region:', error);
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
      panelLogger.error('Error deleting region:', error);
    }
  }

  /**
   * Handle re-downloading a region
   */
  private async handleRedownloadRegion(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: StoredRegion) => r.id === regionId);

      if (!region) {
        panelLogger.error('Region not found:', regionId);
        return;
      }

      const confirmModal = new ConfirmationModal({
        title: t('redownload.title'),
        message: t('redownload.message', { name: region.name }),
        confirmText: t('redownload.button'),
        cancelText: t('app.cancel'),
        onConfirm: async () => {
          try {
            this.modalManager.close();

            // First, delete the existing region
            panelLogger.debug('Deleting region before re-download:', regionId);
            await this.offlineManager.deleteRegion(regionId);

            // Prepare form data for re-download
            const formData = {
              name: region.name,
              bounds: [
                region.bounds[0][0], // west
                region.bounds[0][1], // south
                region.bounds[1][0], // east
                region.bounds[1][1], // north
              ] as [number, number, number, number],
              minZoom: region.minZoom,
              maxZoom: region.maxZoom,
              styleUrl: region.styleUrl || '',
              provider: 'auto' as const,
            };

            panelLogger.debug('Starting re-download with config:', formData);

            // Use the download manager to re-download
            if (this.downloadManager) {
              await this.downloadManager.downloadRegion(formData);
            } else {
              panelLogger.error('Download manager not available');
              alert(t('alert.downloadManagerNotAvailable'));
            }

            // Refresh the panel to show the new region
            await this.refresh();
          } catch (error) {
            panelLogger.error('Failed to re-download region:', error);
            alert(
              `${t('alert.failedToRedownload')}: ${error instanceof Error ? error.message : t('alert.unknownError')}`
            );
          }
        },
        onCancel: () => {
          this.modalManager.close();
        },
      });

      const modal = confirmModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      panelLogger.error('Error re-downloading region:', error);
    }
  }

  /**
   * Handle import/export functionality
   */
  private async handleImportExport(regionId: string, _regionData: unknown): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: StoredRegion) => r.id === regionId);

      if (!region) return;

      const importExportModal = new ImportExportModal({
        region,
        onClose: () => {
          this.modalManager.close();
        },
        onExport: result => {
          panelLogger.debug('Export completed:', result);
          // Handle export result - could show success message
          this.offlineManager.downloadExportedRegion(result);
        },
        onImport: result => {
          panelLogger.debug('Import completed:', result);
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
              return await this.offlineManager.exportRegionAsPMTiles(
                regionId,
                options as Record<string, unknown>
              );
            case 'mbtiles':
              return await this.offlineManager.exportRegionAsMBTiles(
                regionId,
                options as Record<string, unknown>
              );
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
      panelLogger.error('Error showing import/export modal:', error);
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
      <div class="flex items-center justify-center h-full text-red-600 dark:text-red-400" ${i18n.isRTL() ? 'dir="rtl"' : ''}>
        <div class="text-center">
          <p class="text-lg font-medium">${t('error.loadingContent')}</p>
          <p class="text-sm mt-2">${t('error.tryAgain')}</p>
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

    // Remove previous handler to prevent accumulation on refresh
    if (this.regionActionHandler) {
      listElement.removeEventListener('click', this.regionActionHandler);
    }

    // Add event delegation for region action buttons
    this.regionActionHandler = (event: Event) => {
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
    };
    listElement.addEventListener('click', this.regionActionHandler);
  }

  /**
   * Handle actions for embedded region buttons
   */
  private async handleEmbeddedRegionAction(action: string, regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: StoredRegion) => r.id === regionId);

      if (!region) {
        panelLogger.warn('Region not found:', regionId);
        return;
      }

      // Use the existing region action handler
      this.handleRegionAction(action, regionId, region);
    } catch (error) {
      panelLogger.error('Error handling embedded region action:', error);
    }
  }

  /**
   * Fallback renderer for regions list when styles fail to load
   */
  private async renderFallbackRegionsList(regions: StoredRegion[]): Promise<void> {
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
          label: t('app.details'),
          action: 'show-details',
          icon: icons.infoCircle({ size: 12, color: 'currentColor' }),
        },
        {
          label: t('app.focus'),
          action: 'focus-region',
          icon: icons.focus({ size: 12, color: 'currentColor' }),
        },
        // {
        //   label: 'Import/Export',
        //   action: 'import-export',
        //   icon: icons.deviceFloppy({ size: 12, color: 'currentColor' })
        // },
        {
          label: t('app.delete'),
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
      emptyText: t('regionList.emptyFallback'),
      onItemAction: this.handleItemAction.bind(this),
      onItemClick: (itemId: string, _item: unknown) => {
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
      panelLogger.debug('Refresh already in progress, skipping...');
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

      panelLogger.debug('Refreshing panel data:', { regions, analytics });

      // Re-render components
      await this.renderHeader(regions, analytics);
      await this.renderActionButtons();
      await this.renderDownloadProgress();
      await this.renderRegionsList(regions);
    } catch (error) {
      panelLogger.error('Error refreshing panel:', error);
      this.renderErrorState(this.element as HTMLDivElement);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  public destroy(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    if (this.regionsList) {
      this.regionsList.destroy();
    }
    if (this.languageSelector) {
      this.languageSelector.destroy();
    }
    if (this.unsubscribeLanguage) {
      this.unsubscribeLanguage();
    }
    super.destroy();
  }

  /**
   * Group regions by style ID
   */
  private groupRegionsByStyle<T extends StoredRegion>(regions: T[]): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};

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
  private handleItemAction(action: string, itemId: string, itemData: unknown): void {
    const itemObj = itemData as Record<string, unknown>;
    if (itemObj.isStyle) {
      this.handleStyleAction(action, itemId, itemData);
    } else {
      this.handleRegionAction(action, itemId, itemData as StoredRegion);
    }
  }

  /**
   * Handle style-specific actions
   */
  private async handleStyleAction(
    action: string,
    styleId: string,
    styleData: unknown
  ): Promise<void> {
    switch (action) {
      case 'load-style':
        await this.handleLoadStyle(styleData);
        break;
      case 'fix-compressed-tiles':
        await this.handleFixCompressedTiles(styleId);
        break;
      case 'delete-style':
        await this.handleDeleteStyle(styleId, styleData);
        break;
      default:
        panelLogger.warn('Unknown style action:', action);
    }
  }

  /**
   * Handle fixing compressed tiles
   */
  private async handleFixCompressedTiles(_styleId: string): Promise<void> {
    try {
      const { cleanupCompressedTiles, countCompressedTiles } =
        await import('../../utils/cleanupCompressedTiles');

      // First count the compressed tiles
      const stats = await countCompressedTiles();

      if (stats.gzipped === 0) {
        const confirmModal = new ConfirmationModal({
          title: t('fixTiles.noIssuesTitle'),
          message: t('fixTiles.noIssuesMessage'),
          confirmText: t('app.ok'),
          cancelText: '',
          onConfirm: () => {
            this.modalManager.close();
          },
          onCancel: () => {
            this.modalManager.close();
          },
        });

        const modal = confirmModal.show();
        this.modalManager.show(modal);
        return;
      }

      const confirmModal = new ConfirmationModal({
        title: t('fixTiles.title'),
        message: t('fixTiles.message', { count: stats.gzipped }),
        confirmText: t('fixTiles.button'),
        cancelText: t('app.cancel'),
        onConfirm: async () => {
          try {
            panelLogger.debug('Cleaning up compressed tiles...');
            const result = await cleanupCompressedTiles();
            panelLogger.debug(`Cleanup complete: removed ${result.removed} tiles`);

            this.modalManager.close();

            // Show success message
            const successModal = new ConfirmationModal({
              title: t('fixTiles.completeTitle'),
              message: t('fixTiles.completeMessage', { count: result.removed }),
              confirmText: t('app.ok'),
              cancelText: '',
              onConfirm: () => {
                this.modalManager.close();
              },
              onCancel: () => {
                this.modalManager.close();
              },
            });

            const modal = successModal.show();
            this.modalManager.show(modal);

            // Refresh the panel
            await this.refresh();
          } catch (error) {
            panelLogger.error('Failed to cleanup compressed tiles:', error);
            this.modalManager.close();
          }
        },
        onCancel: () => {
          this.modalManager.close();
        },
      });

      const modal = confirmModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      panelLogger.error('Error fixing compressed tiles:', error);
    }
  }

  /**
   * Handle loading a style to the map
   */
  private async handleLoadStyle(styleData: unknown): Promise<void> {
    if (!this.map) {
      panelLogger.warn('Map not available for loading style');
      alert(t('error.mapNotInitialized'));
      return;
    }

    try {
      const styleEntry = styleData as StyleStorageItem;

      if (!styleEntry || !styleEntry.style) {
        panelLogger.error('Invalid style data - missing style property');
        alert(t('error.invalidStyleData'));
        return;
      }

      if (!styleEntry.key) {
        panelLogger.error('Invalid style data - missing key property');
        alert(t('error.invalidStyleData'));
        return;
      }

      panelLogger.debug('Loading style from IndexedDB:', {
        key: styleEntry.key,
        provider: styleEntry.provider,
        hasStyle: !!styleEntry.style,
        hasSources: !!styleEntry.style?.sources,
        sourcesCount: styleEntry.style?.sources ? Object.keys(styleEntry.style.sources).length : 0,
        layersCount: styleEntry.style?.layers?.length || 0,
        hasSprite: !!styleEntry.style?.sprite,
        hasGlyphs: !!styleEntry.style?.glyphs,
      });

      // Validate style structure
      if (!styleEntry.style.sources || Object.keys(styleEntry.style.sources).length === 0) {
        panelLogger.error('Style is missing sources');
        alert(t('error.styleMissingSources'));
        return;
      }

      if (!styleEntry.style.layers || styleEntry.style.layers.length === 0) {
        panelLogger.error('Style is missing layers');
        alert(t('error.styleMissingLayers'));
        return;
      }

      // Check for compressed tiles
      try {
        const { countCompressedTiles } = await import('../../utils/cleanupCompressedTiles');
        const compressed = await countCompressedTiles();

        if (compressed.gzipped > 0) {
          panelLogger.warn(
            `Found ${compressed.gzipped} compressed tiles that may cause rendering issues`
          );
          const shouldContinue = confirm(
            `${t('warning.compressedTiles', { count: compressed.gzipped })}\n\n` +
              `${t('warning.compressedTilesRecommendation')}\n\n` +
              `${t('warning.continueAnyway')}`
          );
          if (!shouldContinue) {
            return;
          }
        }
      } catch (cleanupError) {
        panelLogger.warn('Could not check for compressed tiles:', cleanupError);
      }

      // The style is already patched with idb:// URLs when stored in regionService
      // DO NOT patch it again - double-patching breaks the URLs!
      // Just use the stored style directly
      const patchedStyle = JSON.parse(JSON.stringify(styleEntry.style)) as MapboxStyle;

      // Enforce maxzoom for all tile sources to prevent requesting non-existent tiles
      // Find the maximum zoom level from all regions using this style
      let maxZoom = 14; // Default fallback
      if (styleEntry.regions && Array.isArray(styleEntry.regions)) {
        const regionMaxZooms = styleEntry.regions.map((r: { maxZoom?: number }) => r.maxZoom || 14);
        maxZoom = regionMaxZooms.length > 0 ? Math.max(...regionMaxZooms) : 14;
        panelLogger.debug(`Computed maxZoom from regions: ${maxZoom}`);
      }

      // Apply maxzoom to all tile sources
      if (patchedStyle.sources) {
        for (const [sourceId, source] of Object.entries(patchedStyle.sources)) {
          const src = source as { tiles?: string[]; maxzoom?: number; type?: string };
          if (src.tiles && (src.type === 'vector' || src.type === 'raster' || !src.type)) {
            const originalMaxzoom = src.maxzoom;
            src.maxzoom = maxZoom;
            panelLogger.debug(`Set maxzoom for ${sourceId}: ${originalMaxzoom} → ${maxZoom}`);
          }
        }
      }

      panelLogger.debug('Using pre-patched offline style with enforced maxzoom');

      panelLogger.debug('Style patched successfully:', {
        sources: patchedStyle.sources ? Object.keys(patchedStyle.sources).length : 0,
        layers: patchedStyle.layers?.length || 0,
        sprite: patchedStyle.sprite,
        glyphs: patchedStyle.glyphs,
      });

      // Log patched sources for debugging
      if (patchedStyle.sources) {
        panelLogger.debug('Patched sources:');
        for (const [sourceId, source] of Object.entries(patchedStyle.sources)) {
          const src = source as { tiles?: string[]; url?: string; type?: string };
          panelLogger.debug(`  - ${sourceId}:`, {
            type: src.type,
            tiles: src.tiles?.[0],
            url: src.url,
          });
        }
      }

      // Apply the patched style to the map
      panelLogger.debug('Applying patched style to map...');

      try {
        (this.map as { setStyle?: (style: MapboxStyle) => void })?.setStyle?.(patchedStyle);
        panelLogger.debug('Style loaded successfully!');

        // Wait a bit and check if the style was applied
        setTimeout(() => {
          const currentStyle = (this.map as { getStyle?: () => MapboxStyle })?.getStyle?.();
          if (currentStyle) {
            panelLogger.debug('Style verification:', {
              sources: currentStyle.sources ? Object.keys(currentStyle.sources).length : 0,
              layers: currentStyle.layers?.length || 0,
            });
          }
        }, 1000);
      } catch (setStyleError) {
        panelLogger.error('Error calling setStyle:', setStyleError);
        alert(
          `${t('alert.failedToApplyStyle')}: ${setStyleError instanceof Error ? setStyleError.message : t('alert.unknownError')}`
        );
        return;
      }
    } catch (error) {
      panelLogger.error('Error loading style to map:', error);
      panelLogger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      alert(
        `${t('alert.failedToLoadStyle')}: ${error instanceof Error ? error.message : t('alert.unknownError')}`
      );
    }
  }

  /**
   * Handle deleting a style
   */
  private async handleDeleteStyle(styleId: string, styleData: unknown): Promise<void> {
    try {
      const style = styleData as { key: string; style?: { name?: string } };
      const confirmModal = new ConfirmationModal({
        title: t('delete.styleTitle'),
        message: t('delete.styleMessage', { name: style.style?.name || style.key }),
        confirmText: t('actions.deleteStyle'),
        cancelText: t('app.cancel'),
        onConfirm: async () => {
          try {
            const { deleteStyleById } = await import('../../services/styleService');
            await deleteStyleById(style.key);
            this.modalManager.close();
            // Refresh the panel
            await this.refresh();
          } catch (error) {
            panelLogger.error('Failed to delete style:', error);
          }
        },
        onCancel: () => {
          this.modalManager.close();
        },
      });

      const modal = confirmModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      panelLogger.error('Error deleting style:', error);
    }
  }
}
