# My Trees Runtime Split Plan

Status: draft planning note for Issue #1285  
Baseline main: `3258aef9a0957176a383758f6580d390ec49c77a`

## Purpose

`js/my-trees/my-trees-ui.js` is a large owner-facing UI helper. It currently combines pure value helpers, card visuals, summary rendering, card interaction, and batch rendering. This note defines a small, behavior-preserving split order before runtime code is changed.

## Observed responsibility groups

### 1. Pure helpers

Safest first extraction candidates:

- `escapeHtml(str)`
- `hashSeed(value)`
- `getTreeMomentCount(tree)`
- `getTreeViewCount(tree)`
- `clipText(value, maxLength)`
- `formatDate(dateValue)`

These helpers do not need DOM access and are suitable for a first runtime slice.

### 2. Card visual helpers

Second-phase candidates:

- `getTreeMoodPalette(tree)`
- `buildMiniTreeSVG(tree)`
- `getRepresentativeThumbnail(tree)`
- `getRepresentativeTextMeta(tree, i18n)`
- `buildRepresentativeTextVisual(tree, palette, i18n)`
- `buildTreeThumbVisual(tree, i18n)`
- `getTreeCardMeta(tree, i18n)`
- `getVisibilityActionLabel(tree, i18n)`

These should remain separate from event and batch behavior.

### 3. Summary panel helpers

Later candidates:

- `updateManageSummary(trees, options)`

This touches live page controls, so it should not be the first runtime slice.

### 4. Card interaction behavior

Later candidates:

- card click handling
- keyboard handling
- link propagation handling
- desktop selection behavior
- narrow-screen editor navigation behavior

This area is high-risk and should be split only after earlier helper slices are stable.

### 5. Batch rendering behavior

Later candidates:

- `renderTrees`
- `renderNextBatch`
- `setupScrollContinuation`
- `loadMoreBatch`
- `resetBatchState`

This area affects initial rendering and scroll continuation, so it should be split after pure helper and visual helper slices.

## Recommended PR sequence

1. Extract pure helpers into `js/my-trees/my-trees-utils.js`.
2. Extract card visual helpers into `js/my-trees/my-trees-card-visuals.js`.
3. Extract batch rendering into `js/my-trees/my-trees-batch-render.js`.
4. Extract card interaction behavior into `js/my-trees/my-trees-card-events.js` only after explicit smoke coverage exists.

## Guardrails

- Keep existing `window.LoveBudMyTreesUI` public API compatibility.
- Keep `window.LoveTreeMyTreesUI` compatibility.
- Keep current page script order safe.
- Do not change current card selection behavior.
- Do not change current narrow-screen behavior.
- Do not change CSS.
- Do not change backend/API/Auth/DB/schema.
- Do not touch PR #7, prototype, reference, demo, or variant paths.
- Do not mix reaction/comment work.

## Smoke checklist for runtime slices

Each runtime PR should verify:

- My Trees route opens.
- `LoveBudMyTreesUI` exists.
- Existing public methods still exist.
- Loading, empty, and loaded states remain safe.
- Cards render when data is available.
- Existing management controls remain wired.
- Mobile 375px layout has no horizontal overflow.
- No fatal console errors.
- No backend/API/Auth/DB/schema changes.
- No forbidden paths touched.

## Current recommendation

Start with the pure helper extraction only. Do not combine it with card visuals, batch rendering, or card interaction behavior.
