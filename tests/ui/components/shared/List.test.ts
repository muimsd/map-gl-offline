/**
 * Tests for List Component
 */

import { List, ListItemConfig } from '../../../../src/ui/components/shared/List';

describe('List', () => {
  describe('constructor', () => {
    it('should create a list container element', () => {
      const list = new List();
      expect(list.getElement()).toBeInstanceOf(HTMLElement);
      expect(list.getElement().classList.contains('flex')).toBe(true);
    });

    it('should render empty state when no items', () => {
      const list = new List();
      const emptyElement = list.getElement().querySelector('.text-center');
      expect(emptyElement?.textContent).toBe('No items to display');
    });

    it('should render custom empty text', () => {
      const list = new List({ emptyText: 'Nothing here' });
      const emptyElement = list.getElement().querySelector('.text-center');
      expect(emptyElement?.textContent).toBe('Nothing here');
    });

    it('should render items', () => {
      const items: ListItemConfig[] = [
        { id: '1', data: 'Item 1' },
        { id: '2', data: 'Item 2' },
      ];
      const list = new List({ items });
      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(2);
    });
  });

  describe('item rendering', () => {
    it('should render string data', () => {
      const list = new List({
        items: [{ id: '1', data: 'Test string' }],
      });
      expect(list.getElement().textContent).toContain('Test string');
    });

    it('should render object with title', () => {
      const list = new List({
        items: [{ id: '1', data: { title: 'My Title', description: 'My Desc' } }],
      });
      expect(list.getElement().textContent).toContain('My Title');
      expect(list.getElement().textContent).toContain('My Desc');
    });

    it('should render object with name', () => {
      const list = new List({
        items: [{ id: '1', data: { name: 'My Name' } }],
      });
      expect(list.getElement().textContent).toContain('My Name');
    });

    it('should JSON stringify unknown object types', () => {
      const list = new List({
        items: [{ id: '1', data: { customField: 'value' } }],
      });
      expect(list.getElement().textContent).toContain('customField');
    });

    it('should use custom item template', () => {
      const list = new List({
        items: [{ id: '1', data: { value: 42 } }],
        itemTemplate: (item) => `<span class="custom">Value: ${(item as { value: number }).value}</span>`,
      });
      expect(list.getElement().innerHTML).toContain('Value: 42');
      expect(list.getElement().querySelector('.custom')).not.toBeNull();
    });

    it('should use item-specific template over global template', () => {
      const list = new List({
        items: [{ id: '1', data: 'test', template: '<strong>Item Template</strong>' }],
        itemTemplate: () => '<em>Global Template</em>',
      });
      expect(list.getElement().innerHTML).toContain('<strong>Item Template</strong>');
      expect(list.getElement().innerHTML).not.toContain('<em>Global Template</em>');
    });
  });

  describe('item click', () => {
    it('should call onItemClick when item is clicked', () => {
      const onItemClick = jest.fn();
      const items: ListItemConfig[] = [{ id: '1', data: 'Test' }];
      const list = new List({ items, onItemClick });

      const itemElement = list.getElement().querySelector('[data-item-id]');
      itemElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onItemClick).toHaveBeenCalledWith('1', 'Test');
    });

    it('should set cursor to pointer when onItemClick is provided', () => {
      const onItemClick = jest.fn();
      const list = new List({
        items: [{ id: '1', data: 'Test' }],
        onItemClick,
      });

      const itemElement = list.getElement().querySelector('[data-item-id]') as HTMLElement;
      expect(itemElement?.style.cursor).toBe('pointer');
    });
  });

  describe('item actions', () => {
    it('should render action buttons', () => {
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [
            { label: 'Edit', action: 'edit' },
            { label: 'Delete', action: 'delete' },
          ],
        },
      ];
      const list = new List({ items });

      const buttons = list.getElement().querySelectorAll('[data-action]');
      expect(buttons.length).toBe(2);
    });

    it('should call onItemAction when action button is clicked', () => {
      const onItemAction = jest.fn();
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: { name: 'Test' },
          actions: [{ label: 'Edit', action: 'edit' }],
        },
      ];
      const list = new List({ items, onItemAction });

      const button = list.getElement().querySelector('[data-action="edit"]');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onItemAction).toHaveBeenCalledWith('edit', '1', { name: 'Test' });
    });

    it('should not trigger onItemClick when clicking action button', () => {
      const onItemClick = jest.fn();
      const onItemAction = jest.fn();
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [{ label: 'Edit', action: 'edit' }],
        },
      ];
      const list = new List({ items, onItemClick, onItemAction });

      const button = list.getElement().querySelector('[data-action]');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onItemAction).toHaveBeenCalled();
      expect(onItemClick).not.toHaveBeenCalled();
    });

    it('should apply primary variant classes', () => {
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [{ label: 'Action', action: 'test', variant: 'primary' }],
        },
      ];
      const list = new List({ items });

      const button = list.getElement().querySelector('[data-action]');
      expect(button?.classList.contains('bg-blue-600')).toBe(true);
    });

    it('should apply danger variant classes', () => {
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [{ label: 'Delete', action: 'delete', variant: 'danger' }],
        },
      ];
      const list = new List({ items });

      const button = list.getElement().querySelector('[data-action]');
      expect(button?.classList.contains('bg-red-600')).toBe(true);
    });

    it('should apply secondary (default) variant classes', () => {
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [{ label: 'Action', action: 'test', variant: 'secondary' }],
        },
      ];
      const list = new List({ items });

      const button = list.getElement().querySelector('[data-action]');
      expect(button?.classList.contains('bg-gray-100')).toBe(true);
    });

    it('should render action with icon', () => {
      const items: ListItemConfig[] = [
        {
          id: '1',
          data: 'Test',
          actions: [{ label: 'Edit', action: 'edit', icon: '<svg>icon</svg>' }],
        },
      ];
      const list = new List({ items });

      const button = list.getElement().querySelector('[data-action]');
      expect(button?.innerHTML).toContain('<svg>icon</svg>');
      expect(button?.innerHTML).toContain('Edit');
    });
  });

  describe('setItems', () => {
    it('should replace all items', () => {
      const list = new List({ items: [{ id: '1', data: 'First' }] });
      list.setItems([{ id: '2', data: 'Second' }, { id: '3', data: 'Third' }]);

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(2);
      expect(list.getElement().textContent).toContain('Second');
      expect(list.getElement().textContent).not.toContain('First');
    });

    it('should show empty state when setting empty array', () => {
      const list = new List({ items: [{ id: '1', data: 'Test' }] });
      list.setItems([]);

      const emptyElement = list.getElement().querySelector('.text-center');
      expect(emptyElement).not.toBeNull();
    });
  });

  describe('addItem', () => {
    it('should add item to empty list', () => {
      const list = new List();
      list.addItem({ id: '1', data: 'New item' });

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(1);
    });

    it('should add item to existing list', () => {
      const list = new List({ items: [{ id: '1', data: 'First' }] });
      list.addItem({ id: '2', data: 'Second' });

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(2);
    });
  });

  describe('removeItem', () => {
    it('should remove item by id', () => {
      const list = new List({
        items: [
          { id: '1', data: 'First' },
          { id: '2', data: 'Second' },
        ],
      });
      list.removeItem('1');

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(1);
      expect(list.getElement().textContent).not.toContain('First');
      expect(list.getElement().textContent).toContain('Second');
    });

    it('should handle removing non-existent item', () => {
      const list = new List({ items: [{ id: '1', data: 'Test' }] });
      list.removeItem('999');

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(1);
    });

    it('should handle removing from empty list', () => {
      const list = new List();
      list.removeItem('1');
      // Should not throw
    });
  });

  describe('updateItem', () => {
    it('should update item data', () => {
      const list = new List({
        items: [{ id: '1', data: { name: 'Original' } }],
      });
      list.updateItem('1', { name: 'Updated' });

      expect(list.getElement().textContent).toContain('Updated');
    });

    it('should merge object data', () => {
      const list = new List({
        items: [{ id: '1', data: { name: 'Test', description: 'Old desc' } }],
      });
      list.updateItem('1', { description: 'New desc' });

      expect(list.getElement().textContent).toContain('Test');
      expect(list.getElement().textContent).toContain('New desc');
    });

    it('should replace non-object data', () => {
      const list = new List({
        items: [{ id: '1', data: 'Original' }],
      });
      list.updateItem('1', 'Updated');

      expect(list.getElement().textContent).toContain('Updated');
    });

    it('should handle updating non-existent item', () => {
      const list = new List({ items: [{ id: '1', data: 'Test' }] });
      list.updateItem('999', 'New data');
      // Should not throw, original item unchanged
      expect(list.getElement().textContent).toContain('Test');
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      const list = new List({
        items: [
          { id: '1', data: 'First' },
          { id: '2', data: 'Second' },
        ],
      });
      list.clear();

      const itemElements = list.getElement().querySelectorAll('[data-item-id]');
      expect(itemElements.length).toBe(0);
    });

    it('should show empty state after clearing', () => {
      const list = new List({ items: [{ id: '1', data: 'Test' }] });
      list.clear();

      const emptyElement = list.getElement().querySelector('.text-center');
      expect(emptyElement).not.toBeNull();
    });
  });
});
