/**
 * Theme system for the offline manager UI
 * Inspired by Stripe's design system
 */

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: {
    // Primary brand colors
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryDark: string;
    
    // Semantic colors
    success: string;
    successHover: string;
    warning: string;
    warningHover: string;
    error: string;
    errorHover: string;
    errorLight: string;
    errorBg: string;
    info: string;
    infoHover: string;
    infoLight: string;
    infoBg: string;
    
    // Background colors
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    surface: string;
    surfaceHover: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    
    // Border colors
    border: string;
    borderLight: string;
    borderFocus: string;
    
    // Overlay colors
    overlay: string;
    overlayLight: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  radii: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      xxl: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
    lineHeight: {
      tight: string;
      normal: string;
      relaxed: string;
    };
  };
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    // Primary colors - JobRight.ai purple/violet theme
    primary: '#8B5CF6',
    primaryHover: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#6D28D9',
    
    // Semantic colors - featuring green tones
    success: '#10B981',
    successHover: '#059669',
    warning: '#F59E0B',
    warningHover: '#D97706',
    error: '#EF4444',
    errorHover: '#DC2626',
    errorLight: '#FEF2F2',
    errorBg: '#FECACA',
    info: '#8B5CF6',
    infoHover: '#7C3AED',
    infoLight: '#F3E8FF',
    infoBg: '#DDD6FE',
    
    // Background colors - light theme with subtle purple tints
    background: '#FFFFFF',
    backgroundSecondary: '#FAFBFC',
    backgroundTertiary: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceHover: '#F9FAFB',
    
    // Text colors
    text: '#1F2937',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Border colors - subtle purple accents
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderFocus: '#8B5CF6',
    
    // Overlay colors
    overlay: 'rgba(31, 41, 55, 0.4)',
    overlayLight: 'rgba(31, 41, 55, 0.2)',
  },
  shadows: {
    sm: '0 1px 2px rgba(139, 92, 246, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(139, 92, 246, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px rgba(139, 92, 246, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(139, 92, 246, 0.1), 0 8px 10px rgba(0, 0, 0, 0.04)',
  },
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  spacing: {
    xs: '3px',
    sm: '6px',
    md: '9px',
    lg: '12px',
    xl: '18px',
    xxl: '24px',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '9px',
      sm: '10.5px',
      md: '12px',
      lg: '13.5px',
      xl: '15px',
      xxl: '18px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  mode: 'dark',
  colors: {
    // Primary colors - brighter purple/violet for dark mode
    primary: '#A78BFA',
    primaryHover: '#C4B5FD',
    primaryLight: '#DDD6FE',
    primaryDark: '#8B5CF6',
    
    // Semantic colors - vibrant green and accent colors for dark mode
    success: '#34D399',
    successHover: '#6EE7B7',
    warning: '#FBBF24',
    warningHover: '#FCD34D',
    error: '#F87171',
    errorHover: '#FCA5A5',
    errorLight: '#451A1A',
    errorBg: '#7F1D1D',
    info: '#A78BFA',
    infoHover: '#C4B5FD',
    infoLight: '#2D1B69',
    infoBg: '#5B21B6',
    
    // Background colors - dark theme with deep purple undertones
    background: '#0F0B1F',
    backgroundSecondary: '#1A1625',
    backgroundTertiary: '#252032',
    surface: '#1A1625',
    surfaceHover: '#252032',
    
    // Text colors - high contrast for dark mode
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    textInverse: '#1F2937',
    
    // Border colors - subtle purple borders for dark mode
    border: '#374151',
    borderLight: '#4B5563',
    borderFocus: '#A78BFA',
    
    // Overlay colors
    overlay: 'rgba(15, 11, 31, 0.8)',
    overlayLight: 'rgba(15, 11, 31, 0.6)',
  },
  shadows: {
    sm: '0 1px 2px rgba(167, 139, 250, 0.3), 0 1px 3px rgba(0, 0, 0, 0.4)',
    md: '0 4px 6px rgba(167, 139, 250, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(167, 139, 250, 0.2), 0 4px 6px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px rgba(167, 139, 250, 0.2), 0 8px 10px rgba(0, 0, 0, 0.4)',
  },
};

// Theme context management
class ThemeManager {
  private currentTheme: Theme = lightTheme;
  private listeners: ((theme: Theme) => void)[] = [];

  constructor() {
    // Initialize theme from localStorage or system preference
    this.initializeTheme();
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('offline-manager-theme') as ThemeMode;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const themeMode = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    this.setTheme(themeMode);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('offline-manager-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode === 'dark' ? darkTheme : lightTheme;
    localStorage.setItem('offline-manager-theme', mode);
    this.notifyListeners();
  }

  toggleTheme(): void {
    const newMode = this.currentTheme.mode === 'light' ? 'dark' : 'light';
    this.setTheme(newMode);
  }

  subscribe(listener: (theme: Theme) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentTheme));
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();

// Helper function to generate CSS custom properties
export function generateCSSCustomProperties(theme: Theme): string {
  return `
    --theme-primary: ${theme.colors.primary};
    --theme-primary-hover: ${theme.colors.primaryHover};
    --theme-primary-light: ${theme.colors.primaryLight};
    --theme-primary-dark: ${theme.colors.primaryDark};
    
    --theme-success: ${theme.colors.success};
    --theme-success-hover: ${theme.colors.successHover};
    --theme-warning: ${theme.colors.warning};
    --theme-warning-hover: ${theme.colors.warningHover};
    --theme-error: ${theme.colors.error};
    --theme-error-hover: ${theme.colors.errorHover};
    --theme-error-light: ${theme.colors.errorLight};
    --theme-error-bg: ${theme.colors.errorBg};
    --theme-info: ${theme.colors.info};
    --theme-info-hover: ${theme.colors.infoHover};
    --theme-info-light: ${theme.colors.infoLight};
    --theme-info-bg: ${theme.colors.infoBg};
    
    --theme-background: ${theme.colors.background};
    --theme-background-secondary: ${theme.colors.backgroundSecondary};
    --theme-background-tertiary: ${theme.colors.backgroundTertiary};
    --theme-surface: ${theme.colors.surface};
    --theme-surface-hover: ${theme.colors.surfaceHover};
    
    --theme-text: ${theme.colors.text};
    --theme-text-secondary: ${theme.colors.textSecondary};
    --theme-text-muted: ${theme.colors.textMuted};
    --theme-text-inverse: ${theme.colors.textInverse};
    
    --theme-border: ${theme.colors.border};
    --theme-border-light: ${theme.colors.borderLight};
    --theme-border-focus: ${theme.colors.borderFocus};
    
    --theme-overlay: ${theme.colors.overlay};
    --theme-overlay-light: ${theme.colors.overlayLight};
    
    --theme-shadow-sm: ${theme.shadows.sm};
    --theme-shadow-md: ${theme.shadows.md};
    --theme-shadow-lg: ${theme.shadows.lg};
    --theme-shadow-xl: ${theme.shadows.xl};
    
    --theme-radius-sm: ${theme.radii.sm};
    --theme-radius-md: ${theme.radii.md};
    --theme-radius-lg: ${theme.radii.lg};
    --theme-radius-xl: ${theme.radii.xl};
    --theme-radius-full: ${theme.radii.full};
    
    --theme-spacing-xs: ${theme.spacing.xs};
    --theme-spacing-sm: ${theme.spacing.sm};
    --theme-spacing-md: ${theme.spacing.md};
    --theme-spacing-lg: ${theme.spacing.lg};
    --theme-spacing-xl: ${theme.spacing.xl};
    --theme-spacing-xxl: ${theme.spacing.xxl};
    
    --theme-font-family: ${theme.typography.fontFamily};
    --theme-font-size-xs: ${theme.typography.fontSize.xs};
    --theme-font-size-sm: ${theme.typography.fontSize.sm};
    --theme-font-size-md: ${theme.typography.fontSize.md};
    --theme-font-size-lg: ${theme.typography.fontSize.lg};
    --theme-font-size-xl: ${theme.typography.fontSize.xl};
    --theme-font-size-xxl: ${theme.typography.fontSize.xxl};
    
    --theme-font-weight-normal: ${theme.typography.fontWeight.normal};
    --theme-font-weight-medium: ${theme.typography.fontWeight.medium};
    --theme-font-weight-semibold: ${theme.typography.fontWeight.semibold};
    --theme-font-weight-bold: ${theme.typography.fontWeight.bold};
    
    --theme-line-height-tight: ${theme.typography.lineHeight.tight};
    --theme-line-height-normal: ${theme.typography.lineHeight.normal};
    --theme-line-height-relaxed: ${theme.typography.lineHeight.relaxed};
  `;
}
