/**
 * Tests for PanelActions Component
 */

import { createActionButtons, ActionButtonsProps } from '../../../src/ui/components/PanelActions';

describe('PanelActions', () => {
  describe('createActionButtons', () => {
    it('should create a container element', () => {
      const props: ActionButtonsProps = {};

      const container = createActionButtons(props);

      expect(container).toBeInstanceOf(HTMLDivElement);
    });

    it('should have flex layout class', () => {
      const props: ActionButtonsProps = {};

      const container = createActionButtons(props);

      expect(container.classList.contains('flex')).toBe(true);
    });

    it('should show Add New Region button when onAddRegion is provided', () => {
      const onAddRegion = jest.fn();
      const props: ActionButtonsProps = {
        onAddRegion,
      };

      const container = createActionButtons(props);
      const button = container.querySelector('button');

      expect(button).not.toBeNull();
    });

    it('should call onAddRegion when Add button is clicked', () => {
      const onAddRegion = jest.fn();
      const props: ActionButtonsProps = {
        onAddRegion,
      };

      const container = createActionButtons(props);
      const button = container.querySelector('button');
      button?.click();

      expect(onAddRegion).toHaveBeenCalled();
    });

    it('should show Refresh button when onRefresh is provided', () => {
      const onRefresh = jest.fn();
      const props: ActionButtonsProps = {
        onRefresh,
      };

      const container = createActionButtons(props);

      expect(container.textContent).toContain('Refresh');
    });

    it('should call onRefresh when Refresh button is clicked', () => {
      const onRefresh = jest.fn();
      const props: ActionButtonsProps = {
        onRefresh,
        onAddRegion: undefined,
      };

      const container = createActionButtons(props);
      const button = container.querySelector('button');
      button?.click();

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should show both buttons when both handlers are provided', () => {
      const onAddRegion = jest.fn();
      const onRefresh = jest.fn();
      const props: ActionButtonsProps = {
        onAddRegion,
        onRefresh,
      };

      const container = createActionButtons(props);
      const buttons = container.querySelectorAll('button');

      expect(buttons.length).toBe(2);
    });

    it('should not show Add button when onAddRegion is not provided', () => {
      const props: ActionButtonsProps = {
        onRefresh: jest.fn(),
      };

      const container = createActionButtons(props);

      expect(container.textContent).not.toContain('Add New Region');
    });

    it('should not show Refresh button when onRefresh is not provided', () => {
      const props: ActionButtonsProps = {
        onAddRegion: jest.fn(),
      };

      const container = createActionButtons(props);

      expect(container.textContent).not.toContain('Refresh');
    });

    it('should have no buttons when no handlers are provided', () => {
      const props: ActionButtonsProps = {};

      const container = createActionButtons(props);
      const buttons = container.querySelectorAll('button');

      expect(buttons.length).toBe(0);
    });

    it('should have gap class for button spacing', () => {
      const props: ActionButtonsProps = {
        onAddRegion: jest.fn(),
        onRefresh: jest.fn(),
      };

      const container = createActionButtons(props);

      expect(container.classList.contains('gap-4')).toBe(true);
    });

    it('should have Add New Region text in button', () => {
      const props: ActionButtonsProps = {
        onAddRegion: jest.fn(),
      };

      const container = createActionButtons(props);

      expect(container.textContent).toContain('Add New Region');
    });

    it('should have margin bottom class', () => {
      const props: ActionButtonsProps = {};

      const container = createActionButtons(props);

      expect(container.classList.contains('mb-8')).toBe(true);
    });

    it('should have flex-wrap for responsive layout', () => {
      const props: ActionButtonsProps = {};

      const container = createActionButtons(props);

      expect(container.classList.contains('flex-wrap')).toBe(true);
    });
  });
});
