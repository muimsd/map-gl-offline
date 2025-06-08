/**
 * Header component for the offline manager
 */

import { icons } from '../utils/icons';
import { Theme, themeManager } from './themes';
import { createButton } from './components';

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
    theme = themeManager.getTheme(),
  } = props;

  const themeToggleHandler = onThemeToggle || onToggleTheme;

  const header = document.createElement('div');
  
  const headerStyles: Partial<CSSStyleDeclaration> = {
    background: `linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary-dark) 100%)`,
    color: 'var(--theme-text-inverse)',
    padding: 'var(--theme-spacing-xl)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--theme-spacing-sm)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '80px',
  };

  Object.assign(header.style, headerStyles);

  const titleSection = document.createElement('div');
  titleSection.style.flex = '1';
  titleSection.innerHTML = `
    <h2 style="
      margin: 0 0 var(--theme-spacing-xs) 0;
      font-size: var(--theme-font-size-lg);
      font-weight: var(--theme-font-weight-semibold);
      color: var(--theme-text-inverse);
      line-height: var(--theme-line-height-tight);
      font-family: var(--theme-font-family);
    ">
      ${title}
    </h2>
    <p style="
      margin: 0;
      opacity: 0.9;
      font-size: var(--theme-font-size-xs);
      color: var(--theme-text-inverse);
      line-height: var(--theme-line-height-normal);
      font-family: var(--theme-font-family);
    ">
      ${subtitle}
    </p>
  `;

  const actionsSection = document.createElement('div');
  actionsSection.style.display = 'flex';
  actionsSection.style.gap = 'var(--theme-spacing-xs)';
  actionsSection.style.alignItems = 'center';

  // Theme toggle button
  if (showThemeToggle) {
    const themeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: theme.mode === 'light' ? 'moon' : 'sun',
      children: '',
      onClick: () => {
        themeManager.toggleTheme();
        onThemeToggle?.();
      },
      style: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: theme.colors.textInverse,
        width: '36px',
        height: '36px',
        padding: '0',
        borderRadius: '50%',
        backdropFilter: 'blur(10px)',
      },
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
      style: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: theme.colors.textInverse,
        width: '36px',
        height: '36px',
        padding: '0',
        borderRadius: '50%',
        backdropFilter: 'blur(10px)',
      },
    });
    actionsSection.appendChild(closeButton);
  }

  header.appendChild(titleSection);
  header.appendChild(actionsSection);

  return header;
}
