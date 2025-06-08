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
    padding: 'var(--theme-spacing-md)',
    display: 'flex',
    justifyContent: 'space-between',
    // alignItems: 'flex-start',
    // gap: 'var(--theme-spacing-sm)',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '30px',
    paddingLeft: 'var(--theme-spacing-lg)',
  };

  Object.assign(header.style, headerStyles);

  const titleSection = document.createElement('div');
  //   titleSection.style.flex = '1';
  titleSection.innerHTML = `
    <h1 style="
      margin: 0,
      font-weight: var(--theme-font-weight-semibold);
      color: var(--theme-text-inverse);
      line-height: var(--theme-line-height-normal);
      font-family: var(--theme-font-family);
    ">
      ${title}
    </h1>
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
        // Only call the callback, don't toggle theme directly here
        // The callback should handle the theme toggle
        themeToggleHandler?.();
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

    // Add hover effects based on theme
    const originalBg = 'rgba(255, 255, 255, 0.1)';
    const hoverBg = theme.mode === 'light' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';

    themeButton.addEventListener('mouseenter', () => {
      themeButton.style.backgroundColor = hoverBg;
    });

    themeButton.addEventListener('mouseleave', () => {
      themeButton.style.backgroundColor = originalBg;
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

    // Add hover effects based on theme
    const originalBg = 'rgba(255, 255, 255, 0.1)';
    const hoverBg = theme.mode === 'light' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = hoverBg;
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = originalBg;
    });

    actionsSection.appendChild(closeButton);
  }

  header.appendChild(titleSection);
  header.appendChild(actionsSection);

  return header;
}
