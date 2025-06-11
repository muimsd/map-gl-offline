/**
 * Header component for the offline manager
 * Refactored to use modular components
 */

import { icons } from '../../utils/icons';
import { Theme } from '../ThemeManager';
import { Button } from './shared/Button';

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
  if (showThemeToggle && themeToggleHandler) {
    const themeButton = new Button({
      className: 'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
      icon: icons.moon({ size: 16, color: 'white' }),
      title: 'Toggle theme',
      onClick: themeToggleHandler
    });

    actionsSection.appendChild(themeButton.getElement());
  }

  // Close button
  if (onClose) {
    const closeButton = new Button({
      className: 'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
      icon: icons.x({ size: 16, color: 'white' }),
      title: 'Close',
      onClick: onClose
    });

    actionsSection.appendChild(closeButton.getElement());
  }

  header.appendChild(titleSection);
  header.appendChild(actionsSection);

  return header;
}
