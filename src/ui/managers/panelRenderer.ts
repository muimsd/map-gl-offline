/**
 * Panel Renderer Component
 * Handles rendering of the main offline manager panel
 */

import { OfflineMapManager } from '../../managers/offlineMapManager';
import { DownloadManager } from './downloadManager';
import { ModalManager } from '../modals/modalManager';
import { RegionDetailsModal } from '../modals/regionDetailsModal';
import { ConfirmationModal } from '../modals/confirmationModal';
import { ImportExportModal } from '../modals/importExportModal';
import { createHeader } from '../components/header';
import { createActionButtons } from '../components/actionButtons';
import { createRegionsList } from '../components/regionsList';
import { createDownloadProgressSection } from '../components/downloadProgress';
import { formatBytes } from '../../utils/formatting';
import { themeManager } from '../themes';

export interface PanelRendererOptions {
  offlineManager: OfflineMapManager;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  onClose: () => void;
  onAddRegion: () => void;
  onFocusRegion: (regionId: string) => void;
}

export class PanelRenderer {
  private offlineManager: OfflineMapManager;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private options: PanelRendererOptions;

  constructor(options: PanelRendererOptions) {
    this.offlineManager = options.offlineManager;
    this.downloadManager = options.downloadManager;
    this.modalManager = options.modalManager;
    this.options = options;
  }

  /**
   * Render the main panel content
   */
  public async render(panelElement: HTMLDivElement): Promise<void> {
    if (!panelElement) return;

    try {
      const [regions, analytics] = await Promise.all([
        this.offlineManager.listStoredRegions(),
        this.offlineManager.getComprehensiveStorageAnalytics(),
      ]);

      const headerElement = createHeader({
        title: 'Offline Manager',
        subtitle: `${regions.length} regions • ${formatBytes(analytics.totalStorageSize)} total`,
        onClose: this.options.onClose,
        onToggleTheme: this.handleThemeToggle.bind(this),
      });

      const actionButtonsElement = createActionButtons({
        onAddRegion: this.options.onAddRegion,
        onRefresh: () => this.render(panelElement),
      });

      const regionsListElement = createRegionsList({
        regions,
        onFocusRegion: this.options.onFocusRegion,
        onDeleteRegion: (regionId: string) => this.handleDeleteRegion(regionId),
        onShowRegionDetails: (regionId: string) => this.handleShowRegionDetails(regionId),
        onImportExport: (regionId: string) => this.handleImportExport(regionId),
        formatBytes,
      });

      // Clear panel and rebuild with proper event handling
      panelElement.innerHTML = '';

      // Create main container
      const mainContainer = document.createElement('div');
      mainContainer.className = 'h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl overflow-hidden';

      // Create content container
      const contentContainer = document.createElement('div');
      contentContainer.className = 'flex-1 p-6 overflow-y-auto flex flex-col gap-6';

      // Append header (with working event listeners)
      mainContainer.appendChild(headerElement);

      // Append action buttons
      contentContainer.appendChild(actionButtonsElement);

      // Append download progress if exists
      if (this.downloadManager?.hasActiveDownloads()) {
        const progressElement = createDownloadProgressSection({
          downloads: this.downloadManager.getCurrentDownloads(),
        });
        contentContainer.appendChild(progressElement);
      }

      // Append regions list
      contentContainer.appendChild(regionsListElement);

      // Append content to main container
      mainContainer.appendChild(contentContainer);

      // Append main container to panel
      panelElement.appendChild(mainContainer);
    } catch (error) {
      console.error('Error rendering panel:', error);
      this.renderErrorState(panelElement);
    }
  }

  /**
   * Handle theme toggle
   */
  private handleThemeToggle(): void {
    themeManager.toggleTheme();
    // Re-render will be triggered by the parent component
  }

  /**
   * Handle region deletion
   */
  private async handleDeleteRegion(regionId: string): Promise<void> {
    try {
      const confirmationModal = new ConfirmationModal({
        title: 'Delete Region',
        message: 'Are you sure you want to delete this region? This will remove all downloaded map data for this area.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await this.offlineManager.deleteRegion(regionId);
          // Panel will be re-rendered by parent component
        },
        onCancel: () => {
          // Modal will be closed automatically
        },
      });

      const modal = confirmationModal.show();
      this.modalManager.show(modal);
    } catch (error) {
      console.error('Error deleting region:', error);
    }
  }

  /**
   * Handle showing region details
   */
  private async handleShowRegionDetails(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listRegions();
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
   * Handle import/export for a region
   */
  private async handleImportExport(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find((r: any) => r.id === regionId);
      
      if (!region) return;

      const importExportModal = new ImportExportModal({
        region,
        exportRegion: async (regionId: string, format: 'json' | 'pmtiles' | 'mbtiles', options?: any) => {
          switch (format) {
            case 'json':
              return await this.offlineManager.exportRegionAsJSON(regionId, options);
            case 'pmtiles':
              return await this.offlineManager.exportRegionAsPMTiles(regionId, options);
            case 'mbtiles':
              return await this.offlineManager.exportRegionAsMBTiles(regionId, options);
            default:
              throw new Error(`Unsupported export format: ${format}`);
          }
        },
        importRegion: async (data: any) => {
          return await this.offlineManager.importRegion(data);
        },
        onClose: () => {
          this.modalManager.close();
        },
        onExport: (result: any) => {
          console.log('Export completed:', result);
          // Re-render panel to reflect any changes
          this.renderAfterUpdate();
        },
        onImport: (result: any) => {
          console.log('Import completed:', result);
          // Re-render panel to reflect any changes
          this.renderAfterUpdate();
        },
      });

      this.modalManager.show(importExportModal.show());
    } catch (error) {
      console.error('Error handling import/export:', error);
    }
  }

  /**
   * Re-render panel after updates
   */
  private renderAfterUpdate(): void {
    const panelElement = document.querySelector('.offline-manager-panel') as HTMLDivElement;
    if (panelElement) {
      this.render(panelElement);
    }
  }

  /**
   * Render error state
   */
  private renderErrorState(panelElement: HTMLDivElement): void {
    panelElement.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-2xl p-6">
        <div class="text-center text-gray-500 dark:text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Error Loading Panel
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            There was a problem loading the offline manager panel.
          </p>
          <button 
            onclick="location.reload()" 
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}
