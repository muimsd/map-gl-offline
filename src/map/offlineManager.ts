/**
 * Offline Map Manager for MapLibre GL JS
 * 
 * This file provides backwards compatibility exports for the refactored offline map manager.
 * The implementation has been moved to a service-based architecture for better maintainability.
 * 
 * @deprecated This file serves as a compatibility layer. 
 * Use the new OfflineMapManager from '../managers/offlineMapManager' for new projects.
 */

// Export the new manager for current and future use
export { OfflineMapManager } from '../managers/offlineMapManager';
