import { OfflineMapManager } from '@/map/offlineManager';

async function main() {
  try {
    const manager = new OfflineMapManager();
    await manager.addRegion({
      id: 'world',
      name: 'World',
      multipleRegions: true,
      styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      bounds: [
        [-180, -85],
        [180, 85],
      ],
      minZoom: 0,
      maxZoom: 6,
    });
  } catch (error) {
    console.error('Error in main:', error);
  }
}
main();
