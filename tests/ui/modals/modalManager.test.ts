/**
 * Tests for ModalManager Component
 */

import { ModalManager } from '../../../src/ui/modals/modalManager';

describe('ModalManager', () => {
  let modalManager: ModalManager;

  beforeEach(() => {
    modalManager = new ModalManager();
  });

  afterEach(() => {
    // Clean up any modals
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
  });

  const createMockModal = (): HTMLDivElement => {
    const modal = document.createElement('div');
    modal.className = 'test-modal';
    modal.textContent = 'Test Modal Content';
    return modal;
  };

  describe('constructor', () => {
    it('should create a modal manager instance', () => {
      expect(modalManager).toBeInstanceOf(ModalManager);
    });

    it('should start with no active modal', () => {
      expect(modalManager.isOpen()).toBe(false);
      expect(modalManager.getActiveModal()).toBeUndefined();
    });
  });

  describe('show', () => {
    it('should show a modal', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modalManager.isOpen()).toBe(true);
      expect(document.body.contains(modal)).toBe(true);
    });

    it('should add offline-manager-control class to modal', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modal.classList.contains('offline-manager-control')).toBe(true);
    });

    it('should append modal to document body', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modal.parentNode).toBe(document.body);
    });

    it('should close existing modal before showing new one', () => {
      const modal1 = createMockModal();
      modal1.id = 'modal1';
      const modal2 = createMockModal();
      modal2.id = 'modal2';

      modalManager.show(modal1);
      modalManager.show(modal2);

      expect(document.body.contains(modal1)).toBe(false);
      expect(document.body.contains(modal2)).toBe(true);
      expect(modalManager.getActiveModal()).toBe(modal2);
    });

    it('should set the active modal', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modalManager.getActiveModal()).toBe(modal);
    });
  });

  describe('close', () => {
    it('should close the active modal', () => {
      const modal = createMockModal();
      modalManager.show(modal);
      modalManager.close();

      expect(modalManager.isOpen()).toBe(false);
      expect(document.body.contains(modal)).toBe(false);
    });

    it('should clear the active modal reference', () => {
      const modal = createMockModal();
      modalManager.show(modal);
      modalManager.close();

      expect(modalManager.getActiveModal()).toBeUndefined();
    });

    it('should not throw when no modal is open', () => {
      expect(() => modalManager.close()).not.toThrow();
    });

    it('should not throw when called multiple times', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(() => {
        modalManager.close();
        modalManager.close();
        modalManager.close();
      }).not.toThrow();
    });

    it('should handle modal that was removed from DOM externally', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      // Externally remove modal from DOM
      modal.remove();

      // Should not throw
      expect(() => modalManager.close()).not.toThrow();
    });
  });

  describe('isOpen', () => {
    it('should return false when no modal is shown', () => {
      expect(modalManager.isOpen()).toBe(false);
    });

    it('should return true when modal is shown', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modalManager.isOpen()).toBe(true);
    });

    it('should return false after modal is closed', () => {
      const modal = createMockModal();
      modalManager.show(modal);
      modalManager.close();

      expect(modalManager.isOpen()).toBe(false);
    });
  });

  describe('getActiveModal', () => {
    it('should return undefined when no modal is shown', () => {
      expect(modalManager.getActiveModal()).toBeUndefined();
    });

    it('should return the active modal', () => {
      const modal = createMockModal();
      modalManager.show(modal);

      expect(modalManager.getActiveModal()).toBe(modal);
    });

    it('should return undefined after close', () => {
      const modal = createMockModal();
      modalManager.show(modal);
      modalManager.close();

      expect(modalManager.getActiveModal()).toBeUndefined();
    });

    it('should return the most recently shown modal', () => {
      const modal1 = createMockModal();
      const modal2 = createMockModal();

      modalManager.show(modal1);
      modalManager.show(modal2);

      expect(modalManager.getActiveModal()).toBe(modal2);
    });
  });

  describe('multiple instances', () => {
    it('should work independently with multiple manager instances', () => {
      const manager1 = new ModalManager();
      const manager2 = new ModalManager();

      const modal1 = createMockModal();
      modal1.id = 'modal1';
      const modal2 = createMockModal();
      modal2.id = 'modal2';

      manager1.show(modal1);
      manager2.show(modal2);

      expect(manager1.getActiveModal()).toBe(modal1);
      expect(manager2.getActiveModal()).toBe(modal2);

      manager1.close();

      expect(manager1.isOpen()).toBe(false);
      expect(manager2.isOpen()).toBe(true);
    });
  });
});
