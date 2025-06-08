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
    // Primary colors - Stripe-inspired blue/purple
    primary: '#635bff',
    primaryHover: '#4c44ff',
    primaryLight: '#7c7cff',
    primaryDark: '#4b4acf',
    
    // Semantic colors
    success: '#00d924',
    successHover: '#00c221',
    warning: '#ffb547',
    warningHover: '#ff9f1a',
    error: '#df1b41',
    errorHover: '#c51838',
    errorLight: '#fef2f2',
    errorBg: '#fecaca',
    info: '#0099ff',
    infoHover: '#0086e6',
    infoLight: '#e6f3ff',
    infoBg: '#bfdbfe',
    
    // Background colors
    background: '#ffffff',
    backgroundSecondary: '#fafbfc',
    backgroundTertiary: '#f6f9fc',
    surface: '#ffffff',
    surfaceHover: '#f8f9fa',
    
    // Text colors
    text: '#0a2540',
    textSecondary: '#425466',
    textMuted: '#8898aa',
    textInverse: '#ffffff',
    
    // Border colors
    border: '#e3e8ee',
    borderLight: '#f0f4f8',
    borderFocus: '#635bff',
    
    // Overlay colors
    overlay: 'rgba(10, 37, 64, 0.35)',
    overlayLight: 'rgba(10, 37, 64, 0.15)',
  },
  shadows: {
    sm: '0 1px 3px rgba(50, 50, 93, 0.15), 0 1px 0 rgba(0, 0, 0, 0.02)',
    md: '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)',
    lg: '0 15px 35px rgba(50, 50, 93, 0.1), 0 5px 15px rgba(0, 0, 0, 0.07)',
    xl: '0 25px 50px rgba(50, 50, 93, 0.25), 0 10px 20px rgba(0, 0, 0, 0.15)',
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
    // Primary colors remain similar but adjusted for dark mode
    primary: '#7c7cff',
    primaryHover: '#9999ff',
    primaryLight: '#b3b3ff',
    primaryDark: '#6666ff',
    
    // Semantic colors - adjusted for dark mode
    success: '#00d924',
    successHover: '#33e047',
    warning: '#ffb547',
    warningHover: '#ffcc70',
    error: '#ff4757',
    errorHover: '#ff6b7a',
    errorLight: '#fef2f2',
    errorBg: '#dc2626',
    info: '#3b82f6',
    infoHover: '#60a5fa',
    infoLight: '#1e3a8a',
    infoBg: '#3b82f6',
    
    // Background colors - dark mode
    background: '#0a0e27',
    backgroundSecondary: '#1a1f36',
    backgroundTertiary: '#252a41',
    surface: '#1a1f36',
    surfaceHover: '#252a41',
    
    // Text colors - inverted for dark mode
    text: '#ffffff',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textInverse: '#0a2540',
    
    // Border colors - dark mode
    border: '#334155',
    borderLight: '#475569',
    borderFocus: '#7c7cff',
    
    // Overlay colors
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.25)',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 0 rgba(255, 255, 255, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(255, 255, 255, 0.05)',
    lg: '0 15px 35px rgba(0, 0, 0, 0.4), 0 5px 15px rgba(255, 255, 255, 0.05)',
    xl: '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(255, 255, 255, 0.1)',
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
