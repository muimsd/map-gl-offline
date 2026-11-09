/**
 * Formatting utilities for the offline manager
 */

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return '-' + formatBytes(-bytes);

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * A stored style's display name: its own `name`, or else the last meaningful
 * part of its URL ("liberty" for `.../styles/liberty`), or else its key.
 */
export function styleDisplayName(entry: {
  key: string;
  originalUrl?: string;
  style?: { name?: string };
}): string {
  if (entry.style?.name) return entry.style.name;
  const path = (entry.originalUrl ?? '').split(/[?#]/)[0];
  const segments = path
    .split('/')
    .map(segment => segment.replace(/\.json$/i, ''))
    .filter(segment => segment && !/^(style|styles)$/i.test(segment) && !segment.includes(':'));
  return segments.at(-1) ?? entry.key;
}

/**
 * Format date to human readable string
 */
export function formatDate(date: number | Date): string {
  if (typeof date === 'number') {
    return new Date(date).toLocaleDateString();
  }
  return date.toLocaleDateString();
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: unknown): string {
  const str = String(unsafe ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
