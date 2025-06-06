import { OfflineMapManager } from '../src/map/offlineManager';

describe('OfflineMapManager', () => {
  let offlineManager: OfflineMapManager;

  beforeEach(() => {
    offlineManager = new OfflineMapManager();
  });

  it('should instantiate correctly', () => {
    expect(offlineManager).toBeInstanceOf(OfflineMapManager);
  });

  it('should list regions', async () => {
    const regions = await offlineManager.listRegions();
    expect(Array.isArray(regions)).toBe(true);
    expect(regions.length).toBe(0);
  });

  it('should have required methods', () => {
    expect(typeof offlineManager.addRegion).toBe('function');
    expect(typeof offlineManager.listRegions).toBe('function');
    expect(typeof offlineManager.deleteRegion).toBe('function');
    expect(typeof offlineManager.loadRegion).toBe('function');
  });
});