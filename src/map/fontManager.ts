import { dbPromise } from '../storage/indexedDbManager';
import { 
  fetchResourceWithRetry, 
  processBatch, 
  createProgressTracker,
  DownloadProgress 
} from '../utils';
import { FontEntry } from '../types';

export interface FontDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  batchSize?: number;
  maxRetries?: number;
  corsProxy?: string;
  skipExisting?: boolean;
  retryDelay?: number;
  timeout?: number;
  validateFonts?: boolean;
  maxConcurrency?: number;
  storageQuotaCheck?: boolean;
}

export interface FontDownloadResult {
  totalFonts: number;
  downloadedFonts: number;
  skippedFonts: number;
  failedFonts: number;
  totalSize: number;
  downloadTime: number;
  averageSpeed: number; // bytes per second
  errors: Array<{ url: string; error: string }>;
  fontsByType: Record<string, number>;
}

export interface EnhancedFontStats {
  count: number;
  totalSize: number;
  averageSize: number;
  fonts: string[];
  fontsByType: Record<string, number>;
  oldestFont?: { key: string; timestamp: number };
  newestFont?: { key: string; timestamp: number };
  corruptedFonts: string[];
}

export async function downloadFonts(
  fontUrls: string[],
  downloadId?: string,
  options: FontDownloadOptions = {}
): Promise<FontDownloadResult> {
  const db = await dbPromise;
  const { 
    onProgress, 
    batchSize = 10, 
    maxRetries = 3, 
    corsProxy = 'https://api.allorigins.win/raw?url=',
    skipExisting = true,
    retryDelay = 1000,
    timeout = 30000,
    validateFonts = true,
    maxConcurrency = 15,
    storageQuotaCheck = true
  } = options;

  const startTime = Date.now();
  const result: FontDownloadResult = {
    totalFonts: fontUrls.length,
    downloadedFonts: 0,
    skippedFonts: 0,
    failedFonts: 0,
    totalSize: 0,
    downloadTime: 0,
    averageSpeed: 0,
    errors: [],
    fontsByType: {}
  };

  if (fontUrls.length === 0) {
    console.warn('No fonts to download');
    result.downloadTime = Date.now() - startTime;
    return result;
  }

  console.warn(`Starting enhanced download of ${fontUrls.length} fonts`);

  // Check storage quota if enabled
  if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageRatio = estimate.usage ? estimate.usage / (estimate.quota || Infinity) : 0;
      if (usageRatio > 0.9) {
        console.warn(`Storage usage is at ${(usageRatio * 100).toFixed(1)}%. Consider cleaning up old fonts.`);
      }
    } catch (error) {
      console.warn('Could not check storage quota:', error);
    }
  }

  const progressTracker = createProgressTracker(fontUrls.length);
  let downloadedBytes = 0;

  await processBatch(
    fontUrls,
    async (url: string) => {
      try {
        const fileName = url.split('/').pop() || url;
        const key = downloadId ? `${downloadId}::${fileName}` : fileName;
        
        // Check if font already exists
        if (skipExisting) {
          const existingFont = await db.get('fonts', key);
          if (existingFont) {
            result.skippedFonts++;
            console.warn(`Font already exists: ${key}, skipping download`);
            return { url, key, skipped: true };
          }
        }

        // Font doesn't exist, download it with enhanced options
        const proxiedUrl = url.startsWith('http') ? corsProxy + encodeURIComponent(url) : url;
        const fontData = await fetchResourceWithRetry(proxiedUrl, {
          retries: maxRetries,
          retryDelay,
          timeout
        });

        // Validate font data if enabled
        if (validateFonts && !isValidFontData(fontData.data, fileName)) {
          throw new Error(`Invalid font data received for ${url}`);
        }

        // Store font with enhanced metadata
        const fontEntry = {
          key,
          data: fontData.data,
          downloadedAt: new Date().toISOString(),
          size: fontData.data.byteLength,
          type: detectFontType(fileName),
          url: url,
          originalUrl: url.startsWith('http') && corsProxy ? url.replace(corsProxy, '').replace(/^[^=]*=/, '') : url
        };

        await db.put('fonts', fontEntry as FontEntry);
        
        downloadedBytes += fontData.data.byteLength;
        result.downloadedFonts++;
        result.totalSize += fontData.data.byteLength;
        
        // Track by font type
        result.fontsByType[fontEntry.type] = (result.fontsByType[fontEntry.type] || 0) + 1;
        
        console.warn(`Downloaded font: ${key} (${(fontData.data.byteLength / 1024).toFixed(1)}KB, type: ${fontEntry.type})`);
        
        return { url, key, size: fontData.data.byteLength, downloaded: true };
      } catch (error) {
        result.failedFonts++;
        const errorMsg = `Failed to download font from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push({ url, error: errorMsg });
        console.warn(errorMsg);
        throw error;
      }
    },
    {
      batchSize: Math.min(batchSize, maxConcurrency),
      onProgress: (completed, total) => {
        const currentSpeed = calculateFontDownloadSpeed(downloadedBytes, Date.now() - startTime);
        progressTracker.update(completed, `Downloading fonts (${completed}/${total}) - ${currentSpeed.toFixed(1)} KB/s`);
        onProgress?.(progressTracker.getProgress());
      },
      onError: (error, url) => {
        const fileName = url.split('/').pop() || url;
        const errorMsg = `Failed to download font ${fileName}: ${error.message}`;
        progressTracker.update(undefined, undefined, errorMsg);
      }
    }
  );

  result.downloadTime = Date.now() - startTime;
  result.averageSpeed = calculateFontDownloadSpeed(result.totalSize, result.downloadTime);

  const finalProgress = progressTracker.getProgress();
  console.warn(`Font download summary:`, {
    total: result.totalFonts,
    downloaded: result.downloadedFonts,
    skipped: result.skippedFonts,
    failed: result.failedFonts,
    totalSize: `${(result.totalSize / 1024).toFixed(1)} KB`,
    avgSpeed: `${result.averageSpeed.toFixed(1)} KB/s`,
    duration: `${(result.downloadTime / 1000).toFixed(1)}s`
  });

  if (finalProgress.errors.length > 0) {
    console.warn(`Font download completed with ${finalProgress.errors.length} errors`);
  }

  return result;
}

export async function loadFonts(
  fontUrls: string[],
  downloadId?: string,
): Promise<void> {
  const db = await dbPromise;

  console.warn(`Loading ${fontUrls.length} fonts`);
  let loaded = 0;

  for (const url of fontUrls) {
    try {
      const key = downloadId ? `${downloadId}::${url}` : url;
      const fontData = await db.get('fonts', key);
      if (fontData) {
        loaded++;
        console.warn(`Loaded font from ${key}`);
      }
    } catch (error) {
      console.warn(`Failed to load font ${url}:`, error);
    }
  }
  
  console.warn(`Successfully loaded ${loaded}/${fontUrls.length} fonts`);
}

export async function deleteFonts(fontUrls: string[]): Promise<void> {
  const db = await dbPromise;

  console.warn(`Deleting ${fontUrls.length} fonts`);
  let deleted = 0;

  for (const url of fontUrls) {
    try {
      await db.delete('fonts', url);
      deleted++;
    } catch (error) {
      console.warn(`Failed to delete font ${url}:`, error);
    }
  }
  
  console.warn(`Successfully deleted ${deleted}/${fontUrls.length} fonts`);
}

export async function loadFontsByStyleId(styleId: string): Promise<void> {
  // Example: get all keys and filter by styleId prefix
  // const allKeys = await db.getAllKeys('fonts');
  // const styleKeys = allKeys.filter(k => k.startsWith(styleId + '::'));
  // for (const key of styleKeys) { ... }
  console.warn(`Would load fonts for styleId: ${styleId}`);
}

export async function deleteFontsByStyleId(styleId: string): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    const styleKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(styleId + '::'),
    );
    
    console.warn(`Deleting ${styleKeys.length} fonts for style ${styleId}`);
    let deleted = 0;
    
    for (const key of styleKeys) {
      try {
        await db.delete('fonts', key);
        deleted++;
        console.warn(`Deleted font: ${key}`);
      } catch (error) {
        console.warn(`Failed to delete font ${key}:`, error);
      }
    }
    
    console.warn(`Successfully deleted ${deleted}/${styleKeys.length} fonts`);
  } catch (error) {
    console.error(`Error deleting fonts for style ${styleId}:`, error);
    throw new Error(`Failed to delete fonts for style ${styleId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function loadFontsByDownloadId(downloadId: string): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    const keysToLoad = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(downloadId + '::'),
    );
    
    console.warn(`Loading ${keysToLoad.length} fonts for download ID ${downloadId}`);
    let loaded = 0;
    
    for (const key of keysToLoad) {
      try {
        const fontData = await db.get('fonts', key);
        if (fontData) {
          loaded++;
          console.warn(`Loaded font from ${key}`);
        }
      } catch (error) {
        console.warn(`Failed to load font ${key}:`, error);
      }
    }
    
    console.warn(`Successfully loaded ${loaded}/${keysToLoad.length} fonts`);
  } catch (error) {
    console.error(`Error loading fonts for download ID ${downloadId}:`, error);
    throw new Error(`Failed to load fonts for download ID ${downloadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get enhanced font statistics for a style
 */
export async function getFontStats(styleId: string): Promise<EnhancedFontStats> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    const styleKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    
    let totalSize = 0;
    const fonts: string[] = [];
    let oldestFont: { key: string; timestamp: number } | undefined;
    let newestFont: { key: string; timestamp: number } | undefined;
    const fontsByType: Record<string, number> = {};
    const corruptedFonts: string[] = [];
    
    for (const key of styleKeys) {
      const font = await db.get('fonts', key);
      if (font) {
        let fontSize = 0;
        let fontType = 'unknown';
        let downloadedAt: Date | undefined;
        
        if (isEnhancedFontFormat(font)) {
          fontSize = font.size || font.data.byteLength;
          fontType = font.type || 'unknown';
          downloadedAt = font.downloadedAt ? new Date(font.downloadedAt) : undefined;
        } else if (font instanceof ArrayBuffer) {
          // Legacy format (direct ArrayBuffer)
          fontSize = font.byteLength;
          fontType = detectFontType(key.toString());
        } else if (font && typeof font === 'object' && 'data' in font) {
          // Legacy format with data property
          fontSize = (font as FontEntry).data.byteLength;
          fontType = detectFontType(key.toString());
        }
        
        totalSize += fontSize;
        fonts.push(key.toString().replace(`${styleId}::`, ''));
        
        // Track oldest and newest fonts
        if (downloadedAt) {
          const timestamp = downloadedAt.getTime();
          if (!oldestFont || timestamp < oldestFont.timestamp) {
            oldestFont = { key: key.toString(), timestamp };
          }
          if (!newestFont || timestamp > newestFont.timestamp) {
            newestFont = { key: key.toString(), timestamp };
          }
        }
        
        // Track by font type
        fontsByType[fontType] = (fontsByType[fontType] || 0) + 1;
      }
    }
    
    return {
      count: styleKeys.length,
      totalSize,
      averageSize: styleKeys.length > 0 ? totalSize / styleKeys.length : 0,
      fonts,
      oldestFont,
      newestFont,
      fontsByType,
      corruptedFonts
    };
  } catch (error) {
    console.error(`Error getting font stats for ${styleId}:`, error);
    return { 
      count: 0, 
      totalSize: 0, 
      averageSize: 0, 
      fonts: [],
      fontsByType: {},
      corruptedFonts: []
    };
  }
}

/**
 * Calculate font download speed in KB/s
 */
function calculateFontDownloadSpeed(bytesDownloaded: number, timeElapsed: number): number {
  if (timeElapsed === 0) return 0;
  return (bytesDownloaded / 1024) / (timeElapsed / 1000);
}

/**
 * Detect font type from filename or URL
 */
function detectFontType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ttf':
      return 'TrueType';
    case 'otf':
      return 'OpenType';
    case 'woff':
      return 'WOFF';
    case 'woff2':
      return 'WOFF2';
    case 'eot':
      return 'EOT';
    case 'pbf':
      return 'Protobuf';
    default:
      return 'unknown';
  }
}

/**
 * Validate font data based on file type and content
 */
function isValidFontData(data: ArrayBuffer, filename: string): boolean {
  if (!data || data.byteLength === 0) {
    return false;
  }

  const view = new Uint8Array(data);
  const fontType = detectFontType(filename);
  
  switch (fontType) {
    case 'WOFF':
      // WOFF magic number: "wOFF"
      return view[0] === 0x77 && view[1] === 0x4F && view[2] === 0x46 && view[3] === 0x46;
    case 'WOFF2':
      // WOFF2 magic number: "wOF2"
      return view[0] === 0x77 && view[1] === 0x4F && view[2] === 0x46 && view[3] === 0x32;
    case 'TrueType':
    case 'OpenType':
      {
        // TTF/OTF magic numbers
        const isTTF = view[0] === 0x00 && view[1] === 0x01 && view[2] === 0x00 && view[3] === 0x00;
        const isOTF = view[0] === 0x4F && view[1] === 0x54 && view[2] === 0x54 && view[3] === 0x4F;
        return isTTF || isOTF;
      }
    case 'EOT':
      // EOT magic numbers
      return view[0] === 0x4C && view[1] === 0x50;
    case 'Protobuf':
      // For protobuf fonts (like Mapbox glyphs), just check reasonable size
      return data.byteLength > 0 && data.byteLength < 10 * 1024 * 1024; // Max 10MB
    default:
      // For unknown types, just check that we have data
      return data.byteLength > 0;
  }
}

/**
 * Type guard to check if font is in enhanced format
 */
function isEnhancedFontFormat(font: unknown): font is FontEntry {
  return font !== null && 
         typeof font === 'object' && 
         'data' in font && 
         'size' in font && 
         'type' in font;
}

/**
 * Clean up old fonts based on age or storage quota
 */
export async function cleanupOldFonts(
  options: {
    maxAge?: number; // days
    maxStorageSize?: number; // bytes
    styleId?: string;
  } = {}
): Promise<{ deletedCount: number; freedSpace: number }> {
  const db = await dbPromise;
  const { maxAge = 60, maxStorageSize, styleId } = options; // Default 60 days for fonts
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    let keysToCheck = allKeys;
    
    if (styleId) {
      keysToCheck = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    }
    
    const fontsToDelete: { key: string; size: number; age: number }[] = [];
    let totalSize = 0;
    
    for (const key of keysToCheck) {
      const font = await db.get('fonts', key);
      if (font) {
        let fontSize = 0;
        let downloadedAt: Date | undefined;
        
        if (isEnhancedFontFormat(font)) {
          fontSize = font.size || font.data.byteLength;
          downloadedAt = font.downloadedAt ? new Date(font.downloadedAt) : undefined;
        } else if (font instanceof ArrayBuffer) {
          fontSize = font.byteLength;
        } else if (font && typeof font === 'object' && 'data' in font) {
          fontSize = (font as { data: ArrayBuffer }).data.byteLength;
        }
        
        totalSize += fontSize;
        
        // Calculate age in days
        const age = downloadedAt ? 
          (Date.now() - downloadedAt.getTime()) / (1000 * 60 * 60 * 24) : 
          Infinity;
        
        // Mark for deletion if too old
        if (maxAge && age > maxAge) {
          fontsToDelete.push({ key, size: fontSize, age });
        }
      }
    }
    
    // If storage quota exceeded, delete oldest fonts first
    if (maxStorageSize && totalSize > maxStorageSize) {
      fontsToDelete.sort((a, b) => b.age - a.age); // Oldest first
    }
    
    // Delete selected fonts
    let deletedCount = 0;
    let freedSpace = 0;
    
    for (const fontInfo of fontsToDelete) {
      try {
        await db.delete('fonts', fontInfo.key);
        deletedCount++;
        freedSpace += fontInfo.size;
      } catch (error) {
        console.warn(`Failed to delete font ${fontInfo.key}:`, error);
      }
    }
    
    console.warn(`Font cleanup completed: deleted ${deletedCount} fonts, freed ${(freedSpace / 1024).toFixed(1)} KB`);
    
    return { deletedCount, freedSpace };
  } catch (error) {
    console.error('Error during font cleanup:', error);
    return { deletedCount: 0, freedSpace: 0 };
  }
}

/**
 * Verify font integrity and repair if needed
 */
export async function verifyAndRepairFonts(
  styleId: string,
  options: {
    removeCorrupted?: boolean;
    onProgress?: (progress: { checked: number; total: number; corrupted: number }) => void;
  } = {}
): Promise<{ 
  totalFonts: number; 
  corruptedFonts: number; 
  removedFonts: number;
}> {
  const db = await dbPromise;
  const { removeCorrupted = false, onProgress } = options;
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    const styleKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    
    let checked = 0;
    let corruptedFonts = 0;
    let removedFonts = 0;
    
    for (const key of styleKeys) {
      const font = await db.get('fonts', key);
      if (font) {
        let fontData: ArrayBuffer;
        let fileName: string;
        
        if (isEnhancedFontFormat(font)) {
          fontData = font.data;
          fileName = font.url.split('/').pop() || key.toString();
        } else if (font instanceof ArrayBuffer) {
          fontData = font;
          fileName = key.toString();
        } else if (font && typeof font === 'object' && 'data' in font) {
          fontData = (font as { data: ArrayBuffer }).data;
          fileName = key.toString();
        } else {
          corruptedFonts++;
          if (removeCorrupted) {
            await db.delete('fonts', key);
            removedFonts++;
          }
          continue;
        }
        
        // Validate font data
        const isValid = isValidFontData(fontData, fileName);
        if (!isValid) {
          corruptedFonts++;
          console.warn(`Corrupted font found: ${key}`);
          
          if (removeCorrupted) {
            await db.delete('fonts', key);
            removedFonts++;
          }
        }
      }
      
      checked++;
      onProgress?.({ checked, total: styleKeys.length, corrupted: corruptedFonts });
    }
    
    console.warn(`Font verification completed: ${checked} checked, ${corruptedFonts} corrupted, ${removedFonts} removed`);
    
    return {
      totalFonts: styleKeys.length,
      corruptedFonts,
      removedFonts
    };
  } catch (error) {
    console.error('Error during font verification:', error);
    return { totalFonts: 0, corruptedFonts: 0, removedFonts: 0 };
  }
}

/**
 * Get comprehensive font analytics
 */
export async function getFontAnalytics(styleId?: string): Promise<{
  totalFonts: number;
  totalSize: number;
  averageSize: number;
  sizeByType: Record<string, number>;
  countByType: Record<string, number>;
  downloadTimeRange: { oldest?: Date; newest?: Date };
  compressionRatio: number; // estimated
}> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('fonts');
    let keysToAnalyze = allKeys;
    
    if (styleId) {
      keysToAnalyze = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    }
    
    let totalSize = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;
    const sizeByType: Record<string, number> = {};
    const countByType: Record<string, number> = {};
    
    for (const key of keysToAnalyze) {
      const font = await db.get('fonts', key);
      if (font) {
        let fontSize = 0;
        let fontType = 'unknown';
        let downloadedAt: Date | undefined;
        
        if (isEnhancedFontFormat(font)) {
          fontSize = font.size || font.data.byteLength;
          fontType = font.type;
          downloadedAt = font.downloadedAt ? new Date(font.downloadedAt) : undefined;
        } else if (font instanceof ArrayBuffer) {
          fontSize = font.byteLength;
          fontType = detectFontType(key.toString());
        } else if (font && typeof font === 'object' && 'data' in font) {
          fontSize = (font as { data: ArrayBuffer }).data.byteLength;
          fontType = detectFontType(key.toString());
        }
        
        totalSize += fontSize;
        
        // Track dates
        if (downloadedAt) {
          if (!oldestDate || downloadedAt < oldestDate) oldestDate = downloadedAt;
          if (!newestDate || downloadedAt > newestDate) newestDate = downloadedAt;
        }
        
        // Track by type
        sizeByType[fontType] = (sizeByType[fontType] || 0) + fontSize;
        countByType[fontType] = (countByType[fontType] || 0) + 1;
      }
    }
    
    // Estimate compression ratio based on font types
    let estimatedCompressionRatio = 0;
    if (sizeByType['WOFF2']) {
      estimatedCompressionRatio = 0.7; // WOFF2 typically 30% smaller
    } else if (sizeByType['WOFF']) {
      estimatedCompressionRatio = 0.8; // WOFF typically 20% smaller
    } else {
      estimatedCompressionRatio = 1.0; // No compression
    }
    
    return {
      totalFonts: keysToAnalyze.length,
      totalSize,
      averageSize: keysToAnalyze.length > 0 ? totalSize / keysToAnalyze.length : 0,
      sizeByType,
      countByType,
      downloadTimeRange: { oldest: oldestDate, newest: newestDate },
      compressionRatio: estimatedCompressionRatio
    };
  } catch (error) {
    console.error('Error getting font analytics:', error);
    return {
      totalFonts: 0,
      totalSize: 0,
      averageSize: 0,
      sizeByType: {},
      countByType: {},
      downloadTimeRange: {},
      compressionRatio: 1.0
    };
  }
}
