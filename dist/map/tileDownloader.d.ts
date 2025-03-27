import { OfflineRegionOptions } from '@/types';
export declare function downloadTiles(region: OfflineRegionOptions): Promise<void>;
export declare function loadTiles(region: OfflineRegionOptions): Promise<void>;
export declare function deleteTiles(regionId: string): Promise<void>;
