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
    modal.className = 'modal-backdrop fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-modal-fade-in';
    return modal;
  }

  private createModalStructure(): void {
    // Create backdrop overlay
    if (this.config.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity';
      this.element.appendChild(this.backdrop);
    }

    // Create modal content
    this.modalContent = document.createElement('div');

    // Size classes based on config
    const sizeClasses = {
      sm: 'max-w-sm',      // 384px - for confirmations, simple dialogs
      md: 'max-w-xl',      // 576px - default
      lg: 'max-w-2xl',     // 672px - for forms
      xl: 'max-w-4xl',     // 896px - for complex content
    };
    const sizeClass = sizeClasses[this.config.size || 'md'];

    this.modalContent.className = `
      relative w-full ${sizeClass} max-h-[90vh]
      glass-panel rounded-2xl flex flex-col
      animate-modal-scale-in text-gray-900 dark:text-gray-100
      transform transition-all
    `;
    this.element.appendChild(this.modalContent);

    // Create header
    if (this.config.title || this.config.closable || this.config.showThemeToggle) {
      this.createHeader();
    }

    // Create body
    this.body = document.createElement('div');
    this.body.className = 'flex-1 overflow-y-auto p-6 space-y-4 min-h-0'; // min-h-0 crucial for flex scrolling
    this.modalContent.appendChild(this.body);

    // Create footer
    this.footer = document.createElement('div');
    this.footer.className = 'p-6 border-t border-gray-200/20 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-800/30 rounded-b-2xl hidden shrink-0';
    this.modalContent.appendChild(this.footer);
  }

  private createHeader(): void {
    this.header = document.createElement('div');
    this.header.className = 'flex items-center justify-between p-6 border-b border-gray-200/20 dark:border-gray-700/30 shrink-0';

    // Title section
    const titleSection = document.createElement('div');
    titleSection.className = 'flex flex-col';

    if (this.config.title) {
      const title = document.createElement('h2');
      title.className = 'text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300';
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
    actions.className = 'flex items-center gap-2';

    // Theme toggle button
    if (this.config.showThemeToggle && this.config.onThemeToggle) {
      const themeButton = this.createIconButton(
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
        'Toggle theme'
      );
      themeButton.addEventListener('click', this.config.onThemeToggle);
      actions.appendChild(themeButton);
    }

    // Close button
    if (this.config.closable && this.config.onClose) {
      const closeButton = this.createIconButton(
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        'Close'
      );
      closeButton.addEventListener('click', this.config.onClose);
      actions.appendChild(closeButton);
    }

    this.header.appendChild(actions);
    if (this.modalContent) {
      this.modalContent.appendChild(this.header);
    }
  }

  private createIconButton(svg: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors';
    btn.innerHTML = svg;
    btn.title = title;
    return btn;
  }

  private setupEventListeners(): void {
    // Close on backdrop click
    if (this.backdrop && this.config.onClose) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
           this.config.onClose?.();
        }
      });
    }

    // Close on escape key
    if (this.config.closable && this.config.onClose) {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.config.onClose?.();
        }
      };
      document.addEventListener('keydown', handleEscape);
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
    // Small delay to allow for exit animation if we were to add one,
    // but for now immediate removal is fine (or we could add a standard fade-out class).
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
