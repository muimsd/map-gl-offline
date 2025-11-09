/**
 * Reusable List Component
 * Provides a modular list with customizable item rendering
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface ListItemConfig {
  id: string;
  data: unknown;
  template?: string;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: string;
  }>;
}

export interface ListConfig extends ComponentConfig {
  items?: ListItemConfig[];
  emptyText?: string;
  itemTemplate?: (item: unknown) => string;
  onItemAction?: (action: string, itemId: string, item: unknown) => void;
  onItemClick?: (itemId: string, item: unknown) => void;
}

export class List extends BaseComponent {
  protected config: ListConfig;
  private listContainer?: HTMLElement;

  constructor(config: ListConfig = {}) {
    super(config);
    this.config = {
      emptyText: 'No items to display',
      ...config,
    };
    this.createListStructure();
    this.renderItems();
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex flex-col gap-2';
    return container;
  }

  private createListStructure(): void {
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'space-y-2';
    this.element.appendChild(this.listContainer);
  }

  private renderItems(): void {
    if (!this.listContainer) return;

    this.listContainer.innerHTML = '';

    if (!this.config.items || this.config.items.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.config.items.forEach(item => {
      const itemElement = this.createItemElement(item);
      this.listContainer?.appendChild(itemElement);
    });
  }

  private renderEmptyState(): void {
    const emptyElement = document.createElement('div');
    emptyElement.className = 'text-center py-8 text-gray-500 dark:text-gray-400';
    emptyElement.textContent = this.config.emptyText || 'No items found';
    this.listContainer?.appendChild(emptyElement);
  }

  private createItemElement(item: ListItemConfig): HTMLElement {
    const itemElement = document.createElement('div');
    itemElement.className =
      'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all duration-200';
    itemElement.dataset.itemId = item.id;

    // Add click handler for the entire item
    if (this.config.onItemClick) {
      itemElement.style.cursor = 'pointer';
      itemElement.addEventListener('click', e => {
        // Don't trigger if clicking on action buttons
        if ((e.target as HTMLElement).closest('[data-action]')) {
          return;
        }
        this.config.onItemClick?.(item.id, item.data);
      });
    }

    // Render item content
    if (item.template) {
      itemElement.innerHTML = item.template;
    } else if (this.config.itemTemplate) {
      itemElement.innerHTML = this.config.itemTemplate(item.data);
    } else {
      itemElement.innerHTML = this.getDefaultItemTemplate(item.data);
    }

    // Add actions if provided
    if (item.actions && item.actions.length > 0) {
      const actionsContainer = this.createActionsContainer(item);
      itemElement.appendChild(actionsContainer);
    }

    return itemElement;
  }

  private getDefaultItemTemplate(data: unknown): string {
    if (typeof data === 'string') {
      return `<div class="text-gray-900 dark:text-white">${data}</div>`;
    }

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (obj.title || obj.name) {
        return `
          <div class="text-gray-900 dark:text-white font-medium">
            ${obj.title || obj.name}
          </div>
          ${obj.description ? `<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">${obj.description}</div>` : ''}
        `;
      }
    }

    return `<div class="text-gray-900 dark:text-white">${JSON.stringify(data)}</div>`;
  }

  private createActionsContainer(item: ListItemConfig): HTMLElement {
    const actionsContainer = document.createElement('div');
    actionsContainer.className =
      'flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600';

    item.actions?.forEach(action => {
      const button = document.createElement('button');
      button.className = `px-3 py-1 rounded text-xs font-medium transition-colors ${this.getActionButtonClasses(action.variant)}`;
      button.dataset.action = action.action;
      button.dataset.itemId = item.id;

      if (action.icon) {
        button.innerHTML = `${action.icon} <span class="ml-1">${action.label}</span>`;
      } else {
        button.textContent = action.label;
      }

      button.addEventListener('click', e => {
        e.stopPropagation();
        if (this.config.onItemAction) {
          this.config.onItemAction(action.action, item.id, item.data);
        }
      });

      actionsContainer.appendChild(button);
    });

    return actionsContainer;
  }

  private getActionButtonClasses(variant?: string): string {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500';
    }
  }

  /**
   * Update list items
   */
  public setItems(items: ListItemConfig[]): void {
    this.config.items = items;
    this.renderItems();
  }

  /**
   * Add item to list
   */
  public addItem(item: ListItemConfig): void {
    if (!this.config.items) {
      this.config.items = [];
    }
    this.config.items.push(item);
    this.renderItems();
  }

  /**
   * Remove item from list
   */
  public removeItem(itemId: string): void {
    if (this.config.items) {
      this.config.items = this.config.items.filter(item => item.id !== itemId);
      this.renderItems();
    }
  }

  /**
   * Update specific item
   */
  public updateItem(itemId: string, newData: unknown): void {
    if (this.config.items) {
      const item = this.config.items.find(item => item.id === itemId);
      if (item) {
        if (
          typeof item.data === 'object' &&
          item.data !== null &&
          typeof newData === 'object' &&
          newData !== null
        ) {
          item.data = {
            ...(item.data as Record<string, unknown>),
            ...(newData as Record<string, unknown>),
          };
        } else {
          item.data = newData;
        }
        this.renderItems();
      }
    }
  }

  /**
   * Clear all items
   */
  public clear(): void {
    this.config.items = [];
    this.renderItems();
  }
}
