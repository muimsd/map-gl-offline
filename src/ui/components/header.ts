/**
 * Header component for the offline manager
 */

import { icons } from '../../utils/icons';
import { Theme } from '../themes';
import { createButton } from '../components';

export interface HeaderProps {
  title: string;
  subtitle: string;
  onClose?: () => void;
  onThemeToggle?: () => void;
  onToggleTheme?: () => void;
  showThemeToggle?: boolean;
  theme?: Theme;
}

export function createHeader(props: HeaderProps): HTMLDivElement {
  const {
    title,
    subtitle,
    onClose,
    onThemeToggle,
    onToggleTheme,
    showThemeToggle = true,
  } = props;

  const themeToggleHandler = onThemeToggle || onToggleTheme;

  const header = document.createElement('div');
  header.className = 'bg-gradient-to-br from-blue-600 to-blue-800 text-white p-4 flex justify-between relative overflow-hidden min-h-[30px] pl-6';

  const titleSection = document.createElement('div');
  titleSection.innerHTML = `
    <h1 class="m-0 font-semibold text-white leading-normal">
      ${title}
    </h1>
    <p class="m-0 opacity-90 text-xs text-white leading-normal">
      ${subtitle}
    </p>
  `;

  const actionsSection = document.createElement('div');
  actionsSection.className = 'flex gap-1 items-center';

  // Theme toggle button
  if (showThemeToggle) {
    const themeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: 'moon', // Note: You might want to make this dynamic based on current theme
      children: '',
      onClick: () => {
        themeToggleHandler?.();
      },
      className: 'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
    });

    actionsSection.appendChild(themeButton);
  }

  // Close button
  if (onClose) {
    const closeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: 'x',
      children: '',
      onClick: onClose,
      className: 'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
    });

    actionsSection.appendChild(closeButton);
  }

  header.appendChild(titleSection);
  header.appendChild(actionsSection);

  return header;
}
