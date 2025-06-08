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
