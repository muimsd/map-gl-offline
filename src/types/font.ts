// Font entry stored in the fonts table
export interface FontEntry {
  key: string;
  data: ArrayBuffer;
  downloadedAt: string;
  size: number;
  type: string;
  url: string;
  originalUrl: string;
  lastModified: number;
  contentType: string;
  downloadId?: string;
  metadata?: {
    userAgent?: string;
    downloadTimestamp?: number;
  };
}
