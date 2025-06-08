/**
 * Download progress section for the offline manager
 */

import { icons } from '../utils/icons';
import { Theme, themeManager } from './themes';
import { createCard, createProgress } from './components';

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
    theme = themeManager.getTheme(),
  } = props;

  const container = document.createElement('div');

  if (downloads.size === 0) {
    container.style.display = 'none';
    return container;
  }

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--theme-spacing-sm);
    margin-bottom: var(--theme-spacing-md);
    color: var(--theme-primary);
    font-family: var(--theme-font-family);
    font-size: var(--theme-font-size-md);
    font-weight: var(--theme-font-weight-semibold);
  `;
  header.innerHTML = `
    ${icons.download({ size: 14, color: 'var(--theme-primary)' })}
    Active Downloads
  `;

  const progressList = document.createElement('div');
  progressList.style.cssText = `
    display: grid;
    gap: var(--theme-spacing-sm);
  `;

  for (const [regionId, progress] of downloads) {
    const progressCard = createCard({
      padding: 'sm',
      shadow: 'sm',
      children: `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--theme-spacing-sm);
          font-family: var(--theme-font-family);
        ">
          <span style="
            font-weight: var(--theme-font-weight-semibold);
            color: var(--theme-text);
            font-size: var(--theme-font-size-sm);
          ">
            ${regionId}
          </span>
          <span style="
            font-weight: var(--theme-font-weight-bold);
            color: ${progress.percentage >= 100 ? 'var(--theme-success)' : 'var(--theme-primary)'};
            font-size: var(--theme-font-size-sm);
          ">
            ${progress.percentage}%
          </span>
        </div>
        <div id="progress-${regionId}"></div>
        <div style="
          font-size: var(--theme-font-size-xs);
          color: var(--theme-text-muted);
          margin-top: var(--theme-spacing-xs);
          font-family: var(--theme-font-family);
        ">
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
    style: {
      background: `linear-gradient(135deg, var(--theme-primary-light), var(--theme-background))`,
      borderColor: 'var(--theme-primary)',
      marginBottom: 'var(--theme-spacing-xl)',
    },
  });

  sectionCard.appendChild(header);
  sectionCard.appendChild(progressList);
  container.appendChild(sectionCard);

  return container;
}
