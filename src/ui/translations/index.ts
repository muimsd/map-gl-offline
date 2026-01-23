/**
 * Internationalization (i18n) module for map-gl-offline
 * Uses i18next for multi-language support
 *
 * Currently supports: English (en), Arabic (ar)
 */

import i18next from 'i18next';
import { en } from './en';
import { ar } from './ar';

export type TranslationKey = keyof typeof en;
export type SupportedLanguage = 'en' | 'ar';

// RTL languages
const rtlLanguages: SupportedLanguage[] = ['ar'];

// Initialize i18next
i18next.init({
  lng: localStorage.getItem('offline-manager-language') || 'en',
  fallbackLng: 'en',
  debug: false,
  interpolation: {
    escapeValue: false, // Not needed for non-HTML contexts
    prefix: '{{',
    suffix: '}}',
  },
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
});

/**
 * I18n Manager wrapper for i18next with additional functionality
 */
class I18nManager {
  private listeners: Set<() => void> = new Set();

  /**
   * Get the current language
   */
  getLanguage(): SupportedLanguage {
    return i18next.language as SupportedLanguage;
  }

  /**
   * Set the current language
   */
  setLanguage(lang: SupportedLanguage): void {
    i18next.changeLanguage(lang);
    localStorage.setItem('offline-manager-language', lang);

    // Update document direction for RTL languages
    this.updateDocumentDirection();

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Check if current language is RTL
   */
  isRTL(): boolean {
    return rtlLanguages.includes(this.getLanguage());
  }

  /**
   * Update document direction based on current language
   */
  private updateDocumentDirection(): void {
    const offlineManagerElements = document.querySelectorAll('.offline-manager-control');
    offlineManagerElements.forEach(el => {
      if (this.isRTL()) {
        el.setAttribute('dir', 'rtl');
        el.classList.add('rtl');
      } else {
        el.setAttribute('dir', 'ltr');
        el.classList.remove('rtl');
      }
    });
  }

  /**
   * Get a translated string using i18next
   */
  t(key: TranslationKey, replacements?: Record<string, string | number>): string {
    return i18next.t(key, replacements as Record<string, string>);
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): { code: SupportedLanguage; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    ];
  }

  /**
   * Subscribe to language changes
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of language change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Get the i18next instance for advanced usage
   */
  getInstance(): typeof i18next {
    return i18next;
  }
}

// Singleton instance
export const i18n = new I18nManager();

// Convenience function for translations
export const t = (key: TranslationKey, replacements?: Record<string, string | number>): string => {
  return i18n.t(key, replacements);
};

// Re-export i18next for advanced usage
export { i18next };

export { en, ar };
