import { DBSchema } from 'idb';
export interface OfflineMapDB extends DBSchema {
    regions: {
        key: string;
        value: OfflineRegionOptions;
    };
    tiles: {
        key: string;
        value: ArrayBuffer;
    };
    sprites: {
        key: string;
        value: ArrayBuffer;
    };
    glyphs: {
        key: string;
        value: ArrayBuffer;
    };
    styles: {
        key: string;
        value: string;
    };
    fonts: {
        key: string;
        value: ArrayBuffer;
    };
}
export interface OfflineRegionOptions {
    id: string;
    name: string;
    bounds: [[number, number], [number, number]];
    multipleRegions?: boolean;
    styleUrl?: string;
    minZoom: number;
    maxZoom: number;
}
