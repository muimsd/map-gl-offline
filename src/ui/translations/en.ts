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
  'regionForm.extraSources': 'Additional Tile Sources',
  'regionForm.extraSourcesInfo':
    'Select extra layers from the map to include in this offline region',
  'regionForm.noExtraSources': 'No additional tile sources found on the map',
  'regionForm.sourceType.vector': 'Vector',
  'regionForm.sourceType.raster': 'Raster',
  'regionForm.sourceType.raster-dem': 'Terrain',
  'regionForm.selectAll': 'Select All',
  'regionForm.deselectAll': 'Deselect All',

  // Region List
  'regionList.empty': 'No offline styles or regions found. Click "Add Region" to get started.',
  'regionList.emptyFallback': 'No offline regions found. Click "Add Region" to get started.',
  'regionList.orphanedHeader': 'Regions without Style',
  'regionList.orphanedDescription': '{{count}} region(s) not associated with any style',
  'regionList.zoom': 'Zoom',
  'regionList.downloaded': 'Downloaded',
  'regionList.size': 'Size',
  'regionList.tiles': 'Tiles',
  'regionList.styleData': 'Style',
  'regionList.totalSize': 'Total',
  'regionList.styleId': 'Style ID',

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

  // MBTiles Modal
  'mbtiles.title': 'MBTiles Import / Export',
  'mbtiles.regionInfo': 'Region Information',
  'mbtiles.id': 'ID',
  'mbtiles.name': 'Name',
  'mbtiles.unnamed': 'Unnamed',
  'mbtiles.zoom': 'Zoom',
  'mbtiles.created': 'Created',
  'mbtiles.exportTitle': 'Export as MBTiles',
  'mbtiles.exportHint':
    'Package the tiles in this region into a standard SQLite MBTiles archive that opens in QGIS, tippecanoe, and other tools.',
  'mbtiles.exportButton': 'Download .mbtiles',
  'mbtiles.preparingExport': 'Preparing export...',
  'mbtiles.exportComplete': 'Export complete!',
  'mbtiles.exportFailed': 'Export failed. Please try again.',
  'mbtiles.importTitle': 'Import from MBTiles',
  'mbtiles.selectFile': 'Select an .mbtiles file',
  'mbtiles.fileHint': 'Only SQLite-format .mbtiles files are supported.',
  'mbtiles.newRegionName': 'New Region Name (optional)',
  'mbtiles.newRegionNamePlaceholder': 'Leave empty to use the name from the file',
  'mbtiles.overwriteIfExists': 'Overwrite if a region with the same id exists',
  'mbtiles.importButton': 'Import .mbtiles',
  'mbtiles.preparingImport': 'Preparing import...',
  'mbtiles.importComplete': 'Import complete!',
  'mbtiles.importFailed': 'Import failed. Please try again.',
  'mbtiles.aboutTitle': 'About MBTiles',
  'mbtiles.aboutBody':
    'MBTiles is a SQLite-based container for map tiles. This exporter produces v1.3-compliant files with TMS tile ordering; the importer reads the same format back into the offline store.',

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
