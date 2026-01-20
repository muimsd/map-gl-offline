/**
 * Tests for Maintenance Service
 */
import { MaintenanceService } from '../../src/services/maintenanceService';

describe('MaintenanceService', () => {
  // Create mock functions
  const mockPerformSmartCleanup = jest.fn().mockResolvedValue({
    scannedRegions: 0,
    expiredRegions: 0,
    deletedRegions: 0,
    preservedRegions: 0,
    freedSpace: 0,
    errors: [],
    recommendations: [],
  });

  const mockListRegions = jest.fn().mockResolvedValue([]);

  const mockVerifyAndRepairFonts = jest.fn().mockResolvedValue({
    corruptedFonts: 0,
    removedFonts: 0,
  });

  const mockVerifyAndRepairSprites = jest.fn().mockResolvedValue({
    corruptedSprites: 0,
    repairedSprites: 0,
  });

  const mockVerifyAndRepairGlyphs = jest.fn().mockResolvedValue({
    corruptedGlyphs: 0,
    repairedGlyphs: 0,
  });

  const mockCleanupOldFonts = jest.fn().mockResolvedValue({
    freedSpace: 0,
    deletedCount: 0,
  });

  const mockCleanupOldSprites = jest.fn().mockResolvedValue({
    freedSpace: 0,
    deletedCount: 0,
  });

  const mockCleanupOldGlyphs = jest.fn().mockResolvedValue({
    freedSpace: 0,
    deletedCount: 0,
  });

  const mockGetComprehensiveStorageAnalytics = jest.fn().mockResolvedValue({
    tiles: { count: 0, totalSize: 0 },
    fonts: { count: 0, totalSize: 0 },
    sprites: { count: 0, totalSize: 0 },
    glyphs: { count: 0, totalSize: 0 },
    regions: { totalRegions: 0, totalSize: 0 },
    totalStorageSize: 0,
    storageByType: {},
    recommendations: [],
  });

  let service: MaintenanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MaintenanceService(
      mockPerformSmartCleanup,
      mockListRegions,
      mockVerifyAndRepairFonts,
      mockVerifyAndRepairSprites,
      mockVerifyAndRepairGlyphs,
      mockCleanupOldFonts,
      mockCleanupOldSprites,
      mockCleanupOldGlyphs,
      mockGetComprehensiveStorageAnalytics
    );
  });

  describe('performCompleteMaintenance', () => {
    it('should return results with totalTimeMs when no options provided', async () => {
      const results = await service.performCompleteMaintenance();

      expect(results).toHaveProperty('totalTimeMs');
      expect(typeof results.totalTimeMs).toBe('number');
      expect(results.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should run cleanup when cleanupExpired is true', async () => {
      const results = await service.performCompleteMaintenance({
        cleanupExpired: true,
      });

      expect(mockPerformSmartCleanup).toHaveBeenCalled();
      expect(results).toHaveProperty('cleanupResults');
    });

    it('should verify integrity when verifyIntegrity is true', async () => {
      mockListRegions.mockResolvedValueOnce([
        { id: 'region-1', styleId: 'style-1' },
      ]);

      const results = await service.performCompleteMaintenance({
        verifyIntegrity: true,
      });

      expect(mockListRegions).toHaveBeenCalled();
      expect(mockVerifyAndRepairFonts).toHaveBeenCalled();
      expect(mockVerifyAndRepairSprites).toHaveBeenCalled();
      expect(mockVerifyAndRepairGlyphs).toHaveBeenCalled();
      expect(results).toHaveProperty('integrityResults');
    });

    it('should optimize storage when optimizeStorage is true', async () => {
      const results = await service.performCompleteMaintenance({
        optimizeStorage: true,
      });

      expect(mockCleanupOldFonts).toHaveBeenCalled();
      expect(mockCleanupOldSprites).toHaveBeenCalled();
      expect(mockCleanupOldGlyphs).toHaveBeenCalled();
      expect(results).toHaveProperty('optimizationResults');
      expect(results.optimizationResults).toHaveProperty('freedSpace');
      expect(results.optimizationResults).toHaveProperty('optimizedResources');
    });

    it('should generate report when generateReport is true', async () => {
      const results = await service.performCompleteMaintenance({
        generateReport: true,
      });

      expect(mockGetComprehensiveStorageAnalytics).toHaveBeenCalled();
      expect(results).toHaveProperty('analyticsReport');
    });

    it('should run all stages when all options are true', async () => {
      const results = await service.performCompleteMaintenance({
        cleanupExpired: true,
        verifyIntegrity: true,
        optimizeStorage: true,
        generateReport: true,
      });

      expect(mockPerformSmartCleanup).toHaveBeenCalled();
      expect(mockListRegions).toHaveBeenCalled();
      expect(mockCleanupOldFonts).toHaveBeenCalled();
      expect(mockGetComprehensiveStorageAnalytics).toHaveBeenCalled();

      expect(results).toHaveProperty('cleanupResults');
      expect(results).toHaveProperty('integrityResults');
      expect(results).toHaveProperty('optimizationResults');
      expect(results).toHaveProperty('analyticsReport');
    });

    it('should call onProgress callback during maintenance', async () => {
      const progressMessages: string[] = [];
      const progressValues: number[] = [];

      await service.performCompleteMaintenance({
        cleanupExpired: true,
        onProgress: (message, progress) => {
          progressMessages.push(message);
          progressValues.push(progress);
        },
      });

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages).toContain('Cleaning up expired regions');
      expect(progressMessages).toContain('Maintenance complete');
    });

    it('should handle errors during integrity verification', async () => {
      mockListRegions.mockResolvedValueOnce([
        { id: 'region-1', styleId: 'style-1' },
      ]);
      mockVerifyAndRepairFonts.mockRejectedValueOnce(new Error('Font verification failed'));

      // Should not throw, just log warning
      const results = await service.performCompleteMaintenance({
        verifyIntegrity: true,
      });

      expect(results).toHaveProperty('integrityResults');
    });

    it('should aggregate integrity results from multiple regions', async () => {
      mockListRegions.mockResolvedValueOnce([
        { id: 'region-1', styleId: 'style-1' },
        { id: 'region-2', styleId: 'style-2' },
      ]);

      mockVerifyAndRepairFonts
        .mockResolvedValueOnce({ corruptedFonts: 1, removedFonts: 1 })
        .mockResolvedValueOnce({ corruptedFonts: 2, removedFonts: 0 });

      const results = await service.performCompleteMaintenance({
        verifyIntegrity: true,
      });

      expect(results.integrityResults?.fonts.corrupted).toBe(3);
      expect(results.integrityResults?.fonts.repaired).toBe(1);
    });

    it('should aggregate optimization results', async () => {
      mockCleanupOldFonts.mockResolvedValueOnce({ freedSpace: 100, deletedCount: 5 });
      mockCleanupOldSprites.mockResolvedValueOnce({ freedSpace: 200, deletedCount: 10 });
      mockCleanupOldGlyphs.mockResolvedValueOnce({ freedSpace: 50, deletedCount: 2 });

      const results = await service.performCompleteMaintenance({
        optimizeStorage: true,
      });

      expect(results.optimizationResults?.freedSpace).toBe(350);
      expect(results.optimizationResults?.optimizedResources).toBe(17);
    });
  });
});
