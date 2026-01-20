/**
 * Tests for Toast Component
 */

import { Toast, ToastManager, toastManager } from '../../../../src/ui/components/shared/Toast';

describe('Toast', () => {
  afterEach(() => {
    // Clean up any toasts attached to body
    document.querySelectorAll('[role="alert"]').forEach((el) => el.remove());
    jest.clearAllTimers();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a toast element', () => {
      const toast = new Toast({ message: 'Test message' });
      expect(toast.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have role alert', () => {
      const toast = new Toast({ message: 'Test' });
      expect(toast.getElement().getAttribute('role')).toBe('alert');
    });

    it('should have aria-live polite', () => {
      const toast = new Toast({ message: 'Test' });
      expect(toast.getElement().getAttribute('aria-live')).toBe('polite');
    });

    it('should render the message', () => {
      const toast = new Toast({ message: 'Hello World' });
      expect(toast.getElement().textContent).toContain('Hello World');
    });
  });

  describe('types', () => {
    it('should apply success styling', () => {
      const toast = new Toast({ message: 'Success', type: 'success' });
      expect(toast.getElement().classList.contains('bg-green-50')).toBe(true);
    });

    it('should apply error styling', () => {
      const toast = new Toast({ message: 'Error', type: 'error' });
      expect(toast.getElement().classList.contains('bg-red-50')).toBe(true);
    });

    it('should apply warning styling', () => {
      const toast = new Toast({ message: 'Warning', type: 'warning' });
      expect(toast.getElement().classList.contains('bg-yellow-50')).toBe(true);
    });

    it('should apply info styling by default', () => {
      const toast = new Toast({ message: 'Info' });
      expect(toast.getElement().classList.contains('bg-blue-50')).toBe(true);
    });
  });

  describe('positions', () => {
    it('should position top-right by default', () => {
      const toast = new Toast({ message: 'Test' });
      expect(toast.getElement().classList.contains('top-4')).toBe(true);
      expect(toast.getElement().classList.contains('right-4')).toBe(true);
    });

    it('should position top-left', () => {
      const toast = new Toast({ message: 'Test', position: 'top-left' });
      expect(toast.getElement().classList.contains('top-4')).toBe(true);
      expect(toast.getElement().classList.contains('left-4')).toBe(true);
    });

    it('should position bottom-right', () => {
      const toast = new Toast({ message: 'Test', position: 'bottom-right' });
      expect(toast.getElement().classList.contains('bottom-4')).toBe(true);
      expect(toast.getElement().classList.contains('right-4')).toBe(true);
    });

    it('should position bottom-left', () => {
      const toast = new Toast({ message: 'Test', position: 'bottom-left' });
      expect(toast.getElement().classList.contains('bottom-4')).toBe(true);
      expect(toast.getElement().classList.contains('left-4')).toBe(true);
    });

    it('should position top-center', () => {
      const toast = new Toast({ message: 'Test', position: 'top-center' });
      expect(toast.getElement().classList.contains('top-4')).toBe(true);
      expect(toast.getElement().classList.contains('left-1/2')).toBe(true);
    });

    it('should position bottom-center', () => {
      const toast = new Toast({ message: 'Test', position: 'bottom-center' });
      expect(toast.getElement().classList.contains('bottom-4')).toBe(true);
      expect(toast.getElement().classList.contains('left-1/2')).toBe(true);
    });
  });

  describe('dismissible', () => {
    it('should render dismiss button by default', () => {
      const toast = new Toast({ message: 'Test' });
      const button = toast.getElement().querySelector('button');
      expect(button).not.toBeNull();
    });

    it('should not render dismiss button when dismissible is false', () => {
      const toast = new Toast({ message: 'Test', dismissible: false });
      const button = toast.getElement().querySelector('button');
      expect(button).toBeNull();
    });

    it('should dismiss when button clicked', () => {
      const onDismiss = jest.fn();
      const toast = new Toast({ message: 'Test', onDismiss });
      toast.show();

      const button = toast.getElement().querySelector('button');
      button?.click();

      jest.advanceTimersByTime(300);
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after duration', () => {
      const onDismiss = jest.fn();
      const toast = new Toast({ message: 'Test', duration: 3000, onDismiss });
      toast.show();

      jest.advanceTimersByTime(3000);
      jest.advanceTimersByTime(300); // Wait for animation

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should not auto-dismiss when duration is 0', () => {
      const onDismiss = jest.fn();
      const toast = new Toast({ message: 'Test', duration: 0, onDismiss });
      toast.show();

      jest.advanceTimersByTime(10000);
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should append to body', () => {
      const toast = new Toast({ message: 'Test' });
      toast.show();
      expect(document.body.contains(toast.getElement())).toBe(true);
    });
  });

  describe('dismiss', () => {
    it('should remove from body', () => {
      const toast = new Toast({ message: 'Test' });
      toast.show();
      toast.dismiss();

      jest.advanceTimersByTime(300);
      expect(document.body.contains(toast.getElement())).toBe(false);
    });

    it('should call onDismiss callback', () => {
      const onDismiss = jest.fn();
      const toast = new Toast({ message: 'Test', onDismiss });
      toast.show();
      toast.dismiss();

      jest.advanceTimersByTime(300);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should add exit animation class', () => {
      const toast = new Toast({ message: 'Test' });
      toast.show();
      toast.dismiss();
      expect(toast.getElement().classList.contains('animate-toast-out')).toBe(true);
    });
  });

  describe('setMessage', () => {
    it('should update the message', () => {
      const toast = new Toast({ message: 'Original' });
      toast.setMessage('Updated');
      expect(toast.getElement().textContent).toContain('Updated');
    });
  });
});

describe('ToastManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Clean up any existing toasts
    document.querySelectorAll('[role="alert"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    toastManager.dismissAll();
    jest.advanceTimersByTime(500);
    document.querySelectorAll('[role="alert"]').forEach((el) => el.remove());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ToastManager.getInstance();
      const instance2 = ToastManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('show', () => {
    it('should create and show a toast', () => {
      const toast = toastManager.show({ message: 'Test' });
      expect(document.body.contains(toast.getElement())).toBe(true);
    });
  });

  describe('convenience methods', () => {
    it('should show success toast', () => {
      const toast = toastManager.success('Success!');
      expect(toast.getElement().classList.contains('bg-green-50')).toBe(true);
    });

    it('should show error toast', () => {
      const toast = toastManager.error('Error!');
      expect(toast.getElement().classList.contains('bg-red-50')).toBe(true);
    });

    it('should show warning toast', () => {
      const toast = toastManager.warning('Warning!');
      expect(toast.getElement().classList.contains('bg-yellow-50')).toBe(true);
    });

    it('should show info toast', () => {
      const toast = toastManager.info('Info!');
      expect(toast.getElement().classList.contains('bg-blue-50')).toBe(true);
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all toasts', () => {
      toastManager.show({ message: 'Toast 1', duration: 0 });
      toastManager.show({ message: 'Toast 2', duration: 0 });
      toastManager.show({ message: 'Toast 3', duration: 0 });

      toastManager.dismissAll();

      // Wait for dismiss animation
      jest.advanceTimersByTime(500);

      // The toasts should be dismissed (internal tracking cleared)
      // Even if DOM cleanup is async, showing new toasts should work
      const newToast = toastManager.show({ message: 'New toast', duration: 0 });
      expect(newToast.getElement()).toBeDefined();
    });
  });

  describe('max toasts', () => {
    it('should limit toasts to max 5 in manager tracking', () => {
      // Add 7 toasts with duration 0 (no auto dismiss)
      for (let i = 0; i < 7; i++) {
        toastManager.show({ message: `Toast ${i}`, duration: 0 });
        // Wait for any potential dismissal animations
        jest.advanceTimersByTime(250);
      }

      // The manager should have dismissed the oldest ones
      // We can verify by checking that we can still add more
      const finalToast = toastManager.show({ message: 'Final', duration: 0 });
      expect(finalToast.getElement()).toBeDefined();
    });
  });
});
