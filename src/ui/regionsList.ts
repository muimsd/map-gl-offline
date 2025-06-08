/**
 * Regions list component for the offline manager
 */

import { icons } from '../utils/icons';
import { Theme, themeManager } from './themes';
import { createCard, createButton, createBadge } from './components';
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

  // Header
  const header = document.createElement('h3');
  const headerStyles: Partial<CSSStyleDeclaration> = {
    margin: `0 0 ${theme.spacing.lg} 0`,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
  };
  Object.assign(header.style, headerStyles);
  header.textContent = 'Downloaded Regions';

  container.appendChild(header);

  // Empty state
  if (regions.length === 0) {
    const emptyState = createCard({
      padding: 'lg',
      shadow: 'sm',
      children: `
        <div style="text-align: center; color: ${theme.colors.textMuted};">
          <div style="font-size: 48px; margin-bottom: ${theme.spacing.lg};">
            ${icons.deviceMobile({ size: 48, color: theme.colors.textMuted })}
          </div>
          <h4 style="
            margin: 0 0 ${theme.spacing.sm} 0;
            font-size: ${theme.typography.fontSize.md};
            font-weight: ${theme.typography.fontWeight.semibold};
            color: ${theme.colors.text};
            font-family: ${theme.typography.fontFamily};
          ">
            No Downloaded Regions
          </h4>
          <p style="
            margin: 0;
            font-size: ${theme.typography.fontSize.sm};
            color: ${theme.colors.textMuted};
            font-family: ${theme.typography.fontFamily};
          ">
            Add a new region to get started
          </p>
        </div>
      `,
      theme,
    });

    container.appendChild(emptyState);
    return container;
  }

  // Regions grid
  const regionsGrid = document.createElement('div');
  regionsGrid.style.display = 'grid';
  regionsGrid.style.gap = theme.spacing.md;

  for (const region of regions) {
    const isExpired = region.expiry && Date.now() > region.expiry;
    
    const regionCard = createCard({
      padding: 'md',
      shadow: 'md',
      children: '',
      theme,
      style: {
        backgroundColor: isExpired ? `${theme.colors.error}08` : theme.colors.surface,
        borderColor: isExpired ? `${theme.colors.error}30` : theme.colors.border,
        transition: 'all 0.2s ease',
      },
    });

    // Add hover effect
    regionCard.addEventListener('mouseenter', () => {
      regionCard.style.transform = 'translateY(-2px)';
      regionCard.style.boxShadow = theme.shadows.lg;
    });

    regionCard.addEventListener('mouseleave', () => {
      regionCard.style.transform = 'translateY(0)';
      regionCard.style.boxShadow = theme.shadows.md;
    });

    // Card header
    const cardHeader = document.createElement('div');
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.alignItems = 'flex-start';
    cardHeader.style.marginBottom = theme.spacing.md;
    cardHeader.style.gap = theme.spacing.md;

    // Region info
    const regionInfo = document.createElement('div');
    regionInfo.style.flex = '1';
    regionInfo.style.minWidth = '0';

    const regionName = document.createElement('h4');
    const nameStyles: Partial<CSSStyleDeclaration> = {
      margin: `0 0 ${theme.spacing.xs} 0`,
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      wordBreak: 'break-word',
    };
    Object.assign(regionName.style, nameStyles);
    regionName.textContent = region.name || region.id;

    // Region metadata
    const regionMeta = document.createElement('div');
    regionMeta.style.display = 'flex';
    regionMeta.style.flexWrap = 'wrap';
    regionMeta.style.gap = theme.spacing.md;
    regionMeta.style.fontSize = theme.typography.fontSize.xs;
    regionMeta.style.color = theme.colors.textMuted;
    regionMeta.style.fontFamily = theme.typography.fontFamily;

    regionMeta.innerHTML = `
      <span style="display: flex; align-items: center; gap: ${theme.spacing.xs};">
        ${icons.mapPin({ size: 12, color: theme.colors.textMuted })}
        Zoom ${region.minZoom}-${region.maxZoom}
      </span>
      <span style="display: flex; align-items: center; gap: ${theme.spacing.xs};">
        ${icons.clock({ size: 12, color: theme.colors.textMuted })}
        ${region.expiry ? new Date(region.expiry).toLocaleDateString() : 'No expiry'}
      </span>
    `;

    regionInfo.appendChild(regionName);
    regionInfo.appendChild(regionMeta);

    // Focus button
    const focusButton = createButton({
      variant: 'secondary',
      size: 'sm',
      children: 'Focus',
      onClick: () => onFocusRegion?.(region.id),
      theme,
      style: {
        flexShrink: '0',
      },
    });

    cardHeader.appendChild(regionInfo);
    cardHeader.appendChild(focusButton);

    // Expired badge
    const badgesContainer = document.createElement('div');
    if (isExpired) {
      const expiredBadge = createBadge({
        variant: 'error',
        size: 'sm',
        children: 'EXPIRED',
        theme,
        style: {
          marginBottom: theme.spacing.md,
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
      });

      expiredBadge.innerHTML = `
        ${icons.alertTriangle({ size: 12, color: theme.colors.error })}
        EXPIRED
      `;

      badgesContainer.appendChild(expiredBadge);
    }

    // Action buttons
    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = theme.spacing.sm;

    const deleteButton = createButton({
      variant: 'error',
      size: 'sm',
      icon: 'trash',
      children: 'Delete',
      onClick: () => onDeleteRegion?.(region.id),
      theme,
    });

    const detailsButton = createButton({
      variant: 'secondary',
      size: 'sm',
      icon: 'fileText',
      children: 'Details',
      onClick: () => onShowRegionDetails?.(region.id),
      theme,
    });

    actionsContainer.appendChild(deleteButton);
    actionsContainer.appendChild(detailsButton);

    // Assemble card
    regionCard.appendChild(cardHeader);
    if (isExpired) {
      regionCard.appendChild(badgesContainer);
    }
    regionCard.appendChild(actionsContainer);

    regionsGrid.appendChild(regionCard);
  }

  container.appendChild(regionsGrid);
  return container;
}
