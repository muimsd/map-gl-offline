/**
 * Tests for ErrorState Component
 */

import { ErrorState } from '../../../../src/ui/components/shared/ErrorState';

describe('ErrorState', () => {
  describe('constructor', () => {
    it('should create an error state element', () => {
      const error = new ErrorState();
      expect(error.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have role alert', () => {
      const error = new ErrorState();
      expect(error.getElement().getAttribute('role')).toBe('alert');
    });

    it('should render default title and message', () => {
      const error = new ErrorState();
      expect(error.getElement().textContent).toContain('Error');
      expect(error.getElement().textContent).toContain('Something went wrong');
    });

    it('should render custom title and message', () => {
      const error = new ErrorState({
        title: 'Connection Failed',
        message: 'Unable to connect to server',
      });
      expect(error.getElement().textContent).toContain('Connection Failed');
      expect(error.getElement().textContent).toContain('Unable to connect to server');
    });
  });

  describe('types', () => {
    it('should apply error styling by default', () => {
      const error = new ErrorState({});
      expect(error.getElement().classList.contains('bg-red-50')).toBe(true);
    });

    it('should apply warning styling', () => {
      const error = new ErrorState({ type: 'warning' });
      expect(error.getElement().classList.contains('bg-yellow-50')).toBe(true);
    });

    it('should apply info styling', () => {
      const error = new ErrorState({ type: 'info' });
      expect(error.getElement().classList.contains('bg-blue-50')).toBe(true);
    });
  });

  describe('icon', () => {
    it('should show icon by default', () => {
      const error = new ErrorState();
      const icon = error.getElement().querySelector('svg');
      expect(icon).not.toBeNull();
    });

    it('should hide icon when showIcon is false', () => {
      const error = new ErrorState({ showIcon: false });
      const icon = error.getElement().querySelector('svg');
      expect(icon).toBeNull();
    });
  });

  describe('actions', () => {
    it('should render retry button when onRetry is provided', () => {
      const onRetry = jest.fn();
      const error = new ErrorState({ onRetry });
      const button = error.getElement().querySelector('button');
      expect(button?.textContent).toBe('Try Again');
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = jest.fn();
      const error = new ErrorState({ onRetry });
      const button = error.getElement().querySelector('button');
      button?.click();
      expect(onRetry).toHaveBeenCalled();
    });

    it('should render dismiss button when onDismiss is provided', () => {
      const onDismiss = jest.fn();
      const error = new ErrorState({ onDismiss });
      const buttons = error.getElement().querySelectorAll('button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent).toBe('Cancel');
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = jest.fn();
      const error = new ErrorState({ onDismiss });
      const button = error.getElement().querySelector('button');
      button?.click();
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should render both buttons when both handlers provided', () => {
      const onRetry = jest.fn();
      const onDismiss = jest.fn();
      const error = new ErrorState({ onRetry, onDismiss });
      const buttons = error.getElement().querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });

    it('should use custom button labels', () => {
      const error = new ErrorState({
        onRetry: jest.fn(),
        onDismiss: jest.fn(),
        retryLabel: 'Retry Now',
        dismissLabel: 'Close',
      });
      const buttons = error.getElement().querySelectorAll('button');
      expect(buttons[0].textContent).toBe('Retry Now');
      expect(buttons[1].textContent).toBe('Close');
    });
  });

  describe('setMessage', () => {
    it('should update the message', () => {
      const error = new ErrorState({ message: 'Initial' });
      error.setMessage('Updated');
      expect(error.getElement().textContent).toContain('Updated');
    });
  });

  describe('setTitle', () => {
    it('should update the title', () => {
      const error = new ErrorState({ title: 'Initial' });
      error.setTitle('Updated');
      expect(error.getElement().textContent).toContain('Updated');
    });

    it('should create title element if not exists', () => {
      const error = new ErrorState({ title: '' });
      error.setTitle('New Title');
      expect(error.getElement().textContent).toContain('New Title');
    });
  });
});
