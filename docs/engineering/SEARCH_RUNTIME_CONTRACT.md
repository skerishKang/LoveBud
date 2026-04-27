# Search Runtime Dependency Contract

This document records the runtime contract for the LoveBud public Search/Browse page. It exists to prevent future `search.js` grouping, split, or extraction work from breaking the page boot sequence, global dependency order, preview hydration, URL state, and language refresh behavior.

## 1. Current active Search runtime purpose

The active Search/Browse runtime is the public appreciation hub for public LoveTrees.

Current active route:

```text
pages/search.html
```

Current orchestrator:

```text
js/search.js
```

The page is intentionally public-first. Public tree loading must not depend on Firebase Auth readiness. Auth modules load later for shared navigation state, but Search/Browse public data should remain available through same-origin public `/api/community/*` routes.

## 2. Script loading order

`pages/search.html` must preserve this runtime order:

```text
1.  js/page-shell.js
2.  js/cache-utils.js
3.  js/api/auth-policy.js
4.  js/api/base-api-fetch.js
5.  js/api/public-tree-adapter.js
6.  js/postgres-client.js

7.  js/search-title-helper.js
8.  js/search-data-adapter.js
9.  js/search-card-renderer.js
10. js/search-preview-renderer.js
11. js/search.js

12. Firebase SDK
13. js/firebase-config.js

14. i18n dictionaries/core stack
15. js/i18n.js
16. js/shared-header.js

17. auth modules
18. js/auth.js

19. inline LoveTreePageShell.initSharedPage({ renderHeader: true, applyI18n: true })
```

The critical pre-`search.js` chain is:

```text
cache-utils
→ api/auth-policy
→ api/base-api-fetch
→ api/public-tree-adapter
→ postgres-client
→ search-title-helper
→ search-data-adapter
→ search-card-renderer
→ search-preview-renderer
→ search.js
```

## 3. Required globals before `search.js`

`search.js` assumes the following globals already exist by the time its `DOMContentLoaded` handler runs.

### Search render/data globals

```text
window.LoveBudSearchCardRenderer
window.LoveBudSearchPreviewRenderer
window.LoveBudSearchAdapter
window.LoveBudSearchTitleHelper
```

Required contracts:

- `LoveBudSearchCardRenderer.init(resultsList)` must exist.
- `LoveBudSearchCardRenderer.renderLoading()` must exist.
- `LoveBudSearchCardRenderer.renderResults(trees, options)` must exist.
- `LoveBudSearchCardRenderer.renderNoTreesState()` must exist.
- `LoveBudSearchCardRenderer.renderEmptySearchState()` must exist.
- `LoveBudSearchCardRenderer.renderTreeCard(tree, index)` must exist.
- `LoveBudSearchPreviewRenderer.init(domRefs)` must exist.
- `LoveBudSearchPreviewRenderer.resetPreview()` must exist.
- `LoveBudSearchPreviewRenderer.renderLoadingPreview(tree)` should exist.
- `LoveBudSearchPreviewRenderer.updatePreview(tree)` must exist.
- `LoveBudSearchAdapter.filterTrees(trees, query, category)` must exist.

### API/cache globals

```text
window.LoveBudCache
window.LoveTreeBaseApiFetch
window.LoveTreePublicTreeAdapter
window.apiClient
```

Required contracts:

- `LoveBudCache.get(key)` and `LoveBudCache.set(key, value, ttl)` are used for public tree summary and preview caches.
- `LoveTreeBaseApiFetch.apiFetch(endpoint, options)` is used directly for growing tree loads.
- `LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees)` is used for growing tree normalization.
- `apiClient.getPublicTrees(options)` is used for public tree summary loading.
- `apiClient.getPublicTreePreview(tree)` is used for lazy preview hydration.

### Language globals

Search uses these globals when available:

```text
window.i18nSearch
window.i18n
window.getCurrentLang
window.applyI18n
window.onLangChange
```

`applyI18n()` alone is not enough for Search/Browse because several dynamic labels are generated outside static `data-i18n` markup. Search also refreshes labels through its own static/dynamic copy sync functions.

## 4. Globals exposed by `search.js`

`search.js` exposes these debug helpers when URL state restore is initialized:

```text
window.readUrlState
window.updateUrlState
window.restoreStateFromUrl
```

Do not remove these without a dedicated compatibility cleanup decision.

Other Search modules expose these globals:

```text
window.LoveBudSearchTitleHelper
window.LoveBudSearchAdapter
window.LoveBudSearchCardRenderer
window.LoveBudSearchPreviewRenderer
```

## 5. Public tree initial load flow

Initial boot flow:

```text
DOMContentLoaded
→ collect DOM references
→ LoveBudSearchCardRenderer.init(resultsList)
→ LoveBudSearchPreviewRenderer.init(preview refs)
→ ensureBrowseControls()
→ syncStaticBrowseCopy()
→ syncPreviewVisibility()
→ resultsList.innerHTML = CardRenderer.renderLoading()
→ clearSelectedPreview()
→ Promise.allSettled([
    loadPublicTrees({ resetSelection: true }),
    loadGrowingTrees()
  ])
→ restoreStateFromUrl()
→ applySelectedTreeFromUrl()
→ bind search input / tag chips / popstate handlers
```

`loadPublicTrees()` flow:

```text
cache key = public_trees_summary_latest_10 + sort + limit
→ syncBrowseHead()
→ optional clearSelectedPreview()
→ read LoveBudCache
→ render cached trees if available
→ apiClient.getPublicTrees({ view: 'summary', sort, limit })
→ cache API response
→ update allTrees
→ renderResults()
```

The public tree summary path must remain public and must not require Firebase Auth readiness.

## 6. Growing trees load flow

Growing trees are loaded through the base API layer directly, not through `apiClient`.

```text
loadGrowingTrees()
→ require LoveTreeBaseApiFetch.apiFetch
→ GET /api/community/growing-trees?limit=3
→ rawTrees = array or response.data
→ LoveTreePublicTreeAdapter.buildPublicTreeSummaryModels(rawTrees)
→ enrich emotionTags/timeRange
→ renderGrowingResults()
```

If this request fails, the growing section may be hidden. It should not block public tree summary rendering.

## 7. Preview hydrate flow

Tree selection flow:

```text
card click / Enter / Space
→ selectTree(tree, card)
→ selectedTreeId = tree.id
→ markActiveCard(card)
→ mobile: open preview panel
→ if tree.memories exists: write preview cache + update preview
→ else hydrateSelectedTreePreview(tree)
```

Lazy hydration flow:

```text
hydrateSelectedTreePreview(tree)
→ currentPreviewRequestId increments
→ render preview loading state
→ read preview cache
→ if no cache: apiClient.getPublicTreePreview(tree)
→ write preview cache
→ merge hydrated tree into allTrees
→ if stale request or changed selection: return
→ PreviewRenderer.updatePreview(hydratedTree)
→ renderResults(false)
```

The `currentPreviewRequestId` race guard is required. It prevents an older preview request from overwriting the currently selected tree.

## 8. Sort / filter / load-more flow

Search dynamically creates sort and load-more controls through `ensureBrowseControls()`.

Contracts:

- Sort controls use `data-browse-sort="latest"` and `data-browse-sort="popular"`.
- Sort change resets `currentLimit` to `10`, updates URL state, and reloads public trees.
- Load more increments `currentLimit` by `10`, max `60`, updates URL state, and reloads public trees without clearing selection by default.
- Search input updates `currentQuery` and filters after a short debounce.
- Tag chips update `currentCategory` and re-render filtered results.
- Filtering boundary is `LoveBudSearchAdapter.filterTrees(allTrees, currentQuery, currentCategory)`.

## 9. Mobile preview open / close flow

Mobile contract:

```text
mobilePreviewMediaQuery = window.matchMedia('(max-width: 768px)')
```

Behavior:

- On mobile, selecting a tree adds `.is-open` to `#previewSidebar` and scrolls it into view.
- `#previewMobileClose` calls `clearSelectedPreview()`.
- `syncPreviewVisibility()` reconciles preview open state when the media query changes.
- Desktop mode must remove `.is-open` and rely on the normal sidebar layout.

Required DOM IDs:

```text
previewSidebar
previewMobileClose
```

## 10. Share link copy flow

Preview renderer owns the share button markup. Search orchestrator owns the click behavior.

Markup contract:

```text
data-share-tree-link="<treeId>"
data-share-tree-link-label
```

Flow:

```text
document click delegation
→ closest('[data-share-tree-link]')
→ build URL /pages/search.html?tree=<treeId>
→ navigator.clipboard.writeText(url)
→ temporary copied/failed label
→ restore original label after timeout
```

Do not rename or remove these data attributes in Search refactors.

## 11. Language switch refresh flow

Language refresh uses both static i18n and Search-specific dynamic copy refresh.

Flow:

```text
syncStaticBrowseCopy()
→ applyI18n(), if available
→ manually refresh dynamic Search labels/placeholders/aria labels

onLangChange(callback)
→ syncStaticBrowseCopy()
→ syncBrowseHead()
→ syncControlsFromState()
```

`i18n-search.js` also injects `search-copy-ui.js` on the Search route. Search code must not assume that injected script has loaded before `search.js`.

## 12. Renderer / data / helper / orchestrator boundaries

### `js/search.js`

Owns orchestration:

- DOM references
- page state
- public tree load
- growing tree load
- preview hydration
- event binding
- mobile preview state
- URL state
- cache read/write calls
- language refresh coordination

### `js/search-title-helper.js`

Owns title, tag, and date cleanup helpers. Exports:

```text
window.LoveBudSearchTitleHelper
```

### `js/search-data-adapter.js`

Owns UI-agnostic tree filtering and legacy data build helpers. Exports:

```text
window.LoveBudSearchAdapter
```

Current orchestrator boundary primarily depends on `filterTrees()`.

### `js/search-card-renderer.js`

Owns card HTML and list-state HTML. Exports:

```text
window.LoveBudSearchCardRenderer
```

It also owns card image fallback handlers used by inline `onerror` / `onload` in generated card markup.

### `js/search-preview-renderer.js`

Owns preview panel DOM rendering. Exports:

```text
window.LoveBudSearchPreviewRenderer
```

It owns preview CTA/share markup and preview media fallback handlers.

### `js/postgres-client.js`

Owns browser API facade:

```text
window.apiClient.getPublicTrees()
window.apiClient.getPublicTreePreview()
```

`postgres-client.js` captures API dependencies at load time, so the API adapter/base fetch scripts must load before it.

## 13. Fragile points

1. `search.js` currently loads before Firebase SDK, i18n stack, shared header, and auth modules. This is intentional. Public Search/Browse load must not wait for Firebase Auth.
2. `api/public-tree-adapter.js` must load before `postgres-client.js` because `postgres-client.js` captures `window.LoveTreePublicTreeAdapter` at module evaluation time.
3. `api/base-api-fetch.js` must load before `postgres-client.js` and before `loadGrowingTrees()`.
4. Search renderer globals are hard dependencies. Missing `LoveBudSearchCardRenderer` or `LoveBudSearchPreviewRenderer` can break page boot.
5. DOM IDs are runtime contract. Renaming IDs in `pages/search.html` requires coordinated Search JS changes and smoke verification.
6. `currentPreviewRequestId` is required to avoid stale preview hydration overwrites.
7. `applySelectedTreeFromUrl()` must run after initial data load has settled, because it selects from rendered/loaded tree data.
8. Share link copy depends on preview renderer data attributes.
9. Language refresh is partially manual and must not be reduced to `applyI18n()` only.
10. `search-copy-ui.js` injection from i18n is asynchronous relative to Search boot.

## 14. Forbidden changes

Do not move `search.js` before:

- `cache-utils.js`
- `api/auth-policy.js`
- `api/base-api-fetch.js`
- `api/public-tree-adapter.js`
- `postgres-client.js`
- `search-title-helper.js`
- `search-data-adapter.js`
- `search-card-renderer.js`
- `search-preview-renderer.js`

Additional hard rules:

- Do not make public Search/Browse load depend on Firebase Auth readiness.
- Do not remove the preview request race guard.
- Do not rename Search DOM IDs without a coordinated Search JS change and smoke verification.
- Do not rename or remove `data-share-tree-link` or `data-share-tree-link-label`.
- Do not mix Search JS refactor with CSS/Auth/API/Modal/runtime work.
- Do not replace `apiClient.getPublicTrees()` with direct fetch unless adapter normalization and cache behavior are preserved.
- Do not replace `LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3')` without preserving response shape handling.
- Do not remove Search debug globals without a dedicated compatibility cleanup decision.

## 15. Minimum smoke checklist

Run this checklist for any Search/Browse script order change, `search.js` split, renderer extraction, or data-flow refactor.

### Page boot

- `/pages/search.html` loads without a blocking JS exception.
- Skeleton cards appear first.
- Results, empty state, or graceful error state appears.
- Shared header renders.

### Network

- Public tree summary request succeeds or shows graceful error state.
- Growing trees request succeeds or the growing section hides gracefully.
- Public Browse boot does not depend on private `/api/trees` or Firebase Auth readiness.

### Public tree render

- Cards render.
- First card featured styling is preserved.
- Image fallback does not create blocker errors.

### Preview

- Clicking a card opens preview.
- Keyboard Enter/Space on a card opens preview.
- Loading preview appears before hydration completes.
- Preview hydration calls the public community memories path through `apiClient.getPublicTreePreview()`.
- Active card `aria-pressed` updates.
- Stale preview response does not overwrite the latest selected card.

### Mobile

- At 390px width, card click opens the preview panel.
- Preview close button clears selection and closes the panel.
- Desktop/mobile resize does not leave the preview stuck open.

### Search / filter / sort

- Search input filters after debounce.
- Tag chips filter by category.
- Latest/Popular controls update state and reload list.
- Load more increments limit up to 60 and updates button visibility/state.

### URL state

- `?q=...` restores query.
- `?category=...` restores category.
- `?sort=popular` restores sort.
- `?limit=20` restores limit.
- `?tree=<id>` selects and hydrates a tree after initial load.

### Share

- Preview share button copies `/pages/search.html?tree=<id>`.
- Copied/failed label changes temporarily and restores.

### Language

- Language switch triggers Search copy refresh.
- Static text, placeholder, preview labels, sort controls, and load-more label refresh.

### Console

- No new blocking JS errors.
- Expected backend/API warnings are documented when backend data is unavailable.

## 16. Recommended safe follow-up

Recommended next step before any Search JS extraction:

```text
Add a docs/test guard that asserts Search script order and runtime global contracts.
```

Safe guard targets:

- `api/public-tree-adapter.js` before `postgres-client.js`
- `postgres-client.js` before `search.js`
- `search-title-helper.js` before `search-card-renderer.js` and `search-preview-renderer.js`
- `search-data-adapter.js` before `search.js`
- `search-card-renderer.js` before `search.js`
- `search-preview-renderer.js` before `search.js`

Do not immediately extract `search.js`. The first follow-up should be a no-move documentation or contract-test guard. After that, extraction should happen one seam at a time, preserving existing globals and script order.
