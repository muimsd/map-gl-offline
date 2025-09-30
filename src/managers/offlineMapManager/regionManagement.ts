import type { OfflineRegionOptions, StoredRegion } from '../../types';
import type { OfflineManagerServices } from './base';

export interface RegionManagement {
  addRegion(region: OfflineRegionOptions): Promise<void>;
  loadRegion(region: OfflineRegionOptions): Promise<void>;
  deleteRegion(regionId: string): Promise<void>;
  listRegions(): Promise<OfflineRegionOptions[]>;
  listStoredRegions(): Promise<StoredRegion[]>;
  getStoredRegion(regionId: string): Promise<StoredRegion | null>;
}

export const createRegionManagement = (
  services: OfflineManagerServices
): RegionManagement => ({
  addRegion: async (region: OfflineRegionOptions) =>
    services.regionService.addRegion(region),
  loadRegion: async (region: OfflineRegionOptions) =>
    services.regionService.loadRegion(region),
  deleteRegion: async (regionId: string) =>
    services.regionService.deleteRegion(regionId),
  listRegions: async () => services.regionService.listRegions(),
  listStoredRegions: async () => services.regionService.listStoredRegions(),
  getStoredRegion: async (regionId: string) => {
    const regions = await services.regionService.listStoredRegions();
    return regions.find((region: StoredRegion) => region.id === regionId) ?? null;
  },
});
