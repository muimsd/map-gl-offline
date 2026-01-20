/**
 * Empty State Component
 * Displays a message when there's no content to show
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface EmptyStateConfig extends ComponentConfig {
  title?: string;
  message?: string;
  icon?: string;
  showIcon?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export class EmptyState extends BaseComponent {
  private emptyConfig: EmptyStateConfig;

  constructor(config: EmptyStateConfig = {}) {
    super(config);
    this.emptyConfig = {
      title: 'No items',
      message: 'There are no items to display',
      showIcon: true,
      ...config,
    };
    this.setupEmptyState();
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center py-12 px-4 text-center';
    return container;
  }

  private getDefaultIcon(): string {
    return `<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
    </svg>`;
  }

  private setupEmptyState(): void {
    // Create icon
    if (this.emptyConfig.showIcon) {
      const iconContainer = document.createElement('div');
      iconContainer.className = 'mb-4 text-gray-300 dark:text-gray-600';
      iconContainer.innerHTML = this.emptyConfig.icon || this.getDefaultIcon();
      this.element.appendChild(iconContainer);
    }

    // Create title
    if (this.emptyConfig.title) {
      const title = document.createElement('h3');
      title.className = 'text-lg font-medium text-gray-900 dark:text-white mb-2';
      title.textContent = this.emptyConfig.title;
      this.element.appendChild(title);
    }

    // Create message
    if (this.emptyConfig.message) {
      const message = document.createElement('p');
      message.className = 'text-gray-500 dark:text-gray-400 max-w-sm';
      message.textContent = this.emptyConfig.message;
      this.element.appendChild(message);
    }

    // Create action button
    if (this.emptyConfig.onAction && this.emptyConfig.actionLabel) {
      const actionButton = document.createElement('button');
      actionButton.className =
        'mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
      actionButton.textContent = this.emptyConfig.actionLabel;
      actionButton.addEventListener('click', () => this.emptyConfig.onAction?.());
      this.element.appendChild(actionButton);
    }
  }
}
