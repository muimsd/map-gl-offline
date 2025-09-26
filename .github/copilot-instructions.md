# GitHub Copilot Instructions

## Project Overview
This is an offline map manager library for MapLibre GL and Mapbox GL that enables downloading, storing, and managing map tiles, styles, fonts, sprites, and glyphs in IndexedDB for offline usage.

## Code Style & Standards

### TypeScript
- Use strict TypeScript with proper typing
- Avoid `any` types - prefer `unknown` or specific interfaces
- Use `_` prefix for unused parameters instead of ignoring them
- Prefer const assertions and readonly arrays where appropriate
- Use proper JSDoc comments for public APIs

### Console Logging
- Only use `console.warn` and `console.error` in production code
- Use `console.log` sparingly and only for development debugging
- Prefer structured logging with context

### Error Handling
- Use proper error boundaries and try-catch blocks
- Always handle Promise rejections
- Use `unknown` type for caught errors, not `any`
- Provide meaningful error messages with context

### Async/Await
- Prefer async/await over Promise chains
- Always handle async errors properly
- Use Promise.allSettled for concurrent operations that shouldn't fail together

## Architecture Patterns

### Service Layer
- Services handle business logic and data persistence
- Services should be stateless and dependency-injectable
- Use IndexedDB for all offline storage operations
- Implement proper cleanup and maintenance routines

### UI Layer
- Separate UI components from business logic
- Use composition over inheritance
- Implement proper event delegation
- Handle loading and error states gracefully

### Data Flow
- Use the repository pattern for data access
- Centralize region management in RegionService
- Use `listStoredRegions()` for UI consistency
- Implement proper caching strategies

## Key Components

### OfflineMapManager
- Main entry point for offline functionality
- Delegates to specialized services
- Provides unified API for consumers

### RegionService
- Manages region CRUD operations
- Handles region validation and bounds calculation
- Implements smart cleanup for overlapping regions

### StyleService
- Downloads and processes map styles
- Supports both MapLibre and Mapbox GL formats
- Handles style patching for offline usage
- Manages API key extraction and URL rewriting

### ResourceServices (Tile, Font, Sprite, Glyph)
- Download and store map resources
- Implement progress tracking
- Handle concurrent downloads with rate limiting
- Provide analytics and statistics

## Common Patterns

### Progress Tracking
```typescript
interface ProgressCallback {
  (progress: { completed: number; total: number; current?: string }): void;
}
```

### Error Handling
```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error: unknown) {
  console.error('Operation failed:', error);
  return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
}
```

### Resource Management
```typescript
// Always clean up resources
const db = await dbPromise;
const tx = db.transaction(['store'], 'readwrite');
try {
  // operations
  await tx.complete;
} catch (error) {
  await tx.abort();
  throw error;
}
```

## Testing Guidelines
- Write unit tests for services
- Mock IndexedDB operations
- Test error conditions and edge cases
- Use meaningful test descriptions

## Performance Considerations
- Batch IndexedDB operations
- Implement proper debouncing for UI updates
- Use Web Workers for heavy computations
- Optimize tile downloading with concurrency limits

## Browser Compatibility
- Support modern browsers with IndexedDB
- Handle quota exceeded errors gracefully
- Implement fallback strategies for storage limitations

## Security
- Validate all inputs
- Sanitize URLs and user data
- Handle API keys securely
- Implement proper CORS handling