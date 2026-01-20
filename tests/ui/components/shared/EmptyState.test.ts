/**
 * Tests for EmptyState Component
 */

import { EmptyState } from '../../../../src/ui/components/shared/EmptyState';

describe('EmptyState', () => {
  describe('constructor', () => {
    it('should create an empty state element', () => {
      const empty = new EmptyState();
      expect(empty.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should render default title and message', () => {
      const empty = new EmptyState();
      expect(empty.getElement().textContent).toContain('No items');
      expect(empty.getElement().textContent).toContain('There are no items to display');
    });

    it('should render custom title and message', () => {
      const empty = new EmptyState({
        title: 'No regions',
        message: 'Create a region to get started',
      });
      expect(empty.getElement().textContent).toContain('No regions');
      expect(empty.getElement().textContent).toContain('Create a region to get started');
    });
  });

  describe('icon', () => {
    it('should show default icon by default', () => {
      const empty = new EmptyState();
      const icon = empty.getElement().querySelector('svg');
      expect(icon).not.toBeNull();
    });

    it('should hide icon when showIcon is false', () => {
      const empty = new EmptyState({ showIcon: false });
      const icon = empty.getElement().querySelector('svg');
      expect(icon).toBeNull();
    });

    it('should render custom icon', () => {
      const empty = new EmptyState({
        icon: '<svg class="custom-icon"></svg>',
      });
      const icon = empty.getElement().querySelector('.custom-icon');
      expect(icon).not.toBeNull();
    });
  });

  describe('action', () => {
    it('should not render action button by default', () => {
      const empty = new EmptyState();
      const button = empty.getElement().querySelector('button');
      expect(button).toBeNull();
    });

    it('should render action button when onAction and actionLabel are provided', () => {
      const onAction = jest.fn();
      const empty = new EmptyState({
        actionLabel: 'Create Region',
        onAction,
      });
      const button = empty.getElement().querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('Create Region');
    });

    it('should call onAction when button is clicked', () => {
      const onAction = jest.fn();
      const empty = new EmptyState({
        actionLabel: 'Create Region',
        onAction,
      });
      const button = empty.getElement().querySelector('button');
      button?.click();
      expect(onAction).toHaveBeenCalled();
    });

    it('should not render button if only onAction is provided without label', () => {
      const onAction = jest.fn();
      const empty = new EmptyState({ onAction });
      const button = empty.getElement().querySelector('button');
      expect(button).toBeNull();
    });

    it('should not render button if only actionLabel is provided without handler', () => {
      const empty = new EmptyState({ actionLabel: 'Create' });
      const button = empty.getElement().querySelector('button');
      expect(button).toBeNull();
    });
  });

  describe('styling', () => {
    it('should have centered layout', () => {
      const empty = new EmptyState();
      expect(empty.getElement().classList.contains('flex')).toBe(true);
      expect(empty.getElement().classList.contains('flex-col')).toBe(true);
      expect(empty.getElement().classList.contains('items-center')).toBe(true);
      expect(empty.getElement().classList.contains('justify-center')).toBe(true);
    });

    it('should have text-center class', () => {
      const empty = new EmptyState();
      expect(empty.getElement().classList.contains('text-center')).toBe(true);
    });
  });
});
