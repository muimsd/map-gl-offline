/**
 * Download progress tracking interface
 */
export interface DownloadProgress {
  completed: number;
  total: number;
  percentage: number;
  currentItem?: string;
  message?: string;
  errors: string[];
}


