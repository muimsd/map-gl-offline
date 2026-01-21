/**
 * Toast Notification Component
 * Displays temporary notification messages that auto-dismiss
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

export interface ToastConfig extends ComponentConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export class Toast extends BaseComponent {
  private toastConfig: ToastConfig;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(config: ToastConfig) {
    const normalizedConfig = {
      type: 'info' as ToastType,
      duration: 5000,
      position: 'top-right' as ToastPosition,
      dismissible: true,
      ...config,
    };
    super(normalizedConfig);
    this.toastConfig = normalizedConfig;
    this.setupToast();
  }

  protected createElement(): HTMLElement {
    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    return toast;
  }

  private getTypeStyles(): { bg: string; border: string; icon: string; iconColor: string } {
    switch (this.toastConfig.type) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-900/30',
          border: 'border-green-200 dark:border-green-800',
          iconColor: 'text-green-500',
          icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>`,
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-200 dark:border-red-800',
          iconColor: 'text-red-500',
          icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>`,
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/30',
          border: 'border-yellow-200 dark:border-yellow-800',
          iconColor: 'text-yellow-500',
          icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>`,
        };
      default: // info
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-800',
          iconColor: 'text-blue-500',
          icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>`,
        };
    }
  }

  private getPositionClasses(): string {
    const positions: Record<ToastPosition, string> = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    };
    return positions[this.toastConfig.position || 'top-right'];
  }

  private setupToast(): void {
    const styles = this.getTypeStyles();
    const positionClasses = this.getPositionClasses();

    this.element.className = `
      fixed ${positionClasses} z-[3000]
      flex items-center gap-3 p-4 rounded-lg shadow-lg
      border ${styles.bg} ${styles.border}
      transform transition-all duration-300 ease-out
      animate-toast-in
      max-w-sm
    `
      .replace(/\s+/g, ' ')
      .trim();

    // Icon
    const iconContainer = document.createElement('div');
    iconContainer.className = `flex-shrink-0 ${styles.iconColor}`;
    iconContainer.innerHTML = styles.icon;
    this.element.appendChild(iconContainer);

    // Message
    const messageContainer = document.createElement('div');
    messageContainer.className = 'flex-1 text-sm font-medium text-gray-900 dark:text-white';
    messageContainer.textContent = this.toastConfig.message;
    this.element.appendChild(messageContainer);

    // Dismiss button
    if (this.toastConfig.dismissible) {
      const dismissButton = document.createElement('button');
      dismissButton.className = `
        flex-shrink-0 p-1 rounded-lg
        text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
        hover:bg-gray-200/50 dark:hover:bg-gray-700/50
        transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400
      `
        .replace(/\s+/g, ' ')
        .trim();
      dismissButton.setAttribute('aria-label', 'Dismiss notification');
      dismissButton.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>`;
      dismissButton.addEventListener('click', () => this.dismiss());
      this.element.appendChild(dismissButton);
    }

    // Auto-dismiss after duration
    if (this.toastConfig.duration && this.toastConfig.duration > 0) {
      this.timeoutId = setTimeout(() => this.dismiss(), this.toastConfig.duration);
    }
  }

  /**
   * Show the toast
   */
  public show(): void {
    document.body.appendChild(this.element);
  }

  /**
   * Dismiss the toast
   */
  public dismiss(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Add exit animation class
    this.element.classList.add('animate-toast-out');

    // Remove after animation
    setTimeout(() => {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      this.toastConfig.onDismiss?.();
    }, 200);
  }

  /**
   * Update the message
   */
  public setMessage(message: string): void {
    const messageContainer = this.element.querySelector('.flex-1');
    if (messageContainer) {
      messageContainer.textContent = message;
    }
  }
}

/**
 * Toast Manager for managing multiple toasts
 */
export class ToastManager {
  private static instance: ToastManager;
  private toasts: Toast[] = [];
  private maxToasts = 5;

  private constructor() {}

  public static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  /**
   * Show a toast notification
   */
  public show(config: ToastConfig): Toast {
    // Remove oldest toast if at max
    if (this.toasts.length >= this.maxToasts) {
      const oldestToast = this.toasts.shift();
      oldestToast?.dismiss();
    }

    const toast = new Toast({
      ...config,
      onDismiss: () => {
        this.toasts = this.toasts.filter(t => t !== toast);
        config.onDismiss?.();
      },
    });

    this.toasts.push(toast);
    toast.show();
    return toast;
  }

  /**
   * Convenience methods for different toast types
   */
  public success(message: string, duration?: number): Toast {
    return this.show({ message, type: 'success', duration });
  }

  public error(message: string, duration?: number): Toast {
    return this.show({ message, type: 'error', duration: duration ?? 0 }); // Errors don't auto-dismiss by default
  }

  public warning(message: string, duration?: number): Toast {
    return this.show({ message, type: 'warning', duration });
  }

  public info(message: string, duration?: number): Toast {
    return this.show({ message, type: 'info', duration });
  }

  /**
   * Dismiss all toasts
   */
  public dismissAll(): void {
    [...this.toasts].forEach(toast => toast.dismiss());
    this.toasts = [];
  }
}

// Export singleton instance
export const toastManager = ToastManager.getInstance();
