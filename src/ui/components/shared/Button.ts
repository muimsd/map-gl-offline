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
  /** ARIA label for accessibility (required for icon-only buttons) */
  ariaLabel?: string;
  /** Indicates if the button is in a loading/busy state */
  loading?: boolean;
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
    const baseClasses =
      'relative flex items-center justify-center transition-all duration-200 cursor-pointer';
    const variantClasses = this.getVariantClasses();
    const sizeClasses = this.getSizeClasses();

    button.className =
      `${baseClasses} ${variantClasses} ${sizeClasses} ${this.config.className || ''}`.trim();

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

    // Accessibility attributes
    if (this.config.ariaLabel) {
      button.setAttribute('aria-label', this.config.ariaLabel);
    } else if (this.config.icon && !this.config.text && this.config.title) {
      // For icon-only buttons, use title as aria-label
      button.setAttribute('aria-label', this.config.title);
    }

    if (this.config.loading) {
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    }

    // Add click handler
    if (this.config.onClick) {
      this.addEventListener('click', this.config.onClick);
    }
  }

  private getVariantClasses(): string {
    const baseStyles =
      'rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    switch (this.config.variant) {
      case 'primary':
        return `${baseStyles} bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white focus:ring-blue-500`;
      case 'secondary':
        return `${baseStyles} bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white focus:ring-gray-500`;
      case 'success':
        return `${baseStyles} bg-green-600 hover:bg-green-700 active:bg-green-800 text-white focus:ring-green-500`;
      case 'danger':
        return `${baseStyles} bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus:ring-red-500`;
      default:
        return `${baseStyles} bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 focus:ring-blue-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500 dark:text-white dark:border-gray-600`;
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
    this.progressBadge.className =
      'absolute -top-1 -right-1 bg-blue-500 text-white rounded-full px-2 py-1 text-xs font-bold hidden min-w-4 text-center shadow-md';
    // Accessibility: badge ID for aria-describedby
    const badgeId = `btn-badge-${Date.now()}`;
    this.progressBadge.id = badgeId;
    this.progressBadge.setAttribute('aria-live', 'polite');
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
   * Set loading state with aria-busy attribute
   */
  public setLoading(loading: boolean): void {
    const button = this.element as HTMLButtonElement;
    button.disabled = loading;
    if (loading) {
      button.setAttribute('aria-busy', 'true');
    } else {
      button.removeAttribute('aria-busy');
    }
  }

  /**
   * Update progress badge
   */
  public updateProgressBadge(text: string, visible: boolean): void {
    if (this.progressBadge) {
      this.progressBadge.textContent = text;
      if (visible) {
        this.progressBadge.classList.remove('hidden');
        this.progressBadge.classList.add('block');
      } else {
        this.progressBadge.classList.remove('block');
        this.progressBadge.classList.add('hidden');
      }
    }
  }

  /**
   * Show progress badge
   */
  public showProgressBadge(text?: string): void {
    if (this.progressBadge) {
      if (text) this.progressBadge.textContent = text;
      this.progressBadge.classList.remove('hidden');
      this.progressBadge.classList.add('block');
    }
  }

  /**
   * Hide progress badge
   */
  public hideProgressBadge(): void {
    if (this.progressBadge) {
      this.progressBadge.classList.remove('block');
      this.progressBadge.classList.add('hidden');
    }
  }
}
