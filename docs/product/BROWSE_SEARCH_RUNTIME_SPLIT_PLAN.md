# Browse/Search Runtime Split Plan

Refs #1281

## Purpose

Document a safe, behavior-preserving split plan for the active Browse/Search UI runtime before any additional mobile Browse tap behavior is implemented.

This plan is based on current `main` inspection after the My Trees runtime split work.

## Current target

```text
js/search/search-ui.js
```

Current entry load order in `pages/search.html` places `search-ui.js` after the card renderer / preview renderer helpers and before URL state, controls, data, preview controller, and `index.js`.

```text
search-card-renderer.js
search-preview-*.js
search-copy.js
search-ui.js
search-url-state.js
search-controls.js
search-data.js
search-preview-controller.js
index.js
```

Any runtime split must preserve this ordering unless a specific helper needs to be loaded directly before `search-ui.js` or directly after it as a compatibility patch.

## Current responsibilities found in `search-ui.js`

### Locale / copy helpers

- `getCurrentLocale()`
- `getSearchCopy()`
- static Browse copy sync
- Browse heading / sort label sync

### Mobile preview sheet behavior

- `isMobilePreviewMode()`
- preview sheet open/close state
- overlay creation/removal
- scroll lock / restore
- resize media query handling

### Selected preview state

- `clearSelectedPreview()`
- `markActiveCard()`
- `syncActiveCard()`
- `state.selectedTreeId` coordination
- `PreviewRenderer.resetPreview()` coordination

### Browse controls and infinite scroll

- results heading creation
- sort controls creation
- scroll-load sentinel creation
- scroll intent listeners
- scroll-load scheduling / queue guard

### Card interaction wiring

- delegated click handler
- delegated keydown handler
- interactive child detection
- mobile `<480px` direct viewer open path
- selected preview fallback on desktop
- card accessibility attributes
- tree data WeakMap mapping
- card image handler migration

### Miscellaneous handlers

- load error rendering / retry
- preview loading state rendering
- share link copy handler
- mobile preview close binding

## Split strategy

Use small PRs. Each PR should extract or wrap one responsibility and preserve existing behavior.

Recommended order:

### Slice 1 — docs plan only

This document.

Expected files:

```text
docs/product/BROWSE_SEARCH_RUNTIME_SPLIT_PLAN.md
```

No runtime behavior change.

### Slice 2 — pure copy / locale helpers

Extract stable pure-ish helpers that do not alter DOM event behavior.

Candidate file:

```text
js/search/search-ui-copy.js
```

Candidate API:

```text
window.LoveBudSearchUICopy = {
  getCurrentLocale,
  getSearchCopy,
  getSortCopy
}
```

Rules:

- Load before `search-ui.js`.
- `search-ui.js` should delegate to the helper when present and keep inline fallbacks.
- Do not touch card click, mobile sheet, scroll-load, selected preview, or data loading.

Smoke:

- Browse page loads.
- Korean/English copy still renders.
- search input placeholder and preview labels still update.
- no fatal console errors.

### Slice 3 — card event helpers

Extract delegated card click / keydown decision logic only.

Candidate file:

```text
js/search/search-card-events.js
```

Candidate API:

```text
window.LoveBudSearchCardEvents = {
  isInteractiveTarget,
  isActivationKey,
  shouldUseMobileOpen,
  getCardActivationAction,
  resolveViewerHref
}
```

Rules:

- Preserve current desktop body click -> selected preview behavior.
- Preserve current mobile `<480px` body click / activation -> public viewer navigation behavior.
- Preserve interactive child ignore behavior.
- Preserve Enter / Space keyboard activation behavior.
- Do not implement new mobile behavior beyond the existing path.

Smoke:

- Desktop card body click selects preview and does not navigate.
- Mobile `<480px` card body tap opens public viewer.
- CTA / nested link / share button does not trigger duplicate card selection.
- Enter / Space behavior unchanged.
- no fatal console errors.

### Slice 4 — selected preview state helpers

Extract active-card / selected-tree coordination.

Candidate file:

```text
js/search/search-preview-state.js
```

Candidate API:

```text
window.LoveBudSearchPreviewState = {
  clearSelectedPreview,
  markActiveCard,
  syncActiveCard
}
```

Rules:

- Preserve `state.selectedTreeId` semantics.
- Preserve `.is-active` and `aria-pressed` behavior.
- Preserve `PreviewRenderer.resetPreview()` behavior.
- Preserve mobile sheet close behavior when clearing selection.

Smoke:

- Desktop card selection updates preview.
- previous selected card loses `.is-active`.
- new selected card receives `.is-active` and `aria-pressed=true`.
- clearing preview resets preview panel and closes mobile sheet.
- URL state / selected tree URL flow remains unchanged.

### Slice 5 — mobile preview sheet helpers

Extract overlay and scroll lock behavior.

Candidate file:

```text
js/search/search-mobile-preview-sheet.js
```

Candidate API:

```text
window.LoveBudSearchMobilePreviewSheet = {
  isMobilePreviewMode,
  setMobilePreviewOpen,
  syncPreviewVisibility,
  bindMobilePreviewHandlers
}
```

Rules:

- Preserve scroll lock and restore behavior exactly.
- Preserve overlay click -> clear preview.
- Preserve resize behavior.
- Do not introduce a mobile redesign.

Smoke:

- Mobile selected preview opens as bottom sheet.
- overlay click closes the sheet.
- scroll position is restored after close.
- desktop resize cleans overlay and lock state.
- no fatal console errors.

### Slice 6 — scroll-load / Browse controls helpers

Extract scroll-load sentinel and sort controls only after the lower-risk interaction slices are stable.

Candidate files:

```text
js/search/search-scroll-load.js
js/search/search-browse-controls.js
```

Rules:

- Preserve initial load and `loadMorePublicTrees()` behavior.
- Preserve `currentLimit`, `hasMoreTrees`, and `isLoadingMore` state semantics.
- Preserve sort chip behavior and URL state updates.

Smoke:

- initial Browse load works.
- sort Latest / Popular works.
- scroll-load loads more only after user scroll intent.
- loading sentinel state updates correctly.
- no duplicate load calls.
- no fatal console errors.

## Non-goals

- No mobile direct tree open feature beyond preserving the current code path.
- No Browse redesign.
- No public viewer runtime changes.
- No search ranking or data adapter changes.
- No backend/API/Auth/DB/schema changes.
- No PR #7 / prototype / reference / demo / variant path changes.

## PR rules

- Use `Refs #1281` only.
- Do not use issue close keywords until the final audit determines the issue is fully complete.
- Prefer Draft PRs for runtime slices until browser smoke is complete.
- Browser smoke is required for any slice that changes card events, preview sheet behavior, selected preview state, or scroll-load behavior.

## Final audit checklist

Before closing #1281:

- All runtime slices merged.
- `pages/search.html` script order verified.
- Public global compatibility verified.
- Browse load behavior unchanged.
- Desktop selected preview behavior unchanged.
- Mobile / narrow behavior unchanged.
- Card keyboard behavior unchanged.
- CTA / share / interactive child behavior unchanged.
- No backend/API/Auth/DB/schema changes.
- No forbidden path changes.
- Browser smoke comments exist for all runtime behavior slices.
