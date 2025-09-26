/**
 * Download Manager Component
 * Handles download operations and progress tracking
 */

import { downloadStyles, isStyleDownloaded, loadStyles } from '@/services/styleService';
import { downloadTiles } from '../../services/tileService';
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
      // Check if style is downloaded (by styleUrl only)
      const styleExists = await isStyleDownloaded(undefined, regionConfig.styleUrl);

      let finalStyleId: string;
      if (!styleExists) {
        // Enhanced style download with Mapbox GL support
        console.log(`🎨 Downloading style with provider: ${formData.provider}`);

        // Use the enhanced downloadStyleWithProvider for Mapbox GL support
        const styleDownloadOptions: any = {
          skipExisting: true,
          provider: formData.provider || 'auto',
          accessToken: formData.accessToken,
          onProgress: (progress: any) => {
            console.log(`Style download progress: ${progress.percentage}%`);
          },
        };

        const styleResult = await this.offlineManager.downloadStyle(
          regionConfig.styleUrl,
          styleDownloadOptions
        );

        if (!styleResult.success) {
          throw new Error(`Failed to download style: ${styleResult.errors.join(', ')}`);
        }

        finalStyleId = styleResult.styleId;
        console.log(`✅ Style downloaded successfully: ${finalStyleId}`);
      } else {
        // Find the existing style to get its ID
        const styles = await loadStyles();
        const existingStyle = styles.find(
          (s: any) =>
            s?.style?.sprite?.includes(regionConfig.styleUrl) ||
            s?.originalUrl === regionConfig.styleUrl
        );
        if (!existingStyle) {
          throw new Error('Style exists but could not be found');
        }
        finalStyleId = existingStyle.key;
        console.log(`📋 Using existing style: ${finalStyleId}`);
      }

      // Update region config with the styleId from the downloaded/existing style
      const finalRegionConfig = {
        ...regionConfig,
        styleId: finalStyleId,
      };

      // Update UI to show download starting
      this.updateUIForDownloadStart();

      // First, add the region metadata
      await this.offlineManager.addRegion(finalRegionConfig);

      // Then download tiles for the region
      console.warn('Starting tile download for region:', regionId);

      // Get the style data for tile download
      const styles = await loadStyles();
      const styleData = styles.find((s: any) => s.key === finalStyleId);
      if (!styleData) {
        throw new Error('Style not found for tile download');
      }

      await downloadTiles(finalRegionConfig, styleData.style, finalStyleId, {
        onProgress: progress => {
          console.warn(
            `Tile download progress: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`
          );
          // Update progress in UI if needed
          this.options.onProgressUpdate?.(
            new Map([
              [
                regionId,
                {
                  regionId,
                  completed: progress.completed,
                  total: progress.total,
                  percentage: progress.percentage,
                  currentResource: progress.message || 'Downloading tiles',
                },
              ],
            ])
          );
        },
        skipExisting: true,
        batchSize: 20,
        maxConcurrency: 10,
      });
      console.warn('Tile download completed for region:', regionId);

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
