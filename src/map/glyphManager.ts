import { dbPromise } from '../storage/indexedDbManager';
import { fetchWithRetry, createProgressTracker } from '../utils';

// Enhanced glyph interfaces
export interface GlyphRange {
  start: number;
  end: number;
  data: ArrayBuffer;
  contentType?: string;
}

export interface GlyphEntry {
  key: string; // Format: fontstack/range
  fontstack: string;
  range: string;
  data: ArrayBuffer;
  contentType: string;
  size: number;
  lastModified: number;
  metadata?: {
    unicodeRange: string;
    glyphCount: number;
    compressionRatio?: number;
  };
}

export interface GlyphDownloadOptions {
  maxConcurrency?: number;
  retries?: number;
  timeout?: number;
  onProgress?: (progress: { completed: number; total: number; currentFont: string }) => void;
  includeMetadata?: boolean;
  enableValidation?: boolean;
  priorityFonts?: string[];
}

export interface GlyphDownloadResult {
  totalGlyphs: number;
  downloadedGlyphs: number;
  skippedGlyphs: number;
  failedGlyphs: number;
  totalSize: number;
  downloadSpeed: number;
  duration: number;
  errors: string[];
  analytics: {
    fontsByStack: Record<string, number>;
    averageGlyphSize: number;
    largestGlyph: { fontstack: string; range: string; size: number };
    smallestGlyph: { fontstack: string; range: string; size: number };
  };
}

export interface EnhancedGlyphStats {
  count: number;
  totalSize: number;
  averageSize: number;
  glyphs: string[];
  glyphsByFontstack: Record<string, number>;
  oldestGlyph?: { key: string; timestamp: number };
  newestGlyph?: { key: string; timestamp: number };
  corruptedGlyphs: string[];
  unicodeRanges: string[];
  compressionStats: {
    averageRatio: number;
    bestCompressed: { key: string; ratio: number };
    worstCompressed: { key: string; ratio: number };
  };
}

/**
 * Download and store glyphs for a specific style
 * @param styleId - Unique identifier for the style
 * @param glyphUrls - Array of glyph URLs to download
 * @param options - Download configuration options
 */
export async function downloadGlyphs(
  styleId: string,
  glyphUrls: string[],
  options: GlyphDownloadOptions = {}
): Promise<GlyphDownloadResult> {
  const {
    maxConcurrency = 5,
    retries = 3,
    timeout = 30000,
    onProgress,
    includeMetadata = true,
    enableValidation = true,
    priorityFonts = []
  } = options;

  const startTime = Date.now();
  const progress = createProgressTracker(glyphUrls.length);
  let totalSize = 0;
  let downloadedGlyphs = 0;
  let skippedGlyphs = 0;
  let failedGlyphs = 0;
  const errors: string[] = [];
  
  // Analytics tracking
  const fontsByStack: Record<string, number> = {};
  let largestGlyph = { fontstack: '', range: '', size: 0 };
  let smallestGlyph = { fontstack: '', range: '', size: Infinity };

  if (glyphUrls.length === 0) {
    console.log('No glyphs to download');
    return {
      totalGlyphs: 0,
      downloadedGlyphs: 0,
      skippedGlyphs: 0,
      failedGlyphs: 0,
      totalSize: 0,
      downloadSpeed: 0,
      duration: 0,
      errors: [],
      analytics: {
        fontsByStack: {},
        averageGlyphSize: 0,
        largestGlyph: { fontstack: '', range: '', size: 0 },
        smallestGlyph: { fontstack: '', range: '', size: 0 }
      }
    };
  }

  // Sort URLs by priority
  const sortedUrls = sortGlyphsByPriority(glyphUrls, priorityFonts);

  const db = await dbPromise;
  const processGlyph = async (url: string) => {
    try {
      // Parse font information from URL
      const urlMatch = url.match(/([^/]+)\/(\d+-\d+)\.pbf$/);
      if (!urlMatch) {
        throw new Error(`Invalid glyph URL format: ${url}`);
      }
      
      const [, fontstack, range] = urlMatch;
      const key = `${styleId}:${fontstack}/${range}`;

      // Check if glyph already exists
      const existing = await db.get('glyphs', key);
      if (existing) {
        skippedGlyphs++;
        const progressData = progress.getProgress();
        progress.update(progressData.completed + 1, `${fontstack}/${range}`);
        onProgress?.({ 
          completed: progressData.completed + 1, 
          total: progressData.total, 
          currentFont: `${fontstack}/${range}` 
        });
        return;
      }

      // Download glyph with retry logic
      const response = await fetchWithRetry(url, { 
        retries, 
        timeout,
        retryDelay: 1000 
      });
      
      const contentType = response.headers.get('content-type') || 'application/x-protobuf';
      const data = await response.arrayBuffer();
      const size = data.byteLength;

      // Validate glyph data if enabled
      if (enableValidation && !isValidGlyphData(data, contentType)) {
        throw new Error(`Invalid glyph data received for ${url}`);
      }

      // Store glyph in database (the database schema expects ArrayBuffer for glyphs)
      await db.put('glyphs', data, key);

      // Update statistics
      totalSize += size;
      downloadedGlyphs++;
      fontsByStack[fontstack] = (fontsByStack[fontstack] || 0) + 1;

      if (size > largestGlyph.size) {
        largestGlyph = { fontstack, range, size };
      }
      if (size < smallestGlyph.size) {
        smallestGlyph = { fontstack, range, size };
      }

      const progressData = progress.getProgress();
      progress.update(progressData.completed + 1, `${fontstack}/${range}`);
      onProgress?.({ 
        completed: progressData.completed + 1, 
        total: progressData.total, 
        currentFont: `${fontstack}/${range}` 
      });

    } catch (error) {
      failedGlyphs++;
      const errorMsg = `Failed to download glyph ${url}: ${error}`;
      errors.push(errorMsg);
      console.warn(errorMsg);
      
      const progressData = progress.getProgress();
      progress.update(progressData.completed + 1, 'Error', errorMsg);
      onProgress?.({ 
        completed: progressData.completed + 1, 
        total: progressData.total, 
        currentFont: 'Error' 
      });
    }
  };

  // Process glyphs with concurrency limit
  const semaphore = new Array(maxConcurrency).fill(null);
  const promises = sortedUrls.map((url, index) => 
    semaphore[index % maxConcurrency] = processGlyph(url)
  );

  await Promise.all(promises);

  const duration = Date.now() - startTime;
  const downloadSpeed = totalSize / (duration / 1000); // bytes per second

  return {
    totalGlyphs: glyphUrls.length,
    downloadedGlyphs,
    skippedGlyphs,
    failedGlyphs,
    totalSize,
    downloadSpeed,
    duration,
    errors,
    analytics: {
      fontsByStack,
      averageGlyphSize: downloadedGlyphs > 0 ? totalSize / downloadedGlyphs : 0,
      largestGlyph: largestGlyph.size > 0 ? largestGlyph : { fontstack: '', range: '', size: 0 },
      smallestGlyph: smallestGlyph.size < Infinity ? smallestGlyph : { fontstack: '', range: '', size: 0 }
    }
  };
}

/**
 * Load glyphs for a specific style
 * @param styleId - Style identifier
 * @param fontstack - Optional specific fontstack to load
 */
export async function loadGlyphs(styleId: string, fontstack?: string): Promise<GlyphEntry[]> {
  try {
    const db = await dbPromise;
    const allKeys = await db.getAllKeys('glyphs');
    
    // Filter keys by styleId and optionally by fontstack
    const filteredKeys = allKeys.filter((key) => {
      if (typeof key !== 'string') return false;
      const matchesStyle = key.startsWith(`${styleId}:`);
      if (!matchesStyle) return false;
      
      if (fontstack) {
        const keyParts = key.split(':');
        if (keyParts.length >= 2) {
          const fontPart = keyParts[1].split('/')[0];
          return fontPart === fontstack;
        }
      }
      return true;
    });
    
    // Load glyph data and create GlyphEntry objects
    const glyphEntries: GlyphEntry[] = [];
    for (const key of filteredKeys) {
      const data = await db.get('glyphs', key as string);
      if (data && data instanceof ArrayBuffer) {
        // Parse key to extract fontstack and range
        const keyStr = key as string;
        const keyParts = keyStr.split(':');
        if (keyParts.length >= 2) {
          const [fontstack, range] = keyParts[1].split('/');
          glyphEntries.push({
            key: keyStr,
            fontstack,
            range: range.replace('.pbf', ''),
            data,
            contentType: 'application/x-protobuf',
            size: data.byteLength,
            lastModified: Date.now()
          });
        }
      }
    }
    
    return glyphEntries;
  } catch (error) {
    console.error('Error loading glyphs:', error);
    return [];
  }
}

/**
 * Get enhanced statistics for glyphs
 * @param styleId - Style identifier
 */
export async function getGlyphStats(styleId: string): Promise<EnhancedGlyphStats> {
  const db = await dbPromise;
  const allGlyphs = await db.getAll('glyphs');
  
  // Filter glyphs for this style
  const styleGlyphs = (allGlyphs as unknown as GlyphEntry[]).filter((glyph: GlyphEntry) => 
    glyph.key.startsWith(`${styleId}:`)
  );
  
  if (styleGlyphs.length === 0) {
    return {
      count: 0,
      totalSize: 0,
      averageSize: 0,
      glyphs: [],
      glyphsByFontstack: {},
      corruptedGlyphs: [],
      unicodeRanges: [],
      compressionStats: {
        averageRatio: 0,
        bestCompressed: { key: '', ratio: 0 },
        worstCompressed: { key: '', ratio: 0 }
      }
    };
  }
  
  let totalSize = 0;
  const glyphsByFontstack: Record<string, number> = {};
  const unicodeRanges: string[] = [];
  const corruptedGlyphs: string[] = [];
  let oldestGlyph: { key: string; timestamp: number } | undefined;
  let newestGlyph: { key: string; timestamp: number } | undefined;
  
  // Compression statistics
  let totalCompressionRatio = 0;
  let compressionCount = 0;
  let bestCompressed = { key: '', ratio: 0 };
  let worstCompressed = { key: '', ratio: Infinity };
  
  for (const glyph of styleGlyphs) {
    totalSize += glyph.size;
    
    // Count by fontstack
    glyphsByFontstack[glyph.fontstack] = (glyphsByFontstack[glyph.fontstack] || 0) + 1;
    
    // Collect unicode ranges
    if (glyph.metadata?.unicodeRange && !unicodeRanges.includes(glyph.metadata.unicodeRange)) {
      unicodeRanges.push(glyph.metadata.unicodeRange);
    }
    
    // Track oldest and newest
    if (!oldestGlyph || glyph.lastModified < oldestGlyph.timestamp) {
      oldestGlyph = { key: glyph.key, timestamp: glyph.lastModified };
    }
    if (!newestGlyph || glyph.lastModified > newestGlyph.timestamp) {
      newestGlyph = { key: glyph.key, timestamp: glyph.lastModified };
    }
    
    // Check for corruption
    try {
      if (!isValidGlyphData(glyph.data, glyph.contentType)) {
        corruptedGlyphs.push(glyph.key);
      }
    } catch (error) {
      corruptedGlyphs.push(glyph.key);
    }
    
    // Compression statistics
    if (glyph.metadata?.compressionRatio) {
      totalCompressionRatio += glyph.metadata.compressionRatio;
      compressionCount++;
      
      if (glyph.metadata.compressionRatio > bestCompressed.ratio) {
        bestCompressed = { key: glyph.key, ratio: glyph.metadata.compressionRatio };
      }
      if (glyph.metadata.compressionRatio < worstCompressed.ratio) {
        worstCompressed = { key: glyph.key, ratio: glyph.metadata.compressionRatio };
      }
    }
  }
  
  return {
    count: styleGlyphs.length,
    totalSize,
    averageSize: styleGlyphs.length > 0 ? totalSize / styleGlyphs.length : 0,
    glyphs: styleGlyphs.map(g => g.key),
    glyphsByFontstack,
    oldestGlyph,
    newestGlyph,
    corruptedGlyphs,
    unicodeRanges,
    compressionStats: {
      averageRatio: compressionCount > 0 ? totalCompressionRatio / compressionCount : 0,
      bestCompressed: bestCompressed.ratio > 0 ? bestCompressed : { key: '', ratio: 0 },
      worstCompressed: worstCompressed.ratio < Infinity ? worstCompressed : { key: '', ratio: 0 }
    }
  };
}

/**
 * Delete glyphs for a specific style
 * @param styleId - Style identifier
 */
export async function deleteGlyphs(styleId: string): Promise<void> {
  try {
    const db = await dbPromise;
    const allGlyphs = await db.getAll('glyphs');
    const glyphsToDelete = (allGlyphs as unknown as GlyphEntry[]).filter((glyph: GlyphEntry) => 
      glyph.key.startsWith(`${styleId}:`)
    );
    
    for (const glyph of glyphsToDelete) {
      await db.delete('glyphs', glyph.key);
    }
    
    console.log(`Deleted ${glyphsToDelete.length} glyphs for style ${styleId}`);
  } catch (error) {
    console.error('Error deleting glyphs:', error);
  }
}

/**
 * Delete all glyphs
 */
export async function deleteAllGlyphs(): Promise<void> {
  try {
    const db = await dbPromise;
    await db.clear('glyphs');
    console.log('All glyphs deleted successfully');
  } catch (error) {
    console.error('Error deleting all glyphs:', error);
  }
}

/**
 * Cleanup old glyphs based on various criteria
 */
export async function cleanupOldGlyphs(options: {
  maxAge?: number;
  maxCount?: number;
  maxSize?: number;
  styleId?: string;
  onProgress?: (progress: { completed: number; total: number; message: string }) => void;
} = {}): Promise<{ deletedCount: number; freedSpace: number; errors: string[] }> {
  const { maxAge = 60, maxCount, maxSize, styleId, onProgress } = options;
  const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
  
  const db = await dbPromise;
  const allGlyphs = await db.getAll('glyphs');
  const styleGlyphs = (allGlyphs as unknown as GlyphEntry[]).filter((glyph: GlyphEntry) => 
    !styleId || glyph.key.startsWith(`${styleId}:`)
  );
  
  let glyphsToDelete: GlyphEntry[] = [];
  const errors: string[] = [];
  
  // Filter by age
  if (maxAge) {
    glyphsToDelete = styleGlyphs.filter(glyph => glyph.lastModified < cutoffTime);
  }
  
  // Filter by count (keep newest)
  if (maxCount && styleGlyphs.length > maxCount) {
    const sortedByDate = styleGlyphs.sort((a, b) => b.lastModified - a.lastModified);
    const excessGlyphs = sortedByDate.slice(maxCount);
    glyphsToDelete.push(...excessGlyphs);
  }
  
  // Filter by total size (remove largest first)
  if (maxSize) {
    const totalSize = styleGlyphs.reduce((sum, glyph) => sum + glyph.size, 0);
    if (totalSize > maxSize) {
      const sortedBySize = styleGlyphs.sort((a, b) => b.size - a.size);
      let currentSize = totalSize;
      for (const glyph of sortedBySize) {
        if (currentSize <= maxSize) break;
        glyphsToDelete.push(glyph);
        currentSize -= glyph.size;
      }
    }
  }
  
  // Remove duplicates
  const uniqueGlyphsToDelete = glyphsToDelete.filter((glyph, index, array) => 
    array.findIndex(g => g.key === glyph.key) === index
  );
  
  let deletedCount = 0;
  let freedSpace = 0;
  
  for (let i = 0; i < uniqueGlyphsToDelete.length; i++) {
    try {
      const glyph = uniqueGlyphsToDelete[i];
      await db.delete('glyphs', glyph.key);
      deletedCount++;
      freedSpace += glyph.size;
      
      onProgress?.({
        completed: i + 1,
        total: uniqueGlyphsToDelete.length,
        message: `Deleted glyph ${glyph.key}`
      });
    } catch (error) {
      errors.push(`Failed to delete glyph ${uniqueGlyphsToDelete[i].key}: ${error}`);
    }
  }
  
  return { deletedCount, freedSpace, errors };
}

/**
 * Verify and repair corrupted glyphs
 */
export async function verifyAndRepairGlyphs(
  styleId: string,
  options: {
    removeCorrupted?: boolean;
    onProgress?: (progress: { checked: number; total: number; corrupted: number; repaired: number }) => void;
  } = {}
): Promise<{ totalGlyphs: number; corruptedGlyphs: number; repairedGlyphs: number; removedGlyphs: number }> {
  const { removeCorrupted = false, onProgress } = options;
  
  const db = await dbPromise;
  const allGlyphs = await db.getAll('glyphs');
  const styleGlyphs = (allGlyphs as unknown as GlyphEntry[]).filter((glyph: GlyphEntry) => 
    glyph.key.startsWith(`${styleId}:`)
  );
  
  let corruptedGlyphs = 0;
  let repairedGlyphs = 0;
  let removedGlyphs = 0;
  
  for (let i = 0; i < styleGlyphs.length; i++) {
    const glyph = styleGlyphs[i];
    
    try {
      // Validate glyph data
      if (!isValidGlyphData(glyph.data, glyph.contentType)) {
        corruptedGlyphs++;
        
        if (removeCorrupted) {
          await db.delete('glyphs', glyph.key);
          removedGlyphs++;
        }
      }
    } catch (error) {
      corruptedGlyphs++;
      
      if (removeCorrupted) {
        await db.delete('glyphs', glyph.key);
        removedGlyphs++;
      }
    }
    
    onProgress?.({
      checked: i + 1,
      total: styleGlyphs.length,
      corrupted: corruptedGlyphs,
      repaired: repairedGlyphs
    });
  }
  
  return {
    totalGlyphs: styleGlyphs.length,
    corruptedGlyphs,
    repairedGlyphs,
    removedGlyphs
  };
}

// Helper functions
function sortGlyphsByPriority(urls: string[], priorityFonts: string[]): string[] {
  if (priorityFonts.length === 0) return urls;
  
  const priority: string[] = [];
  const normal: string[] = [];
  
  for (const url of urls) {
    const isPriority = priorityFonts.some(priority => url.includes(priority));
    if (isPriority) {
      priority.push(url);
    } else {
      normal.push(url);
    }
  }
  
  return [...priority, ...normal];
}

function isValidGlyphData(data: ArrayBuffer, contentType: string): boolean {
  // Basic validation for protobuf format
  if (contentType.includes('protobuf') || contentType.includes('pbf')) {
    // Check for protobuf magic number or basic structure
    const view = new Uint8Array(data);
    return view.length > 0 && (view[0] === 0x08 || view[0] === 0x12 || view[0] === 0x1a);
  }
  
  return data.byteLength > 0;
}

async function extractGlyphCount(data: ArrayBuffer): Promise<number> {
  try {
    // Simple estimation based on data size and typical glyph size
    return Math.floor(data.byteLength / 100);
  } catch (error) {
    return 0;
  }
}

function calculateCompressionRatio(data: ArrayBuffer, compressedSize: number): number {
  // Estimate original size and calculate compression ratio
  const estimatedOriginalSize = compressedSize * 2; // Conservative estimate
  return compressedSize / estimatedOriginalSize;
}