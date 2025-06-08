/**
 * UI Components for the offline manager
 * Stripe-inspired design system
 */

import { icons } from '../utils/icons';
import { Theme, themeManager } from './themes';

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
  onClose?: () => void;
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

  const theme = props.theme || themeManager.getTheme();
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = disabled || loading;

  // Base styles
  const baseStyles: Partial<CSSStyleDeclaration> = {
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.fontWeight.medium,
    borderRadius: theme.radii.md,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    outline: 'none',
    boxSizing: 'border-box',
  };

  // Size styles
  const sizeStyles = {
    sm: {
      fontSize: theme.typography.fontSize.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      minHeight: '32px',
    },
    md: {
      fontSize: theme.typography.fontSize.sm,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      minHeight: '40px',
    },
    lg: {
      fontSize: theme.typography.fontSize.md,
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      minHeight: '48px',
    },
  };

  // Variant styles
  const variantStyles = {
    primary: {
      backgroundColor: disabled ? theme.colors.textMuted : theme.colors.primary,
      color: theme.colors.textInverse,
      boxShadow: disabled ? 'none' : theme.shadows.sm,
    },
    secondary: {
      backgroundColor: disabled ? theme.colors.borderLight : theme.colors.surface,
      color: disabled ? theme.colors.textMuted : theme.colors.text,
      border: `1px solid ${disabled ? theme.colors.borderLight : theme.colors.border}`,
      boxShadow: disabled ? 'none' : theme.shadows.sm,
    },
    success: {
      backgroundColor: disabled ? theme.colors.textMuted : theme.colors.success,
      color: theme.colors.textInverse,
      boxShadow: disabled ? 'none' : theme.shadows.sm,
    },
    warning: {
      backgroundColor: disabled ? theme.colors.textMuted : theme.colors.warning,
      color: theme.colors.textInverse,
      boxShadow: disabled ? 'none' : theme.shadows.sm,
    },
    error: {
      backgroundColor: disabled ? theme.colors.textMuted : theme.colors.error,
      color: theme.colors.textInverse,
      boxShadow: disabled ? 'none' : theme.shadows.sm,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: disabled ? theme.colors.textMuted : theme.colors.text,
      border: 'none',
    },
  };

  // Apply styles
  Object.assign(button.style, baseStyles, sizeStyles[size], variantStyles[variant], style);

  // Add hover effects
  if (!disabled && !loading) {
    const hoverColors = {
      primary: theme.colors.primaryHover,
      secondary: theme.colors.surfaceHover,
      success: theme.colors.successHover,
      warning: theme.colors.warningHover,
      error: theme.colors.errorHover,
      ghost: theme.colors.surfaceHover,
    };

    button.addEventListener('mouseenter', () => {
      if (variant === 'secondary' || variant === 'ghost') {
        button.style.backgroundColor = hoverColors[variant];
      } else {
        button.style.backgroundColor = hoverColors[variant];
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = variantStyles[variant].backgroundColor as string;
    });
  }

  // Content
  let content = '';
  if (loading) {
    content = `<span style="display: inline-flex; align-items: center; gap: ${theme.spacing.xs};">
      <div style="width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      Loading...
    </span>`;
  } else if (icon) {
    const iconHtml = icons[icon as keyof typeof icons]?.({ size: size === 'sm' ? 14 : size === 'lg' ? 18 : 16, color: 'currentColor' }) || '';
    content = iconPosition === 'left' 
      ? `${iconHtml}${children}`
      : `${children}${iconHtml}`;
  } else {
    content = children;
  }

  button.innerHTML = content;
  button.className = className;

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  // Add keyframe animation for loading spinner
  if (loading && !document.getElementById('button-spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'button-spinner-styles';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
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

  const theme = props.theme || themeManager.getTheme();
  const container = document.createElement('div');
  container.className = className;
  Object.assign(container.style, style);

  let html = '';

  // Label
  if (label) {
    html += `
      <label style="
        display: block;
        margin-bottom: ${theme.spacing.xs};
        font-size: ${theme.typography.fontSize.sm};
        font-weight: ${theme.typography.fontWeight.medium};
        color: ${theme.colors.text};
        font-family: ${theme.typography.fontFamily};
      ">
        ${label} ${required ? '<span style="color: ' + theme.colors.error + ';">*</span>' : ''}
      </label>
    `;
  }

  // Input
  const inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
  html += `
    <input
      id="${inputId}"
      type="${type}"
      placeholder="${placeholder}"
      value="${value}"
      ${disabled ? 'disabled' : ''}
      ${required ? 'required' : ''}
      style="
        width: 100%;
        padding: ${theme.spacing.sm} ${theme.spacing.md};
        font-size: ${theme.typography.fontSize.sm};
        font-family: ${theme.typography.fontFamily};
        border: 1px solid ${error ? theme.colors.error : theme.colors.border};
        border-radius: ${theme.radii.md};
        background-color: ${disabled ? theme.colors.backgroundTertiary : theme.colors.surface};
        color: ${disabled ? theme.colors.textMuted : theme.colors.text};
        box-sizing: border-box;
        transition: all 0.2s ease;
        outline: none;
      "
    />
  `;

  // Description or error
  if (description && !error) {
    html += `
      <div style="
        margin-top: ${theme.spacing.xs};
        font-size: ${theme.typography.fontSize.xs};
        color: ${theme.colors.textMuted};
        font-family: ${theme.typography.fontFamily};
      ">
        ${description}
      </div>
    `;
  }

  if (error) {
    html += `
      <div style="
        margin-top: ${theme.spacing.xs};
        font-size: ${theme.typography.fontSize.xs};
        color: ${theme.colors.error};
        font-family: ${theme.typography.fontFamily};
        font-weight: ${theme.typography.fontWeight.medium};
      ">
        ${error}
      </div>
    `;
  }

  container.innerHTML = html;

  const input = container.querySelector('input') as HTMLInputElement;

  // Add focus/blur styles
  if (!disabled) {
    input.addEventListener('focus', () => {
      input.style.borderColor = theme.colors.borderFocus;
      input.style.boxShadow = `0 0 0 2px ${theme.colors.primary}20`;
      onFocus?.();
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = error ? theme.colors.error : theme.colors.border;
      input.style.boxShadow = 'none';
      onBlur?.();
    });
  }

  if (onChange) {
    input.addEventListener('input', (e) => {
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

  const theme = props.theme || themeManager.getTheme();
  const card = document.createElement('div');
  card.className = className;

  const paddingValues = {
    sm: theme.spacing.md,
    md: theme.spacing.lg,
    lg: theme.spacing.xl,
  };

  const shadowValues = {
    sm: theme.shadows.sm,
    md: theme.shadows.md,
    lg: theme.shadows.lg,
    xl: theme.shadows.xl,
  };

  const cardStyles: Partial<CSSStyleDeclaration> = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: paddingValues[padding],
    boxShadow: shadowValues[shadow],
    border: border ? `1px solid ${theme.colors.border}` : 'none',
    fontFamily: theme.typography.fontFamily,
    ...style,
  };

  Object.assign(card.style, cardStyles);
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
    onClose,
    children,
    className = '',
    style = {},
  } = props;

  const theme = props.theme || themeManager.getTheme();
  const modal = document.createElement('div');
  modal.className = className;

  const sizeStyles = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '500px' },
    lg: { maxWidth: '700px' },
    xl: { maxWidth: '900px' },
  };

  const modalStyles: Partial<CSSStyleDeclaration> = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '10000',
    display: isOpen ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    fontFamily: theme.typography.fontFamily,
    ...style,
  };

  Object.assign(modal.style, modalStyles);

  const contentStyles = `
    background: ${theme.colors.surface};
    border-radius: ${theme.radii.xl};
    box-shadow: ${theme.shadows.xl};
    max-width: ${sizeStyles[size].maxWidth};
    max-height: 90vh;
    width: 90%;
    overflow-y: auto;
    margin: ${theme.spacing.lg};
  `;

  let html = `
    <div style="${contentStyles}">
      <div style="
        padding: ${theme.spacing.xl};
        border-bottom: 1px solid ${theme.colors.border};
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: ${theme.spacing.lg};
      ">
        <div style="flex: 1;">
          <h2 style="
            margin: 0 0 ${subtitle ? theme.spacing.xs : '0'} 0;
            font-size: ${theme.typography.fontSize.xl};
            font-weight: ${theme.typography.fontWeight.semibold};
            color: ${theme.colors.text};
            line-height: ${theme.typography.lineHeight.tight};
          ">
            ${title}
          </h2>
          ${subtitle ? `
            <p style="
              margin: 0;
              font-size: ${theme.typography.fontSize.sm};
              color: ${theme.colors.textSecondary};
              line-height: ${theme.typography.lineHeight.normal};
            ">
              ${subtitle}
            </p>
          ` : ''}
        </div>
        ${showCloseButton ? `
          <button
            onclick="this.closest('[style*=\"position: fixed\"]').style.display = 'none'"
            style="
              background: transparent;
              border: none;
              color: ${theme.colors.textMuted};
              cursor: pointer;
              padding: ${theme.spacing.xs};
              border-radius: ${theme.radii.md};
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.backgroundColor = '${theme.colors.surfaceHover}'; this.style.color = '${theme.colors.text}';"
            onmouseout="this.style.backgroundColor = 'transparent'; this.style.color = '${theme.colors.textMuted}';"
          >
            ${icons.x({ size: 20, color: 'currentColor' })}
          </button>
        ` : ''}
      </div>
      <div style="padding: ${theme.spacing.xl};">
        ${children}
      </div>
    </div>
  `;

  modal.innerHTML = html;

  // Handle close button and backdrop clicks
  if (onClose) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        onClose();
      }
    });

    if (showCloseButton) {
      const closeButton = modal.querySelector('button');
      if (closeButton) {
        closeButton.addEventListener('click', onClose);
      }
    }
  }

  return modal;
}

/**
 * Badge component
 */
export function createBadge(props: BadgeProps): HTMLSpanElement {
  const {
    variant = 'neutral',
    size = 'md',
    children,
    className = '',
    style = {},
  } = props;

  const theme = props.theme || themeManager.getTheme();
  const badge = document.createElement('span');
  badge.className = className;

  const sizeStyles = {
    sm: {
      fontSize: theme.typography.fontSize.xs,
      padding: `2px ${theme.spacing.xs}`,
      minHeight: '20px',
    },
    md: {
      fontSize: theme.typography.fontSize.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      minHeight: '24px',
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: `${theme.colors.primary}15`,
      color: theme.colors.primary,
    },
    success: {
      backgroundColor: `${theme.colors.success}15`,
      color: theme.colors.success,
    },
    warning: {
      backgroundColor: `${theme.colors.warning}15`,
      color: theme.colors.warning,
    },
    error: {
      backgroundColor: `${theme.colors.error}15`,
      color: theme.colors.error,
    },
    info: {
      backgroundColor: `${theme.colors.info}15`,
      color: theme.colors.info,
    },
    neutral: {
      backgroundColor: theme.colors.backgroundTertiary,
      color: theme.colors.textSecondary,
    },
  };

  const badgeStyles: Partial<CSSStyleDeclaration> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.fontWeight.medium,
    borderRadius: theme.radii.full,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  Object.assign(badge.style, badgeStyles);
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

  const theme = props.theme || themeManager.getTheme();
  const container = document.createElement('div');
  container.className = className;
  Object.assign(container.style, style);

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeStyles = {
    sm: { height: '4px' },
    md: { height: '8px' },
    lg: { height: '12px' },
  };

  const variantColors = {
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };

  let html = '';

  if (showLabel || label) {
    html += `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: ${theme.spacing.xs};
        font-size: ${theme.typography.fontSize.sm};
        color: ${theme.colors.text};
        font-family: ${theme.typography.fontFamily};
      ">
        <span>${label || ''}</span>
        <span style="font-weight: ${theme.typography.fontWeight.medium};">${percentage.toFixed(0)}%</span>
      </div>
    `;
  }

  html += `
    <div style="
      width: 100%;
      height: ${sizeStyles[size].height};
      background-color: ${theme.colors.backgroundTertiary};
      border-radius: ${theme.radii.full};
      overflow: hidden;
    ">
      <div style="
        height: 100%;
        width: ${percentage}%;
        background-color: ${variantColors[variant]};
        border-radius: ${theme.radii.full};
        transition: width 0.3s ease;
      "></div>
    </div>
  `;

  container.innerHTML = html;
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

  const theme = props.theme || themeManager.getTheme();
  const alert = document.createElement('div');
  alert.className = className;

  const variantStyles = {
    success: {
      backgroundColor: `${theme.colors.success}10`,
      borderColor: `${theme.colors.success}30`,
      color: theme.colors.success,
      icon: 'checkCircle',
    },
    warning: {
      backgroundColor: `${theme.colors.warning}10`,
      borderColor: `${theme.colors.warning}30`,
      color: theme.colors.warning,
      icon: 'alertTriangle',
    },
    error: {
      backgroundColor: `${theme.colors.error}10`,
      borderColor: `${theme.colors.error}30`,
      color: theme.colors.error,
      icon: 'x',
    },
    info: {
      backgroundColor: `${theme.colors.info}10`,
      borderColor: `${theme.colors.info}30`,
      color: theme.colors.info,
      icon: 'infoCircle',
    },
  };

  const currentVariant = variantStyles[variant];

  const alertStyles: Partial<CSSStyleDeclaration> = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: currentVariant.backgroundColor,
    border: `1px solid ${currentVariant.borderColor}`,
    borderRadius: theme.radii.md,
    fontFamily: theme.typography.fontFamily,
    ...style,
  };

  Object.assign(alert.style, alertStyles);

  const iconHtml = icons[currentVariant.icon as keyof typeof icons]?.({ size: 16, color: currentVariant.color }) || '';

  let html = `
    <div style="flex-shrink: 0; margin-top: 2px;">
      ${iconHtml}
    </div>
    <div style="flex: 1; min-width: 0;">
      ${title ? `
        <div style="
          font-weight: ${theme.typography.fontWeight.medium};
          color: ${theme.colors.text};
          margin-bottom: ${theme.spacing.xs};
          font-size: ${theme.typography.fontSize.sm};
        ">
          ${title}
        </div>
      ` : ''}
      <div style="
        color: ${theme.colors.textSecondary};
        font-size: ${theme.typography.fontSize.sm};
        line-height: ${theme.typography.lineHeight.normal};
      ">
        ${children}
      </div>
    </div>
  `;

  if (dismissible) {
    html += `
      <button
        style="
          background: transparent;
          border: none;
          color: ${theme.colors.textMuted};
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        "
      >
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
