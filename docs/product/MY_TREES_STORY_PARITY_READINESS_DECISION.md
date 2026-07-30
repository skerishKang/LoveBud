# My Trees Story Parity Readiness — Audit Decision

- **Issue:** #3717 `[Product][Story] Audit My Trees Story parity readiness and stop conditions`
- **Role:** Web Implementation Developer (컴5)
- **Scope:** Source-only readiness audit. No code, CSS, HTML, JS, test, localStorage, default-mode, or preview-hub changes. No browser, screenshot, Preview, Production, Cloudflare, backend/API/DB/Auth work. No PR Ready, merge, or #3654 closure.
- **Starting `origin/main`:** `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`
- **Parent product issue:** #3654 — **Keep OPEN**
- **Related completed:** #3655 / PR #3656 (Browse Story foundation), #3666 (transition correction), #3703 / PR #3708 (Browse refinement)
- **Production acceptance blocker:** #3699 — **Keep OPEN**
- **Branch:** `docs/my-trees-story-parity-readiness-3717`
- **Worktree:** `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3717-mytrees-story-readiness`

---

## 1. Executive Summary

Browse Story mode (#3655) is implemented as a **Browse-only opt-in** fourth view mode on the shared tree-view-mode switcher. The Story controller (`js/search/search-story-view.js`) is a pure presentation module that groups only the currently loaded `#resultsList` cards — it reuses canonical card DOM, performs no fetch/API/DB/auth work, and binds no per-card listeners.

My Trees uses the **same shared switcher** but passes no `modes` option, keeping exactly `large / compact / list` with a `compact` default and a separate storage key (`lovebud:myTrees:viewMode`). A stored `story` value on the My Trees key is treated as invalid and falls back to `compact` without rewriting the stored value.

The audit concludes that **Story mode is NOT currently ready for My Trees implementation** — not because of technical impossibility, but because:

1. **#3699 (Production acceptance blocker) is OPEN** — Browse Story mode has not yet received Production visual acceptance, so no parallel surface implementation may begin.
2. **Preview hub coexistence is unresolved** — My Trees' primary interaction surface is the appreciation preview hub (`#myTreesHubPanel`), which auto-selects the first tree. Story mode's card-grouping semantics (hide non-visible cards, show prev/next) conflict with the hub's selection-driven flow.
3. **Owner-specific boundaries are significant** — My Trees has auth, owner actions (rename/delete/visibility), create-tree CTA, and auto-select-first-tree behavior that Browse Story does not account for.

The recommended path is: **resolve #3699 first, then make a product decision on My Trees Story mode, then implement as a separate adapter child.**

---

## 2. Source Analysis

### 2.1 Browse Story Controller

**File:** `js/search/search-story-view.js` (745 lines)
**Public API:** `window.LoveBudBrowseStoryView.init({ results, navMount })`

| Aspect | Finding |
|---|---|
| **Scope** | Groups ONLY the currently loaded `#resultsList` cards. Position indicator is a LOCAL group index over loaded results — NOT a backend page number. |
| **Card reuse** | Reuses canonical `.tree-card[data-tree-id]` DOM built by `LoveBudTreeCardComposition` via `js/search/search-card-renderer.js`. No card HTML is rebuilt, no card content rewritten, no new card routes created. |
| **Network capability** | None. No `fetch`, `XMLHttpRequest`, `axios`, `apiClient`, `firebase`, `postgres`, `DATABASE_URL`, `process.env`, `child_process`, or `pg`. |
| **Card listeners** | None. Only `document` keydown, nav button click, and matchMedia breakpoint `change` listeners. |
| **Grouping** | `collectCards()` reads direct children of `#resultsList` with `.tree-card` + `data-tree-id`, excluding skeleton cards. Group size: 3 (≥1200px), 2 (768–1199px), 1 (<768px). |
| **Keyboard** | `ArrowLeft`/`ArrowRight` step one group, `Home`/`End` jump to first/last. Editable guard: `input, textarea, select, [contenteditable]` keys never intercepted. Modifier keys and key repeat ignored. |
| **Reduced motion** | `prefersReducedMotion()` checks `prefers-reduced-motion: reduce`. When active, transitions are skipped (immediate swap, no wrappers). CSS also has `@media (prefers-reduced-motion: reduce)` block. |
| **Transitions** | Bidirectional: outgoing + incoming layers animate simultaneously (340ms, `cubic-bezier(0.22, 1, 0.36, 1)`, ±8% translate). Outgoing layer is `inert` + `aria-hidden`. `aria-busy` on `#resultsList`. |
| **Result-set replacement** | `MutationObserver` on `#resultsList` (`childList` only). On new result set, group index resets to 0. Skeleton-only states hide navigation. |
| **No autoplay/looping** | No `setInterval`, `autoplay`, `requestAnimationFrame`, `infinite`, or wraparound. |
| **No numbered pagination** | No `page=`, `pageSize`, `totalPages`, `offset`, `limit`, `loadMore`, `nextPage`, `fetchPage`, ellipsis, or numbered page list. |
| **i18n** | Fallback strings in module; real keys in `js/i18n/i18n-search.js` (`search.story.*`). |
| **Load order** | After `js/tree-view-mode-switcher.js`, before `js/search/search-page-shell-init.js`. |

### 2.2 Tree View Mode Switcher

**File:** `js/tree-view-mode-switcher.js` (323 lines)
**Public API:** `window.LoveBudTreeViewModeSwitcher`

| Aspect | Finding |
|---|---|
| **Three base modes** | `MODES = ['large', 'compact', 'list']` — default capability for every surface. |
| **Known modes** | `KNOWN_MODES = ['large', 'compact', 'list', 'story']` — `story` is known-but-not-default. |
| **Surface capability** | Per-call `modes` option. Browse passes `['large', 'compact', 'list', 'story']`. My Trees passes no `modes` (defaults to base 3). |
| **My Trees exclusion** | My Trees bootstrap (`js/my-trees/my-trees-page-bootstrap.js`) does not mention `story` or pass a `modes` option. A stored `story` on `lovebud:myTrees:viewMode` is rejected by `isValidMode` → falls back to `compact`. Stored value is **never deleted or rewritten**. |
| **localStorage** | `safeLocalStorage()` with probe. `getMode(storageKey, defaultMode, allowedModes?)` reads; `setMode(storageKey, mode, allowedModes?)` writes. Invalid stored values fall back without rewrite. |
| **Storage keys** | Browse: `lovebud:browse:viewMode`. My Trees: `lovebud:myTrees:viewMode`. Separate keys — no cross-contamination. |
| **Default mode** | `compact` for both surfaces. |
| **Frozen arrays** | `MODES` and `KNOWN_MODES` are `Object.freeze`d. Unknown tokens in `modes` option are dropped. |
| **Observer** | `MutationObserver` on `documentElement` (subtree) re-applies the latest user-selected mode (via `getMode` or `currentMode`) when the target is re-rendered. Never uses a captured `initial` value. |
| **Data attribute** | `data-tree-view-mode` set on target element (`#resultsList` for Browse, `#trees-grid` for My Trees). |

### 2.3 Mode Capability Sets

| Surface | Modes passed | Default | Storage key | Story accepted? |
|---|---|---|---|---|
| Browse (`pages/search.html`) | `['large', 'compact', 'list', 'story']` | `compact` | `lovebud:browse:viewMode` | Yes |
| My Trees (`pages/my-trees.html`) | none (base 3) | `compact` | `lovebud:myTrees:viewMode` | No — stored `story` falls back to `compact` |

### 2.4 localStorage Persistence

- **Browse:** `lovebud:browse:viewMode` — accepts `story` if stored.
- **My Trees:** `lovebud:myTrees:viewMode` — rejects `story`; falls back to `compact` without rewriting the stored value.
- **Cross-key isolation:** A user who sets Story on Browse does NOT get Story on My Trees (separate keys, separate capability).
- **No rewrite policy:** Invalid/out-of-capability stored values are never deleted or rewritten — `getMode` returns the fallback, `setMode` returns `false`.

### 2.5 Story Grouping

- Groups only currently loaded `#resultsList` cards (direct children with `.tree-card` + `data-tree-id`).
- Group size determined by viewport breakpoint: 3 (≥1200px), 2 (768–1199px), 1 (<768px).
- `data-story-group-size` attribute set to actual visible card count — CSS columns follow this attribute (no empty trailing slot, centered single card).
- Hidden cards use `hidden` attribute (`display: none !important` in CSS) — leave layout, accessibility tree, and tab order.
- On result-set replacement (search/filter/sort/load-more), group index resets to 0.

### 2.6 Keyboard Navigation

- Active only when Story mode is active.
- `ArrowLeft` → previous group, `ArrowRight` → next group, `Home` → first group, `End` → last group.
- Editable guard: keys from `input`, `textarea`, `select`, `[contenteditable]` are never intercepted.
- Modifier keys (`ctrlKey`, `altKey`, `metaKey`, `shiftKey`) and key repeat are ignored.
- One keydown moves at most one group. Focus is never forcibly moved into card internals.
- Indicator is `role="status"` with localized assistive string.

### 2.7 Reduced Motion

- JS: `prefersReducedMotion()` checks `window.matchMedia('(prefers-reduced-motion: reduce)')`. When active, transitions are skipped (immediate swap, no wrappers, no `aria-busy`).
- CSS: `@media (prefers-reduced-motion: reduce)` block disables animations and transitions for all Story elements (`.is-story-entering`, `.browse-story-layer-outgoing`, `.browse-story-layer-incoming`, `.browse-story-nav-btn`).

### 2.8 Story CSS and Tokens

**File:** `css/tree-view-mode.css` (1109 lines)

- **Browse-scoped only:** All Story selectors target `#resultsList[data-tree-view-mode="story"]` or `.browse-story-*`. No `.trees-grid` Story selectors exist (verified by contract test #20).
- **Tokens:** Uses `--lovetree-card-grid-gap`, `--outline-variant`, `--on-surface-variant`, `--on-surface`, `--primary`, `--lovetree-card-radius-lg`. No hardcoded travel palette.
- **Card geometry:** Story cards release the legacy height budget (`height: auto`, `min-height: 0`) so meta row/CTA are never clipped. `hidden` cards use `display: none !important`.
- **Navigation:** `.browse-story-navigation` (pill container with backdrop-filter), `.browse-story-nav-btn` (42px touch target), `.browse-story-indicator` (tabular-nums position), `.browse-story-nav-label` (uppercase, 800 weight).
- **Transitions:** Bidirectional keyframes (`browse-story-enter-next/prev`, `browse-story-exit-next/prev`) with ±8% translate, 340ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Responsive:** `>=1200px` → 3 cols, `768–1199px` → 2 cols, `<768px` → 1 col (centered, max-width 480px).

### 2.9 Browse Canonical Route

- **Entry:** `pages/search.html` — the canonical Browse route.
- **Target element:** `#resultsList` (cards rendered by `js/search/search-card-renderer.js` via `LoveBudTreeCardComposition`).
- **Nav mount:** `#browseStoryNavMount` (populated by Story controller when Story mode is active).
- **Mode mount:** `#browseViewModeMount` (switcher control).
- **Preview hub:** `#previewSidebar` (Browse appreciation hub, separate from Story controller).
- **Storage key:** `lovebud:browse:viewMode`.
- **Appreciation route:** `view.html?treeId=...` (canonical, untouched by Story).

### 2.10 My Trees Renderer

**Files:** `js/my-trees.js` (676 lines), `js/my-trees/my-trees-render.js` (117 lines), `js/my-trees/my-trees-ui.js` (779 lines), `js/my-trees/my-trees-card-events.js` (161 lines)

| Aspect | Finding |
|---|---|
| **Grid container** | `#trees-grid` (`.trees-grid` class). Base CSS: `repeat(2, minmax(0, 1fr))` (2-col default). |
| **Card rendering** | `my-trees-ui.js` delegates to `LoveBudTreeCardComposition.buildTreeCard(tree, options)` (shared with Browse). |
| **Card events** | `my-trees-card-events.js` patches `buildTreeCard` to attach click/keydown handlers. Mobile (<480px): `open` (navigate to editor). Desktop: `select` (show in preview hub). |
| **Selection state** | `my-trees-state.js` (`selectedTreeId`), `my-trees-preview-state.js` (`selectedTree`). `markSelectedCard()` adds `is-selected`/`is-active` classes + `data-selected-tree-card` attribute. |
| **Auto-select** | `my-trees.js` `autoSelectFirstTree()` calls `previewHub.onCardClick(trees[0])` on load. |
| **Owner actions** | `my-trees-actions.js`: `renameTree`, `deleteTree`, `toggleTreeVisibility`, `createNewTree`. Visibility toggle changes tree visibility (public/private). |
| **Visibility state** | `my-trees-visibility-gate.css` + `my-trees-actions.js` `toggleTreeVisibility`. Public/private badge on cards. |
| **Loading state** | `my-trees-page.js` manages `state-loading`, `state-error`, `state-empty`, `state-loaded` sections. Skeleton grid (`trees-skeleton-grid`) during loading. |
| **Responsive** | `my-trees-responsive.css`: 2-col tablet (≤1024px), 1-col mobile (≤768px), 1-col very small (≤420px). Hub moves to bottom sheet on mobile. |
| **Three-mode capability** | `large` (2-col, 380px cards), `compact` (3-col canonical, 290px cards), `list` (1-col, 160px thumb). No `story` mode. |
| **Mode switcher** | `js/my-trees/my-trees-page-bootstrap.js` — no `modes` option, default `compact`, target `#trees-grid`, storage key `lovebud:myTrees:viewMode`. |

### 2.11 Preview Hub

| Aspect | Browse | My Trees |
|---|---|---|
| **File** | `js/search/search-preview-renderer.js` | `js/my-trees/my-trees-preview-hub.js` (825 lines) |
| **Panel ID** | `#previewSidebar` | `#myTreesHubPanel` |
| **Shared CSS** | `preview-sidebar`, `preview-hub`, `preview-panel-header`, `preview-focus-copy`, `preview-flow-stage`, `preview-summary-slot`, `preview-actions`, `preview-social-shell` | Same classes (structure alignment) |
| **Primary action** | `감상 열기` (view.html?treeId=) | `감상하기` (editor?treeId=) |
| **Share** | Public tree: copy share link | Public tree only: copy share link |
| **Social** | Like/comment/view counts (display-only like) | Like/comment/view counts (display-only like, stale-metric fix #3578) |
| **Flow stages** | `preview-flow-stage` (Browse-style) | `my-trees-hub-flow-stage` + `preview-flow-stage` (Browse-aligned) |
| **Summary** | `#previewHubSummarySlot` → `<div class="preview-focus-copy">` | `#myTreesHubSummary` → `<div class="preview-focus-copy">` (JS writes inner div to match Browse) |
| **Auto-select** | Hover-to-preview (no auto-select) | Auto-select first tree on load |
| **Owner controls** | None | None (appreciation-only; rename/delete/visibility are on cards, not hub) |
| **Loading** | `showLoading()` — title + "Loading…" meta badge | `showLoading()` — title + "불러오는 중…" meta badge |
| **Degraded** | N/A | `showDegraded()` — polite, no focus steal |
| **Media** | `search-preview-media-helper.js` | `my-trees-preview-media.js` (reuses Browse's safe media helper) |

### 2.12 My Trees Owner-Specific Boundaries

| Feature | Browse | My Trees | Story impact |
|---|---|---|---|
| **Auth** | Not required | Required (`auth-protected-route.js`, `lovebud_auth_confirmed`) | Story controller has no auth concept |
| **Owner actions** | None | rename, delete, visibility toggle, create tree | Story mode would need to preserve card-level owner actions |
| **Auto-select first tree** | No | Yes (`autoSelectFirstTree`) | Conflicts with Story grouping (first tree may be in a hidden group) |
| **Create tree CTA** | No | Yes (`#headerCreateTreeBtn`, `#createTreeBtn`) | N/A for Story mode |
| **Finder/search/filter** | Search input + category filters | Finder search + filter chips (all/public/private/has-moments) | Story mode would need to coexist with finder |
| **Sort** | Sort controls | Sort select (recent/oldest/name) | Story mode would need to preserve sort |
| **Loading states** | Inline loading spinner | Full loading/empty/error/loaded sections + skeleton grid | Story mode would need to handle all states |
| **Mobile behavior** | Preview hub in sidebar | Hub moves to bottom sheet; card click opens editor | Story mode would need mobile adaptation |

---

## 3. Disposition

### 3.1 REUSABLE_AS_IS

The following components can be reused without modification:

1. **Tree view mode switcher** (`js/tree-view-mode-switcher.js`) — already designed with surface-specific capability via `modes` option. My Trees simply needs to pass `['large', 'compact', 'list', 'story']` instead of omitting `modes`.
2. **Compact card geometry** (`css/tree-view-mode.css` compact rules) — canonical, shared by Browse and My Trees via parallel selectors.
3. **Card composition** (`js/shared/tree-card-composition.js`) — shared boundary for Browse and My Trees.
4. **Card metrics** (`js/shared/tree-card-metrics.js`) — shared.
5. **i18n infrastructure** (`js/i18n/`) — extensible.
6. **Security helpers** (`js/utils/security.js`) — shared.
7. **Preview hub CSS classes** (`preview-sidebar`, `preview-hub`, `preview-focus-copy`, etc.) — already aligned between Browse and My Trees.
8. **Loading/empty/error state patterns** — shared state section pattern.
9. **Reduced motion CSS pattern** — `@media (prefers-reduced-motion: reduce)` already established.

### 3.2 REUSABLE_WITH_ADAPTER

The following require an adapter layer for My Trees:

1. **Story grouping logic** — The controller targets `#resultsList` (Browse). My Trees uses `#trees-grid` / `.trees-grid`. An adapter must translate the target selector and handle My Trees' card rendering lifecycle (batch render, sort, filter).
2. **Story navigation UI** — The nav mount (`#browseStoryNavMount`) is Browse-specific. My Trees would need a parallel mount (`#myTreesStoryNavMount`) and the nav would need to coexist with the finder/search/filter row.
3. **Story transition animations** — CSS is Browse-scoped (`#resultsList`). An adapter must add `.trees-grid[data-tree-view-mode="story"]` selectors with the same geometry.
4. **Keyboard navigation** — The document-level keydown handler works generically, but My Trees' card events (`my-trees-card-events.js`) also bind keydown on cards. The adapter must ensure no conflict (Story's editable guard vs. card activation keys).
5. **Story CSS** — All Story CSS is `#resultsList`-scoped. An adapter must add `.trees-grid` Story selectors with identical geometry (group-size columns, card height release, hidden card display:none).
6. **Preview hub interaction** — Story mode hides non-visible cards. The My Trees preview hub auto-selects the first tree. An adapter must ensure the selected tree is in the visible group, or re-select when the group changes.

### 3.3 OWNER_SPECIFIC

The following are My Trees-only and cannot be shared:

1. **Auth guard** — My Trees requires authentication; Browse does not.
2. **Owner actions** — rename, delete, visibility toggle, create tree. Browse has none.
3. **Auto-select first tree** — My Trees auto-selects the first tree on load; Browse uses hover-to-preview.
4. **Create tree CTA** — My Trees has header + empty-state create buttons.
5. **Finder/search/filter** — My Trees has a finder with filter chips (all/public/private/has-moments); Browse has search input + category filters.
6. **Sort controls** — My Trees has a sort select; Browse has sort controls.
7. **Mobile hub behavior** — My Trees hub moves to a bottom sheet on mobile; Browse hub stays in sidebar.
8. **Degraded state** — My Trees has `showDegraded()`; Browse does not.
9. **Loading state complexity** — My Trees has full loading/empty/error/loaded sections + skeleton grid; Browse has inline loading.
10. **Card click behavior** — My Trees: desktop selects (show hub), mobile opens editor. Browse: click selects (show hub), no mobile open.

### 3.4 BLOCKED_BY_PRODUCTION_ACCEPTANCE

- **#3699** — Production acceptance blocker, **Keep OPEN**. Browse Story mode has not yet received Production visual acceptance. Per `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`, no parallel surface implementation may begin until the foundation surface is Production-accepted.
- **Browse Story mode** — The foundation (#3655) requires Production visual acceptance after merge before #3655 is closed. My Trees Story mode depends on this acceptance.

### 3.5 BLOCKED_BY_PRODUCT_DECISION

- **Whether My Trees Story mode should be implemented at all** — #3654 (parent) is still OPEN and has not made a product decision on My Trees parity.
- **Preview hub coexistence** — Whether Story mode should replace, supplement, or defer to the preview hub on My Trees.
- **Default compact preservation** — Whether the default `compact` mode must be preserved (it must, per contract, but the product must confirm).
- **Story preference boundary** — Whether a My Trees Story preference should be stored separately or share the Browse key (currently separate, which is correct).

### 3.6 NOT_RECOMMENDED

- **Directly reusing `js/search/search-story-view.js` on My Trees without an adapter** — The controller is hard-coded to `#resultsList` and Browse card events. Direct reuse would break My Trees rendering.
- **Adding `.trees-grid[data-tree-view-mode="story"]` CSS without the adapter JS** — CSS alone would hide cards but leave no navigation, keyboard support, or group management.
- **Changing the My Trees default mode** — Must remain `compact`.
- **Modifying `localStorage` storage keys** — Must remain `lovebud:myTrees:viewMode`.
- **Removing the preview hub** — The hub is the primary My Trees interaction surface.

### 3.7 UNRESOLVED

1. **Preview hub + Story coexistence** — When Story mode hides non-visible cards on My Trees, the auto-selected first tree may be in a hidden group. Does the hub re-select to the first visible tree, or does Story mode always show the selected tree's group?
2. **Owner actions in Story mode** — Should rename/delete/visibility actions be available on cards in Story mode? The Story controller binds no per-card listeners, but My Trees' `my-trees-card-events.js` does.
3. **Finder/search/filter interaction with Story mode** — Does Story mode group the filtered result set? Does the finder remain visible in Story mode?
4. **Sort interaction with Story mode** — Does sorting re-group? Does the group index reset?
5. **Mobile Story mode** — On mobile, My Trees hub moves to a bottom sheet and card click opens the editor. Does Story mode's single-card mobile composition conflict with the bottom sheet?
6. **Loading/empty/error states in Story mode** — Does Story mode activate during loading (skeleton cards)? During empty state? The Story controller's `collectCards()` excludes skeleton cards, but the interaction with My Trees' state sections is untested.
7. **Degraded state in Story mode** — My Trees has `showDegraded()` for partial load failures. Does Story mode need to handle degraded cards?
8. **Cross-tab preference sync** — The Story controller does not listen for `storage` events. If a user changes the mode in another tab, My Trees would not sync. (This is a pre-existing limitation, not Story-specific.)

---

## 4. Core Judgment

### 4.1 What Browse Story and My Trees Can Genuinely Share

- **Switcher infrastructure** — The shared switcher is already designed for surface-specific capability. My Trees would pass `modes: ['large', 'compact', 'list', 'story']` and the switcher handles the rest.
- **Compact geometry** — Already canonical and shared.
- **Card composition** — Already shared via `LoveBudTreeCardComposition`.
- **Preview hub CSS classes** — Already aligned.
- **i18n infrastructure** — Extensible.
- **Reduced motion pattern** — Already established.

### 4.2 What My Trees Owner Context Requires Separating

- **Auth** — My Trees is auth-gated; Story controller has no auth concept.
- **Owner actions** — Rename/delete/visibility are card-level on My Trees; Story controller binds no card listeners.
- **Auto-select first tree** — Conflicts with Story grouping (first tree may be hidden).
- **Finder/filter/sort** — My Trees has a richer filtering UI that must coexist with Story mode.
- **Mobile behavior** — Bottom sheet hub + editor open on mobile card click.

### 4.3 Preview Hub and Story Coexistence

On **Browse**, Story mode and the preview hub coexist cleanly: Story groups cards (hiding non-visible ones), and the preview hub shows details of the selected card. The Story controller does not touch the preview hub — card selection is still handled by `search-card-events.js`.

On **My Trees**, the coexistence is **unresolved**:
- The preview hub is the **primary** interaction surface (auto-selects first tree, shows flow stages, summary, actions).
- Story mode would hide non-visible cards, potentially hiding the selected tree.
- The hub's `onCardClick` would need to ensure the selected tree is in the visible group.
- The hub's auto-select-first-tree behavior would need to defer until Story mode is active and the first group is computed.
- **Recommendation:** Story mode should show the selected tree's group (goTo group containing the selected tree), not just the first group. This requires an adapter that coordinates Story grouping with hub selection.

### 4.4 Default Compact Preservation

- **Must be preserved.** The contract (`tree-view-mode-switcher-contract.test.cjs`, `browse-story-view-foundation-3655-contract.test.cjs`) explicitly locks `defaultMode: 'compact'` for My Trees.
- The base `.trees-grid` CSS (`my-trees-cards.css`) is 2-col without any `data-tree-view-mode` attribute — the switcher must not override this.
- A stored `story` value on `lovebud:myTrees:viewMode` must fall back to `compact` without rewriting.

### 4.5 My Trees Story Preference Boundary

- **Storage key:** `lovebud:myTrees:viewMode` (separate from Browse's `lovebud:browse:viewMode`).
- **Capability:** Must NOT accept `story` until the product decides to opt in. Currently, the switcher rejects `story` on this key.
- **When opted in:** My Trees would pass `modes: ['large', 'compact', 'list', 'story']` in `my-trees-page-bootstrap.js`. A stored `story` value would then be accepted.
- **No cross-key leakage:** A user who sets Story on Browse does not get Story on My Trees (separate keys, separate capability).

### 4.6 Production Approval Stop Conditions

Implementation of My Trees Story mode is **prohibited** until ALL of the following are met:

1. **#3699 resolved** — Production acceptance blocker must be cleared.
2. **Browse Story mode Production-accepted** — Visual acceptance at `https://lovebud.pages.dev/` via the Merge-First Production Verification workflow.
3. **Product decision on My Trees Story mode** — #3654 must decide whether My Trees should have Story mode.
4. **Preview hub coexistence design approved** — The interaction between Story grouping and the preview hub must be designed and approved.
5. **No code changes** — Until all above are met, no JS/CSS/HTML/test/localStorage changes may be made.

### 4.7 First Implementation Child Proposal

If and only if all stop conditions are met, the first implementation child should be:

**Title:** `[UX][My Trees] Add Story view adapter for My Trees`

**Approach:** Create a thin adapter (`js/my-trees/my-trees-story-view.js`) that wraps the existing Story controller logic for the `.trees-grid` target, rather than modifying `js/search/search-story-view.js` directly. This preserves the Browse-only foundation contract.

**Exact proposed files (if approved):**

| File | Action | Purpose |
|---|---|---|
| `js/my-trees/my-trees-story-view.js` | **New** | Adapter wrapping Story grouping/navigation for `.trees-grid` target, coordinating with preview hub selection. |
| `css/tree-view-mode.css` | **Modify** | Add `.trees-grid[data-tree-view-mode="story"]` selectors (group-size columns, card geometry, hidden cards, reduced motion). |
| `js/my-trees/my-trees-page-bootstrap.js` | **Modify** | Pass `modes: ['large', 'compact', 'list', 'story']` and wire Story adapter + nav mount. |
| `pages/my-trees.html` | **Modify** | Add `#myTreesStoryNavMount`, load `my-trees-story-view.js`. |
| `js/i18n/i18n-my-trees.js` | **Modify** | Add `myTrees.story.*` i18n keys (or reuse `search.story.*` via shared dictionary). |
| `tests/contracts/my-trees-story-view-foundation-contract.test.cjs` | **New** | Static contract: My Trees Story mode is opt-in, default compact preserved, no `.trees-grid` story selector without adapter, storage key isolation, preview hub coexistence. |

**Do NOT touch:**
- `js/search/search-story-view.js` (Browse-only foundation)
- `js/tree-view-mode-switcher.js` (shared, already correct)
- `js/my-trees/my-trees-preview-hub.js` (hub logic — adapter coordinates, doesn't modify)
- `js/my-trees/my-trees-card-events.js` (card events — must coexist, not modify)
- `js/my-trees/my-trees-state.js` (selection state — adapter reads, doesn't modify)
- Any backend/API/DB/Auth files
- `localStorage` storage key structure

---

## 5. Stop Conditions

The audit is **complete**. No implementation may begin until:

1. **#3699** is resolved (Production acceptance blocker cleared).
2. **Browse Story mode** receives Production visual acceptance at `https://lovebud.pages.dev/`.
3. **Product decision** on My Trees Story mode is made (#3654).
4. **Preview hub coexistence** design is approved.
5. **First implementation child** is created as a separate PR with its own contract tests.

Until then, the only allowed change is this audit document.

---

## 6. Verification

```text
git diff --check
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

**Expected output:**
- `git diff --name-only origin/main...HEAD` → exactly 1 file: `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md`
- `git status --short` → exactly 1 untracked file: `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md`
- `git diff --check` → no errors (new file, no whitespace issues)

---

## 7. Final Report

| Field | Value |
|---|---|
| **role** | 컴5 (Web Implementation Developer) |
| **issue** | #3717 |
| **worktree** | `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3717-mytrees-story-readiness` |
| **branch** | `docs/my-trees-story-parity-readiness-3717` |
| **starting main** | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| **actual base** | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| **merge base** | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| **exact head** | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| **ahead / behind** | 0 ahead, 0 behind |
| **exact changed files** | `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md` (new) |

| Disposition | Verdict |
|---|---|
| **reusable as-is** | Switcher infra, compact geometry, card composition, card metrics, i18n, security, preview hub CSS, loading patterns, reduced motion |
| **reusable with adapter** | Story grouping, nav UI, transitions, keyboard, CSS, preview hub coordination |
| **owner-specific boundaries** | Auth, owner actions, auto-select, create CTA, finder/filter/sort, mobile behavior, degraded state |
| **production blockers** | #3699 (OPEN), Browse Story not Production-accepted |
| **product-decision blockers** | #3654 (OPEN), preview hub coexistence, Story preference boundary |
| **recommended architecture** | Thin adapter (`my-trees-story-view.js`) wrapping Story logic for `.trees-grid`, NOT modifying `search-story-view.js` |
| **first implementation child proposal** | `[UX][My Trees] Add Story view adapter for My Trees` — 6 files (1 new JS, 1 modify CSS, 1 modify bootstrap, 1 modify HTML, 1 modify i18n, 1 new test) |
| **exact proposed files** | See §4.7 |
| **stop conditions** | #3699 resolved, Browse Production-accepted, product decision made, hub coexistence approved, separate child PR |
| **unresolved items** | Hub+Story coexistence, owner actions in Story, finder/sort interaction, mobile Story, loading/empty/error in Story, degraded in Story, cross-tab sync |

**Refs #3717**
**Refs #3654 — Keep OPEN**
**Refs #3703 — completed**
**Refs #3699 — Keep OPEN**
**Refs #3688 — Keep OPEN**
**Refs #3672 — Keep OPEN**
**Refs #1882 — Keep OPEN**
