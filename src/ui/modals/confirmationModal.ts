/**
 * Confirmation Modal Component
 * Handles confirmation dialogs with customizable actions
 */

import { createModal } from '../components';

export interface ConfirmationModalOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export class ConfirmationModal {
  private options: ConfirmationModalOptions;
  private modal: HTMLDivElement | undefined;
  private resolver?: (value: boolean) => void;

  constructor(options: ConfirmationModalOptions) {
    this.options = options;
  }

  /**
   * Show confirmation modal and return modal element
   */
  public show(): HTMLDivElement {
    return this.createModal();
  }

  /**
   * Create and display the modal
   */
  private createModal(): HTMLDivElement {
    const { title, message, confirmText, cancelText } = this.options;

    const modalContent = `
      <div class="flex flex-col gap-6">
        <p class="m-0 text-gray-900 dark:text-white leading-relaxed">
          ${message}
        </p>
        
        <div class="flex gap-2 justify-end">
          <button onclick="confirmationModal.handleCancel()" 
                  class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white border-0 rounded-sm cursor-pointer text-sm transition-colors duration-200">
            ${cancelText}
          </button>
          <button onclick="confirmationModal.handleConfirm()" 
                  class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 rounded-sm cursor-pointer text-sm transition-all duration-200">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    this.modal = createModal({
      title,
      isOpen: true,
      size: 'sm',
      showThemeToggle: false,
      onClose: () => this.handleCancel(),
      children: modalContent,
    });

    // Make this instance available globally for onclick handlers
    (window as any).confirmationModal = this;
    
    return this.modal!;
  }

  /**
   * Handle confirm action
   */
  public handleConfirm(): void {
    this.options.onConfirm();
    this.resolve(true);
  }

  /**
   * Handle cancel action
   */
  public handleCancel(): void {
    this.options.onCancel();
    this.resolve(false);
  }

  /**
   * Resolve the promise and cleanup
   */
  private resolve(result: boolean): void {
    if (this.resolver) {
      this.resolver(result);
      this.resolver = undefined;
    }
    this.cleanup();
  }

  /**
   * Get the modal element
   */
  public getModal(): HTMLDivElement | undefined {
    return this.modal;
  }

  /**
   * Cleanup global references
   */
  private cleanup(): void {
    delete (window as any).confirmationModal;
  }
}
