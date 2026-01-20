/**
 * Tests for LoadingState Component
 */

import { LoadingState } from '../../../../src/ui/components/shared/LoadingState';

describe('LoadingState', () => {
  describe('constructor', () => {
    it('should create a loading state element', () => {
      const loading = new LoadingState();
      expect(loading.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should render a spinner', () => {
      const loading = new LoadingState();
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner).not.toBeNull();
      expect(spinner?.classList.contains('animate-spin')).toBe(true);
    });

    it('should render default message', () => {
      const loading = new LoadingState();
      expect(loading.getElement().textContent).toContain('Loading...');
    });

    it('should render custom message', () => {
      const loading = new LoadingState({ message: 'Please wait...' });
      expect(loading.getElement().textContent).toContain('Please wait...');
    });
  });

  describe('sizes', () => {
    it('should apply small size classes', () => {
      const loading = new LoadingState({ size: 'sm' });
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner?.classList.contains('w-6')).toBe(true);
      expect(spinner?.classList.contains('h-6')).toBe(true);
    });

    it('should apply medium size classes by default', () => {
      const loading = new LoadingState({});
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner?.classList.contains('w-10')).toBe(true);
      expect(spinner?.classList.contains('h-10')).toBe(true);
    });

    it('should apply large size classes', () => {
      const loading = new LoadingState({ size: 'lg' });
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner?.classList.contains('w-16')).toBe(true);
      expect(spinner?.classList.contains('h-16')).toBe(true);
    });
  });

  describe('overlay', () => {
    it('should not have overlay classes by default', () => {
      const loading = new LoadingState({});
      expect(loading.getElement().classList.contains('fixed')).toBe(false);
    });

    it('should have overlay classes when overlay is true', () => {
      const loading = new LoadingState({ overlay: true });
      expect(loading.getElement().classList.contains('fixed')).toBe(true);
      expect(loading.getElement().classList.contains('inset-0')).toBe(true);
    });
  });

  describe('setMessage', () => {
    it('should update the message', () => {
      const loading = new LoadingState({ message: 'Initial' });
      loading.setMessage('Updated');
      expect(loading.getElement().textContent).toContain('Updated');
    });

    it('should create message element if not exists', () => {
      // Create loading without message by using empty string
      const loading = new LoadingState({ message: '' });
      loading.setMessage('New message');
      expect(loading.getElement().textContent).toContain('New message');
    });
  });

  describe('accessibility', () => {
    it('should have role status on spinner', () => {
      const loading = new LoadingState();
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner?.getAttribute('role')).toBe('status');
    });

    it('should have aria-label on spinner', () => {
      const loading = new LoadingState();
      const spinner = loading.getElement().querySelector('[role="status"]');
      expect(spinner?.getAttribute('aria-label')).toBe('Loading');
    });
  });
});
