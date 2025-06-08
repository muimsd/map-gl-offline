export type DownloadOptions = {
  onProgress: (progress: {
    completed: number;
    total: number;
    percentage?: number;
    currentTile?: string;
    currentFont?: string;
  }) => void;
  [key: string]: any;
};
