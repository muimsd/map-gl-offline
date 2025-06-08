/**
 * Download progress section for the offline manager
 */

import { icons } from '../../utils/icons';
import { Theme } from '../themes';
import { createCard, createProgress } from '../components';

export interface DownloadProgress {
  regionId: string;
  completed: number;
  total: number;
  percentage: number;
  currentResource: string;
}

export interface DownloadProgressSectionProps {
  downloads: Map<string, DownloadProgress>;
  theme?: Theme;
}

export function createDownloadProgressSection(props: DownloadProgressSectionProps): HTMLDivElement {
  const {
    downloads,
    theme,
  } = props;

  const container = document.createElement('div');

  if (downloads.size === 0) {
    container.style.display = 'none';
    return container;
  }

  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400 text-sm font-semibold';
  header.innerHTML = `
    ${icons.download({ size: 14, color: 'currentColor' })}
    Active Downloads
  `;

  const progressList = document.createElement('div');
  progressList.className = 'grid gap-2';

  for (const [regionId, progress] of downloads) {
    const progressCard = createCard({
      padding: 'sm',
      shadow: 'sm',
      children: `
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold text-gray-900 dark:text-white text-sm">
            ${regionId}
          </span>
          <span class="font-bold text-sm ${progress.percentage >= 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}">
            ${progress.percentage}%
          </span>
        </div>
        <div id="progress-${regionId}"></div>
        <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
          ${progress.currentResource}
        </div>
      `,
      theme,
    });

    // Add progress bar with dynamic color based on completion
    const progressElement = createProgress({
      value: progress.percentage,
      variant: progress.percentage >= 100 ? 'success' : 'primary',
      size: 'sm',
      theme,
    });

    const progressContainer = progressCard.querySelector(`#progress-${regionId}`) as HTMLElement;
    if (progressContainer) {
      progressContainer.appendChild(progressElement);
    }

    progressList.appendChild(progressCard);
  }

  const sectionCard = createCard({
    padding: 'md',
    shadow: 'sm',
    children: '',
    theme,
    className: 'bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-200 dark:border-blue-700 mb-6',
  });

  sectionCard.appendChild(header);
  sectionCard.appendChild(progressList);
  container.appendChild(sectionCard);

  return container;
}
