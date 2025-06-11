/**
 * Panel Component
 * Refactored panel management into reusable component
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export interface PanelConfig extends ComponentConfig {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  closable?: boolean;
  onClose?: () => void;
}

export class Panel extends BaseComponent {
  private header: HTMLDivElement | null = null;
  private body: HTMLDivElement | null = null;
  private footer: HTMLDivElement | null = null;
  private panelConfig: PanelConfig;

  constructor(config: PanelConfig = {}) {
    super(config);
    this.panelConfig = config;
    this.createPanelStructure();
  }

  protected createElement(): HTMLElement {
    const panel = document.createElement('div');
    
    // Size configurations
    const sizeClasses = {
      sm: ['w-[min(80vw,400px)]', 'h-[min(70vh,350px)]'],
      md: ['w-[min(90vw,600px)]', 'h-[min(80vh,500px)]'],
      lg: ['w-[min(95vw,800px)]', 'h-[min(85vh,600px)]'],
      xl: ['w-[min(98vw,1000px)]', 'h-[min(90vh,700px)]']
    };
    
    // Position configurations
    const positionClasses = {
      center: ['fixed', 'top-1/2', 'left-1/2', 'transform', '-translate-x-1/2', '-translate-y-1/2'],
      top: ['fixed', 'top-4', 'left-1/2', 'transform', '-translate-x-1/2'],
      bottom: ['fixed', 'bottom-4', 'left-1/2', 'transform', '-translate-x-1/2'],
      left: ['fixed', 'left-4', 'top-1/2', 'transform', '-translate-y-1/2'],
      right: ['fixed', 'right-4', 'top-1/2', 'transform', '-translate-y-1/2']
    };
    
    const size = this.panelConfig.size || 'md';
    const position = this.panelConfig.position || 'center';
    
    panel.className = [
      'offline-manager-control',
      'bg-white', 'dark:bg-gray-800',
      'border', 'border-gray-200', 'dark:border-gray-700',
      'rounded-2xl', 'shadow-2xl',
      'hidden', 'z-[1000]',
      'overflow-hidden', 'text-sm',
      'flex', 'flex-col',
      ...sizeClasses[size as keyof typeof sizeClasses],
      ...positionClasses[position as keyof typeof positionClasses]
    ].join(' ');
    
    return panel;
  }

  private createPanelStructure(): void {
    // Create header if title or closable
    if (this.panelConfig.title || this.panelConfig.closable) {
      this.header = document.createElement('div');
      this.header.className = 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700';
      
      if (this.panelConfig.title) {
        const title = document.createElement('h2');
        title.className = 'text-lg font-semibold text-gray-900 dark:text-white';
        title.textContent = this.panelConfig.title;
        this.header.appendChild(title);
      }

      if (this.panelConfig.closable) {
        const closeButton = document.createElement('button');
        closeButton.className = 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors';
        closeButton.innerHTML = '×';
        closeButton.style.fontSize = '24px';
        closeButton.addEventListener('click', () => {
          this.close();
          this.panelConfig.onClose?.();
        });
        this.header.appendChild(closeButton);
      }

      this.element.appendChild(this.header);
    }

    // Create body
    this.body = document.createElement('div');
    this.body.className = 'flex-1 overflow-auto';
    this.element.appendChild(this.body);

    // Create footer (initially hidden)
    this.footer = document.createElement('div');
    this.footer.className = 'hidden border-t border-gray-200 dark:border-gray-700 p-4';
    this.element.appendChild(this.footer);
  }

  /**
   * Set panel title
   */
  public setTitle(title: string): void {
    if (this.header) {
      const titleElement = this.header.querySelector('h2');
      if (titleElement) {
        titleElement.textContent = title;
      }
    }
  }

  /**
   * Set panel body content
   */
  public setBody(content: string | HTMLElement): void {
    if (!this.body) return;
    
    if (typeof content === 'string') {
      this.body.innerHTML = content;
    } else {
      this.body.innerHTML = '';
      this.body.appendChild(content);
    }
  }

  /**
   * Set panel footer content
   */
  public setFooter(content: string | HTMLElement | null): void {
    if (!this.footer) return;

    if (content === null) {
      this.footer.classList.add('hidden');
      return;
    }

    this.footer.classList.remove('hidden');
    
    if (typeof content === 'string') {
      this.footer.innerHTML = content;
    } else {
      this.footer.innerHTML = '';
      this.footer.appendChild(content);
    }
  }

  /**
   * Open panel
   */
  public open(): void {
    this.show();
  }

  /**
   * Close panel
   */
  public close(): void {
    this.hide();
  }

  /**
   * Get body element for direct manipulation
   */
  public getBody(): HTMLElement | null {
    return this.body;
  }

  /**
   * Get header element
   */
  public getHeader(): HTMLElement | null {
    return this.header;
  }

  /**
   * Get footer element
   */
  public getFooter(): HTMLElement | null {
    return this.footer;
  }
}
