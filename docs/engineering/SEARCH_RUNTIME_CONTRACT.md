# Search Runtime Dependency Contract

This document records the runtime contract for the LoveBud public Search/Browse page. It exists to prevent future Search/Browse grouping, split, extraction, or loader work from breaking page boot, global dependency order, preview hydration, URL state, mobile preview behavior, and language refresh behavior.

Status: active runtime contract
Last synced for: PR #175 Search/Browse runtime module split

---

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

Current Search submodules that load before the orchestrator:

```text
js/search/search-preview-cache.js
js/search/search-ui.js
js/search/search-url-state.js
```

The page is intentionally public-first. Public tree loading must not depend on Firebase Auth readiness. Auth modules load later for shared navigation state, but Search/Browse public data should remain available through same-origin public `/api/community/*` routes.

---

## 2. Script loading order

`pages/search.html` must preserve this runtime order.

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
11. js/search/search-preview-cache.js
12. js/search/search-ui.js
13. js/search/search-url-state.js
14. js/search.js

15. Firebase SDK
16. js/firebase-config.js

17. i18n dictionaries/core stack
18. js/i18n.js
19. js/shared-header.js

20. auth modules
21. js/auth.js

22. inline LoveTreePageShell.initSharedPage({ renderHeader: true, applyI18n: true })
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
→ search/search-preview-cache
→ search/search-ui
→ search/search-url-state
→ search.js
```

`search.js` remains the runtime orchestrator. The Search submodules are not optional helpers; they are part of the page boot contract.

---

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

### Search runtime submodule globals

```text
window.LoveBudSearchPreviewCache
window.LoveBudSearchUI
window.LoveBudSearchUrlState
```

Required contracts:

- `LoveBudSearchPreviewCache.createPreviewCache(options)` must exist.
- The preview cache module owns preview cache key reads/writes and hydrated tree merge helpers.
- `LoveBudSearchUI.createSearchUI(options)` must exist.
- The UI module owns dynamic browse copy, browse head/controls, mobile preview open/close state, active card state, no-data/error states, and preview loading state.
- `LoveBudSearchUrlState.createSearchUrlState(options)` must exist.
- The URL state module owns query/category/sort/limit/tree parameter read/restore/update behavior and popstate coordination.

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

`applyI18n()` alone is not enough for Search/Browse because several dynamic labels are generated outside static `data-i18n` markup. Search also refreshes labels through Search-specific dynamic copy sync functions.

---

## 4. Globals exposed by Search runtime

The URL state submodule exposes these debug helpers when URL state restore is initialized:

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
window.LoveBudSearchPreviewCache
window.LoveBudSearchUI
window.LoveBudSearchUrlState
```

---

## 5. Orchestrator and submodule ownership boundaries

### `js/search.js`

`js/search.js` owns orchestration and submodule wiring. It should not be described as directly owning every UI, cache, and URL state detail after the PR #175 split.

It coordinates:

- DOM reference collection
- shared state object creation
- renderer initialization
- submodule initialization
- public tree load
- growing tree load
- preview hydration flow
- event binding
- top-level language refresh coordination
- top-level URL/deep-link application flow

### `js/search/search-preview-cache.js`

Owns preview cache helpers:

- read preview cache
- write preview cache
- merge hydrated tree into the current state
- preserve the preview cache TTL/key behavior expected by `js/search.js`

### `js/search/search-ui.js`

Owns dynamic UI helpers:

- static Search/Browse copy sync
- browse heading and badge sync
- browse sort/load-more controls
- load/error/empty state rendering
- active card state
- mobile preview panel open/close/sync
- preview loading state
- clearing selected preview

### `js/search/search-url-state.js`

Owns URL state helpers:

- read `q`, `category`, `sort`, `limit`, and `tree` params
- restore state from URL before user-driven URL writes
- update URL from runtime state after user actions
- apply selected tree from deep-link after data load
- expose compatibility debug helpers

### Existing helper/renderer modules

- `js/search-title-helper.js` owns title, tag, and date cleanup helpers.
- `js/search-data-adapter.js` owns UI-agnostic tree filtering and legacy data build helpers.
- `js/search-card-renderer.js` owns card HTML and list-state HTML.
- `js/search-preview-renderer.js` owns preview panel DOM rendering.
- `js/postgres-client.js` owns browser API facade and captures API dependencies at load time.

---

## 6. Public tree initial load flow

Initial boot flow:

```text
DOMContentLoaded
→ collect DOM references into refs
→ LoveBudSearchCardRenderer.init(resultsList)
→ LoveBudSearchPreviewRenderer.init(preview refs)
→ create shared Search state
→ LoveBudSearchUI.createSearchUI(...)
→ LoveBudSearchPreviewCache.createPreviewCache(...)
→ LoveBudSearchUrlState.createSearchUrlState(...)
→ UI sync for static copy / controls / preview visibility
→ resultsList.innerHTML = CardRenderer.renderLoading()
→ clear selected preview
→ Promise.allSettled([
    loadPublicTrees({ resetSelection: true }),
    loadGrowingTrees()
  ])
→ restoreStateFromUrl()
→ applySelectedTreeFromUrl()
→ bind search input / tag chips / popstate / language handlers
```

`loadPublicTrees()` flow:

```text
cache key = public tree summary + sort + limit
→ sync browse head
→ optional clear selected preview
→ read LoveBudCache
→ render cached trees if available
→ apiClient.getPublicTrees({ view: 'summary', sort, limit })
→ cache API response
→ update state.allTrees
→ renderResults()
```

The public tree summary path must remain public and must not require Firebase Auth readiness.

---

## 7. Growing trees load flow

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

---

## 8. Preview hydrate flow

Tree selection flow:

```text
card click / Enter / Space
→ selectTree(tree, card)
→ state.selectedTreeId = tree.id
→ UI marks active card
→ mobile: open preview panel
→ if tree.memories exists: write preview cache + update preview
→ else hydrateSelectedTreePreview(tree)
```

Lazy hydration flow:

```text
hydrateSelectedTreePreview(tree)
→ state.currentPreviewRequestId increments
→ UI renders preview loading state
→ read preview cache through LoveBudSearchPreviewCache
→ if no cache: apiClient.getPublicTreePreview(tree)
→ write preview cache
→ merge hydrated tree into state.allTrees
→ if stale request or changed selection: return
→ PreviewRenderer.updatePreview(hydratedTree)
→ renderResults(false)
```

The preview request race guard is required. It prevents an older preview request from overwriting the currently selected tree.

---

## 9. Sort / filter / load-more flow

Search dynamically creates sort and load-more controls through the UI submodule.

Contracts:

- Sort controls use `data-browse-sort="latest"` and `data-browse-sort="popular"`.
- Sort change resets `state.currentLimit` to `10`, updates URL state, and reloads public trees.
- Load more increments `state.currentLimit` by `10`, max `60`, updates URL state, and reloads public trees without clearing selection by default.
- Search input updates `state.currentQuery` and filters after a short debounce.
- Tag chips update `state.currentCategory` and re-render filtered results.
- Filtering boundary is `LoveBudSearchAdapter.filterTrees(state.allTrees, state.currentQuery, state.currentCategory)`.

---

## 10. Mobile preview open / close flow

Mobile contract:

```text
mobilePreviewMediaQuery = window.matchMedia('(max-width: 768px)')
```

Behavior:

- On mobile, selecting a tree adds `.is-open` to `#previewSidebar` and scrolls it into view.
- `#previewMobileClose` clears selection and closes the preview panel.
- Desktop/mobile resize does not leave the preview stuck open.

Required DOM IDs:

```text
previewSidebar
previewMobileClose
```

---

## 11. Share link copy flow

Preview renderer owns the share button markup. Search orchestrator owns the delegated click behavior.

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

---

## 12. Language switch refresh flow

Language refresh uses both static i18n and Search-specific dynamic copy refresh.

Flow:

```text
Search UI copy sync
→ applyI18n(), if available
→ manually refresh dynamic Search labels/placeholders/aria labels

onLangChange(callback)
→ Search UI copy sync
→ browse head sync
→ controls sync
```

`i18n-search.js` may also inject Search copy helpers on the Search route. Search code must not assume that injected script has loaded before `search.js`.

---

## 13. Fragile points

1. `search.js` currently loads before Firebase SDK, i18n stack, shared header, and auth modules. This is intentional. Public Search/Browse load must not wait for Firebase Auth.
2. `api/public-tree-adapter.js` must load before `postgres-client.js` because `postgres-client.js` captures `window.LoveTreePublicTreeAdapter` at module evaluation time.
3. `api/base-api-fetch.js` must load before `postgres-client.js` and before `loadGrowingTrees()`.
4. Search renderer and submodule globals are hard dependencies. Missing `LoveBudSearchCardRenderer`, `LoveBudSearchPreviewRenderer`, `LoveBudSearchPreviewCache`, `LoveBudSearchUI`, or `LoveBudSearchUrlState` can break page boot.
5. DOM IDs are runtime contract. Renaming IDs in `pages/search.html` requires coordinated Search JS changes and smoke verification.
6. The preview request race guard is required to avoid stale preview hydration overwrites.
7. URL tree deep-link selection must run after initial data load has settled, because it selects from rendered/loaded tree data.
8. Share link copy depends on preview renderer data attributes.
9. Language refresh is partially manual and must not be reduced to `applyI18n()` only.
10. Search copy injection from i18n can be asynchronous relative to Search boot.

---

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
- `search/search-preview-cache.js`
- `search/search-ui.js`
- `search/search-url-state.js`

Additional hard rules:

- Do not make public Search/Browse load depend on Firebase Auth readiness.
- Do not remove the preview request race guard.
- Do not rename Search DOM IDs without a coordinated Search JS change and smoke verification.
- Do not rename or remove `data-share-tree-link` or `data-share-tree-link-label`.
- Do not mix Search JS refactor with CSS/Auth/API/Modal/runtime work.
- Do not replace `apiClient.getPublicTrees()` with direct fetch unless adapter normalization and cache behavior are preserved.
- Do not replace `LoveTreeBaseApiFetch.apiFetch('/community/growing-trees?limit=3')` without preserving response shape handling.
- Do not remove Search debug globals without a dedicated compatibility cleanup decision.

---

## 15. Minimum smoke checklist

Run this checklist for any Search/Browse script order change, `search.js` split, renderer extraction, data-flow refactor, or Search submodule wiring change.

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

---

## 16. Recommended safe follow-up

Recommended next step before any additional Search JS extraction:

```text
Keep or add contract tests that assert Search script order and runtime global contracts.
```

Safe guard targets:

- `api/public-tree-adapter.js` before `postgres-client.js`
- `postgres-client.js` before `search.js`
- `search-title-helper.js` before renderers and `search.js`
- `search-data-adapter.js` before `search.js`
- `search-card-renderer.js` before `search.js`
- `search-preview-renderer.js` before `search.js`
- `search/search-preview-cache.js` before `search.js`
- `search/search-ui.js` before `search.js`
- `search/search-url-state.js` before `search.js`

Do not immediately perform another extraction without preserving existing globals and script order.
