/**
 * Download progress section for the offline manager
 */

import { icons } from '@/utils/icons';

export interface DownloadProgress {
  regionId: string;
  completed: number;
  total: number;
  percentage: number;
  currentResource: string;
}

export interface DownloadProgressSectionProps {
  downloads: Map<string, DownloadProgress>;
}

export function createDownloadProgressSection(props: DownloadProgressSectionProps): HTMLDivElement {
  const { downloads } = props;

  const container = document.createElement('div');

  if (downloads.size === 0) {
    container.style.display = 'none';
    return container;
  }

  const header = document.createElement('div');
  header.className =
    'flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400 text-sm font-semibold';
  header.innerHTML = `
    ${icons.download({ size: 14, color: 'currentColor' })}
    Active Downloads
  `;

  const progressList = document.createElement('div');
  progressList.className = 'grid gap-2';

  for (const [regionId, progress] of downloads) {
    // Create progress card with modern DOM creation
    const progressCard = document.createElement('div');
    progressCard.className =
      'p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm';

    progressCard.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span class="font-semibold text-gray-900 dark:text-white text-sm">
          ${regionId}
        </span>
        <span class="font-bold text-sm ${progress.percentage >= 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}">
          ${progress.percentage}%
        </span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
        <div class="h-2 ${progress.percentage >= 100 ? 'bg-green-600' : 'bg-blue-600'} rounded-full transition-all duration-300 ease-out" style="width: ${progress.percentage}%"></div>
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-400">
        ${progress.currentResource}
      </div>
    `;

    progressList.appendChild(progressCard);
  }

  // Create section card with modern DOM creation
  const sectionCard = document.createElement('div');
  sectionCard.className =
    'p-6 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm mb-6';

  sectionCard.appendChild(header);
  sectionCard.appendChild(progressList);
  container.appendChild(sectionCard);

  return container;
}
