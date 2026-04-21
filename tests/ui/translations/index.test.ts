/**
 * Tests for the i18n manager (ui/translations).
 */
import { i18n, t } from '../../../src/ui/translations';

describe('i18n translations', () => {
  afterEach(() => {
    // Restore English after each test so siblings aren't left in Arabic.
    i18n.setLanguage('en');
    document.querySelectorAll('.offline-manager-control').forEach(el => el.remove());
  });

  it('translates keys via t()', () => {
    expect(typeof t('app.close')).toBe('string');
  });

  it('returns the current language from getLanguage', () => {
    expect(['en', 'ar']).toContain(i18n.getLanguage());
  });

  it('reports isRTL correctly for English + Arabic', () => {
    i18n.setLanguage('en');
    expect(i18n.isRTL()).toBe(false);
    i18n.setLanguage('ar');
    expect(i18n.isRTL()).toBe(true);
  });

  it('setLanguage persists to localStorage', () => {
    i18n.setLanguage('ar');
    expect(localStorage.getItem('offline-manager-language')).toBe('ar');
    i18n.setLanguage('en');
    expect(localStorage.getItem('offline-manager-language')).toBe('en');
  });

  it('updates document direction on elements with .offline-manager-control when language changes', () => {
    const el = document.createElement('div');
    el.className = 'offline-manager-control';
    document.body.appendChild(el);
    i18n.setLanguage('ar');
    expect(el.getAttribute('dir')).toBe('rtl');
    expect(el.classList.contains('rtl')).toBe(true);
    i18n.setLanguage('en');
    expect(el.getAttribute('dir')).toBe('ltr');
    expect(el.classList.contains('rtl')).toBe(false);
    el.remove();
  });

  it('subscribe returns an unsubscribe function', () => {
    const spy = jest.fn();
    const unsubscribe = i18n.subscribe(spy);
    i18n.setLanguage('ar');
    expect(spy).toHaveBeenCalled();
    spy.mockClear();
    unsubscribe();
    i18n.setLanguage('en');
    expect(spy).not.toHaveBeenCalled();
  });

  it('getAvailableLanguages returns the supported set', () => {
    const langs = i18n.getAvailableLanguages();
    expect(langs.map(l => l.code).sort()).toEqual(['ar', 'en']);
  });

  it('getInstance returns the i18next instance', () => {
    const inst = i18n.getInstance();
    expect(typeof inst.t).toBe('function');
  });
});
