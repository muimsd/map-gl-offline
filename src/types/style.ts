import { FontDownloadOptions, FontDownloadResult } from './font';
import { DownloadProgress } from './progress';
import { SpriteDownloadOptions, SpriteDownloadResult } from './sprite';

// Basic MapboxStyle interface
export interface MapboxStyle {
  version: number;
  name?: string;
  metadata?: Record<string, unknown>;
  sources: Record<string, unknown>;
  layers: unknown[];
  sprite?: string;
  glyphs?: string;
  [key: string]: unknown;
}

// StyleEntry type for offline style management
export type StyleEntry = {
  key: string;
  style: MapboxStyle;
  regions: import('./region').OfflineRegionOptions[];
  fonts: string[];
  glyphs: string[];
  sprites: string[];
};



export interface StyleDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  fontOptions?: FontDownloadOptions;
  spriteOptions?: SpriteDownloadOptions;
  skipExisting?: boolean;
  validateStyle?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableSourceEmbedding?: boolean;
  storageQuotaCheck?: boolean;
  includeMetadata?: boolean;
}

export interface StyleDownloadResult {
  styleId: string;
  success: boolean;
  downloadTime: number;
  styleSize: number;
  sourcesProcessed: number;
  sourcesEmbedded: number;
  fontResult?: FontDownloadResult;
  spriteResult?: SpriteDownloadResult;
  errors: string[];
  analytics: {
    sourceTypes: Record<string, number>;
    layerTypes: Record<string, number>;
    totalLayers: number;
    hasGlyphs: boolean;
    hasSprites: boolean;
  };
}

export interface EnhancedStyleStats {
  count: number;
  totalSize: number;
  averageSize: number;
  styles: Array<{
    id: string;
    name?: string;
    size: number;
    lastModified?: number;
    sourceCount: number;
    layerCount: number;
    hasGlyphs: boolean;
    hasSprites: boolean;
    metadata?: Record<string, unknown>;
  }>;
  sourceTypes: Record<string, number>;
  layerTypes: Record<string, number>;
  oldestStyle?: { id: string; lastModified: number };
  newestStyle?: { id: string; lastModified: number };
  largestStyle?: { id: string; size: number };
  smallestStyle?: { id: string; size: number };
  storageRecommendations: string[];
}

// Style storage types - aligning with database schema
export type StyleStorageItem = StyleEntry;