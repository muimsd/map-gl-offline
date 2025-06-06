// Comprehensive Enhanced Offline Map Manager Usage Examples
// This file demonstrates the complete enhanced offline map management system

import { OfflineMapManager } from './src/map/offlineManager.js';
import { FontDownloadOptions, TileDownloadOptions } from './src/map/fontManager.js';

// Initialize the offline map manager
const offlineManager = new OfflineMapManager();

// Example 1: Advanced Region Download with Enhanced Options
async function advancedRegionDownload() {
  console.log('\n=== Advanced Region Download Example ===');
  
  const region = {
    id: 'downtown-area',
    name: 'Downtown Business District',
    bounds: [[-74.0259, 40.6892], [-73.9441, 40.7589]], // Manhattan area
    minZoom: 10,
    maxZoom: 16,
    styleUrl: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11',
    styleId: 'mapbox-streets-v11',
    expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    deleteOnExpiry: false
  };

  try {
    // First, download the region with enhanced progress tracking
    console.log('📥 Starting region download...');
    
    const tileOptions: TileDownloadOptions = {
      onProgress: (progress) => {
        const percent = (progress.completed / progress.total * 100).toFixed(1);
        const speed = (progress.speed / 1024).toFixed(1);
        console.log(`🗺️  Tiles: ${percent}% (${progress.completed}/${progress.total}) - ${speed} KB/s`);
      },
      batchSize: 8,
      maxRetries: 5,
      validateData: true,
      storageQuotaCheck: true,
      priorityZoomLevels: [12, 13, 14] // Download these zoom levels first
    };

    const fontOptions: FontDownloadOptions = {
      onProgress: (progress) => {
        const percent = (progress.completed / progress.total * 100).toFixed(1);
        console.log(`🔤 Fonts: ${percent}% (${progress.completed}/${progress.total})`);
      },
      batchSize: 5,
      maxRetries: 3,
      validateData: true,
      timeout: 30000
    };

    await offlineManager.addRegion(region);
    
    // If we need to download fonts separately with enhanced options
    const fontUrls = [
      'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf',
      'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/256-511.pbf'
    ];
    
    const fontResult = await offlineManager.downloadFontsWithOptions(
      fontUrls, 
      region.styleId!, 
      fontOptions
    );
    
    console.log('\n✅ Region Download Complete:');
    console.log(`Fonts downloaded: ${fontResult.downloadedFonts}/${fontResult.totalFonts}`);
    console.log(`Font types: ${JSON.stringify(fontResult.fontsByType)}`);
    console.log(`Total font size: ${(fontResult.totalSize / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('❌ Region download failed:', error);
  }
}

// Example 2: Comprehensive Storage Analytics Dashboard
async function storageAnalyticsDashboard() {
  console.log('\n=== Storage Analytics Dashboard ===');
  
  try {
    const dashboard = await offlineManager.getStorageDashboard();
    
    console.log('📊 OFFLINE MAP STORAGE DASHBOARD');
    console.log('━'.repeat(60));
    
    // Overview
    console.log('\n📈 OVERVIEW');
    console.log(`Total Storage: ${(dashboard.overview.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total Items: ${dashboard.overview.totalItems.toLocaleString()}`);
    console.log(`Last Updated: ${dashboard.overview.lastUpdated.toLocaleString()}`);
    
    // Component breakdown
    console.log('\n🧩 STORAGE BREAKDOWN');
    console.log('Component    | Count     | Size      | Percentage');
    console.log('━'.repeat(50));
    
    Object.entries(dashboard.breakdown).forEach(([component, stats]) => {
      const name = component.charAt(0).toUpperCase() + component.slice(1);
      const count = stats.count.toLocaleString();
      const size = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      const percentage = `${stats.percentage.toFixed(1)}%`;
      
      console.log(`${name.padEnd(12)} | ${count.padStart(9)} | ${size.padStart(9)} | ${percentage.padStart(10)}`);
    });
    
    // Regions
    console.log('\n🗺️  REGIONS');
    console.log('ID               | Style ID         | Created    | Status');
    console.log('━'.repeat(60));
    
    dashboard.regions.forEach(region => {
      const id = region.id.substring(0, 15).padEnd(15);
      const styleId = region.styleId.substring(0, 15).padEnd(15);
      const created = region.created.toLocaleDateString().padEnd(10);
      const status = region.expired ? '❌ EXPIRED' : '✅ ACTIVE';
      
      console.log(`${id} | ${styleId} | ${created} | ${status}`);
    });
    
    // Recommendations
    if (dashboard.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      dashboard.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    // Detailed analytics
    const analytics = await offlineManager.getStorageAnalytics();
    console.log('\n📊 DETAILED ANALYTICS');
    console.log(`Tile zoom levels: ${analytics.tiles.zoomLevelStats.size} levels`);
    console.log(`Font types: ${Object.keys(analytics.fonts.fontsByType).length} types`);
    console.log(`Corrupted fonts: ${analytics.fonts.corruptedFonts.length}`);
    
    if (analytics.fonts.oldestFont && analytics.fonts.newestFont) {
      const ageSpan = Math.ceil(
        (analytics.fonts.newestFont.timestamp - analytics.fonts.oldestFont.timestamp) / 
        (1000 * 60 * 60 * 24)
      );
      console.log(`Font age span: ${ageSpan} days`);
    }
    
  } catch (error) {
    console.error('❌ Analytics dashboard failed:', error);
  }
}

// Example 3: Automated Maintenance Routine
async function automatedMaintenance() {
  console.log('\n=== Automated Maintenance Routine ===');
  
  try {
    const maintenanceResults = await offlineManager.performMaintenance({
      maxAge: 60,                    // Clean up data older than 60 days
      maxStorageSize: 500 * 1024 * 1024, // Keep total under 500MB
      verifyIntegrity: true,         // Verify data integrity
      removeCorrupted: true,         // Remove corrupted files
      onProgress: (progress) => {
        const percent = progress.completed && progress.total ? 
          `(${((progress.completed / progress.total) * 100).toFixed(1)}%)` : '';
        console.log(`🔧 ${progress.component.toUpperCase()}: ${progress.message} ${percent}`);
      }
    });
    
    console.log('\n✅ Maintenance Results:');
    console.log(maintenanceResults.summary);
    
    if (maintenanceResults.fonts.verified) {
      const verification = maintenanceResults.fonts.verified;
      console.log(`\n🔍 Font Verification:`);
      console.log(`  Total fonts checked: ${verification.totalFonts}`);
      console.log(`  Corrupted found: ${verification.corruptedFonts}`);
      console.log(`  Corrupted removed: ${verification.removedFonts}`);
    }
    
    console.log(`\n💾 Space Management:`);
    console.log(`  Total space freed: ${(maintenanceResults.totalFreedSpace / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Font cleanup: ${maintenanceResults.fonts.cleaned.deletedCount} files deleted`);
    
  } catch (error) {
    console.error('❌ Maintenance failed:', error);
  }
}

// Example 4: Font-Specific Operations
async function fontManagementDemo() {
  console.log('\n=== Font Management Demo ===');
  
  const styleId = 'mapbox-streets-v11';
  
  try {
    // Get comprehensive font statistics
    const fontStats = await offlineManager.getFontStatistics(styleId);
    
    console.log('🔤 Font Statistics:');
    console.log(`Total fonts: ${fontStats.count}`);
    console.log(`Total size: ${(fontStats.totalSize / 1024).toFixed(1)} KB`);
    console.log(`Average size: ${(fontStats.averageSize / 1024).toFixed(1)} KB`);
    
    console.log('\nFont types breakdown:');
    Object.entries(fontStats.fontsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} fonts`);
    });
    
    if (fontStats.oldestFont) {
      console.log(`\nOldest font: ${fontStats.oldestFont.key}`);
      console.log(`Downloaded: ${new Date(fontStats.oldestFont.timestamp).toLocaleDateString()}`);
    }
    
    if (fontStats.corruptedFonts.length > 0) {
      console.log(`\n⚠️  Corrupted fonts found: ${fontStats.corruptedFonts.length}`);
      fontStats.corruptedFonts.forEach(font => console.log(`  - ${font}`));
    }
    
    // Font analytics across all styles
    const globalFontAnalytics = await offlineManager.getFontAnalytics();
    
    console.log('\n🌍 Global Font Analytics:');
    console.log(`Total fonts across all styles: ${globalFontAnalytics.totalFonts}`);
    console.log(`Total storage: ${(globalFontAnalytics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compression ratio: ${(globalFontAnalytics.compressionRatio * 100).toFixed(1)}%`);
    
    // Verify and repair fonts
    console.log('\n🔍 Verifying font integrity...');
    const verification = await offlineManager.verifyAndRepairFonts(styleId, {
      removeCorrupted: true,
      onProgress: (progress) => {
        const percent = (progress.checked / progress.total * 100).toFixed(1);
        console.log(`  Checked ${progress.checked}/${progress.total} (${percent}%) - Found ${progress.corrupted} corrupted`);
      }
    });
    
    console.log(`\n✅ Verification complete:`);
    console.log(`  Fonts checked: ${verification.totalFonts}`);
    console.log(`  Corrupted found: ${verification.corruptedFonts}`);
    console.log(`  Corrupted removed: ${verification.removedFonts}`);
    
  } catch (error) {
    console.error('❌ Font management demo failed:', error);
  }
}

// Example 5: Performance Monitoring and Optimization
async function performanceMonitoring() {
  console.log('\n=== Performance Monitoring ===');
  
  try {
    const startTime = Date.now();
    
    // Monitor font download performance
    const fontUrls = [
      'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Bold,Arial%20Unicode%20MS%20Bold/0-255.pbf',
      'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Bold,Arial%20Unicode%20MS%20Bold/256-511.pbf'
    ];
    
    let downloadSpeed = 0;
    let totalBytes = 0;
    
    const result = await offlineManager.downloadFontsWithOptions(fontUrls, 'performance-test', {
      batchSize: 2,
      maxRetries: 3,
      timeout: 30000,
      validateData: true,
      onProgress: (progress) => {
        downloadSpeed = progress.speed;
        console.log(`📊 Download: ${(progress.speed / 1024).toFixed(1)} KB/s`);
      }
    });
    
    totalBytes = result.totalSize;
    const downloadTime = Date.now() - startTime;
    
    console.log('\n📈 Performance Metrics:');
    console.log(`Download time: ${(downloadTime / 1000).toFixed(2)}s`);
    console.log(`Average speed: ${(result.averageSpeed / 1024).toFixed(1)} KB/s`);
    console.log(`Peak speed: ${(downloadSpeed / 1024).toFixed(1)} KB/s`);
    console.log(`Efficiency: ${(totalBytes / downloadTime * 1000 / 1024).toFixed(1)} KB/s`);
    console.log(`Success rate: ${((result.downloadedFonts / result.totalFonts) * 100).toFixed(1)}%`);
    
    // Storage efficiency analysis
    const analytics = await offlineManager.getStorageAnalytics();
    
    console.log('\n💾 Storage Efficiency:');
    console.log(`Storage per font: ${(analytics.fonts.averageSize / 1024).toFixed(1)} KB`);
    console.log(`Storage per tile: ${(analytics.tiles.averageSize / 1024).toFixed(1)} KB`);
    
    const compressionSavings = analytics.fonts.totalSize * (1 - (await offlineManager.getFontAnalytics()).compressionRatio);
    console.log(`Compression savings: ${(compressionSavings / 1024).toFixed(1)} KB`);
    
    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    
    if (result.averageSpeed < 50 * 1024) { // < 50 KB/s
      console.log('- Consider reducing batch size for slower connections');
    }
    
    if (analytics.fonts.totalSize > analytics.tiles.totalSize) {
      console.log('- Fonts are using more storage than tiles - consider font optimization');
    }
    
    if ((await offlineManager.getFontAnalytics()).compressionRatio < 0.8) {
      console.log('- Use WOFF2 fonts for better compression');
    }
    
  } catch (error) {
    console.error('❌ Performance monitoring failed:', error);
  }
}

// Example 6: Comprehensive Region Management
async function regionManagementDemo() {
  console.log('\n=== Region Management Demo ===');
  
  try {
    // List all regions
    const regions = await offlineManager.listRegions();
    console.log(`📍 Total regions: ${regions.length}`);
    
    // Check for expired regions
    const expiredRegions = await offlineManager.getExpiredRegions();
    console.log(`⏰ Expired regions: ${expiredRegions.autoDelete.length + expiredRegions.manualOnly.length}`);
    console.log(`  - Auto-delete: ${expiredRegions.autoDelete.length}`);
    console.log(`  - Manual-only: ${expiredRegions.manualOnly.length}`);
    
    // Demonstrate region expiry extension
    if (regions.length > 0) {
      const region = regions[0];
      const expiry = await offlineManager.getRegionExpiry(region.id);
      
      if (expiry) {
        console.log(`\n📅 Region "${region.id}" expiry:`);
        console.log(`  Current: ${new Date(expiry.expiry).toLocaleDateString()}`);
        console.log(`  Expired: ${expiry.expired ? 'Yes' : 'No'}`);
        
        // Extend expiry by 30 days
        const newExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
        await offlineManager.extendRegionExpiry(region.id, newExpiry);
        console.log(`  Extended to: ${new Date(newExpiry).toLocaleDateString()}`);
      }
    }
    
    // Cleanup expired regions
    const cleanedCount = await offlineManager.cleanupExpiredRegions();
    console.log(`\n🧹 Cleaned up ${cleanedCount} expired regions`);
    
    // Region size analysis
    console.log('\n📊 Region Analysis:');
    for (const region of regions.slice(0, 3)) { // Show first 3 regions
      const analytics = await offlineManager.getStorageAnalytics(region.styleId || region.id);
      console.log(`\nRegion: ${region.name || region.id}`);
      console.log(`  Tiles: ${analytics.tiles.count} (${(analytics.tiles.totalSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  Fonts: ${analytics.fonts.count} (${(analytics.fonts.totalSize / 1024).toFixed(1)} KB)`);
      console.log(`  Total: ${(analytics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
  } catch (error) {
    console.error('❌ Region management demo failed:', error);
  }
}

// Example 7: Auto-Cleanup with Monitoring
async function autoCleanupDemo() {
  console.log('\n=== Auto-Cleanup Demo ===');
  
  try {
    // Start auto-cleanup with monitoring
    console.log('🔄 Starting auto-cleanup (runs every 5 minutes for demo)...');
    
    const intervalId = offlineManager.startAutoCleanup(5 * 60 * 1000); // 5 minutes
    
    // Monitor storage changes
    let previousSize = 0;
    const monitoringInterval = setInterval(async () => {
      try {
        const dashboard = await offlineManager.getStorageDashboard();
        const currentSize = dashboard.overview.totalSize;
        
        if (previousSize > 0) {
          const change = currentSize - previousSize;
          const changeStr = change > 0 ? 
            `+${(change / 1024 / 1024).toFixed(2)} MB` : 
            `${(change / 1024 / 1024).toFixed(2)} MB`;
          
          console.log(`📊 Storage: ${(currentSize / 1024 / 1024).toFixed(2)} MB (${changeStr})`);
        }
        
        previousSize = currentSize;
        
        // Show recommendations
        if (dashboard.recommendations.length > 0) {
          console.log(`💡 Recommendations: ${dashboard.recommendations.length}`);
        }
        
      } catch (error) {
        console.warn('Monitor update failed:', error);
      }
    }, 30000); // Check every 30 seconds
    
    // Run for 3 minutes then stop
    setTimeout(() => {
      offlineManager.stopAutoCleanup(intervalId);
      clearInterval(monitoringInterval);
      console.log('✅ Auto-cleanup demo completed');
    }, 3 * 60 * 1000);
    
    console.log('ℹ️  Auto-cleanup is running... (will stop automatically in 3 minutes)');
    
  } catch (error) {
    console.error('❌ Auto-cleanup demo failed:', error);
  }
}

// Main execution function
async function runComprehensiveDemo() {
  console.log('🚀 Enhanced Offline Map Manager - Comprehensive Demo');
  console.log('='.repeat(70));
  
  try {
    await advancedRegionDownload();
    await storageAnalyticsDashboard();
    await automatedMaintenance();
    await fontManagementDemo();
    await performanceMonitoring();
    await regionManagementDemo();
    await autoCleanupDemo();
    
    console.log('\n🎉 Comprehensive demo completed successfully!');
    console.log('\nThe enhanced offline map manager provides:');
    console.log('✅ Advanced region downloading with progress tracking');
    console.log('✅ Comprehensive storage analytics and dashboard');
    console.log('✅ Automated maintenance and cleanup');
    console.log('✅ Advanced font management with validation');
    console.log('✅ Performance monitoring and optimization');
    console.log('✅ Intelligent region lifecycle management');
    console.log('✅ Auto-cleanup with configurable policies');
    console.log('✅ Real-time storage monitoring');
    console.log('✅ Data integrity verification');
    console.log('✅ Comprehensive error handling and recovery');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export functions for individual testing
export {
  advancedRegionDownload,
  storageAnalyticsDashboard,
  automatedMaintenance,
  fontManagementDemo,
  performanceMonitoring,
  regionManagementDemo,
  autoCleanupDemo,
  runComprehensiveDemo
};

// Run comprehensive demo if this file is executed directly
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveDemo();
}
