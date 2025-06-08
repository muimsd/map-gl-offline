/**
 * Regions list component for the offline manager - Modern, compact design
 */

import { icons } from '../utils/icons';
import { Theme, themeManager } from './themes';
import type { StoredRegion } from '../types';

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
    theme = themeManager.getTheme(),
  } = props;

  const container = document.createElement('div');
  container.style.cssText = `
    padding: 0;
    background: var(--theme-background);
  `;

  // Header
  const header = document.createElement('h3');
  header.style.cssText = `
    margin: 0 0 var(--theme-spacing-lg) 0;
    font-size: var(--theme-font-size-xl);
    font-weight: var(--theme-font-weight-semibold);
    color: var(--theme-text);
    font-family: var(--theme-font-family);
  `;
  header.textContent = 'Downloaded Regions';
  container.appendChild(header);

  // Empty state
  if (regions.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = `
      text-align: center;
      padding: var(--theme-spacing-xl);
      color: var(--theme-text-muted);
    `;
    emptyState.innerHTML = `
      <div style="font-size: 36px; margin-bottom: var(--theme-spacing-sm);">
        ${icons.deviceMobile({ size: 36, color: 'var(--theme-text-muted)' })}
      </div>
      <h4 style="
        margin: 0 0 var(--theme-spacing-xs) 0;
        font-size: var(--theme-font-size-sm);
        font-weight: var(--theme-font-weight-medium);
        color: var(--theme-text);
      ">
        No Downloaded Regions
      </h4>
      <p style="
        margin: 0;
        font-size: var(--theme-font-size-xs);
        color: var(--theme-text-muted);
      ">
        Add a new region to get started
      </p>
    `;
    container.appendChild(emptyState);
    return container;
  }

  // Regions grid
  const regionsGrid = document.createElement('div');
  regionsGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--theme-spacing-lg);
    margin-top: var(--theme-spacing-md);
  `;

  for (const region of regions) {
    const isExpired = region.expiry && Date.now() > region.expiry;
    const isDownloaded = true; // Assuming all regions in this list are downloaded
    
    const regionCard = document.createElement('div');
    regionCard.style.cssText = `
      background: var(--theme-surface);
      border: 1px solid ${isExpired ? 'var(--theme-error-light)' : 'var(--theme-border)'};
      border-radius: var(--theme-radius-lg);
      padding: var(--theme-spacing-lg);
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: var(--theme-shadow-md);
      ${isExpired ? 'background-color: var(--theme-error-bg);' : ''}
      position: relative;
      overflow: hidden;
    `;

    // Add download status indicator
    if (isDownloaded) {
      const statusIndicator = document.createElement('div');
      statusIndicator.style.cssText = `
        position: absolute;
        top: var(--theme-spacing-sm);
        right: var(--theme-spacing-sm);
        width: 8px;
        height: 8px;
        background: var(--theme-success);
        border-radius: 50%;
        box-shadow: 0 0 0 2px var(--theme-surface);
      `;
      regionCard.appendChild(statusIndicator);
    }

    // Add hover effect with color-coded borders
    regionCard.addEventListener('mouseenter', () => {
      regionCard.style.transform = 'translateY(-1px)';
      regionCard.style.boxShadow = 'var(--theme-shadow-md)';
      if (isExpired) {
        regionCard.style.borderColor = 'var(--theme-error)';
      } else {
        regionCard.style.borderColor = 'var(--theme-success)';
      }
    });

    regionCard.addEventListener('mouseleave', () => {
      regionCard.style.transform = 'translateY(0)';
      regionCard.style.boxShadow = 'var(--theme-shadow-sm)';
      regionCard.style.borderColor = isExpired ? 'var(--theme-error-light)' : 'var(--theme-border)';
    });

    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--theme-spacing-xs);
      gap: var(--theme-spacing-sm);
    `;

    // Region info
    const regionInfo = document.createElement('div');
    regionInfo.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const regionName = document.createElement('h4');
    regionName.style.cssText = `
      margin: 0 0 var(--theme-spacing-xs) 0;
      font-size: var(--theme-font-size-sm);
      font-weight: var(--theme-font-weight-semibold);
      color: var(--theme-text);
      word-break: break-word;
      line-height: 1.3;
    `;
    regionName.textContent = region.name || region.id;

    // Expired badge (if applicable)
    if (isExpired) {
      const expiredBadge = document.createElement('span');
      expiredBadge.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: var(--theme-spacing-xs);
        padding: var(--theme-spacing-xs) var(--theme-spacing-sm);
        background: var(--theme-error);
        color: white;
        border-radius: var(--theme-radius-sm);
        font-size: var(--theme-font-size-xs);
        font-weight: var(--theme-font-weight-medium);
        margin-bottom: var(--theme-spacing-xs);
      `;
      expiredBadge.innerHTML = `
        ${icons.alertTriangle({ size: 10, color: 'white' })}
        EXPIRED
      `;
      regionInfo.appendChild(expiredBadge);
    }

    // Region metadata
    const regionMeta = document.createElement('div');
    regionMeta.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: var(--theme-spacing-sm);
      font-size: var(--theme-font-size-xs);
      color: var(--theme-text-muted);
      margin-bottom: var(--theme-spacing-xs);
    `;

    regionMeta.innerHTML = `
      <span style="display: flex; align-items: center; gap: var(--theme-spacing-xs);">
        ${icons.mapPin({ size: 10, color: 'var(--theme-text-muted)' })}
        Z${region.minZoom}-${region.maxZoom}
      </span>
      <span style="display: flex; align-items: center; gap: var(--theme-spacing-xs);">
        ${icons.clock({ size: 10, color: 'var(--theme-text-muted)' })}
        ${region.expiry ? new Date(region.expiry).toLocaleDateString() : 'No expiry'}
      </span>
    `;

    regionInfo.appendChild(regionName);
    regionInfo.appendChild(regionMeta);

    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = `
      display: flex;
      gap: var(--theme-spacing-xs);
      flex-shrink: 0;
    `;

    // Focus button
    const focusButton = document.createElement('button');
    focusButton.style.cssText = `
      padding: var(--theme-spacing-xs) var(--theme-spacing-sm);
      background: var(--theme-primary);
      color: white;
      border: none;
      border-radius: var(--theme-radius-sm);
      font-size: var(--theme-font-size-xs);
      font-weight: var(--theme-font-weight-medium);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--theme-spacing-xs);
      transition: background 0.2s ease;
    `;
    focusButton.innerHTML = `${icons.focus({ size: 10 })} <span>Focus</span>`;
    focusButton.onclick = (e) => {
      e.stopPropagation();
      onFocusRegion?.(region.id);
    };

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.style.cssText = `
      padding: var(--theme-spacing-xs) var(--theme-spacing-sm);
      background: var(--theme-error);
      color: white;
      border: none;
      border-radius: var(--theme-radius-sm);
      font-size: var(--theme-font-size-xs);
      font-weight: var(--theme-font-weight-medium);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--theme-spacing-xs);
      transition: background 0.2s ease;
    `;
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
