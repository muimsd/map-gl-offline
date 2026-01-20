/**
 * Tests for PanelHeader Component
 */

import { createHeader, HeaderProps } from '../../../src/ui/components/PanelHeader';

describe('PanelHeader', () => {
  describe('createHeader', () => {
    it('should create a header element', () => {
      const props: HeaderProps = {
        title: 'Test Title',
        subtitle: 'Test Subtitle',
      };

      const header = createHeader(props);

      expect(header).toBeInstanceOf(HTMLDivElement);
    });

    it('should display the title', () => {
      const props: HeaderProps = {
        title: 'My Title',
        subtitle: 'My Subtitle',
      };

      const header = createHeader(props);

      expect(header.textContent).toContain('My Title');
    });

    it('should display the subtitle', () => {
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle Text',
      };

      const header = createHeader(props);

      expect(header.textContent).toContain('Subtitle Text');
    });

    it('should have close button when onClose is provided', () => {
      const onClose = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        onClose,
      };

      const header = createHeader(props);
      const buttons = header.querySelectorAll('button');

      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        onClose,
        showThemeToggle: false,
      };

      const header = createHeader(props);
      const button = header.querySelector('button');
      button?.click();

      expect(onClose).toHaveBeenCalled();
    });

    it('should have theme toggle button when showThemeToggle is true', () => {
      const onThemeToggle = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        showThemeToggle: true,
        onThemeToggle,
      };

      const header = createHeader(props);
      const buttons = header.querySelectorAll('button');

      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should call onThemeToggle when theme button is clicked', () => {
      const onThemeToggle = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        showThemeToggle: true,
        onThemeToggle,
        onClose: undefined,
      };

      const header = createHeader(props);
      const button = header.querySelector('button');
      button?.click();

      expect(onThemeToggle).toHaveBeenCalled();
    });

    it('should support onToggleTheme as alternative to onThemeToggle', () => {
      const onToggleTheme = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        showThemeToggle: true,
        onToggleTheme,
        onClose: undefined,
      };

      const header = createHeader(props);
      const button = header.querySelector('button');
      button?.click();

      expect(onToggleTheme).toHaveBeenCalled();
    });

    it('should not show theme toggle when showThemeToggle is false', () => {
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        showThemeToggle: false,
        onClose: undefined,
      };

      const header = createHeader(props);
      const buttons = header.querySelectorAll('button');

      expect(buttons.length).toBe(0);
    });

    it('should have gradient background class', () => {
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
      };

      const header = createHeader(props);

      expect(header.classList.contains('bg-gradient-to-br')).toBe(true);
    });

    it('should have both theme and close buttons when both are provided', () => {
      const onClose = jest.fn();
      const onThemeToggle = jest.fn();
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Subtitle',
        onClose,
        onThemeToggle,
        showThemeToggle: true,
      };

      const header = createHeader(props);
      const buttons = header.querySelectorAll('button');

      expect(buttons.length).toBe(2);
    });

    it('should have h1 element for title', () => {
      const props: HeaderProps = {
        title: 'Header Title',
        subtitle: 'Subtitle',
      };

      const header = createHeader(props);
      const h1 = header.querySelector('h1');

      expect(h1).not.toBeNull();
      expect(h1?.textContent).toContain('Header Title');
    });

    it('should have p element for subtitle', () => {
      const props: HeaderProps = {
        title: 'Title',
        subtitle: 'Header Subtitle',
      };

      const header = createHeader(props);
      const p = header.querySelector('p');

      expect(p).not.toBeNull();
      expect(p?.textContent).toContain('Header Subtitle');
    });
  });
});
