/**
 * Confirmation Modal Component
 * Handles confirmation dialogs with customizable actions
 * Refactored to use modular components
 */

import { Modal, ModalConfig } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';

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

    // Create content
    const content = document.createElement('div');
    content.className = 'flex flex-col gap-6';

    // Message
    const message = document.createElement('p');
    message.className = 'm-0 text-gray-900 dark:text-white leading-relaxed';
    message.textContent = this.options.message;
    content.appendChild(message);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-2 justify-end';

    // Cancel button
    const cancelButton = new Button({
      text: this.options.cancelText,
      variant: 'secondary',
      onClick: () => {
        this.modal?.hide();
        this.options.onCancel();
      },
    });

    // Confirm button
    const confirmButton = new Button({
      text: this.options.confirmText,
      variant: 'danger',
      onClick: () => {
        this.modal?.hide();
        this.options.onConfirm();
      },
    });

    buttonContainer.appendChild(cancelButton.getElement());
    buttonContainer.appendChild(confirmButton.getElement());
    content.appendChild(buttonContainer);

    // Set modal content
    this.modal.setContent(content);
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
