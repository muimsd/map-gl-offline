/**
 * Error State Component
 * Displays an error message with optional retry action
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';
import { t } from '../../translations';

export interface ErrorStateConfig extends ComponentConfig {
  title?: string;
  message?: string;
  type?: 'error' | 'warning' | 'info';
  showIcon?: boolean;
  retryLabel?: string;
  dismissLabel?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export class ErrorState extends BaseComponent {
  private errorConfig: ErrorStateConfig;
  private messageElement: HTMLParagraphElement | null = null;
  private titleElement: HTMLHeadingElement | null = null;

  constructor(config: ErrorStateConfig = {}) {
    super(config);
    this.errorConfig = {
      title: t('app.error'),
      message: t('errorState.message'),
      type: 'error',
      showIcon: true,
      retryLabel: t('errorState.retry'),
      dismissLabel: t('app.cancel'),
      ...config,
    };
    this.setupErrorState();
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center py-8 px-4 text-center';
    container.setAttribute('role', 'alert');
    return container;
  }

  private getTypeStyles(): {
    iconColor: string;
    bgColor: string;
    borderColor: string;
    icon: string;
  } {
    switch (this.errorConfig.type) {
      case 'warning':
        return {
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          icon: `<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>`,
        };
      case 'info':
        return {
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          icon: `<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>`,
        };
      default: // error
        return {
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          icon: `<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>`,
        };
    }
  }

  private setupErrorState(): void {
    const styles = this.getTypeStyles();

    // Apply background styling
    this.element.classList.add(
      'rounded-lg',
      'border',
      ...styles.bgColor.split(' '),
      ...styles.borderColor.split(' ')
    );

    // Create icon
    if (this.errorConfig.showIcon) {
      const iconContainer = document.createElement('div');
      iconContainer.className = `mb-4 ${styles.iconColor}`;
      iconContainer.innerHTML = styles.icon;
      this.element.appendChild(iconContainer);
    }

    // Create title
    if (this.errorConfig.title) {
      this.titleElement = document.createElement('h3');
      this.titleElement.className = 'text-lg font-semibold text-gray-900 dark:text-white mb-2';
      this.titleElement.textContent = this.errorConfig.title;
      this.element.appendChild(this.titleElement);
    }

    // Create message
    if (this.errorConfig.message) {
      this.messageElement = document.createElement('p');
      this.messageElement.className = 'text-gray-600 dark:text-gray-300 mb-4 max-w-md';
      this.messageElement.textContent = this.errorConfig.message;
      this.element.appendChild(this.messageElement);
    }

    // Create action buttons
    const hasActions = this.errorConfig.onRetry || this.errorConfig.onDismiss;
    if (hasActions) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'flex gap-3 mt-2';

      if (this.errorConfig.onRetry) {
        const retryButton = document.createElement('button');
        retryButton.className =
          'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
        retryButton.textContent = this.errorConfig.retryLabel || 'Try Again';
        retryButton.addEventListener('click', () => this.errorConfig.onRetry?.());
        actionsContainer.appendChild(retryButton);
      }

      if (this.errorConfig.onDismiss) {
        const dismissButton = document.createElement('button');
        dismissButton.className =
          'px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2';
        dismissButton.textContent = this.errorConfig.dismissLabel || 'Dismiss';
        dismissButton.addEventListener('click', () => this.errorConfig.onDismiss?.());
        actionsContainer.appendChild(dismissButton);
      }

      this.element.appendChild(actionsContainer);
    }
  }

  /**
   * Update the error message
   */
  public setMessage(message: string): void {
    if (!this.messageElement) {
      this.messageElement = document.createElement('p');
      this.messageElement.className = 'text-gray-600 dark:text-gray-300 mb-4 max-w-md';
      this.element.appendChild(this.messageElement);
    }
    this.messageElement.textContent = message;
  }

  /**
   * Update the error title
   */
  public setTitle(title: string): void {
    if (!this.titleElement) {
      this.titleElement = document.createElement('h3');
      this.titleElement.className = 'text-lg font-semibold text-gray-900 dark:text-white mb-2';
      // Insert before message if it exists
      if (this.messageElement) {
        this.element.insertBefore(this.titleElement, this.messageElement);
      } else {
        this.element.appendChild(this.titleElement);
      }
    }
    this.titleElement.textContent = title;
  }
}
