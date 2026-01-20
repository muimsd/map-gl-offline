/**
 * Tests for Button Component
 */

import { Button, ButtonConfig } from '../../../../src/ui/components/shared/Button';

describe('Button', () => {
  describe('constructor', () => {
    it('should create a button element', () => {
      const button = new Button();
      expect(button.getElement().tagName).toBe('BUTTON');
      expect((button.getElement() as HTMLButtonElement).type).toBe('button');
    });

    it('should set text content', () => {
      const button = new Button({ text: 'Click me' });
      expect(button.getElement().textContent).toBe('Click me');
    });

    it('should set icon only', () => {
      const button = new Button({ icon: '<svg>icon</svg>' });
      expect(button.getElement().innerHTML).toBe('<svg>icon</svg>');
    });

    it('should set icon with text', () => {
      const button = new Button({ icon: '<svg>icon</svg>', text: 'Click me' });
      expect(button.getElement().innerHTML).toContain('<svg>icon</svg>');
      expect(button.getElement().innerHTML).toContain('Click me');
    });

    it('should set title attribute', () => {
      const button = new Button({ title: 'Button title' });
      expect(button.getElement().title).toBe('Button title');
    });

    it('should set disabled state', () => {
      const button = new Button({ disabled: true });
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(true);
    });

    it('should attach click handler', () => {
      const onClick = jest.fn();
      const button = new Button({ onClick });
      button.getElement().click();
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('variants', () => {
    it('should apply primary variant classes', () => {
      const button = new Button({ variant: 'primary' });
      expect(button.getElement().className).toContain('bg-blue-600');
    });

    it('should apply secondary variant classes', () => {
      const button = new Button({ variant: 'secondary' });
      expect(button.getElement().className).toContain('bg-gray-500');
    });

    it('should apply success variant classes', () => {
      const button = new Button({ variant: 'success' });
      expect(button.getElement().className).toContain('bg-green-600');
    });

    it('should apply danger variant classes', () => {
      const button = new Button({ variant: 'danger' });
      expect(button.getElement().className).toContain('bg-red-600');
    });

    it('should apply default variant classes when no variant specified', () => {
      const button = new Button({});
      expect(button.getElement().className).toContain('bg-white');
    });
  });

  describe('sizes', () => {
    it('should apply small size classes', () => {
      const button = new Button({ size: 'sm' });
      expect(button.getElement().className).toContain('px-2 py-1 text-xs');
    });

    it('should apply medium size classes by default', () => {
      const button = new Button({});
      expect(button.getElement().className).toContain('px-4 py-2 text-sm');
    });

    it('should apply large size classes', () => {
      const button = new Button({ size: 'lg' });
      expect(button.getElement().className).toContain('px-6 py-3 text-lg');
    });
  });

  describe('setText', () => {
    it('should update text content', () => {
      const button = new Button({ text: 'Original' });
      button.setText('Updated');
      expect(button.getElement().textContent).toBe('Updated');
    });

    it('should preserve icon when updating text', () => {
      const button = new Button({ icon: '<svg>icon</svg>', text: 'Original' });
      button.setText('Updated');
      expect(button.getElement().innerHTML).toContain('<svg>icon</svg>');
      expect(button.getElement().innerHTML).toContain('Updated');
    });
  });

  describe('setDisabled', () => {
    it('should enable button', () => {
      const button = new Button({ disabled: true });
      button.setDisabled(false);
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(false);
    });

    it('should disable button', () => {
      const button = new Button({});
      button.setDisabled(true);
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('progress badge', () => {
    it('should create progress badge when showProgressBadge is true', () => {
      const button = new Button({ showProgressBadge: true });
      const badge = button.getElement().querySelector('span');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains('hidden')).toBe(true);
    });

    it('should not create progress badge by default', () => {
      const button = new Button({});
      const badge = button.getElement().querySelector('span.absolute');
      expect(badge).toBeNull();
    });

    it('should update progress badge text and visibility', () => {
      const button = new Button({ showProgressBadge: true });
      button.updateProgressBadge('5', true);
      const badge = button.getElement().querySelector('span');
      expect(badge?.textContent).toBe('5');
      expect(badge?.classList.contains('hidden')).toBe(false);
    });

    it('should hide progress badge', () => {
      const button = new Button({ showProgressBadge: true });
      button.showProgressBadge('10');
      button.hideProgressBadge();
      const badge = button.getElement().querySelector('span');
      expect(badge?.classList.contains('hidden')).toBe(true);
    });

    it('should show progress badge with text', () => {
      const button = new Button({ showProgressBadge: true });
      button.showProgressBadge('3');
      const badge = button.getElement().querySelector('span');
      expect(badge?.textContent).toBe('3');
      expect(badge?.classList.contains('hidden')).toBe(false);
    });

    it('should handle updateProgressBadge when badge does not exist', () => {
      const button = new Button({});
      // Should not throw
      button.updateProgressBadge('5', true);
    });

    it('should handle showProgressBadge when badge does not exist', () => {
      const button = new Button({});
      // Should not throw
      button.showProgressBadge('5');
    });

    it('should handle hideProgressBadge when badge does not exist', () => {
      const button = new Button({});
      // Should not throw
      button.hideProgressBadge();
    });
  });

  describe('custom className', () => {
    it('should include custom className', () => {
      const button = new Button({ className: 'my-custom-class' });
      expect(button.getElement().className).toContain('my-custom-class');
    });
  });

  describe('accessibility', () => {
    it('should set aria-label from config', () => {
      const button = new Button({ ariaLabel: 'Submit form' });
      expect(button.getElement().getAttribute('aria-label')).toBe('Submit form');
    });

    it('should use title as aria-label for icon-only buttons', () => {
      const button = new Button({
        icon: '<svg>icon</svg>',
        title: 'Close button',
      });
      expect(button.getElement().getAttribute('aria-label')).toBe('Close button');
    });

    it('should not set aria-label for icon buttons with text', () => {
      const button = new Button({
        icon: '<svg>icon</svg>',
        text: 'Click me',
        title: 'Button title',
      });
      expect(button.getElement().getAttribute('aria-label')).toBeNull();
    });

    it('should set aria-busy when loading is true', () => {
      const button = new Button({ loading: true });
      expect(button.getElement().getAttribute('aria-busy')).toBe('true');
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(true);
    });

    it('should have aria-live on progress badge', () => {
      const button = new Button({ showProgressBadge: true });
      const badge = button.getElement().querySelector('span[aria-live]');
      expect(badge).not.toBeNull();
      expect(badge?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('setLoading', () => {
    it('should set aria-busy when loading', () => {
      const button = new Button({});
      button.setLoading(true);
      expect(button.getElement().getAttribute('aria-busy')).toBe('true');
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(true);
    });

    it('should remove aria-busy when not loading', () => {
      const button = new Button({ loading: true });
      button.setLoading(false);
      expect(button.getElement().getAttribute('aria-busy')).toBeNull();
      expect((button.getElement() as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
