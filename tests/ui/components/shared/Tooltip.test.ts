/**
 * Tests for Tooltip Component
 */

import { Tooltip, createTooltip } from '../../../../src/ui/components/shared/Tooltip';

describe('Tooltip', () => {
  let container: HTMLDivElement;
  let targetElement: HTMLButtonElement;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    targetElement = document.createElement('button');
    targetElement.textContent = 'Hover me';
    container.appendChild(targetElement);
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up tooltips
    document.querySelectorAll('[role="tooltip"]').forEach(el => el.remove());
    document.body.removeChild(container);
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a tooltip element', () => {
      const tooltip = new Tooltip({ content: 'Test tooltip' });
      expect(tooltip.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have role tooltip', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      expect(tooltip.getElement().getAttribute('role')).toBe('tooltip');
    });

    it('should be hidden by default', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      expect(tooltip.getElement().getAttribute('aria-hidden')).toBe('true');
    });

    it('should render the content', () => {
      const tooltip = new Tooltip({ content: 'Hello World' });
      expect(tooltip.getElement().textContent).toContain('Hello World');
    });
  });

  describe('positions', () => {
    it('should support top position', () => {
      const tooltip = new Tooltip({ content: 'Test', position: 'top' });
      // Arrow should be at bottom for top position
      const arrow = tooltip.getElement().querySelector('div');
      expect(arrow?.classList.contains('-bottom-1')).toBe(true);
    });

    it('should support bottom position', () => {
      const tooltip = new Tooltip({ content: 'Test', position: 'bottom' });
      const arrow = tooltip.getElement().querySelector('div');
      expect(arrow?.classList.contains('-top-1')).toBe(true);
    });

    it('should support left position', () => {
      const tooltip = new Tooltip({ content: 'Test', position: 'left' });
      const arrow = tooltip.getElement().querySelector('div');
      expect(arrow?.classList.contains('-right-1')).toBe(true);
    });

    it('should support right position', () => {
      const tooltip = new Tooltip({ content: 'Test', position: 'right' });
      const arrow = tooltip.getElement().querySelector('div');
      expect(arrow?.classList.contains('-left-1')).toBe(true);
    });

    it('should default to top position', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      const arrow = tooltip.getElement().querySelector('div');
      expect(arrow?.classList.contains('-bottom-1')).toBe(true);
    });
  });

  describe('attach', () => {
    it('should add tooltip to body', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);

      expect(document.body.contains(tooltip.getElement())).toBe(true);
    });

    it('should set aria-describedby on target', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);

      expect(targetElement.hasAttribute('aria-describedby')).toBe(true);
    });

    it('should set tooltip id matching aria-describedby', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);

      const describedBy = targetElement.getAttribute('aria-describedby');
      expect(tooltip.getElement().id).toBe(describedBy);
    });
  });

  describe('detach', () => {
    it('should remove tooltip from body', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);
      tooltip.detach();

      expect(document.body.contains(tooltip.getElement())).toBe(false);
    });

    it('should remove aria-describedby from target', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);
      tooltip.detach();

      expect(targetElement.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('mouse interactions', () => {
    it('should show on mouseenter after delay', () => {
      const tooltip = new Tooltip({ content: 'Test', delay: 300 });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));

      // Before delay
      expect(tooltip.getElement().classList.contains('opacity-0')).toBe(true);

      // After delay
      jest.advanceTimersByTime(300);
      expect(tooltip.getElement().classList.contains('opacity-100')).toBe(true);
    });

    it('should hide on mouseleave', () => {
      const tooltip = new Tooltip({ content: 'Test', delay: 0 });
      tooltip.attach(targetElement);

      // Show tooltip
      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      jest.advanceTimersByTime(0);

      // Hide tooltip
      targetElement.dispatchEvent(new MouseEvent('mouseleave'));
      jest.advanceTimersByTime(100);

      expect(tooltip.getElement().classList.contains('opacity-0')).toBe(true);
    });

    it('should respect custom delay', () => {
      const tooltip = new Tooltip({ content: 'Test', delay: 500 });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));

      // Before custom delay
      jest.advanceTimersByTime(300);
      expect(tooltip.getElement().classList.contains('opacity-0')).toBe(true);

      // After custom delay
      jest.advanceTimersByTime(200);
      expect(tooltip.getElement().classList.contains('opacity-100')).toBe(true);
    });
  });

  describe('focus interactions', () => {
    it('should show immediately on focus', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new FocusEvent('focus'));

      expect(tooltip.getElement().classList.contains('opacity-100')).toBe(true);
    });

    it('should hide on blur', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new FocusEvent('focus'));
      targetElement.dispatchEvent(new FocusEvent('blur'));

      expect(tooltip.getElement().classList.contains('opacity-0')).toBe(true);
    });
  });

  describe('setContent', () => {
    it('should update tooltip content', () => {
      const tooltip = new Tooltip({ content: 'Original' });
      tooltip.setContent('Updated');

      expect(tooltip.getElement().textContent).toContain('Updated');
    });
  });

  describe('getContent', () => {
    it('should return current content', () => {
      const tooltip = new Tooltip({ content: 'Test Content' });
      expect(tooltip.getContent()).toBe('Test Content');
    });

    it('should return updated content after setContent', () => {
      const tooltip = new Tooltip({ content: 'Original' });
      tooltip.setContent('New Content');
      expect(tooltip.getContent()).toBe('New Content');
    });
  });

  describe('maxWidth', () => {
    it('should set default max width', () => {
      const tooltip = new Tooltip({ content: 'Test' });
      expect(tooltip.getElement().style.maxWidth).toBe('200px');
    });

    it('should respect custom max width', () => {
      const tooltip = new Tooltip({ content: 'Test', maxWidth: 300 });
      expect(tooltip.getElement().style.maxWidth).toBe('300px');
    });
  });

  describe('createTooltip helper', () => {
    it('should create and attach tooltip', () => {
      const tooltip = createTooltip(targetElement, 'Helper tooltip');

      expect(document.body.contains(tooltip.getElement())).toBe(true);
      expect(targetElement.hasAttribute('aria-describedby')).toBe(true);
    });

    it('should accept options', () => {
      const tooltip = createTooltip(targetElement, 'Test', { position: 'bottom' });
      const arrow = tooltip.getElement().querySelector('div');

      expect(arrow?.classList.contains('-top-1')).toBe(true);
    });
  });

  describe('aria-hidden state', () => {
    it('should set aria-hidden false when shown', () => {
      const tooltip = new Tooltip({ content: 'Test', delay: 0 });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      jest.advanceTimersByTime(0);

      expect(tooltip.getElement().getAttribute('aria-hidden')).toBe('false');
    });

    it('should set aria-hidden true when hidden', () => {
      const tooltip = new Tooltip({ content: 'Test', delay: 0 });
      tooltip.attach(targetElement);

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      jest.advanceTimersByTime(0);
      targetElement.dispatchEvent(new MouseEvent('mouseleave'));
      jest.advanceTimersByTime(100);

      expect(tooltip.getElement().getAttribute('aria-hidden')).toBe('true');
    });
  });
});
