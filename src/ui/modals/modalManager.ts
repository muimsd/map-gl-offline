/**
 * Modal Manager Component
 * Centralized management of modal dialogs
 */

export class ModalManager {
  private activeModal: HTMLDivElement | undefined;

  /**
   * Show a modal
   */
  public show(modal: HTMLDivElement): void {
    this.close();
    this.activeModal = modal;

    // Ensure modal has proper theme class
    modal.classList.add('offline-manager-control');
    document.body.appendChild(modal);
  }

  /**
   * Close the current modal
   */
  public close(): void {
    if (this.activeModal && this.activeModal.parentNode) {
      this.activeModal.parentNode.removeChild(this.activeModal);
      this.activeModal = undefined;
    }
  }

  /**
   * Check if a modal is currently open
   */
  public isOpen(): boolean {
    return !!this.activeModal;
  }

  /**
   * Get the current active modal
   */
  public getActiveModal(): HTMLDivElement | undefined {
    return this.activeModal;
  }
}
