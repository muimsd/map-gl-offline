// Test file to demonstrate enhanced tile downloader features
import { 
  downloadTiles, 
  getTileStats, 
  cleanupOldTiles, 
  verifyAndRepairTiles,
  getTileAnalytics 
} from './src/map/tileDownloader.js';

// Example usage of enhanced tile downloader
async function testEnhancedTileDownloader() {
  console.log('Testing Enhanced Tile Downloader...');
  
  // Sample region and style
  const region = {
    id: 'test-region',
    bounds: [[-74.0, 40.7], [-73.9, 40.8]], // NYC area
    minZoom: 10,
    maxZoom: 14
  };
  
  const sampleStyle = {
    sources: {
      'vector-tiles': {
        url: {
          tiles: ['https://tiles.example.com/{z}/{x}/{y}.mvt']
        }
      }
    }
  };
  
  // Enhanced download options
  const downloadOptions = {
    batchSize: 20,
    maxRetries: 3,
    skipExisting: true,
    maxConcurrency: 10,
    retryDelay: 1000,
    timeout: 30000,
    validateTiles: true,
    priorityZoomLevels: [12, 13], // Download these zoom levels first
    bandwidthLimit: 500, // 500 KB/s limit
    storageQuotaCheck: true,
    onProgress: (progress) => {
      console.log(`Download Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
      if (progress.currentItem) {
        console.log(`Current: ${progress.currentItem}`);
      }
      if (progress.errors.length > 0) {
        console.log(`Errors: ${progress.errors.length}`);
      }
    }
  };
  
  try {
    // 1. Download tiles with enhanced options
    console.log('\n=== Starting Enhanced Tile Download ===');
    const downloadResult = await downloadTiles(region, sampleStyle, 'test-style', downloadOptions);
    
    console.log('\n=== Download Results ===');
    console.log(`Total tiles: ${downloadResult.totalTiles}`);
    console.log(`Downloaded: ${downloadResult.downloadedTiles}`);
    console.log(`Skipped: ${downloadResult.skippedTiles}`);
    console.log(`Failed: ${downloadResult.failedTiles}`);
    console.log(`Total size: ${(downloadResult.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average speed: ${downloadResult.averageSpeed.toFixed(1)} KB/s`);
    console.log(`Duration: ${(downloadResult.downloadTime / 1000).toFixed(1)}s`);
    
    if (downloadResult.errors.length > 0) {
      console.log('\n=== Download Errors ===');
      downloadResult.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url}: ${error.error}`);
      });
    }
    
    // 2. Get detailed tile statistics
    console.log('\n=== Tile Statistics ===');
    const tileStats = await getTileStats('test-style');
    console.log(`Tile count: ${tileStats.count}`);
    console.log(`Total size: ${(tileStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average size: ${(tileStats.averageSize / 1024).toFixed(1)} KB`);
    
    if (tileStats.oldestTile) {
      console.log(`Oldest tile: ${tileStats.oldestTile.toISOString()}`);
    }
    if (tileStats.newestTile) {
      console.log(`Newest tile: ${tileStats.newestTile.toISOString()}`);
    }
    
    console.log('\n=== Zoom Level Statistics ===');
    for (const [zoom, stats] of tileStats.zoomLevelStats) {
      console.log(`Zoom ${zoom}: ${stats.count} tiles, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // 3. Get comprehensive analytics
    console.log('\n=== Comprehensive Analytics ===');
    const analytics = await getTileAnalytics('test-style');
    console.log(`Total tiles: ${analytics.totalTiles}`);
    console.log(`Total size: ${(analytics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage efficiency: ${analytics.storageEfficiency.toFixed(1)}%`);
    
    if (analytics.downloadTimeRange.oldest && analytics.downloadTimeRange.newest) {
      const timeSpan = analytics.downloadTimeRange.newest.getTime() - analytics.downloadTimeRange.oldest.getTime();
      console.log(`Download time span: ${(timeSpan / 1000 / 60 / 60).toFixed(1)} hours`);
    }
    
    console.log('\n=== Size by Type ===');
    for (const [type, size] of analytics.sizeByType) {
      const count = analytics.countByType.get(type) || 0;
      console.log(`${type}: ${count} tiles, ${(size / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // 4. Verify tile integrity
    console.log('\n=== Tile Verification ===');
    const verificationResult = await verifyAndRepairTiles('test-style', {
      removeCorrupted: true,
      onProgress: (progress) => {
        console.log(`Verification: ${progress.checked}/${progress.total} (${progress.corrupted} corrupted)`);
      }
    });
    
    console.log(`Verification complete:`);
    console.log(`- Total tiles: ${verificationResult.totalTiles}`);
    console.log(`- Corrupted: ${verificationResult.corruptedTiles}`);
    console.log(`- Repaired: ${verificationResult.repairedTiles}`);
    console.log(`- Removed: ${verificationResult.removedTiles}`);
    
    // 5. Cleanup old tiles
    console.log('\n=== Tile Cleanup ===');
    const cleanupResult = await cleanupOldTiles({
      maxAge: 30, // 30 days
      maxStorageSize: 100 * 1024 * 1024, // 100 MB
      styleId: 'test-style'
    });
    
    console.log(`Cleanup complete:`);
    console.log(`- Deleted tiles: ${cleanupResult.deletedCount}`);
    console.log(`- Freed space: ${(cleanupResult.freedSpace / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Advanced configuration examples
const advancedDownloadOptions = {
  // Performance tuning
  batchSize: 50,           // Process 50 tiles at once
  maxConcurrency: 15,      // Maximum 15 concurrent downloads
  timeout: 45000,          // 45 second timeout per tile
  
  // Quality and validation
  validateTiles: true,     // Validate downloaded tile data
  compressTiles: false,    // Future: enable compression
  
  // Prioritization
  priorityZoomLevels: [13, 14, 12, 11, 10], // Download order by zoom
  
  // Network management
  bandwidthLimit: 1000,    // 1 MB/s bandwidth limit
  maxRetries: 5,           // Retry failed downloads 5 times
  retryDelay: 2000,        // 2 second delay between retries
  
  // Storage management
  storageQuotaCheck: true, // Check storage before downloading
  skipExisting: true,      // Skip tiles that already exist
  
  // Progress tracking
  onProgress: (progress) => {
    // Custom progress handling
    const percentage = progress.percentage;
    const eta = estimateTimeRemaining(progress);
    console.log(`${percentage}% complete (ETA: ${eta})`);
  }
};

function estimateTimeRemaining(progress) {
  if (progress.completed === 0) return 'calculating...';
  
  const rate = progress.completed / progress.total;
  const remaining = progress.total - progress.completed;
  const timePerItem = Date.now() / progress.completed; // rough estimate
  const eta = remaining * timePerItem;
  
  return `${Math.round(eta / 1000)}s`;
}

// Export test function for use
export { testEnhancedTileDownloader, advancedDownloadOptions };
