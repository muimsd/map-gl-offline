import { DownloadProgress } from './progress';

/**
 * Sprite entry stored in IndexedDB
 */
export interface SpriteEntry {
  /** Unique identifier for the sprite (e.g., "style-name@2x.json") */
  key: string;
  /** Raw sprite data (image or JSON) in ArrayBuffer format */
  data: ArrayBuffer;
  /** MIME type from HTTP Content-Type header */
  contentType?: string;
  /** Last-Modified timestamp from HTTP headers (milliseconds since epoch) */
  lastModified: number;
  /** ISO 8601 timestamp when sprite was downloaded */
  downloadedAt: string;
  /** Sprite file size in bytes */
  size: number;
  /** Final URL used for download */
  url: string;
  /** Optional identifier linking sprite to a style */
  styleId?: string;
  /** Optional identifier linking this sprite to a specific download batch */
  downloadId?: string;
  /** Human-readable sprite name */
  spriteName?: string;
  /** Additional metadata about the sprite */
  metadata?: {
    /** Sprite resolution variant (e.g., "1x", "2x") */
    variant?: '1x' | '2x' | string;
    /** Original URL before any transformations */
    originalUrl?: string;
  };
  /** Expiry timestamp (ms since epoch) based on HTTP Cache-Control/Expires headers */
  expires?: number;
}

/**
 * Configuration options for sprite downloads
 */
export interface SpriteDownloadOptions {
  /** Callback for progress updates */
  onProgress?: (progress: DownloadProgress) => void;
  /** Number of sprites to download concurrently (default: 10) */
  batchSize?: number;
  /** Maximum retry attempts for failed downloads (default: 3) */
  maxRetries?: number;
  /** Skip sprites that already exist in storage (default: true) */
  skipExisting?: boolean;
  /** Download speed limit in bytes per second */
  bandwidthLimit?: number;
  /** Array of sprite keys to download first */
  prioritySprites?: string[];
  /** Check storage quota before starting download (default: true) */
  storageQuotaCheck?: boolean;
  /** Validate sprite data after download (default: true) */
  enableValidation?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Include additional metadata in stored sprites (default: false) */
  includeMetadata?: boolean;
  /** Override sprite name prefix for storage keys (used for array sprite sources) */
  namePrefix?: string;
}

/**
 * Result of a sprite download operation
 */
export interface SpriteDownloadResult {
  /** Total number of sprites in download plan */
  totalSprites: number;
  /** Number of sprites successfully downloaded */
  downloadedSprites: number;
  /** Number of sprites skipped (already existed) */
  skippedSprites: number;
  /** Number of sprites that failed to download */
  failedSprites: number;
  /** Total size of all downloaded sprites in bytes */
  totalSize: number;
  /** Average download speed in bytes per second */
  downloadSpeed: number;
  /** Total download time in milliseconds */
  duration: number;
  /** Array of error details for failed downloads */
  errors: Array<{ url: string; error: string }>;
  /** Detailed analytics about downloaded sprites */
  analytics: {
    /** Distribution by file type (e.g., {"png": 20, "json": 4}) */
    spritesByType: Record<string, number>;
    /** Average sprite size in bytes */
    averageSpriteSize: number;
    /** Largest sprite details */
    largestSprite: { name: string; size: number };
    /** Smallest sprite details */
    smallestSprite: { name: string; size: number };
  };
}

/**
 * Enhanced statistics about stored sprites
 */
export interface EnhancedSpriteStats {
  /** Total number of stored sprites */
  count: number;
  /** Total storage size in bytes */
  totalSize: number;
  /** Average sprite size in bytes */
  averageSize: number;
  /** Array of sprite details */
  sprites: Array<{
    /** Sprite name */
    name: string;
    /** Sprite size in bytes */
    size: number;
    /** File type */
    type: string;
    /** Last modification timestamp */
    lastModified?: number;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  }>;
  /** Distribution by file type */
  spritesByType: Record<string, number>;
  /** Total size by file type */
  sizeByType: Record<string, number>;
  /** Oldest sprite in storage */
  oldestSprite?: { name: string; lastModified: number };
  /** Newest sprite in storage */
  newestSprite?: { name: string; lastModified: number };
  /** Array of sprite keys that failed validation */
  corruptedSprites: string[];
}

/**
 * Local sprite entry with additional metadata
 */
export interface LocalSpriteEntry {
  /** Unique identifier for the sprite */
  key: string;
  /** Human-readable sprite name */
  name: string;
  /** Source URL */
  url: string;
  /** Raw sprite data in ArrayBuffer format */
  data: ArrayBuffer;
  /** MIME type */
  contentType: string;
  /** Sprite file size in bytes */
  size: number;
  /** Last modification timestamp (milliseconds since epoch) */
  lastModified: number;
  /** Extended metadata */
  metadata?: {
    /** Image dimensions if applicable */
    dimensions?: { width: number; height: number };
    /** Image format (e.g., "PNG", "JPEG") */
    format?: string;
    /** Compression ratio if compressed */
    compressionRatio?: number;
    /** Whether this is a spritesheet */
    spritesheet?: boolean;
  };
}
