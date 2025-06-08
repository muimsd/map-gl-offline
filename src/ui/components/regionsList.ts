/**
 * Regions list component for the offline manager - Modern, compact design
 */

import { icons } from '../../utils/icons';
import { Theme } from '../themes';
import type { StoredRegion } from '../../types';

export interface RegionsListProps {
  regions: StoredRegion[];
  onDeleteRegion?: (regionId: string) => void;
  onShowRegionDetails?: (regionId: string) => void;
  onFocusRegion?: (regionId: string) => void;
  formatBytes?: (bytes: number) => string;
  theme?: Theme;
}

export function createRegionsList(props: RegionsListProps): HTMLDivElement {
  const {
    regions,
    onDeleteRegion,
    onShowRegionDetails,
    onFocusRegion,
  } = props;

  const container = document.createElement('div');
  container.className = 'p-0 bg-white dark:bg-gray-900';

  // Header
  const header = document.createElement('h3');
  header.className = 'm-0 mb-6 text-xl font-semibold text-gray-900 dark:text-white';
  header.textContent = 'Downloaded Regions';
  container.appendChild(header);

  // Empty state
  if (regions.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'text-center p-8 text-gray-500 dark:text-gray-400';
    emptyState.innerHTML = `
      <div class="text-4xl mb-3">
        ${icons.deviceMobile({ size: 36, color: 'currentColor' })}
      </div>
      <h4 class="m-0 mb-1 text-sm font-medium text-gray-900 dark:text-white">
        No Downloaded Regions
      </h4>
      <p class="m-0 text-xs text-gray-500 dark:text-gray-400">
        Add a new region to get started
      </p>
    `;
    container.appendChild(emptyState);
    return container;
  }

  // Regions grid
  const regionsGrid = document.createElement('div');
  regionsGrid.className = 'grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 mt-4';

  for (const region of regions) {
    const isExpired = region.expiry && Date.now() > region.expiry;
    const isDownloaded = true; // Assuming all regions in this list are downloaded
    
    const regionCard = document.createElement('div');
    const cardClasses = [
      'relative overflow-hidden p-6 cursor-pointer transition-all duration-200 rounded-lg shadow-md',
      'bg-white dark:bg-gray-800 border',
      isExpired 
        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
        : 'border-gray-200 dark:border-gray-700',
      'hover:transform hover:-translate-y-0.5 hover:shadow-lg'
    ].join(' ');
    regionCard.className = cardClasses;

    // Add download status indicator
    if (isDownloaded) {
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_0_2px_white] dark:shadow-[0_0_0_2px_rgb(31_41_55)]';
      regionCard.appendChild(statusIndicator);
    }

    // Add hover effect handlers
    regionCard.addEventListener('mouseenter', () => {
      regionCard.classList.add('shadow-lg', '-translate-y-0.5');
      if (isExpired) {
        regionCard.classList.remove('border-red-300', 'dark:border-red-700');
        regionCard.classList.add('border-red-500', 'dark:border-red-500');
      } else {
        regionCard.classList.remove('border-gray-200', 'dark:border-gray-700');
        regionCard.classList.add('border-green-500', 'dark:border-green-500');
      }
    });

    regionCard.addEventListener('mouseleave', () => {
      regionCard.classList.remove('shadow-lg', '-translate-y-0.5');
      if (isExpired) {
        regionCard.classList.remove('border-red-500', 'dark:border-red-500');
        regionCard.classList.add('border-red-300', 'dark:border-red-700');
      } else {
        regionCard.classList.remove('border-green-500', 'dark:border-green-500');
        regionCard.classList.add('border-gray-200', 'dark:border-gray-700');
      }
    });

    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'flex justify-between items-start mb-1 gap-3';

    // Region info
    const regionInfo = document.createElement('div');
    regionInfo.className = 'flex-1 min-w-0';

    const regionName = document.createElement('h4');
    regionName.className = 'm-0 mb-1 text-sm font-semibold text-gray-900 dark:text-white break-words leading-tight';
    regionName.textContent = region.name || region.id;

    // Expired badge (if applicable)
    if (isExpired) {
      const expiredBadge = document.createElement('span');
      expiredBadge.className = 'inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded-sm text-xs font-medium mb-1';
      expiredBadge.innerHTML = `
        ${icons.alertTriangle({ size: 10, color: 'white' })}
        EXPIRED
      `;
      regionInfo.appendChild(expiredBadge);
    }

    // Region metadata
    const regionMeta = document.createElement('div');
    regionMeta.className = 'flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-1';

    regionMeta.innerHTML = `
      <span class="flex items-center gap-1">
        ${icons.mapPin({ size: 10, color: 'currentColor' })}
        Z${region.minZoom}-${region.maxZoom}
      </span>
      <span class="flex items-center gap-1">
        ${icons.clock({ size: 10, color: 'currentColor' })}
        ${region.expiry ? new Date(region.expiry).toLocaleDateString() : 'No expiry'}
      </span>
    `;

    regionInfo.appendChild(regionName);
    regionInfo.appendChild(regionMeta);

    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'flex gap-1 flex-shrink-0';

    // Focus button
    const focusButton = document.createElement('button');
    focusButton.className = 'px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-sm text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors duration-200';
    focusButton.innerHTML = `${icons.focus({ size: 10 })} <span>Focus</span>`;
    focusButton.onclick = (e) => {
      e.stopPropagation();
      onFocusRegion?.(region.id);
    };

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'px-2 py-1 bg-red-600 hover:bg-red-700 text-white border-0 rounded-sm text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors duration-200';
    deleteButton.innerHTML = `${icons.trash({ size: 10 })} <span>Delete</span>`;
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      onDeleteRegion?.(region.id);
    };

    actionButtons.appendChild(focusButton);
    actionButtons.appendChild(deleteButton);

    cardHeader.appendChild(regionInfo);
    cardHeader.appendChild(actionButtons);

    regionCard.appendChild(cardHeader);

    // Click handler for region details
    regionCard.onclick = () => {
      onShowRegionDetails?.(region.id);
    };

    regionsGrid.appendChild(regionCard);
  }

  container.appendChild(regionsGrid);
  return container;
}
