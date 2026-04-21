import { DBSchema } from 'idb';
import type { StoredRegion } from './region';
import type { StyleEntry } from './style';
import type { FontEntry } from './font';
import type { TileEntry } from './tile';
import type { SpriteEntry } from './sprite';
import type { GlyphEntry } from './glyph';
import type { ModelEntry } from './model';

export interface OfflineMapDB extends DBSchema {
  /**
   * @deprecated Regions are now stored inside styles.regions[] array.
   * This store is kept for backward compatibility and migration purposes only.
   * Do not write to this store - it will be cleaned up during DB migration.
   */
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
  /**
   * 3D model files (.glb) referenced by `style.models` entries. Used by
   * Mapbox Standard for tree / wind-turbine model layers.
   */
  models: {
    key: string;
    value: ModelEntry;
  };
}
