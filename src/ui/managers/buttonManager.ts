/**
 * Button Manager Component
 * Manages the main control button and progress badge states
 */

import { icons } from '../../utils/icons';

export interface ButtonManagerOptions {
  onTogglePanel: () => void;
}

export class ButtonManager {
  private container: HTMLDivElement;
  private button: HTMLButtonElement;
  private progressBadge: HTMLSpanElement;
  private options: ButtonManagerOptions;

  constructor(options: ButtonManagerOptions) {
    this.options = options;
    this.container = this.createContainer();
    this.button = this.createButton();
    this.progressBadge = this.createProgressBadge();
    
    this.setupEventListeners();
  }

  /**
   * Get the container element
   */
  public getContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Update button text and state
   */
  public updateButton(text: string, disabled: boolean): void {
    this.button.textContent = text;
    this.button.disabled = disabled;
  }

  /**
   * Update progress badge
   */
  public updateProgressBadge(text: string, visible: boolean): void {
    this.progressBadge.textContent = text;
    this.progressBadge.style.display = visible ? 'block' : 'none';
  }

  /**
   * Reset button to default state
   */
  public resetToDefault(): void {
    this.button.innerHTML = icons.cloud({ size: 20, color: 'black' });
    this.button.disabled = false;
    this.button.title = 'Offline Map Manager';
    this.progressBadge.style.display = 'none';
  }

  /**
   * Create container element
   */
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group offline-manager-control';
    return container;
  }

  /**
   * Create main button element
   */
  private createButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'maplibregl-ctrl-icon relative';
    button.innerHTML = icons.cloud({ size: 20, color: 'black' });
    button.title = 'Offline Map Manager';
    
    this.container.appendChild(button);
    return button;
  }

  /**
   * Create progress badge element
   */
  private createProgressBadge(): HTMLSpanElement {
    const badge = document.createElement('span');
    badge.className = 'absolute -top-1 -right-1 bg-blue-500 text-white rounded-full px-2 py-1 text-xs font-bold hidden min-w-4 text-center shadow-md';
    
    this.button.appendChild(badge);
    return badge;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.button.addEventListener('click', this.options.onTogglePanel);
  }

  /**
   * Cleanup when removed
   */
  public cleanup(): void {
    this.button.removeEventListener('click', this.options.onTogglePanel);
  }
}
