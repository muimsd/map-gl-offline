/**
 * Confirmation Modal Component
 * Handles confirmation dialogs with customizable actions
 * Refactored to use modular components
 */

import { Modal, ModalConfig } from '@/ui/components/shared/Modal';
import { Button } from '@/ui/components/shared/Button';

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
  private modal?: Modal;

  constructor(options: ConfirmationModalOptions) {
    this.options = options;
  }

  /**
   * Show confirmation modal and return modal element
   */
  public show(): HTMLDivElement {
    const modalConfig: ModalConfig = {
      title: this.options.title,
      size: 'sm',
      closable: true,
      onClose: this.options.onCancel,
    };

    this.modal = new Modal(modalConfig);

    // Create content - message only
    const content = document.createElement('div');
    content.className =
      'text-gray-600 dark:text-gray-300 leading-relaxed text-base font-medium py-2';
    content.textContent = this.options.message;

    // Set modal content
    this.modal.setContent(content);

    // Create footer with action buttons
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';

    // Cancel button (only show if cancelText is provided)
    if (this.options.cancelText) {
      const cancelButton = new Button({
        text: this.options.cancelText,
        variant: 'secondary',
        onClick: () => {
          this.modal?.hide();
          this.options.onCancel();
        },
      });
      footer.appendChild(cancelButton.getElement());
    }

    // Confirm button
    const confirmButton = new Button({
      text: this.options.confirmText,
      variant: 'primary',
      onClick: () => {
        this.modal?.hide();
        this.options.onConfirm();
      },
    });
    footer.appendChild(confirmButton.getElement());

    this.modal.setFooter(footer);
    this.modal.show();

    return this.modal.getElement() as HTMLDivElement;
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    this.modal?.hide();
  }

  /**
   * Destroy the modal
   */
  public destroy(): void {
    this.modal?.destroy();
  }
}
