/**
 * Button Manager Component
 * Manages the main control button and progress badge states
 * Refactored to use modular Button component
 */

import { icons } from '../../utils/icons';
import { Button, ButtonConfig } from '../components/shared/Button';

export interface ButtonManagerOptions {
  onTogglePanel: () => void;
}

export class ButtonManager {
  private container: HTMLDivElement;
  private button: Button;
  private options: ButtonManagerOptions;

  constructor(options: ButtonManagerOptions) {
    this.options = options;
    this.container = this.createContainer();
    this.button = this.createButton();
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
    this.button.setText(text);
    this.button.setDisabled(disabled);
  }

  /**
   * Update progress badge
   */
  public updateProgressBadge(text: string, visible: boolean): void {
    this.button.updateProgressBadge(text, visible);
  }

  /**
   * Reset button to default state
   */
  public resetToDefault(): void {
    this.button.getElement().innerHTML = icons.cloud({ size: 20, color: 'black' });
    this.button.setDisabled(false);
    this.button.getElement().title = 'Offline Map Manager';
    this.button.hideProgressBadge();
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
   * Create main button using modular Button component
   */
  private createButton(): Button {
    const buttonConfig: ButtonConfig = {
      className: 'maplibregl-ctrl-icon relative',
      icon: icons.cloud({ size: 20, color: 'black' }),
      title: 'Offline Map Manager',
      showProgressBadge: true,
      onClick: this.options.onTogglePanel
    };

    const button = new Button(buttonConfig);
    this.container.appendChild(button.getElement());
    return button;
  }

  /**
   * Cleanup when removed
   */
  public cleanup(): void {
    this.button.destroy();
  }
}
