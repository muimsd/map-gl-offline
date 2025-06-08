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
