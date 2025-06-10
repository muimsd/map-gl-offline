// Debug script to test downloads
// Run this in the browser console to test downloading functionality

async function debugDownloads() {
  console.log('=== DEBUG: Testing Download Functionality ===');
  
  // Test 1: Check if databases exist
  try {
    const databases = await indexedDB.databases();
    console.log('Available IndexedDB databases:', databases.map(db => db.name));
  } catch (error) {
    console.error('Error checking databases:', error);
  }
  
  // Test 2: Try to access the offline manager
  if (window.offlineManager) {
    console.log('✅ OfflineManager is available');
    
    // Test 3: List existing regions
    try {
      const regions = await window.offlineManager.listRegions();
      console.log('📍 Existing regions:', regions);
    } catch (error) {
      console.error('❌ Error listing regions:', error);
    }
    
    // Test 4: Check storage analytics
    try {
      const analytics = await window.offlineManager.getComprehensiveStorageAnalytics();
      console.log('📊 Storage analytics:', analytics);
    } catch (error) {
      console.error('❌ Error getting analytics:', error);
    }
    
    // Test 5: Check font stats
    try {
      const fontStats = await window.offlineManager.getFontStatistics();
      console.log('🔤 Font statistics:', fontStats);
    } catch (error) {
      console.error('❌ Error getting font stats:', error);
    }
    
    // Test 6: Check tile stats
    try {
      const tileStats = await window.offlineManager.getTileStatistics();
      console.log('🗺️ Tile statistics:', tileStats);
    } catch (error) {
      console.error('❌ Error getting tile stats:', error);
    }
    
  } else {
    console.error('❌ OfflineManager not available on window object');
  }
  
  console.log('=== DEBUG COMPLETE ===');
}

// Run the debug
debugDownloads();
