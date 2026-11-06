---
sidebar_position: 4
title: Storage and cleanup
---

# Storage and cleanup

## See what's stored

```ts
const report = await offlineManager.getComprehensiveStorageAnalytics();

console.log(report.totalStorageSize); // bytes
console.log(report.storageByType); // by tiles, fonts, sprites and so on
console.log(report.recommendations);
```

`getRegionAnalytics()` focuses on regions: their count and sizes, the largest and oldest, and how many are about to expire.

## Check the browser's quota

```ts
const { usage = 0, quota = 0 } = await navigator.storage.estimate();
console.log(`Using ${usage} of ${quota} bytes`);

// Ask the browser not to clear your data when space runs low
await navigator.storage.persist();
```

Browsers can clear storage they haven't been told to keep. If offline maps matter to your users, request persistence.

## Remove old data

| Method | What it removes |
|---|---|
| `deleteRegion(id, styleId)` | One region, keeping anything other regions need. Deleting a style's last region also removes the style and all its data. |
| `deleteStyle(styleId)` | Only the style's own entry. **Its tiles, fonts and sprites stay in storage**, so prefer `deleteRegion`. |
| `cleanupExpiredRegions()` | Regions last updated **more than 30 days ago**. It doesn't read `expiry`. |
| `forceCleanupExpiredRegions()` | Regions past their `expiry` date |
| `performSmartCleanup(options)` | Whatever breaks the limits you set |
| `cleanupOldStyles(days)` | Styles older than a number of days |

Each region's `expiry` is an absolute time in milliseconds since the epoch. It defaults to 30 days after the region is added.

```ts
await offlineManager.downloadRegion({
  ...region,
  expiry: Date.now() + 90 * 24 * 60 * 60 * 1000,
});

await offlineManager.forceCleanupExpiredRegions();
```

`performSmartCleanup` takes limits, and all of them are optional:

```ts
const result = await offlineManager.performSmartCleanup({
  maxAge: 30, // days
  maxRegions: 10,
  maxStorageSize: 500 * 1024 * 1024, // bytes
  priorityPatterns: ['home', 'work'], // region ids to keep
});

console.log(`Deleted ${result.deletedRegions}, freed ${result.freedSpace} bytes`);
```

## Clean up automatically

```ts
const cleanupId = await offlineManager.setupAutoCleanup({ intervalHours: 24, maxAge: 30 });

// Later:
await offlineManager.stopAutoCleanup(cleanupId);
```

The schedule only runs while the page is open. Call it again on each page load.

## Check and repair stored data

`performCompleteMaintenance` runs everything in one call:

```ts
const results = await offlineManager.performCompleteMaintenance({
  cleanupExpired: true,
  verifyIntegrity: true,
  optimizeStorage: true,
  generateReport: true,
  onProgress: (stage, progress) => console.log(stage, progress),
});
```

`verifyAndRepairFonts`, `verifyAndRepairSprites`, `verifyAndRepairGlyphs` and `verifyAndRepairModels` each check one kind of data and remove damaged entries.

## Recover from an incompatible database

The library's IndexedDB database is called `offline-map-db`. If another app on the same origin created it with a newer version, opening it throws a specific error:

```ts
import { dbPromise, OfflineMapDBVersionError, resetOfflineMapDB } from 'map-gl-offline';

try {
  await dbPromise;
} catch (error) {
  if (error instanceof OfflineMapDBVersionError) {
    if (confirm('Offline maps need to be reset. Delete them?')) {
      await resetOfflineMapDB(); // Deletes all stored maps
      location.reload();
    }
  }
}
```
