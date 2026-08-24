import { DownloadProgress } from './progress';

/**
 * Font entry stored in IndexedDB
 */
export interface FontEntry {
  /** Unique identifier for the font (e.g., "Roboto/0-255") */
  key: string;
  /** Raw font data in ArrayBuffer format */
  data: ArrayBuffer;
  /** ISO 8601 timestamp when font was downloaded */
  downloadedAt: string;
  /** Font file size in bytes */
  size: number;
  /** Font file type (e.g., "pbf", "ttf", "woff2") */
  type: string;
  /** Final URL used for download (may differ from originalUrl due to redirects) */
  url: string;
  /** Original URL before any transformations */
  originalUrl: string;
  /** Last-Modified timestamp from HTTP headers (milliseconds since epoch) */
  lastModified: number;
  /** MIME type from HTTP Content-Type header */
  contentType: string;
  /** Optional identifier linking this font to a specific download batch */
  downloadId?: string;
  /** Additional metadata about the download */
  metadata?: {
    /** User agent string used for download */
    userAgent?: string;
    /** Timestamp when download was initiated */
    downloadTimestamp?: number;
  };
  /** Expiry timestamp (ms since epoch) based on HTTP Cache-Control/Expires headers */
  expires?: number;
}

/**
 * Configuration options for font downloads
 */
export interface FontDownloadOptions {
  /** Callback for progress updates */
  onProgress?: (progress: DownloadProgress) => void;
  /** Number of fonts to download concurrently (default: 10) */
  batchSize?: number;
  /** Maximum retry attempts for failed downloads (default: 3) */
  maxRetries?: number;
  /** CORS proxy URL for cross-origin requests */
  corsProxy?: string;
  /** Skip fonts that already exist in storage (default: true) */
  skipExisting?: boolean;
  /** Delay in milliseconds between retry attempts (default: 1000) */
  retryDelay?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Validate font data after download (default: true) */
  validateFonts?: boolean;
  /**
   * @deprecated Not read by the font downloader — `batchSize` is the effective
   * concurrency knob. Kept so existing callers still type-check; setting it has
   * no effect.
   */
  maxConcurrency?: number;
  /** Check storage quota before starting download (default: true) */
  storageQuotaCheck?: boolean;
  /** Continue downloading even if some fonts fail (default: false) */
  continueOnError?: boolean;
  /** Reduce console logging for failed fonts (default: false) */
  quietMode?: boolean;
}

/**
 * Result of a font download operation
 */
export interface FontDownloadResult {
  /** Total number of fonts in download plan */
  totalFonts: number;
  /** Number of fonts successfully downloaded */
  downloadedFonts: number;
  /** Number of fonts skipped (already existed) */
  skippedFonts: number;
  /** Number of fonts that failed to download */
  failedFonts: number;
  /** Total size of all downloaded fonts in bytes */
  totalSize: number;
  /** Total download time in milliseconds */
  downloadTime: number;
  /** Average download speed in bytes per second */
  averageSpeed: number;
  /** Array of error details for failed downloads */
  errors: Array<{ url: string; error: string }>;
  /** Distribution of fonts by file type (e.g., {"pbf": 45, "ttf": 10}) */
  fontsByType: Record<string, number>;
}

/**
 * Enhanced statistics about stored fonts
 */
export interface EnhancedFontStats {
  /** Total number of stored fonts */
  count: number;
  /** Total storage size in bytes */
  totalSize: number;
  /** Average font size in bytes */
  averageSize: number;
  /** Array of font keys */
  fonts: string[];
  /** Distribution by file type */
  fontsByType: Record<string, number>;
  /** Oldest font in storage */
  oldestFont?: { key: string; timestamp: number };
  /** Newest font in storage */
  newestFont?: { key: string; timestamp: number };
  /** Array of font keys that failed validation */
  corruptedFonts: string[];
}
