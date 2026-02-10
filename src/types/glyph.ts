/**
 * Glyph entry stored in IndexedDB
 */
export interface GlyphEntry {
  /** Unique identifier for the glyph (e.g., "Roboto-Regular/0-255") */
  key: string;
  /** Raw glyph data (PBF format) in ArrayBuffer format */
  data: ArrayBuffer;
  /** Last-Modified timestamp from HTTP headers (milliseconds since epoch) */
  lastModified: number;
  /** ISO 8601 timestamp when glyph was downloaded */
  downloadedAt: string;
  /** Glyph file size in bytes */
  size: number;
  /** Final URL used for download */
  url: string;
  /** Optional identifier linking glyph to a style */
  styleId?: string;
  /** Font stack name (e.g., "Roboto-Regular", "Arial Unicode MS Bold") */
  fontstack?: string;
  /** Unicode range (e.g., "0-255", "256-511") */
  range?: string;
  /** Expiry timestamp (ms since epoch) based on HTTP Cache-Control/Expires headers */
  expires?: number;
}

/**
 * Glyph range data
 */
export interface GlyphRange {
  /** Starting Unicode code point */
  start: number;
  /** Ending Unicode code point */
  end: number;
  /** Raw glyph data in ArrayBuffer format */
  data: ArrayBuffer;
  /** MIME type (typically "application/x-protobuf") */
  contentType?: string;
}

/**
 * Local glyph entry with extended metadata
 */
export interface LocalGlyphEntry {
  /** Unique identifier (format: "fontstack/range") */
  key: string;
  /** Font stack name */
  fontstack: string;
  /** Unicode range string */
  range: string;
  /** Raw glyph data in ArrayBuffer format */
  data: ArrayBuffer;
  /** MIME type */
  contentType: string;
  /** Glyph file size in bytes */
  size: number;
  /** Last modification timestamp (milliseconds since epoch) */
  lastModified: number;
  /** Extended metadata */
  metadata?: {
    /** Unicode range description (e.g., "Basic Latin") */
    unicodeRange: string;
    /** Number of glyphs in this range */
    glyphCount: number;
    /** Compression ratio if compressed */
    compressionRatio?: number;
  };
}

/**
 * Configuration options for glyph downloads
 */
export interface GlyphDownloadOptions {
  /** Maximum number of concurrent downloads (default: 5) */
  maxConcurrency?: number;
  /** Maximum retry attempts for failed downloads (default: 3) */
  retries?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback for progress updates */
  onProgress?: (progress: { completed: number; total: number; currentFont: string }) => void;
  /** Include additional metadata in stored glyphs (default: false) */
  includeMetadata?: boolean;
  /** Validate glyph data after download (default: true) */
  enableValidation?: boolean;
  /** Array of font stacks to prioritize */
  priorityFonts?: string[];
}

/**
 * Result of a glyph download operation
 */
export interface GlyphDownloadResult {
  /** Total number of glyphs in download plan */
  totalGlyphs: number;
  /** Number of glyphs successfully downloaded */
  downloadedGlyphs: number;
  /** Number of glyphs skipped (already existed) */
  skippedGlyphs: number;
  /** Number of glyphs that failed to download */
  failedGlyphs: number;
  /** Total size of all downloaded glyphs in bytes */
  totalSize: number;
  /** Average download speed in bytes per second */
  downloadSpeed: number;
  /** Total download time in milliseconds */
  duration: number;
  /** Array of error details for failed downloads */
  errors: Array<{ url: string; error: string }>;
  /** Detailed analytics about downloaded glyphs */
  analytics: {
    /** Distribution by font stack */
    fontsByStack: Record<string, number>;
    /** Average glyph size in bytes */
    averageGlyphSize: number;
    /** Largest glyph details */
    largestGlyph: { fontstack: string; range: string; size: number };
    /** Smallest glyph details */
    smallestGlyph: { fontstack: string; range: string; size: number };
  };
}
