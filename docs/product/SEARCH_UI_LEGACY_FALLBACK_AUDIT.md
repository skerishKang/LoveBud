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

## Remaining fallback area in `search-ui.js`

### Scroll-load orchestration

`search-ui.js` still owns the scroll-load runtime orchestration. This is the only large remaining cleanup area from the original #1379 list.

Current local state in `search-ui.js`:

- `scrollLoadSentinel`
- `scrollLoadObserver`
- `scrollCheckRaf`
- `isScrollLoadQueued`
- `hasUserScrolledTowardFeed`
- `scrollLoadIntentBound`

Current local functions in `search-ui.js`:

- `canLoadMorePublicTrees`
- `syncScrollLoadSentinel`
- `isSentinelNearViewport`
- `requestScrollLoadMore`
- `scheduleScrollLoadCheck`
- `markScrollLoadIntent`
- `handleScrollLoadKeydown`
- `bindScrollLoadIntentHandlers`
- `ensureScrollLoadSentinel`

Current helper coverage in `js/search/search-scroll-load.js`:

- `canLoadMorePublicTrees(state, callbacks, flags)`
- `getSentinelDoneState(state)`
- `syncScrollLoadSentinel(sentinel, state)`
- `isSentinelNearViewport(sentinel, win)`
- `createScrollLoadSentinel(doc)`
- `isScrollIntentKey(event)`
- `patchSearchUIFactory()`

## Why scroll-load must be split carefully

The scroll-load area is not a simple shadowed fallback. It combines:

- DOM ownership of the sentinel element;
- IntersectionObserver setup and lifecycle;
- requestAnimationFrame throttling;
- user scroll-intent tracking;
- loading queue state;
- call-through to `callbacks.loadMorePublicTrees({ source: 'scroll' })`;
- interaction with sort/filter pagination state through `ensureBrowseControls()` and `syncControlsFromState()`.

Removing this as one large cleanup would be riskier than the previous share/card/preview/mobile slices.

## Recommended scroll-load cleanup order

1. Expand `search-scroll-load.js` with a controller/factory that owns only the local scroll-load state object and pure event handlers.
2. Patch `LoveBudSearchUI.createSearchUI` so the helper can provide `ensureScrollLoadSentinel` and `syncScrollLoadSentinel` while preserving existing call sites in `search-ui.js`.
3. Move sentinel creation and sync into the helper while leaving `requestScrollLoadMore` in `search-ui.js`.
4. Move intent handlers and IntersectionObserver setup into the helper.
5. Move queueing and `callbacks.loadMorePublicTrees({ source: 'scroll' })` only after a browser smoke proves pagination behavior is unchanged.
6. Remove the remaining base scroll-load fallback from `search-ui.js` only after the helper owns the full path.

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
