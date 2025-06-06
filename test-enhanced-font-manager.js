// Enhanced Font Manager Usage Examples and Tests
// This file demonstrates the advanced capabilities of the enhanced font manager

import { 
  downloadFonts, 
  getFontStats, 
  getFontAnalytics,
  cleanupOldFonts,
  verifyAndRepairFonts,
  deleteFontsByStyleId 
} from './src/map/fontManager.js';

// Test font URLs from various sources
const testFontUrls = [
  // Google Fonts (WOFF2)
  'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
  'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2',
  
  // Mapbox Glyphs (Protobuf format)
  'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf',
  'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/256-511.pbf',
  
  // Additional font types for testing
  'https://example.com/fonts/custom-font.woff',
  'https://example.com/fonts/display-font.ttf'
];

// Example 1: Basic Font Download with Progress Tracking
async function basicFontDownload() {
  console.log('\n=== Basic Font Download Example ===');
  
  try {
    const result = await downloadFonts(testFontUrls.slice(0, 3), 'test-style-basic', {
      onProgress: (progress) => {
        const percent = (progress.completed / progress.total * 100).toFixed(1);
        const speed = (progress.speed / 1024).toFixed(1); // KB/s
        console.log(`📥 ${percent}% complete (${progress.completed}/${progress.total}) - Speed: ${speed} KB/s`);
        
        if (progress.errors.length > 0) {
          console.log(`⚠️  Errors encountered: ${progress.errors.length}`);
        }
      },
      skipExisting: true,
      validateData: true
    });
    
    console.log('\n📊 Download Results:');
    console.log(`✅ Downloaded: ${result.downloadedFonts} fonts`);
    console.log(`⏭️  Skipped: ${result.skippedFonts} fonts`);
    console.log(`❌ Failed: ${result.failedFonts} fonts`);
    console.log(`📦 Total size: ${(result.totalSize / 1024).toFixed(1)} KB`);
    console.log(`⏱️  Time: ${(result.downloadTime / 1000).toFixed(1)}s`);
    console.log(`🚀 Average speed: ${(result.averageSpeed / 1024).toFixed(1)} KB/s`);
    console.log(`📝 Font types:`, result.fontsByType);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => {
        console.log(`  ${error.url}: ${error.error}`);
      });
    }
    
  } catch (error) {
    console.error('Font download failed:', error);
  }
}

// Example 2: Advanced Download with Custom Options
async function advancedFontDownload() {
  console.log('\n=== Advanced Font Download Example ===');
  
  try {
    const result = await downloadFonts(testFontUrls, 'test-style-advanced', {
      batchSize: 2,                    // Process 2 fonts at once
      maxRetries: 5,                   // Retry failed downloads up to 5 times
      timeout: 45000,                  // 45 second timeout per font
      validateData: true,              // Validate font data after download
      storageQuotaCheck: true,         // Check storage quota before download
      onProgress: (progress) => {
        const percent = (progress.completed / progress.total * 100).toFixed(1);
        const speed = (progress.speed / 1024).toFixed(1);
        const eta = progress.eta ? `ETA: ${Math.ceil(progress.eta / 1000)}s` : '';
        
        console.log(`📥 ${percent}% - ${progress.message} - ${speed} KB/s ${eta}`);
      }
    });
    
    console.log('\n🎯 Advanced Download Complete:');
    console.log(`Success rate: ${((result.downloadedFonts / result.totalFonts) * 100).toFixed(1)}%`);
    console.log(`Data efficiency: ${(result.totalSize / (result.downloadTime || 1) * 1000 / 1024).toFixed(1)} KB/s`);
    
  } catch (error) {
    console.error('Advanced download failed:', error);
  }
}

// Example 3: Font Analytics and Statistics
async function fontAnalyticsExample() {
  console.log('\n=== Font Analytics Example ===');
  
  try {
    // Get comprehensive analytics
    const analytics = await getFontAnalytics();
    
    console.log('📊 Global Font Analytics:');
    console.log(`Total fonts stored: ${analytics.totalFonts}`);
    console.log(`Total storage used: ${(analytics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average font size: ${(analytics.averageSize / 1024).toFixed(1)} KB`);
    console.log(`Compression ratio: ${(analytics.compressionRatio * 100).toFixed(1)}%`);
    
    console.log('\n📈 Size by font type:');
    Object.entries(analytics.sizeByType).forEach(([type, size]) => {
      console.log(`  ${type}: ${(size / 1024).toFixed(1)} KB`);
    });
    
    console.log('\n📋 Count by font type:');
    Object.entries(analytics.countByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} fonts`);
    });
    
    if (analytics.downloadTimeRange.oldest) {
      console.log(`\n⏰ Download time range:`);
      console.log(`  Oldest: ${analytics.downloadTimeRange.oldest.toLocaleDateString()}`);
      console.log(`  Newest: ${analytics.downloadTimeRange.newest?.toLocaleDateString()}`);
    }
    
    // Get style-specific stats
    const styleStats = await getFontStats('test-style-advanced');
    
    console.log('\n🎨 Style-Specific Stats (test-style-advanced):');
    console.log(`Fonts in style: ${styleStats.count}`);
    console.log(`Style storage: ${(styleStats.totalSize / 1024).toFixed(1)} KB`);
    console.log(`Average size: ${(styleStats.averageSize / 1024).toFixed(1)} KB`);
    
    if (styleStats.oldestFont) {
      console.log(`Oldest font: ${styleStats.oldestFont.key} (${new Date(styleStats.oldestFont.timestamp).toLocaleDateString()})`);
    }
    
    if (styleStats.newestFont) {
      console.log(`Newest font: ${styleStats.newestFont.key} (${new Date(styleStats.newestFont.timestamp).toLocaleDateString()})`);
    }
    
    if (styleStats.corruptedFonts.length > 0) {
      console.log(`⚠️  Corrupted fonts: ${styleStats.corruptedFonts.length}`);
      styleStats.corruptedFonts.forEach(font => console.log(`  - ${font}`));
    }
    
  } catch (error) {
    console.error('Analytics failed:', error);
  }
}

// Example 4: Font Maintenance and Cleanup
async function fontMaintenanceExample() {
  console.log('\n=== Font Maintenance Example ===');
  
  try {
    // Verify and repair fonts
    console.log('🔍 Verifying font integrity...');
    const verification = await verifyAndRepairFonts('test-style-advanced', {
      removeCorrupted: true,
      onProgress: (progress) => {
        const percent = (progress.checked / progress.total * 100).toFixed(1);
        console.log(`🔍 Verified ${progress.checked}/${progress.total} (${percent}%) - Found ${progress.corrupted} corrupted`);
      }
    });
    
    console.log('\n✅ Verification Results:');
    console.log(`Total fonts checked: ${verification.totalFonts}`);
    console.log(`Corrupted fonts found: ${verification.corruptedFonts}`);
    console.log(`Corrupted fonts removed: ${verification.removedFonts}`);
    
    // Clean up old fonts
    console.log('\n🧹 Cleaning up old fonts...');
    const cleanup = await cleanupOldFonts({
      maxAge: 30,                      // Remove fonts older than 30 days
      styleId: 'test-style-advanced'   // Only clean this style
    });
    
    console.log('\n🗑️  Cleanup Results:');
    console.log(`Fonts deleted: ${cleanup.deletedCount}`);
    console.log(`Space freed: ${(cleanup.freedSpace / 1024).toFixed(1)} KB`);
    
    // Storage quota cleanup example
    console.log('\n💾 Storage quota cleanup...');
    const quotaCleanup = await cleanupOldFonts({
      maxStorageSize: 10 * 1024 * 1024  // Keep total under 10MB
    });
    
    console.log(`Fonts deleted for quota: ${quotaCleanup.deletedCount}`);
    console.log(`Space freed for quota: ${(quotaCleanup.freedSpace / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('Maintenance failed:', error);
  }
}

// Example 5: Font Storage Dashboard
async function fontDashboard() {
  console.log('\n=== Font Storage Dashboard ===');
  
  try {
    const analytics = await getFontAnalytics();
    
    console.log('📊 FONT STORAGE DASHBOARD');
    console.log('━'.repeat(50));
    
    // Summary
    console.log(`📦 Total Storage: ${(analytics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📂 Total Fonts: ${analytics.totalFonts}`);
    console.log(`📏 Average Size: ${(analytics.averageSize / 1024).toFixed(1)} KB`);
    console.log(`🗜️  Compression: ${(analytics.compressionRatio * 100).toFixed(1)}%`);
    
    // Storage by type
    console.log('\n📊 STORAGE BY TYPE');
    console.log('━'.repeat(30));
    Object.entries(analytics.sizeByType).forEach(([type, size]) => {
      const count = analytics.countByType[type] || 0;
      const avgSize = count > 0 ? size / count : 0;
      const percent = analytics.totalSize > 0 ? (size / analytics.totalSize * 100).toFixed(1) : 0;
      
      console.log(`${type.padEnd(12)} ${count.toString().padStart(3)} fonts  ${(size / 1024).toFixed(1).padStart(8)} KB  ${percent.toString().padStart(5)}%  (avg: ${(avgSize / 1024).toFixed(1)} KB)`);
    });
    
    // Time range
    if (analytics.downloadTimeRange.oldest) {
      console.log('\n⏰ TIME RANGE');
      console.log('━'.repeat(20));
      console.log(`Oldest: ${analytics.downloadTimeRange.oldest.toLocaleDateString()}`);
      console.log(`Newest: ${analytics.downloadTimeRange.newest?.toLocaleDateString()}`);
      
      const daysDiff = analytics.downloadTimeRange.newest && analytics.downloadTimeRange.oldest ? 
        Math.ceil((analytics.downloadTimeRange.newest.getTime() - analytics.downloadTimeRange.oldest.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      console.log(`Span: ${daysDiff} days`);
    }
    
    // Performance metrics
    console.log('\n🚀 PERFORMANCE METRICS');
    console.log('━'.repeat(30));
    
    // Estimate based on compression ratio
    const uncompressedSize = analytics.totalSize / analytics.compressionRatio;
    const savings = uncompressedSize - analytics.totalSize;
    console.log(`Compression savings: ${(savings / 1024 / 1024).toFixed(2)} MB`);
    
    // Storage efficiency
    const efficiency = analytics.totalSize / analytics.totalFonts;
    console.log(`Storage efficiency: ${(efficiency / 1024).toFixed(1)} KB/font`);
    
  } catch (error) {
    console.error('Dashboard failed:', error);
  }
}

// Example 6: Error Handling and Recovery
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  // Test with some invalid URLs
  const problematicUrls = [
    'https://nonexistent-domain.invalid/font.woff2',
    'https://httpstat.us/404/font.woff',
    'https://httpstat.us/500/font.ttf',
    ...testFontUrls.slice(0, 2) // Mix with valid URLs
  ];
  
  try {
    const result = await downloadFonts(problematicUrls, 'test-error-handling', {
      maxRetries: 2,
      timeout: 10000,
      onProgress: (progress) => {
        console.log(`🔄 ${progress.completed}/${progress.total} - ${progress.message}`);
        
        if (progress.errors.length > 0) {
          console.log(`⚠️  Current errors: ${progress.errors.length}`);
        }
      }
    });
    
    console.log('\n📊 Error Handling Results:');
    console.log(`Success rate: ${((result.downloadedFonts / result.totalFonts) * 100).toFixed(1)}%`);
    console.log(`Partial success: ${result.downloadedFonts > 0 && result.failedFonts > 0 ? 'Yes' : 'No'}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Detailed Errors:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url}`);
        console.log(`   Error: ${error.error}`);
      });
    }
    
    // Demonstrate graceful degradation
    if (result.downloadedFonts > 0) {
      console.log('\n✅ Graceful degradation successful - some fonts were downloaded despite errors');
    }
    
  } catch (error) {
    console.error('Error handling test failed:', error);
  }
}

// Example 7: Performance Benchmarking
async function performanceBenchmark() {
  console.log('\n=== Performance Benchmark ===');
  
  const benchmarkUrls = testFontUrls.slice(0, 4);
  const results = [];
  
  // Test different batch sizes
  const batchSizes = [1, 2, 4];
  
  for (const batchSize of batchSizes) {
    console.log(`\n🏃 Testing batch size: ${batchSize}`);
    
    // Clean up before test
    await deleteFontsByStyleId(`benchmark-${batchSize}`);
    
    const startTime = Date.now();
    
    const result = await downloadFonts(benchmarkUrls, `benchmark-${batchSize}`, {
      batchSize,
      skipExisting: false, // Force re-download for accurate timing
      onProgress: (progress) => {
        const percent = (progress.completed / progress.total * 100).toFixed(1);
        process.stdout.write(`\r  📥 ${percent}% - ${(progress.speed / 1024).toFixed(1)} KB/s`);
      }
    });
    
    const endTime = Date.now();
    console.log(''); // New line after progress
    
    results.push({
      batchSize,
      totalTime: endTime - startTime,
      avgSpeed: result.averageSpeed,
      throughput: result.totalSize / (result.downloadTime || 1) * 1000
    });
    
    console.log(`  ⏱️  Total time: ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log(`  🚀 Throughput: ${(result.totalSize / (result.downloadTime || 1) * 1000 / 1024).toFixed(1)} KB/s`);
  }
  
  console.log('\n📊 Benchmark Results Summary:');
  console.log('Batch Size | Total Time | Throughput');
  console.log('━'.repeat(40));
  results.forEach(result => {
    console.log(`${result.batchSize.toString().padStart(9)} | ${(result.totalTime / 1000).toFixed(1).padStart(9)}s | ${(result.throughput / 1024).toFixed(1).padStart(8)} KB/s`);
  });
  
  // Find optimal batch size
  const optimal = results.reduce((best, current) => 
    current.throughput > best.throughput ? current : best
  );
  
  console.log(`\n🏆 Optimal batch size: ${optimal.batchSize} (${(optimal.throughput / 1024).toFixed(1)} KB/s)`);
}

// Main execution function
async function runAllExamples() {
  console.log('🚀 Enhanced Font Manager - Comprehensive Examples');
  console.log('='.repeat(60));
  
  try {
    await basicFontDownload();
    await advancedFontDownload();
    await fontAnalyticsExample();
    await fontMaintenanceExample();
    await fontDashboard();
    await errorHandlingExample();
    await performanceBenchmark();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('\nThe enhanced font manager provides:');
    console.log('✅ Comprehensive progress tracking');
    console.log('✅ Advanced download options');
    console.log('✅ Font validation and integrity checking');
    console.log('✅ Detailed analytics and statistics');
    console.log('✅ Maintenance and cleanup tools');
    console.log('✅ Graceful error handling');
    console.log('✅ Performance optimization');
    console.log('✅ Storage management');
    
  } catch (error) {
    console.error('Examples failed:', error);
  }
}

// Export functions for individual testing
export {
  basicFontDownload,
  advancedFontDownload,
  fontAnalyticsExample,
  fontMaintenanceExample,
  fontDashboard,
  errorHandlingExample,
  performanceBenchmark,
  runAllExamples
};

// Run all examples if this file is executed directly
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
