import { dbPromise } from '../storage/indexedDbManager';
import { downloadFonts } from './fontService';
import { downloadSprites } from './spriteService';
import { generateGlyphUrlsFromStyle, fetchWithRetry, logger } from '../utils';
import { GLYPH_CONFIG } from '../utils/constants';
import {
  detectStyleProvider,
  extractAccessToken,
  normalizeStyleUrl,
  processStyleSources,
  validateStyleForProvider,
  isMapboxProtocol,
  resolveMapboxUrl,
} from '../utils/styleProviderUtils';
import type {
  StyleEntry,
  BaseStyle,
  StyleProvider,
  StyleDownloadOptions,
  StyleDownloadResult,
  DownloadProgress,
  StyleStorageItem,
  EnhancedStyleStats,
  FontDownloadResult,
  SpriteDownloadResult,
} from '../types';

// Helper functions to work with StyleEntry structure
function createStyleEntry(
  key: string,
  style: BaseStyle,
  provider: StyleProvider = 'auto',
  metadata: {
    lastModified?: number;
    downloadedAt?: number;
    originalUrl?: string;
    originalSpriteUrl?: string;
    originalGlyphsUrl?: string;
    validated?: boolean;
    size?: number;
    sourceCount?: number;
    layerCount?: number;
    accessToken?: string;
  } = {}
): StyleEntry {
  return {
    key,
    style,
    provider,
    regions: [],
    fonts: [],
    glyphs: [],
    sprites: [],
    ...metadata,
  };
}

function getStyleData(entry: StyleEntry): BaseStyle & { id?: string } {
  return {
    ...entry.style,
    id: entry.key,
  };
}

export async function downloadStyles(
  stylesUrl: string,
  options: StyleDownloadOptions = {}
): Promise<StyleDownloadResult> {
  const {
    onProgress,
    fontOptions,
    spriteOptions,
    skipExisting = true,
    validateStyle = true,
    maxRetries = 3,
    timeoutMs = 30000,
    enableSourceEmbedding = true,
    storageQuotaCheck = false,
    includeMetadata = true,
  } = options;

  const startTime = Date.now();
  let styleSize = 0;
  let sourcesProcessed = 0;
  let sourcesEmbedded = 0;
  const errors: string[] = [];
  const sourceTypes: Record<string, number> = {};
  const layerTypes: Record<string, number> = {};

  try {
    // Check storage quota if requested
    if (
      storageQuotaCheck &&
      'navigator' in globalThis &&
      'storage' in navigator &&
      'estimate' in navigator.storage
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        const availableSpace = (estimate.quota || 0) - (estimate.usage || 0);
        const estimatedSize = 5 * 1024 * 1024; // Rough estimate: 5MB for style

        if (availableSpace < estimatedSize) {
          logger.warn(
            `Insufficient storage space. Available: ${(availableSpace / 1024 / 1024).toFixed(1)}MB, Estimated need: ${(estimatedSize / 1024 / 1024).toFixed(1)}MB`
          );
        }
      } catch (error) {
        logger.warn('Could not check storage quota:', error);
      }
    }

    // Resolve mapbox:// style URLs to HTTPS before fetching
    let fetchUrl = stylesUrl;
    if (isMapboxProtocol(stylesUrl)) {
      const accessToken = options.accessToken || extractAccessToken(stylesUrl) || undefined;
      if (!accessToken) {
        throw new Error(
          'Mapbox access token is required for mapbox:// style URLs. ' +
            'Provide it via options.accessToken or as a query parameter.'
        );
      }
      fetchUrl = resolveMapboxUrl(stylesUrl, accessToken);
      logger.debug(`Resolved mapbox:// style URL to: ${fetchUrl}`);
    }

    onProgress?.({
      completed: 0,
      total: 100,
      percentage: 0,
      message: 'Fetching style',
      errors: [],
    });

    const response = await fetchWithRetry(fetchUrl, {
      retries: maxRetries,
      timeout: timeoutMs,
      retryDelay: 1000,
    });

    const style = await response.json();
    styleSize = JSON.stringify(style).length;

    logger.debug('Original style downloaded', {
      id: style.id,
      hasSprite: !!style.sprite,
      hasSources: !!style.sources,
      sourceCount: style.sources ? Object.keys(style.sources).length : 0,
    });

    // Generate style ID if missing
    if (!style.id) {
      style.id = stylesUrl.split('/').pop()?.split('.')[0] || `style_${Date.now()}`;
      logger.debug(`Style missing ID, generated: ${style.id}`);
    }

    // Validate style if requested
    if (validateStyle && !isValidStyleData(style)) {
      throw new Error('Invalid style data received');
    }

    // Check if style already exists in the database
    const db = await dbPromise;

    if (skipExisting) {
      const existingStyle = await db.get('styles', style.id);
      if (existingStyle && typeof existingStyle === 'object') {
        logger.debug(`Style ${style.id} already exists in database, using existing version`);
        onProgress?.({
          completed: 100,
          total: 100,
          percentage: 100,
          message: 'Style already exists',
          errors: [],
        });

        return {
          styleId: style.id,
          success: true,
          downloadTime: Date.now() - startTime,
          styleSize: 0,
          sourcesProcessed: 0,
          sourcesEmbedded: 0,
          errors: [],
          analytics: {
            sourceTypes: {},
            layerTypes: {},
            totalLayers: 0,
            hasGlyphs: false,
            hasSprites: false,
          },
        };
      }
    }

    onProgress?.({
      completed: 20,
      total: 100,
      percentage: 20,
      message: 'Processing style sources',
      errors: [],
    });

    logger.debug(`Downloading new style: ${style.id}`);

    // Get access token early for resolving mapbox:// source URLs during embedding
    const accessTokenForSources = options.accessToken || extractAccessToken(fetchUrl) || undefined;

    // Process sources
    if (enableSourceEmbedding && style.sources) {
      const sourceKeys = Object.keys(style.sources);

      for (let i = 0; i < sourceKeys.length; i++) {
        const sourceKey = sourceKeys[i];
        const source = style.sources[sourceKey];
        sourcesProcessed++;

        // Track source types
        if (source.type) {
          sourceTypes[source.type] = (sourceTypes[source.type] || 0) + 1;
        }

        if (source.url) {
          try {
            // Resolve mapbox:// source URLs before fetching
            let sourceUrl = source.url as string;
            if (isMapboxProtocol(sourceUrl) && accessTokenForSources) {
              sourceUrl = resolveMapboxUrl(sourceUrl, accessTokenForSources);
              logger.debug(`Resolved mapbox:// source URL for ${sourceKey}: ${sourceUrl}`);
            }

            const sourceResponse = await fetchWithRetry(sourceUrl, {
              retries: maxRetries,
              timeout: timeoutMs,
              retryDelay: 1000,
            });

            const sourceData = await sourceResponse.json();
            style.sources[sourceKey] = { ...source, ...sourceData }; // Embed source data
            sourcesEmbedded++;
            logger.debug(`Embedded source data for ${sourceKey}`);
          } catch (error) {
            const errorMsg = `Failed to fetch source for ${sourceKey}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            logger.warn(errorMsg);
          }
        }

        onProgress?.({
          completed: 20 + ((i + 1) / sourceKeys.length) * 30,
          total: 100,
          percentage: 20 + ((i + 1) / sourceKeys.length) * 30,
          message: `Processing sources (${i + 1}/${sourceKeys.length})`,
          errors: [...errors],
        });
      }
    }

    // Analyze layers
    if (style.layers && Array.isArray(style.layers)) {
      for (const layer of style.layers) {
        if (layer.type) {
          layerTypes[layer.type] = (layerTypes[layer.type] || 0) + 1;
        }
      }
    }

    // Detect style provider
    const provider = detectStyleProvider(stylesUrl, style);
    const accessToken =
      options.accessToken ||
      extractAccessToken(fetchUrl) ||
      extractAccessToken(stylesUrl) ||
      undefined;

    // Process style for the detected provider
    const processedStyle = processStyleSources(style, provider, accessToken);

    // Set default glyphs URL if not present
    if (!processedStyle.glyphs) {
      processedStyle.glyphs = GLYPH_CONFIG.DEFAULT_URL;
      logger.debug(`Using default glyphs URL: ${GLYPH_CONFIG.DEFAULT_URL}`);
    }

    // Validate style for the provider
    const validation = validateStyleForProvider(processedStyle, provider);
    if (!validation.isValid) {
      logger.warn('Style validation failed:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      logger.warn('Style validation warnings:', validation.warnings);
    }

    // Create enhanced style storage item
    // Save original sprite/glyph URLs before they might get patched later
    const styleStorageItem = createStyleEntry(
      style.id,
      processedStyle,
      provider,
      includeMetadata
        ? {
            lastModified: Date.now(),
            downloadedAt: Date.now(),
            originalUrl: stylesUrl,
            originalSpriteUrl: style.sprite,
            originalGlyphsUrl: style.glyphs,
            validated: validateStyle && validation.isValid,
            size: styleSize,
            sourceCount: sourcesProcessed,
            layerCount: processedStyle.layers ? processedStyle.layers.length : 0,
            accessToken,
          }
        : {}
    );

    // Save the style
    await db.put('styles', styleStorageItem);
    logger.debug('Style with sources saved successfully');

    onProgress?.({
      completed: 50,
      total: 100,
      percentage: 50,
      message: 'Style saved',
      errors: [...errors],
    });

    let fontResult: FontDownloadResult | undefined;
    let spriteResult: SpriteDownloadResult | undefined;

    // Use the processed (resolved) glyphs/sprite URLs for downloads.
    // The raw style may still contain mapbox:// protocol URLs which are not fetchable.
    const resolvedGlyphs = processedStyle.glyphs;
    const resolvedSprite = processedStyle.sprite;

    // Download fonts (glyphs) for the style
    if (resolvedGlyphs) {
      onProgress?.({
        completed: 60,
        total: 100,
        percentage: 60,
        message: 'Downloading fonts',
        errors: [...errors],
      });

      logger.debug('Starting font/glyph download for style:', style.id);

      try {
        const fontUrls = generateGlyphUrlsFromStyle(style, resolvedGlyphs);
        logger.debug(`Generated ${fontUrls.length} font URLs for download`);

        fontResult = await downloadFonts(fontUrls, style.id, {
          continueOnError: true,
          quietMode: true,
          validateFonts: false, // Be more lenient with font validation
          maxRetries: 1, // Reduce retries for faster failure
          timeout: 10000, // Shorter timeout for fonts
          ...fontOptions,
          onProgress: fontProgress => {
            onProgress?.({
              completed: 60 + fontProgress.percentage * 0.2,
              total: 100,
              percentage: 60 + fontProgress.percentage * 0.2,
              message: `Downloading fonts (${fontProgress.completed}/${fontProgress.total})`,
              errors: [...errors, ...fontProgress.errors],
            });
          },
        });

        logger.debug('Font download completed');

        if (includeMetadata) {
          styleStorageItem.fonts = fontUrls;
        }
      } catch (error) {
        const errorMsg = `Font download failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    // Download glyphs for the style
    if (resolvedGlyphs) {
      onProgress?.({
        completed: 70,
        total: 100,
        percentage: 70,
        message: 'Downloading glyphs',
        errors: [...errors],
      });

      logger.debug('Starting glyph download for style:', style.id);

      try {
        // Extract font stacks from style layers (expression-aware)
        const { extractAllFontNames } = await import('../utils/styleUtils');
        const fontStackArray = extractAllFontNames(style);
        logger.debug(`Found ${fontStackArray.length} font stacks for glyph download`);

        if (fontStackArray.length > 0) {
          const { downloadGlyphs } = await import('./glyphService');
          await downloadGlyphs(resolvedGlyphs, fontStackArray, style.id, ['0-255', '256-511'], {
            maxConcurrency: 3,
            retries: 1,
            timeout: 10000,
            onProgress: glyphProgress => {
              onProgress?.({
                completed: 70 + (glyphProgress.completed / glyphProgress.total) * 10,
                total: 100,
                percentage: 70 + (glyphProgress.completed / glyphProgress.total) * 10,
                message: `Downloading glyphs (${glyphProgress.completed}/${glyphProgress.total})`,
                errors: [...errors],
              });
            },
          });

          logger.debug('Glyph download completed');

          if (includeMetadata) {
            styleStorageItem.glyphs = fontStackArray.map(
              stack => `${resolvedGlyphs}/${stack}/0-255.pbf`
            );
          }
        }
      } catch (error) {
        const errorMsg = `Glyph download failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    onProgress?.({
      completed: 80,
      total: 100,
      percentage: 80,
      message: 'Fonts processed',
      errors: [...errors],
    });

    // Download sprites for the style (supports string and array format)
    if (resolvedSprite) {
      onProgress?.({
        completed: 85,
        total: 100,
        percentage: 85,
        message: 'Downloading sprites',
        errors: [...errors],
      });

      try {
        logger.debug(`Processing sprites for style: ${style.id}`);
        const spriteSuffixes = ['.json', '.png', '@2x.json', '@2x.png'];
        const allSpriteVariants: string[] = [];

        // Normalize sprite to array of {id, url} sources
        const spriteSources: Array<{ id: string; url: string }> = [];
        if (typeof resolvedSprite === 'string') {
          spriteSources.push({ id: 'sprite', url: resolvedSprite });
        } else if (Array.isArray(resolvedSprite)) {
          for (const entry of resolvedSprite as unknown as Array<{ id: string; url: string }>) {
            if (entry && typeof entry.url === 'string') {
              spriteSources.push(entry);
            }
          }
        }

        for (const source of spriteSources) {
          const spriteBase = source.url;

          // Insert suffixes before query string if present
          const qIndex = spriteBase.indexOf('?');
          const spriteVariants = spriteSuffixes.map(suffix =>
            qIndex !== -1
              ? spriteBase.slice(0, qIndex) + suffix + spriteBase.slice(qIndex)
              : spriteBase + suffix
          );

          // Check for non-HTTP URLs
          const hasNonHttpUrls = spriteVariants.some(
            url => url.startsWith('idb://') || url.startsWith('mapbox://')
          );
          if (hasNonHttpUrls) {
            logger.warn(`Skipping sprite source "${source.id}" - contains non-HTTP URLs`);
            continue;
          }

          spriteResult = await downloadSprites(spriteVariants, style.id, {
            ...spriteOptions,
            namePrefix: source.id !== 'sprite' ? source.id : undefined,
            onProgress: (spriteProgress: DownloadProgress) => {
              onProgress?.({
                completed: 85 + spriteProgress.percentage * 0.1,
                total: 100,
                percentage: 85 + spriteProgress.percentage * 0.1,
                message: `Downloading sprites (${spriteProgress.completed}/${spriteProgress.total})`,
                errors: [...errors, ...spriteProgress.errors],
              });
            },
          });

          allSpriteVariants.push(...spriteVariants);
        }

        if (includeMetadata) {
          styleStorageItem.sprites = allSpriteVariants;
        }
      } catch (error) {
        const errorMsg = `Sprite download failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    // Update style with additional metadata if needed
    if (includeMetadata) {
      await db.put('styles', styleStorageItem);
    }

    const downloadTime = Date.now() - startTime;

    onProgress?.({
      completed: 100,
      total: 100,
      percentage: 100,
      message: 'Style download complete',
      errors: [...errors],
    });

    logger.info(`Style ${style.id} download completed in ${(downloadTime / 1000).toFixed(1)}s`);

    return {
      styleId: style.id,
      success: true,
      downloadTime,
      styleSize,
      sourcesProcessed,
      sourcesEmbedded,
      fontResult,
      spriteResult,
      errors,
      analytics: {
        sourceTypes,
        layerTypes,
        totalLayers: style.layers ? style.layers.length : 0,
        hasGlyphs: !!style.glyphs,
        hasSprites: !!style.sprite,
      },
    };
  } catch (error) {
    const errorMsg = `Failed to download style from ${stylesUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error('Error downloading styles:', error);
    errors.push(errorMsg);

    return {
      styleId: 'unknown',
      success: false,
      downloadTime: Date.now() - startTime,
      styleSize: 0,
      sourcesProcessed,
      sourcesEmbedded,
      errors,
      analytics: {
        sourceTypes,
        layerTypes,
        totalLayers: 0,
        hasGlyphs: false,
        hasSprites: false,
      },
    };
  }
}

// Utility function to validate style data
function isValidStyleData(style: unknown): boolean {
  if (!style || typeof style !== 'object') return false;
  const s = style as Record<string, unknown>;

  // Check required properties
  if (!s.version || !s.sources || !s.layers) return false;

  // Validate version
  if (typeof s.version !== 'number' || s.version < 8) return false;

  // Validate sources
  if (typeof s.sources !== 'object' || Object.keys(s.sources as object).length === 0) return false;

  // Validate layers
  if (!Array.isArray(s.layers) || s.layers.length === 0) return false;

  // Basic layer validation
  for (const layer of s.layers as Array<{ id?: string; type?: string }>) {
    if (!layer.id || !layer.type) return false;
  }

  return true;
}

export async function loadStyles(): Promise<StyleStorageItem[]> {
  try {
    const db = await dbPromise;
    return await db.getAll('styles');
  } catch (error) {
    logger.error('Error loading styles:', error);
    return [];
  }
}

export async function loadStyleById(styleId: string): Promise<StyleStorageItem | null> {
  try {
    const db = await dbPromise;
    const style = await db.get('styles', styleId);
    return style || null;
  } catch (error) {
    logger.error(`Error loading style with ID ${styleId}:`, error);
    return null;
  }
}

export async function deleteStyles(): Promise<void> {
  try {
    const db = await dbPromise;
    await db.clear('styles');
    logger.debug('All styles deleted successfully');
  } catch (error) {
    logger.error('Error deleting styles:', error);
  }
}

export async function deleteStyleById(styleId: string): Promise<void> {
  try {
    const db = await dbPromise;
    await db.delete('styles', styleId);
    logger.debug(`Style with ID ${styleId} deleted successfully`);
  } catch (error) {
    logger.error(`Error deleting style with ID ${styleId}:`, error);
  }
}

/**
 * Get enhanced style statistics
 */
export async function getStyleStats(): Promise<EnhancedStyleStats> {
  try {
    const allStyles = await loadStyles();
    let totalSize = 0;
    const sourceTypes: Record<string, number> = {};
    const layerTypes: Record<string, number> = {};
    let oldestStyle: { id: string; lastModified: number } | undefined;
    let newestStyle: { id: string; lastModified: number } | undefined;
    let largestStyle: { id: string; size: number } | undefined;
    let smallestStyle: { id: string; size: number } | undefined;

    const styles = allStyles.map(styleEntry => {
      // Extract style data from StyleEntry
      const style = getStyleData(styleEntry);

      // Handle both old and new style storage formats - check if enhanced metadata exists
      const hasEnhancedMetadata = 'lastModified' in styleEntry || 'size' in styleEntry;
      const enhancedEntry = styleEntry as Record<string, unknown> & {
        size?: number;
        lastModified?: number;
        sourceCount?: number;
        layerCount?: number;
      };
      const size =
        hasEnhancedMetadata && enhancedEntry.size
          ? enhancedEntry.size
          : JSON.stringify(styleEntry).length;
      const lastModified = hasEnhancedMetadata ? enhancedEntry.lastModified : undefined;
      const sourceCount =
        hasEnhancedMetadata && enhancedEntry.sourceCount
          ? enhancedEntry.sourceCount
          : style.sources
            ? Object.keys(style.sources).length
            : 0;
      const layerCount =
        hasEnhancedMetadata && enhancedEntry.layerCount
          ? enhancedEntry.layerCount
          : style.layers
            ? style.layers.length
            : 0;

      totalSize += size;

      // Track source types
      if (style.sources) {
        Object.values(style.sources).forEach((source: unknown) => {
          const sourceObj = source as Record<string, unknown>;
          if (sourceObj.type && typeof sourceObj.type === 'string') {
            sourceTypes[sourceObj.type] = (sourceTypes[sourceObj.type] || 0) + 1;
          }
        });
      }

      // Track layer types
      if (style.layers && Array.isArray(style.layers)) {
        style.layers.forEach((layer: unknown) => {
          const layerObj = layer as Record<string, unknown>;
          if (layerObj.type && typeof layerObj.type === 'string') {
            layerTypes[layerObj.type] = (layerTypes[layerObj.type] || 0) + 1;
          }
        });
      }

      // Track oldest and newest styles
      if (lastModified && style.id) {
        if (!oldestStyle || lastModified < oldestStyle.lastModified) {
          oldestStyle = { id: style.id, lastModified };
        }
        if (!newestStyle || lastModified > newestStyle.lastModified) {
          newestStyle = { id: style.id, lastModified };
        }
      }

      // Track largest and smallest styles
      if (style.id && (!largestStyle || size > largestStyle.size)) {
        largestStyle = { id: style.id, size };
      }
      if (style.id && (!smallestStyle || size < smallestStyle.size)) {
        smallestStyle = { id: style.id, size };
      }

      return {
        id: style.id || 'unknown',
        name: style.name,
        size,
        lastModified,
        sourceCount,
        layerCount,
        hasGlyphs: !!style.glyphs,
        hasSprites: !!style.sprite,
        metadata: hasEnhancedMetadata
          ? {
              downloadedAt: enhancedEntry.downloadedAt as number | undefined,
              originalUrl: enhancedEntry.originalUrl as string | undefined,
              validated: enhancedEntry.validated as boolean | undefined,
            }
          : undefined,
      };
    });

    // Generate storage recommendations
    const storageRecommendations: string[] = [];

    if (allStyles.length > 10) {
      storageRecommendations.push(`Many styles stored (${allStyles.length}), consider cleanup`);
    }

    if (totalSize > 20 * 1024 * 1024) {
      // 20MB
      storageRecommendations.push(
        `Style storage is large (${(totalSize / 1024 / 1024).toFixed(1)}MB)`
      );
    }

    const layerCounts = Object.values(layerTypes);
    const totalLayers = layerCounts.reduce((sum, count) => sum + count, 0);
    if (totalLayers > 1000) {
      storageRecommendations.push(`High layer count across all styles (${totalLayers})`);
    }

    return {
      count: allStyles.length,
      totalSize,
      averageSize: allStyles.length > 0 ? totalSize / allStyles.length : 0,
      styles,
      sourceTypes,
      layerTypes,
      oldestStyle,
      newestStyle,
      largestStyle,
      smallestStyle,
      storageRecommendations,
    };
  } catch (error) {
    logger.error('Error getting enhanced style stats:', error);
    return {
      count: 0,
      totalSize: 0,
      averageSize: 0,
      styles: [],
      sourceTypes: {},
      layerTypes: {},
      storageRecommendations: ['Error retrieving style statistics'],
    };
  }
}

/**
 * Clean up old styles based on criteria
 */
export async function cleanupOldStyles(
  options: {
    maxAge?: number; // milliseconds
    maxCount?: number;
    maxSize?: number; // bytes
    keepIds?: string[]; // style IDs to preserve
    onProgress?: (progress: { completed: number; total: number; message: string }) => void;
  } = {}
): Promise<{
  deletedCount: number;
  freedSpace: number;
  errors: string[];
}> {
  const { maxAge, maxCount, maxSize, keepIds = [], onProgress } = options;

  try {
    const stats = await getStyleStats();
    let stylesToDelete: Array<{ id: string; size: number; lastModified?: number }> = [];

    // Determine which styles to delete
    if (maxAge) {
      const cutoffTime = Date.now() - maxAge;
      stylesToDelete = stats.styles.filter(
        style =>
          !keepIds.includes(style.id) && style.lastModified && style.lastModified < cutoffTime
      );
    } else if (maxCount && stats.count > maxCount) {
      // Delete oldest styles first, excluding protected ones
      const deletableStyles = stats.styles.filter(style => !keepIds.includes(style.id));
      const sortedStyles = deletableStyles
        .filter(style => style.lastModified)
        .sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
      const deleteCount = Math.min(sortedStyles.length, stats.count - maxCount);
      stylesToDelete = sortedStyles.slice(0, deleteCount);
    } else if (maxSize && stats.totalSize > maxSize) {
      // Delete largest styles first until under limit, excluding protected ones
      const deletableStyles = stats.styles.filter(style => !keepIds.includes(style.id));
      const sortedStyles = deletableStyles.sort((a, b) => b.size - a.size);
      let currentSize = stats.totalSize;
      for (const style of sortedStyles) {
        if (currentSize <= maxSize) break;
        stylesToDelete.push(style);
        currentSize -= style.size;
      }
    }

    if (stylesToDelete.length === 0) {
      return { deletedCount: 0, freedSpace: 0, errors: [] };
    }

    logger.debug(`Cleaning up ${stylesToDelete.length} old styles`);

    let deletedCount = 0;
    let freedSpace = 0;
    const errors: string[] = [];

    for (let i = 0; i < stylesToDelete.length; i++) {
      const style = stylesToDelete[i];

      try {
        await deleteStyleById(style.id);
        deletedCount++;
        freedSpace += style.size;

        onProgress?.({
          completed: i + 1,
          total: stylesToDelete.length,
          message: `Deleted style: ${style.id}`,
        });
      } catch (error) {
        const errorMsg = `Failed to delete style ${style.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }
    }

    logger.info(
      `Style cleanup completed: ${deletedCount} styles deleted, ${(freedSpace / 1024).toFixed(1)}KB freed`
    );
    return { deletedCount, freedSpace, errors };
  } catch (error) {
    logger.error('Error during style cleanup:', error);
    return {
      deletedCount: 0,
      freedSpace: 0,
      errors: [`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

export async function isStyleDownloaded(styleId?: string, styleUrl?: string): Promise<boolean> {
  try {
    const db = await dbPromise;
    if (styleId) {
      const style = await db.get('styles', styleId);
      if (style) return true;
    }
    if (styleUrl) {
      const allStyles = await db.getAll('styles');
      return allStyles.some(
        (s: Record<string, unknown> & { key?: string; originalUrl?: string }) =>
          s?.key === styleUrl || s?.originalUrl === styleUrl
      );
    }
    return false;
  } catch (error) {
    logger.error('Error checking if style is downloaded:', error);
    return false;
  }
}

/**
 * Enhanced style download that supports both Mapbox GL and MapLibre GL
 */
export async function downloadStyleWithProvider(
  styleUrl: string,
  options: StyleDownloadOptions & {
    provider?: StyleProvider;
    accessToken?: string;
    forceProvider?: boolean;
  } = {}
): Promise<StyleDownloadResult> {
  const {
    provider: explicitProvider,
    accessToken: explicitAccessToken,
    forceProvider = false,
    skipExisting = false,
    enableSourceEmbedding = true,
    maxRetries = 3,
    timeoutMs = 30000,
  } = options;

  const startTime = Date.now();
  let sourcesEmbedded = 0;
  logger.debug(`Downloading style from: ${styleUrl}`);

  try {
    // Auto-detect provider if not explicitly set
    const detectedProvider = explicitProvider || detectStyleProvider(styleUrl);
    const extractedToken = explicitAccessToken || extractAccessToken(styleUrl) || undefined;

    logger.debug(`Detected provider: ${detectedProvider}`);

    // Resolve mapbox:// URLs or normalize standard URLs
    let fetchUrl: string;
    if (isMapboxProtocol(styleUrl)) {
      if (!extractedToken) {
        throw new Error(
          'Mapbox access token is required for mapbox:// style URLs. ' +
            'Provide it via options.accessToken.'
        );
      }
      fetchUrl = resolveMapboxUrl(styleUrl, extractedToken);
      logger.debug(`Resolved mapbox:// style URL to: ${fetchUrl}`);
    } else {
      fetchUrl = normalizeStyleUrl(styleUrl, extractedToken);
    }

    // Fetch the style
    const response = await fetchWithRetry(fetchUrl, {
      timeout: timeoutMs,
      retries: maxRetries,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch style: ${response.status} ${response.statusText}`);
    }

    const style = (await response.json()) as BaseStyle;

    // Process style for the detected provider
    const processedStyle = processStyleSources(style, detectedProvider, extractedToken);

    // Embed TileJSON data into sources for reliable offline tile downloads
    // This fetches each source's TileJSON URL and merges the result (including tiles array,
    // minzoom, maxzoom) into the source config, so tile downloads don't need extra fetches
    if (enableSourceEmbedding && processedStyle.sources) {
      for (const [sourceKey, sourceConfig] of Object.entries(processedStyle.sources)) {
        const source = sourceConfig as Record<string, unknown>;
        if (source.url && typeof source.url === 'string' && !source.tiles) {
          const sourceUrl = source.url as string;
          // Skip idb:// URLs
          if (sourceUrl.startsWith('idb://')) continue;

          try {
            const sourceResponse = await fetchWithRetry(sourceUrl, {
              retries: maxRetries,
              timeout: timeoutMs,
              retryDelay: 1000,
            });
            const sourceData = await sourceResponse.json();
            // Only copy valid MapLibre/Mapbox source properties from TileJSON
            // Copying unknown properties (like "name", "tilejson") causes
            // MapLibre to throw "unknown property" errors on setStyle()
            const validFields = [
              'tiles',
              'minzoom',
              'maxzoom',
              'bounds',
              'center',
              'attribution',
              'scheme',
              'encoding',
              'vector_layers',
              'format',
              'grids',
              'data',
              'template',
            ] as const;
            for (const field of validFields) {
              if (field in sourceData && sourceData[field] !== undefined) {
                (source as Record<string, unknown>)[field] = sourceData[field];
              }
            }
            processedStyle.sources[sourceKey] = source;
            sourcesEmbedded++;
            logger.debug(`Embedded TileJSON for source ${sourceKey}`);
          } catch (error) {
            logger.warn(
              `Failed to embed TileJSON for source ${sourceKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }
    }

    // Set default glyphs URL if not present
    if (!processedStyle.glyphs) {
      processedStyle.glyphs = GLYPH_CONFIG.DEFAULT_URL;
      logger.debug(`Using default glyphs URL: ${GLYPH_CONFIG.DEFAULT_URL}`);
    }

    // Validate style
    const validation = validateStyleForProvider(processedStyle, detectedProvider);
    if (!validation.isValid && !forceProvider) {
      throw new Error(`Style validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate style ID
    const styleId =
      processedStyle.name?.toLowerCase().replace(/\s+/g, '-') || `style-${Date.now()}`;

    // Check if style already exists
    const db = await dbPromise;
    if (skipExisting) {
      const existingStyle = await db.get('styles', styleId);
      if (existingStyle) {
        logger.debug(`Style ${styleId} already exists, skipping`);
        return {
          styleId,
          success: true,
          downloadTime: Date.now() - startTime,
          styleSize: 0,
          sourcesProcessed: 0,
          sourcesEmbedded: 0,
          errors: [],
          analytics: {
            sourceTypes: {},
            layerTypes: {},
            totalLayers: 0,
            hasGlyphs: false,
            hasSprites: false,
          },
        };
      }
    }

    // Create style entry
    // Save original sprite/glyph URLs before they might get patched later
    const styleEntry = createStyleEntry(styleId, processedStyle, detectedProvider, {
      lastModified: Date.now(),
      downloadedAt: Date.now(),
      originalUrl: styleUrl,
      originalSpriteUrl: style.sprite,
      originalGlyphsUrl: style.glyphs,
      validated: validation.isValid,
      accessToken: extractedToken,
    });

    // Save style
    await db.put('styles', styleEntry);

    const downloadTime = Date.now() - startTime;
    logger.info(`Style ${styleId} downloaded in ${downloadTime}ms`);

    return {
      styleId,
      success: true,
      downloadTime,
      styleSize: JSON.stringify(processedStyle).length,
      sourcesProcessed: Object.keys(processedStyle.sources || {}).length,
      sourcesEmbedded,
      errors: [],
      analytics: {
        sourceTypes: {},
        layerTypes: {},
        totalLayers: processedStyle.layers?.length || 0,
        hasGlyphs: !!processedStyle.glyphs,
        hasSprites: !!processedStyle.sprite,
      },
    };
  } catch (error) {
    logger.error(`Failed to download style from ${styleUrl}:`, error);
    return {
      styleId: '',
      success: false,
      downloadTime: Date.now() - startTime,
      styleSize: 0,
      sourcesProcessed: 0,
      sourcesEmbedded: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      analytics: {
        sourceTypes: {},
        layerTypes: {},
        totalLayers: 0,
        hasGlyphs: false,
        hasSprites: false,
      },
    };
  }
}
