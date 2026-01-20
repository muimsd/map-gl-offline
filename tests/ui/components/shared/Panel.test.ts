/**
 * Tests for Panel Component
 */

import { Panel, PanelConfig } from '../../../../src/ui/components/shared/Panel';

describe('Panel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should create a panel element', () => {
      const panel = new Panel();
      expect(panel.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should be hidden by default', () => {
      const panel = new Panel();
      expect(panel.getElement().classList.contains('hidden')).toBe(true);
    });

    it('should have proper base classes', () => {
      const panel = new Panel();
      expect(panel.getElement().classList.contains('offline-manager-control')).toBe(true);
      expect(panel.getElement().classList.contains('bg-white')).toBe(true);
      expect(panel.getElement().classList.contains('rounded-2xl')).toBe(true);
    });
  });

  describe('sizes', () => {
    it('should apply small size classes', () => {
      const panel = new Panel({ size: 'sm' });
      expect(panel.getElement().className).toContain('w-[min(80vw,400px)]');
    });

    it('should apply medium size classes by default', () => {
      const panel = new Panel({});
      expect(panel.getElement().className).toContain('w-[min(90vw,600px)]');
    });

    it('should apply large size classes', () => {
      const panel = new Panel({ size: 'lg' });
      expect(panel.getElement().className).toContain('w-[min(95vw,800px)]');
    });

    it('should apply extra large size classes', () => {
      const panel = new Panel({ size: 'xl' });
      expect(panel.getElement().className).toContain('w-[min(98vw,1000px)]');
    });
  });

  describe('positions', () => {
    it('should apply center position classes by default', () => {
      const panel = new Panel({});
      expect(panel.getElement().classList.contains('top-1/2')).toBe(true);
      expect(panel.getElement().classList.contains('left-1/2')).toBe(true);
      expect(panel.getElement().classList.contains('-translate-x-1/2')).toBe(true);
      expect(panel.getElement().classList.contains('-translate-y-1/2')).toBe(true);
    });

    it('should apply top position classes', () => {
      const panel = new Panel({ position: 'top' });
      expect(panel.getElement().classList.contains('top-4')).toBe(true);
    });

    it('should apply bottom position classes', () => {
      const panel = new Panel({ position: 'bottom' });
      expect(panel.getElement().classList.contains('bottom-4')).toBe(true);
    });

    it('should apply left position classes', () => {
      const panel = new Panel({ position: 'left' });
      expect(panel.getElement().classList.contains('left-4')).toBe(true);
    });

    it('should apply right position classes', () => {
      const panel = new Panel({ position: 'right' });
      expect(panel.getElement().classList.contains('right-4')).toBe(true);
    });
  });

  describe('title and closable', () => {
    it('should render title when provided', () => {
      const panel = new Panel({ title: 'Test Panel' });
      const header = panel.getHeader();
      expect(header).not.toBeNull();
      expect(header?.textContent).toContain('Test Panel');
    });

    it('should render close button when closable', () => {
      const onClose = jest.fn();
      const panel = new Panel({ closable: true, onClose });
      const header = panel.getHeader();
      const closeButton = header?.querySelector('button');
      expect(closeButton).not.toBeNull();
    });

    it('should call onClose when close button clicked', () => {
      const onClose = jest.fn();
      const panel = new Panel({ closable: true, onClose });
      const header = panel.getHeader();
      const closeButton = header?.querySelector('button');
      closeButton?.click();
      expect(onClose).toHaveBeenCalled();
    });

    it('should not render header when no title and not closable', () => {
      const panel = new Panel({});
      // Body should be the first child since no header
      const firstChild = panel.getElement().firstElementChild;
      expect(firstChild?.classList.contains('flex-1')).toBe(true);
    });
  });

  describe('setTitle', () => {
    it('should update title text', () => {
      const panel = new Panel({ title: 'Original' });
      panel.setTitle('Updated');
      const header = panel.getHeader();
      expect(header?.textContent).toContain('Updated');
    });

    it('should do nothing if no header exists', () => {
      const panel = new Panel({});
      // Should not throw
      panel.setTitle('Test');
    });
  });

  describe('setBody', () => {
    it('should set string content in body', () => {
      const panel = new Panel();
      panel.setBody('<p>Test content</p>');
      const body = panel.getBody();
      expect(body?.innerHTML).toBe('<p>Test content</p>');
    });

    it('should set HTMLElement content in body', () => {
      const panel = new Panel();
      const p = document.createElement('p');
      p.textContent = 'Test content';
      panel.setBody(p);
      const body = panel.getBody();
      expect(body?.innerHTML).toBe('<p>Test content</p>');
    });
  });

  describe('setFooter', () => {
    it('should set string content in footer', () => {
      const panel = new Panel();
      panel.setFooter('<button>Submit</button>');
      const footer = panel.getFooter();
      expect(footer?.innerHTML).toBe('<button>Submit</button>');
      expect(footer?.classList.contains('hidden')).toBe(false);
    });

    it('should set HTMLElement content in footer', () => {
      const panel = new Panel();
      const button = document.createElement('button');
      button.textContent = 'Submit';
      panel.setFooter(button);
      const footer = panel.getFooter();
      expect(footer?.innerHTML).toBe('<button>Submit</button>');
    });

    it('should hide footer when setting null', () => {
      const panel = new Panel();
      panel.setFooter('Content');
      panel.setFooter(null);
      const footer = panel.getFooter();
      expect(footer?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('open/close', () => {
    it('should show panel on open', () => {
      const panel = new Panel();
      panel.open();
      expect(panel.getElement().classList.contains('hidden')).toBe(false);
    });

    it('should hide panel on close', () => {
      const panel = new Panel();
      panel.open();
      panel.close();
      expect(panel.getElement().classList.contains('hidden')).toBe(true);
    });
  });

  describe('getBody/getHeader/getFooter', () => {
    it('should return body element', () => {
      const panel = new Panel();
      const body = panel.getBody();
      expect(body).toBeInstanceOf(HTMLElement);
      expect(body?.classList.contains('flex-1')).toBe(true);
    });

    it('should return header element when title is set', () => {
      const panel = new Panel({ title: 'Test' });
      const header = panel.getHeader();
      expect(header).toBeInstanceOf(HTMLElement);
    });

    it('should return null for header when not created', () => {
      const panel = new Panel({});
      const header = panel.getHeader();
      expect(header).toBeNull();
    });

    it('should return footer element', () => {
      const panel = new Panel();
      const footer = panel.getFooter();
      expect(footer).toBeInstanceOf(HTMLElement);
    });
  });
});
