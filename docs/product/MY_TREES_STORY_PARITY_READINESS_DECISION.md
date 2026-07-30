# My Trees Story Parity Readiness — Audit Decision

- **Issue:** #3717 `[Product][Story] Audit My Trees Story parity readiness and stop conditions`
- **Role:** Web Implementation Developer (컴5)
- **Scope:** Source-only readiness audit. No code, CSS, HTML, JS, test, localStorage, default-mode, or preview-hub changes. No browser, screenshot, Preview, Production, Cloudflare, backend/API/DB/Auth work. No PR Ready, merge, or #3654 closure.
- **Audit baseline:** `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc`
- **Merge-forward baseline at audit completion:** `5db3f42e5e8c1e29c7cc294e29fd30155b89c6a7`
- **Latest-main revalidation baseline:** `4842a4d1f60c011132fb936323dd7b80423bf5ac`
- **Parent product issue:** #3654 — **Keep OPEN**
- **Related completed:** #3655 / PR #3656 (Browse Story foundation), #3666 (transition correction), #3703 / PR #3708 (Browse refinement)
- **Production acceptance blocker:** #3699 — **Keep OPEN**
- **Branch / Worktree (historical execution metadata):** `docs/my-trees-story-parity-readiness-3717` / `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3717-mytrees-story-readiness`

---

## 1. Executive Summary

Browse Story mode (#3655) is implemented as a **Browse-only opt-in** fourth view mode on the shared tree-view-mode switcher. The Story controller (`js/search/search-story-view.js`) is a pure presentation module that groups only the currently loaded `#resultsList` cards — it reuses canonical card DOM, performs no fetch/API/DB/auth work, and binds no per-card listeners.

My Trees uses the **same shared switcher** but passes no `modes` option, keeping exactly `large / compact / list` with a `compact` default and a separate storage key (`lovebud:myTrees:viewMode`). A stored `story` value on the My Trees key is treated as invalid and falls back to `compact` without rewriting the stored value.

The audit concludes that **Story mode is NOT currently ready for My Trees implementation** — not because of technical impossibility, but because:

1. **#3699 (Production acceptance blocker) is OPEN** — Browse Story mode has not yet received Production visual acceptance, so no parallel surface implementation may begin.
2. **Preview hub coexistence is unresolved** — My Trees' primary interaction surface is the appreciation preview hub (`#myTreesHubPanel`), which auto-selects the first tree. Story mode's card-grouping semantics (hide non-visible cards, show prev/next) conflict with the hub's selection-driven flow.
3. **Owner-specific boundaries are significant** — My Trees has auth, owner actions (rename/delete/visibility), create-tree CTA, and auto-select-first-tree behavior that Browse Story does not account for.

The recommended path is: **resolve #3699 first, then make a product decision on My Trees Story mode, then implement as a separate adapter child.**

> **Latest-main revalidation:** core Story controller and shared mode-switcher authority unchanged; My Trees loading/state implementation changed but does not resolve Production acceptance, preview-hub coexistence, owner-action, selection, or preference-boundary blockers.

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

1. **Tree view mode switcher** (`js/tree-view-mode-switcher.js`) — already designed with surface-specific capability via `modes` option. My Trees simply needs to pass `['large', 'compact', 'list', 'story']` instead of omitting `modes`. **Switcher mechanism is reusable.**
2. **Compact card geometry** (`css/tree-view-mode.css` compact rules) — canonical, shared by Browse and My Trees via parallel selectors.
3. **Card composition** (`js/shared/tree-card-composition.js`) — shared boundary for Browse and My Trees.
4. **Card metrics** (`js/shared/tree-card-metrics.js`) — shared.
5. **i18n infrastructure** (`js/i18n/`) — extensible. **Switcher mechanism is reusable; My Trees Story label/assistive text is an owner-context i18n decision required.**

> **Note:** `security helpers`, `loading/empty/error state patterns`, and `preview hub CSS classes` are **NOT** listed here. These are not Browse Story reuse items — they are My Trees preservation concerns (see §3.3).

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

### 3.3a COEXISTENCE_CONSTRAINT

The following are My Trees preservation authorities that Browse Story does not own and must not override:

1. **Security helpers** (`js/utils/security.js`) — My Trees card composition and hub rely on `LoveBudSecurity.escapeHtml` / `sanitizeUrl` (fail-closed). Story adapter must not bypass or replace these.
2. **Preview hub CSS classes** (`preview-sidebar`, `preview-hub`, `preview-focus-copy`, `preview-flow-stage`, etc.) — My Trees hub structure is aligned with Browse but is the **primary** My Trees interaction surface. Story adapter must not remove, rename, or restructure these classes.
3. **Loading/empty/error state patterns** — My Trees manages `state-loading`, `state-error`, `state-empty`, `state-loaded` sections. Story adapter must not replace these with Browse-style inline loading.
4. **Selection state authority** (`my-trees-state.js`, `my-trees-preview-state.js`) — My Trees owns `selectedTreeId` / `selectedTree`. Story adapter must read, not overwrite.
5. **Card events authority** (`my-trees-card-events.js`) — My Trees owns card click/keydown (desktop select, mobile open). Story adapter must not patch or replace card event binding.

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
- **Copying the 745-line Browse controller** (`js/search/search-story-view.js`) into a My Trees file — Prohibited. The Browse controller must remain the single source of Story grouping/navigation logic.
- **Reusing hard-coded `#resultsList` assumptions** — The Story controller's `collectCards()`, `MutationObserver`, and `aria-busy` targeting are all `#resultsList`-specific. An adapter must parameterize the target, not copy these assumptions.
- **Forcing hard-coded `.browse-story-*` CSS assumptions onto My Trees** — The Story CSS is `#resultsList`-scoped. An adapter must add `.trees-grid` Story selectors, not rename or alias `.browse-story-*` classes.
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

- **Switcher mechanism** — The shared switcher is already designed for surface-specific capability. My Trees would pass `modes: ['large', 'compact', 'list', 'story']` and the switcher handles the rest. **Reusable.**
- **Compact geometry** — Already canonical and shared.
- **Card composition** — Already shared via `LoveBudTreeCardComposition`.
- **i18n infrastructure** — Extensible. **Switcher mechanism is reusable; My Trees Story label/assistive text is an owner-context i18n decision required.**
- **Reduced motion pattern** — Already established.

> **Not shared:** Security helpers, loading/empty/error state patterns, and preview hub CSS classes are My Trees preservation authorities (see §3.3a), not Browse Story reuse items.

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

> **This section is a plan, not an implementation approval.** No code may be written until ALL conditions are met and a separate implementation child is approved.

Implementation of My Trees Story mode is **prohibited** until ALL of the following are met:

1. **#3699 resolved** — Production acceptance blocker must be cleared.
2. **Browse Story mode Production-accepted** — Visual acceptance at `https://lovebud.pages.dev/` via the Merge-First Production Verification workflow.
3. **Product decision on My Trees Story mode** — #3654 must decide whether My Trees should have Story mode.
4. **Preview hub coexistence design approved** — The interaction between Story grouping and the preview hub must be designed and approved.
5. **My Trees storage/default-mode decision** — Product must confirm that `lovebud:myTrees:viewMode` remains the storage key and `compact` remains the default.
6. **Separate implementation child** — A new PR with its own contract tests must be created and approved.

### 4.7 First Implementation Child Proposal

> **CANDIDATE_SCOPE_NOT_AUTHORIZED.** This is a recommended architecture, not an implementation approval. No files may be created or modified until all stop conditions in §4.6 are met and a separate implementation child is approved.

If and only if all stop conditions are met, the first implementation child should be:

**Title:** `[UX][My Trees] Add Story view adapter for My Trees`

**Controller selection — three options compared:**

| Option | Description | Verdict |
|---|---|---|
| **A. Current parameterized controller reuse** | Reuse `js/search/search-story-view.js` as-is, parameterizing the target selector (`#resultsList` → `#trees-grid`) via the `init({ results, navMount })` API. | **Recommended.** The controller already accepts a `results` selector. An adapter passes `#trees-grid` and `#myTreesStoryNavMount`. No copy, no hard-coded assumptions. |
| **B. Surface-neutral shared controller extraction** | Extract the Story grouping/navigation logic into a new shared module (e.g. `js/shared/story-grouping.js`) that both Browse and My Trees import. | **Not recommended for first child.** Would modify the Browse foundation (#3655), violating the "no changes to Browse-only foundation" contract. Defer to a later refactor. |
| **C. Page-owned My Trees controller** | Write a completely new My Trees-specific Story controller from scratch. | **Prohibited.** Would duplicate the 745-line Browse controller, re-implement grouping/navigation/keyboard/reduced-motion/transition logic, and create maintenance divergence. |

**Prohibited approaches:**
- Copying the 745-line Browse controller (`js/search/search-story-view.js`) into a My Trees file.
- Reusing hard-coded `#resultsList` assumptions without parameterizing the target.
- Forcing hard-coded `.browse-story-*` CSS assumptions onto My Trees (must add `.trees-grid` Story selectors instead).

**Approach:** Create a thin adapter (`js/my-trees/my-trees-story-view.js`) that calls `LoveBudBrowseStoryView.init({ results: '#trees-grid', navMount: '#myTreesStoryNavMount' })` and coordinates with the My Trees preview hub (ensuring the selected tree is in the visible group). This preserves the Browse-only foundation contract.

**Exact proposed files (CANDIDATE_SCOPE_NOT_AUTHORIZED — not yet approved):**

| File | Action | Purpose |
|---|---|---|
| `js/my-trees/my-trees-story-view.js` | **New** | Adapter calling `LoveBudBrowseStoryView.init` with `.trees-grid` target, coordinating with preview hub selection. |
| `css/tree-view-mode.css` | **Modify** | Add `.trees-grid[data-tree-view-mode="story"]` selectors (group-size columns, card geometry, hidden cards, reduced motion). |
| `js/my-trees/my-trees-page-bootstrap.js` | **Modify** | Pass `modes: ['large', 'compact', 'list', 'story']` and wire Story adapter + nav mount. |
| `pages/my-trees.html` | **Modify** | Add `#myTreesStoryNavMount`, load `my-trees-story-view.js`. |
| `js/i18n/i18n-my-trees.js` | **Modify** | Add `myTrees.story.*` i18n keys (or reuse `search.story.*` via shared dictionary — **owner-context i18n decision required**). |
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
5. **My Trees storage/default-mode decision** — Product confirms `lovebud:myTrees:viewMode` key and `compact` default.
6. **First implementation child** is created as a separate PR with its own contract tests.

Until then, the only allowed change is this audit document.

---

## 6. Verification

```text
git diff --check
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

**Actual output (verified):**
- `git diff --name-only origin/main...HEAD` → exactly 1 file: `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md`
- `git status --short` → empty (committed, merge-forward applied)
- `git diff --check` → no errors

## 7. Final Report

| Field | Value |
|---|---|
| **role** | 컴5 (Web Implementation Developer) |
| **issue** | #3717 |
| **audit baseline** | `235ec59b2a5a40e0cf0115ebe45b2c6e50abbcdc` |
| **merge-forward baseline at audit completion** | `5db3f42e5e8c1e29c7cc294e29fd30155b89c6a7` |
| **latest-main revalidation baseline** | `4842a4d1f60c011132fb936323dd7b80423bf5ac` |
| **branch / worktree (historical execution metadata)** | `docs/my-trees-story-parity-readiness-3717` / `/mnt/g/Ddrive/BatangD/task/workdiary/LoveBud-3717-mytrees-story-readiness` |
| **exact changed files** | `docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md` (new) |

> **Note:** `exact head` and `ahead / behind` are intentionally omitted from this permanent document. A commit SHA recorded in a file changes the file, which changes the SHA — making self-referential SHA metadata permanently stale. Dynamic PR metadata (head, ahead/behind, CI) is tracked in the PR body only.

| Disposition | Verdict |
|---|---|
| **reusable as-is** | Switcher mechanism, compact geometry, card composition, card metrics, i18n infrastructure (switcher mechanism reusable; My Trees Story label/assistive text is owner-context i18n decision required) |
| **reusable with adapter** | Story grouping, nav UI, transitions, keyboard, CSS, preview hub coordination |
| **owner-specific boundaries** | Auth, owner actions, auto-select, create CTA, finder/filter/sort, mobile behavior, degraded state |
| **coexistence constraints** | Security helpers, preview hub CSS, loading/empty/error state patterns, selection state authority, card events authority — all My Trees preservation authorities, not Browse Story reuse items |
| **production blockers** | #3699 (OPEN), Browse Story not Production-accepted |
| **product-decision blockers** | #3654 (OPEN), preview hub coexistence, Story preference boundary, storage/default-mode decision |
| **recommended architecture** | Thin adapter (`my-trees-story-view.js`) calling `LoveBudBrowseStoryView.init` with `.trees-grid` target — **plan, not implementation approval** |
| **first implementation child proposal** | `[UX][My Trees] Add Story view adapter for My Trees` — CANDIDATE_SCOPE_NOT_AUTHORIZED, 6 files |
| **stop conditions** | #3699 resolved, Browse Production-accepted, product decision made, hub coexistence approved, storage/default-mode decision, separate child PR |
| **unresolved items** | Hub+Story coexistence, owner actions in Story, finder/sort interaction, mobile Story, loading/empty/error in Story, degraded in Story, cross-tab sync |

**Refs #3717**
**Refs #3654 — Keep OPEN**
**Refs #3703 — completed**
**Refs #3699 — Keep OPEN**
**Refs #3688 — Keep OPEN**
**Refs #3672 — Keep OPEN**
**Refs #1882 — Keep OPEN**
