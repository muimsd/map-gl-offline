/**
 * Tests for RegionList Component
 */

import {
  RegionsList,
  createRegionsList,
  RegionsListProps,
} from '../../../src/ui/components/RegionList';
import type { StoredRegion } from '../../../src/types';

function makeRegion(overrides: Partial<StoredRegion> = {}): StoredRegion {
  return {
    id: 'region-1',
    key: 'style-1:region-1',
    name: 'Test Region',
    styleId: 'style-1',
    bounds: [
      [-122.5, 37.5],
      [-122.0, 38.0],
    ],
    minZoom: 0,
    maxZoom: 10,
    created: Date.now(),
    expiry: Date.now() + 86400000,
    lastModified: Date.now(),
    ...overrides,
  };
}

describe('RegionsList', () => {
  describe('constructor and rendering', () => {
    it('should create a container element', () => {
      const list = new RegionsList({ regions: [] });
      expect(list.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have bg-white class on container', () => {
      const list = new RegionsList({ regions: [] });
      expect(list.getElement().classList.contains('bg-white')).toBe(true);
    });

    it('should render the header "Downloaded Regions"', () => {
      const list = new RegionsList({ regions: [] });
      const header = list.getElement().querySelector('h3');
      expect(header).not.toBeNull();
      expect(header?.textContent).toBe('Downloaded Regions');
    });
  });

  describe('empty state', () => {
    it('should show empty state when no regions', () => {
      const list = new RegionsList({ regions: [] });
      const emptyDiv = list.getElement().querySelector('.text-center');
      expect(emptyDiv).not.toBeNull();
    });

    it('should display "No offline regions downloaded yet" message', () => {
      const list = new RegionsList({ regions: [] });
      expect(list.getElement().textContent).toContain(
        'No offline regions downloaded yet'
      );
    });

    it('should display hint to add a region', () => {
      const list = new RegionsList({ regions: [] });
      expect(list.getElement().textContent).toContain(
        'Click "Add Region" to start downloading'
      );
    });

    it('should not render the regions grid when empty', () => {
      const list = new RegionsList({ regions: [] });
      const grid = list.getElement().querySelector('.grid');
      expect(grid).toBeNull();
    });
  });

  describe('region cards', () => {
    it('should render one card per region', () => {
      const regions = [
        makeRegion({ id: 'r1', name: 'Region A' }),
        makeRegion({ id: 'r2', name: 'Region B' }),
        makeRegion({ id: 'r3', name: 'Region C' }),
      ];
      const list = new RegionsList({ regions });
      const grid = list.getElement().querySelector('.grid');
      expect(grid).not.toBeNull();
      expect(grid?.children.length).toBe(3);
    });

    it('should display the region name', () => {
      const list = new RegionsList({
        regions: [makeRegion({ name: 'My Custom Region' })],
      });
      const h4 = list.getElement().querySelector('h4');
      expect(h4?.textContent).toBe('My Custom Region');
    });

    it('should fall back to region id when name is empty', () => {
      const list = new RegionsList({
        regions: [makeRegion({ name: '', id: 'fallback-id' })],
      });
      const h4 = list.getElement().querySelector('h4');
      expect(h4?.textContent).toBe('fallback-id');
    });

    it('should show zoom range', () => {
      const list = new RegionsList({
        regions: [makeRegion({ minZoom: 3, maxZoom: 12 })],
      });
      expect(list.getElement().textContent).toContain('Z3-12');
    });

    it('should show expiry date when region has expiry', () => {
      const expiry = new Date('2025-06-15T00:00:00Z').getTime();
      const list = new RegionsList({
        regions: [makeRegion({ expiry })],
      });
      const text = list.getElement().textContent || '';
      // The exact format depends on locale, just verify it rendered something date-like
      expect(text).toContain(new Date(expiry).toLocaleDateString());
    });

    it('should show "No expiry" when region has no expiry', () => {
      const list = new RegionsList({
        regions: [makeRegion({ expiry: 0 })],
      });
      expect(list.getElement().textContent).toContain('No expiry');
    });
  });

  describe('card click (onShowRegionDetails)', () => {
    it('should call onShowRegionDetails when a region card is clicked', () => {
      const onShowRegionDetails = jest.fn();
      const region = makeRegion({ id: 'clicked-region' });
      const list = new RegionsList({
        regions: [region],
        onShowRegionDetails,
      });

      const card = list.getElement().querySelector('.grid > div');
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onShowRegionDetails).toHaveBeenCalledWith('clicked-region');
    });

    it('should not throw when onShowRegionDetails is not provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
      });

      const card = list.getElement().querySelector('.grid > div');
      expect(() => {
        card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }).not.toThrow();
    });
  });

  describe('focus button', () => {
    it('should render Focus button when onFocusRegion is provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
        onFocusRegion: jest.fn(),
      });

      const buttons = list.getElement().querySelectorAll('button');
      const focusButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Focus')
      );
      expect(focusButton).not.toBeUndefined();
    });

    it('should not render Focus button when onFocusRegion is not provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
      });

      const buttons = list.getElement().querySelectorAll('button');
      const focusButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Focus')
      );
      expect(focusButton).toBeUndefined();
    });

    it('should call onFocusRegion with the region id when clicked', () => {
      const onFocusRegion = jest.fn();
      const list = new RegionsList({
        regions: [makeRegion({ id: 'focus-me' })],
        onFocusRegion,
      });

      const buttons = list.getElement().querySelectorAll('button');
      const focusButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Focus')
      );
      focusButton?.click();

      expect(onFocusRegion).toHaveBeenCalledWith('focus-me');
    });

    it('should stop propagation so card click is not triggered', () => {
      const onFocusRegion = jest.fn();
      const onShowRegionDetails = jest.fn();
      const list = new RegionsList({
        regions: [makeRegion()],
        onFocusRegion,
        onShowRegionDetails,
      });

      const buttons = list.getElement().querySelectorAll('button');
      const focusButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Focus')
      );
      focusButton?.click();

      expect(onFocusRegion).toHaveBeenCalled();
      expect(onShowRegionDetails).not.toHaveBeenCalled();
    });
  });

  describe('delete button', () => {
    it('should render Delete button when onDeleteRegion is provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
        onDeleteRegion: jest.fn(),
      });

      const buttons = list.getElement().querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Delete')
      );
      expect(deleteButton).not.toBeUndefined();
    });

    it('should not render Delete button when onDeleteRegion is not provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
      });

      const buttons = list.getElement().querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Delete')
      );
      expect(deleteButton).toBeUndefined();
    });

    it('should call onDeleteRegion with the region id when clicked', () => {
      const onDeleteRegion = jest.fn();
      const list = new RegionsList({
        regions: [makeRegion({ id: 'delete-me' })],
        onDeleteRegion,
      });

      const buttons = list.getElement().querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Delete')
      );
      deleteButton?.click();

      expect(onDeleteRegion).toHaveBeenCalledWith('delete-me');
    });

    it('should stop propagation so card click is not triggered', () => {
      const onDeleteRegion = jest.fn();
      const onShowRegionDetails = jest.fn();
      const list = new RegionsList({
        regions: [makeRegion()],
        onDeleteRegion,
        onShowRegionDetails,
      });

      const buttons = list.getElement().querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Delete')
      );
      deleteButton?.click();

      expect(onDeleteRegion).toHaveBeenCalled();
      expect(onShowRegionDetails).not.toHaveBeenCalled();
    });
  });

  describe('multiple action buttons', () => {
    it('should render both Focus and Delete buttons when both handlers provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
        onFocusRegion: jest.fn(),
        onDeleteRegion: jest.fn(),
      });

      const buttons = list.getElement().querySelectorAll('button');
      const texts = Array.from(buttons).map(b => b.textContent);
      expect(texts.some(t => t?.includes('Focus'))).toBe(true);
      expect(texts.some(t => t?.includes('Delete'))).toBe(true);
    });

    it('should render no action buttons when no handlers are provided', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
      });

      const buttons = list.getElement().querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('updateRegions', () => {
    it('should re-render with new regions', () => {
      const list = new RegionsList({
        regions: [makeRegion({ id: 'r1', name: 'Old Region' })],
      });

      expect(list.getElement().textContent).toContain('Old Region');

      list.updateRegions([
        makeRegion({ id: 'r2', name: 'New Region A' }),
        makeRegion({ id: 'r3', name: 'New Region B' }),
      ]);

      expect(list.getElement().textContent).not.toContain('Old Region');
      expect(list.getElement().textContent).toContain('New Region A');
      expect(list.getElement().textContent).toContain('New Region B');
    });

    it('should show empty state when updated with empty array', () => {
      const list = new RegionsList({
        regions: [makeRegion()],
      });

      list.updateRegions([]);

      expect(list.getElement().textContent).toContain(
        'No offline regions downloaded yet'
      );
    });

    it('should preserve callback handlers after update', () => {
      const onDeleteRegion = jest.fn();
      const list = new RegionsList({
        regions: [makeRegion({ id: 'r1' })],
        onDeleteRegion,
      });

      list.updateRegions([makeRegion({ id: 'r2' })]);

      const buttons = list.getElement().querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(b =>
        b.textContent?.includes('Delete')
      );
      deleteButton?.click();

      expect(onDeleteRegion).toHaveBeenCalledWith('r2');
    });
  });

  describe('createRegionsList (factory function)', () => {
    it('should return an HTMLDivElement', () => {
      const element = createRegionsList({ regions: [] });
      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should render regions via the factory function', () => {
      const element = createRegionsList({
        regions: [makeRegion({ name: 'Factory Region' })],
      });
      expect(element.textContent).toContain('Factory Region');
    });

    it('should render empty state via the factory function', () => {
      const element = createRegionsList({ regions: [] });
      expect(element.textContent).toContain(
        'No offline regions downloaded yet'
      );
    });
  });

  describe('multiple regions with different handlers', () => {
    it('should call the correct handler for each region', () => {
      const onDeleteRegion = jest.fn();
      const regions = [
        makeRegion({ id: 'r1', name: 'Region 1' }),
        makeRegion({ id: 'r2', name: 'Region 2' }),
      ];

      const list = new RegionsList({ regions, onDeleteRegion });

      const grid = list.getElement().querySelector('.grid');
      const cards = grid?.children;
      expect(cards?.length).toBe(2);

      // Click delete on second card
      const secondCard = cards?.[1];
      const buttons = secondCard?.querySelectorAll('button');
      const deleteButton = Array.from(buttons || []).find(b =>
        b.textContent?.includes('Delete')
      );
      deleteButton?.click();

      expect(onDeleteRegion).toHaveBeenCalledWith('r2');
    });
  });
});
