// Glyph entry stored in the glyphs table
export interface GlyphEntry {
  key: string;
  data: ArrayBuffer;
  lastModified: number;
  downloadedAt: string;
  size: number;
  url: string;
}


// Enhanced glyph interfaces
export interface GlyphRange {
  start: number;
  end: number;
  data: ArrayBuffer;
  contentType?: string;
}

export interface LocalGlyphEntry {
  key: string; // Format: fontstack/range
  fontstack: string;
  range: string;
  data: ArrayBuffer;
  contentType: string;
  size: number;
  lastModified: number;
  metadata?: {
    unicodeRange: string;
    glyphCount: number;
    compressionRatio?: number;
  };
}

export interface GlyphDownloadOptions {
  maxConcurrency?: number;
  retries?: number;
  timeout?: number;
  onProgress?: (progress: { completed: number; total: number; currentFont: string }) => void;
  includeMetadata?: boolean;
  enableValidation?: boolean;
  priorityFonts?: string[];
}

export interface GlyphDownloadResult {
  totalGlyphs: number;
  downloadedGlyphs: number;
  skippedGlyphs: number;
  failedGlyphs: number;
  totalSize: number;
  downloadSpeed: number;
  duration: number;
  errors: string[];
  analytics: {
    fontsByStack: Record<string, number>;
    averageGlyphSize: number;
    largestGlyph: { fontstack: string; range: string; size: number };
    smallestGlyph: { fontstack: string; range: string; size: number };
  };
}
