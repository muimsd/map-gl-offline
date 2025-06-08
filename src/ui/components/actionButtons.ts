/**
 * Action buttons section for the offline manager
 */

import { Theme } from '../themes';
import { createButton } from '../components';

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
  } = props;

  const container = document.createElement('div');
  container.className = 'flex gap-4 mb-8 flex-wrap items-center';

  // Add new region button - using green accent color
  const addButton = createButton({
    variant: 'success',
    size: 'md',
    icon: 'plus',
    children: 'Add New Region',
    onClick: onAddRegion,
    className: 'bg-gradient-to-r from-green-600 to-green-700 text-white border-0 text-base px-4 py-3 rounded-md font-semibold shadow-md transition-all duration-200 min-w-[100px] hover:from-green-700 hover:to-green-800',
  });

  // Refresh button - with purple accent
  const refreshButton = createButton({
    variant: 'secondary',
    size: 'md',
    icon: 'refresh',
    children: 'Refresh',
    onClick: props.onRefresh,
    className: 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 text-base px-3 py-2 rounded-md font-semibold shadow-md transition-all duration-200 min-w-[80px] hover:bg-blue-50 dark:hover:bg-blue-900/20',
  });

  container.appendChild(addButton);
  container.appendChild(refreshButton);

  return container;
}
