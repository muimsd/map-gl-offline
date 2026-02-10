/**
 * Tests for LanguageSelector Component
 */

import { LanguageSelector } from '../../../../src/ui/components/shared/LanguageSelector';
import { i18n } from '../../../../src/ui/translations';

describe('LanguageSelector', () => {
  let selector: LanguageSelector;

  afterEach(() => {
    // Clean up and reset language to English
    if (selector) {
      selector.destroy();
    }
    i18n.setLanguage('en');
  });

  describe('constructor and rendering', () => {
    it('should create a container element', () => {
      selector = new LanguageSelector();
      expect(selector.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should have "relative" class on container', () => {
      selector = new LanguageSelector();
      expect(selector.getElement().classList.contains('relative')).toBe(true);
    });

    it('should render a toggle button', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button');
      expect(button).not.toBeNull();
    });

    it('should display the current language code in uppercase', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button');
      expect(button?.textContent).toContain('EN');
    });

    it('should have title from i18n language.select key', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button');
      expect(button?.title).toBe('Select language');
    });
  });

  describe('dropdown', () => {
    it('should render a dropdown element', () => {
      selector = new LanguageSelector();
      const children = selector.getElement().children;
      expect(children.length).toBe(2); // button + dropdown
    });

    it('should have the dropdown hidden by default', () => {
      selector = new LanguageSelector();
      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.classList.contains('hidden')).toBe(true);
    });

    it('should render one option per available language', () => {
      selector = new LanguageSelector();
      const dropdown = selector.getElement().children[1];
      const options = dropdown.querySelectorAll('button');
      const languages = i18n.getAvailableLanguages();
      expect(options.length).toBe(languages.length);
    });

    it('should display native names for each language option', () => {
      selector = new LanguageSelector();
      const dropdown = selector.getElement().children[1];
      expect(dropdown.textContent).toContain('English');
      expect(dropdown.textContent).toContain('\u0627\u0644\u0639\u0631\u0628\u064A\u0629');
    });

    it('should display English names for each language option', () => {
      selector = new LanguageSelector();
      const dropdown = selector.getElement().children[1];
      expect(dropdown.textContent).toContain('English');
      expect(dropdown.textContent).toContain('Arabic');
    });

    it('should open the dropdown when toggle button is clicked', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;
      button.click();

      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.classList.contains('hidden')).toBe(false);
    });

    it('should close the dropdown when toggle button is clicked again', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;

      // Open
      button.click();
      // Close
      button.click();

      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.classList.contains('hidden')).toBe(true);
    });

    it('should close the dropdown on outside click', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;

      // Open the dropdown
      button.click();
      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.classList.contains('hidden')).toBe(false);

      // Simulate outside click
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(dropdown.classList.contains('hidden')).toBe(true);
    });
  });

  describe('language switching', () => {
    it('should switch language when a language option is clicked', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;
      button.click();

      const dropdown = selector.getElement().children[1];
      const options = dropdown.querySelectorAll('button');
      const arabicOption = Array.from(options).find(o =>
        o.textContent?.includes('Arabic')
      );
      arabicOption?.click();

      expect(i18n.getLanguage()).toBe('ar');
    });

    it('should call onChange callback when a language is selected', () => {
      const onChange = jest.fn();
      selector = new LanguageSelector({ onChange });

      const button = selector.getElement().querySelector('button') as HTMLButtonElement;
      button.click();

      const dropdown = selector.getElement().children[1];
      const options = dropdown.querySelectorAll('button');
      const arabicOption = Array.from(options).find(o =>
        o.textContent?.includes('Arabic')
      );
      arabicOption?.click();

      expect(onChange).toHaveBeenCalledWith('ar');
    });

    it('should close the dropdown after selecting a language', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;
      button.click();

      const dropdown = selector.getElement().children[1] as HTMLElement;
      const options = dropdown.querySelectorAll('button');
      const arabicOption = Array.from(options).find(o =>
        o.textContent?.includes('Arabic')
      );
      arabicOption?.click();

      // After selecting, the component re-renders. The new dropdown should be hidden.
      const newDropdown = selector.getElement().children[1] as HTMLElement;
      expect(newDropdown.classList.contains('hidden')).toBe(true);
    });

    it('should re-render when language changes externally', () => {
      selector = new LanguageSelector();

      let button = selector.getElement().querySelector('button');
      expect(button?.textContent).toContain('EN');

      i18n.setLanguage('ar');

      button = selector.getElement().querySelector('button');
      expect(button?.textContent).toContain('AR');
    });
  });

  describe('RTL support', () => {
    it('should position dropdown on right side for LTR languages', () => {
      i18n.setLanguage('en');
      selector = new LanguageSelector();

      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.className).toContain('right-0');
    });

    it('should position dropdown on left side for RTL languages', () => {
      i18n.setLanguage('ar');
      selector = new LanguageSelector();

      const dropdown = selector.getElement().children[1] as HTMLElement;
      expect(dropdown.className).toContain('left-0');
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from language changes on destroy', () => {
      selector = new LanguageSelector();
      selector.destroy();

      expect(() => {
        i18n.setLanguage('ar');
      }).not.toThrow();
    });

    it('should remove outside click listener on destroy', () => {
      const removeSpy = jest.spyOn(document, 'removeEventListener');
      selector = new LanguageSelector();
      selector.destroy();

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('no onChange callback', () => {
    it('should not throw when selecting a language without onChange', () => {
      selector = new LanguageSelector();
      const button = selector.getElement().querySelector('button') as HTMLButtonElement;
      button.click();

      const dropdown = selector.getElement().children[1];
      const options = dropdown.querySelectorAll('button');
      const arabicOption = Array.from(options).find(o =>
        o.textContent?.includes('Arabic')
      );

      expect(() => {
        arabicOption?.click();
      }).not.toThrow();
    });
  });
});
