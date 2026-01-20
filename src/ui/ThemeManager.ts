/**
 * Simplified theme system for dark/light/system mode management
 * Now that all components use Tailwind CSS, we only need basic theme switching
 */

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Theme {
  mode: ThemeMode;
  preference: ThemePreference;
}

export const lightTheme: Theme = {
  mode: 'light',
  preference: 'light',
};

export const darkTheme: Theme = {
  mode: 'dark',
  preference: 'dark',
};

export const systemTheme: Theme = {
  mode: 'light', // Will be updated based on system preference
  preference: 'system',
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
    const savedPreference = localStorage.getItem('offline-manager-theme') as ThemePreference | null;

    if (savedPreference === 'system' || !savedPreference) {
      // Use system preference
      this.setThemePreference('system');
    } else {
      this.setThemePreference(savedPreference);
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (this.currentTheme.preference === 'system') {
        this.applyThemeMode(e.matches ? 'dark' : 'light', 'system');
      }
    });
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Get the effective theme mode (light or dark)
   */
  getEffectiveMode(): ThemeMode {
    return this.currentTheme.mode;
  }

  /**
   * Get the user's preference (light, dark, or system)
   */
  getPreference(): ThemePreference {
    return this.currentTheme.preference;
  }

  private applyThemeMode(mode: ThemeMode, preference: ThemePreference): void {
    this.currentTheme = { mode, preference };

    // Apply theme to document for Tailwind dark mode
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    this.notifyListeners();
  }

  /**
   * Set the theme preference (light, dark, or system)
   */
  setThemePreference(preference: ThemePreference): void {
    localStorage.setItem('offline-manager-theme', preference);

    if (preference === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyThemeMode(systemPrefersDark ? 'dark' : 'light', 'system');
    } else {
      this.applyThemeMode(preference, preference);
    }
  }

  /**
   * Set the theme mode directly (for backwards compatibility)
   * @deprecated Use setThemePreference instead
   */
  setTheme(mode: ThemeMode): void {
    this.setThemePreference(mode);
  }

  /**
   * Cycle through themes: light -> dark -> system -> light
   */
  cycleTheme(): void {
    const preference = this.currentTheme.preference;
    if (preference === 'light') {
      this.setThemePreference('dark');
    } else if (preference === 'dark') {
      this.setThemePreference('system');
    } else {
      this.setThemePreference('light');
    }
  }

  /**
   * Toggle between light and dark (legacy behavior)
   * @deprecated Use cycleTheme for light/dark/system cycling
   */
  toggleTheme(): void {
    this.cycleTheme();
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
