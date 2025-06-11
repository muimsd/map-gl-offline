/**
 * Reusable Button Component
 * Provides a modular button with progress badge functionality
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface ButtonConfig extends ComponentConfig {
  text?: string;
  icon?: string;
  title?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showProgressBadge?: boolean;
}

export class Button extends BaseComponent {
  protected config: ButtonConfig;
  private progressBadge?: HTMLSpanElement;

  constructor(config: ButtonConfig = {}) {
    super(config);
    this.config = config;
    this.setupButton();
    if (config.showProgressBadge) {
      this.createProgressBadge();
    }
  }

  protected createElement(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    return button;
  }

  private setupButton(): void {
    const button = this.element as HTMLButtonElement;
    
    // Set default classes
    const baseClasses = 'relative flex items-center justify-center transition-all duration-200';
    const variantClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();
    
    button.className = `${baseClasses} ${variantClasses} ${sizeClasses} ${this.config.className || ''}`.trim();
    
    // Set content
    if (this.config.icon && this.config.text) {
      button.innerHTML = `${this.config.icon} <span class="ml-2">${this.config.text}</span>`;
    } else if (this.config.icon) {
      button.innerHTML = this.config.icon;
    } else if (this.config.text) {
      button.textContent = this.config.text;
    }
    
    // Set attributes
    if (this.config.title) {
      button.title = this.config.title;
    }
    if (this.config.disabled) {
      button.disabled = this.config.disabled;
    }
    
    // Add click handler
    if (this.config.onClick) {
      this.addEventListener('click', this.config.onClick);
    }
  }

  private getVariantClasses(): string {
    switch (this.config.variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-700';
      case 'secondary':
        return 'bg-gray-500 hover:bg-gray-600 text-white border border-gray-600';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white border border-green-700';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white border border-red-700';
      default:
        return 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600';
    }
  }

  private getSizeClasses(): string {
    switch (this.config.size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-sm';
    }
  }

  private createProgressBadge(): void {
    this.progressBadge = document.createElement('span');
    this.progressBadge.className = 'absolute -top-1 -right-1 bg-blue-500 text-white rounded-full px-2 py-1 text-xs font-bold hidden min-w-4 text-center shadow-md';
    this.element.appendChild(this.progressBadge);
  }

  /**
   * Update button text
   */
  public setText(text: string): void {
    if (this.config.icon) {
      this.element.innerHTML = `${this.config.icon} <span class="ml-2">${text}</span>`;
    } else {
      this.element.textContent = text;
    }
  }

  /**
   * Update button state
   */
  public setDisabled(disabled: boolean): void {
    (this.element as HTMLButtonElement).disabled = disabled;
  }

  /**
   * Update progress badge
   */
  public updateProgressBadge(text: string, visible: boolean): void {
    if (this.progressBadge) {
      this.progressBadge.textContent = text;
      this.progressBadge.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Show progress badge
   */
  public showProgressBadge(text?: string): void {
    if (this.progressBadge) {
      if (text) this.progressBadge.textContent = text;
      this.progressBadge.style.display = 'block';
    }
  }

  /**
   * Hide progress badge
   */
  public hideProgressBadge(): void {
    if (this.progressBadge) {
      this.progressBadge.style.display = 'none';
    }
  }
}
