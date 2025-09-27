import type {
  StorageAnalyticsReport,
  MaintenanceOptions,
  MaintenanceResults,
  RegionCleanupOptions,
  CleanupResult,
} from '../types';

// Re-export types for convenience
export type { MaintenanceOptions, MaintenanceResults } from '../types/maintenance';

export class MaintenanceService {
  constructor(
    private performSmartCleanup: (options?: RegionCleanupOptions) => Promise<CleanupResult>,
    private listRegions: () => Promise<any[]>,
    private verifyAndRepairFonts: (styleId: string, options?: any) => Promise<any>,
    private verifyAndRepairSprites: (styleId: string, options?: any) => Promise<any>,
    private verifyAndRepairGlyphs: (styleId: string, options?: any) => Promise<any>,
    private cleanupOldFonts: (options?: any) => Promise<any>,
    private cleanupOldSprites: (styleId: string, options?: any) => Promise<any>,
    private cleanupOldGlyphs: (options?: any) => Promise<any>,
    private getComprehensiveStorageAnalytics: () => Promise<StorageAnalyticsReport>
  ) {}

  async performCompleteMaintenance(options: MaintenanceOptions = {}): Promise<MaintenanceResults> {
    const startTime = Date.now();
    const results: Partial<MaintenanceResults> = {};
    let currentProgress = 0;
    const totalStages = Object.values(options).filter(Boolean).length;

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
          const styleId = region.styleId || region.id;
          if (styleId) {
            try {
              const [fontResult, spriteResult, glyphResult] = await Promise.all([
                this.verifyAndRepairFonts(styleId, { removeCorrupted: true }),
                this.verifyAndRepairSprites(styleId, { autoRepair: true }),
                this.verifyAndRepairGlyphs(styleId, { removeCorrupted: true }),
              ]);

              integrityResults.fonts.corrupted += fontResult.corruptedFonts;
              integrityResults.fonts.repaired += fontResult.removedFonts;
              integrityResults.sprites.corrupted += spriteResult.corruptedSprites;
              integrityResults.sprites.repaired += spriteResult.repairedSprites;
              integrityResults.glyphs.corrupted += glyphResult.corruptedGlyphs;
              integrityResults.glyphs.repaired += glyphResult.repairedGlyphs;
            } catch (error) {
              console.warn(`Integrity check failed for style ${styleId}:`, error);
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
          this.cleanupOldFonts({ maxAge: 30 * 24 * 60 * 60 * 1000 }), // 30 days
          this.cleanupOldSprites('', { maxAge: 30 * 24 * 60 * 60 * 1000 }),
          this.cleanupOldGlyphs({ maxAge: 30 * 24 * 60 * 60 * 1000 }),
        ]);

        totalFreedSpace +=
          fontCleanup.freedSpace + spriteCleanup.freedSpace + glyphCleanup.freedSpace;
        optimizedResources +=
          fontCleanup.deletedCount + spriteCleanup.deletedCount + glyphCleanup.deletedCount;

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
      console.error('Maintenance operation failed:', error);
      throw error;
    }
  }
}
