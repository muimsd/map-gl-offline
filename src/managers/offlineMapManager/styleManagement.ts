import type {
  EnhancedStyleStats,
  StyleDownloadOptions,
  StyleDownloadResult,
  StyleEntry,
  StyleProvider,
} from '../../types';
import { logger } from '../../utils';

const styleManagementLogger = logger.scope('StyleManagement');

type StyleServiceModule = typeof import('../../services/styleService');
let styleServiceModulePromise: Promise<StyleServiceModule> | null = null;

const loadStyleServiceModule = async (): Promise<StyleServiceModule> => {
  if (!styleServiceModulePromise) {
    styleServiceModulePromise = import('../../services/styleService');
  }
  return styleServiceModulePromise;
};

export interface StyleManagement {
  downloadStyle(
    styleUrl: string,
    options?: StyleDownloadOptions & {
      provider?: StyleProvider;
      accessToken?: string;
      forceProvider?: boolean;
    }
  ): Promise<StyleDownloadResult>;
  loadStyleById(styleId: string): Promise<StyleEntry | null>;
  listStyles(): Promise<StyleEntry[]>;
  deleteStyle(styleId: string): Promise<void>;
  getStyleStats(styleId: string): Promise<EnhancedStyleStats>;
  downloadMapboxStyle(
    styleUrl: string,
    accessToken?: string,
    options?: StyleDownloadOptions
  ): Promise<StyleDownloadResult>;
  downloadMapLibreStyle(
    styleUrl: string,
    options?: StyleDownloadOptions
  ): Promise<StyleDownloadResult>;
  downloadStyleWithAutoDetection(
    styleUrl: string,
    options?: StyleDownloadOptions
  ): Promise<StyleDownloadResult>;
  cleanupOldStyles(maxAgeDays?: number): Promise<number>;
}

export const createStyleManagement = (): StyleManagement => {
  const downloadStyle = async (
    styleUrl: string,
    options: StyleDownloadOptions & {
      provider?: StyleProvider;
      accessToken?: string;
      forceProvider?: boolean;
    } = {}
  ) => {
    const { downloadStyleWithProvider } = await loadStyleServiceModule();
    return downloadStyleWithProvider(styleUrl, options);
  };

  const loadStyleById = async (styleId: string) => {
    const { loadStyleById } = await loadStyleServiceModule();
    return loadStyleById(styleId);
  };

  const listStyles = async () => {
    const { loadStyles } = await loadStyleServiceModule();
    return loadStyles();
  };

  const deleteStyle = async (styleId: string) => {
    const { deleteStyleById } = await loadStyleServiceModule();
    return deleteStyleById(styleId);
  };

  const getStyleStats = async (_styleId: string) => {
    const { getStyleStats } = await loadStyleServiceModule();
    return getStyleStats();
  };

  const downloadMapboxStyle = async (
    styleUrl: string,
    accessToken?: string,
    options: StyleDownloadOptions = {}
  ) =>
    downloadStyle(styleUrl, {
      ...options,
      provider: 'mapbox',
      accessToken,
      forceProvider: true,
    });

  const downloadMapLibreStyle = async (styleUrl: string, options: StyleDownloadOptions = {}) =>
    downloadStyle(styleUrl, {
      ...options,
      provider: 'maplibre',
      forceProvider: true,
    });

  const downloadStyleWithAutoDetection = async (
    styleUrl: string,
    options: StyleDownloadOptions = {}
  ) =>
    downloadStyle(styleUrl, {
      ...options,
      provider: 'auto',
    });

  const cleanupOldStyles = async (maxAgeDays: number = 30) => {
    const { cleanupOldStyles } = await loadStyleServiceModule();
    const cutoffDate = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const result = await cleanupOldStyles({
      maxAge: cutoffDate,
      onProgress: progress => {
        if (progress.completed % 10 === 0 || progress.completed === progress.total) {
          styleManagementLogger.debug(
            `Style cleanup progress: ${progress.completed}/${progress.total}`
          );
        }
      },
    });

    return result.deletedCount;
  };

  return {
    downloadStyle,
    loadStyleById,
    listStyles,
    deleteStyle,
    getStyleStats,
    downloadMapboxStyle,
    downloadMapLibreStyle,
    downloadStyleWithAutoDetection,
    cleanupOldStyles,
  };
};
