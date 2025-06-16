import { FontDownloadOptions, FontDownloadResult } from './font';
import { DownloadProgress } from './progress';
import { SpriteDownloadOptions, SpriteDownloadResult } from './sprite';

// Style provider types
export type StyleProvider = 'mapbox' | 'maplibre' | 'auto';

// Basic style interface that works with both Mapbox GL and MapLibre GL
export interface BaseStyle {
  version: number;
  name?: string;
  metadata?: Record<string, unknown>;
  sources: Record<string, unknown>;
  layers: unknown[];
  sprite?: string;
  glyphs?: string;
  [key: string]: unknown;
}

// Extended interface for Mapbox GL specific features
export interface MapboxGLStyle extends BaseStyle {
  // Mapbox GL specific properties
  owner?: string;
  id?: string;
  crs?: string;
  draft?: boolean;
  created?: string;
  modified?: string;
  visibility?: 'public' | 'private';
}

// Alias for backward compatibility
export interface MapboxStyle extends BaseStyle {}

// Enhanced StyleEntry that can handle both providers
export type StyleEntry = {
  key: string;
  style: BaseStyle;
  provider: StyleProvider;
  regions: import('./region').OfflineRegionOptions[];
  fonts: string[];
  glyphs: string[];
  sprites: string[];
  // Additional metadata for Mapbox GL
  accessToken?: string;
  originalUrl?: string;
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
