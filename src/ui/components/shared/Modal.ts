/**
 * Reusable Modal Component
 * Provides a modular modal with configurable content and actions
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface ModalConfig extends ComponentConfig {
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  backdrop?: boolean;
  showThemeToggle?: boolean;
  onClose?: () => void;
  onThemeToggle?: () => void;
}

export class Modal extends BaseComponent {
  protected config: ModalConfig;
  private backdrop?: HTMLDivElement;
  private modalContent?: HTMLDivElement;
  private header?: HTMLDivElement;
  private body?: HTMLDivElement;
  private footer?: HTMLDivElement;

  constructor(config: ModalConfig = {}) {
    super(config);
    this.config = {
      closable: true,
      backdrop: true,
      size: 'md',
      ...config,
    };
    this.createModalStructure();
    this.setupEventListeners();
  }

  protected createElement(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    return modal;
  }

  private createModalStructure(): void {
    // Create backdrop overlay (clickable area)
    if (this.config.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'modal-backdrop-inner';
      this.element.appendChild(this.backdrop);
    }

    // Create modal content
    this.modalContent = document.createElement('div');
    this.modalContent.className = `modal-content ${this.getSizeClasses()}`;
    this.element.appendChild(this.modalContent);

    // Create header
    if (this.config.title || this.config.closable || this.config.showThemeToggle) {
      this.createHeader();
    }

    // Create body
    this.body = document.createElement('div');
    this.body.className = 'modal-body';
    this.modalContent.appendChild(this.body);

    // Create footer
    this.footer = document.createElement('div');
    this.footer.className = 'modal-footer hidden';
    this.modalContent.appendChild(this.footer);
  }

  private createHeader(): void {
    this.header = document.createElement('div');
    this.header.className = 'modal-header';

    // Title section
    const titleSection = document.createElement('div');
    titleSection.className = 'flex-1';

    if (this.config.title) {
      const title = document.createElement('h2');
      title.className = 'modal-title';
      title.textContent = this.config.title;
      titleSection.appendChild(title);
    }

    if (this.config.subtitle) {
      const subtitle = document.createElement('p');
      subtitle.className = 'text-sm text-gray-500 dark:text-gray-400 mt-1';
      subtitle.textContent = this.config.subtitle;
      titleSection.appendChild(subtitle);
    }

    this.header.appendChild(titleSection);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 ml-4';

    // Theme toggle button
    if (this.config.showThemeToggle && this.config.onThemeToggle) {
      const themeButton = document.createElement('button');
      themeButton.className = 'modal-close-btn';
      themeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      themeButton.title = 'Toggle theme';
      this.addEventListener('click', this.config.onThemeToggle);
      actions.appendChild(themeButton);
    }

    // Close button
    if (this.config.closable && this.config.onClose) {
      const closeButton = document.createElement('button');
      closeButton.className = 'modal-close-btn';
      closeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeButton.title = 'Close';
      closeButton.addEventListener('click', this.config.onClose);
      actions.appendChild(closeButton);
    }

    this.header.appendChild(actions);
    if (this.modalContent) {
      this.modalContent.appendChild(this.header);
    }
  }

  private getSizeClasses(): string {
    switch (this.config.size) {
      case 'sm':
        return 'modal-sm';
      case 'md':
        return 'modal-md';
      case 'lg':
        return 'modal-lg';
      case 'xl':
        return 'modal-lg'; // xl uses same as lg for consistency
      default:
        return 'modal-md';
    }
  }

  private setupEventListeners(): void {
    // Close on backdrop click
    if (this.backdrop && this.config.onClose) {
      this.backdrop.addEventListener('click', this.config.onClose);
    }

    // Close on escape key
    if (this.config.closable && this.config.onClose) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.config.onClose?.();
        }
      };
      document.addEventListener('keydown', handleEscape);

      // Store reference for cleanup
      this.eventListeners.set('escape', handleEscape as EventListener);
    }
  }

  /**
   * Set modal body content
   */
  public setContent(content: string | HTMLElement): void {
    if (!this.body) return;

    if (typeof content === 'string') {
      this.body.innerHTML = content;
    } else {
      this.body.innerHTML = '';
      this.body.appendChild(content);
    }
  }

  /**
   * Set modal footer content
   */
  public setFooter(content: string | HTMLElement): void {
    if (!this.footer) return;

    this.footer.classList.remove('hidden');

    if (typeof content === 'string') {
      this.footer.innerHTML = content;
    } else {
      this.footer.innerHTML = '';
      this.footer.appendChild(content);
    }
  }

  /**
   * Show the modal
   */
  public show(): void {
    document.body.appendChild(this.element);
    this.element.classList.remove('hidden');

    // Focus management
    const firstFocusable = this.element.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    firstFocusable?.focus();
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    this.element.classList.add('hidden');
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * Clean up event listeners
   */
  protected async onUnmount(): Promise<void> {
    const escapeHandler = this.eventListeners.get('escape');
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      this.eventListeners.delete('escape');
    }
  }
}
