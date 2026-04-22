// Jest setup file for testing environment

// Polyfill TextEncoder/TextDecoder (jsdom's util versions) — some source
// paths (e.g. HTML-detection in tileService) use them and fail in plain
// Node's jsdom environment.
if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder: NodeEncoder, TextDecoder: NodeDecoder } = require('util');
  if (typeof TextEncoder === 'undefined') {
    (globalThis as Record<string, unknown>).TextEncoder = NodeEncoder;
  }
  if (typeof TextDecoder === 'undefined') {
    (globalThis as Record<string, unknown>).TextDecoder = NodeDecoder;
  }
}

// Polyfill structuredClone for Node.js versions that don't have it
// Note: JSON.parse/JSON.stringify does NOT work for ArrayBuffer/TypedArray
if (typeof structuredClone === 'undefined') {
  (globalThis as Record<string, unknown>).structuredClone = <T>(obj: T): T => {
    // Handle ArrayBuffer
    if (obj instanceof ArrayBuffer) {
      const copy = new ArrayBuffer(obj.byteLength);
      new Uint8Array(copy).set(new Uint8Array(obj));
      return copy as unknown as T;
    }

    // Handle TypedArrays
    if (ArrayBuffer.isView(obj)) {
      const arr = obj as unknown as Uint8Array;
      const bufferCopy = (globalThis as unknown as { structuredClone: <T>(obj: T) => T }).structuredClone(
        arr.buffer as ArrayBuffer
      );
      const copy = new (arr.constructor as new (buffer: ArrayBuffer) => Uint8Array)(bufferCopy);
      return copy as unknown as T;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        (globalThis as unknown as { structuredClone: <T>(obj: T) => T }).structuredClone(item)
      ) as unknown as T;
    }

    // Handle objects with ArrayBuffer properties
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = (globalThis as unknown as { structuredClone: <T>(obj: T) => T }).structuredClone(value);
      }
      return result as T;
    }

    // Primitives
    return obj;
  };
}

import 'fake-indexeddb/auto';

// Ensure Response and Headers are available globally
// jsdom should provide these, but they might not be available in all contexts
if (typeof Response === 'undefined') {
  // Basic Response polyfill for Node.js environments
  class ResponsePolyfill {
    body: ReadableStream | null;
    bodyUsed: boolean;
    headers: Headers;
    ok: boolean;
    redirected: boolean;
    status: number;
    statusText: string;
    type: ResponseType;
    url: string;
    private _body: string | ArrayBuffer;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this._body = typeof body === 'string' ? body : (body as ArrayBuffer) || '';
      this.body = null;
      this.bodyUsed = false;
      this.headers = new Headers(init?.headers);
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.ok = this.status >= 200 && this.status < 300;
      this.redirected = false;
      this.type = 'default';
      this.url = '';
    }

    clone(): ResponsePolyfill {
      return new ResponsePolyfill(this._body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers,
      });
    }

    async text(): Promise<string> {
      return typeof this._body === 'string' ? this._body : '';
    }

    async json(): Promise<unknown> {
      const text = await this.text();
      return JSON.parse(text);
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      if (this._body instanceof ArrayBuffer) {
        return this._body;
      }
      const encoder = new TextEncoder();
      return encoder.encode(String(this._body)).buffer as ArrayBuffer;
    }

    async blob(): Promise<Blob> {
      const buffer = await this.arrayBuffer();
      return new Blob([buffer]);
    }

    async formData(): Promise<FormData> {
      return new FormData();
    }
  }

  (globalThis as Record<string, unknown>).Response = ResponsePolyfill;
}

// Mock fetch for testing
global.fetch = jest.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
  jest.clearAllMocks();
});
