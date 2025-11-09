# Quick Reference Guide

## New Utilities

### Logger
```typescript
import { logger } from './utils';

// Create scoped logger
const myLogger = logger.scope('MyComponent');

// Log at different levels
myLogger.debug('Debug info');      // Dev only
myLogger.info('Info message');     // Always
myLogger.warn('Warning');          // Always
myLogger.error('Error', error);    // Always
myLogger.success('Success!');      // Always

// Set log level (dev/prod auto-detected)
logger.setLogLevel(LogLevel.DEBUG);
```

### Constants
```typescript
import { 
  DB_NAME, 
  DOWNLOAD_DEFAULTS, 
  TILE_CONFIG,
  ERROR_MESSAGES 
} from './utils/constants';

// Use centralized constants
const batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE; // 10
const maxZoom = TILE_CONFIG.MAX_ZOOM;           // 22
const error = ERROR_MESSAGES.INVALID_BOUNDS;    // "Invalid bounds..."
```

### Error Handling
```typescript
import { 
  categorizeError, 
  getUserErrorMessage,
  safeExecute,
  CategorizedError,
  ErrorType 
} from './utils/errorHandling';

// Categorize errors
const type = categorizeError(error); // Returns ErrorType

// Get user-friendly message
const message = getUserErrorMessage(error);

// Safe execution
const result = await safeExecute(async () => {
  return await riskyOperation();
}, 'OperationName');

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.type); // ErrorType
}
```

### Base Download Service
```typescript
import { BaseDownloadService } from './services/baseDownloadService';

class MyDownloadService extends BaseDownloadService {
  protected serviceName = 'MyService';

  async download() {
    const logger = this.getLogger();
    
    // Check storage
    await this.checkStorageQuota(500 * 1024 * 1024); // 500MB
    
    // Track stats
    const stats = this.createStatsTracker();
    stats.trackItem('file.png', 1024, 'image');
    
    // Calculate speed
    const speed = this.calculateSpeed(bytes, ms);
    
    return stats.getStats();
  }
}
```

## Updated Services

### All Services Now Use Logger
```typescript
// Old way (DON'T USE)
console.warn('Downloading tile...');
console.error('Download failed:', error);

// New way (USE THIS)
import { logger } from '../utils';
const serviceLogger = logger.scope('ServiceName');

serviceLogger.debug('Downloading tile...');  // Dev only
serviceLogger.error('Download failed:', error);
```

## Type Documentation

All interfaces now have comprehensive JSDoc. Use IDE autocomplete to see:
- Property descriptions
- Default values
- Format specifications
- Examples

```typescript
// Hover over any property to see documentation
const options: TileDownloadOptions = {
  batchSize: 10,        // Number of tiles to download concurrently (default: 10)
  maxRetries: 3,        // Maximum retry attempts for failed downloads (default: 3)
  skipExisting: true,   // Skip tiles that already exist in storage (default: true)
};
```

## Configuration Changes

### Before
```typescript
// Magic numbers scattered in code
const batchSize = 10;
const maxRetries = 3;
const timeout = 10000;
```

### After
```typescript
import { DOWNLOAD_DEFAULTS } from './utils/constants';

const batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE;       // 10
const maxRetries = DOWNLOAD_DEFAULTS.MAX_RETRIES;     // 3
const timeout = DOWNLOAD_DEFAULTS.TIMEOUT;            // 10000
```

## Error Handling Patterns

### Pattern 1: Simple Try-Catch
```typescript
try {
  await operation();
} catch (error: unknown) {
  logger.error('Operation failed:', error);
  throw error;
}
```

### Pattern 2: Categorized Error
```typescript
import { categorizeError, logError } from './utils/errorHandling';

try {
  await operation();
} catch (error: unknown) {
  logError(error, 'OperationName');
  const type = categorizeError(error);
  
  if (type === ErrorType.NETWORK) {
    // Retry logic
  } else if (type === ErrorType.QUOTA) {
    // Show quota error to user
  }
}
```

### Pattern 3: Safe Execute
```typescript
import { safeExecute } from './utils/errorHandling';

const result = await safeExecute(
  async () => await riskyOperation(),
  'OperationContext'
);

if (!result.success) {
  // Handle error
  console.error(result.error.type);
  console.error(result.error.message);
}
```

## Development Tips

### Debugging
1. Set `NODE_ENV=development` to see debug logs
2. Use scoped loggers to filter output
3. Check error types for better handling

### Adding New Services
1. Extend `BaseDownloadService` if applicable
2. Create scoped logger at top of file
3. Use constants instead of magic numbers
4. Document types with JSDoc

### Error Messages
1. Use `ERROR_MESSAGES` from constants
2. Categorize errors with `ErrorType`
3. Provide user-friendly messages with `getUserErrorMessage()`

## Build & Test

```bash
# Build project
npm run build

# Check for errors
npm run lint

# Run tests
npm test
```

## Migration Guide

### Updating Existing Code

#### Step 1: Add Logger
```typescript
// Add import
import { logger } from '../utils';

// Create scoped logger
const myLogger = logger.scope('MyComponent');

// Replace console calls
// console.warn('message') → myLogger.debug('message')
// console.error('error') → myLogger.error('error')
```

#### Step 2: Use Constants
```typescript
// Add import
import { DOWNLOAD_DEFAULTS } from '../utils/constants';

// Replace magic numbers
// const batchSize = 10 → const batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE
```

#### Step 3: Add Type Documentation
```typescript
/**
 * My interface description
 */
export interface MyInterface {
  /** Property description (default: 10) */
  count: number;
  /** Optional property description */
  name?: string;
}
```

## Common Patterns

### Download Service Pattern
```typescript
import { logger } from '../utils';

const serviceLogger = logger.scope('ServiceName');

export class MyService {
  async download(urls: string[], options = {}) {
    const { batchSize = DOWNLOAD_DEFAULTS.BATCH_SIZE } = options;
    
    serviceLogger.debug(`Downloading ${urls.length} items`);
    
    try {
      // Download logic
      serviceLogger.info('Download complete');
    } catch (error: unknown) {
      serviceLogger.error('Download failed:', error);
      throw error;
    }
  }
}
```

### Progress Tracking Pattern
```typescript
const stats = this.createStatsTracker();

for (const item of items) {
  stats.trackItem(item.name, item.size, item.type);
}

const summary = stats.getStats();
// { largest, smallest, byType }
```

### Storage Check Pattern
```typescript
await this.checkStorageQuota(requiredBytes);
// Throws if insufficient space
```

## Best Practices

1. **Always use logger instead of console**
   - Use appropriate log levels
   - Create scoped loggers for components

2. **Use constants for configuration**
   - Import from `constants.ts`
   - Don't hardcode magic numbers

3. **Document types with JSDoc**
   - Describe all properties
   - Include default values
   - Specify formats

4. **Handle errors consistently**
   - Use error utilities
   - Categorize errors
   - Provide user-friendly messages

5. **Follow existing patterns**
   - Look at refactored services
   - Use base classes when appropriate
   - Keep code DRY
