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
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  };

  Object.assign(container.style, containerStyles);

  // Add new region button
  const addButton = createButton({
    variant: 'primary',
    size: 'md',
    icon: 'mapPin',
    children: 'Add New Region',
    onClick: onAddRegion,
    style: {
      background: `linear-gradient(135deg, ${theme.colors.success} 0%, ${theme.colors.successHover} 100%)`,
      boxShadow: `0 4px 12px ${theme.colors.success}30`,
    },
  });

  // Cleanup button
  const cleanupButton = createButton({
    variant: 'warning',
    size: 'md',
    icon: 'cleaning',
    children: 'Cleanup',
    onClick: onCleanup,
    style: {
      background: `linear-gradient(135deg, ${theme.colors.warning} 0%, ${theme.colors.warningHover} 100%)`,
      boxShadow: `0 4px 12px ${theme.colors.warning}30`,
    },
  });

  container.appendChild(addButton);
  container.appendChild(cleanupButton);

  return container;
}
