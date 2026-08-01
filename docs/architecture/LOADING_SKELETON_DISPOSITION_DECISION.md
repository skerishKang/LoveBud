# Loading Skeleton Disposition Decision

Source-only architecture decision for Issue #3790 (parent loading program #3688, Keep OPEN). Determines, per active Browse and My Trees skeleton family, whether to retain, migrate, retire, or temporarily keep legacy skeleton selectors alongside the canonical `lt-skeleton*` loading primitives. No CSS/HTML/JS implementation is authorized by this document.

## 1. Status and exact source baseline

```text
Status:      DRAFT decision record — pending Web CTO review
Baseline:    origin/main 62da156eb4cff1873d96cdcb5e580c80e7db666f
Branch:      docs/loading-skeleton-disposition-3790-c1-fresh
Issue:       #3790 — Decide legacy skeleton retention or canonical migration (source-only)
Parent:      #3688 — Keep OPEN until disposition + final runtime closure review complete
Authorities: LOADING_STATE_CANONICAL_DECISION.md (#3689/PR #3690)
             LOADING_STATE_CURRENT_STATE_AUDIT.md (#3688 audit)
             #3691/PR #3692 shared loading presentation primitives (lt-skeleton*)
             #3693/PR #3694 Browse/My Trees staged loading integration
             PR #3773 Browse/My Trees real-local runtime evidence
             PR #3781 Public Viewer real-local runtime evidence
             #3784/PR #3783 Editor real-local runtime evidence (pending #3785 review)
```

Web CTO fresh-only execution note (`#3790` comment): this branch/worktree is a brand-new local branch (`docs/loading-skeleton-disposition-3790-c1-fresh`) and brand-new worktree from the latest verified `origin/main`. The administratively created empty remote refs `docs/loading-skeleton-disposition-3790`, `-v2`, `-v3` are not execution authority and are untouched.

Disposition vocabulary (Issue #3790):

```text
RETAIN_PAGE_OWNED                  keep as page-specific skeleton geometry/layout
MIGRATE_TO_CANONICAL               switch active consumers to canonical primitives
RETIRE_AS_DUPLICATE                remove as duplicate/legacy loading state
KEEP_TEMPORARILY_WITH_EXIT_CONDITION  keep only until a defined exit condition
UNRESOLVED_RUNTIME                 browser-only claim, not provable from source
```

## 2. Scope and evidence limits

- Scope: every active and dormant consumer of `search-skeleton-*`, `trees-skeleton-grid`, `trees-loading`, `lt-skeleton`, `lt-skeleton-text`, `lt-skeleton-title`, `lt-skeleton-media`, and `searchSkeletonPulse`; decide each family's disposition; state whether #3688 can close after PR #3783 merge plus this decision, or whether one implementation child remains.
- Evidence boundary: `pages/search.html`, `pages/my-trees.html`, `css/global/lovetree-loading-states.css`, `css/search/search-results-skeleton.css`, `css/my-trees/my-trees-states.css`, `css/my-trees/my-trees-responsive.css`, `css/search.css`, `css/my-trees.css`, `js/search/**`, `js/my-trees.js`, `js/my-trees/**`, `js/search.js`, `js/i18n/i18n-search.js`, `js/i18n/i18n-my-trees.js`, `js/i18n/i18n-shared.js`, `docs/architecture/LOADING_STATE_CANONICAL_DECISION.md`, `docs/architecture/LOADING_STATE_CURRENT_STATE_AUDIT.md`, and the locking contracts.
- Limits: no browser/Playwright/screenshot/runtime/Preview/Production/API/DB/provider/login verification. Browser-only claims are `UNRESOLVED_RUNTIME`. This child does not modify #3783/#3787/#3789/#3780 or any other branch/worktree.

## 3. Selector and consumer inventory

Active consumers (`SOURCE_CONFIRMED`):

| Selector/family | Active location | Renderer/controller | State |
|---|---|---|---|
| `#resultsList` static skeleton (3 `.search-skeleton-card` with `lt-skeleton*` + `search-skeleton-title/copy/chip/count`) | `pages/search.html:68-99` | static HTML; `CardRenderer.renderResults()` replaces on data | PENDING/LOADING on Browse |
| `#browseLoadingStatus` status bar (`lt-loading-inline` + spinner + `.browse-loading-copy` + `lt-error-*` nodes) | `pages/search.html:60-66` | `createBrowseLoadingManager` (`js/search/search-data.js:17-116`): start/ready/error; 500ms indicator, 1800ms copy, 8000ms long-wait, 15000ms error | PENDING/LOADING/LONG_WAIT/ERROR |
| JS-rendered legacy skeleton (`renderLoading()` → `renderSkeletonGrid` → `renderSkeletonCard`) with `search-skeleton-card/block/line/chip` + injected `@keyframes searchSkeletonPulse` | `js/search/search-card-renderer.js:293-374` | called at `js/search/index.js:421` (`#resultsList.innerHTML = CardRenderer.renderLoading()`) — replaces the static skeleton at runtime; dormant callers `js/search/search-index.js:299`, `js/search.js:225` (not loaded by `search.html`) | PENDING/LOADING on Browse |
| My Trees `#state-loading` (`trees-loading lt-loading-compact`, role=status) + `.trees-loading-head` + `.trees-skeleton-grid` (3 `search-skeleton-card` with `lt-skeleton*`) | `pages/my-trees.html:61-68` | `js/my-trees/my-trees-page.js`, `my-trees-data.js`, `my-trees.js` state rendering | LOADING on My Trees |
| Canonical `lt-skeleton`, `lt-skeleton-text/title/media` + `lt-shimmer` | `css/global/lovetree-loading-states.css:177-235` | consumed by both static skeletons | shared authority |
| `search-skeleton-title/copy/chip/count` geometry | `css/search/search-results-skeleton.css:33-56` | consumed by Browse static skeleton | geometry-only |
| `search-skeleton-card` wrapper | `css/search/search-results-skeleton.css:12-21` | consumed by Browse + My Trees static skeletons (locked by contract) | geometry/pointer-events only |
| `.trees-skeleton-grid` / `.trees-loading` / `.trees-loading-head` | `css/my-trees/my-trees-states.css` + `my-trees-responsive.css` | My Trees static skeleton | layout/geometry only |

Dormant/legacy definitions (`SOURCE_CONFIRMED`):

| Selector/family | Dormant location | Status |
|---|---|---|
| `search-skeleton-block`, `search-skeleton-line` | only in `js/search/search-card-renderer.js:296-305,357-374` (JS-injected) | forbidden in static HTML by contract |
| `searchSkeletonPulse` keyframe | only in `js/search/search-card-renderer.js:353` (injected `<style id="search-card-anim-style">`) | not in any CSS file |
| `renderLoading`/`renderSkeletonGrid`/`renderSkeletonCard`/`_addAnimations` | `js/search/search-card-renderer.js`; callers `index.js:421` (active), `search-index.js:299` + `js/search.js:225` (dormant) | legacy JS skeleton |
| `js/search.js:225` `renderLoading()` | `js/search.js` — not loaded by `pages/search.html` (only `js/search/index.js`) | dormant aggregator |

## 4. Browse skeleton matrix

| Item | Source | State | aria-hidden | Animation | Reduced-motion | Disposition |
|---|---|---|---|---|---|---|
| Static skeleton grid (`#resultsList`, 3 cards) | `pages/search.html:68-99` | initial HTML (PENDING) | `aria-hidden="true"` on all 3 cards (contract test 64) | canonical `lt-shimmer` via `.lt-skeleton` | canonical `.lt-skeleton { animation:none }` (`lovetree-loading-states.css:220-223`) | RETAIN_PAGE_OWNED |
| Status bar (`#browseLoadingStatus`) | `pages/search.html:60-66` + `search-data.js:17-116` | LOADING/LONG_WAIT/ERROR | `role="status" aria-live="polite"` on bar; spinner `aria-hidden="true"` | `.lt-spinner` spin; none | `.lt-spinner` reduced-motion in canonical CSS | RETAIN_PAGE_OWNED |
| JS-rendered legacy skeleton (`renderLoading`) | `search-card-renderer.js:293-374`; wired at `index.js:421` | replaces static skeleton at runtime until data | `aria-hidden="true"` on cards | self-injected `@keyframes searchSkeletonPulse` + gradient | self-injected `@media (prefers-reduced-motion) { animation:none }` | RETIRE_AS_DUPLICATE (via child) |
| `search-skeleton-title/copy/count` geometry | `search-results-skeleton.css:33-56` | Browse static skeleton | n/a | none (geometry) | n/a | RETAIN_PAGE_OWNED |
| `search-skeleton-chip` geometry | `search-results-skeleton.css:44-49` | Browse static skeleton | n/a | none | n/a | RETAIN_PAGE_OWNED (Browse only) |
| `search-skeleton-block/line` | JS-only (`renderSkeletonCard`) | JS legacy skeleton | n/a | self-injected | n/a | RETIRE_AS_DUPLICATE |

Browse conclusion: the canonical static skeleton + status bar are the intended staged-loading presentation; the JS-rendered legacy skeleton (`renderLoading` at `index.js:421`) is a runtime duplicate that replaces the canonical static skeleton with a non-canonical shimmer. This is exactly the "misleading or duplicate legacy loading state" the parent targets.

## 5. My Trees skeleton matrix

| Item | Source | State | aria-hidden | Animation | Reduced-motion | Disposition |
|---|---|---|---|---|---|---|
| `#state-loading` shell (`trees-loading lt-loading-compact`) | `pages/my-trees.html:61` | LOADING | `role="status" aria-live="polite"` | n/a (container) | `.lt-loading-compact .lt-spinner` canonical reduce | RETAIN_PAGE_OWNED |
| `.trees-loading-head` (spinner + copy) | `pages/my-trees.html:62` + `my-trees-states.css` | LOADING | spinner `aria-hidden="true"`; copy `data-i18n="myTrees.loading"` | `.lt-spinner` | `.lt-spinner` reduced-motion (canonical + page block) | RETAIN_PAGE_OWNED |
| `.trees-skeleton-grid` (3 cards, `search-skeleton-card` + `lt-skeleton*`) | `pages/my-trees.html:63-67` | LOADING | `aria-hidden="true"` grid + cards (contract test 64) | canonical `lt-shimmer` via `.lt-skeleton` | canonical `.lt-skeleton { animation:none }` + `my-trees-states.css` reduced-motion block (contract test 59) | RETAIN_PAGE_OWNED |
| `.trees-skeleton-grid .lt-skeleton-*` sizing | `my-trees-states.css` | geometry | n/a | none | n/a | RETAIN_PAGE_OWNED |
| `.trees-skeleton-grid` responsive (2-col/1-col) | `my-trees-responsive.css` | layout | n/a | none | n/a | RETAIN_PAGE_OWNED |

My Trees conclusion: My Trees uses a single static skeleton with canonical `lt-skeleton*` primitives plus page-owned layout/geometry names (`trees-loading`, `trees-loading-head`, `trees-skeleton-grid`). No JS-injected legacy skeleton exists on My Trees. The `search-skeleton-card` class on My Trees cards is a Browse-named marker (see §8).

## 6. Canonical `lt-skeleton*` consumer matrix

| Canonical primitive | Source | Consumers | Status |
|---|---|---|---|
| `.lt-skeleton` (shimmer + radius + aria-hidden doc comment) | `lovetree-loading-states.css:177-189` | Browse static skeleton (`search.html:70-98`), My Trees static skeleton (`my-trees.html:64-66`); reduced-motion block `:220-223` | RETAIN — active, justified as shared authority |
| `.lt-skeleton-text` | `:191-194` | Browse + My Trees static | RETAIN |
| `.lt-skeleton-title` | `:196-201` | Browse + My Trees static | RETAIN |
| `.lt-skeleton-media` | `:202-205` | Browse + My Trees static | RETAIN |
| `@keyframes lt-shimmer` | `:209-212` | `.lt-skeleton` | RETAIN (contract test 66 requires canonical owns shimmer) |
| `@media (prefers-reduced-motion: reduce)` `.lt-skeleton { animation:none }` | `:219-236` | all `lt-skeleton` consumers | RETAIN (contract test 5/67) |
| `.lt-loading-inline`/`.lt-loading-compact`/`.lt-spinner`/`.lt-long-wait`/`.lt-error-shell` | `lovetree-loading-states.css` | `#browseLoadingStatus`, `#state-loading` | RETAIN |

Answer to required question 4: canonical `lt-skeleton*` primitives ARE actively used (both static skeletons) and remain justified as shared authority (shimmer, radius, reduced-motion, and the aria-hidden requirement are owned here and locked by `shared-loading-state-primitives-contract.test.cjs` and `browse-my-trees-staged-loading-contract.test.cjs` tests 61-67). The only non-canonical active consumer is the JS-rendered legacy skeleton, which bypasses them.

## 7. Accessibility and reduced-motion source findings

Accessibility (`SOURCE_CONFIRMED`):

- All decorative skeleton cards are `aria-hidden="true"` in static HTML: Browse 3 cards (`search.html:69,80,91`), My Trees grid + 3 cards (`my-trees.html:63-66`); locked by `browse-my-trees-staged-loading-contract.test.cjs:64` (test 64 requires `search-skeleton-card" aria-hidden="true"` ×3 on both).
- The JS-rendered legacy skeleton also emits `aria-hidden="true"` cards (`search-card-renderer.js:295`).
- Semantic status containers: `#browseLoadingStatus` has `role="status" aria-live="polite"` + `aria-busy` toggled by the loading manager; `#state-loading` has `role="status" aria-live="polite"`; `#treesContainer` has `aria-busy="true"`; error state uses `role="alert"` (`my-trees.html:69`) and `lt-error-shell` + retry.
- The canonical `.lt-skeleton` block documents that skeleton elements must carry `aria-hidden="true"` in HTML (`lovetree-loading-states.css:186-188`); `shared-loading-state-primitives-contract.test.cjs:267-271` locks this documentation.

Reduced-motion (`SOURCE_CONFIRMED`):

- Canonical authority: `.lt-skeleton { animation:none; background: ... }` under `prefers-reduced-motion: reduce` (`lovetree-loading-states.css:219-223`); `.lt-spinner` spin disabled (`:225-230`).
- Page copies: `my-trees-states.css` has its own reduced-motion block (`.lt-spinner` + `animation:none` + `transition:none`) locked by contract test 59; the JS legacy skeleton injects its own reduce block (`search-card-renderer.js:371-374`).
- Reduced-motion behavior is therefore canonical-owned for the static skeletons, with consistent (redundant) page copies. The JS legacy reduce block retires with the JS skeleton family.

## 8. Cross-file dependency findings

`SOURCE_CONFIRMED`:

1. `css/search.css` @imports `search-results-skeleton.css` (line 14) — the `.search-skeleton-*` geometry loads on Browse only.
2. `css/my-trees.css` does NOT import `search-results-skeleton.css` — My Trees skeleton geometry comes from `my-trees-states.css` + canonical `lovetree-loading-states.css`. There is no functional My Trees CSS dependency on the Browse skeleton file.
3. My Trees HTML still uses the Browse-named class `search-skeleton-card` on its three skeleton cards (`my-trees.html:64-66`) — a class marker with no CSS applied on My Trees (the file defining it is not loaded there). Contract test 64 locks this usage on My Trees. The `my-trees-states.css` header comment states "My Trees skeleton must not depend on Browse-named skeleton classes", but the HTML marker remains — a residual naming coupling (`COMPATIBILITY_IDENTIFIER`), not a styling dependency.
4. `js/my-trees.js`/`my-trees-page.js`/`my-trees-data.js` show/hide `#state-loading` and do not inject skeleton CSS — no My Trees JS dependency on `searchSkeletonPulse` or `search-skeleton-block/line`.
5. `js/search.js` and `js/search/search-index.js` both call `renderLoading()` but are not loaded by `pages/search.html` (only `js/search/index.js` is). They are dormant duplicate orchestrators sharing the same legacy skeleton call.

## 9. Per-family disposition

| Family | Disposition | Justification |
|---|---|---|
| `search-skeleton-card` (card wrapper) | `RETAIN_PAGE_OWNED` | Shared static skeleton wrapper on Browse + My Trees; geometry/pointer-events only (`search-results-skeleton.css:12-21`); locked by contract test 64. |
| `search-skeleton-title/copy/chip/count` (Browse static geometry) | `RETAIN_PAGE_OWNED` | Geometry-only sizing for the Browse static skeleton; allowed in HTML by contract tests 61-62 (only `block`/`line`/`chip-on-my-trees` forbidden). |
| `search-skeleton-block`, `search-skeleton-line` (JS legacy) | `RETIRE_AS_DUPLICATE` | Exist only in the JS-rendered legacy skeleton; forbidden in static HTML by contract tests 61-62. Retire with `renderLoading`. |
| `searchSkeletonPulse` keyframe + `_addAnimations` injected CSS | `RETIRE_AS_DUPLICATE` | Self-injected legacy shimmer that duplicates canonical `lt-shimmer`; page CSS owns no keyframes (contract test 65-66). |
| `renderLoading`/`renderSkeletonGrid`/`renderSkeletonCard` (JS legacy skeleton) | `RETIRE_AS_DUPLICATE` (temporarily active — see §11) | Called at `index.js:421`, replacing the canonical static skeleton at runtime with a non-canonical shimmer; dormant callers in `search-index.js:299` and `js/search.js:225`. Violates canonical §6.4.1 (exactly one primary indicator). |
| `trees-loading`, `trees-loading-head` (My Trees shell) | `RETAIN_PAGE_OWNED` | My Trees loading shell names with canonical co-class `lt-loading-compact`; layout only. |
| `trees-skeleton-grid` (My Trees grid) | `RETAIN_PAGE_OWNED` | My Trees skeleton grid layout (3/2/1 col); locked by contract test 64 + compact-geometry contract. |
| `lt-skeleton`, `lt-skeleton-text/title/media`, `lt-shimmer` | `RETAIN` (canonical authority) | Actively consumed by both static skeletons; owns shimmer, geometry defaults, radius, reduced-motion; locked by `shared-loading-state-primitives-contract` + staged-loading contract tests 61-67. |
| `#browseLoadingStatus` state machine (`lt-loading-inline`, `lt-long-wait`, `lt-error-shell`, `.lt-spinner`, `.browse-loading-copy`) | `RETAIN_PAGE_OWNED` | Canonical staged loading indicator for Browse (`search-data.js:17-116`). |
| My Trees reduced-motion block (`my-trees-states.css`) | `RETAIN_PAGE_OWNED` | Consistent with canonical; locked by contract test 59. |

Answer to required question 8: the current page-owned classes can be explicitly retained WITHOUT contradicting the canonical loading decision, provided the runtime duplicate (JS legacy skeleton) is retired; the static geometry classes are exactly the "page-specific card geometry" the canonical decision permits alongside shared primitives.

## 10. Compatibility identifiers

Identifiers a later implementation must preserve or deliberately migrate (`COMPATIBILITY_IDENTIFIER`, `SOURCE_CONFIRMED`):

HTML classes:
- `.search-skeleton-card` (Browse + My Trees static skeletons; contract test 64), `.tree-card`, `.tree-card-featured`, `.tree-card-media`, `.tree-card-body`, `.tree-meta-row`, `.tree-meta-left`, `.tree-meta-right`, `.tree-meta-chip`, `.reveal-up`.
- `.lt-skeleton`, `.lt-skeleton-text`, `.lt-skeleton-title`, `.lt-skeleton-media` (canonical primitives).
- `.search-skeleton-title`, `.search-skeleton-copy`, `.search-skeleton-chip`, `.search-skeleton-count` (Browse static geometry).
- `.trees-loading`, `.trees-loading-head`, `.trees-skeleton-grid`, `.trees-loaded`, `.error-state`, `.empty-state`.
- `.lt-loading-inline`, `.lt-loading-compact`, `.lt-spinner`, `.lt-long-wait`, `.lt-error-shell`, `.lt-error-heading`, `.lt-error-body`, `.lt-error-retry-btn`, `.browse-loading-copy`, `.lt-retry-btn`.

HTML ids:
- `#resultsList`, `#browseLoadingStatus`, `#browseStoryNavMount`, `#treesContainer`, `#state-loading`, `#state-error`, `#state-empty`, `#state-loaded`, `#growingTreesList`.

JS API:
- `CardRenderer.renderLoading` / `renderResults` / `renderSkeletonGrid` / `renderSkeletonCard` / `_addAnimations` (the last three retire with the legacy family).
- `createBrowseLoadingManager` and its `start()`/`ready()`/`error()`/`dispose()` + `state.currentLoadGen` (`js/search/search-data.js:17-116,208-214,297-400`).
- `window.t` loading keys used by the manager.

CSS files:
- `css/search/search-results-skeleton.css` (Browse grid + skeleton geometry + status bar styling), `css/my-trees/my-trees-states.css` (state sections + skeleton sizing + reduced-motion), `css/my-trees/my-trees-responsive.css` (grid responsiveness), `css/global/lovetree-loading-states.css` (canonical primitives).

i18n keys:
- `search.loadingPublicTrees` (`js/i18n/i18n-search.js:310`), `loading.long.wait`, `loading.error.primary`, `loading.error.body`, `loading.retry.action` (`js/i18n/i18n-shared.js:440-460`), `myTrees.loading` (`js/i18n/i18n-my-trees.js:28`).

Contracts (read-only now; the retirement child must update deliberately):
- `browse-my-trees-staged-loading-contract.test.cjs` tests 59-67 (canonical convergence locks).
- `shared-loading-state-primitives-contract.test.cjs` (skeleton primitives + reduced-motion + aria-hidden documentation).
- `browse-my-trees-compact-geometry-3608-browser-contract.test.cjs` test `#3688 browser: canonical staged loading skeleton runtime` (static skeleton geometry + `lt-shimmer`/reduced-motion).
- `browse-story-view-foundation-3655-browser-contract.test.cjs` (skeleton fixture using `search-skeleton-card`/`search-skeleton-block` in a test-side template).

Legacy selectors to retire (not compatibility, but must be removed atomically with the child): `searchSkeletonPulse`, `search-skeleton-block`, `search-skeleton-line`, and the injected `#search-card-anim-style` style element.

## 11. Exit conditions where retained temporarily

The JS-rendered legacy skeleton family is `RETIRE_AS_DUPLICATE` but remains active until the single future child (§14) executes the retirement. Exit condition (`KEEP_TEMPORARILY_WITH_EXIT_CONDITION`):

```text
Exit: remove the runtime duplicate JS skeleton
  - remove `refs.resultsList.innerHTML = CardRenderer.renderLoading();` at js/search/index.js:421
  - remove dormant calls at js/search/search-index.js:299 and js/search.js:225
  - remove renderSkeletonCard / renderSkeletonGrid / renderLoading / _addAnimations
    and the injected `#search-card-anim-style` (including @keyframes searchSkeletonPulse
    and the search-skeleton-block/line/chip rules)
  - confirm via browse-my-trees-compact-geometry-3608-browser-contract
    (#3688 staged loading runtime) and browse-my-trees-staged-loading-contract
    that the static canonical skeleton + #browseLoadingStatus are the sole Browse indicators
```

No other family is retained temporarily; every other family is `RETAIN_PAGE_OWNED` or canonical `RETAIN`.

## 12. `UNRESOLVED_RUNTIME` items

1. Whether the JS-rendered legacy skeleton (with `searchSkeletonPulse`) and the static canonical skeleton are simultaneously visible in a real browser (both are wired in source: static HTML first paint + `renderLoading()` at DOMContentLoaded); the visual overlap is not provable from source alone.
2. Whether removing `renderLoading()` leaves the results grid with the intended static skeleton in the correct grid position across all viewports (the static cards live in `#resultsList` but the status bar is a sibling; layout correctness is browser-observable).
3. Whether the canonical `lt-shimmer` and the legacy `searchSkeletonPulse` differ visibly (animation duration/curve/background gradient), so users perceive the runtime switch.
4. Whether My Trees' `search-skeleton-card` marker (no CSS applied) has any observable effect (pointer-events/box-shadow absent on My Trees since `search-results-skeleton.css` is not loaded).
5. Reduced-motion adequacy of the legacy skeleton before retirement (the injected reduce block exists; its effective behavior is browser-observable).

## 13. #3688 closure impact

Answer to required question 10 (`SOURCE_CONFIRMED` verdict):

```text
PR #3783 merge + this disposition decision alone are NOT sufficient to close #3688.
One actual implementation child (CSS/JS/HTML) is still required.
```

Reason: the runtime duplicate legacy skeleton is still actively wired — `js/search/index.js:421` replaces the canonical static skeleton with `CardRenderer.renderLoading()` (`search-skeleton-block/line` + self-injected `@keyframes searchSkeletonPulse`). Until the retirement child (§14) lands and its browser evidence confirms the canonical static skeleton + `#browseLoadingStatus` are the sole Browse indicators, Browse still renders a legacy, non-canonical skeleton that contradicts `LOADING_STATE_CANONICAL_DECISION.md` §6.4.1 (exactly one primary indicator per operation). After the child merges with focused contracts + browser evidence, and PR #3783 (Editor real-local evidence) passes independent #3785 review, the #3688 closure review can be assessed by the Web CTO. This decision does not close or modify #3688.

## 14. Future child — maximum 1

Child 1 — **Retire the JS-rendered legacy skeleton family** (U3 runtime-sensitive):

- Exact surface: Browse (`pages/search.html` + `js/search/**`).
- Candidate files: `js/search/search-card-renderer.js` (remove `renderSkeletonCard`/`renderSkeletonGrid`/`renderLoading`/`_addAnimations` + injected style), `js/search/index.js` (remove line 421 `renderLoading()` call), `js/search/search-index.js` + `js/search.js` (remove dormant calls; confirm no page loads them), optionally `tests/contracts/browse-story-view-foundation-3655-browser-contract.test.cjs` (test-side skeleton fixture) and a new/updated source-static contract locking "no `renderLoading` legacy skeleton, canonical static skeleton is the sole Browse skeleton".
- Implementation boundary: JS + test-contract only; no CSS file change except removing nothing from page CSS (page CSS is already canonical-compliant); no `search-results-skeleton.css` change unless a geometry gap is found.
- Authority boundary: Browse page-owned controller; canonical `lt-skeleton*` primitives remain shared authority (unchanged).
- Accessibility requirements: preserve `aria-hidden="true"` on the static skeleton cards; keep `#browseLoadingStatus` `role="status" aria-live="polite"` + `aria-busy` toggling; reduced-motion stays canonical.
- Test type: source-static contract (no legacy skeleton in active JS path; static canonical skeleton intact) + focused U2/U3 browser contract reusing `browse-my-trees-compact-geometry-3608-browser-contract` (#3688 staged loading runtime) to confirm sole-indicator skeleton.
- Browser verification: **YES** (initial-paint skeleton, results-grid coverage, no duplicate shimmer, reduced-motion).
- Non-overlap: does not touch My Trees skeletons, canonical `lt-skeleton*`, status-bar state machine, or any other family in §9.

No second child is proposed (Issue #3790 allows at most one). This child is not created or implemented by this decision.

## 15. Explicit non-actions

This decision does not authorize, and no worker may perform under this document:

```text
no pages/** change
no css/** change
no js/** change
no tests/** change
no package/workflow change
no browser/Playwright/screenshots
no Preview/Production
no CSS migration in this child
no Ready/merge/Issue closure by the worker
no modification of PR #3783, #3787, #3789, #3780, or their worktrees
no reuse/recovery/repair/reset/clean/stash of any prior 3790 branch or worktree
no rebase/reset/amend/force push
no worktree deletion
no Closes/Fixes/Resolves on #3688, #3672, #3670, or #1882 (Refs only)
```

## 16. Rollback

- This record is additive (one new `docs/architecture/` file); rollback is branch deletion / revert of the single-file Draft PR with no runtime state.
- The future retirement child is rollback-safe per PR: it must ship the JS removal plus its contract update atomically (mirroring how `browse-my-trees-staged-loading-contract.test.cjs` already locks canonical convergence), so the skeleton change and its guard are reviewable together.

Refs #3790.
Refs #3688 — Keep OPEN pending completion.
Refs #3784 — Editor evidence implementation.
Refs #3785 — independent Editor evidence review.
Refs #3672 — Keep OPEN.
Refs #3670 — Keep OPEN.
Refs #1882 — Keep OPEN.
