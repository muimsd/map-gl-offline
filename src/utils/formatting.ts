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
