/**
 * Tests for MapControlButton (ControlButton) Component
 */

import { ControlButton, ControlButtonConfig } from '../../../../src/ui/components/shared/MapControlButton';

describe('ControlButton', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createConfig = (overrides: Partial<ControlButtonConfig> = {}): ControlButtonConfig => ({
    title: 'Test Button',
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a control button instance', () => {
      const button = new ControlButton(createConfig());
      expect(button).toBeInstanceOf(ControlButton);
    });

    it('should create with default config', () => {
      const button = new ControlButton({});
      expect(button.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have maplibregl-ctrl classes', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      expect(element.classList.contains('maplibregl-ctrl')).toBe(true);
      expect(element.classList.contains('maplibregl-ctrl-group')).toBe(true);
    });

    it('should have offline-manager-control class', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      expect(element.classList.contains('offline-manager-control')).toBe(true);
    });
  });

  describe('button element', () => {
    it('should contain a button element', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement).not.toBeNull();
    });

    it('should set button title', () => {
      const button = new ControlButton(createConfig({ title: 'My Custom Title' }));
      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.title).toBe('My Custom Title');
    });

    it('should use default title when not provided', () => {
      const button = new ControlButton({ title: undefined });
      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.title).toBe('Offline Map Manager');
    });

    it('should have maplibregl-ctrl-icon class', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.classList.contains('maplibregl-ctrl-icon')).toBe(true);
    });
  });

  describe('progress badge', () => {
    it('should have a progress badge element', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      const badge = element.querySelector('.progress-badge');
      expect(badge).not.toBeNull();
    });

    it('should hide progress badge by default', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      const badge = element.querySelector('.progress-badge') as HTMLElement;
      expect(badge.classList.contains('hidden')).toBe(true);
    });

    it('should update progress badge text and visibility', () => {
      const button = new ControlButton(createConfig());
      button.updateProgressBadge('50%', true);

      const element = button.getElement();
      const badge = element.querySelector('.progress-badge') as HTMLElement;
      expect(badge.textContent).toBe('50%');
      expect(badge.style.display).toBe('block');
    });

    it('should hide progress badge when visible is false', () => {
      const button = new ControlButton(createConfig());
      button.updateProgressBadge('50%', true);
      button.updateProgressBadge('', false);

      const element = button.getElement();
      const badge = element.querySelector('.progress-badge') as HTMLElement;
      expect(badge.style.display).toBe('none');
    });
  });

  describe('updateButton', () => {
    it('should update button text', () => {
      const button = new ControlButton(createConfig());
      button.updateButton('Loading...', false);

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.textContent).toBe('Loading...');
    });

    it('should disable button when disabled is true', () => {
      const button = new ControlButton(createConfig());
      button.updateButton('Loading', true);

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.disabled).toBe(true);
    });

    it('should enable button when disabled is false', () => {
      const button = new ControlButton(createConfig());
      button.updateButton('Loading', true);
      button.updateButton('Ready', false);

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.disabled).toBe(false);
    });
  });

  describe('resetToDefault', () => {
    it('should reset button to default state', () => {
      const button = new ControlButton(createConfig({ title: 'Test Title' }));

      // Modify state
      button.updateButton('Modified', true);
      button.updateProgressBadge('75%', true);

      // Reset
      button.resetToDefault();

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      const badge = element.querySelector('.progress-badge') as HTMLElement;

      expect(btnElement?.disabled).toBe(false);
      expect(btnElement?.title).toBe('Test Title');
      expect(badge.style.display).toBe('none');
    });

    it('should use default title when resetting without custom title', () => {
      const button = new ControlButton({ title: undefined });
      button.updateButton('Modified', true);
      button.resetToDefault();

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.title).toBe('Offline Map Manager');
    });
  });

  describe('setActive', () => {
    it('should add active class when true', () => {
      const button = new ControlButton(createConfig());
      button.setActive(true);

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.classList.contains('active')).toBe(true);
    });

    it('should remove active class when false', () => {
      const button = new ControlButton(createConfig());
      button.setActive(true);
      button.setActive(false);

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      expect(btnElement?.classList.contains('active')).toBe(false);
    });
  });

  describe('onToggle callback', () => {
    it('should call onToggle when button is clicked', () => {
      const onToggle = jest.fn();
      const button = new ControlButton(createConfig({ onToggle }));

      const element = button.getElement();
      const btnElement = element.querySelector('button');
      btnElement?.click();

      expect(onToggle).toHaveBeenCalled();
    });

    it('should not throw when no onToggle is provided', () => {
      const button = new ControlButton(createConfig());
      const element = button.getElement();
      const btnElement = element.querySelector('button');

      expect(() => btnElement?.click()).not.toThrow();
    });
  });

  describe('custom icon', () => {
    it('should use custom icon when provided', () => {
      const customIcon = '<svg class="custom-icon">test</svg>';
      const button = new ControlButton(createConfig({ icon: customIcon }));

      const element = button.getElement();
      expect(element.innerHTML).toContain('custom-icon');
    });

    it('should use default cloud icon when not provided', () => {
      const button = new ControlButton({ title: 'Test' });
      const element = button.getElement();
      const btnElement = element.querySelector('button');

      // Default icon should be present (cloud icon from icons.ts)
      expect(btnElement?.innerHTML).toContain('svg');
    });
  });

  describe('destroy', () => {
    it('should remove click event listener on destroy', () => {
      const onToggle = jest.fn();
      const button = new ControlButton({ title: 'Test', onToggle });
      const element = button.getElement();
      const btnElement = element.querySelector('button');

      button.destroy();
      btnElement?.click();

      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should not throw when destroyed without onToggle', () => {
      const button = new ControlButton({ title: 'Test' });
      expect(() => button.destroy()).not.toThrow();
    });
  });
});
