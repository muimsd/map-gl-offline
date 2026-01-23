/**
 * English translations for map-gl-offline
 */

export const en = {
  // General
  'app.title': 'Offline Manager',
  'app.close': 'Close',
  'app.cancel': 'Cancel',
  'app.save': 'Save',
  'app.delete': 'Delete',
  'app.confirm': 'Confirm',
  'app.ok': 'OK',
  'app.loading': 'Loading...',
  'app.error': 'Error',
  'app.success': 'Success',
  'app.warning': 'Warning',
  'app.refresh': 'Refresh',
  'app.details': 'Details',
  'app.focus': 'Focus',

  // Theme
  'theme.toggle': 'Toggle theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',

  // Language
  'language.select': 'Select language',
  'language.en': 'English',
  'language.ar': 'Arabic',

  // Header
  'header.title': 'Offline Manager',
  'header.subtitle': '{{count}} regions • {{size}} total',

  // Actions
  'actions.addRegion': 'Add Region',
  'actions.refresh': 'Refresh',
  'actions.loadStyle': 'Load Style',
  'actions.fixTiles': 'Fix Tiles',
  'actions.deleteStyle': 'Delete Style',
  'actions.redownload': 'Re-download',
  'actions.importExport': 'Import/Export',

  // Region Form
  'regionForm.title': 'Download Offline Region',
  'regionForm.subtitle': 'Selected area: {{area}} km²',
  'regionForm.name': 'Region Name',
  'regionForm.namePlaceholder': 'e.g., Downtown District',
  'regionForm.minZoom': 'Min Zoom',
  'regionForm.maxZoom': 'Max Zoom',
  'regionForm.styleUrl': 'Style URL',
  'regionForm.provider': 'Style Provider',
  'regionForm.providerAuto': 'Auto-detect',
  'regionForm.providerMapbox': 'Mapbox GL (requires access token)',
  'regionForm.providerMaplibre': 'MapLibre GL (open source)',
  'regionForm.providerInfo': 'Auto-detect will analyze the style URL to determine the provider',
  'regionForm.accessToken': 'Mapbox Access Token',
  'regionForm.accessTokenRequired': 'Required',
  'regionForm.accessTokenHelp': 'Get your access token from',
  'regionForm.downloadRegion': 'Download Region',
  'regionForm.area': 'Area',
  'regionForm.bounds': 'Bounds',

  // Region List
  'regionList.empty': 'No offline styles or regions found. Click "Add Region" to get started.',
  'regionList.emptyFallback': 'No offline regions found. Click "Add Region" to get started.',
  'regionList.orphanedHeader': 'Regions without Style',
  'regionList.orphanedDescription': '{{count}} region(s) not associated with any style',
  'regionList.zoom': 'Zoom',
  'regionList.downloaded': 'Downloaded',
  'regionList.size': 'Size',
  'regionList.styleId': 'Style ID',
  'regionList.storedStyleSize': 'Stored Style Size',

  // Region Details
  'regionDetails.title': 'Region Details',
  'regionDetails.focusOnMap': 'Focus on Map',

  // Style
  'style.unnamedStyle': 'Unnamed Style',
  'style.regions': '{{count}} region(s)',

  // Delete Confirmation
  'delete.regionTitle': 'Delete Region',
  'delete.regionMessage':
    'Are you sure you want to delete the region "{{name}}"? This action cannot be undone.',
  'delete.styleTitle': 'Delete Style',
  'delete.styleMessage':
    'Are you sure you want to delete the style "{{name}}"? This action cannot be undone and will affect associated regions.',

  // Re-download
  'redownload.title': 'Re-download Region',
  'redownload.message':
    'Re-download "{{name}}"?\n\nThis will:\n• Delete existing tiles and resources\n• Re-download all data with current settings\n• Fix any corrupted or outdated resources',
  'redownload.button': 'Re-download',

  // Fix Tiles
  'fixTiles.noIssuesTitle': 'No Issues Found',
  'fixTiles.noIssuesMessage':
    'No compressed tiles detected. Your tiles are already in the correct format!',
  'fixTiles.title': 'Fix Compressed Tiles',
  'fixTiles.message':
    "Found {{count}} compressed tiles that may cause rendering errors.\n\nThis will:\n1. Remove all compressed tiles ({{count}} tiles)\n2. You'll need to re-download regions to get properly decompressed tiles\n\nContinue?",
  'fixTiles.button': 'Fix Tiles',
  'fixTiles.completeTitle': 'Cleanup Complete',
  'fixTiles.completeMessage':
    'Successfully removed {{count}} compressed tiles.\n\nPlease re-download your regions to get the fixed tiles.',

  // Download Progress
  'download.active': 'Active Downloads',
  'download.phase.style': 'Style',
  'download.phase.sprites': 'Sprites',
  'download.phase.glyphs': 'Glyphs',
  'download.phase.tiles': 'Tiles',

  // Style Selection
  'styleSelection.title': 'Select Offline Style',
  'styleSelection.message': 'Choose which offline style to load:',
  'styleSelection.sources': 'sources',

  // Import/Export
  'importExport.title': 'Import/Export',
  'importExport.export': 'Export',
  'importExport.import': 'Import',

  // Errors
  'error.loadingContent': 'Error loading content',
  'error.tryAgain': 'Please try again',
  'error.mapNotInitialized':
    'Map is not initialized. Please ensure the map is loaded before loading a style.',
  'error.invalidStyleData': 'Invalid style data. The style may be corrupted.',
  'error.styleMissingSources': 'Style has no sources defined. The style may be incomplete.',
  'error.styleMissingLayers': 'Style has no layers defined. The style may be incomplete.',
  'error.regionNotFound': 'Region not found',
  'error.downloadFailed': 'Download failed',
  'error.deleteFailed': 'Failed to delete',
  'error.loadStyleFailed': 'Failed to load style',

  // Warnings
  'warning.compressedTiles': 'Found {{count}} compressed tiles that may cause rendering issues.',
  'warning.compressedTilesRecommendation':
    'Recommended: Use the "Re-download" button to fix this issue.',
  'warning.continueAnyway': 'Do you want to continue loading the style anyway?',

  // Drawing Tool
  'drawing.instructions': 'Click and drag to draw a region',
  'drawing.cancel': 'Press ESC to cancel',

  // Offline Maps Button
  'button.offlineMaps': 'Offline Maps',

  // Region Details Modal
  'regionDetails.bounds': 'Bounds',
  'regionDetails.zoomRange': 'Zoom Range',
  'regionDetails.created': 'Created',

  // Import/Export Modal
  'importExport.regionTitle': 'Import/Export Region',
  'importExport.regionInfo': 'Region Information',
  'importExport.id': 'ID',
  'importExport.name': 'Name',
  'importExport.unnamed': 'Unnamed',
  'importExport.zoom': 'Zoom',
  'importExport.created': 'Created',
  'importExport.exportRegion': 'Export Region',
  'importExport.exportFormat': 'Export Format',
  'importExport.formatJson': 'JSON - Complete data (recommended)',
  'importExport.formatPmtiles': 'PMTiles - Web optimized tiles',
  'importExport.formatMbtiles': 'MBTiles - Industry standard',
  'importExport.formatHint': 'Choose format based on your use case',
  'importExport.includeComponents': 'Include Components',
  'importExport.styleConfig': 'Style Configuration',
  'importExport.mapTiles': 'Map Tiles',
  'importExport.spritesIcons': 'Sprites & Icons',
  'importExport.fontsGlyphs': 'Fonts & Glyphs',
  'importExport.preparingExport': 'Preparing export...',
  'importExport.exportComplete': 'Export complete!',
  'importExport.exportFailed': 'Export failed. Please try again.',
  'importExport.importRegion': 'Import Region',
  'importExport.selectFile': 'Select File',
  'importExport.fileFormatsHint': 'Supports JSON, PMTiles, and MBTiles formats',
  'importExport.newRegionName': 'New Region Name (Optional)',
  'importExport.newRegionNamePlaceholder': 'Leave empty to use original name',
  'importExport.overwriteIfExists': 'Overwrite if region exists',
  'importExport.preparingImport': 'Preparing import...',
  'importExport.importComplete': 'Import complete!',
  'importExport.importFailed': 'Import failed. Please try again.',
  'importExport.formatGuide': 'Format Guide',
  'importExport.jsonDesc': 'Complete data, human-readable, best for development',
  'importExport.pmtilesDesc': 'Web-optimized, efficient serving, cloud-friendly',
  'importExport.mbtilesDesc': 'Industry standard, SQLite-based, cross-platform',

  // Active Downloads
  'download.activeCount': 'Active Downloads ({{count}})',

  // Panel Manager additional strings
  'panel.downloadedRegions': 'Downloaded Regions',
  'panel.noExpiry': 'No expiry',
  'panel.noBounds': 'No bounds',
  'panel.sources': 'sources',

  // Empty/Error States
  'emptyState.title': 'No items',
  'emptyState.message': 'There are no items to display',
  'errorState.message': 'Something went wrong',
  'errorState.retry': 'Try Again',

  // List
  'list.empty': 'No items to display',
  'list.noItemsFound': 'No items found',

  // Toast
  'toast.dismiss': 'Dismiss notification',

  // Control Buttons
  'control.offlineMapManager': 'Offline Map Manager',
  'control.cancelSelection': 'Cancel Selection',
  'control.saveSelectedRegion': 'Save Selected Region',

  // Alerts/Messages
  'alert.unknownError': 'Unknown error occurred',
  'alert.downloadNotImplemented': 'Download feature not implemented in this refactored version',
  'alert.mapNotAvailable': 'Map not available',
  'alert.invalidBounds': 'Invalid bounds for region',
  'alert.styleNotFound': 'Style not found',
  'alert.noStylesFound': 'No styles found in IndexedDB',
  'alert.failedToApplyStyle': 'Failed to apply style to map',
  'alert.failedToLoadStyle': 'Failed to load style',
  'alert.failedToRedownload': 'Failed to re-download region',
  'alert.downloadManagerNotAvailable': 'Download manager not available',

  // Download Manager
  'downloadManager.downloadingStyle': 'Downloading style',
  'downloadManager.downloadingSprites': 'Downloading sprites',
  'downloadManager.downloadingGlyphs': 'Downloading glyphs',
  'downloadManager.downloadingTiles': 'Downloading tiles',
  'downloadManager.styleExistsNotFound': 'Style exists but could not be found',
  'downloadManager.styleNotFoundForResources': 'Style not found for resource download',
  'downloadManager.styleNotFoundForTiles': 'Style not found for tile download',
  'downloadManager.styleNoSources': 'Style does not contain any sources for tile download',

  // Form Validation
  'validation.required': 'This field is required',
  'validation.invalidFormat': 'Invalid format',
  'validation.mustBeNumber': 'Must be a number',
  'validation.mustBeWholeNumber': 'Must be a whole number',
  'validation.invalidUrl': 'Invalid URL format',
} as const;
