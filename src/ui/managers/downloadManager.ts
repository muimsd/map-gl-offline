/**
 * Download Manager Component
 * Handles download operations and progress tracking
 */

import { isStyleDownloaded, loadStyles } from '@/services/styleService';
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
  onDownloadError?: (regionId: string, error: Error | string) => void;
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
        console.warn(`🎨 Downloading style with provider: ${formData.provider}`);

        // Use the enhanced downloadStyleWithProvider for Mapbox GL support
        const styleDownloadOptions = {
          skipExisting: true,
          provider: formData.provider || 'auto',
          accessToken: formData.accessToken,
          onProgress: (progress: { percentage?: number }) => {
            console.warn(`Style download progress: ${progress.percentage}%`);
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
        console.warn(`✅ Style downloaded successfully: ${finalStyleId}`);
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
        console.warn(`📋 Using existing style: ${finalStyleId}`);
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

      // Get the style data for resource downloads
      const styles = await loadStyles();
      const styleData = styles.find((s: { key?: string }) => s.key === finalStyleId);
      if (!styleData) {
        throw new Error('Style not found for resource download');
      }

      // Get the ORIGINAL unpatched style for downloading resources
      // The stored style is already patched with idb:// URLs, which won't work for downloads
      let originalStyle = styleData.style;

      // If the style URLs are already patched, we need to fetch the original
      if (
        styleData.style?.sprite?.startsWith('idb://') ||
        styleData.style?.glyphs?.startsWith('idb://')
      ) {
        console.warn('⚠️ Style URLs are already patched, fetching original style for downloads');

        // Fetch the original style from the URL if available
        if (styleData.originalUrl) {
          try {
            const response = await fetch(styleData.originalUrl);
            if (response.ok) {
              originalStyle = await response.json();
              console.warn('✅ Fetched original style from:', styleData.originalUrl);
            }
          } catch (error) {
            console.error('Failed to fetch original style, will use stored style:', error);
          }
        }
      }

      // Download sprites if the style has them
      if (originalStyle?.sprite && !originalStyle.sprite.startsWith('idb://')) {
        console.warn('📦 Downloading sprites for style:', finalStyleId);
        console.warn('📦 Original sprite URL:', originalStyle.sprite);
        try {
          const { SpriteService } = await import('../../services/spriteService');
          const spriteService = new SpriteService();

          // Generate sprite URLs from base sprite path (use ORIGINAL style)
          const spriteBase = originalStyle.sprite;
          const spriteUrls = [
            `${spriteBase}.json`,
            `${spriteBase}.png`,
            `${spriteBase}@2x.json`,
            `${spriteBase}@2x.png`,
          ];

          console.warn('📦 Sprite URLs to download:', spriteUrls);

          await spriteService.downloadSprites(spriteUrls, finalStyleId, {
            onProgress: (progress: { completed: number; total: number }) => {
              console.warn(`Sprite download: ${progress.completed}/${progress.total}`);
            },
            enableValidation: true,
            skipExisting: false,
          });
          console.warn('✅ Sprites downloaded successfully');
        } catch (spriteError) {
          console.error('⚠️ Failed to download sprites (non-fatal):', spriteError);
        }
      } else if (originalStyle?.sprite?.startsWith('idb://')) {
        console.warn(
          '⏭️ Skipping sprite download - sprite URL is already patched:',
          originalStyle.sprite
        );
      }

      // Download glyphs if the style has them
      if (originalStyle?.glyphs && !originalStyle.glyphs.startsWith('idb://')) {
        console.warn('📝 Downloading glyphs for style:', finalStyleId);
        console.warn('📝 Original glyphs URL:', originalStyle.glyphs);
        try {
          const { GlyphService } = await import('../../services/glyphService');
          const glyphService = new GlyphService();

          // Extract font families from layers
          const fontFamilies = new Set<string>();
          if (styleData.style.layers && Array.isArray(styleData.style.layers)) {
            for (const layer of styleData.style.layers) {
              const typedLayer = layer as { type?: string; layout?: { 'text-font'?: string[] } };
              if (typedLayer.type === 'symbol' && typedLayer.layout?.['text-font']) {
                const fonts = typedLayer.layout['text-font'];
                if (Array.isArray(fonts)) {
                  fonts.forEach((f: string) => fontFamilies.add(f));
                }
              }
            }
          }

          if (fontFamilies.size > 0) {
            console.warn('📝 Fonts to download:', Array.from(fontFamilies));

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

            await glyphService.downloadGlyphs(
              originalStyle.glyphs, // Use ORIGINAL unpatched glyphs URL
              Array.from(fontFamilies),
              finalStyleId,
              glyphRanges,
              {
                onProgress: (progress: { completed: number; total: number }) => {
                  console.warn(`Glyph download: ${progress.completed}/${progress.total}`);
                },
              }
            );
            console.warn('✅ Glyphs downloaded successfully');
          } else {
            console.warn('⚠️ No fonts found in style layers');
          }
        } catch (glyphError) {
          console.error('⚠️ Failed to download glyphs (non-fatal):', glyphError);
        }
      } else if (originalStyle?.glyphs?.startsWith('idb://')) {
        console.warn(
          '⏭️ Skipping glyph download - glyphs URL is already patched:',
          originalStyle.glyphs
        );
      }

      // Then download tiles for the region
      console.warn('🗺️ Starting tile download for region:', regionId);
      console.warn('📋 Region config:', finalRegionConfig);
      console.warn('📋 Style data sources:', Object.keys(styleData.style?.sources || {}));

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

      console.warn('🎯 Calling downloadTiles with finalStyleId:', finalStyleId);

      const tileResult = await downloadTiles(finalRegionConfig, styleData.style, finalStyleId, {
        onProgress: progress => {
          console.warn(
            `🔄 Tile download progress: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`
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
        skipExisting: false, // Always download tiles to ensure fresh data
        batchSize: 20,
        maxConcurrency: 10,
      });

      console.warn('✅ Tile download completed for region:', regionId);
      console.warn('📊 Tile download result:', {
        totalTiles: tileResult.totalTiles,
        downloadedTiles: tileResult.downloadedTiles,
        failedTiles: tileResult.failedTiles,
        skippedTiles: tileResult.skippedTiles,
        totalSize: tileResult.totalSize,
        tileExtension: tileResult.tileExtension, // Extension used for tiles (mvt, pbf, etc.)
        hasErrors: tileResult.errors?.length > 0,
      });

      // Save the tile extension to the region for future use
      if (tileResult.tileExtension) {
        console.warn(`📝 Saving tile extension to region: ${tileResult.tileExtension}`);
        try {
          const { dbPromise } = await import('../../storage/indexedDbManager');
          const db = await dbPromise;

          // Get the current region
          const currentRegion = await db.get('regions', regionId);
          if (currentRegion) {
            // Update with tile extension
            currentRegion.tileExtension = tileResult.tileExtension;
            await db.put('regions', currentRegion);
            console.warn(`✅ Tile extension saved to region: ${tileResult.tileExtension}`);
          }
        } catch (saveError) {
          console.error('Failed to save tile extension to region:', saveError);
        }
      }

      if (tileResult.failedTiles > 0 || (tileResult.errors && tileResult.errors.length > 0)) {
        console.error('⚠️ Tile download had errors:', tileResult.errors);
      }

      if (tileResult.downloadedTiles === 0 && tileResult.skippedTiles === 0) {
        console.warn('⚠️ WARNING: No tiles were downloaded! Check the style sources and TileJSON.');
      }

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
   * Reset UI to initial state
   */
  private resetUI(): void {
    this.options.updateButton?.('Offline Maps', false);
    this.options.updateProgressBadge?.('', false);
  }
}
