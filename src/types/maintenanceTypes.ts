import { TileStats } from '../map/tileDownloader';
import { EnhancedFontStats } from '../map/fontManager';
import { EnhancedSpriteStats } from '../map/spriteManager';
import { EnhancedGlyphStats } from '../map/glyphManager';
import { RegionAnalytics, CleanupResult } from '../map/regionCleanup';

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
