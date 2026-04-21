import { DownloadProgress } from './progress';

/**
 * 3D model asset (e.g. a tree or turbine .glb) stored in IndexedDB.
 *
 * Mapbox Standard references 32 models via the top-level `style.models`
 * dictionary (`{ "maple1-lod1": "mapbox://models/mapbox/maple1-v4-lod1.glb" }`).
 * Layers of type `model` then pick one by name at render time.
 */
export interface ModelEntry {
  /** Storage key: `{styleId}::model::{modelName}`. */
  key: string;
  /** Model binary (.glb / .gltf) as ArrayBuffer. */
  data: ArrayBuffer;
  /** HTTP Content-Type (usually `model/gltf-binary`). */
  contentType: string;
  /** Byte length. */
  size: number;
  /** URL the model was downloaded from. */
  url: string;
  /** Style this model belongs to. */
  styleId: string;
  /** Model name (the key in `style.models`). */
  modelName: string;
  /** Last-Modified or download timestamp (ms since epoch). */
  lastModified: number;
  /** ISO 8601 download timestamp. */
  downloadedAt: string;
  /** Optional expiry from HTTP Cache-Control. */
  expires?: number;
}

/** Options for `downloadModels`. */
export interface ModelDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  batchSize?: number;
  maxRetries?: number;
  skipExisting?: boolean;
  timeoutMs?: number;
}

/** Result of a model download batch. */
export interface ModelDownloadResult {
  totalModels: number;
  downloadedModels: number;
  skippedModels: number;
  failedModels: number;
  totalSize: number;
  errors: Array<{ url: string; error: string }>;
}

/** Aggregate stats across stored models. */
export interface EnhancedModelStats {
  count: number;
  totalSize: number;
  averageSize: number;
  models: Array<{ name: string; size: number; lastModified?: number }>;
  modelsByStyle: Record<string, number>;
}
