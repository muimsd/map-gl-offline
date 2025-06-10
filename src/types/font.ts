import { DownloadProgress } from './progress';

// Font entry stored in the fonts table
export interface FontEntry {
  key: string;
  data: ArrayBuffer;
  downloadedAt: string;
  size: number;
  type: string;
  url: string;
  originalUrl: string;
  lastModified: number;
  contentType: string;
  downloadId?: string;
  metadata?: {
    userAgent?: string;
    downloadTimestamp?: number;
  };
}

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
  continueOnError?: boolean; // Continue downloading even if some fonts fail
  quietMode?: boolean; // Reduce console logging for failed fonts
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
