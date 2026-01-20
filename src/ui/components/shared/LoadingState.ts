/**
 * Loading State Component
 * Displays a loading spinner with optional message
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface LoadingStateConfig extends ComponentConfig {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

export class LoadingState extends BaseComponent {
  private loadingConfig: LoadingStateConfig;
  private messageElement: HTMLParagraphElement | null = null;

  constructor(config: LoadingStateConfig = {}) {
    // Initialize config before calling super (which calls createElement)
    // We need to store it in a way that createElement can access it
    const normalizedConfig = {
      message: 'Loading...',
      size: 'md' as const,
      overlay: false,
      ...config,
    };
    super(normalizedConfig);
    this.loadingConfig = normalizedConfig;
    this.applyOverlay();
    this.setupLoadingState();
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center justify-center py-8';
    return container;
  }

  private applyOverlay(): void {
    const baseClasses = 'flex flex-col items-center justify-center';
    if (this.loadingConfig.overlay) {
      this.element.className = `${baseClasses} fixed inset-0 bg-black/30 backdrop-blur-sm z-[2000]`;
    } else {
      this.element.className = `${baseClasses} py-8`;
    }
  }

  private setupLoadingState(): void {
    // Create spinner
    const spinner = document.createElement('div');
    const spinnerSizes = {
      sm: 'w-6 h-6',
      md: 'w-10 h-10',
      lg: 'w-16 h-16',
    };
    const size = this.loadingConfig.size || 'md';

    spinner.className = `${spinnerSizes[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`;
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-label', 'Loading');
    this.element.appendChild(spinner);

    // Create message
    if (this.loadingConfig.message) {
      this.messageElement = document.createElement('p');
      this.messageElement.className = 'mt-4 text-gray-600 dark:text-gray-300 font-medium';
      this.messageElement.textContent = this.loadingConfig.message;
      this.element.appendChild(this.messageElement);
    }
  }

  /**
   * Update the loading message
   */
  public setMessage(message: string): void {
    if (!this.messageElement) {
      this.messageElement = document.createElement('p');
      this.messageElement.className = 'mt-4 text-gray-600 dark:text-gray-300 font-medium';
      this.element.appendChild(this.messageElement);
    }
    this.messageElement.textContent = message;
  }
}
