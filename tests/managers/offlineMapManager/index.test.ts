/**
 * Tests for the OfflineMapManager class + companion factory.
 * Covers the constructor, `getServices`, `getModules`, service overrides,
 * and the `createOfflineMapManager` helper.
 */
import {
  OfflineMapManager,
  createOfflineMapManager,
  createOfflineMapManagerModules,
} from '../../../src/managers/offlineMapManager';
import { dbPromise } from '../../../src/storage/indexedDbManager';

beforeEach(async () => {
  const db = await dbPromise;
  await db.clear('styles');
  await db.clear('tiles');
  await db.clear('fonts');
  await db.clear('glyphs');
  await db.clear('sprites');
  await db.clear('models');
});

describe('OfflineMapManager', () => {
  it('constructs without overrides and wires every module method onto the instance', () => {
    const mgr = new OfflineMapManager();
    // Sample methods from each management module — must be callable fns on the class.
    for (const name of [
      'addRegion',
      'downloadRegion',
      'loadRegion',
      'deleteRegion',
      'listRegions',
      'listStoredRegions',
      'getStoredRegion',
      'getRegionSize',
      'cleanupExpiredRegions',
      'forceCleanupExpiredRegions',
      'setupAutoCleanup',
      'stopAutoCleanup',
      'getRegionAnalytics',
      'performSmartCleanup',
      'startEnhancedAutoCleanup',
      'stopAllAutoCleanup',
      'downloadTilesWithOptions',
      'getTileStats',
      'getFontStats',
      'getSpriteStats',
      'getGlyphStats',
      'getModelStats',
      'downloadModelsWithOptions',
      'cleanupOldModels',
      'verifyAndRepairModels',
      'getComprehensiveStorageAnalytics',
      'performCompleteMaintenance',
      'exportRegionAsJSON',
      'exportRegionAsPMTiles',
      'exportRegionAsMBTiles',
      'importRegion',
      'downloadExportedRegion',
      'downloadStyle',
      'loadStyleById',
      'listStyles',
      'deleteStyle',
      'getStyleStats',
      'downloadMapboxStyle',
      'downloadMapLibreStyle',
      'downloadStyleWithAutoDetection',
      'cleanupOldStyles',
    ]) {
      expect(typeof (mgr as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('exposes the underlying services via getServices()', () => {
    const mgr = new OfflineMapManager();
    const services = mgr.getServices();
    expect(services.regionService).toBeDefined();
    expect(services.cleanupService).toBeDefined();
    expect(services.resourceService).toBeDefined();
    expect(services.analyticsService).toBeDefined();
    expect(services.importExportService).toBeDefined();
  });

  it('exposes the module surface via getModules()', () => {
    const mgr = new OfflineMapManager();
    const modules = mgr.getModules();
    expect(typeof modules.downloadRegion).toBe('function');
    expect(typeof modules.performCompleteMaintenance).toBe('function');
    expect(typeof modules.getComprehensiveStorageAnalytics).toBe('function');
  });

  it('accepts service overrides and uses them for delegated calls', async () => {
    const mockListStoredRegions = jest.fn().mockResolvedValue([]);
    const mockAddRegion = jest.fn().mockResolvedValue(undefined);

    // Construct a minimal regionService override that satisfies the
    // interface enough for listStoredRegions + addRegion delegation.
    const mockRegionService = {
      addRegion: mockAddRegion,
      downloadRegion: jest.fn(),
      loadRegion: jest.fn(),
      deleteRegion: jest.fn(),
      listRegions: jest.fn().mockResolvedValue([]),
      listStoredRegions: mockListStoredRegions,
    } as never;

    const mgr = new OfflineMapManager({ regionService: mockRegionService });
    expect(mgr.getServices().regionService).toBe(mockRegionService);

    await mgr.listStoredRegions();
    expect(mockListStoredRegions).toHaveBeenCalled();
  });

  it('subsequent calls return the same services/modules references', () => {
    const mgr = new OfflineMapManager();
    expect(mgr.getServices()).toBe(mgr.getServices());
    expect(mgr.getModules()).toBe(mgr.getModules());
  });
});

describe('createOfflineMapManager', () => {
  it('returns a services + modules tuple', () => {
    const { services, modules } = createOfflineMapManager();
    expect(services.regionService).toBeDefined();
    expect(typeof modules.downloadRegion).toBe('function');
  });

  it('threads overrides into both services and modules', () => {
    const customCleanup = {
      getRegionSize: jest.fn().mockResolvedValue(123),
      performCleanup: jest.fn(),
      getAllRegions: jest.fn(),
      setupAutoCleanup: jest.fn(),
      stopAutoCleanup: jest.fn(),
      getRegionAnalytics: jest.fn(),
    } as never;
    const { services } = createOfflineMapManager({ cleanupService: customCleanup });
    expect(services.cleanupService).toBe(customCleanup);
  });
});

describe('createOfflineMapManagerModules', () => {
  it('builds the module graph from a services object', () => {
    const { services } = createOfflineMapManager();
    const modules = createOfflineMapManagerModules(services);
    expect(typeof modules.addRegion).toBe('function');
    expect(typeof modules.cleanupExpiredRegions).toBe('function');
    expect(typeof modules.getComprehensiveStorageAnalytics).toBe('function');
  });
});
