/**
 * Tests for Model Service
 */
import { ModelService, modelKeyBelongsToStyle } from '../../src/services/modelService';
import { dbPromise } from '../../src/storage/indexedDbManager';

// Mock fetchResourceWithRetry so tests don't hit the network.
const mockFetch = jest.fn();
jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchResourceWithRetry: (...args: unknown[]) => mockFetch(...args),
  };
});

describe('ModelService', () => {
  let service: ModelService;

  beforeEach(async () => {
    service = new ModelService();
    mockFetch.mockReset();
    const db = await dbPromise;
    await db.clear('models');
  });

  describe('modelKeyBelongsToStyle', () => {
    it('matches keys prefixed by the style id and ::model::', () => {
      expect(modelKeyBelongsToStyle('style-abc::model::tree-lod1', 'style-abc')).toBe(true);
    });
    it('does not match a different styleId', () => {
      expect(modelKeyBelongsToStyle('style-xyz::model::foo', 'style-abc')).toBe(false);
    });
    it('does not match keys without the ::model:: marker', () => {
      expect(modelKeyBelongsToStyle('style-abc::tree-lod1', 'style-abc')).toBe(false);
    });
  });

  describe('downloadModels', () => {
    it('stores each model under {styleId}::model::{name}', async () => {
      mockFetch.mockResolvedValue({
        type: 'image',
        data: new ArrayBuffer(16),
        contentType: 'model/gltf-binary',
      });
      const models = {
        'maple1-lod1': 'https://api.mapbox.com/models/v1/mapbox/maple1-v4-lod1.glb',
        'oak1-lod2': 'https://api.mapbox.com/models/v1/mapbox/oak1-v4-lod2.glb',
      };
      const result = await service.downloadModels(models, 'style-abc');

      expect(result.totalModels).toBe(2);
      expect(result.downloadedModels).toBe(2);
      expect(result.failedModels).toBe(0);
      expect(result.totalSize).toBe(32);

      const db = await dbPromise;
      const first = await db.get('models', 'style-abc::model::maple1-lod1');
      expect(first?.modelName).toBe('maple1-lod1');
      expect(first?.styleId).toBe('style-abc');
      expect(first?.size).toBe(16);
    });

    it('skips models already in store when skipExisting is true (default)', async () => {
      const db = await dbPromise;
      await db.put('models', {
        key: 'style-abc::model::existing',
        data: new ArrayBuffer(4),
        contentType: 'model/gltf-binary',
        size: 4,
        url: 'https://example.com/existing.glb',
        styleId: 'style-abc',
        modelName: 'existing',
        lastModified: Date.now(),
        downloadedAt: new Date().toISOString(),
      });

      mockFetch.mockResolvedValue({
        type: 'image',
        data: new ArrayBuffer(16),
        contentType: 'model/gltf-binary',
      });
      const result = await service.downloadModels(
        {
          existing: 'https://example.com/existing.glb',
          'new-one': 'https://example.com/new.glb',
        },
        'style-abc'
      );

      expect(result.skippedModels).toBe(1);
      expect(result.downloadedModels).toBe(1);
      // Only one fetch fired — for the new model.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('records failures without aborting the whole batch', async () => {
      mockFetch
        .mockResolvedValueOnce({
          type: 'image',
          data: new ArrayBuffer(8),
          contentType: 'model/gltf-binary',
        })
        .mockRejectedValueOnce(new Error('network'));

      const result = await service.downloadModels(
        {
          good: 'https://example.com/good.glb',
          bad: 'https://example.com/bad.glb',
        },
        'style-abc'
      );

      expect(result.downloadedModels).toBe(1);
      expect(result.failedModels).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('https://example.com/bad.glb');
    });

    it('returns an empty result when given no models', async () => {
      const result = await service.downloadModels({}, 'style-abc');
      expect(result.totalModels).toBe(0);
      expect(result.downloadedModels).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getModelStats', () => {
    it('aggregates count, size, and per-style breakdown', async () => {
      const db = await dbPromise;
      const now = Date.now();
      const base = { contentType: 'model/gltf-binary', url: '', downloadedAt: '' };
      await db.put('models', {
        key: 'a::model::m1',
        data: new ArrayBuffer(10),
        size: 10,
        styleId: 'a',
        modelName: 'm1',
        lastModified: now,
        ...base,
      });
      await db.put('models', {
        key: 'a::model::m2',
        data: new ArrayBuffer(30),
        size: 30,
        styleId: 'a',
        modelName: 'm2',
        lastModified: now,
        ...base,
      });
      await db.put('models', {
        key: 'b::model::m1',
        data: new ArrayBuffer(20),
        size: 20,
        styleId: 'b',
        modelName: 'm1',
        lastModified: now,
        ...base,
      });

      const stats = await service.getModelStats();
      expect(stats.count).toBe(3);
      expect(stats.totalSize).toBe(60);
      expect(stats.averageSize).toBe(20);
      expect(stats.modelsByStyle).toEqual({ a: 2, b: 1 });
    });
  });

  describe('cleanupOldModels', () => {
    it('deletes models older than maxAge days', async () => {
      const db = await dbPromise;
      const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
      await db.put('models', {
        key: 'a::model::old',
        data: new ArrayBuffer(1),
        size: 1,
        styleId: 'a',
        modelName: 'old',
        lastModified: fortyDaysAgo,
        contentType: '',
        url: '',
        downloadedAt: '',
      });
      await db.put('models', {
        key: 'a::model::fresh',
        data: new ArrayBuffer(1),
        size: 1,
        styleId: 'a',
        modelName: 'fresh',
        lastModified: Date.now(),
        contentType: '',
        url: '',
        downloadedAt: '',
      });
      const deleted = await service.cleanupOldModels(30);
      expect(deleted).toBe(1);
      expect(await db.get('models', 'a::model::old')).toBeUndefined();
      expect(await db.get('models', 'a::model::fresh')).toBeDefined();
    });
  });

  describe('verifyAndRepairModels', () => {
    it('removes entries with empty data', async () => {
      const db = await dbPromise;
      await db.put('models', {
        key: 'a::model::good',
        data: new ArrayBuffer(8),
        size: 8,
        styleId: 'a',
        modelName: 'good',
        lastModified: Date.now(),
        contentType: '',
        url: '',
        downloadedAt: '',
      });
      await db.put('models', {
        key: 'a::model::empty',
        data: new ArrayBuffer(0),
        size: 0,
        styleId: 'a',
        modelName: 'empty',
        lastModified: Date.now(),
        contentType: '',
        url: '',
        downloadedAt: '',
      });
      const result = await service.verifyAndRepairModels();
      expect(result.verified).toBe(1);
      expect(result.removed).toBe(1);
    });
  });
});
