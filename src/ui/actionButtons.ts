/**
 * Action buttons section for the offline manager
 */

import { Theme, themeManager } from './themes';
import { createButton } from './components';

export interface ActionButtonsProps {
  onAddRegion?: () => void;
  onCleanup?: () => void;
  onRefresh?: () => void;
  theme?: Theme;
}

export function createActionButtons(props: ActionButtonsProps): HTMLDivElement {
  const {
    onAddRegion,
    onCleanup,
    theme = themeManager.getTheme(),
  } = props;

  const container = document.createElement('div');
  
  const containerStyles: Partial<CSSStyleDeclaration> = {
    display: 'flex',
    gap: 'var(--theme-spacing-md)',
    marginBottom: 'var(--theme-spacing-xl)',
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  Object.assign(container.style, containerStyles);

  // Add new region button - using green accent color
  const addButton = createButton({
    variant: 'primary',
    size: 'md',
    icon: 'plus',
    children: 'Add New Region',
    onClick: onAddRegion,
    style: {
      background: `linear-gradient(135deg, var(--theme-success), var(--theme-success-hover))`,
      color: 'white',
      border: 'none',
      fontSize: 'var(--theme-font-size-md)',
      padding: 'var(--theme-spacing-md) var(--theme-spacing-lg)',
      borderRadius: 'var(--theme-radius-md)',
      fontWeight: 'var(--theme-font-weight-semibold)',
      boxShadow: 'var(--theme-shadow-md)',
      transition: 'all 0.2s ease',
      minWidth: '160px',
    },
  });

  // Refresh button - with purple accent
  const refreshButton = createButton({
    variant: 'secondary',
    size: 'md',
    icon: 'refresh',
    children: 'Refresh',
    onClick: props.onRefresh,
    style: {
      background: 'var(--theme-surface)',
      color: 'var(--theme-primary)',
      border: '1px solid var(--theme-primary)',
      fontSize: 'var(--theme-font-size-md)',
      padding: 'var(--theme-spacing-md) var(--theme-spacing-lg)',
      borderRadius: 'var(--theme-radius-md)',
      fontWeight: 'var(--theme-font-weight-semibold)',
      boxShadow: 'var(--theme-shadow-md)',
      transition: 'all 0.2s ease',
      minWidth: '120px',
    },
  });

  container.appendChild(addButton);
  container.appendChild(refreshButton);

  return container;
}
