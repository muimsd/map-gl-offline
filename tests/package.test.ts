import { OfflineMapManager } from '../src/map/offlineManager';

test('OfflineMapManager should be defined', () => {
  expect(OfflineMapManager).toBeDefined();
});

test('OfflineMapManager should instantiate', () => {
  const manager = new OfflineMapManager();
  expect(manager).toBeInstanceOf(OfflineMapManager);
});

test('OfflineMapManager should have methods', () => {
  const manager = new OfflineMapManager();
  expect(typeof manager.addRegion).toBe('function');
  expect(typeof manager.listRegions).toBe('function');
});
