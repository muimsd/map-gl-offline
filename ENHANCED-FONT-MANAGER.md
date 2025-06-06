# Enhanced Font Manager API

The enhanced font manager provides comprehensive font downloading, caching, validation, and maintenance capabilities for offline maps. This document covers all the advanced features and APIs available.

## Table of Contents

1. [Core Interfaces](#core-interfaces)
2. [Download Functions](#download-functions)
3. [Analytics Functions](#analytics-functions)
4. [Maintenance Functions](#maintenance-functions)
5. [Utility Functions](#utility-functions)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)

## Core Interfaces

### FontDownloadOptions
```typescript
interface FontDownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  batchSize?: number;                // Default: 10
  maxRetries?: number;               // Default: 3
  corsProxy?: string;                // Default: 'https://api.allorigins.win/raw?url='
  skipExisting?: boolean;            // Default: true
  timeout?: number;                  // Default: 30000ms
  bandwidthLimit?: number;           // bytes per second
  storageQuotaCheck?: boolean;       // Default: true
  validateData?: boolean;            // Default: true
  compressionLevel?: 'none' | 'low' | 'medium' | 'high';
}
```

### FontDownloadResult
```typescript
interface FontDownloadResult {
  totalFonts: number;
  downloadedFonts: number;
  skippedFonts: number;
  failedFonts: number;
  totalSize: number;
  downloadTime: number;
  averageSpeed: number;              // bytes per second
  errors: Array<{ url: string; error: string }>;
  fontsByType: Record<string, number>;
}
```

### EnhancedFontStats
```typescript
interface EnhancedFontStats {
  count: number;
  totalSize: number;
  averageSize: number;
  fonts: string[];
  fontsByType: Record<string, number>;
  oldestFont?: { key: string; timestamp: number };
  newestFont?: { key: string; timestamp: number };
  corruptedFonts: string[];
}
```

## Download Functions

### downloadFonts()
Enhanced font download with comprehensive progress tracking, validation, and error handling.

```typescript
async function downloadFonts(
  fontUrls: string[],
  downloadId?: string,
  options: FontDownloadOptions = {}
): Promise<FontDownloadResult>
```

**Features:**
- Real-time progress tracking with speed metrics
- Batch processing with configurable concurrency
- Retry logic with exponential backoff
- Font validation for multiple formats (WOFF, WOFF2, TTF, OTF, EOT, Protobuf)
- Storage quota monitoring
- Bandwidth throttling support
- Enhanced metadata storage
- Comprehensive error collection

**Example:**
```typescript
const result = await downloadFonts(fontUrls, 'style-v1', {
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} fonts downloaded`);
    console.log(`Speed: ${progress.speed} bytes/s`);
  },
  batchSize: 5,
  maxRetries: 5,
  validateData: true,
  storageQuotaCheck: true
});

console.log(`Downloaded ${result.downloadedFonts} fonts in ${result.downloadTime}ms`);
console.log(`Average speed: ${result.averageSpeed} bytes/s`);
console.log(`Font types:`, result.fontsByType);
```

### loadFonts()
Load fonts from storage.

```typescript
async function loadFonts(
  fontUrls: string[],
  downloadId?: string
): Promise<void>
```

### deleteFonts()
Delete specific fonts from storage.

```typescript
async function deleteFonts(fontUrls: string[]): Promise<void>
```

### deleteFontsByStyleId()
Delete all fonts associated with a specific style ID.

```typescript
async function deleteFontsByStyleId(styleId: string): Promise<void>
```

## Analytics Functions

### getFontStats()
Get comprehensive statistics for fonts in a specific style.

```typescript
async function getFontStats(styleId: string): Promise<EnhancedFontStats>
```

**Example:**
```typescript
const stats = await getFontStats('style-v1');
console.log(`Total fonts: ${stats.count}`);
console.log(`Total size: ${(stats.totalSize / 1024).toFixed(1)} KB`);
console.log(`Font types:`, stats.fontsByType);
console.log(`Oldest font:`, new Date(stats.oldestFont?.timestamp));
console.log(`Corrupted fonts:`, stats.corruptedFonts);
```

### getFontAnalytics()
Get comprehensive analytics across all fonts or a specific style.

```typescript
async function getFontAnalytics(styleId?: string): Promise<{
  totalFonts: number;
  totalSize: number;
  averageSize: number;
  sizeByType: Record<string, number>;
  countByType: Record<string, number>;
  downloadTimeRange: { oldest?: Date; newest?: Date };
  compressionRatio: number;
}>
```

**Example:**
```typescript
const analytics = await getFontAnalytics();
console.log(`Total fonts across all styles: ${analytics.totalFonts}`);
console.log(`Total storage used: ${(analytics.totalSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`Size by type:`, analytics.sizeByType);
console.log(`Estimated compression ratio: ${analytics.compressionRatio}`);
```

## Maintenance Functions

### cleanupOldFonts()
Clean up old fonts based on age or storage quota.

```typescript
async function cleanupOldFonts(options: {
  maxAge?: number;           // days, default: 60
  maxStorageSize?: number;   // bytes
  styleId?: string;
} = {}): Promise<{ deletedCount: number; freedSpace: number }>
```

**Example:**
```typescript
// Clean up fonts older than 30 days
const cleanup = await cleanupOldFonts({ maxAge: 30 });
console.log(`Deleted ${cleanup.deletedCount} fonts, freed ${cleanup.freedSpace} bytes`);

// Clean up to stay under 50MB total
const quotaCleanup = await cleanupOldFonts({ maxStorageSize: 50 * 1024 * 1024 });
```

### verifyAndRepairFonts()
Verify font integrity and optionally remove corrupted fonts.

```typescript
async function verifyAndRepairFonts(
  styleId: string,
  options: {
    removeCorrupted?: boolean;
    onProgress?: (progress: { checked: number; total: number; corrupted: number }) => void;
  } = {}
): Promise<{ 
  totalFonts: number; 
  corruptedFonts: number; 
  removedFonts: number;
}>
```

**Example:**
```typescript
const verification = await verifyAndRepairFonts('style-v1', {
  removeCorrupted: true,
  onProgress: (progress) => {
    console.log(`Verified ${progress.checked}/${progress.total}, found ${progress.corrupted} corrupted`);
  }
});

console.log(`Verified ${verification.totalFonts} fonts`);
console.log(`Found ${verification.corruptedFonts} corrupted fonts`);
console.log(`Removed ${verification.removedFonts} corrupted fonts`);
```

## Utility Functions

### Font Type Detection
The system automatically detects font types based on file extensions and magic numbers:

- **WOFF**: Web Open Font Format
- **WOFF2**: Web Open Font Format 2.0 (better compression)
- **TTF**: TrueType Font
- **OTF**: OpenType Font
- **EOT**: Embedded OpenType
- **Protobuf**: Protocol Buffer format (for glyph fonts)

### Font Validation
Built-in validation for different font formats:

```typescript
function isValidFontData(data: ArrayBuffer, filename: string): boolean
```

### Speed Calculation
Automatic calculation of download speeds:

```typescript
function calculateFontDownloadSpeed(bytesDownloaded: number, timeElapsed: number): number
```

## Usage Examples

### Basic Font Download
```typescript
import { downloadFonts } from './map/fontManager';

const fontUrls = [
  'https://fonts.example.com/roboto-regular.woff2',
  'https://fonts.example.com/roboto-bold.woff2'
];

const result = await downloadFonts(fontUrls, 'my-style');
console.log(`Downloaded ${result.downloadedFonts} fonts`);
```

### Advanced Download with Options
```typescript
const result = await downloadFonts(fontUrls, 'my-style', {
  batchSize: 3,
  maxRetries: 5,
  timeout: 60000,
  validateData: true,
  storageQuotaCheck: true,
  onProgress: (progress) => {
    const percent = (progress.completed / progress.total * 100).toFixed(1);
    console.log(`${percent}% complete - ${progress.speed} bytes/s`);
  }
});
```

### Font Analytics Dashboard
```typescript
async function createFontDashboard() {
  const analytics = await getFontAnalytics();
  const stats = await getFontStats('my-style');
  
  console.log('=== Font Storage Dashboard ===');
  console.log(`Total fonts: ${analytics.totalFonts}`);
  console.log(`Storage used: ${(analytics.totalSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Average font size: ${(analytics.averageSize / 1024).toFixed(1)} KB`);
  
  console.log('\nFont types:');
  Object.entries(analytics.countByType).forEach(([type, count]) => {
    const size = analytics.sizeByType[type];
    console.log(`  ${type}: ${count} fonts, ${(size / 1024).toFixed(1)} KB`);
  });
  
  console.log(`\nCompression ratio: ${analytics.compressionRatio}`);
  
  if (stats.corruptedFonts.length > 0) {
    console.log(`\nCorrupted fonts found: ${stats.corruptedFonts.length}`);
  }
}
```

### Maintenance Routine
```typescript
async function performFontMaintenance(styleId: string) {
  console.log('Starting font maintenance...');
  
  // Verify and repair fonts
  const verification = await verifyAndRepairFonts(styleId, {
    removeCorrupted: true
  });
  
  if (verification.corruptedFonts > 0) {
    console.log(`Removed ${verification.removedFonts} corrupted fonts`);
  }
  
  // Clean up old fonts
  const cleanup = await cleanupOldFonts({
    maxAge: 60, // 60 days
    styleId
  });
  
  if (cleanup.deletedCount > 0) {
    console.log(`Cleaned up ${cleanup.deletedCount} old fonts, freed ${(cleanup.freedSpace / 1024).toFixed(1)} KB`);
  }
  
  // Get final stats
  const stats = await getFontStats(styleId);
  console.log(`Maintenance complete. ${stats.count} fonts remaining, ${(stats.totalSize / 1024).toFixed(1)} KB total`);
}
```

## Best Practices

### 1. Font Download Strategy
- Use reasonable batch sizes (5-10) to balance speed and resource usage
- Enable validation for production environments
- Set appropriate timeouts for your network conditions
- Monitor storage quota to prevent running out of space

### 2. Error Handling
- Always check the `errors` array in `FontDownloadResult`
- Implement retry logic for failed downloads
- Log font validation failures for debugging

### 3. Performance Optimization
- Use WOFF2 fonts when possible for better compression
- Implement bandwidth limiting if needed
- Consider font subsetting to reduce file sizes
- Use CDN or local proxies for better download speeds

### 4. Storage Management
- Regularly run cleanup routines
- Monitor storage usage with analytics
- Set up automated verification for data integrity
- Use appropriate cache expiration policies

### 5. Font Validation
- Always validate fonts in production
- Handle different font formats appropriately
- Monitor for corrupted fonts and clean them up
- Test with different font sources and formats

### 6. Progress Tracking
- Provide meaningful progress feedback to users
- Include speed and time estimates
- Handle progress updates efficiently
- Show detailed statistics after completion

This enhanced font manager provides enterprise-level reliability and comprehensive font management capabilities while maintaining ease of use and backward compatibility.
