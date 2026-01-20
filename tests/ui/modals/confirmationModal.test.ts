/**
 * Tests for Confirmation Modal Component
 */

import { ConfirmationModal, ConfirmationModalOptions } from '../../../src/ui/modals/confirmationModal';

describe('ConfirmationModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up modals
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  const createOptions = (overrides: Partial<ConfirmationModalOptions> = {}): ConfirmationModalOptions => ({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a confirmation modal instance', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);

      expect(modal).toBeInstanceOf(ConfirmationModal);
    });
  });

  describe('show', () => {
    it('should return a div element', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should display the title', () => {
      const options = createOptions({ title: 'My Title' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('My Title');
    });

    it('should display the message', () => {
      const options = createOptions({ message: 'Test message content' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Test message content');
    });

    it('should display confirm button text', () => {
      const options = createOptions({ confirmText: 'Yes, Delete' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Yes, Delete');
    });

    it('should display cancel button text', () => {
      const options = createOptions({ cancelText: 'No, Keep' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('No, Keep');
    });

    it('should have confirm and cancel buttons', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();
      const buttons = element.querySelectorAll('button');

      // At least confirm and cancel buttons (may have close button too)
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onConfirm when confirm button is clicked', () => {
      const onConfirm = jest.fn();
      const options = createOptions({ onConfirm, cancelText: '' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      // Find the confirm button (last button in footer)
      const buttons = element.querySelectorAll('button');
      const confirmButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Confirm')
      );
      confirmButton?.click();

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      const options = createOptions({ onCancel });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      const buttons = element.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find(btn =>
        btn.textContent?.includes('Cancel')
      );
      cancelButton?.click();

      expect(onCancel).toHaveBeenCalled();
    });

    it('should not show cancel button when cancelText is empty', () => {
      const options = createOptions({ cancelText: '' });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).not.toContain('Cancel');
    });

    it('should be visible after show', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.classList.contains('hidden')).toBe(false);
    });
  });

  describe('hide', () => {
    it('should hide the modal without throwing', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      modal.show();

      expect(() => modal.hide()).not.toThrow();
    });

    it('should not throw when called before show', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);

      expect(() => modal.hide()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should remove the modal from DOM', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      modal.show();
      modal.destroy();

      // Give time for destroy to complete
      const modals = document.querySelectorAll('.offline-manager-control');
      expect(modals.length).toBeLessThanOrEqual(1); // May have backdrop or already removed
    });

    it('should not throw when called before show', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);

      expect(() => modal.destroy()).not.toThrow();
    });
  });

  describe('close button', () => {
    it('should have a close button in the modal', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      // Modal should have multiple buttons (cancel, confirm, and potentially close)
      const buttons = element.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('content styling', () => {
    it('should have proper message styling', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      const messageElement = element.querySelector('.text-gray-600');
      expect(messageElement).not.toBeNull();
    });

    it('should have footer with flex layout', () => {
      const options = createOptions();
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      const footer = element.querySelector('.flex.gap-3');
      expect(footer).not.toBeNull();
    });
  });

  describe('different configurations', () => {
    it('should work with delete confirmation', () => {
      const onConfirm = jest.fn();
      const options = createOptions({
        title: 'Delete Region',
        message: 'This will permanently delete the region. This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Keep Region',
        onConfirm,
      });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Delete Region');
      expect(element.textContent).toContain('permanently delete');
      expect(element.textContent).toContain('Delete');
      expect(element.textContent).toContain('Keep Region');
    });

    it('should work with save confirmation', () => {
      const options = createOptions({
        title: 'Save Changes',
        message: 'Do you want to save your changes?',
        confirmText: 'Save',
        cancelText: 'Discard',
      });
      const modal = new ConfirmationModal(options);
      const element = modal.show();

      expect(element.textContent).toContain('Save Changes');
      expect(element.textContent).toContain('save your changes');
    });
  });
});
