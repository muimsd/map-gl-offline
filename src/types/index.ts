import { DBSchema } from 'idb';

// Region entry stored in the regions table
export interface StoredRegion extends OfflineRegionOptions {
  key: string;
  styleId: string;
  created: number;
  expiry: number;
}

export interface OfflineMapDB extends DBSchema {
  regions: {
    key: string;
    value: StoredRegion;
  };
  tiles: {
    key: string;
    value: ArrayBuffer;
  };
  sprites: {
    key: string;
    value: {
      data: ArrayBuffer;
      contentType?: string;
    };
  };
  glyphs: {
    key: string;
    value: ArrayBuffer;
  };
  styles: {
    key: string;
    value: StyleEntry; // Use proper type instead of any
  };
  fonts: {
    key: string;
    value: ArrayBuffer | FontEntry;
  };
}

export interface OfflineRegionOptions {
  /**
   * Region ID (unique for each region, used as the key in the regions table)
   */
  id: string;
  name: string,
  bounds: [[number, number], [number, number]]; // [[west, south], [east, north]]
  multipleRegions?: boolean;
  styleUrl?: string;
  minZoom: number;
  maxZoom: number;
  styleId?: string;
  downloadId?: string;
  created?: number;
  updated?: number;
  /**
   * Expiry timestamp (ms since epoch)
   */
  expiry?: number;
  /**
   * Whether to automatically delete this region when it expires (default: false)
   */
  deleteOnExpiry?: boolean;
}

// StyleEntry type for offline style management
export type StyleEntry = {
  key: string;
  style: MapboxStyle;
  regions: OfflineRegionOptions[];
  fonts: string[];
  glyphs: string[];
  sprites: string[];
};

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

// Font entry stored in the fonts table
export interface FontEntry {
  key: string;
  data: ArrayBuffer;
  downloadedAt: string;
  size: number;
  type: string;
  url: string;
  originalUrl: string;
}