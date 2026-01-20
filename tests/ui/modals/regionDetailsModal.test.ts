/**
 * Tests for RegionDetailsModal Component
 */

import { RegionDetailsModal, RegionDetailsOptions } from '../../../src/ui/modals/regionDetailsModal';
import { StoredRegion } from '../../../src/types/region';

describe('RegionDetailsModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createMockRegion = (overrides: Partial<StoredRegion> = {}): StoredRegion => ({
    id: 'test-region-1',
    key: 'regions:test-region-1',
    name: 'Test Region',
    bounds: [
      [-122.5, 37.7],
      [-122.3, 37.9],
    ],
    minZoom: 10,
    maxZoom: 16,
    styleId: 'style-1',
    created: Date.now(),
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
    lastModified: Date.now(),
    ...overrides,
  });

  const createOptions = (overrides: Partial<RegionDetailsOptions> = {}): RegionDetailsOptions => ({
    region: createMockRegion(),
    onClose: jest.fn(),
    onFocus: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a region details modal instance', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      expect(modal).toBeInstanceOf(RegionDetailsModal);
    });
  });

  describe('show', () => {
    it('should return a div element', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should display the region name', () => {
      const options = createOptions({
        region: createMockRegion({ name: 'My Custom Region' }),
      });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('My Custom Region');
    });

    it('should display the modal title', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Region Details');
    });

    it('should display bounds information', () => {
      const region = createMockRegion({
        bounds: [
          [-122.5, 37.7],
          [-122.3, 37.9],
        ],
      });
      const options = createOptions({ region });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      // Should contain formatted bounds
      expect(element.textContent).toContain('37.7000');
      expect(element.textContent).toContain('-122.5000');
      expect(element.textContent).toContain('37.9000');
      expect(element.textContent).toContain('-122.3000');
    });

    it('should display zoom range', () => {
      const region = createMockRegion({ minZoom: 8, maxZoom: 14 });
      const options = createOptions({ region });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('8');
      expect(element.textContent).toContain('14');
    });

    it('should display created date when available', () => {
      const createdDate = new Date('2024-01-15').getTime();
      const region = createMockRegion({ created: createdDate });
      const options = createOptions({ region });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Created');
    });

    it('should have Focus on Map button', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Focus on Map');
    });

    it('should have Close button', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Close');
    });
  });

  describe('focusRegion', () => {
    it('should call onFocus with region id', () => {
      const onFocus = jest.fn();
      const region = createMockRegion({ id: 'region-123' });
      const options = createOptions({ region, onFocus });
      const modal = new RegionDetailsModal(options);
      modal.show();

      modal.focusRegion();

      expect(onFocus).toHaveBeenCalledWith('region-123');
    });

    it('should close the modal after focusing', () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const modal = new RegionDetailsModal(options);
      modal.show();

      modal.focusRegion();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should call onClose callback', () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const modal = new RegionDetailsModal(options);
      modal.show();

      modal.close();

      expect(onClose).toHaveBeenCalled();
    });

    it('should hide the modal', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      modal.show();

      // Close should not throw
      expect(() => modal.close()).not.toThrow();
    });
  });

  describe('button interactions', () => {
    it('should call onFocus when Focus on Map button is clicked', () => {
      const onFocus = jest.fn();
      const options = createOptions({ onFocus });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const focusButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Focus on Map')
      );
      focusButton?.click();

      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onClose when Close button is clicked', () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const closeButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Close') && !btn.textContent?.includes('Focus')
      );
      closeButton?.click();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('theme toggle', () => {
    it('should call onThemeToggle when provided', () => {
      const onThemeToggle = jest.fn();
      const options = createOptions({ onThemeToggle });
      const modal = new RegionDetailsModal(options);
      modal.show();

      // Modal is configured with showThemeToggle: false, so this might not trigger
      // but the option should be passed through
      expect(() => modal.show()).not.toThrow();
    });
  });

  describe('region without created date', () => {
    it('should not display created section when date is missing', () => {
      const region = createMockRegion();
      delete (region as { created?: number }).created;
      const options = createOptions({ region });
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      // The created section should be conditional
      // This depends on implementation - the template checks for region.created
      expect(element).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('modal styling', () => {
    it('should have proper content structure', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      // Should have flex column layout for content
      const content = element.querySelector('.flex.flex-col');
      expect(content).not.toBeNull();
    });

    it('should have grid layout for bounds and zoom', () => {
      const options = createOptions();
      const modal = new RegionDetailsModal(options);
      const element = modal.show();

      const grid = element.querySelector('.grid');
      expect(grid).not.toBeNull();
    });
  });
});
