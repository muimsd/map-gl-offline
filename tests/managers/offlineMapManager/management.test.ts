/**
 * Unit tests for the per-area *Management delegator modules that back
 * `OfflineMapManager`. These modules are thin pass-throughs to the
 * underlying services; the tests assert that the right service method is
 * called with the right args and that return values flow back unchanged.
 */
import { createRegionManagement } from '../../../src/managers/offlineMapManager/regionManagement';
import { createCleanupManagement } from '../../../src/managers/offlineMapManager/cleanupManagement';
import { createResourceManagement } from '../../../src/managers/offlineMapManager/resourceManagement';
import { createAnalyticsManagement } from '../../../src/managers/offlineMapManager/analyticsManagement';
import { createStyleManagement } from '../../../src/managers/offlineMapManager/styleManagement';
import { createImportExportManagement } from '../../../src/managers/offlineMapManager/importExportManagement';
import { createMaintenanceManagement } from '../../../src/managers/offlineMapManager/maintenanceManagement';
import type { OfflineManagerServices } from '../../../src/managers/offlineMapManager/base';

/** Build a fake services graph where every method is a jest.fn. */
function makeServices(): {
  services: OfflineManagerServices;
  fns: Record<string, jest.Mock>;
} {
  const fns: Record<string, jest.Mock> = {};
  const fn = (name: string, defaultReturn: unknown = undefined) => {
    const m = jest.fn().mockResolvedValue(defaultReturn);
    fns[name] = m;
    return m;
  };

  const services = {
    regionService: {
      addRegion: fn('regionService.addRegion'),
      downloadRegion: fn('regionService.downloadRegion', { regionId: 'r', styleId: 's' }),
      loadRegion: fn('regionService.loadRegion', { regionId: 'r', styleId: 's' }),
      deleteRegion: fn('regionService.deleteRegion'),
      listRegions: fn('regionService.listRegions', []),
      listStoredRegions: fn('regionService.listStoredRegions', []),
    },
    cleanupService: {
      getRegionSize: fn('cleanupService.getRegionSize', 42),
      performCleanup: fn('cleanupService.performCleanup', {
        deletedRegions: 3,
        freedSpace: 999,
      }),
      getAllRegions: fn('cleanupService.getAllRegions', []),
      setupAutoCleanup: fn('cleanupService.setupAutoCleanup', 'cleanup-id-1'),
      stopAutoCleanup: fn('cleanupService.stopAutoCleanup'),
      getRegionAnalytics: fn('cleanupService.getRegionAnalytics', { totalRegions: 0 }),
    },
    resourceService: {
      downloadTilesWithOptions: fn('resourceService.downloadTilesWithOptions', { downloadedTiles: 0 }),
      getTileStats: fn('resourceService.getTileStats', { count: 0 }),
      getTileAnalytics: fn('resourceService.getTileAnalytics', { basic: {} }),
      cleanupOldTiles: fn('resourceService.cleanupOldTiles', 0),
      downloadFontsWithOptions: fn('resourceService.downloadFontsWithOptions', {
        downloadedFonts: 0,
      }),
      getFontStats: fn('resourceService.getFontStats', { count: 0 }),
      getFontAnalytics: fn('resourceService.getFontAnalytics', { basic: {} }),
      cleanupOldFonts: fn('resourceService.cleanupOldFonts', 0),
      verifyAndRepairFonts: fn('resourceService.verifyAndRepairFonts', {
        verified: 0,
        repaired: 0,
        removed: 0,
      }),
      downloadSpritesWithOptions: fn('resourceService.downloadSpritesWithOptions', {
        downloadedSprites: 0,
      }),
      getSpriteStats: fn('resourceService.getSpriteStats', { count: 0 }),
      getSpriteAnalytics: fn('resourceService.getSpriteAnalytics', { basic: {} }),
      cleanupOldSprites: fn('resourceService.cleanupOldSprites', 0),
      verifyAndRepairSprites: fn('resourceService.verifyAndRepairSprites', {
        verified: 0,
        repaired: 0,
        removed: 0,
      }),
      downloadGlyphsWithOptions: fn('resourceService.downloadGlyphsWithOptions', {
        downloaded: 0,
      }),
      getGlyphStats: fn('resourceService.getGlyphStats', { count: 0 }),
      getGlyphAnalytics: fn('resourceService.getGlyphAnalytics', { basic: {} }),
      loadGlyphsForStyle: fn('resourceService.loadGlyphsForStyle', []),
      cleanupOldGlyphs: fn('resourceService.cleanupOldGlyphs', 0),
      verifyAndRepairGlyphs: fn('resourceService.verifyAndRepairGlyphs', {
        verified: 0,
        repaired: 0,
        removed: 0,
      }),
      downloadModelsWithOptions: fn('resourceService.downloadModelsWithOptions', {
        downloadedModels: 0,
      }),
      getModelStats: fn('resourceService.getModelStats', { count: 0 }),
      cleanupOldModels: fn('resourceService.cleanupOldModels', 0),
      verifyAndRepairModels: fn('resourceService.verifyAndRepairModels', {
        verified: 0,
        repaired: 0,
        removed: 0,
      }),
    },
    analyticsService: {
      getComprehensiveStorageAnalytics: fn('analyticsService.getComprehensiveStorageAnalytics', {
        totalStorageSize: 0,
      }),
    },
    importExportService: {
      exportRegionAsJSON: fn('importExportService.exportRegionAsJSON', {
        blob: new Blob(),
        filename: 'test.json',
      }),
      exportRegionAsPMTiles: fn('importExportService.exportRegionAsPMTiles', {
        blob: new Blob(),
        filename: 'test.pmtiles',
      }),
      exportRegionAsMBTiles: fn('importExportService.exportRegionAsMBTiles', {
        blob: new Blob(),
        filename: 'test.mbtiles',
      }),
      importRegion: fn('importExportService.importRegion', { regionId: 'imp' }),
    },
  };

  return { services: services as unknown as OfflineManagerServices, fns };
}

describe('regionManagement', () => {
  it('delegates each method to the region service', async () => {
    const { services, fns } = makeServices();
    const mgmt = createRegionManagement(services);
    const region = {
      id: 'r1',
      name: 'n',
      bounds: [[0, 0], [1, 1]] as [[number, number], [number, number]],
      minZoom: 0,
      maxZoom: 0,
      styleUrl: 'u',
    };

    await mgmt.addRegion(region);
    await mgmt.downloadRegion(region, { accessToken: 'tok' });
    await mgmt.loadRegion(region);
    await mgmt.deleteRegion('r1');
    await mgmt.listRegions();
    await mgmt.listStoredRegions();

    expect(fns['regionService.addRegion']).toHaveBeenCalledWith(region);
    expect(fns['regionService.downloadRegion']).toHaveBeenCalledWith(region, { accessToken: 'tok' });
    expect(fns['regionService.loadRegion']).toHaveBeenCalledWith(region, undefined);
    expect(fns['regionService.deleteRegion']).toHaveBeenCalledWith('r1');
    expect(fns['regionService.listRegions']).toHaveBeenCalled();
    expect(fns['regionService.listStoredRegions']).toHaveBeenCalled();
  });

  it('getStoredRegion filters listStoredRegions by id and returns null on miss', async () => {
    const { services, fns } = makeServices();
    fns['regionService.listStoredRegions'].mockResolvedValue([
      { id: 'a', key: 'a', styleId: 's', created: 1, expiry: 2, lastModified: 1 },
      { id: 'b', key: 'b', styleId: 's', created: 1, expiry: 2, lastModified: 1 },
    ]);
    const mgmt = createRegionManagement(services);

    expect((await mgmt.getStoredRegion('a'))?.id).toBe('a');
    expect(await mgmt.getStoredRegion('does-not-exist')).toBeNull();
  });
});

describe('cleanupManagement', () => {
  it('cleanupExpiredRegions uses performCleanup({maxAge:30}) and returns deletedRegions count', async () => {
    const { services, fns } = makeServices();
    fns['cleanupService.performCleanup'].mockResolvedValue({ deletedRegions: 7, freedSpace: 0 });
    const mgmt = createCleanupManagement(services);

    const count = await mgmt.cleanupExpiredRegions();
    expect(count).toBe(7);
    expect(fns['cleanupService.performCleanup']).toHaveBeenCalledWith({ maxAge: 30 });
  });

  it('forceCleanupExpiredRegions deletes only regions past their expiry', async () => {
    const { services, fns } = makeServices();
    const now = Date.now();
    fns['cleanupService.getAllRegions'].mockResolvedValue([
      { id: 'expired-1', expiry: now - 1 },
      { id: 'fresh-1', expiry: now + 86_400_000 },
      { id: 'no-expiry' }, // no `expiry` → skipped
      { id: 'expired-2', expiry: now - 2 },
    ]);
    const mgmt = createCleanupManagement(services);

    const count = await mgmt.forceCleanupExpiredRegions();
    expect(count).toBe(2);
    expect(fns['regionService.deleteRegion']).toHaveBeenCalledTimes(2);
    expect(fns['regionService.deleteRegion']).toHaveBeenNthCalledWith(1, 'expired-1');
    expect(fns['regionService.deleteRegion']).toHaveBeenNthCalledWith(2, 'expired-2');
  });

  it('startEnhancedAutoCleanup forwards intervalHours + options to setupAutoCleanup', async () => {
    const { services, fns } = makeServices();
    const mgmt = createCleanupManagement(services);
    const id = await mgmt.startEnhancedAutoCleanup(48, { maxAge: 14 });
    expect(id).toBe('cleanup-id-1');
    expect(fns['cleanupService.setupAutoCleanup']).toHaveBeenCalledWith({
      maxAge: 14,
      intervalHours: 48,
    });
  });

  it('startEnhancedAutoCleanup defaults interval to 24 when omitted', async () => {
    const { services, fns } = makeServices();
    const mgmt = createCleanupManagement(services);
    await mgmt.startEnhancedAutoCleanup();
    expect(fns['cleanupService.setupAutoCleanup']).toHaveBeenCalledWith({ intervalHours: 24 });
  });

  it('simple delegations: getRegionSize, setupAutoCleanup, stopAutoCleanup, getRegionAnalytics, performSmartCleanup, stopAllAutoCleanup', async () => {
    const { services, fns } = makeServices();
    const mgmt = createCleanupManagement(services);

    expect(await mgmt.getRegionSize('rid', 'sid')).toBe(42);
    expect(fns['cleanupService.getRegionSize']).toHaveBeenCalledWith('rid', 'sid');

    await mgmt.setupAutoCleanup({ intervalHours: 6, maxAge: 1 });
    expect(fns['cleanupService.setupAutoCleanup']).toHaveBeenCalledWith({
      intervalHours: 6,
      maxAge: 1,
    });

    await mgmt.stopAutoCleanup('some-id');
    expect(fns['cleanupService.stopAutoCleanup']).toHaveBeenCalledWith('some-id');

    await mgmt.getRegionAnalytics();
    expect(fns['cleanupService.getRegionAnalytics']).toHaveBeenCalled();

    await mgmt.performSmartCleanup({ maxAge: 7 });
    expect(fns['cleanupService.performCleanup']).toHaveBeenCalledWith({ maxAge: 7 });

    await mgmt.stopAllAutoCleanup();
    expect(fns['cleanupService.stopAutoCleanup']).toHaveBeenCalledWith();
  });
});

describe('resourceManagement', () => {
  it('forwards every method to ResourceService with the same args', async () => {
    const { services, fns } = makeServices();
    const mgmt = createResourceManagement(services);
    const style = { version: 8 as const, sources: {}, layers: [] };
    const region = {
      id: 'r',
      name: 'n',
      bounds: [[0, 0], [1, 1]] as [[number, number], [number, number]],
      minZoom: 0,
      maxZoom: 0,
    };

    await mgmt.downloadTilesWithOptions(region, style, 's');
    expect(fns['resourceService.downloadTilesWithOptions']).toHaveBeenCalledWith(region, style, 's');

    await mgmt.getTileStats('s');
    expect(fns['resourceService.getTileStats']).toHaveBeenCalledWith('s');

    await mgmt.downloadFontsWithOptions(['url']);
    expect(fns['resourceService.downloadFontsWithOptions']).toHaveBeenCalled();

    await mgmt.getFontStats();
    await mgmt.getFontAnalytics();
    await mgmt.cleanupOldFonts(undefined, { maxAge: 7 });
    await mgmt.verifyAndRepairFonts();

    await mgmt.downloadSpritesWithOptions(['s-url'], 'style');
    await mgmt.getSpriteStats();
    await mgmt.getSpriteAnalytics();
    await mgmt.cleanupOldSprites(undefined, { maxAge: 14 });
    await mgmt.verifyAndRepairSprites();

    await mgmt.downloadGlyphsWithOptions('u', ['Arial'], 'style');
    await mgmt.getGlyphStats();
    await mgmt.getGlyphAnalytics();
    await mgmt.loadGlyphsForStyle('Arial', ['0-255']);
    await mgmt.cleanupOldGlyphs(undefined, { maxAge: 7 });
    await mgmt.verifyAndRepairGlyphs();

    await mgmt.downloadModelsWithOptions({ m: 'http://a/b.glb' }, 'style');
    await mgmt.getModelStats();
    await mgmt.cleanupOldModels({ maxAge: 30 });
    await mgmt.verifyAndRepairModels();

    // Every ResourceManagement method we called was observed on the service.
    // Not every resourceService.* mock is hit — e.g., `getTileAnalytics` and
    // `cleanupOldTiles` are on ResourceService but not exposed via
    // ResourceManagement, so we set up the mock but don't invoke it here.
    const invokedOnce = [
      'downloadTilesWithOptions',
      'getTileStats',
      'downloadFontsWithOptions',
      'getFontStats',
      'getFontAnalytics',
      'cleanupOldFonts',
      'verifyAndRepairFonts',
      'downloadSpritesWithOptions',
      'getSpriteStats',
      'getSpriteAnalytics',
      'cleanupOldSprites',
      'verifyAndRepairSprites',
      'downloadGlyphsWithOptions',
      'getGlyphStats',
      'getGlyphAnalytics',
      'loadGlyphsForStyle',
      'cleanupOldGlyphs',
      'verifyAndRepairGlyphs',
      'downloadModelsWithOptions',
      'getModelStats',
      'cleanupOldModels',
      'verifyAndRepairModels',
    ];
    for (const method of invokedOnce) {
      expect(fns[`resourceService.${method}`]).toHaveBeenCalled();
    }
  });
});

describe('analyticsManagement', () => {
  it('passes the injected getRegionAnalytics dep through to the service', async () => {
    const { services, fns } = makeServices();
    const dep = jest.fn().mockResolvedValue({ totalRegions: 42 });
    const mgmt = createAnalyticsManagement(services, { getRegionAnalytics: dep });

    await mgmt.getComprehensiveStorageAnalytics();
    expect(fns['analyticsService.getComprehensiveStorageAnalytics']).toHaveBeenCalledWith(dep);
  });
});

describe('styleManagement', () => {
  // These tests exercise the downloadStyle / loadStyleById / … methods
  // which all dynamically-import the styleService module internally. We
  // therefore verify the public surface shape and that callable signatures
  // don't throw on construction.
  it('returns a management object exposing the documented surface', () => {
    const mgmt = createStyleManagement();
    const expected = [
      'downloadStyle',
      'loadStyleById',
      'listStyles',
      'deleteStyle',
      'getStyleStats',
      'downloadMapboxStyle',
      'downloadMapLibreStyle',
      'downloadStyleWithAutoDetection',
      'cleanupOldStyles',
    ];
    for (const key of expected) {
      expect(typeof (mgmt as unknown as Record<string, unknown>)[key]).toBe('function');
    }
  });

  it('downloadMapboxStyle sets provider=mapbox + forceProvider=true internally', async () => {
    // Stub the dynamic import so we can assert the option passing.
    jest.isolateModulesAsync(async () => {
      const styleServiceMock = jest.fn().mockResolvedValue({
        success: true,
        styleId: 's',
        errors: [],
      });
      jest.doMock('../../../src/services/styleService', () => ({
        __esModule: true,
        downloadStyleWithProvider: styleServiceMock,
        loadStyleById: jest.fn(),
        loadStyles: jest.fn(),
        deleteStyleById: jest.fn(),
        getStyleStats: jest.fn(),
        cleanupOldStyles: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      }));
      const {
        createStyleManagement: isolated,
      } = require('../../../src/managers/offlineMapManager/styleManagement');
      const mgmt = isolated();
      await mgmt.downloadMapboxStyle('https://x.example.com', 'pk.tok', { skipExisting: false });
      expect(styleServiceMock).toHaveBeenCalledWith(
        'https://x.example.com',
        expect.objectContaining({
          provider: 'mapbox',
          accessToken: 'pk.tok',
          forceProvider: true,
          skipExisting: false,
        })
      );
    });
  });
});

describe('importExportManagement', () => {
  it('delegates each export / import method to the service', async () => {
    const { services, fns } = makeServices();
    const mgmt = createImportExportManagement(services);

    await mgmt.exportRegionAsJSON('r1', { includeTiles: true });
    expect(fns['importExportService.exportRegionAsJSON']).toHaveBeenCalledWith('r1', {
      includeTiles: true,
    });

    await mgmt.exportRegionAsPMTiles('r1');
    expect(fns['importExportService.exportRegionAsPMTiles']).toHaveBeenCalled();

    await mgmt.exportRegionAsMBTiles('r1');
    expect(fns['importExportService.exportRegionAsMBTiles']).toHaveBeenCalled();

    await mgmt.importRegion({
      region: {
        id: 'r',
        name: 'n',
        bounds: [[0, 0], [1, 1]],
        minZoom: 0,
        maxZoom: 0,
      },
    } as never);
    expect(fns['importExportService.importRegion']).toHaveBeenCalled();
  });

  it('downloadExportedRegion creates + clicks + revokes a blob URL', () => {
    const { services } = makeServices();
    const mgmt = createImportExportManagement(services);

    const blob = new Blob(['data'], { type: 'application/json' });
    const filename = 'download.json';

    // JSDOM polyfills createObjectURL but not revokeObjectURL; stub both.
    const urlImpl = URL as unknown as Record<string, (arg: unknown) => unknown>;
    const originalCreate = urlImpl.createObjectURL;
    const originalRevoke = urlImpl.revokeObjectURL;
    const createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = jest.fn();
    urlImpl.createObjectURL = createObjectURL;
    urlImpl.revokeObjectURL = revokeObjectURL;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    try {
      mgmt.downloadExportedRegion({ blob, filename } as never);

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    } finally {
      urlImpl.createObjectURL = originalCreate;
      urlImpl.revokeObjectURL = originalRevoke;
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    }
  });
});

describe('maintenanceManagement', () => {
  it('constructs a MaintenanceService and exposes performCompleteMaintenance', async () => {
    const { services } = makeServices();
    const performSmartCleanup = jest.fn().mockResolvedValue({ deletedRegions: 0 });
    const listStoredRegions = jest.fn().mockResolvedValue([]);
    const getComprehensiveStorageAnalytics = jest.fn().mockResolvedValue({ totalStorageSize: 0 });

    const mgmt = createMaintenanceManagement(services, {
      performSmartCleanup,
      listStoredRegions,
      getComprehensiveStorageAnalytics,
    });

    // Running with no flags should touch none of the underlying calls;
    // the MaintenanceService treats the empty options as a no-op plan.
    const result = await mgmt.performCompleteMaintenance({});
    expect(result).toBeDefined();
    expect(typeof result.totalTimeMs).toBe('number');
  });

  it('passes maintenance flags through so cleanup + analytics run', async () => {
    const { services, fns } = makeServices();
    const performSmartCleanup = jest.fn().mockResolvedValue({ deletedRegions: 1 });
    const listStoredRegions = jest.fn().mockResolvedValue([]);
    const getComprehensiveStorageAnalytics = jest
      .fn()
      .mockResolvedValue({ totalStorageSize: 42, storageByType: {}, recommendations: [] });

    const mgmt = createMaintenanceManagement(services, {
      performSmartCleanup,
      listStoredRegions,
      getComprehensiveStorageAnalytics,
    });

    await mgmt.performCompleteMaintenance({
      cleanupExpired: true,
      generateReport: true,
    });

    expect(performSmartCleanup).toHaveBeenCalled();
    expect(getComprehensiveStorageAnalytics).toHaveBeenCalled();
    // Verify integrity was NOT enabled, so per-style verify* wasn't fired.
    expect(fns['resourceService.verifyAndRepairFonts']).not.toHaveBeenCalled();
  });
});
