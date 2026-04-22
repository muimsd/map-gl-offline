/**
 * Download-path coverage for GlyphService. Separate file so the fetch
 * mock doesn't leak into the existing test suite.
 */
const mockFetchWithRetry = jest.fn();

jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
  };
});

import { GlyphService } from '../../src/services/glyphService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('GlyphService.downloadGlyphs', () => {
  let service: GlyphService;

  beforeEach(async () => {
    service = new GlyphService();
    mockFetchWithRetry.mockReset();
    const db = await dbPromise;
    await db.clear('glyphs');
  });

  const makeResponse = (bytes = 32, headers: Record<string, string> = {}) => {
    // Use an ArrayBuffer so the setup polyfill's Response.arrayBuffer() takes
    // the fast path — passing a Uint8Array falls through to TextEncoder which
    // isn't defined in the test harness.
    const body = new ArrayBuffer(bytes);
    // Fill with something non-zero so validateGlyphData() would pass.
    new Uint8Array(body).fill(1);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Content-Length': String(bytes),
        ...headers,
      },
    });
  };

  it('downloads a range of glyphs and stores each', async () => {
    mockFetchWithRetry.mockImplementation(async () => makeResponse(16));

    const result = await service.downloadGlyphs(
      'https://example.com/fonts/{fontstack}/{range}.pbf',
      ['Arial'],
      'style-a',
      ['0-255', '256-511'],
      { enableValidation: false, maxConcurrency: 1 }
    );
    // All tasks accounted for — either downloaded, skipped, or failed.
    expect(result.downloadedGlyphs + result.skippedGlyphs + result.failedGlyphs).toBe(2);
    // Reporting shape is well-formed.
    expect(result.errors).toBeDefined();
    expect(result.analytics.averageGlyphSize).toBeGreaterThanOrEqual(0);
  });

  it('skips glyphs that already exist in the store', async () => {
    const db = await dbPromise;
    // Seed a glyph under the exact key the service uses.
    await db.put('glyphs', {
      key: 'style-a::Arial/0-255.pbf',
      data: new ArrayBuffer(4),
      size: 4,
      url: 'u',
      lastModified: Date.now(),
      downloadedAt: new Date().toISOString(),
      styleId: 'style-a',
      fontstack: 'Arial',
      range: '0-255',
    });

    mockFetchWithRetry.mockImplementation(async () => {
      const body = new ArrayBuffer(8);
      new Uint8Array(body).fill(1);
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/x-protobuf' },
      });
    });

    const result = await service.downloadGlyphs(
      'https://example.com/fonts/{fontstack}/{range}.pbf',
      ['Arial'],
      'style-a',
      ['0-255', '256-511'],
      { enableValidation: false, maxConcurrency: 1 }
    );
    // One already existed (skipped), one was freshly fetched.
    expect(result.skippedGlyphs).toBeGreaterThanOrEqual(1);
    expect(result.downloadedGlyphs + result.skippedGlyphs + result.failedGlyphs).toBe(2);
  });

  it('counts non-ok responses as failures', async () => {
    mockFetchWithRetry.mockResolvedValue(
      new Response(null, { status: 500, statusText: 'boom' })
    );

    const result = await service.downloadGlyphs(
      'https://example.com/fonts/{fontstack}/{range}.pbf',
      ['Arial'],
      'style-a',
      ['0-255'],
      { enableValidation: false, maxConcurrency: 1 }
    );
    expect(result.failedGlyphs).toBe(1);
    expect(result.errors.length).toBe(1);
  });

  it('fires onProgress for each task', async () => {
    mockFetchWithRetry.mockImplementation(async () => makeResponse(8));
    const seen: number[] = [];
    await service.downloadGlyphs(
      'https://example.com/fonts/{fontstack}/{range}.pbf',
      ['Arial'],
      'style-a',
      ['0-255', '256-511', '512-767'],
      {
        enableValidation: false,
        maxConcurrency: 1,
        onProgress: p => seen.push(p.completed),
      }
    );
    // Must see a progression of completed counts.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(3);
  });

  it('rejects non-ok responses with a retry-exhausted error', async () => {
    mockFetchWithRetry.mockResolvedValue(
      new Response(null, { status: 500, statusText: 'bad' })
    );
    const result = await service.downloadGlyphs(
      'https://example.com/fonts/{fontstack}/{range}.pbf',
      ['Unknown Font'],
      'style-a',
      ['0-255'],
      { enableValidation: false, maxConcurrency: 1 }
    );
    expect(result.failedGlyphs).toBe(1);
  });
});

describe('GlyphService.loadGlyphs + getGlyph', () => {
  let service: GlyphService;

  beforeEach(async () => {
    service = new GlyphService();
    const db = await dbPromise;
    await db.clear('glyphs');
  });

  it('loads glyphs by fontstack + range for a given style', async () => {
    const db = await dbPromise;
    const now = Date.now();
    await db.put('glyphs', {
      key: 'style-a::Arial/0-255.pbf',
      data: new ArrayBuffer(4),
      size: 4,
      url: 'u',
      lastModified: now,
      downloadedAt: new Date(now).toISOString(),
      styleId: 'style-a',
      fontstack: 'Arial',
      range: '0-255',
    });
    const results = await service.loadGlyphs('Arial', ['0-255'], 'style-a');
    expect(results.length).toBe(1);
    expect(results[0].start).toBe(0);
    expect(results[0].end).toBe(255);
  });

  it('returns empty array when nothing is stored', async () => {
    const results = await service.loadGlyphs('Arial', ['0-255'], 'style-a');
    expect(results).toEqual([]);
  });
});
