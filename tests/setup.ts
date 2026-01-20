// Jest setup file for testing environment

// Polyfill structuredClone for Node.js versions that don't have it
if (typeof structuredClone === 'undefined') {
  (globalThis as Record<string, unknown>).structuredClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  };
}

import 'fake-indexeddb/auto';

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
