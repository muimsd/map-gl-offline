import { dbPromise } from '../storage/indexedDbManager';
import { OfflineRegionOptions, MapboxStyle } from '../types';
import * as tilebelt from '@mapbox/tilebelt';
import { 
  fetchResourceWithRetry, 
  extractTileKey, 
  processBatch, 
  createProgressTracker,
  validateResource,
  DownloadProgress 
} from '../utils';

export interface TileDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  batchSize?: number;
  maxRetries?: number;
  skipExisting?: boolean;
  maxConcurrency?: number;
  retryDelay?: number;
  timeout?: number;
  validateTiles?: boolean;
  compressTiles?: boolean;
  priorityZoomLevels?: number[];
  bandwidthLimit?: number; // KB/s
  storageQuotaCheck?: boolean;
}

export interface TileDownloadResult {
  totalTiles: number;
  downloadedTiles: number;
  skippedTiles: number;
  failedTiles: number;
  totalSize: number;
  downloadTime: number;
  averageSpeed: number; // KB/s
  errors: Array<{ url: string; error: string }>;
}

export interface TileStats {
  count: number;
  totalSize: number;
  averageSize: number;
  oldestTile?: Date;
  newestTile?: Date;
  zoomLevelStats: Map<number, { count: number; size: number }>;
}

export async function downloadTiles(
  region: OfflineRegionOptions,
  style: MapboxStyle,
  styleId: string,
  options: TileDownloadOptions = {}
): Promise<TileDownloadResult> {
  const db = await dbPromise;
  const { bounds, minZoom, maxZoom } = region;
  const { 
    onProgress, 
    batchSize = 50, 
    maxRetries = 3, 
    skipExisting = true,
    maxConcurrency = 20,
    retryDelay = 1000,
    timeout = 30000,
    validateTiles = true,
    priorityZoomLevels = [],
    bandwidthLimit,
    storageQuotaCheck = true
  } = options;
  
  const startTime = Date.now();
  const result: TileDownloadResult = {
    totalTiles: 0,
    downloadedTiles: 0,
    skippedTiles: 0,
    failedTiles: 0,
    totalSize: 0,
    downloadTime: 0,
    averageSpeed: 0,
    errors: []
  };

  console.warn(`Starting enhanced tile download for region ${region.id} (${minZoom}-${maxZoom})`);

  // Check storage quota if enabled
  if (storageQuotaCheck && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageRatio = estimate.usage ? estimate.usage / (estimate.quota || Infinity) : 0;
      if (usageRatio > 0.9) {
        console.warn(`Storage usage is at ${(usageRatio * 100).toFixed(1)}%. Consider cleaning up old tiles.`);
      }
    } catch (error) {
      console.warn('Could not check storage quota:', error);
    }
  }

  for (const sourceKey of Object.keys(style.sources)) {
    const source = style.sources[sourceKey] as Record<string, unknown>;
    const sourceUrl = source.url as { tiles?: string | string[] };
    
    if (!sourceUrl || !sourceUrl.tiles) {
      console.warn(`No tiles URL found for source ${sourceKey}`);
      continue;
    }

    const tilesArr = Array.isArray(sourceUrl.tiles) ? sourceUrl.tiles : [sourceUrl.tiles];
    
    for (const tilesURL of tilesArr) {
      let tileUrls = generateTileUrls(tilesURL, bounds, minZoom, maxZoom);
      
      // Sort by priority zoom levels if specified
      if (priorityZoomLevels.length > 0) {
        tileUrls = sortTilesByPriority(tileUrls, priorityZoomLevels);
      }
      
      result.totalTiles += tileUrls.length;
      console.warn(`Generated ${tileUrls.length} tile URLs for source ${sourceKey}`);
      
      const progressTracker = createProgressTracker(tileUrls.length);
      let downloadedBytes = 0;
      const lastBandwidthCheck = Date.now();
      
      await processBatch(
        tileUrls,
        async (url: string) => {
          const tileKey = extractTileKey(url);
          const key = `${styleId}::${tileKey}`;
          
          try {
            // Check if tile already exists
            if (skipExisting) {
              const existingTile = await db.get('tiles', key);
              if (existingTile) {
                result.skippedTiles++;
                return { url, key, skipped: true };
              }
            }

            // Bandwidth throttling
            if (bandwidthLimit) {
              await throttleBandwidth(downloadedBytes, lastBandwidthCheck, bandwidthLimit);
            }

            // Download the tile with enhanced retry logic
            const tileResource = await fetchResourceWithRetry(url, {
              retries: maxRetries,
              retryDelay,
              timeout
            });

            // Validate the downloaded data if enabled
            if (validateTiles) {
              const isValid = validateResource(tileResource.data, tileResource.type === 'pbf' ? 'pbf' : 'image');
              if (!isValid) {
                throw new Error(`Invalid tile data received for ${url} (type: ${tileResource.type})`);
              }
            }

            const tileData = tileResource.data;
            
            // Store the tile with metadata
            await db.put('tiles', {
              key,
              data: tileData,
              downloadedAt: new Date().toISOString(),
              size: tileData.byteLength,
              type: tileResource.type,
              url: url
            } as any);
            
            downloadedBytes += tileData.byteLength;
            result.downloadedTiles++;
            result.totalSize += tileData.byteLength;
            
            console.warn(`Downloaded tile: ${key} (${(tileData.byteLength / 1024).toFixed(1)}KB, type: ${tileResource.type})`);
            
            return { url, key, size: tileData.byteLength, downloaded: true };
          } catch (error) {
            result.failedTiles++;
            const errorMsg = `Failed to download tile ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push({ url, error: errorMsg });
            console.error(errorMsg);
            throw error;
          }
        },
        {
          batchSize: Math.min(batchSize, maxConcurrency),
          onProgress: (completed, total) => {
            const currentSpeed = calculateDownloadSpeed(downloadedBytes, Date.now() - startTime);
            progressTracker.update(completed, `Downloading tiles (${completed}/${total}) - ${currentSpeed.toFixed(1)} KB/s`);
            onProgress?.(progressTracker.getProgress());
          },
          onError: (error, url) => {
            const tileKey = extractTileKey(url);
            const errorMsg = `Failed to download tile ${tileKey}: ${error.message}`;
            progressTracker.update(undefined, undefined, errorMsg);
            console.warn(errorMsg);
          }
        }
      );

      const finalProgress = progressTracker.getProgress();
      console.warn(`Tile batch completed: ${finalProgress.completed}/${finalProgress.total} (${finalProgress.percentage}%)`);
    }
  }

  result.downloadTime = Date.now() - startTime;
  result.averageSpeed = calculateDownloadSpeed(result.totalSize, result.downloadTime);

  console.warn(`Tile download summary:`, {
    total: result.totalTiles,
    downloaded: result.downloadedTiles,
    skipped: result.skippedTiles,
    failed: result.failedTiles,
    totalSize: `${(result.totalSize / 1024 / 1024).toFixed(2)} MB`,
    avgSpeed: `${result.averageSpeed.toFixed(1)} KB/s`,
    duration: `${(result.downloadTime / 1000).toFixed(1)}s`
  });

  return result;
}

export async function loadTiles(
  regionOptions: OfflineRegionOptions,
  styleId?: string,
): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('tiles');
    let keysToLoad = allKeys;
    
    if (styleId) {
      keysToLoad = allKeys.filter(
        (k) => typeof k === 'string' && k.startsWith(styleId + '::'),
      );
    }
    
    console.warn(`Loading ${keysToLoad.length} tiles for region ${regionOptions.id}`);
    
    let loaded = 0;
    for (const key of keysToLoad) {
      try {
        const tileData = await db.get('tiles', key);
        if (tileData) {
          loaded++;
          console.warn(`Loaded tile: ${key}`);
        }
      } catch (error) {
        console.warn(`Failed to load tile ${key}:`, error);
      }
    }
    
    console.warn(`Successfully loaded ${loaded}/${keysToLoad.length} tiles`);
  } catch (error) {
    console.error('Error loading tiles:', error);
    throw new Error(`Failed to load tiles for region ${regionOptions.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteTiles(downloadId: string): Promise<void> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('tiles');
    const keysToDelete = allKeys.filter(k => typeof k === 'string' && k.startsWith(downloadId + '::'));
    
    console.warn(`Deleting ${keysToDelete.length} tiles for download ID: ${downloadId}`);
    
    let deleted = 0;
    for (const key of keysToDelete) {
      try {
        await db.delete('tiles', key);
        deleted++;
        console.warn(`Deleted tile: ${key}`);
      } catch (error) {
        console.warn(`Failed to delete tile ${key}:`, error);
      }
    }
    
    console.warn(`Successfully deleted ${deleted}/${keysToDelete.length} tiles`);
  } catch (error) {
    console.error('Error deleting tiles:', error);
    throw new Error(`Failed to delete tiles for download ID ${downloadId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get enhanced tile statistics for a style
 */
export async function getTileStats(styleId: string): Promise<TileStats> {
  const db = await dbPromise;
  
  try {
    const allKeys = await db.getAllKeys('tiles');
    const styleKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(styleId + '::'));
    
    let totalSize = 0;
    let oldestTile: Date | undefined;
    let newestTile: Date | undefined;
    const zoomLevelStats = new Map<number, { count: number; size: number }>();
    
    for (const key of styleKeys) {
      const tile = await db.get('tiles', key);
      if (tile) {
        // Handle both old format (just data) and new format (with metadata)
        let tileSize = 0;
        let downloadedAt: Date | undefined;
        
        if (isEnhancedTileFormat(tile)) {
          // New format with metadata
          tileSize = tile.size || tile.data.byteLength;
          downloadedAt = tile.downloadedAt ? new Date(tile.downloadedAt) : undefined;
        } else if (tile instanceof ArrayBuffer) {
          // Old format (just ArrayBuffer)
          tileSize = tile.byteLength;
        }
        
        totalSize += tileSize;
        
        // Track oldest and newest tiles
        if (downloadedAt) {
          if (!oldestTile || downloadedAt < oldestTile) {
            oldestTile = downloadedAt;
          }
          if (!newestTile || downloadedAt > newestTile) {
            newestTile = downloadedAt;
          }
        }
        
        // Extract zoom level from key and update stats
        const zoomMatch = key.toString().match(/::(\d+)\//);
        if (zoomMatch) {
          const zoom = parseInt(zoomMatch[1], 10);
          const existing = zoomLevelStats.get(zoom) || { count: 0, size: 0 };
          zoomLevelStats.set(zoom, {
            count: existing.count + 1,
            size: existing.size + tileSize
          });
        }
      }
    }
    
    return {
      count: styleKeys.length,
      totalSize,
      averageSize: styleKeys.length > 0 ? totalSize / styleKeys.length : 0,
      oldestTile,
      newestTile,
      zoomLevelStats
    };
  } catch (error) {
    console.error(`Error getting tile stats for ${styleId}:`, error);
    return { 
      count: 0, 
      totalSize: 0, 
      averageSize: 0,
      zoomLevelStats: new Map()
    };
  }
}

/**
 * Type guard to check if tile is in enhanced format
 */
function isEnhancedTileFormat(tile: any): tile is {
  key: string;
  data: ArrayBuffer;
  downloadedAt: string;
  size: number;
  type: string;
  url: string;
} {
  return tile && typeof tile === 'object' && 'data' in tile && 'size' in tile;
}

function generateTileUrls(
  urlTemplate: string,
  bounds: [[number, number], [number, number]],
  minZoom: number,
  maxZoom: number,
): string[] {
  const urls: string[] = [];
  const [sw, ne] = bounds;

  for (let z = minZoom; z <= maxZoom; z++) {
    const swTile = tilebelt.pointToTile(sw[0], sw[1], z);
    const neTile = tilebelt.pointToTile(ne[0], ne[1], z);

    for (let x = swTile[0]; x <= neTile[0]; x++) {
      for (let y = swTile[1]; y <= neTile[1]; y++) {
        const tileUrl = urlTemplate
          .replace('{z}', z.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());
        urls.push(tileUrl);
      }
    }
  }

  return urls;
}

/**
 * Calculate download speed in KB/s
 */
function calculateDownloadSpeed(bytesDownloaded: number, timeElapsed: number): number {
  if (timeElapsed === 0) return 0;
  return (bytesDownloaded / 1024) / (timeElapsed / 1000);
}

/**
 * Sort tiles by priority zoom levels
 */
function sortTilesByPriority(tileUrls: string[], priorityZoomLevels: number[]): string[] {
  if (priorityZoomLevels.length === 0) return tileUrls;
  
  return tileUrls.sort((a, b) => {
    const zoomA = extractZoomFromUrl(a);
    const zoomB = extractZoomFromUrl(b);
    
    const priorityA = priorityZoomLevels.indexOf(zoomA);
    const priorityB = priorityZoomLevels.indexOf(zoomB);
    
    // Higher priority (lower index) comes first
    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;
    
    // Same priority, sort by zoom level
    return zoomA - zoomB;
  });
}

/**
 * Extract zoom level from tile URL
 */
function extractZoomFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/\d+\/\d+\./);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Throttle bandwidth to limit download speed
 */
async function throttleBandwidth(
  bytesDownloaded: number, 
  startTime: number, 
  limitKbps: number
): Promise<void> {
  const elapsed = Date.now() - startTime;
  const expectedTime = (bytesDownloaded / 1024) / limitKbps * 1000;
  
  if (elapsed < expectedTime) {
    const delay = expectedTime - elapsed;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
