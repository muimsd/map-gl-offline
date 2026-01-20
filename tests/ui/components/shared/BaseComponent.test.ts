/**
 * Tests for BaseComponent
 */

import { BaseComponent, ComponentConfig } from '../../../../src/ui/components/shared/BaseComponent';

// Concrete implementation for testing
class TestComponent extends BaseComponent {
  public mountCalled = false;
  public unmountCalled = false;
  public updateCalled = false;

  protected createElement(): HTMLElement {
    return document.createElement('div');
  }

  protected async onMount(): Promise<void> {
    this.mountCalled = true;
  }

  protected async onUnmount(): Promise<void> {
    this.unmountCalled = true;
  }

  protected async onUpdate(): Promise<void> {
    this.updateCalled = true;
  }

  // Expose protected methods for testing
  public getEventListeners(): Map<string, EventListener> {
    return this.eventListeners;
  }

  public callRemoveAllEventListeners(): void {
    this.removeAllEventListeners();
  }
}

describe('BaseComponent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should create element with no config', () => {
      const component = new TestComponent();
      expect(component.getElement()).toBeInstanceOf(HTMLElement);
    });

    it('should apply className from config', () => {
      const component = new TestComponent({ className: 'test-class' });
      expect(component.getElement().className).toBe('test-class');
    });

    it('should apply id from config', () => {
      const component = new TestComponent({ id: 'test-id' });
      expect(component.getElement().id).toBe('test-id');
    });

    it('should bind events from config', () => {
      const handler = jest.fn();
      const component = new TestComponent({
        events: { click: handler },
      });

      component.getElement().click();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getElement', () => {
    it('should return the element', () => {
      const component = new TestComponent();
      const element = component.getElement();
      expect(element).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('mount', () => {
    it('should append element to parent', async () => {
      const component = new TestComponent();
      await component.mount(container);
      expect(container.contains(component.getElement())).toBe(true);
    });

    it('should call onMount lifecycle hook', async () => {
      const component = new TestComponent();
      await component.mount(container);
      expect(component.mountCalled).toBe(true);
    });

    it('should not mount twice', async () => {
      const component = new TestComponent();
      await component.mount(container);
      await component.mount(container);
      expect(container.querySelectorAll('div').length).toBe(1);
    });
  });

  describe('unmount', () => {
    it('should remove element from parent', async () => {
      const component = new TestComponent();
      await component.mount(container);
      await component.unmount();
      expect(container.contains(component.getElement())).toBe(false);
    });

    it('should call onUnmount lifecycle hook', async () => {
      const component = new TestComponent();
      await component.mount(container);
      await component.unmount();
      expect(component.unmountCalled).toBe(true);
    });

    it('should not unmount if not mounted', async () => {
      const component = new TestComponent();
      await component.unmount();
      expect(component.unmountCalled).toBe(false);
    });
  });

  describe('update', () => {
    it('should call onUpdate lifecycle hook', async () => {
      const component = new TestComponent();
      await component.update();
      expect(component.updateCalled).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should remove element from parent', () => {
      const component = new TestComponent();
      container.appendChild(component.getElement());
      component.destroy();
      expect(container.contains(component.getElement())).toBe(false);
    });

    it('should remove all event listeners', () => {
      const handler = jest.fn();
      const component = new TestComponent({
        events: { click: handler },
      });
      component.destroy();
      component.getElement().click();
      // After destroy, clicks won't be tracked by our event listener system
      // but the DOM listener might still be there - the point is the map is cleared
      expect(component.getEventListeners().size).toBe(0);
    });
  });

  describe('setContent', () => {
    it('should set string content', () => {
      const component = new TestComponent();
      component.setContent('<span>Test</span>');
      expect(component.getElement().innerHTML).toBe('<span>Test</span>');
    });

    it('should set HTMLElement content', () => {
      const component = new TestComponent();
      const span = document.createElement('span');
      span.textContent = 'Test';
      component.setContent(span);
      expect(component.getElement().innerHTML).toBe('<span>Test</span>');
    });

    it('should replace existing content', () => {
      const component = new TestComponent();
      component.setContent('<span>First</span>');
      component.setContent('<span>Second</span>');
      expect(component.getElement().innerHTML).toBe('<span>Second</span>');
    });
  });

  describe('show/hide/toggle', () => {
    it('should hide element by adding hidden class', () => {
      const component = new TestComponent();
      component.hide();
      expect(component.getElement().classList.contains('hidden')).toBe(true);
    });

    it('should show element by removing hidden class', () => {
      const component = new TestComponent();
      component.hide();
      component.show();
      expect(component.getElement().classList.contains('hidden')).toBe(false);
    });

    it('should toggle visibility', () => {
      const component = new TestComponent();
      component.toggle();
      expect(component.getElement().classList.contains('hidden')).toBe(true);
      component.toggle();
      expect(component.getElement().classList.contains('hidden')).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should track event listeners', () => {
      const handler = jest.fn();
      const component = new TestComponent({
        events: { click: handler },
      });
      expect(component.getEventListeners().size).toBe(1);
    });

    it('should remove all event listeners', () => {
      const handler = jest.fn();
      const component = new TestComponent({
        events: { click: handler },
      });
      component.callRemoveAllEventListeners();
      expect(component.getEventListeners().size).toBe(0);
    });
  });
});
