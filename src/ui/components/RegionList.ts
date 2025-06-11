/**
 * Regions list component for the offline manager - Modern, compact design
 * Refactored to use modular Button components
 */

import { icons } from '../../utils/icons';
import { Button } from './shared/Button';
import { BaseComponent } from './shared/BaseComponent';
import type { StoredRegion } from '../../types';

export interface RegionsListProps {
  regions: StoredRegion[];
  onDeleteRegion?: (regionId: string) => void;
  onShowRegionDetails?: (regionId: string) => void;
  onFocusRegion?: (regionId: string) => void;
  onImportExport?: (regionId: string) => void;
  formatBytes?: (bytes: number) => string;
}

export class RegionsList extends BaseComponent {
  private props: RegionsListProps;

  constructor(props: RegionsListProps) {
    super({});
    this.props = props;
    this.render();
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'p-0 bg-white dark:bg-gray-900';
    return container;
  }

  public updateRegions(regions: StoredRegion[]): void {
    this.props = { ...this.props, regions };
    this.render();
  }

  private render(): void {
    // Clear existing content
    this.element.innerHTML = '';

    // Header
    const header = document.createElement('h3');
    header.className = 'm-0 mb-6 text-xl font-semibold text-gray-900 dark:text-white';
    header.textContent = 'Downloaded Regions';
    this.element.appendChild(header);

    // Empty state
    if (this.props.regions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-center p-8 text-gray-500 dark:text-gray-400';
      emptyState.innerHTML = `
        <div class="mb-4">
          ${icons.mapPin({ size: 48, color: 'rgb(156 163 175)' })}
        </div>
        <p class="text-lg font-medium mb-2">No offline regions downloaded yet</p>
        <p class="text-sm">Click "Add Region" to start downloading map areas for offline use.</p>
      `;
      this.element.appendChild(emptyState);
      return;
    }

    // Regions grid
    const regionsGrid = document.createElement('div');
    regionsGrid.className = 'grid grid-cols-1 gap-4';

    for (const region of this.props.regions) {
      const regionCard = this.createRegionCard(region);
      regionsGrid.appendChild(regionCard);
    }

    this.element.appendChild(regionsGrid);
  }

  private createRegionCard(region: StoredRegion): HTMLElement {
    const regionCard = document.createElement('div');
    regionCard.className = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer';

    // Card header with title and actions
    const cardHeader = document.createElement('div');
    cardHeader.className = 'flex justify-between items-center';

    // Region info
    const regionInfo = document.createElement('div');
    regionInfo.className = 'flex-1 min-w-0';

    const regionName = document.createElement('h4');
    regionName.className = 'm-0 mb-2 text-lg font-semibold text-gray-900 dark:text-white truncate';
    regionName.textContent = region.name || region.id;

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
    const actionButtons = this.createRegionActions(region);

    cardHeader.appendChild(regionInfo);
    cardHeader.appendChild(actionButtons);

    regionCard.appendChild(cardHeader);

    // Click handler for region details
    regionCard.addEventListener('click', () => {
      this.props.onShowRegionDetails?.(region.id);
    });

    return regionCard;
  }

  private createRegionActions(region: StoredRegion): HTMLElement {
    const actionButtons = document.createElement('div');
    actionButtons.className = 'flex gap-1 flex-shrink-0';

    // Focus button
    if (this.props.onFocusRegion) {
      const focusButton = new Button({
        text: 'Focus',
        variant: 'primary',
        size: 'sm',
        icon: icons.focus({ size: 10 }),
        className: 'px-2 py-1 text-xs',
        onClick: () => {
          this.props.onFocusRegion!(region.id);
        }
      });
      
      // Prevent event bubbling
      focusButton.getElement().addEventListener('click', (e) => e.stopPropagation());
      actionButtons.appendChild(focusButton.getElement());
    }

    // Import/Export button
    if (this.props.onImportExport) {
      const importExportButton = new Button({
        text: 'I/E',
        variant: 'success',
        size: 'sm',
        icon: icons.deviceFloppy({ size: 10 }),
        className: 'px-2 py-1 text-xs',
        title: 'Import/Export Region',
        onClick: () => {
          this.props.onImportExport!(region.id);
        }
      });
      
      // Prevent event bubbling
      importExportButton.getElement().addEventListener('click', (e) => e.stopPropagation());
      actionButtons.appendChild(importExportButton.getElement());
    }

    // Delete button
    if (this.props.onDeleteRegion) {
      const deleteButton = new Button({
        text: 'Delete',
        variant: 'danger',
        size: 'sm',
        icon: icons.trash({ size: 10 }),
        className: 'px-2 py-1 text-xs',
        onClick: () => {
          this.props.onDeleteRegion!(region.id);
        }
      });
      
      // Prevent event bubbling
      deleteButton.getElement().addEventListener('click', (e) => e.stopPropagation());
      actionButtons.appendChild(deleteButton.getElement());
    }

    return actionButtons;
  }
}

// Keep backward compatibility with function-based approach
export function createRegionsList(props: RegionsListProps): HTMLDivElement {
  const regionsList = new RegionsList(props);
  return regionsList.getElement() as HTMLDivElement;
}
