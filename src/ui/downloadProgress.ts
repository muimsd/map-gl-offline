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

  const headerStyles: Partial<CSSStyleDeclaration> = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.info,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  };

  const header = document.createElement('div');
  Object.assign(header.style, headerStyles);
  header.innerHTML = `
    ${icons.download({ size: 16, color: theme.colors.info })}
    Active Downloads
  `;

  const progressList = document.createElement('div');
  progressList.style.display = 'grid';
  progressList.style.gap = theme.spacing.sm;

  for (const [regionId, progress] of downloads) {
    const progressCard = createCard({
      padding: 'sm',
      shadow: 'sm',
      children: `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${theme.spacing.sm};
          font-family: ${theme.typography.fontFamily};
        ">
          <span style="
            font-weight: ${theme.typography.fontWeight.semibold};
            color: ${theme.colors.text};
            font-size: ${theme.typography.fontSize.sm};
          ">
            ${regionId}
          </span>
          <span style="
            font-weight: ${theme.typography.fontWeight.bold};
            color: ${theme.colors.info};
            font-size: ${theme.typography.fontSize.sm};
          ">
            ${progress.percentage}%
          </span>
        </div>
        <div id="progress-${regionId}"></div>
        <div style="
          font-size: ${theme.typography.fontSize.xs};
          color: ${theme.colors.textMuted};
          margin-top: ${theme.spacing.xs};
          font-family: ${theme.typography.fontFamily};
        ">
          ${progress.currentResource}
        </div>
      `,
      theme,
    });

    // Add progress bar
    const progressElement = createProgress({
      value: progress.percentage,
      variant: 'primary',
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
      backgroundColor: `${theme.colors.info}08`,
      borderColor: `${theme.colors.info}20`,
      marginBottom: theme.spacing.xl,
    },
  });

  sectionCard.appendChild(header);
  sectionCard.appendChild(progressList);
  container.appendChild(sectionCard);

  return container;
}
