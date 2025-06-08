import { DownloadProgress } from "./progress";

// Sprite entry stored in the sprites table
export interface SpriteEntry {
  key: string;
  data: ArrayBuffer;
  contentType?: string;
  lastModified: number;
  downloadedAt: string;
  size: number;
  url: string;
}


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
  averageSize: number;
  sprites: Array<{
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
  corruptedSprites: string[];
}

export interface LocalSpriteEntry {
  key: string;
  name: string;
  url: string;
  data: ArrayBuffer;
  contentType: string;
  size: number;
  lastModified: number;
  metadata?: {
    dimensions?: { width: number; height: number };
    format?: string;
    compressionRatio?: number;
    spritesheet?: boolean;
  };
}