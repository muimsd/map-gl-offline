import { dbPromise } from '@/storage/indexedDbManager';
import { fetchResourceWithRetry, processBatch, createProgressTracker, logger } from '@/utils';
import type {
  ModelEntry,
  ModelDownloadOptions,
  ModelDownloadResult,
  EnhancedModelStats,
} from '@/types';

const modelLogger = logger.scope('ModelService');

/**
 * Build the storage key for a model. Kept consistent with sprite/glyph
 * conventions: `{styleId}::model::{modelName}`.
 */
function modelKey(styleId: string, modelName: string): string {
  return `${styleId}::model::${modelName}`;
}

/** True when the given key belongs to the given styleId's model store prefix. */
export function modelKeyBelongsToStyle(key: string, styleId: string): boolean {
  return key.startsWith(`${styleId}::model::`);
}

/**
 * Service for downloading, storing, and serving Mapbox 3D model (.glb) files.
 *
 * Mapbox Standard declares 32 models at the top of `style.models`:
 *
 * ```json
 * {
 *   "maple1-lod1": "mapbox://models/mapbox/maple1-v4-lod1.glb",
 *   ...
 * }
 * ```
 *
 * `model` layers (e.g. `trees`, `wind-turbine-towers`) pick one by name at
 * render time. For offline use each referenced URL is fetched and stored
 * here, and `patchStyleForOffline` rewrites the dictionary entries to
 * `idb://{styleId}/model/{name}` URLs.
 */
export class ModelService {
  private db = dbPromise;

  /**
   * Download the set of models referenced by `style.models` for one style.
   *
   * @param models   `{ modelName: resolvedHttpUrl }` — URLs must already be
   *                 resolved (mapbox:// URLs should be resolved by the caller).
   * @param styleId  The owning style's key.
   */
  async downloadModels(
    models: Record<string, string>,
    styleId: string,
    options: ModelDownloadOptions = {}
  ): Promise<ModelDownloadResult> {
    const db = await this.db;
    const {
      onProgress,
      batchSize = 4,
      maxRetries = 3,
      skipExisting = true,
      timeoutMs = 30000,
    } = options;

    const entries = Object.entries(models);
    const progressTracker = createProgressTracker(entries.length);
    const result: ModelDownloadResult = {
      totalModels: entries.length,
      downloadedModels: 0,
      skippedModels: 0,
      failedModels: 0,
      totalSize: 0,
      errors: [],
    };

    const emit = () => onProgress?.(progressTracker.getProgress());
    emit();

    if (entries.length === 0) return result;

    // Pre-compute existing keys for skipExisting
    const existingKeys = new Set<string>();
    if (skipExisting) {
      const tx = db.transaction('models', 'readonly');
      for await (const cursor of tx.store) {
        existingKeys.add(cursor.value.key);
      }
    }

    await processBatch(
      entries,
      async ([modelName, url]) => {
        const key = modelKey(styleId, modelName);
        const label = `${styleId}::${modelName}`;

        if (skipExisting && existingKeys.has(key)) {
          result.skippedModels++;
          progressTracker.update(1, label);
          emit();
          return;
        }

        try {
          const response = await fetchResourceWithRetry(url, {
            retries: maxRetries,
            timeout: timeoutMs,
            proxyType: 'tiles',
          });
          if (response.type === 'json') {
            throw new Error('Unexpected JSON response for model');
          }
          const data = response.data;
          const contentType =
            ('contentType' in response && response.contentType) || 'model/gltf-binary';

          const entry: ModelEntry = {
            key,
            data,
            contentType,
            size: data.byteLength,
            url,
            styleId,
            modelName,
            lastModified: Date.now(),
            downloadedAt: new Date().toISOString(),
            expires: response.expires,
          };
          await db.put('models', entry);
          result.downloadedModels++;
          result.totalSize += data.byteLength;
          progressTracker.update(1, label);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.failedModels++;
          result.errors.push({ url, error: message });
          modelLogger.warn(`Failed to download model "${modelName}" from ${url}:`, err);
          progressTracker.update(1, label, message);
        }
        emit();
      },
      { batchSize }
    );

    modelLogger.info(
      `Models downloaded for style ${styleId}: ${result.downloadedModels} new, ${result.skippedModels} skipped, ${result.failedModels} failed`
    );
    return result;
  }

  /** Retrieve a single model by `{styleId, modelName}`. */
  async getModel(styleId: string, modelName: string): Promise<ModelEntry | undefined> {
    const db = await this.db;
    return db.get('models', modelKey(styleId, modelName));
  }

  /** Aggregate stats across all stored models. */
  async getModelStats(): Promise<EnhancedModelStats> {
    const db = await this.db;
    const stats: EnhancedModelStats = {
      count: 0,
      totalSize: 0,
      averageSize: 0,
      models: [],
      modelsByStyle: {},
    };
    const tx = db.transaction('models', 'readonly');
    for await (const cursor of tx.store) {
      const m = cursor.value;
      stats.count++;
      stats.totalSize += m.size;
      stats.models.push({ name: m.modelName, size: m.size, lastModified: m.lastModified });
      stats.modelsByStyle[m.styleId] = (stats.modelsByStyle[m.styleId] ?? 0) + 1;
    }
    stats.averageSize = stats.count > 0 ? stats.totalSize / stats.count : 0;
    return stats;
  }

  /**
   * Delete models older than `maxAge` days. Defaults to 30.
   */
  async cleanupOldModels(maxAge: number = 30): Promise<number> {
    const db = await this.db;
    const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000;
    let deleted = 0;
    const tx = db.transaction('models', 'readwrite');
    for await (const cursor of tx.store) {
      if (cursor.value.lastModified < cutoff) {
        await cursor.delete();
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Basic integrity check: remove entries with empty/missing data.
   */
  async verifyAndRepairModels(): Promise<{ verified: number; repaired: number; removed: number }> {
    const db = await this.db;
    let verified = 0;
    let removed = 0;
    const tx = db.transaction('models', 'readwrite');
    for await (const cursor of tx.store) {
      const m = cursor.value;
      if (!m.data || m.data.byteLength === 0) {
        await cursor.delete();
        removed++;
      } else {
        verified++;
      }
    }
    return { verified, repaired: 0, removed };
  }
}

// Singleton + convenience exports, matching other service modules.
export const modelService = new ModelService();

export const downloadModels = (
  models: Record<string, string>,
  styleId: string,
  options?: ModelDownloadOptions
) => modelService.downloadModels(models, styleId, options);

export const getModel = (styleId: string, modelName: string) =>
  modelService.getModel(styleId, modelName);

export const getModelStats = () => modelService.getModelStats();

export const cleanupOldModels = (maxAge?: number) => modelService.cleanupOldModels(maxAge);

export const verifyAndRepairModels = () => modelService.verifyAndRepairModels();
