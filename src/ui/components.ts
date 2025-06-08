/**
 * UI Components for the offline manager
 * Stripe-inspired design system
 */

import { icons } from '../utils/icons';
import { Theme } from './themes';

export interface ComponentProps {
  theme?: Theme;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  onClick?: (event: MouseEvent) => void;
  text?: string;
  children: string;
}

export interface InputProps extends ComponentProps {
  type?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
  description?: string;
  id?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface CardProps extends ComponentProps {
  padding?: 'sm' | 'md' | 'lg';
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  border?: boolean;
  children: string;
}

export interface ModalProps extends ComponentProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  showThemeToggle?: boolean;
  onClose?: () => void;
  onThemeToggle?: () => void;
  content?: string;
  children: string;
}

export interface BadgeProps extends ComponentProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  children: string;
}

export interface ProgressProps extends ComponentProps {
  value: number;
  max?: number;
  variant?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

export interface AlertProps extends ComponentProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  children: string;
}

/**
 * Button component
 */
export function createButton(props: ButtonProps): HTMLButtonElement {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    iconPosition = 'left',
    onClick,
    children,
    className = '',
    style = {},
  } = props;

  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = disabled || loading;

  // Build Tailwind classes
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-md border-0 transition-all duration-200 text-center whitespace-nowrap select-none outline-none box-border';
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 min-h-8 btn-sm',
    md: 'text-sm px-4 py-2 min-h-10 btn-md', 
    lg: 'text-base px-6 py-3 min-h-12 btn-lg'
  };

  const variantClasses = {
    primary: disabled ? 'bg-gray-400 text-white cursor-not-allowed' : 'btn-primary',
    secondary: disabled ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'btn-secondary',
    success: disabled ? 'bg-gray-400 text-white cursor-not-allowed' : 'btn-success',
    warning: disabled ? 'bg-gray-400 text-white cursor-not-allowed' : 'btn-warning',
    error: disabled ? 'bg-gray-400 text-white cursor-not-allowed' : 'btn-error',
    ghost: disabled ? 'bg-transparent text-gray-400 cursor-not-allowed' : 'btn-ghost'
  };

  const cursorClass = disabled || loading ? 'cursor-not-allowed' : 'cursor-pointer';

  // Combine all classes
  const buttonClasses = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    cursorClass,
    className
  ].filter(Boolean).join(' ');

  button.className = buttonClasses;

  // Apply any additional inline styles
  if (Object.keys(style).length > 0) {
    Object.assign(button.style, style);
  }

  // Content
  let content = '';
  if (loading) {
    content = `<span class="inline-flex items-center gap-1">
      <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      Loading...
    </span>`;
  } else if (icon) {
    const iconHtml =
      icons[icon as keyof typeof icons]?.({
        size: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
        color: 'currentColor',
      }) || '';
    content = iconPosition === 'left' ? `${iconHtml}${children}` : `${children}${iconHtml}`;
  } else {
    content = children;
  }

  button.innerHTML = content;

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Input component
 */
export function createInput(props: InputProps): HTMLDivElement {
  const {
    type = 'text',
    placeholder = '',
    value = '',
    disabled = false,
    required = false,
    error,
    label,
    description,
    onChange,
    onFocus,
    onBlur,
    className = '',
    style = {},
  } = props;

  const container = document.createElement('div');
  container.className = className;
  Object.assign(container.style, style);

  let html = '';

  // Label
  if (label) {
    html += `
      <label class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">
        ${label} ${required ? '<span class="text-red-500">*</span>' : ''}
      </label>
    `;
  }

  // Input
  const inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
  const inputClasses = [
    'w-full px-4 py-2 text-sm border rounded-md transition-all duration-200 outline-none',
    error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600',
    disabled 
      ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400' 
      : 'bg-white text-gray-900 dark:bg-gray-700 dark:text-white',
    'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
  ].join(' ');

  html += `
    <input
      id="${inputId}"
      type="${type}"
      placeholder="${placeholder}"
      value="${value}"
      ${disabled ? 'disabled' : ''}
      ${required ? 'required' : ''}
      class="${inputClasses}"
    />
  `;

  // Description or error
  if (description && !error) {
    html += `
      <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
        ${description}
      </div>
    `;
  }

  if (error) {
    html += `
      <div class="mt-1 text-xs text-red-500 font-medium">
        ${error}
      </div>
    `;
  }

  container.innerHTML = html;

  const input = container.querySelector('input') as HTMLInputElement;

  // Add focus/blur handlers for custom focus styling if needed
  if (!disabled) {
    input.addEventListener('focus', () => {
      onFocus?.();
    });

    input.addEventListener('blur', () => {
      onBlur?.();
    });
  }

  if (onChange) {
    input.addEventListener('input', e => {
      onChange((e.target as HTMLInputElement).value);
    });
  }

  return container;
}

/**
 * Card component
 */
export function createCard(props: CardProps): HTMLDivElement {
  const {
    padding = 'md',
    shadow = 'md',
    border = true,
    children,
    className = '',
    style = {},
  } = props;

  const card = document.createElement('div');

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const shadowClasses = {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };

  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg';
  const borderClass = border ? 'border border-gray-200 dark:border-gray-700' : '';

  const cardClasses = [
    baseClasses,
    paddingClasses[padding],
    shadowClasses[shadow],
    borderClass,
    className
  ].filter(Boolean).join(' ');

  card.className = cardClasses;
  Object.assign(card.style, style);
  card.innerHTML = children;

  return card;
}

/**
 * Modal component
 */
export function createModal(props: ModalProps): HTMLDivElement {
  const {
    title,
    subtitle,
    isOpen,
    size = 'md',
    showCloseButton = true,
    showThemeToggle = false,
    onClose,
    onThemeToggle,
    children,
    className = '',
    style = {},
  } = props;

  const modal = document.createElement('div');

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const modalClasses = [
    'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50',
    isOpen ? 'flex' : 'hidden',
    className
  ].filter(Boolean).join(' ');

  modal.className = modalClasses;
  Object.assign(modal.style, style);

  // Create modal content container
  const content = document.createElement('div');
  const contentClasses = [
    'bg-white dark:bg-gray-800 rounded-xl shadow-xl w-11/12 max-h-[80vh] overflow-y-auto m-6',
    sizeClasses[size]
  ].join(' ');
  content.className = contentClasses;

  // Create header section
  const header = document.createElement('div');
  header.className = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between gap-6';

  // Create title section
  const titleSection = document.createElement('div');
  titleSection.className = 'flex flex-col justify-center m-0 p-0';

  const titleElement = document.createElement('h2');
  titleElement.className = 'm-0 p-0 text-xl font-semibold text-gray-900 dark:text-white leading-tight';
  titleElement.textContent = title;
  titleSection.appendChild(titleElement);

  if (subtitle) {
    const subtitleElement = document.createElement('p');
    subtitleElement.className = 'm-0 text-sm text-gray-600 dark:text-gray-400 leading-normal';
    subtitleElement.textContent = subtitle;
    titleSection.appendChild(subtitleElement);
  }

  // Create actions section
  const actionsSection = document.createElement('div');
  actionsSection.className = 'flex gap-1 items-center';

  // Theme toggle button
  if (showThemeToggle && onThemeToggle) {
    const themeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: 'moon', // Note: you might want to make this dynamic based on current theme
      children: '',
      onClick: onThemeToggle,
      className: 'w-8 h-8 p-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md',
    });
    actionsSection.appendChild(themeButton);
  }

  // Close button
  if (showCloseButton && onClose) {
    const closeButton = createButton({
      variant: 'ghost',
      size: 'sm',
      icon: 'x',
      children: '',
      onClick: onClose,
      className: 'w-8 h-8 p-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md',
    });
    actionsSection.appendChild(closeButton);
  }

  // Create body section
  const body = document.createElement('div');
  body.className = 'p-6';
  body.innerHTML = children;

  // Assemble modal
  header.appendChild(titleSection);
  header.appendChild(actionsSection);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);

  // Handle backdrop clicks
  if (onClose) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        onClose();
      }
    });
  }

  return modal;
}

/**
 * Badge component
 */
export function createBadge(props: BadgeProps): HTMLSpanElement {
  const { variant = 'neutral', size = 'md', children, className = '', style = {} } = props;

  const badge = document.createElement('span');

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 min-h-5',
    md: 'text-xs px-3 py-1 min-h-6',
  };

  const variantClasses = {
    primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full text-center whitespace-nowrap';

  const badgeClasses = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ');

  badge.className = badgeClasses;
  Object.assign(badge.style, style);
  badge.textContent = children;

  return badge;
}

/**
 * Progress component
 */
export function createProgress(props: ProgressProps): HTMLDivElement {
  const {
    value,
    max = 100,
    variant = 'primary',
    size = 'md',
    showLabel = false,
    label,
    className = '',
    style = {},
  } = props;

  const container = document.createElement('div');
  container.className = className;
  Object.assign(container.style, style);

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
  };

  let html = '';

  if (showLabel || label) {
    html += `
      <div class="flex justify-between items-center mb-1 text-sm text-gray-900 dark:text-white">
        <span>${label || ''}</span>
        <span class="font-medium">${percentage.toFixed(0)}%</span>
      </div>
    `;
  }

  html += `
    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizeClasses[size]}">
      <div class="${sizeClasses[size]} ${variantClasses[variant]} rounded-full transition-all duration-300 ease-out" data-progress="${percentage}"></div>
    </div>
  `;

  container.innerHTML = html;
  
  // Set progress width using CSS custom property to avoid inline styles
  const progressBar = container.querySelector('[data-progress]') as HTMLElement;
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }
  
  return container;
}

/**
 * Alert component
 */
export function createAlert(props: AlertProps): HTMLDivElement {
  const {
    variant = 'info',
    title,
    dismissible = false,
    onDismiss,
    children,
    className = '',
    style = {},
  } = props;

  const alert = document.createElement('div');

  const variantClasses = {
    success: {
      containerClass: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400',
      icon: 'checkCircle',
    },
    warning: {
      containerClass: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      icon: 'alertTriangle',
    },
    error: {
      containerClass: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-400',
      icon: 'x',
    },
    info: {
      containerClass: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      icon: 'infoCircle',
    },
  };

  const currentVariant = variantClasses[variant];

  const alertClasses = [
    'flex items-start gap-3 p-4 border rounded-md',
    currentVariant.containerClass,
    className
  ].filter(Boolean).join(' ');

  alert.className = alertClasses;
  Object.assign(alert.style, style);

  const iconHtml =
    icons[currentVariant.icon as keyof typeof icons]?.({ size: 16, color: 'currentColor' }) || '';

  let html = `
    <div class="flex-shrink-0 mt-0.5 ${currentVariant.iconColor}">
      ${iconHtml}
    </div>
    <div class="flex-1 min-w-0">
      ${
        title
          ? `
        <div class="font-medium text-gray-900 dark:text-white mb-1 text-sm">
          ${title}
        </div>
      `
          : ''
      }
      <div class="text-gray-700 dark:text-gray-300 text-sm leading-normal">
        ${children}
      </div>
    </div>
  `;

  if (dismissible) {
    html += `
      <button class="bg-transparent border-0 text-gray-500 dark:text-gray-400 cursor-pointer p-0 flex items-center justify-center flex-shrink-0 hover:text-gray-700 dark:hover:text-gray-200">
        ${icons.x({ size: 16, color: 'currentColor' })}
      </button>
    `;
  }

  alert.innerHTML = html;

  if (dismissible && onDismiss) {
    const dismissButton = alert.querySelector('button');
    if (dismissButton) {
      dismissButton.addEventListener('click', onDismiss);
    }
  }

  return alert;
}
