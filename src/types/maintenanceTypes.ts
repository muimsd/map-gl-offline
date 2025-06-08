import { TileStats } from '../services/tileService';
import { EnhancedFontStats } from '../services/fontService';
import { EnhancedSpriteStats } from '../services/spriteService';
import { EnhancedGlyphStats } from '../services/glyphService';
import { RegionAnalytics, CleanupResult } from '../services/cleanupService';

// Maintenance Options Type
export interface MaintenanceOptions {
  cleanupExpired?: boolean;
  verifyIntegrity?: boolean;
  optimizeStorage?: boolean;
  generateReport?: boolean;
  onProgress?: (stage: string, progress: number) => void;
}

// Analytics Report Type
export interface StorageAnalyticsReport {
  tiles: TileStats;
  fonts: EnhancedFontStats;
  sprites: EnhancedSpriteStats;
  glyphs: EnhancedGlyphStats;
  regions: RegionAnalytics;
  totalStorageSize: number;
  storageByType: Record<string, number>;
  recommendations: string[];
}

// Maintenance Results Type
export interface MaintenanceResults {
  cleanupResults?: CleanupResult;
  integrityResults?: {
    tiles: { errors: number; fixed: number };
    fonts: { corrupted: number; repaired: number };
    sprites: { corrupted: number; repaired: number };
    glyphs: { corrupted: number; repaired: number };
  };
  optimizationResults?: {
    freedSpace: number;
    optimizedResources: number;
  };
  analyticsReport?: StorageAnalyticsReport;
  totalTimeMs: number;
}
