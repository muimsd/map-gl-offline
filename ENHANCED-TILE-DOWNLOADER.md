# Enhanced Tile Downloader Documentation

## Overview

The enhanced tile downloader provides robust, efficient, and configurable tile downloading with advanced features for monitoring, validation, and management.

## Key Features

### 🚀 Performance Enhancements
- **Configurable Concurrency**: Control the number of simultaneous downloads
- **Batch Processing**: Download tiles in controlled batches to prevent overwhelming the system
- **Bandwidth Throttling**: Limit download speed to prevent network congestion
- **Priority Zoom Levels**: Download specific zoom levels first
- **Smart Retry Logic**: Exponential backoff with configurable retry attempts

### 📊 Progress Tracking & Analytics
- **Real-time Progress**: Detailed progress reporting with speed metrics
- **Download Statistics**: Comprehensive download results with timing and error tracking
- **Tile Analytics**: Storage usage by zoom level, type, and time
- **Storage Efficiency**: Monitor compression ratios and storage optimization

### 🛡️ Reliability & Validation
- **Tile Validation**: Verify downloaded tile data integrity
- **Error Recovery**: Graceful handling of network failures and corrupted downloads
- **Storage Quota Management**: Check available storage before downloading
- **Tile Verification**: Scan and repair corrupted tiles in storage

### 🧹 Maintenance & Cleanup
- **Automatic Cleanup**: Remove old tiles based on age or storage quotas
- **Storage Analytics**: Track storage usage patterns and trends
- **Tile Repair**: Detect and fix corrupted tile data

## API Reference

### TileDownloadOptions

```typescript
interface TileDownloadOptions {
  // Progress tracking
  onProgress?: (progress: DownloadProgress) => void;
  
  // Performance tuning
  batchSize?: number;              // Default: 50
  maxConcurrency?: number;         // Default: 20
  timeout?: number;                // Default: 30000ms
  
  // Retry configuration
  maxRetries?: number;             // Default: 3
  retryDelay?: number;             // Default: 1000ms
  
  // Quality control
  validateTiles?: boolean;         // Default: true
  skipExisting?: boolean;          // Default: true
  compressTiles?: boolean;         // Default: false (future feature)
  
  // Network management
  bandwidthLimit?: number;         // KB/s, no limit by default
  priorityZoomLevels?: number[];   // Download order preference
  
  // Storage management
  storageQuotaCheck?: boolean;     // Default: true
}
```

### TileDownloadResult

```typescript
interface TileDownloadResult {
  totalTiles: number;              // Total tiles to download
  downloadedTiles: number;         // Successfully downloaded
  skippedTiles: number;            // Already existed, skipped
  failedTiles: number;             // Failed to download
  totalSize: number;               // Total bytes downloaded
  downloadTime: number;            // Time taken in milliseconds
  averageSpeed: number;            // KB/s average speed
  errors: Array<{                  // Detailed error information
    url: string;
    error: string;
  }>;
}
```

### Enhanced Functions

#### downloadTiles()
```typescript
async function downloadTiles(
  region: OfflineRegionOptions,
  style: any,
  styleId: string,
  options?: TileDownloadOptions
): Promise<TileDownloadResult>
```

Downloads tiles for a region with enhanced options and detailed results.

#### getTileStats()
```typescript
async function getTileStats(styleId: string): Promise<TileStats>
```

Get comprehensive statistics about stored tiles including:
- Total count and size
- Average tile size
- Oldest and newest tiles
- Statistics by zoom level

#### getTileAnalytics()
```typescript
async function getTileAnalytics(styleId?: string): Promise<TileAnalytics>
```

Get detailed analytics including:
- Size and count by zoom level
- Size and count by tile type
- Download time ranges
- Storage efficiency metrics

#### cleanupOldTiles()
```typescript
async function cleanupOldTiles(options: {
  maxAge?: number;           // Days, default: 30
  maxStorageSize?: number;   // Bytes
  keepRecentlyUsed?: boolean;// Default: true
  styleId?: string;          // Clean specific style
}): Promise<{ deletedCount: number; freedSpace: number }>
```

Clean up old tiles based on age or storage constraints.

#### verifyAndRepairTiles()
```typescript
async function verifyAndRepairTiles(
  styleId: string,
  options: {
    removeCorrupted?: boolean;     // Default: false
    redownloadCorrupted?: boolean; // Default: false
    onProgress?: (progress) => void;
  }
): Promise<VerificationResult>
```

Verify tile integrity and optionally repair corrupted tiles.

## Usage Examples

### Basic Usage
```typescript
import { downloadTiles } from './src/map/tileDownloader.js';

const region = {
  id: 'my-region',
  bounds: [[-74.0, 40.7], [-73.9, 40.8]],
  minZoom: 10,
  maxZoom: 14
};

const result = await downloadTiles(region, style, 'my-style', {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
  }
});

console.log(`Downloaded ${result.downloadedTiles} tiles in ${result.downloadTime/1000}s`);
```

### Advanced Configuration
```typescript
const advancedOptions = {
  // Performance
  batchSize: 30,
  maxConcurrency: 15,
  timeout: 45000,
  
  // Quality
  validateTiles: true,
  priorityZoomLevels: [13, 14, 12],
  
  // Network
  bandwidthLimit: 500, // 500 KB/s
  maxRetries: 5,
  retryDelay: 2000,
  
  // Storage
  storageQuotaCheck: true,
  skipExisting: true,
  
  onProgress: (progress) => {
    const speed = calculateCurrentSpeed(progress);
    const eta = estimateTimeRemaining(progress);
    console.log(`${progress.percentage}% - ${speed} KB/s - ETA: ${eta}`);
  }
};

const result = await downloadTiles(region, style, 'my-style', advancedOptions);
```

### Maintenance Operations
```typescript
// Get detailed analytics
const analytics = await getTileAnalytics('my-style');
console.log(`Storage: ${analytics.totalSize / 1024 / 1024} MB`);
console.log(`Efficiency: ${analytics.storageEfficiency}%`);

// Verify tile integrity
const verification = await verifyAndRepairTiles('my-style', {
  removeCorrupted: true,
  onProgress: (progress) => {
    console.log(`Verified ${progress.checked}/${progress.total}`);
  }
});

// Cleanup old tiles
const cleanup = await cleanupOldTiles({
  maxAge: 30,
  maxStorageSize: 100 * 1024 * 1024, // 100 MB
  styleId: 'my-style'
});

console.log(`Freed ${cleanup.freedSpace / 1024 / 1024} MB`);
```

## Performance Tips

### Optimal Batch Sizes
- **Small regions**: 20-30 tiles per batch
- **Large regions**: 50-100 tiles per batch
- **Slow networks**: 10-20 tiles per batch
- **Fast networks**: 100+ tiles per batch

### Concurrency Guidelines
- **Mobile devices**: 5-10 concurrent downloads
- **Desktop browsers**: 10-20 concurrent downloads
- **High-bandwidth**: 20+ concurrent downloads

### Bandwidth Management
- Set `bandwidthLimit` to prevent overwhelming the server
- Use `priorityZoomLevels` to download critical zoom levels first
- Monitor `averageSpeed` in results to optimize settings

### Storage Optimization
- Enable `skipExisting` to avoid re-downloading tiles
- Use `storageQuotaCheck` to prevent storage overflow
- Regular cleanup with `cleanupOldTiles()` maintains performance
- Monitor storage with `getTileAnalytics()`

## Error Handling

The enhanced tile downloader provides comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **Validation Errors**: Invalid tiles are rejected and retried
3. **Storage Errors**: Graceful degradation with detailed error reporting
4. **Quota Errors**: Early detection and prevention of storage overflow

All errors are collected in the `TileDownloadResult.errors` array with detailed information about the URL and error type.

## Migration from Basic Version

To migrate from the basic tile downloader:

1. **Update function signature**: `downloadTiles()` now returns `TileDownloadResult`
2. **Add error handling**: Check `result.errors` for any download failures
3. **Utilize new options**: Configure performance and quality options
4. **Add maintenance**: Use analytics and cleanup functions for better management

## Future Enhancements

- **Tile Compression**: Reduce storage usage with optional compression
- **Smart Prefetching**: Predictive tile downloading based on usage patterns
- **Network Awareness**: Adapt download strategy based on connection quality
- **Background Sync**: Continue downloads when app is in background
- **Delta Updates**: Only download changed tiles for map updates
