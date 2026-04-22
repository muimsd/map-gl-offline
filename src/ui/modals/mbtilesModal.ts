/**
 * MBTiles Import/Export Modal
 *
 * Focused modal for exchanging regions as binary SQLite MBTiles archives.
 * Replaces the previous multi-format import/export modal.
 */

import { Modal, ModalConfig } from '@/ui/components/shared/Modal';
import { Button } from '@/ui/components/shared/Button';
import { icons } from '@/utils/icons';
import { logger } from '@/utils/logger';
import { escapeHtml } from '@/utils/formatting';
import { t, i18n } from '@/ui/translations';
import type {
  StoredRegion,
  ImportExportOptions,
  MBTilesExportOptions,
  ExportResult,
  ImportResult,
  RegionImportData,
} from '@/types';

type MBTilesExportRequestOptions = ImportExportOptions & MBTilesExportOptions;

const modalLogger = logger.scope('MBTilesModal');

export interface MBTilesModalOptions {
  region: StoredRegion;
  onClose: () => void;
  onExport?: (result: ExportResult) => void;
  onImport?: (result: ImportResult) => void;
  exportRegion?: (regionId: string, options?: MBTilesExportRequestOptions) => Promise<ExportResult>;
  importRegion?: (data: RegionImportData) => Promise<ImportResult>;
}

export class MBTilesModal {
  private modal?: Modal;
  private options: MBTilesModalOptions;
  private isExporting = false;
  private isImporting = false;

  private exportProgressBar?: HTMLDivElement;
  private exportProgressText?: HTMLParagraphElement;
  private exportProgressContainer?: HTMLDivElement;
  private exportButton?: HTMLButtonElement;

  private importFileInput?: HTMLInputElement;
  private importNameInput?: HTMLInputElement;
  private importOverwriteCheckbox?: HTMLInputElement;
  private importProgressBar?: HTMLDivElement;
  private importProgressText?: HTMLParagraphElement;
  private importProgressContainer?: HTMLDivElement;
  private importButton?: HTMLButtonElement;

  constructor(options: MBTilesModalOptions) {
    this.options = options;
  }

  public show(): HTMLDivElement {
    const modalConfig: ModalConfig = {
      title: t('mbtiles.title'),
      subtitle: this.options.region.name || this.options.region.id,
      size: 'md',
      closable: true,
      onClose: () => this.hide(),
    };

    this.modal = new Modal(modalConfig);
    this.modal.setContent(this.createContent());
    this.modal.setFooter(this.createFooter());
    this.modal.show();
    this.attachEventListeners();

    return this.modal.getElement() as HTMLDivElement;
  }

  public hide(): void {
    this.modal?.hide();
    this.options.onClose();
  }

  public destroy(): void {
    this.modal?.destroy();
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'flex flex-col gap-6 py-2';
    if (i18n.isRTL()) {
      content.setAttribute('dir', 'rtl');
    }

    content.appendChild(this.createRegionInfoLine());
    content.appendChild(this.createExportSection());
    content.appendChild(this.createImportSection());

    return content;
  }

  private createRegionInfoLine(): HTMLElement {
    const { region } = this.options;
    const line = document.createElement('div');
    line.className =
      'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400';
    line.innerHTML = `
      <span class="flex items-center gap-1">
        ${icons.mapPin({ size: 12, color: 'currentColor' })}
        <span class="font-mono">${escapeHtml(region.id)}</span>
      </span>
      <span>Z${escapeHtml(region.minZoom)}-${escapeHtml(region.maxZoom)}</span>
      <span>${new Date(region.created).toLocaleDateString()}</span>
    `;
    return line;
  }

  private createExportSection(): HTMLElement {
    const section = this.createSection(
      t('mbtiles.exportTitle'),
      'blue',
      icons.download({ size: 20, color: 'currentColor' })
    );

    const form = document.createElement('div');
    form.className = 'space-y-5';

    const hint = document.createElement('p');
    hint.className = 'text-sm text-gray-600 dark:text-gray-400';
    hint.textContent = t('mbtiles.exportHint');
    form.appendChild(hint);

    // Progress (hidden by default)
    const progress = this.createProgressBlock('blue', t('mbtiles.preparingExport'));
    this.exportProgressContainer = progress.container;
    this.exportProgressBar = progress.bar;
    this.exportProgressText = progress.text;
    form.appendChild(progress.container);

    const exportBtn = new Button({
      text: t('mbtiles.exportButton'),
      variant: 'primary',
      icon: icons.download({ size: 16, color: 'white' }),
      className: 'w-full py-2.5 text-base shadow-lg shadow-blue-500/20',
      onClick: () => this.handleExport(),
    });
    this.exportButton = exportBtn.getElement() as HTMLButtonElement;
    form.appendChild(this.exportButton);

    section.appendChild(form);
    return section;
  }

  private createImportSection(): HTMLElement {
    const section = this.createSection(
      t('mbtiles.importTitle'),
      'green',
      icons.upload({ size: 20, color: 'currentColor' })
    );

    const form = document.createElement('div');
    form.className = 'space-y-5';

    // File input
    const fileGroup = document.createElement('div');
    const fileLabel = document.createElement('label');
    fileLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
    fileLabel.textContent = t('mbtiles.selectFile');

    this.importFileInput = document.createElement('input');
    this.importFileInput.type = 'file';
    this.importFileInput.accept = '.mbtiles,application/vnd.sqlite3,application/x-sqlite3';
    this.importFileInput.className =
      'w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-400 glass-input transition-all cursor-pointer';

    const fileHint = document.createElement('p');
    fileHint.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 ml-1';
    fileHint.textContent = t('mbtiles.fileHint');

    fileGroup.appendChild(fileLabel);
    fileGroup.appendChild(this.importFileInput);
    fileGroup.appendChild(fileHint);
    form.appendChild(fileGroup);

    // New region name
    const nameGroup = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
    nameLabel.textContent = t('mbtiles.newRegionName');

    this.importNameInput = document.createElement('input');
    this.importNameInput.type = 'text';
    this.importNameInput.placeholder = t('mbtiles.newRegionNamePlaceholder');
    this.importNameInput.className =
      'w-full px-4 py-3 rounded-xl text-sm glass-input text-gray-900 dark:text-white bg-white/50 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all';

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(this.importNameInput);
    form.appendChild(nameGroup);

    // Overwrite toggle
    const overwriteLabel = document.createElement('label');
    overwriteLabel.className =
      'flex items-center gap-3 p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors';

    this.importOverwriteCheckbox = document.createElement('input');
    this.importOverwriteCheckbox.type = 'checkbox';
    this.importOverwriteCheckbox.className =
      'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 focus:ring-2 dark:bg-gray-700';

    const overwriteSpan = document.createElement('span');
    overwriteSpan.className = 'text-sm text-gray-700 dark:text-gray-300 font-medium';
    overwriteSpan.textContent = t('mbtiles.overwriteIfExists');

    overwriteLabel.appendChild(this.importOverwriteCheckbox);
    overwriteLabel.appendChild(overwriteSpan);
    form.appendChild(overwriteLabel);

    // Progress
    const progress = this.createProgressBlock('green', t('mbtiles.preparingImport'));
    this.importProgressContainer = progress.container;
    this.importProgressBar = progress.bar;
    this.importProgressText = progress.text;
    form.appendChild(progress.container);

    // Import button (disabled until a file is selected)
    const importBtn = new Button({
      text: t('mbtiles.importButton'),
      variant: 'success',
      icon: icons.upload({ size: 16, color: 'white' }),
      className: 'w-full py-2.5 text-base shadow-lg shadow-green-500/20',
      disabled: true,
      onClick: () => this.handleImport(),
    });
    this.importButton = importBtn.getElement() as HTMLButtonElement;
    form.appendChild(this.importButton);

    section.appendChild(form);
    return section;
  }

  private createSection(
    title: string,
    accentColor: 'blue' | 'green',
    iconHtml: string
  ): HTMLElement {
    const section = document.createElement('div');
    section.className =
      'glass-input p-6 rounded-xl border-0 bg-white/40 dark:bg-gray-800/40 relative overflow-hidden';

    const accent = document.createElement('div');
    accent.className = `absolute top-0 ${i18n.isRTL() ? 'right-0' : 'left-0'} w-1 h-full bg-${accentColor}-500 opacity-50`;
    section.appendChild(accent);

    const header = document.createElement('h3');
    header.className =
      'text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2.5';
    header.innerHTML = `
      <div class="p-2 bg-${accentColor}-500/10 rounded-lg text-${accentColor}-600 dark:text-${accentColor}-400">
        ${iconHtml}
      </div>
      ${title}
    `;
    section.appendChild(header);

    return section;
  }

  private createProgressBlock(
    accentColor: 'blue' | 'green',
    initialText: string
  ): { container: HTMLDivElement; bar: HTMLDivElement; text: HTMLParagraphElement } {
    const container = document.createElement('div');
    container.className = 'hidden';

    const barWrap = document.createElement('div');
    barWrap.className = 'bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden';
    const bar = document.createElement('div');
    bar.className = `bg-${accentColor}-600 h-2 rounded-full transition-all duration-300`;
    bar.style.width = '0%';
    barWrap.appendChild(bar);

    const text = document.createElement('p');
    text.className = 'text-sm text-gray-600 dark:text-gray-400';
    text.textContent = initialText;

    container.appendChild(barWrap);
    container.appendChild(text);

    return { container, bar, text };
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    if (i18n.isRTL()) {
      footer.setAttribute('dir', 'rtl');
    }

    const close = new Button({
      text: t('app.close'),
      variant: 'secondary',
      onClick: () => this.hide(),
    });
    footer.appendChild(close.getElement());

    return footer;
  }

  private attachEventListeners(): void {
    if (this.importFileInput && this.importButton) {
      this.importFileInput.addEventListener('change', () => {
        const hasFile = !!(this.importFileInput?.files && this.importFileInput.files.length > 0);
        if (this.importButton) this.importButton.disabled = !hasFile;
      });
    }
  }

  private async handleExport(): Promise<void> {
    if (this.isExporting || !this.options.exportRegion) return;

    this.isExporting = true;
    if (this.exportButton) this.exportButton.disabled = true;
    this.exportProgressContainer?.classList.remove('hidden');

    try {
      const result = await this.options.exportRegion(this.options.region.id, {
        onProgress: p => {
          if (this.exportProgressBar) this.exportProgressBar.style.width = `${p.percentage}%`;
          if (this.exportProgressText) this.exportProgressText.textContent = p.message;
        },
      });

      if (this.exportProgressBar) this.exportProgressBar.style.width = '100%';
      if (this.exportProgressText)
        this.exportProgressText.textContent = t('mbtiles.exportComplete');

      this.options.onExport?.(result);
      setTimeout(() => this.hide(), 1200);
    } catch (error) {
      modalLogger.error('Export error:', error instanceof Error ? error.message : String(error));
      if (this.exportProgressText) {
        this.exportProgressText.textContent = t('mbtiles.exportFailed');
        this.exportProgressText.classList.add('text-red-600', 'dark:text-red-400');
      }
    } finally {
      this.isExporting = false;
      if (this.exportButton) this.exportButton.disabled = false;
    }
  }

  private async handleImport(): Promise<void> {
    if (this.isImporting || !this.options.importRegion) return;
    const file = this.importFileInput?.files?.[0];
    if (!file) return;

    this.isImporting = true;
    if (this.importButton) this.importButton.disabled = true;
    this.importProgressContainer?.classList.remove('hidden');

    try {
      const data: RegionImportData = {
        file,
        format: 'mbtiles',
        overwrite: this.importOverwriteCheckbox?.checked ?? false,
        newRegionName: this.importNameInput?.value.trim() || undefined,
        onProgress: p => {
          if (this.importProgressBar) this.importProgressBar.style.width = `${p.percentage}%`;
          if (this.importProgressText) this.importProgressText.textContent = p.message;
        },
      };

      const result = await this.options.importRegion(data);

      if (this.importProgressBar) this.importProgressBar.style.width = '100%';
      if (this.importProgressText) {
        this.importProgressText.textContent = result.success
          ? t('mbtiles.importComplete')
          : result.message;
        if (!result.success) {
          this.importProgressText.classList.add('text-red-600', 'dark:text-red-400');
        }
      }

      this.options.onImport?.(result);
      if (result.success) setTimeout(() => this.hide(), 1200);
    } catch (error) {
      modalLogger.error('Import error:', error instanceof Error ? error.message : String(error));
      if (this.importProgressText) {
        this.importProgressText.textContent = t('mbtiles.importFailed');
        this.importProgressText.classList.add('text-red-600', 'dark:text-red-400');
      }
    } finally {
      this.isImporting = false;
      if (this.importButton) this.importButton.disabled = false;
    }
  }
}
