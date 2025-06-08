export interface RegionCleanupOptions {
  maxAge?: number; // Days
  maxStorageSize?: number; // Bytes
  maxRegions?: number; // Maximum number of regions to keep
  priorityPatterns?: string[]; // Region ID patterns to preserve
  onProgress?: (progress: {
    phase: 'scanning' | 'analyzing' | 'cleaning';
    completed: number;
    total: number;
    message: string;
  }) => void;
}

export interface CleanupResult {
  scannedRegions: number;
  expiredRegions: number;
  deletedRegions: number;
  preservedRegions: number;
  freedSpace: number;
  errors: string[];
  recommendations: string[];
}

export interface RegionAnalytics {
  totalRegions: number;
  totalSize: number;
  averageSize: number;
  oldestRegion?: { id: string; created: number };
  newestRegion?: { id: string; created: number };
  largestRegion?: { id: string; size: number };
  smallestRegion?: { id: string; size: number };
  regionsByStyle: Record<string, number>;
  expiryDistribution: {
    expired: number;
    expiringWithin24h: number;
    expiringWithin7d: number;
    neverExpiring: number;
  };
}
