/**
 * Tests for Icons Utility
 */
import { icons, getIcon, IconName } from '../../src/utils/icons';

describe('Icons', () => {
  describe('icons object', () => {
    it('should have mapPin icon', () => {
      const icon = icons.mapPin();
      expect(icon).toContain('<svg');
      expect(icon).toContain('icon-tabler-map-pin');
    });

    it('should have trash icon', () => {
      const icon = icons.trash();
      expect(icon).toContain('<svg');
      expect(icon).toContain('icon-tabler-trash');
    });

    it('should have download icon', () => {
      const icon = icons.download();
      expect(icon).toContain('<svg');
      expect(icon).toContain('icon-tabler-download');
    });

    it('should have eye icon', () => {
      const icon = icons.eye();
      expect(icon).toContain('<svg');
    });

    it('should have focus icon', () => {
      const icon = icons.focus();
      expect(icon).toContain('<svg');
    });

    it('should have x icon', () => {
      const icon = icons.x();
      expect(icon).toContain('<svg');
    });

    it('should have check icon', () => {
      const icon = icons.check();
      expect(icon).toContain('<svg');
    });

    it('should have checkCircle icon', () => {
      const icon = icons.checkCircle();
      expect(icon).toContain('<svg');
    });

    it('should have alertTriangle icon', () => {
      const icon = icons.alertTriangle();
      expect(icon).toContain('<svg');
    });

    it('should have cleaning icon', () => {
      const icon = icons.cleaning();
      expect(icon).toContain('<svg');
    });

    it('should have deviceFloppy icon', () => {
      const icon = icons.deviceFloppy();
      expect(icon).toContain('<svg');
    });

    it('should have clock icon', () => {
      const icon = icons.clock();
      expect(icon).toContain('<svg');
    });

    it('should have cloud icon', () => {
      const icon = icons.cloud();
      expect(icon).toContain('<svg');
    });

    it('should have fileText icon', () => {
      const icon = icons.fileText();
      expect(icon).toContain('<svg');
    });

    it('should have deviceMobile icon', () => {
      const icon = icons.deviceMobile();
      expect(icon).toContain('<svg');
    });

    it('should have settings icon', () => {
      const icon = icons.settings();
      expect(icon).toContain('<svg');
    });

    it('should have map icon', () => {
      const icon = icons.map();
      expect(icon).toContain('<svg');
    });

    it('should have refresh icon', () => {
      const icon = icons.refresh();
      expect(icon).toContain('<svg');
    });

    it('should have plus icon', () => {
      const icon = icons.plus();
      expect(icon).toContain('<svg');
    });

    it('should have moon icon', () => {
      const icon = icons.moon();
      expect(icon).toContain('<svg');
    });

    it('should have sun icon', () => {
      const icon = icons.sun();
      expect(icon).toContain('<svg');
    });

    it('should have upload icon', () => {
      const icon = icons.upload();
      expect(icon).toContain('<svg');
    });

    it('should have infoCircle icon', () => {
      const icon = icons.infoCircle();
      expect(icon).toContain('<svg');
    });
  });

  describe('icon configuration', () => {
    it('should apply custom size', () => {
      const icon = icons.mapPin({ size: 32 });
      expect(icon).toContain('width="32"');
      expect(icon).toContain('height="32"');
    });

    it('should apply custom color', () => {
      const icon = icons.mapPin({ color: '#ff0000' });
      expect(icon).toContain('stroke="#ff0000"');
    });

    it('should apply custom className', () => {
      const icon = icons.mapPin({ className: 'custom-class' });
      expect(icon).toContain('custom-class');
    });

    it('should apply custom style', () => {
      const icon = icons.mapPin({ style: 'opacity: 0.5' });
      expect(icon).toContain('opacity: 0.5');
    });

    it('should add display and vertical-align styles', () => {
      const icon = icons.mapPin();
      expect(icon).toContain('display: inline-block');
      expect(icon).toContain('vertical-align: middle');
    });

    it('should preserve default color when not specified', () => {
      const icon = icons.mapPin();
      expect(icon).toContain('stroke="currentColor"');
    });

    it('should handle multiple config options', () => {
      const icon = icons.download({
        size: 24,
        color: '#0000ff',
        className: 'my-icon',
        style: 'margin-right: 5px',
      });

      expect(icon).toContain('width="24"');
      expect(icon).toContain('height="24"');
      expect(icon).toContain('stroke="#0000ff"');
      expect(icon).toContain('my-icon');
      expect(icon).toContain('margin-right: 5px');
    });
  });

  describe('getIcon function', () => {
    it('should return icon by name', () => {
      const icon = getIcon('mapPin');
      expect(icon).toContain('<svg');
      expect(icon).toContain('icon-tabler-map-pin');
    });

    it('should apply config when getting icon by name', () => {
      const icon = getIcon('trash', { size: 20 });
      expect(icon).toContain('width="20"');
      expect(icon).toContain('height="20"');
    });

    it('should work with all icon names', () => {
      const iconNames: IconName[] = [
        'mapPin',
        'focus',
        'download',
        'trash',
        'eye',
        'refresh',
        'cleaning',
        'plus',
        'x',
        'check',
        'checkCircle',
        'alertTriangle',
        'fileText',
        'clock',
        'cloud',
        'deviceMobile',
        'deviceFloppy',
        'settings',
        'map',
        'moon',
        'sun',
        'upload',
        'infoCircle',
      ];

      iconNames.forEach((name) => {
        const icon = getIcon(name);
        expect(icon).toContain('<svg');
      });
    });
  });
});
