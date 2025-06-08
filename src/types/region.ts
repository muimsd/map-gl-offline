export interface StoredRegion extends OfflineRegionOptions {
  key: string;
  styleId: string;
  created: number;
  expiry: number;
  lastModified: number;
}

export interface OfflineRegionOptions {
  /**
   * Region ID (unique for each region, used as the key in the regions table)
   */
  id: string;
  name: string;
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
