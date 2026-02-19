/**
 * Language Selector Component
 * Provides a dropdown to switch between available languages
 */

import { BaseComponent } from './BaseComponent';
import { i18n, SupportedLanguage } from '../../translations';
import { icons } from '../../../utils/icons';

export interface LanguageSelectorOptions {
  onChange?: (language: SupportedLanguage) => void;
}

export class LanguageSelector extends BaseComponent {
  private options: LanguageSelectorOptions;
  private dropdown?: HTMLDivElement;
  private isOpen = false;
  private unsubscribeLanguage?: () => void;

  constructor(options: LanguageSelectorOptions = {}) {
    super({});
    this.options = options;

    // Register the outside click listener once in the constructor
    document.addEventListener('click', this.handleOutsideClick);

    this.render();

    // Subscribe to language changes
    this.unsubscribeLanguage = i18n.subscribe(() => this.render());
  }

  protected createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'relative';
    return container;
  }

  private render(): void {
    const currentLang = i18n.getLanguage();
    const languages = i18n.getAvailableLanguages();
    const currentLangInfo = languages.find(l => l.code === currentLang);

    this.element.innerHTML = '';

    // Create button
    const button = document.createElement('button');
    button.className =
      'p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full flex items-center gap-1 transition-colors cursor-pointer';
    button.title = i18n.t('language.select');
    button.innerHTML = `
      ${icons.language({ size: 16, color: 'currentColor' })}
      <span class="text-xs font-medium">${currentLangInfo?.code.toUpperCase() || 'EN'}</span>
    `;

    button.addEventListener('click', e => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    this.element.appendChild(button);

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = `
      absolute top-full ${i18n.isRTL() ? 'left-0' : 'right-0'} mt-1
      bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
      rounded-lg shadow-lg overflow-hidden z-50
      ${this.isOpen ? 'block' : 'hidden'}
    `;

    languages.forEach(lang => {
      const item = document.createElement('button');
      item.className = `
        w-full px-4 py-2 text-left text-sm flex items-center justify-between gap-4
        ${lang.code === currentLang ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}
        hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer
      `;
      item.innerHTML = `
        <span class="font-medium">${lang.nativeName}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">${lang.name}</span>
      `;

      item.addEventListener('click', e => {
        e.stopPropagation();
        this.selectLanguage(lang.code);
      });

      dropdown.appendChild(item);
    });

    this.dropdown = dropdown;
    this.element.appendChild(dropdown);
  }

  private handleOutsideClick = (): void => {
    if (this.isOpen) {
      this.closeDropdown();
    }
  };

  private toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.dropdown) {
      this.dropdown.classList.toggle('hidden', !this.isOpen);
    }
  }

  private closeDropdown(): void {
    this.isOpen = false;
    if (this.dropdown) {
      this.dropdown.classList.add('hidden');
    }
  }

  private selectLanguage(code: SupportedLanguage): void {
    i18n.setLanguage(code);
    this.closeDropdown();
    this.options.onChange?.(code);
  }

  public destroy(): void {
    if (this.unsubscribeLanguage) {
      this.unsubscribeLanguage();
    }
    document.removeEventListener('click', this.handleOutsideClick);
    super.destroy();
  }
}
