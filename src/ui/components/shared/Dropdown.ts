/**
 * Dropdown Component
 * Accessible dropdown menu with keyboard navigation
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';
import { Keys, createArrowKeyNavigation, createFocusTrap } from '../../utils/keyboardNav';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownConfig extends ComponentConfig {
  items: DropdownItem[];
  trigger: HTMLElement;
  position?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  onSelect?: (item: DropdownItem) => void;
  closeOnSelect?: boolean;
}

export class Dropdown extends BaseComponent {
  private dropdownConfig: DropdownConfig;
  private isOpen = false;
  private keyboardNav?: { attach: () => void; detach: () => void };
  private focusTrap?: { activate: () => void; deactivate: () => void };

  constructor(config: DropdownConfig) {
    const normalizedConfig = {
      position: 'bottom-start' as const,
      closeOnSelect: true,
      ...config,
    };
    super(normalizedConfig);
    this.dropdownConfig = normalizedConfig;
    this.setupDropdown();
    this.setupTrigger();
  }

  protected createElement(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-hidden', 'true');
    return dropdown;
  }

  private setupDropdown(): void {
    this.element.className = `
      absolute z-[3000] min-w-[160px]
      bg-white dark:bg-gray-800
      border border-gray-200 dark:border-gray-700
      rounded-lg shadow-lg
      py-1
      hidden
    `.replace(/\s+/g, ' ').trim();

    // Render items
    this.renderItems();

    // Setup keyboard navigation
    this.keyboardNav = createArrowKeyNavigation({
      container: this.element,
      itemSelector: '[role="menuitem"]:not([aria-disabled="true"])',
      orientation: 'vertical',
      onSelect: (element) => {
        const itemId = element.dataset.itemId;
        const item = this.dropdownConfig.items.find(i => i.id === itemId);
        if (item) {
          this.handleItemSelect(item);
        }
      },
    });

    // Setup focus trap
    this.focusTrap = createFocusTrap(this.element);

    // Close on click outside
    document.addEventListener('click', this.handleClickOutside);

    // Close on Escape
    document.addEventListener('keydown', this.handleEscape);
  }

  private setupTrigger(): void {
    const trigger = this.dropdownConfig.trigger;

    // Set up accessibility attributes
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    // Add click handler
    trigger.addEventListener('click', this.handleTriggerClick);

    // Add keyboard handler for trigger
    trigger.addEventListener('keydown', this.handleTriggerKeydown);
  }

  private renderItems(): void {
    this.element.innerHTML = '';

    for (const item of this.dropdownConfig.items) {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'my-1 border-t border-gray-200 dark:border-gray-700';
        divider.setAttribute('role', 'separator');
        this.element.appendChild(divider);
        continue;
      }

      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.setAttribute('role', 'menuitem');
      menuItem.dataset.itemId = item.id;

      if (item.disabled) {
        menuItem.setAttribute('aria-disabled', 'true');
        menuItem.disabled = true;
      }

      menuItem.className = `
        w-full px-4 py-2 text-left text-sm
        ${item.disabled
          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
        }
        flex items-center gap-2
        transition-colors
        focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
      `.replace(/\s+/g, ' ').trim();

      if (item.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'w-4 h-4 flex-shrink-0';
        iconSpan.innerHTML = item.icon;
        menuItem.appendChild(iconSpan);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      menuItem.appendChild(labelSpan);

      menuItem.addEventListener('click', () => {
        if (!item.disabled) {
          this.handleItemSelect(item);
        }
      });

      this.element.appendChild(menuItem);
    }
  }

  private handleTriggerClick = (event: Event): void => {
    event.stopPropagation();
    this.toggle();
  };

  private handleTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.key === Keys.ARROW_DOWN || event.key === Keys.ENTER || event.key === Keys.SPACE) {
      event.preventDefault();
      this.open();
    }
  };

  private handleClickOutside = (event: Event): void => {
    const target = event.target as Node;
    if (!this.element.contains(target) && !this.dropdownConfig.trigger.contains(target)) {
      this.close();
    }
  };

  private handleEscape = (event: KeyboardEvent): void => {
    if (event.key === Keys.ESCAPE && this.isOpen) {
      event.preventDefault();
      this.close();
      this.dropdownConfig.trigger.focus();
    }
  };

  private handleItemSelect(item: DropdownItem): void {
    this.dropdownConfig.onSelect?.(item);

    if (this.dropdownConfig.closeOnSelect) {
      this.close();
      this.dropdownConfig.trigger.focus();
    }
  }

  /**
   * Open the dropdown
   */
  public open(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.element.classList.remove('hidden');
    this.element.setAttribute('aria-hidden', 'false');
    this.dropdownConfig.trigger.setAttribute('aria-expanded', 'true');

    this.positionDropdown();

    // Attach keyboard navigation
    this.keyboardNav?.attach();
    this.focusTrap?.activate();

    // Focus first item
    const firstItem = this.element.querySelector('[role="menuitem"]:not([aria-disabled="true"])') as HTMLElement;
    firstItem?.focus();
  }

  /**
   * Close the dropdown
   */
  public close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.element.classList.add('hidden');
    this.element.setAttribute('aria-hidden', 'true');
    this.dropdownConfig.trigger.setAttribute('aria-expanded', 'false');

    // Detach keyboard navigation
    this.keyboardNav?.detach();
    this.focusTrap?.deactivate();
  }

  /**
   * Toggle dropdown
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if dropdown is open
   */
  public getIsOpen(): boolean {
    return this.isOpen;
  }

  private positionDropdown(): void {
    const triggerRect = this.dropdownConfig.trigger.getBoundingClientRect();
    const dropdownRect = this.element.getBoundingClientRect();
    const position = this.dropdownConfig.position || 'bottom-start';

    let top: number;
    let left: number;

    switch (position) {
      case 'bottom-start':
        top = triggerRect.bottom + 4;
        left = triggerRect.left;
        break;
      case 'bottom-end':
        top = triggerRect.bottom + 4;
        left = triggerRect.right - dropdownRect.width;
        break;
      case 'top-start':
        top = triggerRect.top - dropdownRect.height - 4;
        left = triggerRect.left;
        break;
      case 'top-end':
        top = triggerRect.top - dropdownRect.height - 4;
        left = triggerRect.right - dropdownRect.width;
        break;
      default:
        top = triggerRect.bottom + 4;
        left = triggerRect.left;
    }

    // Keep within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - dropdownRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - dropdownRect.height - padding));

    this.element.style.position = 'fixed';
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  /**
   * Update items
   */
  public setItems(items: DropdownItem[]): void {
    this.dropdownConfig.items = items;
    this.renderItems();

    // Re-setup keyboard navigation
    if (this.keyboardNav) {
      this.keyboardNav.detach();
    }
    this.keyboardNav = createArrowKeyNavigation({
      container: this.element,
      itemSelector: '[role="menuitem"]:not([aria-disabled="true"])',
      orientation: 'vertical',
      onSelect: (element) => {
        const itemId = element.dataset.itemId;
        const item = this.dropdownConfig.items.find(i => i.id === itemId);
        if (item) {
          this.handleItemSelect(item);
        }
      },
    });
  }

  /**
   * Get items
   */
  public getItems(): DropdownItem[] {
    return [...this.dropdownConfig.items];
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleEscape);
    this.dropdownConfig.trigger.removeEventListener('click', this.handleTriggerClick);
    this.dropdownConfig.trigger.removeEventListener('keydown', this.handleTriggerKeydown);
    this.keyboardNav?.detach();
    this.focusTrap?.deactivate();

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
