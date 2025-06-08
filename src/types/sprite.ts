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
