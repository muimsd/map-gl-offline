import { logger } from '@/utils';
import type {
  StorageAnalyticsReport,
  MaintenanceOptions,
  MaintenanceResults,
  RegionCleanupOptions,
  CleanupResult,
} from '@/types';

const maintenanceLogger = logger.scope('MaintenanceService');

// Re-export types for convenience
export type { MaintenanceOptions, MaintenanceResults } from '@/types/maintenance';

export class MaintenanceService {
  constructor(
    private performSmartCleanup: (options?: RegionCleanupOptions) => Promise<CleanupResult>,
    private listRegions: () => Promise<unknown[]>,
    private verifyAndRepairFonts: (
      styleId: string,
      options?: Record<string, unknown>
    ) => Promise<unknown>,
    private verifyAndRepairSprites: (
      styleId: string,
      options?: Record<string, unknown>
    ) => Promise<unknown>,
    private verifyAndRepairGlyphs: (
      styleId: string,
      options?: Record<string, unknown>
    ) => Promise<unknown>,
    private cleanupOldFonts: (options?: Record<string, unknown>) => Promise<unknown>,
    private cleanupOldSprites: (options?: Record<string, unknown>) => Promise<unknown>,
    private cleanupOldGlyphs: (options?: Record<string, unknown>) => Promise<unknown>,
    private getComprehensiveStorageAnalytics: () => Promise<StorageAnalyticsReport>
  ) {}

  async performCompleteMaintenance(options: MaintenanceOptions = {}): Promise<MaintenanceResults> {
    const startTime = Date.now();
    const results: Partial<MaintenanceResults> = {};
    let currentProgress = 0;
    const totalStages =
      [
        options.cleanupExpired,
        options.verifyIntegrity,
        options.optimizeStorage,
        options.generateReport,
      ].filter(Boolean).length || 1;

    try {
      // Stage 1: Cleanup expired regions
      if (options.cleanupExpired) {
        options.onProgress?.('Cleaning up expired regions', currentProgress / totalStages);
        results.cleanupResults = await this.performSmartCleanup();
        currentProgress++;
      }

      // Stage 2: Verify integrity
      if (options.verifyIntegrity) {
        options.onProgress?.('Verifying resource integrity', currentProgress / totalStages);
        const styles = await this.listRegions();
        const integrityResults = {
          tiles: { errors: 0, fixed: 0 },
          fonts: { corrupted: 0, repaired: 0 },
          sprites: { corrupted: 0, repaired: 0 },
          glyphs: { corrupted: 0, repaired: 0 },
        };

        for (const region of styles) {
          const regionData = region as { styleId?: string; id?: string };
          const styleId = regionData.styleId || regionData.id;
          if (styleId) {
            try {
              const [fontResult, spriteResult, glyphResult] = await Promise.all([
                this.verifyAndRepairFonts(styleId, { removeCorrupted: true }),
                this.verifyAndRepairSprites(styleId, { autoRepair: true }),
                this.verifyAndRepairGlyphs(styleId, { removeCorrupted: true }),
              ]);

              const fontRes = fontResult as {
                verified?: number;
                repaired?: number;
                removed?: number;
              };
              const spriteRes = spriteResult as {
                verified?: number;
                repaired?: number;
                removed?: number;
              };
              const glyphRes = glyphResult as {
                verified?: number;
                repaired?: number;
                removed?: number;
              };

              integrityResults.fonts.corrupted += fontRes.removed || 0;
              integrityResults.fonts.repaired += fontRes.repaired || 0;
              integrityResults.sprites.corrupted += spriteRes.removed || 0;
              integrityResults.sprites.repaired += spriteRes.repaired || 0;
              integrityResults.glyphs.corrupted += glyphRes.removed || 0;
              integrityResults.glyphs.repaired += glyphRes.repaired || 0;
            } catch (error) {
              maintenanceLogger.warn(`Integrity check failed for style ${styleId}:`, error);
            }
          }
        }

        results.integrityResults = integrityResults;
        currentProgress++;
      }

      // Stage 3: Optimize storage
      if (options.optimizeStorage) {
        options.onProgress?.('Optimizing storage', currentProgress / totalStages);
        let totalFreedSpace = 0;
        let optimizedResources = 0;

        const [fontCleanup, spriteCleanup, glyphCleanup] = await Promise.all([
          this.cleanupOldFonts({ maxAge: 30 }), // 30 days
          this.cleanupOldSprites({ maxAge: 30 }),
          this.cleanupOldGlyphs({ maxAge: 30 }),
        ]);

        const fontClean = fontCleanup as { freedSpace?: number; deletedCount?: number };
        const spriteClean = spriteCleanup as { freedSpace?: number; deletedCount?: number };
        const glyphClean = glyphCleanup as { freedSpace?: number; deletedCount?: number };

        totalFreedSpace +=
          (fontClean.freedSpace || 0) +
          (spriteClean.freedSpace || 0) +
          (glyphClean.freedSpace || 0);
        optimizedResources +=
          (fontClean.deletedCount || 0) +
          (spriteClean.deletedCount || 0) +
          (glyphClean.deletedCount || 0);

        results.optimizationResults = {
          freedSpace: totalFreedSpace,
          optimizedResources,
        };
        currentProgress++;
      }

      // Stage 4: Generate comprehensive report
      if (options.generateReport) {
        options.onProgress?.('Generating analytics report', currentProgress / totalStages);
        const analytics = await this.getComprehensiveStorageAnalytics();

        results.analyticsReport = analytics;
        currentProgress++;
      }

      options.onProgress?.('Maintenance complete', 1);

      return {
        ...results,
        totalTimeMs: Date.now() - startTime,
      } as MaintenanceResults;
    } catch (error) {
      maintenanceLogger.error('Maintenance operation failed:', error);
      throw error;
    }
  }
}
