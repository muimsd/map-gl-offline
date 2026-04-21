/**
 * Download Manager for offline map regions.
 *
 * This module handles the complete download workflow for offline map regions,
 * including styles, sprites, glyphs (fonts), and map tiles. It provides
 * progress tracking across all download phases.
 *
 * **Download Phases:**
 * 1. `style` - Downloads the map style JSON and processes sources
 * 2. `sprites` - Downloads sprite images and JSON for map icons
 * 3. `glyphs` - Downloads font glyphs for text rendering
 * 4. `tiles` - Downloads map tiles for the specified region bounds
 *
 * **Usage:**
 * The DownloadManager is typically instantiated by the OfflineManagerControl
 * and handles downloads triggered by user region selections.
 *
 * @example
 * ```ts
 * const downloadManager = new DownloadManager({
 *   offlineManager,
 *   onProgressUpdate: (downloads) => {
 *     for (const [id, progress] of downloads) {
 *       console.log(`${progress.phase}: ${progress.percentage}%`);
 *     }
 *   },
 *   onDownloadComplete: (regionId) => {
 *     console.log(`Region ${regionId} downloaded successfully`);
 *   },
 *   onDownloadError: (regionId, error) => {
 *     console.error(`Download failed: ${error}`);
 *   },
 * });
 *
 * await downloadManager.downloadRegion({
 *   name: 'My Region',
 *   bounds: [-122.5, 37.7, -122.3, 37.9],
 *   minZoom: 10,
 *   maxZoom: 16,
 *   styleUrl: 'https://example.com/style.json',
 * });
 * ```
 *
 * @module downloadManager
 */

import { OfflineMapManager } from '@/managers/offlineMapManager';
import { RegionFormData } from '@/ui/modals/regionFormModal';
import { logger } from '@/utils/logger';

const downloadLogger = logger.scope('DownloadManager');

/**
 * Progress information for an active download.
 *
 * @example
 * ```ts
 * const progress: DownloadProgress = {
 *   regionId: 'region_123',
 *   completed: 450,
 *   total: 1000,
 *   percentage: 45,
 *   currentResource: 'Downloading tiles',
 *   phase: 'tiles',
 * };
 * ```
 */
export interface DownloadProgress {
  /** Unique identifier for the region being downloaded */
  regionId: string;
  /** Human-readable name of the region */
  regionName: string;
  /** Number of resources completed in current phase */
  completed: number;
  /** Total number of resources in current phase */
  total: number;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Human-readable description of current activity */
  currentResource: string;
  /** Current download phase */
  phase?: 'style' | 'sprites' | 'glyphs' | 'models' | 'tiles';
}

/**
 * Configuration options for the DownloadManager.
 *
 * @example
 * ```ts
 * const options: DownloadManagerOptions = {
 *   offlineManager: myOfflineManager,
 *   onProgressUpdate: (downloads) => updateUI(downloads),
 *   onDownloadComplete: (id) => showSuccessMessage(id),
 *   onDownloadError: (id, err) => showErrorMessage(err),
 * };
 * ```
 */
export interface DownloadManagerOptions {
  /** The OfflineMapManager instance for storage operations */
  offlineManager: OfflineMapManager;
  /** Callback fired when download progress changes */
  onProgressUpdate?: (downloads: Map<string, DownloadProgress>) => void;
  /** Callback fired when a region download completes successfully */
  onDownloadComplete?: (regionId: string) => void;
  /** Callback fired when a region download fails */
  onDownloadError?: (regionId: string, error: Error | string) => void;
  /** Callback to update the UI button state */
  updateButton?: (text: string, disabled: boolean) => void;
  /** Callback to update the progress badge display */
  updateProgressBadge?: (text: string, visible: boolean) => void;
}

/**
 * Manages the download of offline map regions.
 *
 * Handles the complete workflow for downloading map resources including:
 * - Map styles (JSON configuration)
 * - Sprites (icons and symbols)
 * - Glyphs (font data for text rendering)
 * - Tiles (actual map imagery/vector data)
 *
 * Provides progress tracking and error handling for each phase.
 */
export class DownloadManager {
  private offlineManager: OfflineMapManager;
  /** Map of region IDs to their download progress */
  private currentDownloads: Map<string, DownloadProgress> = new Map();
  private options: DownloadManagerOptions;

  /**
   * Create a new DownloadManager instance.
   * @param options - Configuration options including callbacks and manager reference
   */
  constructor(options: DownloadManagerOptions) {
    this.offlineManager = options.offlineManager;
    this.options = options;
  }

  /**
   * Update and broadcast progress for a download phase.
   * Calculates percentage and notifies listeners via the onProgressUpdate callback.
   * @internal
   */
  private updateProgress(
    regionId: string,
    regionName: string,
    phase: DownloadProgress['phase'],
    completed: number,
    total: number,
    currentResource: string
  ): void {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    this.currentDownloads.set(regionId, {
      regionId,
      regionName,
      completed,
      total,
      percentage,
      currentResource,
      phase,
    });

    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Download a complete offline map region.
   *
   * This method orchestrates the full download workflow:
   * 1. Downloads or retrieves the map style
   * 2. Downloads sprite resources (icons)
   * 3. Downloads glyph resources (fonts)
   * 4. Downloads all tiles for the specified bounds and zoom levels
   *
   * Progress updates are broadcast via the `onProgressUpdate` callback
   * throughout the process.
   *
   * @param formData - Region configuration from the user form
   * @throws Error if style download fails or no sources are available
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
      extraSources: formData.extraSources,
    };

    const regionId = regionConfig.id;
    this.updateUIForDownloadStart();

    try {
      await this.offlineManager.downloadRegion(regionConfig, {
        provider: formData.provider || 'auto',
        accessToken: formData.accessToken,
        onProgress: progress => {
          const uiPhase: DownloadProgress['phase'] | undefined =
            progress.phase === 'metadata' ? undefined : progress.phase;
          this.updateProgress(
            regionId,
            regionConfig.name,
            uiPhase,
            progress.completed,
            progress.total,
            progress.message ?? `Downloading ${progress.phase}`
          );
        },
        tileOptions: {
          maxConcurrency: 10,
        },
      });

      this.handleDownloadComplete(regionId);
    } catch (error) {
      downloadLogger.error('Error downloading region:', error);
      this.handleDownloadError(regionId, error);
    }
  }

  /**
   * Get a map of all current downloads and their progress.
   * @returns Map of region IDs to their download progress information
   */
  public getCurrentDownloads(): Map<string, DownloadProgress> {
    return this.currentDownloads;
  }

  /**
   * Check if any downloads are currently in progress.
   * @returns `true` if one or more downloads are active
   */
  public hasActiveDownloads(): boolean {
    return this.currentDownloads.size > 0;
  }

  /**
   * Cancel a specific region download.
   * Removes the download from tracking and resets UI if no downloads remain.
   * @param regionId - The ID of the region download to cancel
   */
  public cancelDownload(regionId: string): void {
    this.currentDownloads.delete(regionId);

    if (this.currentDownloads.size === 0) {
      this.resetUI();
    }

    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Cancel all active downloads.
   * Clears all download tracking and resets the UI.
   */
  public cancelAllDownloads(): void {
    this.currentDownloads.clear();
    this.resetUI();
    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Update UI elements when a download starts.
   * @internal
   */
  private updateUIForDownloadStart(): void {
    this.options.updateButton?.('Downloading...', true);
    this.options.updateProgressBadge?.('0%', true);
  }

  /**
   * Handle successful completion of a region download.
   * Removes from tracking, resets UI if needed, and notifies listeners.
   * @internal
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
   * Handle a download error for a region.
   * Removes from tracking, resets UI if needed, and notifies error listeners.
   * @internal
   */
  private handleDownloadError(regionId: string, error: Error | string | unknown): void {
    this.currentDownloads.delete(regionId);

    if (this.currentDownloads.size === 0) {
      this.resetUI();
    }

    const errorMessage = error instanceof Error ? error : String(error);
    this.options.onDownloadError?.(regionId, errorMessage);
    this.options.onProgressUpdate?.(this.currentDownloads);
  }

  /**
   * Reset UI elements to their initial state.
   * Called when all downloads complete or are cancelled.
   * @internal
   */
  private resetUI(): void {
    this.options.updateButton?.('Offline Maps', false);
    this.options.updateProgressBadge?.('', false);
  }
}
