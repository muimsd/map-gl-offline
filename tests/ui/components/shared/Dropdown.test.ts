/**
 * Tests for Dropdown Component
 */

import { Dropdown, DropdownItem, DropdownConfig } from '../../../../src/ui/components/shared/Dropdown';

describe('Dropdown', () => {
  let container: HTMLDivElement;
  let trigger: HTMLButtonElement;

  const createItems = (): DropdownItem[] => [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2' },
    { id: 'item3', label: 'Item 3' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    trigger = document.createElement('button');
    trigger.textContent = 'Open Menu';
    container.appendChild(trigger);
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up dropdowns
    document.querySelectorAll('[role="menu"]').forEach(el => el.remove());
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should create a dropdown element', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(dropdown.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have role menu', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(dropdown.getElement().getAttribute('role')).toBe('menu');
    });

    it('should be hidden by default', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(dropdown.getElement().getAttribute('aria-hidden')).toBe('true');
    });

    it('should set aria-haspopup on trigger', () => {
      new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('should set aria-expanded false on trigger', () => {
      new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('items', () => {
    it('should render menu items', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      const items = dropdown.getElement().querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(3);
    });

    it('should display item labels', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      expect(dropdown.getElement().textContent).toContain('Item 1');
      expect(dropdown.getElement().textContent).toContain('Item 2');
      expect(dropdown.getElement().textContent).toContain('Item 3');
    });

    it('should render disabled items', () => {
      const dropdown = new Dropdown({
        items: [
          { id: 'normal', label: 'Normal' },
          { id: 'disabled', label: 'Disabled', disabled: true },
        ],
        trigger,
      });

      const disabledItem = dropdown.getElement().querySelector('[aria-disabled="true"]');
      expect(disabledItem).not.toBeNull();
    });

    it('should render dividers', () => {
      const dropdown = new Dropdown({
        items: [
          { id: 'item1', label: 'Item 1' },
          { id: 'divider', label: '', divider: true },
          { id: 'item2', label: 'Item 2' },
        ],
        trigger,
      });

      const divider = dropdown.getElement().querySelector('[role="separator"]');
      expect(divider).not.toBeNull();
    });

    it('should render items with icons', () => {
      const dropdown = new Dropdown({
        items: [
          { id: 'item1', label: 'Item 1', icon: '<svg>test</svg>' },
        ],
        trigger,
      });

      expect(dropdown.getElement().innerHTML).toContain('<svg>test</svg>');
    });
  });

  describe('open', () => {
    it('should show dropdown', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();

      expect(dropdown.getElement().classList.contains('hidden')).toBe(false);
    });

    it('should set aria-hidden to false', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();

      expect(dropdown.getElement().getAttribute('aria-hidden')).toBe('false');
    });

    it('should set aria-expanded to true on trigger', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('should set isOpen to true', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();

      expect(dropdown.getIsOpen()).toBe(true);
    });
  });

  describe('close', () => {
    it('should hide dropdown', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      dropdown.close();

      expect(dropdown.getElement().classList.contains('hidden')).toBe(true);
    });

    it('should set aria-hidden to true', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      dropdown.close();

      expect(dropdown.getElement().getAttribute('aria-hidden')).toBe('true');
    });

    it('should set aria-expanded to false on trigger', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      dropdown.close();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should set isOpen to false', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      dropdown.close();

      expect(dropdown.getIsOpen()).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should open when closed', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.toggle();

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should close when open', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      dropdown.toggle();

      expect(dropdown.getIsOpen()).toBe(false);
    });
  });

  describe('trigger click', () => {
    it('should open dropdown on trigger click', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      trigger.click();

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should close dropdown on second trigger click', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      trigger.click();
      trigger.click();

      expect(dropdown.getIsOpen()).toBe(false);
    });
  });

  describe('item selection', () => {
    it('should call onSelect when item is clicked', () => {
      const onSelect = jest.fn();
      const items = createItems();
      const dropdown = new Dropdown({
        items,
        trigger,
        onSelect,
      });

      dropdown.open();
      const menuItem = dropdown.getElement().querySelector('[role="menuitem"]') as HTMLElement;
      menuItem.click();

      expect(onSelect).toHaveBeenCalledWith(items[0]);
    });

    it('should close dropdown after selection by default', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        onSelect: jest.fn(),
      });

      dropdown.open();
      const menuItem = dropdown.getElement().querySelector('[role="menuitem"]') as HTMLElement;
      menuItem.click();

      expect(dropdown.getIsOpen()).toBe(false);
    });

    it('should not close dropdown when closeOnSelect is false', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        onSelect: jest.fn(),
        closeOnSelect: false,
      });

      dropdown.open();
      const menuItem = dropdown.getElement().querySelector('[role="menuitem"]') as HTMLElement;
      menuItem.click();

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should not call onSelect for disabled items', () => {
      const onSelect = jest.fn();
      const dropdown = new Dropdown({
        items: [
          { id: 'disabled', label: 'Disabled', disabled: true },
        ],
        trigger,
        onSelect,
      });

      dropdown.open();
      const menuItem = dropdown.getElement().querySelector('[role="menuitem"]') as HTMLButtonElement;
      menuItem.click();

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('setItems', () => {
    it('should update items', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.setItems([
        { id: 'new1', label: 'New Item 1' },
        { id: 'new2', label: 'New Item 2' },
      ]);

      const items = dropdown.getElement().querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(2);
      expect(dropdown.getElement().textContent).toContain('New Item 1');
    });
  });

  describe('getItems', () => {
    it('should return current items', () => {
      const items = createItems();
      const dropdown = new Dropdown({
        items,
        trigger,
      });

      expect(dropdown.getItems()).toEqual(items);
    });

    it('should return a copy, not the original', () => {
      const items = createItems();
      const dropdown = new Dropdown({
        items,
        trigger,
      });

      const returnedItems = dropdown.getItems();
      returnedItems.push({ id: 'new', label: 'New' });

      expect(dropdown.getItems().length).toBe(3);
    });
  });

  describe('positions', () => {
    it('should support bottom-start position', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        position: 'bottom-start',
      });

      dropdown.open();
      expect(dropdown.getElement().style.position).toBe('fixed');
    });

    it('should support bottom-end position', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        position: 'bottom-end',
      });

      dropdown.open();
      expect(dropdown.getElement().style.position).toBe('fixed');
    });

    it('should support top-start position', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        position: 'top-start',
      });

      dropdown.open();
      expect(dropdown.getElement().style.position).toBe('fixed');
    });

    it('should support top-end position', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
        position: 'top-end',
      });

      dropdown.open();
      expect(dropdown.getElement().style.position).toBe('fixed');
    });
  });

  describe('destroy', () => {
    it('should clean up event listeners', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.destroy();

      // Trigger click should not open dropdown anymore
      trigger.click();
      expect(dropdown.getIsOpen()).toBe(false);
    });

    it('should remove element from DOM', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      document.body.appendChild(dropdown.getElement());
      dropdown.destroy();

      expect(document.body.contains(dropdown.getElement())).toBe(false);
    });
  });

  describe('keyboard navigation', () => {
    it('should open on ArrowDown when trigger focused', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should open on Enter when trigger focused', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should open on Space when trigger focused', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(dropdown.getIsOpen()).toBe(true);
    });

    it('should close on Escape', () => {
      const dropdown = new Dropdown({
        items: createItems(),
        trigger,
      });

      dropdown.open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(dropdown.getIsOpen()).toBe(false);
    });
  });
});
