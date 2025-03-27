import { OfflineRegionOptions } from '@/types';
export declare class OfflineMapManager {
    constructor();
    addRegion(region: OfflineRegionOptions): Promise<void>;
    loadRegion(region: OfflineRegionOptions): Promise<void>;
    listRegions(): Promise<OfflineRegionOptions[]>;
    deleteRegion(regionId: string): Promise<void>;
}
