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
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
    color: theme.colors.textInverse,
    padding: theme.spacing.xl,
    borderRadius: `${theme.radii.xl} ${theme.radii.xl} 0 0`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.lg,
  };

  Object.assign(header.style, headerStyles);

  const titleSection = document.createElement('div');
  titleSection.style.flex = '1';
  titleSection.innerHTML = `
    <h2 style="
      margin: 0 0 ${theme.spacing.xs} 0;
      font-size: ${theme.typography.fontSize.xl};
      font-weight: ${theme.typography.fontWeight.bold};
      color: ${theme.colors.textInverse};
      line-height: ${theme.typography.lineHeight.tight};
      font-family: ${theme.typography.fontFamily};
    ">
      ${title}
    </h2>
    <p style="
      margin: 0;
      opacity: 0.9;
      font-size: ${theme.typography.fontSize.sm};
      color: ${theme.colors.textInverse};
      line-height: ${theme.typography.lineHeight.normal};
      font-family: ${theme.typography.fontFamily};
    ">
      ${subtitle}
    </p>
  `;

  const actionsSection = document.createElement('div');
  actionsSection.style.display = 'flex';
  actionsSection.style.gap = theme.spacing.sm;
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
