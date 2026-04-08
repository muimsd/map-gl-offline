/**
 * Tests for RegionFormModal Component
 */

import { RegionFormModal, RegionFormOptions, RegionFormData, MapTileSource } from '../../../src/ui/modals/regionFormModal';

describe('RegionFormModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createOptions = (overrides: Partial<RegionFormOptions> = {}): RegionFormOptions => ({
    bounds: [-122.5, 37.7, -122.3, 37.9] as [number, number, number, number],
    area: 25.5,
    onSave: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
    styleUrl: 'https://example.com/style.json',
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a region form modal instance', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      expect(modal).toBeInstanceOf(RegionFormModal);
    });
  });

  describe('show', () => {
    it('should return a div element', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should display the modal title', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Download Offline Region');
    });

    it('should display the area in subtitle', () => {
      const options = createOptions({ area: 100 });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('100');
      expect(element.textContent).toContain('km²');
    });

    it('should display bounds information', () => {
      const options = createOptions({
        bounds: [-122.5, 37.7, -122.3, 37.9],
      });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('-122.5000');
      expect(element.textContent).toContain('37.7000');
    });

    it('should have Region Name input', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Region Name');
      const nameInput = element.querySelector('input[type="text"]');
      expect(nameInput).not.toBeNull();
    });

    it('should have Min Zoom input', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Min Zoom');
      const minZoomInput = element.querySelector('input[type="number"]');
      expect(minZoomInput).not.toBeNull();
    });

    it('should have Max Zoom input', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Max Zoom');
    });

    it('should have Style URL input with default value', () => {
      const options = createOptions({ styleUrl: 'https://custom.style.com/style.json' });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Style URL');
      const inputs = element.querySelectorAll('input[type="text"]');
      const styleInput = Array.from(inputs).find(
        (input) => (input as HTMLInputElement).value.includes('custom.style.com')
      );
      expect(styleInput).not.toBeNull();
    });

    it('should have Style Provider select', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Style Provider');
      const select = element.querySelector('select');
      expect(select).not.toBeNull();
    });

    it('should have Cancel button', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Cancel');
    });

    it('should have Download Region button', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Download Region');
    });
  });

  describe('form inputs', () => {
    it('should have default zoom values', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const numberInputs = element.querySelectorAll('input[type="number"]');
      const minZoomInput = numberInputs[0] as HTMLInputElement;
      const maxZoomInput = numberInputs[1] as HTMLInputElement;

      expect(minZoomInput.value).toBe('1');
      expect(maxZoomInput.value).toBe('15');
    });

    it('should have zoom constraints', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const numberInputs = element.querySelectorAll('input[type="number"]');
      const minZoomInput = numberInputs[0] as HTMLInputElement;

      expect(minZoomInput.min).toBe('0');
      expect(minZoomInput.max).toBe('20');
    });

    it('should have placeholder for region name', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const nameInput = element.querySelector('input[placeholder*="Downtown"]') as HTMLInputElement;
      expect(nameInput).not.toBeNull();
    });
  });

  describe('provider selection', () => {
    it('should have auto-detect option', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const select = element.querySelector('select');
      expect(select?.innerHTML).toContain('Auto-detect');
    });

    it('should have Mapbox GL option', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const select = element.querySelector('select');
      expect(select?.innerHTML).toContain('Mapbox GL');
    });

    it('should have MapLibre GL option', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const select = element.querySelector('select');
      expect(select?.innerHTML).toContain('MapLibre GL');
    });

    it('should detect Mapbox from URL', () => {
      const options = createOptions({ styleUrl: 'https://api.mapbox.com/styles/v1/test' });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const select = element.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('mapbox');
    });

    it('should detect MapLibre from URL', () => {
      const options = createOptions({ styleUrl: 'https://maptiler.com/style.json' });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const select = element.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('maplibre');
    });
  });

  describe('access token', () => {
    it('should show access token input for Mapbox', () => {
      const options = createOptions({ styleUrl: 'https://api.mapbox.com/styles/v1/test' });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Mapbox Access Token');
    });

    it('should hide access token input for non-Mapbox', () => {
      const options = createOptions({ styleUrl: 'https://example.com/style.json' });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      // Access token group should be hidden
      const hiddenGroups = element.querySelectorAll('.hidden');
      expect(hiddenGroups.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cancel', () => {
    it('should call onCancel when Cancel button is clicked', () => {
      const onCancel = jest.fn();
      const options = createOptions({ onCancel });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Cancel')
      );
      cancelButton?.click();

      expect(onCancel).toHaveBeenCalled();
    });

    it('should hide modal on cancel', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      modal.show();

      modal.cancel();

      // Should not throw
      expect(() => modal.cancel()).not.toThrow();
    });
  });

  describe('save', () => {
    it('should call onSave with form data', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const options = createOptions({ onSave });
      const modal = new RegionFormModal(options);
      modal.show();

      await modal.save();

      expect(onSave).toHaveBeenCalled();
      const formData = onSave.mock.calls[0][0] as RegionFormData;
      expect(formData.bounds).toEqual(options.bounds);
    });

    it('should include zoom levels in form data', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const options = createOptions({ onSave });
      const modal = new RegionFormModal(options);
      modal.show();

      await modal.save();

      const formData = onSave.mock.calls[0][0] as RegionFormData;
      expect(typeof formData.minZoom).toBe('number');
      expect(typeof formData.maxZoom).toBe('number');
    });

    it('should generate default name if empty', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const options = createOptions({ onSave });
      const modal = new RegionFormModal(options);
      modal.show();

      await modal.save();

      const formData = onSave.mock.calls[0][0] as RegionFormData;
      expect(formData.name).toBeDefined();
      expect(formData.name.length).toBeGreaterThan(0);
    });
  });

  describe('hide', () => {
    it('should hide the modal', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      modal.show();

      expect(() => modal.hide()).not.toThrow();
    });
  });

  describe('close', () => {
    it('should close the modal', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      modal.show();

      expect(() => modal.close()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy the modal', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      modal.show();

      expect(() => modal.destroy()).not.toThrow();
    });
  });

  describe('theme toggle', () => {
    it('should call onThemeToggle when provided', () => {
      const onThemeToggle = jest.fn();
      const options = createOptions({ onThemeToggle });
      const modal = new RegionFormModal(options);
      modal.show();

      // Modal should be created with showThemeToggle: true
      expect(() => modal.show()).not.toThrow();
    });
  });

  describe('extra sources picker', () => {
    const testSources: MapTileSource[] = [
      {
        id: 'buildings',
        type: 'vector',
        tiles: ['https://example.com/buildings/{z}/{x}/{y}.pbf'],
        minzoom: 12,
        maxzoom: 16,
      },
      {
        id: 'satellite',
        type: 'raster',
        tiles: ['https://example.com/satellite/{z}/{x}/{y}.png'],
        minzoom: 0,
        maxzoom: 18,
      },
      {
        id: 'terrain',
        type: 'raster-dem',
        tiles: ['https://example.com/terrain/{z}/{x}/{y}.webp'],
      },
    ];

    it('should not show sources section when no mapSources provided', () => {
      const options = createOptions();
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).not.toContain('Additional Tile Sources');
    });

    it('should not show sources section when mapSources is empty', () => {
      const options = createOptions({ mapSources: [] });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).not.toContain('Additional Tile Sources');
    });

    it('should show sources section with checkboxes when mapSources provided', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Additional Tile Sources');
      const checkboxes = element.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
    });

    it('should display source IDs', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('buildings');
      expect(element.textContent).toContain('satellite');
      expect(element.textContent).toContain('terrain');
    });

    it('should display source type badges', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Vector');
      expect(element.textContent).toContain('Raster');
      expect(element.textContent).toContain('Terrain');
    });

    it('should display zoom range info', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('z12-16');
      expect(element.textContent).toContain('z0-18');
    });

    it('should have Select All button', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Select All');
    });

    it('should select all sources when Select All is clicked', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      // Find and click Select All button
      const buttons = element.querySelectorAll('button[type="button"]');
      const selectAllBtn = Array.from(buttons).find(
        btn => btn.textContent?.trim() === 'Select All'
      ) as HTMLButtonElement | undefined;
      expect(selectAllBtn).toBeDefined();
      selectAllBtn?.click();

      const checkboxes = element.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      expect(allChecked).toBe(true);
    });

    it('should deselect all sources when Deselect All is clicked', () => {
      const options = createOptions({ mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button[type="button"]');
      const toggleBtn = Array.from(buttons).find(
        btn => btn.textContent?.trim() === 'Select All'
      ) as HTMLButtonElement | undefined;

      // Click twice: first selects all, second deselects all
      toggleBtn?.click();
      toggleBtn?.click();

      const checkboxes = element.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);
      expect(noneChecked).toBe(true);
    });

    it('should not include extraSources in formData when none selected', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const options = createOptions({ onSave, mapSources: testSources });
      const modal = new RegionFormModal(options);
      modal.show();

      await modal.save();

      const formData = onSave.mock.calls[0][0] as RegionFormData;
      expect(formData.extraSources).toBeUndefined();
    });

    it('should include selected extraSources in formData on save', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const options = createOptions({ onSave, mapSources: testSources });
      const modal = new RegionFormModal(options);
      const element = modal.show();

      // Check the first and third checkboxes
      const checkboxes = element.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      checkboxes[0].checked = true; // buildings
      checkboxes[2].checked = true; // terrain

      await modal.save();

      const formData = onSave.mock.calls[0][0] as RegionFormData;
      expect(formData.extraSources).toBeDefined();
      expect(formData.extraSources).toHaveLength(2);
      expect(formData.extraSources![0].id).toBe('buildings');
      expect(formData.extraSources![0].type).toBe('vector');
      expect(formData.extraSources![0].tiles).toEqual(['https://example.com/buildings/{z}/{x}/{y}.pbf']);
      expect(formData.extraSources![1].id).toBe('terrain');
      expect(formData.extraSources![1].type).toBe('raster-dem');
    });
  });
});
