/**
 * Live download progress in the panel.
 */
jest.mock('../../../src/ui/ThemeManager', () => ({
  themeManager: { getTheme: () => ({ mode: 'light' }), subscribe: jest.fn(), cycleTheme: jest.fn() },
}));

import { PanelRenderer as PanelManager } from '../../../src/ui/managers/PanelManager';

type Internals = {
  element: HTMLElement;
  downloadProgressContainer?: HTMLElement;
  refresh: () => Promise<void>;
  updateDownloadProgress: (downloads: Map<string, unknown>) => void;
};

const makePanel = () => {
  const panel = Object.create(PanelManager.prototype) as Internals;
  panel.element = document.createElement('div');
  document.body.appendChild(panel.element);
  panel.refresh = jest.fn(async () => {});
  return panel;
};

const tiles = (completed: number, percentage: number) =>
  new Map([
    [
      'r',
      { regionId: 'r', regionName: 'Dubai', phase: 'tiles', completed, total: 128, percentage },
    ],
  ]);

describe('PanelManager.updateDownloadProgress', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('redraws the progress section with each update', () => {
    const panel = makePanel();
    const container = document.createElement('div');
    panel.element.appendChild(container);
    panel.downloadProgressContainer = container;

    panel.updateDownloadProgress(tiles(32, 47));
    expect(container.textContent).toContain('47%');
    expect(container.textContent).toContain('32');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '47'
    );

    panel.updateDownloadProgress(tiles(64, 64));
    expect(container.textContent).toContain('64%');
    expect(container.textContent).not.toContain('47%');
    expect(panel.refresh).not.toHaveBeenCalled();
  });

  it('says tiles are being planned until their total is known', () => {
    const panel = makePanel();
    const container = document.createElement('div');
    panel.element.appendChild(container);
    panel.downloadProgressContainer = container;

    panel.updateDownloadProgress(
      new Map([['r', { regionName: 'Dubai', phase: 'tiles', completed: 0, total: 0, percentage: 30 }]])
    );
    expect(container.textContent).not.toContain('0 of');
  });

  it('asks for one full render when an open panel has no progress section yet', () => {
    const panel = makePanel();
    panel.updateDownloadProgress(tiles(1, 31));
    panel.updateDownloadProgress(tiles(2, 32));
    expect(panel.refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the panel is closed', () => {
    const panel = makePanel();
    panel.element.remove();
    panel.updateDownloadProgress(tiles(1, 31));
    expect(panel.refresh).not.toHaveBeenCalled();
  });

  it('ignores an empty update', () => {
    const panel = makePanel();
    panel.updateDownloadProgress(new Map());
    expect(panel.refresh).not.toHaveBeenCalled();
  });

  it('cancels a download from its row, including after the row is redrawn', async () => {
    const panel = makePanel() as Internals & {
      downloadManager: unknown;
      renderDownloadProgress: () => Promise<void>;
    };
    const cancelDownload = jest.fn();
    panel.downloadManager = {
      hasActiveDownloads: () => true,
      getCurrentDownloads: () => tiles(8, 20),
      cancelDownload,
    };
    await panel.renderDownloadProgress();
    panel.updateDownloadProgress(tiles(16, 30)); // redraws the rows

    const cancel = panel.element.querySelector<HTMLButtonElement>(
      '[data-action="cancel-download"]'
    );
    expect(cancel?.getAttribute('aria-label')).toBe('Cancel downloading Dubai');
    cancel?.click();

    expect(cancelDownload).toHaveBeenCalledWith('r');
    expect(panel.refresh).toHaveBeenCalled();
  });
});
