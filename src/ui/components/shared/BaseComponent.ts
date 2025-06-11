/**
 * Base Component Class
 * Provides common functionality for UI components
 */

export interface ComponentConfig {
  className?: string;
  id?: string;
  events?: { [event: string]: EventListener };
}

export abstract class BaseComponent {
  protected element: HTMLElement;
  protected config: ComponentConfig;
  protected isMounted = false;
  protected eventListeners: Map<string, EventListener> = new Map();

  constructor(config: ComponentConfig = {}) {
    this.config = config;
    this.element = this.createElement();
    this.applyConfig();
    this.bindEvents();
  }

  /**
   * Create the root element
   */
  protected abstract createElement(): HTMLElement;

  /**
   * Apply configuration to element
   */
  protected applyConfig(): void {
    if (this.config.className) {
      this.element.className = this.config.className;
    }
    if (this.config.id) {
      this.element.id = this.config.id;
    }
  }

  /**
   * Bind event listeners
   */
  protected bindEvents(): void {
    if (this.config.events) {
      Object.entries(this.config.events).forEach(([event, handler]) => {
        this.element.addEventListener(event, handler);
        this.eventListeners.set(`${event}_${Date.now()}`, handler);
      });
    }
  }

  /**
   * Add event listener with cleanup tracking
   */
  protected addEventListener(event: string, handler: EventListener): void {
    this.element.addEventListener(event, handler);
    this.eventListeners.set(`${event}_${Date.now()}`, handler);
  }

  /**
   * Remove all tracked event listeners
   */
  protected removeAllEventListeners(): void {
    this.eventListeners.forEach((handler, key) => {
      const event = key.split('_')[0];
      this.element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
  }

  /**
   * Get the element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Mount to parent
   */
  public async mount(parent: HTMLElement): Promise<void> {
    if (!this.isMounted) {
      parent.appendChild(this.element);
      this.isMounted = true;
      await this.onMount?.();
    }
  }

  /**
   * Unmount from parent
   */
  public async unmount(): Promise<void> {
    if (this.isMounted && this.element.parentNode) {
      await this.onUnmount?.();
      this.element.parentNode.removeChild(this.element);
      this.isMounted = false;
    }
  }

  /**
   * Lifecycle hook - called after mounting
   */
  protected async onMount?(): Promise<void>;

  /**
   * Lifecycle hook - called before unmounting
   */
  protected async onUnmount?(): Promise<void>;

  /**
   * Update component
   */
  public async update(): Promise<void> {
    await this.onUpdate?.();
  }

  /**
   * Lifecycle hook - called during updates
   */
  protected async onUpdate?(): Promise<void>;

  /**
   * Destroy component
   */
  public destroy(): void {
    this.removeAllEventListeners();
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isMounted = false;
  }

  /**
   * Update element content
   */
  public setContent(content: string | HTMLElement): void {
    if (typeof content === 'string') {
      this.element.innerHTML = content;
    } else {
      this.element.innerHTML = '';
      this.element.appendChild(content);
    }
  }

  /**
   * Show element
   */
  public show(): void {
    this.element.classList.remove('hidden');
  }

  /**
   * Hide element
   */
  public hide(): void {
    this.element.classList.add('hidden');
  }

  /**
   * Toggle visibility
   */
  public toggle(): void {
    this.element.classList.toggle('hidden');
  }
}
