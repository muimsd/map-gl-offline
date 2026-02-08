/**
 * Tests for formatting utilities
 */
import {
  formatBytes,
  formatDate,
} from '../../src/utils/formatting';

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
    expect(formatBytes(1023)).toBe('1023 Bytes');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10240)).toBe('10 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 5.5)).toBe('5.5 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.25)).toBe('2.25 GB');
  });

  it('should format terabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('should round to 2 decimal places', () => {
    expect(formatBytes(1234567)).toBe('1.18 MB');
  });
});

describe('formatDate', () => {
  it('should format timestamp to date string', () => {
    // Using a specific timestamp to get consistent results
    const timestamp = new Date('2024-01-15T12:00:00Z').getTime();
    const result = formatDate(timestamp);
    // The exact format depends on locale, but it should contain the date
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should format Date object to date string', () => {
    const date = new Date('2024-06-20T10:30:00Z');
    const result = formatDate(date);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

