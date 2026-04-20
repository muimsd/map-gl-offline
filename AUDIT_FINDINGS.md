# Audit Findings — map-gl-offline

**Date:** 2026-04-20
**Context:** Surfaced during the PR #19 audit (programmatic `downloadRegion` API + duplicate-code cleanup). These are **pre-existing** bugs found while reading the surrounding code — they are not introduced by PR #19 and deserve focused follow-up work.

Priority is rated **P1** (correctness bug, can corrupt data or silently drop work) or **P2** (minor/cosmetic).

**Status:** A-E all fixed in the follow-up PR stacked on top of PR #19. F resolved in-place with an explanatory comment.

---

## P1 — `expiry` field has inconsistent semantics (duration on write, timestamp on read)

**Location:** `src/services/regionService.ts:270-276` (the write), with consuming reads at `src/services/cleanupService.ts:228`, `src/managers/offlineMapManager/cleanupManagement.ts:29`, `src/ui/components/RegionList.ts:103`, `src/services/regionService.ts:616` (loadAllStoredRegions).

**Type definition** (`src/types/region.ts:76`):
```ts
/** Expiry timestamp (ms since epoch) */
expiry?: number;
```

**Write path** in `addRegion`:
```ts
const expiryTime = region.expiry || 30 * 24 * 60 * 60 * 1000;
const expiry = Date.now() + expiryTime;   // treats caller's value as a DURATION
```

**Read paths** (all treat `expiry` as an absolute timestamp):
- `cleanupService.ts:228`: `const timeUntilExpiry = region.expiry - currentTime;`
- `cleanupManagement.ts:29`: `if (region.expiry && region.expiry < now)`
- `RegionList.ts:103`: `new Date(region.expiry).toLocaleDateString()`
- `loadAllStoredRegions`: defaults to `Date.now() + 30 days` (a timestamp)

**Impact:** If a caller reads the type doc and passes `expiry: <absolute unix ms>`, `addRegion` stores `Date.now() + <their-timestamp>` — a garbage far-future date. Silent corruption. Dormant today because most callers don't pass `expiry`, but any SDK consumer following the types will hit this.

**Proposed fix:** Make the write side treat `region.expiry` as a timestamp (matching the type doc and all readers). If a caller wants duration-based expiry, they should compute `Date.now() + ms` themselves. Keep the 30-day default behavior when unset.

```ts
const expiry = region.expiry ?? (Date.now() + 30 * 24 * 60 * 60 * 1000);
```

**Test needed:** Round-trip test that passes an absolute timestamp and verifies the stored value equals it (not `now + it`).

---

## P1 — `bboxExists` silently drops regions with identical bounds

**Location:** `src/services/regionService.ts:265-280` (in `addRegion`).

```ts
const bboxExists = styleEntry.regions.some(
  r => JSON.stringify(r.bounds) === JSON.stringify(region.bounds)
);
if (!bboxExists) {
  // ... persist ...
  await db.put('styles', styleEntry);
}
```

**Impact:** If a user adds two regions on the same style with identical bounds (different `region.id`, different `name`), the second call:
- Downloads all its tiles (tile keys are `{styleId}:{sourceId}:{z}:{x}:{y}`, not region-scoped, so tiles land in the `tiles` store)
- Is **silently not persisted** to `styles.regions[]`
- `downloadRegion` returns `{ regionId: region.id, ... }` suggesting success
- Later `deleteRegion(region.id)` lookup fails because the region metadata was never written

The caller now has orphan tiles they can't clean up via the public API.

**Proposed fix:** Either
1. De-dupe by `region.id`, not by bounds. If a region with the same id already exists, update it in place.
2. Drop the de-dup entirely — the caller provided a unique id, that's their contract.
3. If the intent is really "don't re-download the same bbox," return an error/warning instead of silently succeeding.

Option 1 feels most correct. Option 2 is simplest.

**Test needed:** Add two regions with identical bounds but different ids; assert both are present in `listStoredRegions()`.

---

## P1 — `deleteStyleResources` `startsWith` collision across style-id prefixes

**Location:** `src/services/regionService.ts:127-179`.

```ts
// Glyphs
if (
  glyphEntry.key.startsWith(`${styleId}:`) ||
  glyphEntry.key.startsWith(`${styleId}_`) ||
  glyphEntry.key === styleId
) {
  await cursor.delete();
}
// Sprites: same pattern
```

**Impact:** Deleting style `abc` will also delete glyphs/sprites of style `abc_def`, because `"abc_def:fontstack/range".startsWith("abc_")` is true. Cross-style data loss when styleIds share a prefix and the next character is `_`.

**Proposed fix:** Match against an explicit delimiter boundary. Since keys are `{styleId}{delim}…` with `delim ∈ {":", "_"}`:
```ts
const key = glyphEntry.key;
const isMatch =
  key === styleId ||
  (key.startsWith(styleId) &&
   (key[styleId.length] === ':' || key[styleId.length] === '_'));
```

This still accepts both delimiters but requires a clean boundary. Alternatively, standardize on a single delimiter (`:`) for all resource types (see P2 below).

**Test needed:** Pre-seed glyphs for styles `"abc"` and `"abc_def"`, delete style `"abc"`, assert `"abc_def"`'s glyphs are untouched.

---

## P2 — Font deletion uses narrower prefix match than glyphs/sprites

**Location:** `src/services/regionService.ts:138`.

```ts
// Fonts - only ":" delimiter
if (fontEntry.key.startsWith(`${styleId}:`)) { /* delete */ }

// Glyphs/sprites - ":", "_", or exact match
if (entry.key.startsWith(`${styleId}:`) ||
    entry.key.startsWith(`${styleId}_`) ||
    entry.key === styleId) { /* delete */ }
```

**Impact:** Either fonts miss some legitimate keys that use `_`, or glyphs/sprites are over-eager. Divergent behavior across resource types is a maintainability smell at minimum. Tied to **P1 issue C** — probably resolve together.

**Proposed fix:** Audit the actual key formats emitted by `fontService`, `glyphService`, `spriteService` and standardize on one delimiter. Then apply the boundary-aware match from C across all three.

---

## P2 — UX: glyph progress `total` jumps when real download starts

**Location:** `src/services/regionService.ts:428-434` (in `downloadRegion`).

```ts
emit('glyphs', 0, ranges.length * fontFamilies.size, 'Downloading glyphs');
// ... then service's onProgress fires:
onProgress: (progress) => emit('glyphs', progress.completed, progress.total, ...)
```

**Impact:** The pre-emit estimates `total = ranges × families`, but the service's actual total may differ. UI progress bar jumps on first real update. Harmless, but visually janky.

**Proposed fix:** Drop the pre-emit — let the service's first `onProgress` event drive the initial state. Or emit with `total: 0` as "starting" sentinel and let UIs handle it as indeterminate.

---

## P2 — `findStyleEntry` secondary-match by `s.key === styleUrl` looks wrong

**Location:** `src/services/regionService.ts:485-490`.

```ts
return all.find(
  s => s?.key === region.styleUrl || s?.originalUrl === region.styleUrl
);
```

The style `key` is a hash-like identifier, not a URL. Matching it against a URL string should never succeed. But this pattern is copied from existing `isStyleDownloaded` (`styleService.ts:929`), presumably kept for legacy storage rows written before keys were hashes.

**Impact:** Benign dead branch — never matches. Harmless but confusing.

**Proposed fix:** If the legacy case is real, keep it but add a comment explaining. If the legacy case no longer exists in any shipping version, drop the `s.key === styleUrl` check. Check DB version migrations to decide.

---

## Suggested follow-up PR scope

Proposed single PR: **"fix: address audit findings A-D from PR #19"**

1. Fix `expiry` write semantics (P1-A) + add round-trip test.
2. Fix `bboxExists` de-dup behavior (P1-B) — use id-based replacement + test.
3. Boundary-aware prefix matching for all resource deletions (P1-C + P2-D) — one shared helper like `resourceKeyBelongsToStyle(key, styleId)`, applied to fonts/glyphs/sprites consistently.
4. Optional: drop the glyph pre-emit (P2-E) and the dead `key === styleUrl` branch (P2-F).

Estimated size: ~150 lines of src changes + tests.

**Do not start until PR #19 is merged** to avoid rebase churn on overlapping files (especially `regionService.ts`).
