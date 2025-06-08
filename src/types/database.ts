import { DBSchema } from 'idb';
import type { StoredRegion } from './region';
import type { StyleEntry } from './style';
import type { FontEntry } from './font';
import type { TileEntry } from './tile';
import type { SpriteEntry } from './sprite';
import type { GlyphEntry } from './glyph';

export interface OfflineMapDB extends DBSchema {
  regions: {
    key: string;
    value: StoredRegion;
  };
  tiles: {
    key: string;
    value: TileEntry;
  };
  sprites: {
    key: string;
    value: SpriteEntry;
  };
  glyphs: {
    key: string;
    value: GlyphEntry;
  };
  styles: {
    key: string;
    value: StyleEntry;
  };
  fonts: {
    key: string;
    value: FontEntry;
  };
}
