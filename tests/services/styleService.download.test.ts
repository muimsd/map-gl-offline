/**
 * Download-path coverage for StyleService. Separate file so the
 * fetch-module mocks don't leak into the main styleService test suite.
 *
 * Covers `downloadStyles` and `downloadStyleWithProvider`.
 */
const mockFetchWithRetry = jest.fn();
const mockFetchResourceWithRetry = jest.fn();

jest.mock('../../src/utils/download', () => {
  const actual = jest.requireActual('../../src/utils/download');
  return {
    ...actual,
    fetchWithRetry: (...args: unknown[]) => mockFetchWithRetry(...args),
    fetchResourceWithRetry: (...args: unknown[]) => mockFetchResourceWithRetry(...args),
  };
});

import {
  downloadStyles,
  downloadStyleWithProvider,
} from '../../src/services/styleService';
import { dbPromise } from '../../src/storage/indexedDbManager';

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const okPng = () =>
  new Response(PNG, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(PNG.byteLength) },
  });

describe('StyleService.downloadStyles', () => {
  beforeEach(async () => {
    mockFetchWithRetry.mockReset();
    mockFetchResourceWithRetry.mockReset();
    const db = await dbPromise;
    await db.clear('styles');
    await db.clear('sprites');
    await db.clear('fonts');
    await db.clear('glyphs');
  });

  it('downloads a basic style end-to-end and stores it', async () => {
    const style = {
      version: 8,
      id: 'my-style',
      name: 'Test',
      sources: { src: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
      layers: [{ id: 'lyr', type: 'fill', source: 'src' }],
    };
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.endsWith('.json') && url.includes('my-style')) return okJson(style);
      if (url.endsWith('.json')) return okJson({});
      return okPng();
    });
    mockFetchResourceWithRetry.mockResolvedValue({
      type: 'pbf',
      data: new ArrayBuffer(32),
      contentType: 'application/x-protobuf',
    });

    const result = await downloadStyles('https://example.com/my-style.json', {
      enableSourceEmbedding: false,
      validateStyle: false,
      skipExisting: false,
      includeMetadata: true,
    });

    expect(result.success).toBe(true);
    expect(result.styleId).toBe('my-style');

    const db = await dbPromise;
    const saved = await db.get('styles', 'my-style');
    expect(saved).toBeDefined();
  });

  it('uses the existing style when skipExisting is true', async () => {
    const db = await dbPromise;
    await db.put('styles', {
      key: 'existing-style',
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto',
      regions: [],
      fonts: [],
      glyphs: [],
      sprites: [],
    } as never);

    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        id: 'existing-style',
        sources: {},
        layers: [],
      })
    );

    const result = await downloadStyles('https://example.com/existing-style.json', {
      skipExisting: true,
      validateStyle: false,
    });
    expect(result.success).toBe(true);
    expect(result.styleSize).toBe(0);
    expect(result.sourcesProcessed).toBe(0);
  });

  it('throws when mapbox:// URL is used without a token', async () => {
    const result = await downloadStyles('mapbox://styles/mapbox/streets-v11');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/access token/i);
  });

  it('resolves mapbox:// URL when a token is provided', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        id: 'mapbox-streets',
        sources: {},
        layers: [],
      })
    );
    const result = await downloadStyles('mapbox://styles/mapbox/streets-v11', {
      accessToken: 'pk.fake',
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
    // The resolved URL should start with https://api.mapbox.com
    const urlsFetched = mockFetchWithRetry.mock.calls.map(c => c[0]);
    expect(urlsFetched[0]).toMatch(/api\.mapbox\.com/);
  });

  it('fails gracefully when fetch throws', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('network'));
    const result = await downloadStyles('https://example.com/oops.json', {
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/network/);
  });

  it('embeds TileJSON when enableSourceEmbedding is true', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes('source.json')) {
        return okJson({ tiles: ['https://t/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14 });
      }
      return okJson({
        version: 8,
        id: 'embedded-style',
        sources: {
          v1: { type: 'vector', url: 'https://example.com/source.json' },
        },
        layers: [{ id: 'L', type: 'fill', source: 'v1' }],
      });
    });
    const result = await downloadStyles('https://example.com/embedded-style.json', {
      enableSourceEmbedding: true,
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
    expect(result.sourcesEmbedded).toBeGreaterThanOrEqual(1);
  });

  it('generates an id from the URL when style has no id', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        sources: {},
        layers: [],
      })
    );
    const result = await downloadStyles('https://example.com/no-id-style.json', {
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
    expect(result.styleId).toBe('no-id-style');
  });

  it('reports an invalid style when validation is enabled', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({ version: 7 }) // Too old — invalid
    );
    const result = await downloadStyles('https://example.com/bad.json', {
      validateStyle: true,
      skipExisting: false,
    });
    expect(result.success).toBe(false);
    expect(result.errors.join('\n')).toMatch(/Invalid style/i);
  });

  it('handles array-valued sprite sources', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.endsWith('.png') || url.includes('@2x')) return okPng();
      if (url.endsWith('.json') && url.includes('with-sprite')) {
        return okJson({
          version: 8,
          id: 'with-sprite',
          name: 'With Sprite',
          sources: {},
          layers: [{ id: 'L', type: 'background' }],
          sprite: [
            { id: 'base', url: 'https://example.com/base' },
            { id: 'overlay', url: 'https://example.com/overlay' },
          ],
        });
      }
      if (url.endsWith('.json')) {
        return okJson({ foo: 1 });
      }
      return okPng();
    });
    const result = await downloadStyles('https://example.com/with-sprite.json', {
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
  });

  it('downloads glyphs when the style has text layers', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.endsWith('.pbf')) {
        const body = new ArrayBuffer(16);
        new Uint8Array(body).fill(1);
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/x-protobuf' },
        });
      }
      return okJson({
        version: 8,
        id: 'with-text',
        name: 'With Text',
        sources: { s: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
        layers: [
          {
            id: 'L',
            type: 'symbol',
            source: 's',
            layout: { 'text-field': 'name', 'text-font': ['Arial'] },
          },
        ],
        glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf',
      });
    });
    const result = await downloadStyles('https://example.com/with-text.json', {
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
  });

  it('records a non-fatal error when glyph download fails', async () => {
    // Style with text layers is returned, but glyph fetches reject.
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes('fontstack') || url.endsWith('.pbf')) {
        throw new Error('glyph fetch failed');
      }
      return okJson({
        version: 8,
        id: 'glyph-fail',
        sources: { s: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
        layers: [
          {
            id: 'L',
            type: 'symbol',
            source: 's',
            layout: { 'text-field': 'name', 'text-font': ['Arial'] },
          },
        ],
        glyphs: 'https://fonts.example.com/{fontstack}/{range}.pbf',
      });
    });
    const result = await downloadStyles('https://example.com/glyph-fail.json', {
      validateStyle: false,
      skipExisting: false,
    });
    // The call still succeeds overall — glyph errors are non-fatal.
    expect(result.success).toBe(true);
  });

  it('skips sprite sources that contain non-HTTP URLs', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes('idb-sprite')) {
        return okJson({
          version: 8,
          id: 'idb-sprite',
          name: 'IDB Sprite',
          sources: {},
          layers: [{ id: 'L', type: 'background' }],
          sprite: 'idb://style/sprite',
        });
      }
      return okJson({});
    });
    const result = await downloadStyles('https://example.com/idb-sprite.json', {
      validateStyle: false,
      skipExisting: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('StyleService.downloadStyleWithProvider', () => {
  beforeEach(async () => {
    mockFetchWithRetry.mockReset();
    mockFetchResourceWithRetry.mockReset();
    const db = await dbPromise;
    await db.clear('styles');
  });

  it('downloads with an explicit provider and stores the style', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        name: 'Explicit Provider',
        sources: { s1: { type: 'vector', tiles: ['https://t/{z}/{x}/{y}.pbf'] } },
        layers: [{ id: 'L', type: 'background' }],
      })
    );
    const result = await downloadStyleWithProvider('https://example.com/style.json', {
      provider: 'maplibre',
      enableSourceEmbedding: false,
      forceProvider: true,
    });
    expect(result.success).toBe(true);
    expect(result.styleId).toBe('explicit-provider');
  });

  it('throws when a mapbox:// URL has no token', async () => {
    const result = await downloadStyleWithProvider('mapbox://styles/mapbox/streets-v11');
    expect(result.success).toBe(false);
    expect(result.errors.join('\n')).toMatch(/access token/i);
  });

  it('resolves mapbox:// URLs when a token is provided', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        name: 'MB Streets',
        sources: {},
        layers: [{ id: 'L', type: 'background' }],
      })
    );
    const result = await downloadStyleWithProvider('mapbox://styles/mapbox/streets-v11', {
      accessToken: 'pk.fake',
      forceProvider: true,
      enableSourceEmbedding: false,
    });
    expect(result.success).toBe(true);
    const urlsFetched = mockFetchWithRetry.mock.calls.map(c => c[0]);
    expect(urlsFetched[0]).toMatch(/api\.mapbox\.com/);
  });

  it('returns failure when response is not ok', async () => {
    mockFetchWithRetry.mockResolvedValue(
      new Response(null, { status: 500, statusText: 'boom' })
    );
    const result = await downloadStyleWithProvider('https://example.com/bad.json');
    expect(result.success).toBe(false);
  });

  it('skips when skipExisting and the style already exists', async () => {
    const db = await dbPromise;
    await db.put('styles', {
      key: 'pre-existing',
      style: { version: 8, sources: {}, layers: [] },
      provider: 'auto',
      regions: [],
      fonts: [],
      glyphs: [],
      sprites: [],
    } as never);

    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        name: 'Pre Existing',
        sources: {},
        layers: [{ id: 'L', type: 'background' }],
      })
    );
    const result = await downloadStyleWithProvider('https://example.com/pre-existing.json', {
      skipExisting: true,
      forceProvider: true,
      enableSourceEmbedding: false,
    });
    expect(result.success).toBe(true);
  });

  it('embeds TileJSON into sources when enableSourceEmbedding is true', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes('src.json')) {
        return okJson({
          tiles: ['https://t/{z}/{x}/{y}.pbf'],
          minzoom: 0,
          maxzoom: 14,
          name: 'Ignored',
        });
      }
      return okJson({
        version: 8,
        name: 'WithEmbed',
        sources: { s1: { type: 'vector', url: 'https://example.com/src.json' } },
        layers: [{ id: 'L', type: 'background' }],
      });
    });
    const result = await downloadStyleWithProvider('https://example.com/WithEmbed.json', {
      enableSourceEmbedding: true,
      forceProvider: true,
    });
    expect(result.success).toBe(true);
    expect(result.sourcesEmbedded).toBe(1);
  });

  it('skips idb:// source URLs when embedding', async () => {
    mockFetchWithRetry.mockImplementation(async () =>
      okJson({
        version: 8,
        name: 'IdbStyle',
        sources: { s1: { type: 'vector', url: 'idb://style/src' } },
        layers: [{ id: 'L', type: 'background' }],
      })
    );
    const result = await downloadStyleWithProvider('https://example.com/idb.json', {
      enableSourceEmbedding: true,
      forceProvider: true,
    });
    expect(result.success).toBe(true);
    expect(result.sourcesEmbedded).toBe(0);
  });

  it('still returns success when a source embedding fetch fails', async () => {
    mockFetchWithRetry.mockImplementation(async (url: string) => {
      if (url.includes('bad-source')) throw new Error('nope');
      return okJson({
        version: 8,
        name: 'Embed Fail',
        sources: { s1: { type: 'vector', url: 'https://example.com/bad-source.json' } },
        layers: [{ id: 'L', type: 'background' }],
      });
    });
    const result = await downloadStyleWithProvider('https://example.com/embed-fail.json', {
      enableSourceEmbedding: true,
      forceProvider: true,
    });
    expect(result.success).toBe(true);
    expect(result.sourcesEmbedded).toBe(0);
  });
});
