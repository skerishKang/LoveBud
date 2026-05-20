# Browse/Search UI legacy fallback audit

Issue: #1379
Baseline main: `807e0d0804886f651c5d6c90464387795c896a34`

## Purpose

This document records the remaining legacy or fallback implementations in `js/search/search-ui.js` after the #1281 Browse/Search runtime split.

The current runtime split is behavior-preserving and helper based. The helper modules patch `window.LoveBudSearchUI.createSearchUI` and replace specific UI methods after the base UI object is created.

## Helper modules now active

| Area | Helper file | Current role |
| --- | --- | --- |
| Card activation | `js/search/search-card-events.js` | Replaces `ui.attachCardEvents` and centralizes click, keyboard, interactive target, and narrow mobile direct-open behavior. |
| Preview state | `js/search/search-preview-state.js` | Replaces `ui.markActiveCard`, `ui.syncActiveCard`, and `ui.clearSelectedPreview`. |
| Mobile sheet | `js/search/search-mobile-preview-sheet.js` | Replaces mobile sheet open, close, sync, and bind behavior; also wraps `clearSelectedPreview` close flow. |
| Scroll-load helpers | `js/search/search-scroll-load.js` | Provides sentinel, viewport, load-eligibility, and scroll-intent helpers used by `search-ui.js`. |
| Share link | `js/search/search-share-link.js` | Replaces `ui.bindShareCopyHandler` with helper-based share URL, status text, and label restore behavior. |

## Remaining fallback areas in `search-ui.js`

### 1. Mobile sheet fallback

`search-ui.js` still defines local mobile sheet state and functions:

- `sheetOverlay`
- `savedScrollY`
- `isMobilePreviewMode`
- `_showSheetOverlay`
- `_hideSheetOverlay`
- `setMobilePreviewOpen`
- `syncPreviewVisibility`
- `bindMobilePreviewHandlers`

These are currently shadowed by `search-mobile-preview-sheet.js` after factory patching. Removal needs care because local functions are still referenced by local fallback functions such as `clearSelectedPreview`.

### 2. Preview state fallback

`search-ui.js` still defines:

- `markActiveCard`
- `syncActiveCard`
- `clearSelectedPreview`

These are shadowed by `search-preview-state.js`, but `renderLoadErrorState` still calls the local lexical `clearSelectedPreview`. Removing this area should begin by changing that local call path or proving it is unreachable after patching.

### 3. Card events fallback

`search-ui.js` still defines:

- `treeDataMap`
- `boundContainers`
- `bindDelegatedCardEvents`
- `attachCardEvents`

These are shadowed by `search-card-events.js`. This area is a candidate for a later cleanup slice after confirming no internal local references remain.

### 4. Share link fallback

`search-ui.js` still defines `bindShareCopyHandler`. This is shadowed by `search-share-link.js`.

This is likely one of the safest future cleanup candidates, because the helper fully replaces `ui.bindShareCopyHandler`. A first code cleanup slice can remove the local implementation only if static and browser checks confirm the patched method is always available before `index.js` calls it.

### 5. Scroll-load fallback

`search-ui.js` still owns scroll-load orchestration and keeps fallback logic around the helper calls:

- `canLoadMorePublicTrees`
- `syncScrollLoadSentinel`
- `isSentinelNearViewport`
- `handleScrollLoadKeydown`
- `ensureScrollLoadSentinel`

This should not be removed as a single slice. Scroll-load still has orchestration state in `search-ui.js`, including queue state and scroll intent state.

## Recommended cleanup order

1. Share link fallback cleanup.
2. Card events fallback cleanup.
3. Preview state fallback cleanup.
4. Mobile sheet fallback cleanup.
5. Scroll-load fallback cleanup, only after a separate design check.

## Required validation for any code cleanup PR

Each cleanup PR should remain small and must verify:

- changed files are limited to the intended frontend files;
- no backend/API/Auth/DB/schema changes;
- no PR #7/prototype/reference/demo/variant path changes;
- Browse/Search loads without fatal console errors;
- desktop selected preview behavior is unchanged;
- mobile sheet behavior is unchanged where applicable;
- narrow mobile direct navigation remains unchanged;
- share behavior remains unchanged where applicable;
- card keyboard/accessibility behavior remains unchanged where applicable.

## CTO note

Do not remove all fallback implementations in one PR. The remaining local functions are not just dead code; some are still lexical fallback paths. Cleanup should be incremental and smoke-tested after every slice.
