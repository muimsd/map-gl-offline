/**
 * Header component for the offline manager
 * Refactored to use modular components
 */

import { icons } from '../../utils/icons';
import { Theme, themeManager, ThemePreference } from '../ThemeManager';
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

/**
 * Get the appropriate icon for the current theme preference
 */
function getThemeIcon(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return icons.sun({ size: 16, color: 'white' });
    case 'dark':
      return icons.moon({ size: 16, color: 'white' });
    case 'system':
      return icons.deviceDesktop({ size: 16, color: 'white' });
    default:
      return icons.sun({ size: 16, color: 'white' });
  }
}

/**
 * Get the tooltip text for the theme toggle button
 */
function getThemeTooltip(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return 'Light theme (click for dark)';
    case 'dark':
      return 'Dark theme (click for system)';
    case 'system':
      return 'System theme (click for light)';
    default:
      return 'Toggle theme';
  }
}

export function createHeader(props: HeaderProps): HTMLDivElement {
  const { title, subtitle, onClose, onThemeToggle, onToggleTheme, showThemeToggle = true } = props;

  const themeToggleHandler = onThemeToggle || onToggleTheme;

  const header = document.createElement('div');
  header.className =
    'bg-gradient-to-br from-blue-600 to-blue-800 text-white p-4 flex justify-between relative overflow-hidden min-h-[30px] pl-6';

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
    const currentPreference = themeManager.getPreference();

    const themeButton = new Button({
      className:
        'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
      icon: getThemeIcon(currentPreference),
      title: getThemeTooltip(currentPreference),
      onClick: themeToggleHandler,
    });

    actionsSection.appendChild(themeButton.getElement());
  }

  // Close button
  if (onClose) {
    const closeButton = new Button({
      className:
        'w-9 h-9 p-0 bg-white/10 text-white rounded-full backdrop-blur-sm hover:bg-black/20 dark:hover:bg-white/20 transition-colors',
      icon: icons.x({ size: 16, color: 'white' }),
      title: 'Close',
      onClick: onClose,
    });

    actionsSection.appendChild(closeButton.getElement());
  }

  header.appendChild(titleSection);
  header.appendChild(actionsSection);

  return header;
}
