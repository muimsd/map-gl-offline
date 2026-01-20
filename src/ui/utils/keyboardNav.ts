/**
 * Keyboard Navigation Utilities
 * Provides helpers for keyboard accessibility in UI components
 */

/**
 * Common key codes for keyboard navigation
 */
export const Keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

export type KeyCode = typeof Keys[keyof typeof Keys];

/**
 * Check if a key event matches a specific key
 */
export function isKey(event: KeyboardEvent, key: KeyCode): boolean {
  return event.key === key;
}

/**
 * Check if Enter or Space was pressed (common activation keys)
 */
export function isActivationKey(event: KeyboardEvent): boolean {
  return isKey(event, Keys.ENTER) || isKey(event, Keys.SPACE);
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Focus trap - keeps focus within a container
 */
export function createFocusTrap(container: HTMLElement): {
  activate: () => void;
  deactivate: () => void;
} {
  let previousActiveElement: HTMLElement | null = null;
  let isActive = false;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isKey(event, Keys.TAB)) return;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Shift + Tab from first element -> go to last
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
    // Tab from last element -> go to first
    else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return {
    activate: () => {
      if (isActive) return;
      isActive = true;

      // Save current focus
      previousActiveElement = document.activeElement as HTMLElement;

      // Add event listener
      container.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element
      const focusableElements = getFocusableElements(container);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    },
    deactivate: () => {
      if (!isActive) return;
      isActive = false;

      // Remove event listener
      container.removeEventListener('keydown', handleKeyDown);

      // Restore previous focus
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    },
  };
}

/**
 * Handle arrow key navigation in a list
 */
export function createArrowKeyNavigation(options: {
  container: HTMLElement;
  itemSelector: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
  loop?: boolean;
  onSelect?: (element: HTMLElement) => void;
}): {
  attach: () => void;
  detach: () => void;
} {
  const { container, itemSelector, orientation = 'vertical', loop = true, onSelect } = options;

  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
  };

  const getCurrentIndex = (items: HTMLElement[]): number => {
    return items.findIndex((item) => item === document.activeElement || item.contains(document.activeElement));
  };

  const focusItem = (items: HTMLElement[], index: number): void => {
    if (index >= 0 && index < items.length) {
      items[index].focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const items = getItems();
    if (items.length === 0) return;

    const currentIndex = getCurrentIndex(items);
    let nextIndex = currentIndex;

    const isVertical = orientation === 'vertical' || orientation === 'both';
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';

    if (isVertical && isKey(event, Keys.ARROW_DOWN)) {
      event.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        nextIndex = loop ? 0 : items.length - 1;
      }
    } else if (isVertical && isKey(event, Keys.ARROW_UP)) {
      event.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = loop ? items.length - 1 : 0;
      }
    } else if (isHorizontal && isKey(event, Keys.ARROW_RIGHT)) {
      event.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        nextIndex = loop ? 0 : items.length - 1;
      }
    } else if (isHorizontal && isKey(event, Keys.ARROW_LEFT)) {
      event.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = loop ? items.length - 1 : 0;
      }
    } else if (isKey(event, Keys.HOME)) {
      event.preventDefault();
      nextIndex = 0;
    } else if (isKey(event, Keys.END)) {
      event.preventDefault();
      nextIndex = items.length - 1;
    } else if (isActivationKey(event) && currentIndex >= 0) {
      event.preventDefault();
      onSelect?.(items[currentIndex]);
      return;
    }

    if (nextIndex !== currentIndex) {
      focusItem(items, nextIndex);
    }
  };

  return {
    attach: () => {
      container.addEventListener('keydown', handleKeyDown);
    },
    detach: () => {
      container.removeEventListener('keydown', handleKeyDown);
    },
  };
}

/**
 * Make an element keyboard-activatable (Enter/Space triggers click)
 */
export function makeActivatable(element: HTMLElement): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isActivationKey(event)) {
      event.preventDefault();
      element.click();
    }
  };

  element.addEventListener('keydown', handleKeyDown);

  // Ensure element is focusable
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '0');
  }

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}
