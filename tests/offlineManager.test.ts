import { OfflineMapManager } from '../src/map/offlineManager';
import * as mapboxgl from 'mapbox-gl';

describe('OfflineMapManager', () => {
  let map: mapboxgl.Map;
  let offlineManager: OfflineMapManager;

  beforeEach(() => {
    map = new mapboxgl.Map({
      container: document.createElement('div'),
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40],
      zoom: 9,
    });
    offlineManager = new OfflineMapManager(map);
  });

  it('should add a region', async () => {
    const region = {
      id: 'test-region',
      bounds: [
        [-74.25909, 40.477399],
        [-73.700272, 40.916178],
      ],
      minZoom: 10,
      maxZoom: 15,
    };
    await offlineManager.addRegion(region);
    const regions = await offlineManager.listRegions();
    expect(regions).toContainEqual(region);
  });
});