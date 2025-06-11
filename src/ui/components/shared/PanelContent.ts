/**
 * Panel Content Renderer Component
 * Refactored from PanelRenderer to be more focused and reusable
 */

import { BaseComponent } from './BaseComponent';
import { OfflineMapManager } from '../../../managers/offlineMapManager';
import { DownloadManager } from '../../managers/DownloadManager';
import { ModalManager } from '../../modals/ModalManager';
import { RegionDetailsModal } from '../../modals/RegionDetailsModal';
import { ConfirmationModal } from '../../modals/ConfirmationModal';
import { ImportExportModal } from '../../modals/ImportExportModal';
import { createHeader } from '../PanelHeader';
import { createActionButtons } from '../PanelActions';
import { createRegionsList } from '../RegionList';
import { createDownloadProgressSection } from '../DownloadProgress';
import { formatBytes } from '../../../utils/formatting';
import { themeManager } from '../../ThemeManager';

export interface ContentRendererConfig {
  offlineManager: OfflineMapManager;
  downloadManager: DownloadManager;
  modalManager: ModalManager;
  onClose: () => void;
  onAddRegion: () => void;
  onFocusRegion: (regionId: string) => void;
}

export class PanelContentRenderer extends BaseComponent {
  private offlineManager: OfflineMapManager;
  private downloadManager: DownloadManager;
  private modalManager: ModalManager;
  private contentConfig: ContentRendererConfig;

  constructor(config: ContentRendererConfig) {
    super({});
    this.offlineManager = config.offlineManager;
    this.downloadManager = config.downloadManager;
    this.modalManager = config.modalManager;
    this.contentConfig = config;
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'h-full flex flex-col';
    return container;
  }

  /**
   * Render content into a container
   */
  public async render(container: HTMLElement): Promise<void> {
    if (!container) return;

    try {
      const [regions, analytics] = await Promise.all([
        this.offlineManager.listStoredRegions(),
        this.offlineManager.getComprehensiveStorageAnalytics(),
      ]);

      const downloads = this.downloadManager.getCurrentDownloads();
      const currentTheme = themeManager.getTheme();

      // Create main content structure
      const content = this.createMainContent(regions, analytics, downloads, currentTheme);
      
      // Clear and set content
      container.innerHTML = '';
      container.appendChild(content);

      // Setup event listeners for the rendered content
      this.setupContentEventListeners(container);

    } catch (error) {
      console.error('Error rendering panel content:', error);
      container.innerHTML = `
        <div class="flex items-center justify-center h-full text-red-600 dark:text-red-400">
          Error loading content. Please try again.
        </div>
      `;
    }
  }

  private createMainContent(regions: any[], analytics: any, downloads: Map<string, any>, currentTheme: any): HTMLElement {
    const mainContent = document.createElement('div');
    mainContent.className = 'h-full flex flex-col';

    // Header
    const header = createHeader({
      title: 'Offline Map Manager',
      subtitle: `${regions.length} regions • ${formatBytes(analytics.totalSize)}`,
      onClose: this.contentConfig.onClose,
      onThemeToggle: () => {
        const newTheme = currentTheme.mode === 'dark' ? 'light' : 'dark';
        themeManager.setTheme(newTheme);
        // Re-render to update theme
        this.render(mainContent.parentElement!);
      },
    });
    mainContent.appendChild(header);

    // Action buttons
    const actionButtons = createActionButtons({
      onAddRegion: this.contentConfig.onAddRegion,
      onRefresh: () => this.refresh(),
    });
    mainContent.appendChild(actionButtons);

    // Download progress section (if active downloads)
    if (downloads.size > 0) {
      const progressSection = createDownloadProgressSection({
        downloads: downloads,
      });
      mainContent.appendChild(progressSection);
    }

    // Regions list
    const regionsList = createRegionsList({
      regions,
      onFocusRegion: this.contentConfig.onFocusRegion,
      onDeleteRegion: (regionId: string) => this.deleteRegion(regionId),
      onShowRegionDetails: (regionId: string) => this.findAndShowRegionDetails(regionId),
      onImportExport: (regionId: string) => this.showImportExportModal(),
    });
    mainContent.appendChild(regionsList);

    return mainContent;
  }

  private setupContentEventListeners(container: HTMLElement): void {
    // Add event delegation for dynamic content
    container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Handle region actions
      if (target.dataset.action === 'focus-region') {
        const regionId = target.dataset.regionId;
        if (regionId) {
          this.contentConfig.onFocusRegion(regionId);
        }
      } else if (target.dataset.action === 'delete-region') {
        const regionId = target.dataset.regionId;
        if (regionId) {
          this.deleteRegion(regionId);
        }
      } else if (target.dataset.action === 'show-details') {
        const regionId = target.dataset.regionId;
        if (regionId) {
          this.findAndShowRegionDetails(regionId);
        }
      } else if (target.dataset.action === 'download-region') {
        const regionId = target.dataset.regionId;
        if (regionId) {
          this.downloadRegion(regionId);
        }
      }
    });
  }

  private async findAndShowRegionDetails(regionId: string): Promise<void> {
    try {
      const regions = await this.offlineManager.listStoredRegions();
      const region = regions.find(r => r.id === regionId);
      if (region) {
        this.showRegionDetails(region);
      }
    } catch (error) {
      console.error('Error finding region:', error);
    }
  }

  private showRegionDetails(region: any): void {
    const detailsModal = new RegionDetailsModal({
      region,
      onClose: () => {
        // Modal will handle cleanup
      },
      onFocus: (regionId: string) => {
        this.contentConfig.onFocusRegion(regionId);
      },
      onThemeToggle: () => {
        const currentTheme = themeManager.getTheme();
        const newTheme = currentTheme.mode === 'dark' ? 'light' : 'dark';
        themeManager.setTheme(newTheme);
      },
    });

    const modalElement = detailsModal.show();
    document.body.appendChild(modalElement);
  }

  private deleteRegion(regionId: string): void {
    const confirmModal = new ConfirmationModal({
      title: 'Delete Region',
      message: 'Are you sure you want to delete this region? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await this.offlineManager.deleteRegion(regionId);
          // Re-render to update the list
          const container = this.element.parentElement;
          if (container) {
            await this.render(container);
          }
        } catch (error) {
          console.error('Failed to delete region:', error);
          alert('Failed to delete region. Please try again.');
        }
      },
      onCancel: () => {
        // Modal will handle cleanup
      },
    });

    const modalElement = confirmModal.show();
    document.body.appendChild(modalElement);
  }

  private downloadRegion(regionId: string): void {
    // For now, just log that we would start a download
    // In a real implementation, this would trigger a new download
    console.log('Download region requested:', regionId);
    alert('Download feature not implemented in this refactored version');
  }

  private showImportExportModal(): void {
    // For this refactored version, we'll show a simple alert
    // In a real implementation, you would create and show the import/export modal
    console.log('Import/Export modal requested');
    alert('Import/Export feature not fully implemented in this refactored version');
  }

  /**
   * Refresh content
   */
  public async refresh(): Promise<void> {
    const container = this.element.parentElement;
    if (container) {
      await this.render(container);
    }
  }
}
