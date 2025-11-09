/**
 * Control Button Component
 * Refactored from ButtonManager to be more reusable
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';
import { icons } from '../../../utils/icons';

export interface ControlButtonConfig extends ComponentConfig {
  title?: string;
  icon?: string;
  onToggle?: () => void;
}

export class ControlButton extends BaseComponent {
  private button: HTMLButtonElement;
  private progressBadge: HTMLSpanElement;
  private buttonConfig: ControlButtonConfig;

  constructor(config: ControlButtonConfig = {}) {
    super(config);
    this.buttonConfig = config;
    const button = this.element.querySelector('button');
    const progressBadge = button?.querySelector('.progress-badge') as HTMLSpanElement;

    if (!button || !progressBadge) {
      throw new Error('ControlButton: Required elements not found');
    }

    this.button = button;
    this.progressBadge = progressBadge;
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group offline-manager-control';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'maplibregl-ctrl-icon relative';
    button.innerHTML = this.buttonConfig.icon || icons.cloud({ size: 20, color: 'black' });
    button.title = this.buttonConfig.title || 'Offline Map Manager';

    const badge = document.createElement('span');
    badge.className =
      'progress-badge absolute -top-1 -right-1 bg-blue-500 text-white rounded-full px-2 py-1 text-xs font-bold hidden min-w-4 text-center shadow-md';

    button.appendChild(badge);
    container.appendChild(button);

    // Add click handler
    if (this.buttonConfig.onToggle) {
      button.addEventListener('click', this.buttonConfig.onToggle);
    }

    return container;
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
   * Reset to default state
   */
  public resetToDefault(): void {
    this.button.innerHTML = this.buttonConfig.icon || icons.cloud({ size: 20, color: 'black' });
    this.button.disabled = false;
    this.button.title = this.buttonConfig.title || 'Offline Map Manager';
    this.progressBadge.style.display = 'none';
    // Re-append the badge since innerHTML cleared it
    this.button.appendChild(this.progressBadge);
  }

  /**
   * Set button active state
   */
  public setActive(active: boolean): void {
    if (active) {
      this.button.classList.add('active');
    } else {
      this.button.classList.remove('active');
    }
  }

  /**
   * Override destroy to remove specific event listeners
   */
  public destroy(): void {
    if (this.buttonConfig.onToggle) {
      this.button.removeEventListener('click', this.buttonConfig.onToggle);
    }
    super.destroy();
  }
}
