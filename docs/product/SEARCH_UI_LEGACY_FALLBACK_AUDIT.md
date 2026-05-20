# Browse/Search UI legacy fallback audit

Issue: #1379
Original audit baseline: `807e0d0804886f651c5d6c90464387795c896a34`
Current post-cleanup baseline: `49875888407b12d574fa52ab50123e8b1a6e59fe`

## Purpose

This document tracks the legacy or fallback implementations in `js/search/search-ui.js` after the #1281 Browse/Search runtime split.

The #1379 cleanup is intentionally incremental. Each behavior area should be removed only after its helper module owns the runtime path and browser smoke verifies no behavior change.

## Completed cleanup slices

| Area | Helper file | Cleanup status |
| --- | --- | --- |
| Share link | `js/search/search-share-link.js` | Completed by #1381. The base `bindShareCopyHandler` fallback was removed from `search-ui.js`. |
| Card activation | `js/search/search-card-events.js` | Completed by #1382 and #1383. The helper no longer depends on a base `ui.attachCardEvents`, and the base card event fallback was removed from `search-ui.js`. |
| Preview state | `js/search/search-preview-state.js` | Completed by #1384 and #1385. The helper now owns `markActiveCard`, `syncActiveCard`, `clearSelectedPreview`, and `renderLoadErrorState`; the base preview state fallback was removed from `search-ui.js`. |
| Mobile sheet | `js/search/search-mobile-preview-sheet.js` | Completed by #1386. The base mobile sheet fallback was removed from `search-ui.js`, and the static test now validates the helper contract. |

| Scroll-load sentinel & intent | `js/search/search-scroll-load.js` | Partial. Ownership of sentinel creation, observer lifecycle, RAF scheduling wrapper, and intent binding are moved to the helper (PRs #1388 - #1391). Fallback implementations for `isSentinelNearViewport`, `syncScrollLoadSentinel`, and `canLoadMorePublicTrees` were removed from `search-ui.js`. |

## Remaining fallback area in `search-ui.js`

### Scroll-load request orchestration

`search-ui.js` still owns the core scroll-load state and request queueing orchestration. This is the last remaining cleanup area from the original #1379 list.

Current local state preserved in `search-ui.js`:

- `scrollCheckRaf` (managed via helper getter/setter)
- `isScrollLoadQueued`
- `hasUserScrolledTowardFeed`

Current orchestration functions preserved in `search-ui.js`:

- `requestScrollLoadMore` (core API call queueing)
- `scheduleScrollLoadCheck` (delegates to helper wrapper but holds scope)
- `markScrollLoadIntent`
- `handleScrollLoadKeydown`
- `ensureScrollLoadSentinel` (delegates to helper)

## Recommended next scroll-load cleanup steps

1. Expand `search-scroll-load.js` with a controller/factory that owns the local `isScrollLoadQueued` and `hasUserScrolledTowardFeed` states completely.
2. Move `requestScrollLoadMore` queueing logic and `callbacks.loadMorePublicTrees({ source: 'scroll' })` call into the helper.
3. Remove the remaining orchestration and intent binding wrappers from `search-ui.js` only after a browser smoke proves pagination behavior is unchanged.

## Required validation for scroll-load code PRs

Each scroll-load PR should remain small and must verify:

- changed files are limited to the intended frontend files;
- no backend/API/Auth/DB/schema changes;
- no PR #7/prototype/reference/demo/variant path changes;
- Browse/Search loads without fatal console errors;
- scroll-load sentinel is created once;
- sentinel hidden/loading/idle classes update correctly;
- user scroll intent gates auto-load correctly;
- repeated scroll does not double-queue loads;
- sort/filter changes still reset pagination state correctly;
- desktop selected preview behavior is unchanged;
- mobile sheet behavior is unchanged;
- narrow mobile direct navigation remains unchanged;
- share behavior remains unchanged.

## CTO note

#1379 is close to completion, but scroll-load should be treated as its own mini-sequence. The next code PR should be a preparation slice in `search-scroll-load.js`, not a direct deletion of the remaining scroll-load functions from `search-ui.js`.
