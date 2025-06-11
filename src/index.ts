// Main library exports for npm package
export { OfflineMapManager } from './managers/offlineMapManager';

// Export all services (replacing old managers)
export * from './services/tileService';
export * from './services/fontService';
export * from './services/glyphService';
export * from './services/spriteService';
export * from './services/cleanupService';
export * from './managers/styleManager'; // Keep style manager as it's already refactored

// Export services
export * from './services/regionService';
export * from './services/resourceService';
export * from './services/analyticsService';
export * from './services/maintenanceService';
export * from './services/importExportService';

// Export storage utilities
export * from './storage/indexedDbManager';

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Default export for convenience
export { OfflineMapManager as default } from './managers/offlineMapManager';

// Export UI controls
export { OfflineManagerControl } from './ui/OfflineManagerControl';
