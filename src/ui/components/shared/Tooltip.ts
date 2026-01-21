/**
 * Tooltip Component
 * Provides accessible tooltips for UI elements
 */

import { BaseComponent, ComponentConfig } from './BaseComponent';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipConfig extends ComponentConfig {
  content: string;
  position?: TooltipPosition;
  delay?: number;
  maxWidth?: number;
}

export class Tooltip extends BaseComponent {
  private tooltipConfig: TooltipConfig;
  private showTimeout?: ReturnType<typeof setTimeout>;
  private hideTimeout?: ReturnType<typeof setTimeout>;
  private targetElement?: HTMLElement;

  constructor(config: TooltipConfig) {
    const normalizedConfig = {
      position: 'top' as TooltipPosition,
      delay: 300,
      maxWidth: 200,
      ...config,
    };
    super(normalizedConfig);
    this.tooltipConfig = normalizedConfig;
    this.setupTooltip();
  }

  protected createElement(): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    return tooltip;
  }

  private setupTooltip(): void {
    this.element.className = `
      fixed z-[4000] px-2 py-1 text-xs font-medium
      text-white bg-gray-900 dark:bg-gray-700
      rounded shadow-lg
      opacity-0 invisible
      transition-opacity duration-200
      pointer-events-none
    `
      .replace(/\s+/g, ' ')
      .trim();

    this.element.style.maxWidth = `${this.tooltipConfig.maxWidth}px`;
    this.element.textContent = this.tooltipConfig.content;

    // Add arrow
    const arrow = document.createElement('div');
    arrow.className = this.getArrowClasses();
    this.element.appendChild(arrow);
  }

  private getArrowClasses(): string {
    const baseClasses = 'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45';

    switch (this.tooltipConfig.position) {
      case 'top':
        return `${baseClasses} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseClasses} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseClasses} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseClasses} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseClasses} -bottom-1 left-1/2 -translate-x-1/2`;
    }
  }

  /**
   * Attach tooltip to a target element
   */
  public attach(target: HTMLElement): void {
    this.targetElement = target;

    // Set up accessibility
    const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
    this.element.id = tooltipId;
    target.setAttribute('aria-describedby', tooltipId);

    // Add event listeners
    target.addEventListener('mouseenter', this.handleMouseEnter);
    target.addEventListener('mouseleave', this.handleMouseLeave);
    target.addEventListener('focus', this.handleFocus);
    target.addEventListener('blur', this.handleBlur);

    // Append tooltip to body
    document.body.appendChild(this.element);
  }

  /**
   * Detach tooltip from target element
   */
  public detach(): void {
    if (this.targetElement) {
      this.targetElement.removeEventListener('mouseenter', this.handleMouseEnter);
      this.targetElement.removeEventListener('mouseleave', this.handleMouseLeave);
      this.targetElement.removeEventListener('focus', this.handleFocus);
      this.targetElement.removeEventListener('blur', this.handleBlur);
      this.targetElement.removeAttribute('aria-describedby');
      this.targetElement = undefined;
    }

    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  private handleMouseEnter = (): void => {
    this.scheduleShow();
  };

  private handleMouseLeave = (): void => {
    this.scheduleHide();
  };

  private handleFocus = (): void => {
    this.showTooltip();
  };

  private handleBlur = (): void => {
    this.hideTooltip();
  };

  private scheduleShow(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }

    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, this.tooltipConfig.delay);
  }

  private scheduleHide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = undefined;
    }

    this.hideTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 100);
  }

  private showTooltip(): void {
    if (!this.targetElement) return;

    this.positionTooltip();
    this.element.classList.remove('opacity-0', 'invisible');
    this.element.classList.add('opacity-100', 'visible');
    this.element.setAttribute('aria-hidden', 'false');
  }

  private hideTooltip(): void {
    this.element.classList.remove('opacity-100', 'visible');
    this.element.classList.add('opacity-0', 'invisible');
    this.element.setAttribute('aria-hidden', 'true');
  }

  private positionTooltip(): void {
    if (!this.targetElement) return;

    const targetRect = this.targetElement.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();
    const gap = 8;

    let top: number;
    let left: number;

    switch (this.tooltipConfig.position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + gap;
        break;
      default:
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    }

    // Keep tooltip within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  /**
   * Update tooltip content
   */
  public setContent(content: string): void {
    this.tooltipConfig.content = content;
    // Update text content, preserving arrow
    const arrow = this.element.querySelector('div');
    this.element.textContent = content;
    if (arrow) {
      this.element.appendChild(arrow);
    }
  }

  /**
   * Get current content
   */
  public getContent(): string {
    return this.tooltipConfig.content;
  }
}

/**
 * Create a simple tooltip attached to an element
 */
export function createTooltip(
  target: HTMLElement,
  content: string,
  options: Partial<TooltipConfig> = {}
): Tooltip {
  const tooltip = new Tooltip({
    content,
    ...options,
  });
  tooltip.attach(target);
  return tooltip;
}
