// Glyph entry stored in the glyphs table
export interface GlyphEntry {
  key: string;
  data: ArrayBuffer;
  lastModified: number;
  downloadedAt: string;
  size: number;
  url: string;
}
