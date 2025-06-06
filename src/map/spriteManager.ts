import { dbPromise } from '../storage/indexedDbManager';
import { 
  fetchWithRetry,
  processBatch, 
  createProgressTracker,
  DownloadProgress 
} from '../utils';

export interface SpriteDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  batchSize?: number;
  maxRetries?: number;
  skipExisting?: boolean;
  bandwidthLimit?: number; // bytes per second
  prioritySprites?: string[]; // sprites to download first
  storageQuotaCheck?: boolean;
  enableValidation?: boolean;
  timeoutMs?: number;
  includeMetadata?: boolean;
}

export interface SpriteDownloadResult {
  totalSprites: number;
  downloadedSprites: number;
  skippedSprites: number;
  failedSprites: number;
  totalSize: number;
  downloadSpeed: number; // bytes per second
  duration: number; // milliseconds
  errors: Array<{ url: string; error: string }>;
  analytics: {
    spritesByType: Record<string, number>;
    averageSpriteSize: number;
    largestSprite: { name: string; size: number };
    smallestSprite: { name: string; size: number };
  };
}

export interface EnhancedSpriteStats {
  count: number;
  totalSize: number;
  averageSize: number;  sprites: Array<{
    name: string; 
    size: number; 
    type: string; 
    lastModified?: number;
    metadata?: Record<string, unknown>;
  }>;
  spritesByType: Record<string, number>;
  sizeByType: Record<string, number>;
  oldestSprite?: { name: string; lastModified: number };
  newestSprite?: { name: string; lastModified: number };
  largestSprite?: { name: string; size: number };
  smallestSprite?: { name: string; size: number };
  storageRecommendations: string[];
}

export interface SpriteStorageItem {
  key: string;
  data: ArrayBuffer;
  contentType?: string;
  // Enhanced metadata
  lastModified?: number;
  downloadedAt?: number;
  originalUrl?: string;
  validated?: boolean;
  size?: number;
  spriteType?: string;
}

// Utility functions
function detectSpriteType(fileName: string): string {
  if (fileName.endsWith('.json')) return 'json';
  if (fileName.endsWith('.png')) return 'png';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'jpeg';
  if (fileName.endsWith('.svg')) return 'svg';
  if (fileName.endsWith('.webp')) return 'webp';
  return 'unknown';
}

function isValidSpriteData(data: ArrayBuffer, contentType?: string, fileName?: string): boolean {
  if (data.byteLength === 0) return false;
  
  const uint8Array = new Uint8Array(data);
  
  // Check for PNG signature
  if (contentType?.includes('image/png') || fileName?.endsWith('.png')) {
    return uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
  }
  
  // Check for JPEG signature
  if (contentType?.includes('image/jpeg') || fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg')) {
    return uint8Array[0] === 0xFF && uint8Array[1] === 0xD8;
  }
  
  // Check for JSON (basic validation)
  if (contentType?.includes('application/json') || fileName?.endsWith('.json')) {
    try {
      const text = new TextDecoder().decode(data);
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  
  // Check for SVG
  if (contentType?.includes('image/svg') || fileName?.endsWith('.svg')) {
    const text = new TextDecoder().decode(data);
    return text.includes('<svg') && text.includes('</svg>');
  }
  
  // For other types, just check if data exists
  return data.byteLength > 0;
}

function sortSpritesByPriority(urls: string[], prioritySprites: string[]): string[] {
  if (prioritySprites.length === 0) return urls;
  
  const priorityUrls: string[] = [];
  const regularUrls: string[] = [];
  
  for (const url of urls) {
    const fileName = url.split('/').pop() || '';
    const isPriority = prioritySprites.some(priority => 
      fileName.includes(priority) || url.includes(priority)
    );
    
    if (isPriority) {
      priorityUrls.push(url);
    } else {
      regularUrls.push(url);
    }
  }
  
  return [...priorityUrls, ...regularUrls];
}

function calculateSpriteDownloadSpeed(totalBytes: number, startTime: number): number {
  const elapsedTime = Date.now() - startTime;
  return elapsedTime > 0 ? (totalBytes / elapsedTime) * 1000 : 0; // bytes per second
}

async function throttleBandwidth(bytesPerSecond: number): Promise<void> {
  // Simple bandwidth throttling - wait based on current speed
  // This is a basic implementation; more sophisticated throttling could be added
  const delay = Math.max(0, 1000 / (bytesPerSecond / 1024)); // Convert to reasonable delay
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
  }
}

export async function downloadSprites(
  styleId: string, 
  urls: string[],
  options: SpriteDownloadOptions = {}
): Promise<SpriteDownloadResult> {
  const db = await dbPromise;
  const { 
    onProgress, 
    batchSize = 5, 
    maxRetries = 3, 
    skipExisting = true,
    bandwidthLimit,
    prioritySprites = [],
    storageQuotaCheck = false,
    enableValidation = true,
    timeoutMs = 30000,
    includeMetadata = true
  } = options;
  
  const startTime = Date.now();
  let totalSize = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: Array<{ url: string; error: string }> = [];
  const spritesByType: Record<string, number> = {};
  let largestSprite = { name: '', size: 0 };
  let smallestSprite = { name: '', size: Infinity };

  if (urls.length === 0) {
    console.warn('No sprites to download');
    return {
      totalSprites: 0,
      downloadedSprites: 0,
      skippedSprites: 0,
      failedSprites: 0,
      totalSize: 0,
      downloadSpeed: 0,
      duration: 0,
      errors: [],
      analytics: {
        spritesByType: {},
        averageSpriteSize: 0,
        largestSprite: { name: '', size: 0 },
        smallestSprite: { name: '', size: 0 }
      }
    };
  }

  // Check storage quota if requested
  if (storageQuotaCheck && 'navigator' in globalThis && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const availableSpace = (estimate.quota || 0) - (estimate.usage || 0);
      const estimatedSize = urls.length * 50 * 1024; // Rough estimate: 50KB per sprite
      
      if (availableSpace < estimatedSize) {
        console.warn(`Insufficient storage space. Available: ${(availableSpace / 1024 / 1024).toFixed(1)}MB, Estimated need: ${(estimatedSize / 1024 / 1024).toFixed(1)}MB`);
      }
    } catch (error) {
      console.warn('Could not check storage quota:', error);
    }
  }

  // Sort URLs by priority
  const sortedUrls = sortSpritesByPriority(urls, prioritySprites);

  console.warn(`Starting download of ${urls.length} sprites for style ${styleId}`);
  const progressTracker = createProgressTracker(urls.length);

  await processBatch(
    sortedUrls,
    async (url: string) => {
      try {
        const fileName = url.split('/').pop() || url;
        const key = `${styleId}::${fileName}`;
        const spriteType = detectSpriteType(fileName);
        
        // Check if sprite already exists
        if (skipExisting) {
          const existingSprite = await db.get('sprites', key);
          if (existingSprite) {
            console.warn(`Sprite already exists: ${key}, skipping download`);
            skippedCount++;
            spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;
            return { url, key, skipped: true };
          }
        }

        // Apply bandwidth throttling if specified
        if (bandwidthLimit) {
          await throttleBandwidth(bandwidthLimit);
        }

        // Download sprite with retry logic
        const response = await fetchWithRetry(url, { 
          retries: maxRetries, 
          timeout: timeoutMs,
          retryDelay: 1000 
        });
        
        const contentType = response.headers.get('content-type') || undefined;
        const data = await response.arrayBuffer();
        const size = data.byteLength;

        // Validate sprite data if enabled
        if (enableValidation && !isValidSpriteData(data, contentType, fileName)) {
          throw new Error(`Invalid sprite data received for ${url}`);
        }

        // Create sprite storage item with metadata
        const spriteItem: SpriteStorageItem = {
          key,
          data,
          contentType,
          ...(includeMetadata && {
            lastModified: Date.now(),
            downloadedAt: Date.now(),
            originalUrl: url,
            validated: enableValidation,
            size,
            spriteType
          })
        };

        await db.put('sprites', spriteItem);
        
        // Update statistics
        totalSize += size;
        downloadedCount++;
        spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;
        
        if (size > largestSprite.size) {
          largestSprite = { name: fileName, size };
        }
        if (size < smallestSprite.size) {
          smallestSprite = { name: fileName, size };
        }

        console.warn(`Downloaded sprite: ${key} (${(size / 1024).toFixed(1)}KB, ${spriteType})`);
        
        return { url, key, size, downloaded: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Failed to download sprite: ${url} - ${errorMsg}`);
        failedCount++;
        errors.push({ url, error: errorMsg });
        throw error;
      }
    },
    {
      batchSize,
      onProgress: (completed, total) => {
        const speed = calculateSpriteDownloadSpeed(totalSize, startTime);
        progressTracker.update(completed, `Downloading sprites (${completed}/${total}) - ${(speed / 1024).toFixed(1)} KB/s`);
        onProgress?.(progressTracker.getProgress());
      },
      onError: (error, url) => {
        const fileName = url.split('/').pop() || url;
        const errorMsg = `Failed to download sprite ${fileName}: ${error.message}`;
        progressTracker.update(undefined, undefined, errorMsg);
      }
    }
  );

  const duration = Date.now() - startTime;
  const downloadSpeed = duration > 0 ? (totalSize / duration) * 1000 : 0;

  const result: SpriteDownloadResult = {
    totalSprites: urls.length,
    downloadedSprites: downloadedCount,
    skippedSprites: skippedCount,
    failedSprites: failedCount,
    totalSize,
    downloadSpeed,
    duration,
    errors,
    analytics: {
      spritesByType,
      averageSpriteSize: downloadedCount > 0 ? totalSize / downloadedCount : 0,
      largestSprite: largestSprite.size > 0 ? largestSprite : { name: '', size: 0 },
      smallestSprite: smallestSprite.size < Infinity ? smallestSprite : { name: '', size: 0 }
    }
  };

  const finalProgress = progressTracker.getProgress();
  console.warn(`Sprite download completed: ${finalProgress.completed}/${finalProgress.total} (${finalProgress.percentage}%) in ${(duration / 1000).toFixed(1)}s`);
  console.warn(`Download speed: ${(downloadSpeed / 1024).toFixed(1)} KB/s, Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  
  if (finalProgress.errors.length > 0) {
    console.warn(`Sprite download completed with ${finalProgress.errors.length} errors`);
  }

  return result;
}

export async function loadSprites(styleId?: string): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('sprites');
    let keysToLoad = allKeys;
    
    if (styleId) {
      keysToLoad = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    }
    
    console.warn(`Loading ${keysToLoad.length} sprites${styleId ? ` for style ${styleId}` : ''}`);
    let loaded = 0;
    
    for (const key of keysToLoad) {
      try {
        const sprite = await db.get('sprites', key);
        if (sprite) {
          loaded++;
          console.warn(`Loaded sprite: ${key}`);
        }
      } catch (error) {
        console.warn(`Failed to load sprite ${key}:`, error);
      }
    }
    
    console.warn(`Successfully loaded ${loaded}/${keysToLoad.length} sprites`);
  } catch (error) {
    console.error('Error loading sprites:', error);
    throw new Error(`Failed to load sprites: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteSprites(styleId?: string): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('sprites');
    let keysToDelete = allKeys;
    
    if (styleId) {
      keysToDelete = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    }
    
    console.warn(`Deleting ${keysToDelete.length} sprites${styleId ? ` for style ${styleId}` : ''}`);
    let deleted = 0;
    
    for (const key of keysToDelete) {
      try {
        await db.delete('sprites', key);
        deleted++;
        console.warn(`Deleted sprite: ${key}`);
      } catch (error) {
        console.warn(`Failed to delete sprite ${key}:`, error);
      }
    }
    
    console.warn(`Successfully deleted ${deleted}/${keysToDelete.length} sprites`);
  } catch (error) {
    console.error('Error deleting sprites:', error);
    throw new Error(`Failed to delete sprites: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get enhanced sprite statistics for a style
 */
export async function getSpriteStats(styleId: string): Promise<EnhancedSpriteStats> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('sprites');
    const styleKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    
    let totalSize = 0;
    const sprites: Array<{ 
      name: string; 
      size: number; 
      type: string; 
      lastModified?: number;
      metadata?: Record<string, unknown>;
    }> = [];
    const spritesByType: Record<string, number> = {};
    const sizeByType: Record<string, number> = {};
    let oldestSprite: { name: string; lastModified: number } | undefined;
    let newestSprite: { name: string; lastModified: number } | undefined;
    let largestSprite: { name: string; size: number } | undefined;
    let smallestSprite: { name: string; size: number } | undefined;
    
    for (const key of styleKeys) {
      const sprite = await db.get('sprites', key);
      if (sprite && sprite.data) {
        // Handle both old and new sprite storage formats
        const size = isEnhancedSpriteFormat(sprite) && sprite.size ? sprite.size : sprite.data.byteLength;
        const lastModified = isEnhancedSpriteFormat(sprite) ? sprite.lastModified : undefined;
        const spriteType = isEnhancedSpriteFormat(sprite) && sprite.spriteType ? 
          sprite.spriteType : 
          detectSpriteType(key.toString());
        
        totalSize += size;
        
        const name = key.toString().replace(`${styleId}::`, '');
        
        sprites.push({ 
          name, 
          size, 
          type: spriteType,
          lastModified,
          metadata: isEnhancedSpriteFormat(sprite) ? {
            downloadedAt: sprite.downloadedAt,
            originalUrl: sprite.originalUrl,
            validated: sprite.validated
          } : undefined
        });
        
        // Update type statistics
        spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;
        sizeByType[spriteType] = (sizeByType[spriteType] || 0) + size;
        
        // Track oldest and newest sprites
        if (lastModified) {
          if (!oldestSprite || lastModified < oldestSprite.lastModified) {
            oldestSprite = { name, lastModified };
          }
          if (!newestSprite || lastModified > newestSprite.lastModified) {
            newestSprite = { name, lastModified };
          }
        }
        
        // Track largest and smallest sprites
        if (!largestSprite || size > largestSprite.size) {
          largestSprite = { name, size };
        }
        if (!smallestSprite || size < smallestSprite.size) {
          smallestSprite = { name, size };
        }
      }
    }
    
    // Generate storage recommendations
    const storageRecommendations: string[] = [];
    
    if (sprites.length > 100) {
      storageRecommendations.push(`Consider cleaning up old sprites (${sprites.length} total)`);
    }
    
    if (totalSize > 50 * 1024 * 1024) { // 50MB
      storageRecommendations.push(`Sprite storage is large (${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
    }
    
    const typesWithLargeFiles = Object.entries(sizeByType)
      .filter(([, size]) => size > 10 * 1024 * 1024) // 10MB per type
      .map(([type]) => type);
    
    if (typesWithLargeFiles.length > 0) {
      storageRecommendations.push(`Large sprite types detected: ${typesWithLargeFiles.join(', ')}`);
    }
    
    return {
      count: styleKeys.length,
      totalSize,
      averageSize: styleKeys.length > 0 ? totalSize / styleKeys.length : 0,
      sprites,
      spritesByType,
      sizeByType,
      oldestSprite,
      newestSprite,
      largestSprite,
      smallestSprite,
      storageRecommendations
    };
  } catch (error) {
    console.error(`Error getting enhanced sprite stats for ${styleId}:`, error);
    return { 
      count: 0, 
      totalSize: 0, 
      averageSize: 0, 
      sprites: [],
      spritesByType: {},
      sizeByType: {},
      storageRecommendations: ['Error retrieving sprite statistics']
    };
  }
}

// Type guard for enhanced sprite format
function isEnhancedSpriteFormat(sprite: unknown): sprite is SpriteStorageItem {
  return sprite !== null && typeof sprite === 'object' && 'key' in sprite && 'data' in sprite;
}

/**
 * Clean up old sprites based on age or storage quota
 */
export async function cleanupOldSprites(
  styleId: string,
  options: {
    maxAge?: number; // milliseconds
    maxCount?: number;
    maxSize?: number; // bytes
    onProgress?: (progress: { completed: number; total: number; message: string }) => void;
  } = {}
): Promise<{
  deletedCount: number;
  freedSpace: number;
  errors: string[];
}> {
  const db = await dbPromise;
  const { maxAge, maxCount, maxSize, onProgress } = options;
  
  try {
    const stats = await getSpriteStats(styleId);
    let spritesToDelete: Array<{ name: string; size: number; lastModified?: number }> = [];
    
    // Determine which sprites to delete
    if (maxAge && stats.oldestSprite) {
      const cutoffTime = Date.now() - maxAge;
      spritesToDelete = stats.sprites.filter(sprite => 
        sprite.lastModified && sprite.lastModified < cutoffTime
      );
    } else if (maxCount && stats.count > maxCount) {
      // Delete oldest sprites first
      const sortedSprites = stats.sprites
        .filter(sprite => sprite.lastModified)
        .sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
      spritesToDelete = sortedSprites.slice(0, stats.count - maxCount);
    } else if (maxSize && stats.totalSize > maxSize) {
      // Delete largest sprites first until under limit
      const sortedSprites = stats.sprites
        .sort((a, b) => b.size - a.size);
      let currentSize = stats.totalSize;
      for (const sprite of sortedSprites) {
        if (currentSize <= maxSize) break;
        spritesToDelete.push(sprite);
        currentSize -= sprite.size;
      }
    }
    
    if (spritesToDelete.length === 0) {
      return { deletedCount: 0, freedSpace: 0, errors: [] };
    }
    
    console.warn(`Cleaning up ${spritesToDelete.length} old sprites for style ${styleId}`);
    
    let deletedCount = 0;
    let freedSpace = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < spritesToDelete.length; i++) {
      const sprite = spritesToDelete[i];
      const key = `${styleId}::${sprite.name}`;
      
      try {
        await db.delete('sprites', key);
        deletedCount++;
        freedSpace += sprite.size;
        
        onProgress?.({
          completed: i + 1,
          total: spritesToDelete.length,
          message: `Deleted sprite: ${sprite.name}`
        });
      } catch (error) {
        const errorMsg = `Failed to delete sprite ${sprite.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }
    
    console.warn(`Sprite cleanup completed: ${deletedCount} sprites deleted, ${(freedSpace / 1024).toFixed(1)}KB freed`);
    return { deletedCount, freedSpace, errors };
    
  } catch (error) {
    console.error(`Error during sprite cleanup for ${styleId}:`, error);
    return { 
      deletedCount: 0, 
      freedSpace: 0, 
      errors: [`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    };
  }
}

/**
 * Verify and repair sprite integrity
 */
export async function verifyAndRepairSprites(
  styleId: string,
  options: {
    onProgress?: (progress: { completed: number; total: number; message: string }) => void;
    autoRepair?: boolean;
  } = {}
): Promise<{
  totalSprites: number;
  validSprites: number;
  corruptedSprites: number;
  repairedSprites: number;
  errors: Array<{ name: string; error: string }>;
}> {
  const db = await dbPromise;
  const { onProgress, autoRepair = false } = options;
  
  try {
    const stats = await getSpriteStats(styleId);
    let validCount = 0;
    let corruptedCount = 0;
    const repairedCount = 0;
    const errors: Array<{ name: string; error: string }> = [];
    
    console.warn(`Verifying ${stats.count} sprites for style ${styleId}`);
    
    for (let i = 0; i < stats.sprites.length; i++) {
      const sprite = stats.sprites[i];
      const key = `${styleId}::${sprite.name}`;
      
      try {
        const spriteData = await db.get('sprites', key);
        if (!spriteData || !spriteData.data) {
          throw new Error('Missing sprite data');
        }
        
        // Validate sprite data
        const isValid = isValidSpriteData(
          spriteData.data, 
          spriteData.contentType, 
          sprite.name
        );
        
        if (isValid) {
          validCount++;
        } else {
          corruptedCount++;
          const errorMsg = 'Invalid sprite data detected';
          errors.push({ name: sprite.name, error: errorMsg });
          
          if (autoRepair) {
            // For auto-repair, we would need the original URL to re-download
            // This is a placeholder for repair logic
            console.warn(`Would repair corrupted sprite: ${sprite.name}`);
            // repairedCount++; // Increment when actual repair is implemented
          }
        }
        
        onProgress?.({
          completed: i + 1,
          total: stats.sprites.length,
          message: `Verified sprite: ${sprite.name} (${isValid ? 'valid' : 'corrupted'})`
        });
        
      } catch (error) {
        corruptedCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ name: sprite.name, error: errorMsg });
        
        onProgress?.({
          completed: i + 1,
          total: stats.sprites.length,
          message: `Error verifying sprite: ${sprite.name}`
        });
      }
    }
    
    console.warn(`Sprite verification completed: ${validCount} valid, ${corruptedCount} corrupted`);
    
    return {
      totalSprites: stats.count,
      validSprites: validCount,
      corruptedSprites: corruptedCount,
      repairedSprites: repairedCount,
      errors
    };
    
  } catch (error) {
    console.error(`Error during sprite verification for ${styleId}:`, error);
    return {
      totalSprites: 0,
      validSprites: 0,
      corruptedSprites: 0,
      repairedSprites: 0,
      errors: [{ name: 'verification', error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
}

/**
 * Get comprehensive sprite analytics across all styles
 */
export async function getSpriteAnalytics(): Promise<{
  totalSprites: number;
  totalSize: number;
  styleCount: number;
  spritesByType: Record<string, number>;
  sizeByType: Record<string, number>;
  topStyles: Array<{ styleId: string; spriteCount: number; size: number }>;
  recommendations: string[];
}> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('sprites');
    const styleIds = new Set<string>();
    const spritesByType: Record<string, number> = {};
    const sizeByType: Record<string, number> = {};
    const styleStats: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    
    for (const key of allKeys) {
      if (typeof key === 'string' && key.includes('::')) {
        const [styleId, fileName] = key.split('::', 2);
        styleIds.add(styleId);
        
        const sprite = await db.get('sprites', key);
        if (sprite && sprite.data) {
          const size = isEnhancedSpriteFormat(sprite) && sprite.size ? 
            sprite.size : sprite.data.byteLength;
          const spriteType = isEnhancedSpriteFormat(sprite) && sprite.spriteType ? 
            sprite.spriteType : detectSpriteType(fileName);
          
          totalSize += size;
          spritesByType[spriteType] = (spritesByType[spriteType] || 0) + 1;
          sizeByType[spriteType] = (sizeByType[spriteType] || 0) + size;
          
          if (!styleStats[styleId]) {
            styleStats[styleId] = { count: 0, size: 0 };
          }
          styleStats[styleId].count++;
          styleStats[styleId].size += size;
        }
      }
    }
    
    const topStyles = Object.entries(styleStats)
      .map(([styleId, stats]) => ({ styleId, spriteCount: stats.count, size: stats.size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    const recommendations: string[] = [];
    
    if (totalSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push(`Total sprite storage is very large (${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
    }
    
    if (styleIds.size > 20) {
      recommendations.push(`Many styles with sprites (${styleIds.size}), consider cleanup`);
    }
    
    const totalSprites = allKeys.length;
    if (totalSprites > 1000) {
      recommendations.push(`Large number of sprites (${totalSprites}), consider archiving old ones`);
    }
    
    return {
      totalSprites,
      totalSize,
      styleCount: styleIds.size,
      spritesByType,
      sizeByType,
      topStyles,
      recommendations
    };
    
  } catch (error) {
    console.error('Error getting sprite analytics:', error);
    return {
      totalSprites: 0,
      totalSize: 0,
      styleCount: 0,
      spritesByType: {},
      sizeByType: {},
      topStyles: [],
      recommendations: ['Error retrieving sprite analytics']
    };
  }
}