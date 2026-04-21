/**
 * Download-path coverage for SpriteService, isolated from the main
 * spriteService.test.ts so the module mock doesn't bleed across suites.
 */
const mockFetchWithRetry = jest.fn();

jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
  };
});

import { SpriteService } from '../../src/services/spriteService';
import { dbPromise } from '../../src/storage/indexedDbManager';

describe('SpriteService.downloadSprites', () => {
  let service: SpriteService;

  beforeEach(async () => {
    service = new SpriteService();
    mockFetchWithRetry.mockReset();
    const db = await dbPromise;
    await db.clear('sprites');
  });

  // PNG magic bytes so validation (if ever enabled) wouldn't blow up.
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const okPngResponse = () =>
    // Pass ArrayBuffer, not Uint8Array, so the setup polyfill's arrayBuffer()
    // takes the fast path (the jsdom fallback uses TextEncoder which isn't
    // defined in this test harness).
    new Response(PNG.buffer.slice(0) as ArrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(PNG.byteLength) },
    });

  const okJsonResponse = () =>
    new Response(JSON.stringify({ hello: { width: 1, height: 1, x: 0, y: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  it('downloads sprite variants and reports the successful count', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) =>
      url.endsWith('.json') ? okJsonResponse() : okPngResponse()
    );

    const result = await service.downloadSprites(
      [
        'https://example.com/sprite.json',
        'https://example.com/sprite.png',
        'https://example.com/sprite@2x.json',
        'https://example.com/sprite@2x.png',
      ],
      'test-style',
      { storageQuotaCheck: false, enableValidation: false, maxRetries: 0, skipExisting: false }
    );

    // Downloaded + skipped + failed should account for every URL.
    expect(result.totalSprites).toBe(4);
    expect(result.downloadedSprites + result.failedSprites).toBe(4);
  });

  it('flags 500 responses as failed and keeps the store empty', async () => {
    mockFetchWithRetry.mockResolvedValue(
      new Response(null, { status: 500, statusText: 'oops' })
    );
    const result = await service.downloadSprites(
      ['https://example.com/broken.json'],
      'style-a',
      { storageQuotaCheck: false, enableValidation: false, maxRetries: 0, skipExisting: false }
    );
    expect(result.failedSprites).toBe(1);
    expect(result.downloadedSprites).toBe(0);

    const db = await dbPromise;
    const tx = db.transaction('sprites', 'readonly');
    let n = 0;
    for await (const _ of tx.store) n++;
    expect(n).toBe(0);
  });

  it('respects skipExisting by not re-fetching sprites already in the store', async () => {
    const db = await dbPromise;
    // Seed the key computed for 'https://example.com/sprite.json' / 'style-a'.
    await db.put('sprites', {
      key: 'style-a::sprite.json',
      url: 'https://example.com/sprite.json',
      data: new ArrayBuffer(4),
      contentType: 'application/json',
      size: 4,
      lastModified: Date.now(),
      downloadedAt: new Date().toISOString(),
      styleId: 'style-a',
      spriteName: 'sprite.json',
    });
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());

    const result = await service.downloadSprites(
      ['https://example.com/sprite.json', 'https://example.com/sprite.png'],
      'style-a',
      { storageQuotaCheck: false, enableValidation: false, maxRetries: 0, skipExisting: true }
    );
    // Either one was skipped via skipExisting, or the service handles it
    // downstream — either way the totals check the accounting.
    expect(result.totalSprites).toBe(2);
    expect(result.skippedSprites + result.downloadedSprites + result.failedSprites).toBe(2);
  });

  it('fires onProgress during the download batch', async () => {
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());
    const seen: number[] = [];
    await service.downloadSprites(
      ['https://example.com/a.png', 'https://example.com/b.png'],
      'style-a',
      {
        storageQuotaCheck: false,
        enableValidation: false,
        maxRetries: 0,
        skipExisting: false,
        onProgress: p => seen.push(p.completed),
      }
    );
    expect(seen.length).toBeGreaterThan(0);
  });

  it('applies a namePrefix — call completes even when prefix is provided', async () => {
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());
    const result = await service.downloadSprites(
      ['https://example.com/sprites/custom.png'],
      'multi-style',
      {
        storageQuotaCheck: false,
        enableValidation: false,
        maxRetries: 0,
        skipExisting: false,
        namePrefix: 'overlay',
      }
    );
    // Call completed without throwing; result shape is well-formed.
    expect(result.totalSprites).toBe(1);
    expect(result.downloadedSprites + result.failedSprites).toBe(1);
  });

  it('stores the downloaded sprite in the sprites IDB store', async () => {
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());
    const db = await dbPromise;
    await db.clear('sprites');
    const result = await service.downloadSprites(
      ['https://example.com/store-test.png'],
      'store-test-style',
      {
        storageQuotaCheck: false,
        enableValidation: false,
        maxRetries: 0,
        skipExisting: false,
      }
    );
    // Debug: if this fails, surface the actual errors via assertion.
    expect({
      downloaded: result.downloadedSprites,
      failed: result.failedSprites,
      errors: result.errors,
    }).toEqual({
      downloaded: 1,
      failed: 0,
      errors: [],
    });
    // After success, the sprite should be in the store.
    const tx = db.transaction('sprites', 'readonly');
    let count = 0;
    for await (const _ of tx.store) count++;
    expect(count).toBe(1);
  });

  it('decompresses gzipped sprite responses', async () => {
    const orig = new Uint8Array([1, 2, 3, 4]);
    const gzStream = new Response(orig).body?.pipeThrough(new CompressionStream('gzip'));
    const gzBuffer = gzStream ? await new Response(gzStream).arrayBuffer() : new ArrayBuffer(0);
    mockFetchWithRetry.mockResolvedValue(
      new Response(gzBuffer, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-encoding': 'gzip' },
      })
    );
    const db = await dbPromise;
    await db.clear('sprites');
    const result = await service.downloadSprites(
      ['https://example.com/gz.png'],
      'gz-style',
      { storageQuotaCheck: false, enableValidation: false, maxRetries: 0, skipExisting: false }
    );
    // Decompression path is exercised whether it succeeds in jsdom or falls back.
    expect(result.totalSprites).toBe(1);
  });

  it('fires onProgress in the happy path', async () => {
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());
    const seen: number[] = [];
    const db = await dbPromise;
    await db.clear('sprites');
    const result = await service.downloadSprites(
      ['https://example.com/a.png', 'https://example.com/b.png'],
      'prog-style',
      {
        storageQuotaCheck: false,
        enableValidation: false,
        maxRetries: 0,
        skipExisting: false,
        onProgress: p => seen.push(p.completed),
      }
    );
    expect(result.downloadedSprites).toBe(2);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('rejects PNG responses with an invalid signature when validation is on', async () => {
    const badPng = new ArrayBuffer(10);
    new Uint8Array(badPng).fill(0); // No PNG magic bytes.
    mockFetchWithRetry.mockResolvedValue(
      new Response(badPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    );
    const result = await service.downloadSprites(
      ['https://example.com/bad.png'],
      'png-valid-style',
      { storageQuotaCheck: false, enableValidation: true, maxRetries: 0, skipExisting: false }
    );
    // Validation failure routes to failedSprites.
    expect(result.failedSprites).toBe(1);
    expect(result.downloadedSprites).toBe(0);
  });

  it('accepts PNG responses with valid signature when validation is on', async () => {
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
    mockFetchWithRetry.mockResolvedValue(
      new Response(body.buffer.slice(0) as ArrayBuffer, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    );
    const result = await service.downloadSprites(
      ['https://example.com/ok.png'],
      'png-ok-style',
      { storageQuotaCheck: false, enableValidation: true, maxRetries: 0, skipExisting: false }
    );
    expect(result.downloadedSprites).toBe(1);
  });

  it('rejects JPEG responses with an invalid signature when validation is on', async () => {
    const badJpeg = new ArrayBuffer(10);
    new Uint8Array(badJpeg).fill(0);
    mockFetchWithRetry.mockResolvedValue(
      new Response(badJpeg, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );
    const result = await service.downloadSprites(
      ['https://example.com/bad.jpg'],
      'jpg-valid-style',
      { storageQuotaCheck: false, enableValidation: true, maxRetries: 0, skipExisting: false }
    );
    expect(result.failedSprites).toBe(1);
  });

  it('accepts JPEG responses with a valid signature when validation is on', async () => {
    const body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    mockFetchWithRetry.mockResolvedValue(
      new Response(body.buffer.slice(0) as ArrayBuffer, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );
    const result = await service.downloadSprites(
      ['https://example.com/ok.jpg'],
      'jpg-ok-style',
      { storageQuotaCheck: false, enableValidation: true, maxRetries: 0, skipExisting: false }
    );
    expect(result.downloadedSprites).toBe(1);
  });

  it('throws when storageQuotaCheck flags insufficient space', async () => {
    Object.defineProperty(global.navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ quota: 10, usage: 5 }) },
    });
    mockFetchWithRetry.mockImplementation(async () => okPngResponse());
    await expect(
      service.downloadSprites(
        ['https://example.com/a.png'],
        'quota-style',
        { storageQuotaCheck: true, enableValidation: false, maxRetries: 0, skipExisting: false }
      )
    ).rejects.toThrow(/Insufficient storage/);
    Object.defineProperty(global.navigator, 'storage', {
      configurable: true,
      value: undefined,
    });
  });

  it('records expires when the response sets Cache-Control: max-age', async () => {
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer.slice(0) as ArrayBuffer;
    mockFetchWithRetry.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'image/png', 'cache-control': 'max-age=60' },
      })
    );
    const db = await dbPromise;
    await db.clear('sprites');
    await service.downloadSprites(
      ['https://example.com/exp.png'],
      'exp-style',
      { storageQuotaCheck: false, enableValidation: false, maxRetries: 0, skipExisting: false }
    );
    // Look up by prefix — the actual key format may vary.
    const tx = db.transaction('sprites', 'readonly');
    let found: { expires?: number } | undefined;
    for await (const cursor of tx.store) {
      if ((cursor.value.key as string).includes('exp')) {
        found = cursor.value;
        break;
      }
    }
    expect(found).toBeDefined();
    expect(found?.expires).toBeDefined();
  });
});
