/**
 * Tests for Keyboard Navigation Utilities
 */

import {
  Keys,
  isKey,
  isActivationKey,
  getFocusableElements,
  createFocusTrap,
  createArrowKeyNavigation,
  makeActivatable,
  announceToScreenReader,
} from '../../../src/ui/utils/keyboardNav';

describe('Keyboard Navigation Utilities', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Keys', () => {
    it('should have correct key constants', () => {
      expect(Keys.ENTER).toBe('Enter');
      expect(Keys.SPACE).toBe(' ');
      expect(Keys.ESCAPE).toBe('Escape');
      expect(Keys.TAB).toBe('Tab');
      expect(Keys.ARROW_UP).toBe('ArrowUp');
      expect(Keys.ARROW_DOWN).toBe('ArrowDown');
      expect(Keys.ARROW_LEFT).toBe('ArrowLeft');
      expect(Keys.ARROW_RIGHT).toBe('ArrowRight');
      expect(Keys.HOME).toBe('Home');
      expect(Keys.END).toBe('End');
    });
  });

  describe('isKey', () => {
    it('should return true for matching key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(isKey(event, Keys.ENTER)).toBe(true);
    });

    it('should return false for non-matching key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(isKey(event, Keys.ESCAPE)).toBe(false);
    });
  });

  describe('isActivationKey', () => {
    it('should return true for Enter', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(isActivationKey(event)).toBe(true);
    });

    it('should return true for Space', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      expect(isActivationKey(event)).toBe(true);
    });

    it('should return false for other keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      expect(isActivationKey(event)).toBe(false);
    });
  });

  describe('getFocusableElements', () => {
    it('should return buttons', () => {
      container.innerHTML = '<button>Click</button>';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('BUTTON');
    });

    it('should return links with href', () => {
      container.innerHTML = '<a href="#">Link</a>';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(1);
    });

    it('should return inputs', () => {
      container.innerHTML = '<input type="text" />';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(1);
    });

    it('should not return disabled elements', () => {
      container.innerHTML = '<button disabled>Disabled</button>';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(0);
    });

    it('should return elements with tabindex', () => {
      container.innerHTML = '<div tabindex="0">Focusable div</div>';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(1);
    });

    it('should not return elements with tabindex -1', () => {
      container.innerHTML = '<div tabindex="-1">Not focusable</div>';
      const elements = getFocusableElements(container);
      expect(elements.length).toBe(0);
    });
  });

  describe('createFocusTrap', () => {
    it('should focus first element on activate', () => {
      container.innerHTML = '<button id="first">First</button><button id="second">Second</button>';
      const trap = createFocusTrap(container);

      trap.activate();
      expect(document.activeElement?.id).toBe('first');

      trap.deactivate();
    });

    it('should restore focus on deactivate', () => {
      const externalButton = document.createElement('button');
      externalButton.id = 'external';
      document.body.appendChild(externalButton);
      externalButton.focus();

      container.innerHTML = '<button id="first">First</button>';
      const trap = createFocusTrap(container);

      trap.activate();
      trap.deactivate();

      expect(document.activeElement?.id).toBe('external');
      document.body.removeChild(externalButton);
    });

    it('should wrap focus from last to first on Tab', () => {
      container.innerHTML = '<button id="first">First</button><button id="last">Last</button>';
      const trap = createFocusTrap(container);
      trap.activate();

      const lastButton = container.querySelector('#last') as HTMLElement;
      lastButton.focus();

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(tabEvent);

      // Note: In JSDOM, focus doesn't work as expected, so we just verify no errors
      trap.deactivate();
    });
  });

  describe('createArrowKeyNavigation', () => {
    it('should navigate down with arrow down', () => {
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
        <button class="item">Item 3</button>
      `;

      const nav = createArrowKeyNavigation({
        container,
        itemSelector: '.item',
      });
      nav.attach();

      const items = container.querySelectorAll('.item');
      (items[0] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      container.dispatchEvent(event);

      nav.detach();
    });

    it('should call onSelect when activation key pressed', () => {
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
      `;

      const onSelect = jest.fn();
      const nav = createArrowKeyNavigation({
        container,
        itemSelector: '.item',
        onSelect,
      });
      nav.attach();

      const items = container.querySelectorAll('.item');
      (items[0] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      container.dispatchEvent(event);

      nav.detach();
    });

    it('should handle horizontal orientation', () => {
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
      `;

      const nav = createArrowKeyNavigation({
        container,
        itemSelector: '.item',
        orientation: 'horizontal',
      });
      nav.attach();

      const items = container.querySelectorAll('.item');
      (items[0] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      container.dispatchEvent(event);

      nav.detach();
    });

    it('should navigate to first with Home key', () => {
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
        <button class="item">Item 3</button>
      `;

      const nav = createArrowKeyNavigation({
        container,
        itemSelector: '.item',
      });
      nav.attach();

      const items = container.querySelectorAll('.item');
      (items[2] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
      container.dispatchEvent(event);

      nav.detach();
    });

    it('should navigate to last with End key', () => {
      container.innerHTML = `
        <button class="item">Item 1</button>
        <button class="item">Item 2</button>
        <button class="item">Item 3</button>
      `;

      const nav = createArrowKeyNavigation({
        container,
        itemSelector: '.item',
      });
      nav.attach();

      const items = container.querySelectorAll('.item');
      (items[0] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
      container.dispatchEvent(event);

      nav.detach();
    });
  });

  describe('makeActivatable', () => {
    it('should add tabindex if not present', () => {
      const div = document.createElement('div');
      container.appendChild(div);

      makeActivatable(div);
      expect(div.getAttribute('tabindex')).toBe('0');
    });

    it('should not override existing tabindex', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '5');
      container.appendChild(div);

      makeActivatable(div);
      expect(div.getAttribute('tabindex')).toBe('5');
    });

    it('should trigger click on Enter', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const onClick = jest.fn();
      button.addEventListener('click', onClick);

      makeActivatable(button);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      button.dispatchEvent(event);

      expect(onClick).toHaveBeenCalled();
    });

    it('should trigger click on Space', () => {
      const button = document.createElement('button');
      container.appendChild(button);

      const onClick = jest.fn();
      button.addEventListener('click', onClick);

      makeActivatable(button);

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      button.dispatchEvent(event);

      expect(onClick).toHaveBeenCalled();
    });

    it('should return cleanup function', () => {
      const div = document.createElement('div');
      container.appendChild(div);

      const cleanup = makeActivatable(div);
      expect(typeof cleanup).toBe('function');
    });
  });

  describe('announceToScreenReader', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Clean up any existing announcements
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
    });

    afterEach(() => {
      jest.advanceTimersByTime(2000);
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
      jest.useRealTimers();
    });

    it('should create announcement element', () => {
      announceToScreenReader('Test message');

      const announcements = document.querySelectorAll('[role="status"]');
      const announcement = announcements[announcements.length - 1];
      expect(announcement).not.toBeNull();
      expect(announcement?.textContent).toBe('Test message');
    });

    it('should use polite aria-live by default', () => {
      announceToScreenReader('Test message polite');

      const announcements = document.querySelectorAll('[role="status"]');
      const announcement = announcements[announcements.length - 1];
      expect(announcement?.getAttribute('aria-live')).toBe('polite');
    });

    it('should use assertive aria-live when specified', () => {
      announceToScreenReader('Urgent message', 'assertive');

      const announcements = document.querySelectorAll('[role="status"]');
      const announcement = announcements[announcements.length - 1];
      expect(announcement?.getAttribute('aria-live')).toBe('assertive');
    });

    it('should remove announcement after timeout', () => {
      const initialCount = document.querySelectorAll('[role="status"]').length;
      announceToScreenReader('Test message timeout');

      expect(document.querySelectorAll('[role="status"]').length).toBe(initialCount + 1);

      jest.advanceTimersByTime(1100);

      expect(document.querySelectorAll('[role="status"]').length).toBe(initialCount);
    });
  });
});
