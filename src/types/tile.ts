import type { DownloadProgress } from './progress';
// Tile entry stored in the tiles table
export interface TileEntry {
  key: string;
  data: ArrayBuffer;
  downloadedAt: string;
  size: number;
  type: string;
  url: string;
  lastModified: number;
  contentType?: string;
  x?: number;
  y?: number;
  z?: number;
  styleId?: string;
  sourceId?: string;
}

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
