// Integration test for the complete offline map management system
import { OfflineMapManager } from './dist/assets/index-D12xriEt.js';

async function testIntegration() {
  console.log('🧪 Testing complete offline map manager integration...');
  
  try {
    const manager = new OfflineMapManager();
    
    // Test basic functionality
    console.log('✅ OfflineMapManager instantiated successfully');
    
    // Test region listing (should work even if empty)
    const regions = await manager.listRegions();
    console.log(`✅ Listed regions: ${regions.length} found`);
    
    // Test storage analytics (should work even if empty)
    const analytics = await manager.getStorageAnalytics();
    console.log(`✅ Storage analytics retrieved:`, {
      totalSize: analytics.totalSize,
      componentBreakdown: Object.keys(analytics.componentBreakdown)
    });
    
    // Test individual stats methods
    const fontStats = await manager.getAllFontStats();
    console.log(`✅ Font stats: ${fontStats.count} fonts, ${fontStats.totalSize} bytes`);
    
    const spriteStats = await manager.getAllSpriteStats();
    console.log(`✅ Sprite stats: ${spriteStats.count} sprites, ${spriteStats.totalSize} bytes`);
    
    const styleStats = await manager.getAllStyleStats();
    console.log(`✅ Style stats: ${styleStats.count} styles, ${styleStats.totalSize} bytes`);
    
    console.log('🎉 All integration tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testIntegration();
