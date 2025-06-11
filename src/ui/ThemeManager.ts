/**
 * Simplified theme system for dark/light mode management
 * Now that all components use Tailwind CSS, we only need basic theme switching
 */

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
}

export const lightTheme: Theme = {
  mode: 'light',
};

export const darkTheme: Theme = {
  mode: 'dark',
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
    
    // Apply theme to document for Tailwind dark mode
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
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
