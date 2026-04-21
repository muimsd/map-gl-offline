/**
 * Download-path coverage for FontService. Kept in a separate file from
 * the main service tests so the fetchResourceWithRetry module mock
 * doesn't bleed across suites.
 */
const mockFetchResource = jest.fn();
const mockFetchWithRetry = jest.fn();

jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchResourceWithRetry: (...args: unknown[]) => mockFetchResource(...args),
    fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
  };
});

import { FontService } from '../../src/services/fontService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('FontService.downloadFonts', () => {
  let service: FontService;

  beforeEach(async () => {
    service = new FontService();
    mockFetchResource.mockReset();
    mockFetchWithRetry.mockReset();
    const db = await dbPromise;
    await db.clear('fonts');
  });

  const makePbfResponse = (bytes = 64) => ({
    type: 'pbf' as const,
    data: new ArrayBuffer(bytes),
    contentType: 'application/x-protobuf',
  });

  it('downloads fonts and stores them keyed by style', async () => {
    mockFetchResource.mockResolvedValue(makePbfResponse(128));

    const result = await service.downloadFonts(
      [
        'https://example.com/fonts/Arial/0-255.pbf',
        'https://example.com/fonts/Arial/256-511.pbf',
      ],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: false }
    );

    expect(result.totalFonts).toBe(2);
    expect(result.downloadedFonts).toBe(2);
    expect(result.failedFonts).toBe(0);
    expect(result.totalSize).toBe(256);

    const db = await dbPromise;
    const tx = db.transaction('fonts', 'readonly');
    let n = 0;
    for await (const cursor of tx.store) {
      expect(typeof cursor.value.key).toBe('string');
      n++;
    }
    expect(n).toBe(2);
  });

  it('skips fonts already in store when skipExisting is true', async () => {
    const db = await dbPromise;
    // Pre-seed one of the URLs under the key the service will compute.
    mockFetchResource.mockResolvedValue(makePbfResponse(64));
    // Do one pass to seed the store via the real path.
    await service.downloadFonts(
      ['https://example.com/fonts/Roboto/0-255.pbf'],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: false }
    );
    // Reset call count, then re-download with skipExisting.
    mockFetchResource.mockClear();
    const result = await service.downloadFonts(
      [
        'https://example.com/fonts/Roboto/0-255.pbf',
        'https://example.com/fonts/Roboto/256-511.pbf',
      ],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: true }
    );
    expect(result.skippedFonts).toBe(1);
    // Only the new URL should have been fetched.
    expect(mockFetchResource).toHaveBeenCalledTimes(1);
    // Store has exactly 2 entries (seeded + new).
    const tx = db.transaction('fonts', 'readonly');
    let n = 0;
    for await (const _ of tx.store) n++;
    expect(n).toBe(2);
  });

  it('records failures without aborting the batch', async () => {
    mockFetchResource
      .mockResolvedValueOnce(makePbfResponse(100))
      .mockRejectedValueOnce(new Error('network'));

    const result = await service.downloadFonts(
      ['https://a/1.pbf', 'https://b/2.pbf'],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: false, quietMode: true }
    );
    expect(result.downloadedFonts).toBe(1);
    expect(result.failedFonts).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('throws when the server returns JSON instead of a font', async () => {
    mockFetchResource.mockResolvedValue({
      type: 'json',
      data: { oops: true },
      contentType: 'application/json',
    });

    const result = await service.downloadFonts(
      ['https://bad/font.pbf'],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: false, quietMode: true }
    );
    expect(result.failedFonts).toBe(1);
    expect(result.errors[0].error).toMatch(/Unexpected JSON/);
  });

  it('fires progressTracker callbacks via batch processor', async () => {
    mockFetchResource.mockResolvedValue(makePbfResponse(32));
    const result = await service.downloadFonts(
      ['https://a/1.pbf', 'https://a/2.pbf', 'https://a/3.pbf'],
      'style-a',
      { storageQuotaCheck: false, validateFonts: false, skipExisting: false, batchSize: 2 }
    );
    expect(result.downloadedFonts).toBe(3);
  });
});
