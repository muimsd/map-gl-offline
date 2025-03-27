export interface Glyph {
    id: string;
    data: string;
}
export interface GlyphMetadata {
    id: string;
    name: string;
    description: string;
    createdAt: Date;
}
export declare function downloadGlyphs(url: string): Promise<void>;
export declare function loadGlyphs(): Promise<Glyph[]>;
export declare function deleteGlyphs(): Promise<void>;
