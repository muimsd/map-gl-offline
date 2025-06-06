export async function fetchResource(url: string): Promise<{ type: 'image' | 'pbf'; data: ArrayBuffer }> {
  // Add CORS mode to fetch
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  const data = await response.arrayBuffer();

  if (contentType?.includes('image')) {
    return { type: 'image', data };
  } else if (contentType?.includes('application/x-protobuf')) {
    return { type: 'pbf', data };
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

/**
 * Enhanced fetch with retry logic and timeout
 */
export async function fetchResourceWithRetry(
  url: string,
  options: {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<{ type: 'image' | 'pbf' | 'json' | 'other'; data: ArrayBuffer }> {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        mode: 'cors', 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const data = await response.arrayBuffer();

      let type: 'image' | 'pbf' | 'json' | 'other';
      if (contentType.includes('image')) {
        type = 'image';
      } else if (contentType.includes('application/x-protobuf') || contentType.includes('protobuf')) {
        type = 'pbf';
      } else if (contentType.includes('application/json')) {
        type = 'json';
      } else {
        type = 'other';
      }

      return { type, data };
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }
  
  throw new Error(`Failed to fetch ${url}`);
}

/**
 * Enhanced fetch with retry logic and timeout that returns Response object
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        mode: 'cors', 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }
  
  throw new Error(`Failed to fetch ${url}`);
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
    onError?: (error: Error, item: T) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, onProgress, onError } = options;
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        completed++;
        onProgress?.(completed, items.length);
        return result;
      } catch (error) {
        onError?.(error as Error, item);
        completed++;
        onProgress?.(completed, items.length);
        throw error;
      }
    });

    try {
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.warn(`Failed to process item ${i + index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error(`Batch processing error:`, error);
    }
  }

  return results;
}

/**
 * Download progress tracking interface
 */
export interface DownloadProgress {
  completed: number;
  total: number;
  percentage: number;
  currentItem?: string;
  message?: string;
  errors: string[];
}

/**
 * Create a progress tracker
 */
export function createProgressTracker(total: number): {
  progress: DownloadProgress;
  update: (completed?: number, currentItem?: string, error?: string) => void;
  getProgress: () => DownloadProgress;
} {
  const progress: DownloadProgress = {
    completed: 0,
    total,
    percentage: 0,
    errors: []
  };

  return {
    progress,
    update: (completed?: number, currentItem?: string, error?: string) => {
      if (completed !== undefined) progress.completed = completed;
      if (currentItem !== undefined) progress.currentItem = currentItem;
      if (error !== undefined) progress.errors.push(error);
      progress.percentage = total > 0 ? Math.round((progress.completed / total) * 100) : 0;
    },
    getProgress: () => ({ ...progress })
  };
}

/**
 * Validate resource data
 */
export function validateResource(data: ArrayBuffer, type: string): boolean {
  if (!data || data.byteLength === 0) {
    return false;
  }

  // Basic validation based on type
  const view = new Uint8Array(data);
  
  switch (type) {
    case 'pbf':
      // Check for protobuf magic bytes or reasonable size
      return data.byteLength > 0 && data.byteLength < 50 * 1024 * 1024; // Max 50MB
    case 'image':
      // Check for common image format headers
      const isPNG = view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47;
      const isJPEG = view[0] === 0xFF && view[1] === 0xD8;
      const isWebP = view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
      return isPNG || isJPEG || isWebP;
    default:
      return data.byteLength > 0;
  }
}
/**
 * Extracts all fontstacks from a style object and generates all glyph URLs for a set of Unicode ranges.
 * @param style The style JSON object
 * @param glyphsUrlTemplate The glyphs URL template from the style (e.g. .../fonts/{fontstack}/{range}.pbf)
 * @param ranges Optional array of ranges (default: [0-255, 256-511, ..., 61440-61695])
 */
export function generateGlyphUrlsFromStyle(style: any, glyphsUrlTemplate: string, ranges?: Array<[number, number]>): string[] {
  // Default Unicode ranges for Mapbox/MapLibre fonts
  const defaultRanges: Array<[number, number]> = [
    [0, 255], [256, 511], [512, 767], [768, 1023], [1024, 1279],
    [1280, 1535], [1536, 1791], [1792, 2047], [2048, 2303], [2304, 2559],
    [61440, 61695] // Private Use Area (for icons)
  ];
  const usedRanges = ranges || defaultRanges;

  // Collect all fontstacks used in the style's layers
  const fontstacks = new Set<string>();
  if (style && Array.isArray(style.layers)) {
    for (const layer of style.layers) {
      if (layer.layout && layer.layout["text-font"]) {
        const fonts = Array.isArray(layer.layout["text-font"]) ? layer.layout["text-font"] : [layer.layout["text-font"]];
        fonts.forEach(f => fontstacks.add(f));
      }
    }
  }

  // Generate all glyph URLs
  const urls: string[] = [];
  for (const fontstack of fontstacks) {
    for (const [start, end] of usedRanges) {
      const range = `${start}-${end}`;
      const url = glyphsUrlTemplate.replace('{fontstack}', encodeURIComponent(fontstack)).replace('{range}', range);
      urls.push(url);
    }
  }
  return urls;
}
/**
 * Extract tile coordinates from a tile URL
 * e.g., "https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/0/0/0.mvt" -> "0/0/0.mvt"
 */
export function extractTileKey(url: string): string {
  // Match z/x/y pattern with optional file extension
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/);
  if (match) {
    const [, z, x, y, ext] = match;
    return `${z}/${x}/${y}.${ext}`;
  }
  
  // Fallback: try to extract just the filename part
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  if (filename.includes('.')) {
    return filename;
  }
  
  // Last resort: use the full URL
  console.warn(`Could not extract tile key from URL: ${url}`);
  return url;
}
