/**
 * Tests for ImportExportModal Component
 */

import { ImportExportModal, ImportExportModalOptions } from '../../../src/ui/modals/importExportModal';
import { StoredRegion } from '../../../src/types/region';

describe('ImportExportModal', () => {
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

  const createOptions = (overrides: Partial<ImportExportModalOptions> = {}): ImportExportModalOptions => ({
    region: createMockRegion(),
    onClose: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create an import/export modal instance', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      expect(modal).toBeInstanceOf(ImportExportModal);
    });
  });

  describe('show', () => {
    it('should return a div element', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should display the modal title', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Import/Export Region');
    });

    it('should display region name in subtitle', () => {
      const options = createOptions({
        region: createMockRegion({ name: 'My Region' }),
      });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('My Region');
    });

    it('should display region information', () => {
      const region = createMockRegion({
        id: 'region-123',
        name: 'Test Region',
        minZoom: 5,
        maxZoom: 15,
      });
      const options = createOptions({ region });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('region-123');
      expect(element.textContent).toContain('Test Region');
      expect(element.textContent).toContain('Z5-15');
    });
  });

  describe('export section', () => {
    it('should have Export Region section', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Export Region');
    });

    it('should have export format select', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const select = element.querySelector('select');
      expect(select).not.toBeNull();
    });

    it('should have JSON format option', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('JSON');
    });

    it('should have PMTiles format option', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('PMTiles');
    });

    it('should have MBTiles format option', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('MBTiles');
    });

    it('should have export component checkboxes', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Style Configuration');
      expect(element.textContent).toContain('Map Tiles');
      expect(element.textContent).toContain('Sprites');
      expect(element.textContent).toContain('Fonts');
    });

    it('should have checkboxes checked by default', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const checkboxes = element.querySelectorAll('input[type="checkbox"]');
      const exportCheckboxes = Array.from(checkboxes).slice(0, 4);

      exportCheckboxes.forEach(checkbox => {
        expect((checkbox as HTMLInputElement).checked).toBe(true);
      });
    });

    it('should have Export Region button', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const exportButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Export Region')
      );
      expect(exportButton).not.toBeNull();
    });
  });

  describe('import section', () => {
    it('should have Import Region section', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Import Region');
    });

    it('should have file input', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const fileInput = element.querySelector('input[type="file"]');
      expect(fileInput).not.toBeNull();
    });

    it('should accept correct file types', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const fileInput = element.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.accept).toContain('.json');
      expect(fileInput.accept).toContain('.pmtiles');
      expect(fileInput.accept).toContain('.mbtiles');
    });

    it('should have new region name input', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('New Region Name');
    });

    it('should have overwrite checkbox', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Overwrite if region exists');
    });

    it('should have Import Region button', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const importButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Import Region')
      );
      expect(importButton).not.toBeNull();
    });

    it('should disable Import button by default', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const importButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Import Region')
      ) as HTMLButtonElement;

      expect(importButton?.disabled).toBe(true);
    });
  });

  describe('format guide', () => {
    it('should display format guide section', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Format Guide');
    });

    it('should describe JSON format', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Complete data');
      expect(element.textContent).toContain('human-readable');
    });

    it('should describe PMTiles format', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Web-optimized');
    });

    it('should describe MBTiles format', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Industry standard');
    });
  });

  describe('hide', () => {
    it('should call onClose when hiding', () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const modal = new ImportExportModal(options);
      modal.show();

      modal.hide();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('should have Close button in footer', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const closeButton = Array.from(buttons).find(btn =>
        btn.textContent === 'Close'
      );
      expect(closeButton).not.toBeNull();
    });

    it('should call onClose when Close button is clicked', () => {
      const onClose = jest.fn();
      const options = createOptions({ onClose });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const closeButton = Array.from(buttons).find(btn =>
        btn.textContent === 'Close'
      );
      closeButton?.click();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('export functionality', () => {
    it('should call exportRegion with correct format', async () => {
      const exportRegion = jest.fn().mockResolvedValue({ success: true });
      const options = createOptions({ exportRegion });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const exportButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Export Region')
      );
      exportButton?.click();

      // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(exportRegion).toHaveBeenCalled();
    });

    it('should call onExport callback on success', async () => {
      const onExport = jest.fn();
      const exportRegion = jest.fn().mockResolvedValue({ success: true });
      const options = createOptions({ exportRegion, onExport });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const exportButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Export Region')
      );
      exportButton?.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onExport).toHaveBeenCalled();
    });

    it('should not export when no exportRegion function provided', () => {
      const options = createOptions({ exportRegion: undefined });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const exportButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Export Region')
      );

      // Should not throw
      expect(() => exportButton?.click()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy the modal', () => {
      const options = createOptions();
      const modal = new ImportExportModal(options);
      modal.show();

      expect(() => modal.destroy()).not.toThrow();
    });
  });

  describe('region without name', () => {
    it('should use region id when name is missing', () => {
      const region = createMockRegion({ name: undefined as unknown as string, id: 'fallback-id' });
      const options = createOptions({ region });
      const modal = new ImportExportModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('fallback-id');
    });
  });
});
