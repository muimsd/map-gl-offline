import { DBSchema } from 'idb';
export interface OfflineMapDB extends DBSchema {
  regions: {
    key: string;
    value: OfflineRegionOptions;
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
    value: any; // Allow storing style entry objects, not just string
  };
  fonts: {
    key: string;
    value: ArrayBuffer;
  };
}

export interface OfflineRegionOptions {
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
}

// StyleEntry type for offline style management
export type StyleEntry = {
  key: string;
  style: any;
  regions: any[];
  fonts: string[];
  glyphs: string[];
  sprites: string[];
};