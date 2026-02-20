/**
 * Action buttons section for the offline manager
 * Refactored to use modular components
 */

import { icons } from '@/utils/icons';
import { Theme } from '@/ui/ThemeManager';
import { Button } from './shared/Button';

export interface ActionButtonsProps {
  onAddRegion?: () => void;
  onCleanup?: () => void;
  onRefresh?: () => void;
  theme?: Theme;
}

export function createActionButtons(props: ActionButtonsProps): HTMLDivElement {
  const { onAddRegion, onRefresh } = props;

  const container = document.createElement('div');
  container.className = 'flex gap-4 mb-8 flex-wrap items-center';

  // Add new region button - using green accent color
  if (onAddRegion) {
    const addButton = new Button({
      variant: 'success',
      size: 'md',
      text: 'Add New Region',
      icon: icons.plus({ size: 16, color: 'white' }),
      onClick: onAddRegion,
      className:
        'bg-gradient-to-r from-green-600 to-green-700 text-white border-0 text-base px-4 py-3 rounded-md font-semibold shadow-md transition-all duration-200 min-w-[100px] hover:from-green-700 hover:to-green-800',
    });

    container.appendChild(addButton.getElement());
  }

  // Refresh button - with purple accent
  if (onRefresh) {
    const refreshButton = new Button({
      variant: 'secondary',
      size: 'md',
      text: 'Refresh',
      icon: icons.refresh({ size: 16, color: 'currentColor' }),
      onClick: onRefresh,
      className:
        'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 text-base px-3 py-2 rounded-md font-semibold shadow-md transition-all duration-200 min-w-[80px] hover:bg-blue-50 dark:hover:bg-blue-900/20',
    });

    container.appendChild(refreshButton.getElement());
  }

  return container;
}
