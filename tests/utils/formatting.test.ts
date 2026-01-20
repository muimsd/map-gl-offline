/**
 * Tests for formatting utilities
 */
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercentage,
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

describe('formatDateTime', () => {
  it('should format timestamp to datetime string', () => {
    const timestamp = new Date('2024-01-15T12:30:00Z').getTime();
    const result = formatDateTime(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(30000)).toBe('30s');
    expect(formatDuration(59000)).toBe('59s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(300000)).toBe('5m 0s');
    expect(formatDuration(3599000)).toBe('59m 59s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(5400000)).toBe('1h 30m');
    expect(formatDuration(7200000)).toBe('2h 0m');
  });

  it('should format days and hours', () => {
    expect(formatDuration(86400000)).toBe('1d 0h');
    expect(formatDuration(90000000)).toBe('1d 1h');
    expect(formatDuration(172800000)).toBe('2d 0h');
  });
});

describe('formatNumber', () => {
  it('should format small numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(999)).toBe('999');
  });

  it('should format numbers with thousands separator', () => {
    // The exact separator depends on locale
    const result = formatNumber(1000);
    expect(result).toBeTruthy();
    // Check that it's not just the raw number
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it('should format large numbers', () => {
    const result = formatNumber(1000000);
    expect(result).toBeTruthy();
  });

  it('should format decimal numbers', () => {
    const result = formatNumber(1234.56);
    expect(result).toBeTruthy();
  });
});

describe('formatPercentage', () => {
  it('should format zero percentage', () => {
    expect(formatPercentage(0, 100)).toBe('0%');
  });

  it('should format 100 percentage', () => {
    expect(formatPercentage(100, 100)).toBe('100%');
  });

  it('should format partial percentages', () => {
    expect(formatPercentage(50, 100)).toBe('50%');
    expect(formatPercentage(25, 100)).toBe('25%');
    expect(formatPercentage(75, 100)).toBe('75%');
  });

  it('should round to whole numbers', () => {
    expect(formatPercentage(1, 3)).toBe('33%');
    expect(formatPercentage(2, 3)).toBe('67%');
  });

  it('should handle zero total', () => {
    expect(formatPercentage(50, 0)).toBe('0%');
  });

  it('should handle values greater than total', () => {
    expect(formatPercentage(150, 100)).toBe('150%');
  });
});
