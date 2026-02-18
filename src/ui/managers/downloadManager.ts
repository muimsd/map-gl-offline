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

import { isStyleDownloaded, loadStyles } from '@/services/styleService';
import { downloadTiles } from '../../services/tileService';
import { OfflineMapManager } from '../../managers/offlineMapManager';
import { RegionFormData } from '../modals/regionFormModal';
import { logger } from '../../utils/logger';
import { isMapboxProtocol, resolveMapboxUrl } from '../../utils/styleProviderUtils';
import { extractAllFontNames } from '../../utils/styleUtils';

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
  phase?: 'style' | 'sprites' | 'glyphs' | 'tiles';
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
    };

    const regionId = regionConfig.id;

    try {
      // Check if style is downloaded (by styleUrl only)
      const styleExists = await isStyleDownloaded(undefined, regionConfig.styleUrl);

      let finalStyleId: string;
      if (!styleExists) {
        // Enhanced style download with Mapbox GL support
        downloadLogger.debug(`Downloading style with provider: ${formData.provider}`);

        // Use the enhanced downloadStyleWithProvider for Mapbox GL support
        const styleDownloadOptions = {
          skipExisting: true,
          enableSourceEmbedding: true, // CRITICAL: Embed TileJSON into sources for tile downloads
          provider: formData.provider || 'auto',
          accessToken: formData.accessToken,
          onProgress: (progress: { percentage?: number }) => {
            downloadLogger.debug(`Style download progress: ${progress.percentage}%`);
            this.updateProgress(
              regionId,
              regionConfig.name,
              'style',
              progress.percentage || 0,
              100,
              'Downloading style'
            );
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
        downloadLogger.debug(`Style downloaded successfully: ${finalStyleId}`);
      } else {
        // Find the existing style to get its ID
        const styles = await loadStyles();
        const existingStyle = styles.find(
          (s: { style?: { sprite?: string }; originalUrl?: string }) =>
            s?.style?.sprite?.includes(regionConfig.styleUrl) ||
            s?.originalUrl === regionConfig.styleUrl
        );
        if (!existingStyle) {
          throw new Error('Style exists but could not be found');
        }
        finalStyleId = existingStyle.key;
        downloadLogger.debug(`Using existing style: ${finalStyleId}`);
      }

      // Update region config with the styleId from the downloaded/existing style
      const finalRegionConfig = {
        ...regionConfig,
        styleId: finalStyleId,
      };

      // Update UI to show download starting
      this.updateUIForDownloadStart();

      // IMPORTANT: Get the style data BEFORE calling addRegion(), which patches URLs to idb://
      // We need the original HTTP URLs for downloading resources
      const styles = await loadStyles();
      const styleData = styles.find((s: { key?: string }) => s.key === finalStyleId);
      if (!styleData) {
        throw new Error('Style not found for resource download');
      }

      // Get the stored style which has embedded TileJSON data
      // This is the style we'll use for tile downloads (it has the tiles array)
      // MUST be loaded before addRegion() patches the URLs
      const styleWithEmbeddedSources = styleData.style;

      // Use original sprite/glyph URLs stored in the style metadata
      // These are preserved from when the style was first downloaded
      const originalSpriteUrl = styleData.originalSpriteUrl;
      const originalGlyphsUrl = styleData.originalGlyphsUrl;

      downloadLogger.debug('Original URLs from style metadata:', {
        sprite: originalSpriteUrl,
        glyphs: originalGlyphsUrl,
      });

      // Create a copy of the style with original URLs for resource downloads
      const originalStyleForResources = {
        ...styleData.style,
        sprite: originalSpriteUrl,
        glyphs: originalGlyphsUrl,
      };

      // Download sprites if the style has them
      if (
        originalStyleForResources?.sprite &&
        !originalStyleForResources.sprite.startsWith('idb://')
      ) {
        downloadLogger.debug('Downloading sprites for style:', finalStyleId);
        downloadLogger.debug('Original sprite URL:', originalStyleForResources.sprite);
        try {
          const { SpriteService } = await import('../../services/spriteService');
          const spriteService = new SpriteService();

          // Generate sprite URLs from base sprite path (use ORIGINAL style)
          let spriteBase = originalStyleForResources.sprite;
          if (isMapboxProtocol(spriteBase) && formData.accessToken) {
            spriteBase = resolveMapboxUrl(spriteBase, formData.accessToken);
          }

          // Build sprite URLs; insert suffixes before query string if present
          const suffixes = ['.json', '.png', '@2x.json', '@2x.png'];
          const qIndex = spriteBase.indexOf('?');
          const spriteUrls = suffixes.map(suffix =>
            qIndex !== -1
              ? spriteBase.slice(0, qIndex) + suffix + spriteBase.slice(qIndex)
              : spriteBase + suffix
          );

          downloadLogger.debug('Sprite URLs to download:', spriteUrls);

          await spriteService.downloadSprites(spriteUrls, finalStyleId, {
            onProgress: (progress: { completed: number; total: number }) => {
              downloadLogger.debug(`Sprite download: ${progress.completed}/${progress.total}`);
              this.updateProgress(
                regionId,
                regionConfig.name,
                'sprites',
                progress.completed,
                progress.total,
                'Downloading sprites'
              );
            },
            enableValidation: true,
            skipExisting: false,
          });
          downloadLogger.debug('Sprites downloaded successfully');
        } catch (spriteError) {
          downloadLogger.error('Failed to download sprites (non-fatal):', spriteError);
        }
      } else if (originalStyleForResources?.sprite?.startsWith('idb://')) {
        downloadLogger.debug(
          'Skipping sprite download - sprite URL is already patched:',
          originalStyleForResources.sprite
        );
      }

      // Download glyphs if the style has them
      if (
        originalStyleForResources?.glyphs &&
        !originalStyleForResources.glyphs.startsWith('idb://')
      ) {
        downloadLogger.debug('Downloading glyphs for style:', finalStyleId);
        downloadLogger.debug('Original glyphs URL:', originalStyleForResources.glyphs);
        try {
          const { GlyphService } = await import('../../services/glyphService');
          const glyphService = new GlyphService();

          // Extract font families from layers (expression-aware)
          const fontFamilyArray = extractAllFontNames(
            styleData.style as { layers?: Array<{ layout?: { [key: string]: unknown } }> }
          );
          const fontFamilies = new Set<string>(fontFamilyArray);

          if (fontFamilies.size > 0) {
            downloadLogger.debug('Fonts to download:', Array.from(fontFamilies));

            // Download comprehensive set of glyph ranges for complete font coverage
            // These ranges cover most common Unicode blocks
            const glyphRanges = [
              '0-255', // Basic Latin + Latin-1 Supplement
              '256-511', // Latin Extended-A + Latin Extended-B
              '512-767', // IPA Extensions + Spacing Modifier Letters
              '768-1023', // Combining Diacritical Marks + Greek and Coptic
              '1024-1279', // Cyrillic + Cyrillic Supplement
              '1280-1535', // Armenian + Hebrew
              '1536-1791', // Arabic
              '1792-2047', // Syriac + Arabic Supplement + Thaana
              '2048-2303', // NKo + Samaritan + Mandaic
              '2304-2559', // Devanagari + Bengali
              '2560-2815', // Gurmukhi + Gujarati
              '8192-8447', // General Punctuation, Superscripts/Subscripts, Currency Symbols
              '8448-8703', // Letterlike Symbols, Number Forms, Arrows
              '2816-3071', // Oriya + Tamil
              '3072-3327', // Telugu + Kannada
              '3328-3583', // Malayalam + Sinhala
              '3584-3839', // Thai + Lao
              '3840-4095', // Tibetan + Myanmar
              '4096-4351', // Georgian + Hangul Jamo
              '4352-4607', // Ethiopic
              '4608-4863', // Cherokee + Canadian Aboriginal
              '11904-12031', // CJK Radicals Supplement
              '12032-12255', // Kangxi Radicals + CJK Symbols
              '12288-12543', // Hiragana + Katakana
              '12544-12799', // Bopomofo + Hangul Compatibility Jamo
              '19968-20223', // CJK Unified Ideographs (first block)
              '20224-20479', // CJK Unified Ideographs
              '40960-42127', // Yi Syllables + Yi Radicals
              '44032-55203', // Hangul Syllables (Korean)
              '63744-64255', // CJK Compatibility Ideographs
              '65280-65535', // Halfwidth and Fullwidth Forms
            ];

            let glyphsUrl = originalStyleForResources.glyphs;
            if (isMapboxProtocol(glyphsUrl) && formData.accessToken) {
              glyphsUrl = resolveMapboxUrl(glyphsUrl, formData.accessToken);
            }

            await glyphService.downloadGlyphs(
              glyphsUrl, // Use ORIGINAL unpatched glyphs URL (resolved if mapbox://)
              Array.from(fontFamilies),
              finalStyleId,
              glyphRanges,
              {
                onProgress: (progress: { completed: number; total: number }) => {
                  downloadLogger.debug(`Glyph download: ${progress.completed}/${progress.total}`);
                  this.updateProgress(
                    regionId,
                    regionConfig.name,
                    'glyphs',
                    progress.completed,
                    progress.total,
                    'Downloading glyphs'
                  );
                },
              }
            );
            downloadLogger.debug('Glyphs downloaded successfully');
          } else {
            downloadLogger.debug('No fonts found in style layers');
          }
        } catch (glyphError) {
          downloadLogger.error('Failed to download glyphs (non-fatal):', glyphError);
        }
      } else if (originalStyleForResources?.glyphs?.startsWith('idb://')) {
        downloadLogger.debug(
          'Skipping glyph download - glyphs URL is already patched:',
          originalStyleForResources.glyphs
        );
      }

      // Then download tiles for the region
      downloadLogger.debug('Starting tile download for region:', regionId);
      downloadLogger.debug('Region config:', finalRegionConfig);
      downloadLogger.debug('Style data sources:', Object.keys(styleData.style?.sources || {}));

      // Use the already-fetched style data
      if (!styleData) {
        throw new Error('Style not found for tile download');
      }

      if (!styleData.style) {
        throw new Error('Style data does not contain style object');
      }

      if (!styleData.style.sources || Object.keys(styleData.style.sources).length === 0) {
        throw new Error('Style does not contain any sources for tile download');
      }

      downloadLogger.debug('Calling downloadTiles with finalStyleId:', finalStyleId);
      downloadLogger.debug(
        'Stored style sources:',
        Object.keys(styleWithEmbeddedSources?.sources || {})
      );

      // Log source details to verify we have tile URLs
      if (styleWithEmbeddedSources?.sources) {
        for (const [sourceId, source] of Object.entries(styleWithEmbeddedSources.sources)) {
          const typedSource = source as { tiles?: string[]; url?: string };
          downloadLogger.debug(`Source ${sourceId}:`, {
            hasTiles: !!typedSource.tiles,
            tilesCount: typedSource.tiles?.length,
            firstTileUrl: typedSource.tiles?.[0],
            hasUrl: !!typedSource.url,
          });
        }
      }

      // Use stored style with embedded TileJSON (has tiles array) for tile downloads
      const tileResult = await downloadTiles(
        finalRegionConfig,
        styleWithEmbeddedSources,
        finalStyleId,
        {
          onProgress: progress => {
            downloadLogger.debug(
              `Tile download progress: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`
            );
            this.updateProgress(
              regionId,
              regionConfig.name,
              'tiles',
              progress.completed,
              progress.total,
              progress.message || 'Downloading tiles'
            );
          },
          skipExisting: false, // Always download tiles to ensure fresh data
          batchSize: 20,
          maxConcurrency: 10,
        }
      );

      downloadLogger.debug('Tile download completed for region:', regionId);
      downloadLogger.debug('Tile download result:', {
        totalTiles: tileResult.totalTiles,
        downloadedTiles: tileResult.downloadedTiles,
        failedTiles: tileResult.failedTiles,
        skippedTiles: tileResult.skippedTiles,
        totalSize: tileResult.totalSize,
        tileExtension: tileResult.tileExtension, // Extension used for tiles (mvt, pbf, etc.)
        hasErrors: tileResult.errors?.length > 0,
      });

      if (tileResult.failedTiles > 0 || (tileResult.errors && tileResult.errors.length > 0)) {
        downloadLogger.error('Tile download had errors:', tileResult.errors);
      }

      if (tileResult.downloadedTiles === 0 && tileResult.skippedTiles === 0) {
        downloadLogger.warn(
          'WARNING: No tiles were downloaded! Check the style sources and TileJSON.'
        );
      }

      // NOW add the region metadata - this patches the style URLs to idb:// for offline use
      // This MUST happen AFTER all downloads are complete since patching converts URLs to idb://
      downloadLogger.debug('Adding region metadata and patching style for offline use');
      await this.offlineManager.addRegion({
        ...finalRegionConfig,
        tileExtension: tileResult.tileExtension,
      });

      // Download complete
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
