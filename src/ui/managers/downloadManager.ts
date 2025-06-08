/**
 * Download Manager Component
 * Handles download operations and progress tracking
 */

import { OfflineMapManager } from '../../managers/offlineMapManager';
import { RegionFormData } from '../modals/regionFormModal';

export interface DownloadProgress {
  regionId: string;
  completed: number;
  total: number;
  percentage: number;
  currentResource: string;
}

export interface DownloadManagerOptions {
  offlineManager: OfflineMapManager;
  onProgressUpdate?: (downloads: Map<string, DownloadProgress>) => void;
  onDownloadComplete?: (regionId: string) => void;
  onDownloadError?: (regionId: string, error: any) => void;
  updateButton?: (text: string, disabled: boolean) => void;
  updateProgressBadge?: (text: string, visible: boolean) => void;
}

export class DownloadManager {
  private offlineManager: OfflineMapManager;
  private currentDownloads: Map<string, DownloadProgress> = new Map();
  private options: DownloadManagerOptions;

  constructor(options: DownloadManagerOptions) {
    this.offlineManager = options.offlineManager;
    this.options = options;
  }

  /**
   * Start downloading a region with progress tracking
   */
  public async downloadRegion(formData: RegionFormData): Promise<void> {
    const regionConfig = {
      id: `region_${Date.now()}`,
      name: formData.name,
      bounds: [
        [formData.bounds[0], formData.bounds[1]],
        [formData.bounds[2], formData.bounds[3]],
      ] as [[number, number], [number, number]],
      minZoom: formData.minZoom,
      maxZoom: formData.maxZoom,
      styleUrl: formData.styleUrl,
    };

    const regionId = regionConfig.id;

    try {
      // Update UI to show download starting
      this.updateUIForDownloadStart();

      // Start download - Note: Progress tracking would need to be implemented in the service layer
      await this.offlineManager.addRegion(regionConfig);

      // Download complete
      this.handleDownloadComplete(regionId);
    } catch (error) {
      console.error('Error downloading region:', error);
      this.handleDownloadError(regionId, error);
    }
  }

  /**
   * Get current downloads
   */
  public getCurrentDownloads(): Map<string, DownloadProgress> {
    return this.currentDownloads;
  }

  /**
   * Check if any downloads are in progress
   */
  public hasActiveDownloads(): boolean {
    return this.currentDownloads.size > 0;
  }

  /**
   * Cancel a specific download
   */
  public cancelDownload(regionId: string): void {
    this.currentDownloads.delete(regionId);
    
    if (this.currentDownloads.size === 0) {
      this.resetUI();
    }

    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Cancel all downloads
   */
  public cancelAllDownloads(): void {
    this.currentDownloads.clear();
    this.resetUI();
    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Update UI for download start
   */
  private updateUIForDownloadStart(): void {
    this.options.updateButton?.('Downloading...', true);
    this.options.updateProgressBadge?.('0%', true);
  }

  /**
   * Handle successful download completion
   */
  private handleDownloadComplete(regionId: string): void {
    this.currentDownloads.delete(regionId);

    if (this.currentDownloads.size === 0) {
      this.resetUI();
    }

    this.options.onDownloadComplete?.(regionId);
    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Handle download error
   */
  private handleDownloadError(regionId: string, error: any): void {
    this.currentDownloads.delete(regionId);

    if (this.currentDownloads.size === 0) {
      this.resetUI();
    }

    this.options.onDownloadError?.(regionId, error);
    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Reset UI to initial state
   */
  private resetUI(): void {
    this.options.updateButton?.('Offline Maps', false);
    this.options.updateProgressBadge?.('', false);
  }
}
