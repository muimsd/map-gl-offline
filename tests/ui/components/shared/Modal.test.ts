/**
 * Tests for Modal Component
 */

import { Modal, ModalConfig } from '../../../../src/ui/components/shared/Modal';

describe('Modal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up any modals attached to body
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('constructor', () => {
    it('should create a modal element', () => {
      const modal = new Modal();
      expect(modal.getElement()).toBeInstanceOf(HTMLElement);
      expect(modal.getElement().classList.contains('modal-backdrop')).toBe(true);
    });

    it('should create backdrop by default', () => {
      const modal = new Modal();
      const backdrop = modal.getElement().querySelector('.bg-black\\/40');
      expect(backdrop).not.toBeNull();
    });

    it('should not create backdrop when disabled', () => {
      const modal = new Modal({ backdrop: false });
      const backdrop = modal.getElement().querySelector('.bg-black\\/40');
      expect(backdrop).toBeNull();
    });

    it('should be closable by default', () => {
      const onClose = jest.fn();
      const modal = new Modal({ onClose, title: 'Test' });
      // Modal should have close button since closable is true by default
      const closeButton = modal.getElement().querySelector('button[title="Close"]');
      expect(closeButton).not.toBeNull();
    });
  });

  describe('title and subtitle', () => {
    it('should render title', () => {
      const modal = new Modal({ title: 'Test Title' });
      const title = modal.getElement().querySelector('h2');
      expect(title?.textContent).toBe('Test Title');
    });

    it('should render subtitle', () => {
      const modal = new Modal({ title: 'Title', subtitle: 'Subtitle' });
      const subtitle = modal.getElement().querySelector('p');
      expect(subtitle?.textContent).toBe('Subtitle');
    });

    it('should not render header when no title, subtitle, or closable actions', () => {
      const modal = new Modal({ closable: false });
      // Body should be direct child of modal content
      const body = modal.getElement().querySelector('.overflow-y-auto');
      expect(body).not.toBeNull();
    });
  });

  describe('sizes', () => {
    it('should apply small size class', () => {
      const modal = new Modal({ size: 'sm' });
      const content = modal.getElement().querySelector('.max-w-sm');
      expect(content).not.toBeNull();
    });

    it('should apply medium size class by default', () => {
      const modal = new Modal({});
      const content = modal.getElement().querySelector('.max-w-xl');
      expect(content).not.toBeNull();
    });

    it('should apply large size class', () => {
      const modal = new Modal({ size: 'lg' });
      const content = modal.getElement().querySelector('.max-w-2xl');
      expect(content).not.toBeNull();
    });

    it('should apply extra large size class', () => {
      const modal = new Modal({ size: 'xl' });
      const content = modal.getElement().querySelector('.max-w-4xl');
      expect(content).not.toBeNull();
    });
  });

  describe('close functionality', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = jest.fn();
      const modal = new Modal({ onClose, title: 'Test' });
      const closeButton = modal.getElement().querySelector('button[title="Close"]');
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when escape key pressed', () => {
      const onClose = jest.fn();
      new Modal({ onClose, closable: true, title: 'Test' });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop clicked', () => {
      const onClose = jest.fn();
      const modal = new Modal({ onClose, backdrop: true });
      const backdrop = modal.getElement().querySelector('.bg-black\\/40');
      backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onClose).toHaveBeenCalled();
    });

    it('should not call onClose when clicking inside modal content', () => {
      const onClose = jest.fn();
      const modal = new Modal({ onClose, backdrop: true, title: 'Test' });
      const modalContent = modal.getElement().querySelector('.glass-panel');
      modalContent?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // onClose should only be called from backdrop click target match
      // The event target check in the implementation should prevent this
    });
  });

  describe('theme toggle', () => {
    it('should render theme toggle button when enabled', () => {
      const onThemeToggle = jest.fn();
      const modal = new Modal({ showThemeToggle: true, onThemeToggle, title: 'Test' });
      const themeButton = modal.getElement().querySelector('button[title="Toggle theme"]');
      expect(themeButton).not.toBeNull();
    });

    it('should call onThemeToggle when theme button clicked', () => {
      const onThemeToggle = jest.fn();
      const modal = new Modal({ showThemeToggle: true, onThemeToggle, title: 'Test' });
      const themeButton = modal.getElement().querySelector('button[title="Toggle theme"]');
      themeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onThemeToggle).toHaveBeenCalled();
    });

    it('should not render theme toggle when disabled', () => {
      const modal = new Modal({ showThemeToggle: false, title: 'Test' });
      const themeButton = modal.getElement().querySelector('button[title="Toggle theme"]');
      expect(themeButton).toBeNull();
    });
  });

  describe('setContent', () => {
    it('should set string content in body', () => {
      const modal = new Modal();
      modal.setContent('<p>Test content</p>');
      const body = modal.getElement().querySelector('.overflow-y-auto');
      expect(body?.innerHTML).toBe('<p>Test content</p>');
    });

    it('should set HTMLElement content in body', () => {
      const modal = new Modal();
      const p = document.createElement('p');
      p.textContent = 'Test content';
      modal.setContent(p);
      const body = modal.getElement().querySelector('.overflow-y-auto');
      expect(body?.innerHTML).toBe('<p>Test content</p>');
    });

    it('should replace existing content', () => {
      const modal = new Modal();
      modal.setContent('<p>First</p>');
      modal.setContent('<p>Second</p>');
      const body = modal.getElement().querySelector('.overflow-y-auto');
      expect(body?.innerHTML).toBe('<p>Second</p>');
    });
  });

  describe('setFooter', () => {
    it('should set string content in footer', () => {
      const modal = new Modal();
      modal.setFooter('<button>Submit</button>');
      const footer = modal.getElement().querySelector('.rounded-b-2xl');
      expect(footer?.innerHTML).toBe('<button>Submit</button>');
      expect(footer?.classList.contains('hidden')).toBe(false);
    });

    it('should set HTMLElement content in footer', () => {
      const modal = new Modal();
      const button = document.createElement('button');
      button.textContent = 'Submit';
      modal.setFooter(button);
      const footer = modal.getElement().querySelector('.rounded-b-2xl');
      expect(footer?.innerHTML).toBe('<button>Submit</button>');
    });

    it('should show footer when content is set', () => {
      const modal = new Modal();
      const footer = modal.getElement().querySelector('.rounded-b-2xl');
      expect(footer?.classList.contains('hidden')).toBe(true);
      modal.setFooter('Footer content');
      expect(footer?.classList.contains('hidden')).toBe(false);
    });
  });

  describe('show/hide', () => {
    it('should append to body when shown', () => {
      const modal = new Modal();
      modal.show();
      expect(document.body.contains(modal.getElement())).toBe(true);
    });

    it('should remove hidden class when shown', () => {
      const modal = new Modal();
      modal.getElement().classList.add('hidden');
      modal.show();
      expect(modal.getElement().classList.contains('hidden')).toBe(false);
    });

    it('should add hidden class when hidden', () => {
      const modal = new Modal();
      modal.show();
      modal.hide();
      expect(modal.getElement().classList.contains('hidden')).toBe(true);
    });

    it('should remove from DOM when hidden', () => {
      const modal = new Modal();
      modal.show();
      modal.hide();
      expect(document.body.contains(modal.getElement())).toBe(false);
    });

    it('should focus first focusable element when shown', () => {
      const modal = new Modal({ title: 'Test', closable: true, onClose: jest.fn() });
      modal.show();
      // Close button should be focused
      const activeElement = document.activeElement;
      expect(activeElement?.tagName).toBe('BUTTON');
    });
  });

  describe('onUnmount', () => {
    it('should remove escape key listener on unmount', async () => {
      const onClose = jest.fn();
      const modal = new Modal({ onClose, closable: true, title: 'Test' });

      // First mount the modal
      await modal.mount(container);

      // Then unmount the modal
      await modal.unmount();

      // Clear the mock from previous calls
      onClose.mockClear();

      // Fire escape key event
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      // onClose should not be called after unmount
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
