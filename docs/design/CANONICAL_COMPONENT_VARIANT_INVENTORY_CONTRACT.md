# Canonical Component Variant Inventory Contract

## 1. Status and Exact Base SHA

- **Status:** Source-only decision contract
- **Base SHA:** `0fb7cd7dbf79098930a5d43fdb440458ce0a59b0`
- **Merge Base:** `0fb7cd7dbf79098930a5d43fdb440458ce0a59b0`
- **Evidence boundary:** Source reading only. No browser, screenshot, Preview, or Production verification authorized.
- **Parent:** #3672 — Keep OPEN
- **Previous child:** #3674 — Design System audit baseline (`docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md`)

## 2. Evidence Boundary

All source evidence is gathered from the exact base SHA checked out at `origin/main`. The following authority files were read:

- `index.html` — Home page entrypoint
- `pages/search.html` — Browse/Discovery entrypoint
- `pages/my-trees.html` — Owner management entrypoint
- `pages/editor.html` — Editor entrypoint
- `pages/settings.html` — Settings entrypoint
- `pages/detail.html` — Public detail entrypoint
- `css/global.css` — Global stylesheet (imports tokens, base, header, ready-state, transitions)
- `css/global/tokens.css` — Design tokens
- `css/global/global-base.css` — Base/ground styles
- `css/global/global-header.css` — Shared header
- `css/global/lovetree-loading-states.css` — Shared loading/error/empty primitives
- `css/index/visual/growth-stage.css` — Home growth-stage cards and video modal
- `js/index-inline-init.js` — Home runtime, video modal lifecycle
- `css/search/` — Browse search system
- `css/my-trees/` — My Trees system
- `css/editor/` — Editor system
- `css/settings.css` — Settings system
- `css/shared/` — Shared component CSS
- `js/shared/` — Shared component JS
- `css/components/lovebud-ai-panel.css` — AI panel component
- `docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md` — Previous child #3674

## 3. Source Authority Rules

Each rule is preceded by its claim type.

- **OBSERVED_SOURCE_FACT:** `css/global/tokens.css` defines shared visual properties (`--lovetree-*`, `--primary`, `--radius-*`) consumed across `index.html`, `pages/search.html`, `pages/my-trees.html`, `pages/editor.html`, `pages/settings.html`, and `pages/detail.html`.
- **OBSERVED_SOURCE_FACT:** `css/global.css` defines ground styles (`.btn-round`, `.btn-primary`, `.btn-outline`, `.tag-chip`, `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`). Page-specific overrides exist in respective `css/<page>/` directories and are loaded after `global.css`.
- **OBSERVED_SOURCE_FACT:** `css/shared/` contains CSS (`love-tree-card-composition.css`, `preview-hub-scroll.css`, `preview-hub-content-slots.css`) consumed by both `pages/search.html` and `pages/my-trees.html` via `@import`.
- **OBSERVED_SOURCE_FACT:** `js/shared/` contains JS (`tree-card-composition.js`, `appreciation-*.js`, `canonical-appreciation-detail-presentation.js`) consumed by both Browse and My Trees.
- **OBSERVED_SOURCE_FACT:** `css/components/lovebud-ai-panel.css` is imported by all pages.
- **CONTRACT_VARIANT_DECISION:** Page-specific styles in `css/<page>/` own their layout, hero, and state presentation.
- **FUTURE_RECOMMENDATION:** Shared selectors in `css/global.css` should not be mutated by page-specific overrides. This is not currently enforced.
- **OBSERVED_SOURCE_FACT:** The classes `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title` in `css/global.css` are consumed by `index.html`, `pages/search.html`, and `pages/my-trees.html`.

---

## 4. Canonical Component Inventory Matrix

### 4.1 Page Hero

| Field | Value |
|---|---|
| **Canonical family** | Page Hero |
| **Exact source owner** | `css/global.css` (shared eyebrow/title utilities), `css/index/` (Home hero), `css/search/` (Browse hero), `css/my-trees/` (My Trees hero), `css/detail/` (Detail hero), `css/intro/` (Intro hero) |
| **Consumer pages** | `index.html`, `pages/search.html`, `pages/my-trees.html`, `pages/detail.html`, `pages/intro.html` |
| **Approved variants** | `home-v3-hero`, `search-page-hero`, `my-trees-page-hero`, `detail-hero`, `intro-hero` |

**Structure:**

- **Home (`index.html`):** `<section class="home-v3-hero">` with `.home-v3-copy`, `.home-v3-identity-copy`, `.home-v3-eyebrow`, `.home-v3-title`, `.home-v3-desc`, `.home-v3-actions`, `.home-v3-collage`
  - OBSERVED_SOURCE_FACT: Source at `css/index/layout.css`, `css/index/responsive.css`. Uses shared classes `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`. Eyebrow has `home.v3.eyebrow` i18n key.

- **Browse (`pages/search.html`):** `<div class="browse-curation-shell">` with `.search-panel-header`, `.page-hero-eyebrow.shared-mobile-hero-eyebrow`, `.headline.shared-mobile-hero-title`
  - OBSERVED_SOURCE_FACT: Source at `css/search/search-hero-controls.css`. Uses shared classes `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`.

- **My Trees (`pages/my-trees.html`):** Same structure as Browse. Uses same shared eyebrow/title classes.
  - OBSERVED_SOURCE_FACT: Source at `css/my-trees/`.

- **Detail (`pages/detail.html`):** `<section class="detail-hero">` with `.detail-hero-kicker`, `.detail-hero-title`, `.detail-hero-desc`
  - OBSERVED_SOURCE_FACT: Source at `css/detail/`. Does NOT use shared eyebrow/title classes.

- **Intro (`pages/intro.html`):** `<section class="intro-hero">` with `.intro-hero-eyebrow`, `h1`, `.lead`, `.intro-hero-actions`
  - OBSERVED_SOURCE_FACT: Source at `css/intro/hero/` (layered: base, layout, tree-visual, moments, animations, responsive).

**Semantic differences:**
- Home hero is emotional/youtube-titled with growth-stage collage; Browse/My Trees hero is text/copy-only with shared shared-mobile-hero classes; Detail hero is kicker+title+desc; Intro hero uses its own distinct system.

**Approved variant names:** `home-hero`, `browse-hero`, `my-trees-hero`, `detail-hero`, `intro-hero`.

**Visual-only differences:** Home hero uses a collage/growth-stage visual. Intro hero uses a scrapbook tree visual. Browse/My Trees are copy-only with shared-mobile-hero-title.

**Authority/security differences:** The hero element itself has no mutation authority. Browse is public discovery. My Trees is authenticated owner-management context.

---

### 4.2 Primary Button

| Field | Value |
|---|---|
| **Canonical family** | Primary Button |
| **Exact source owner** | `css/global.css` lines 112-161 (`.btn-round`, `.btn-primary`, `.btn-outline`), `css/index/components.css` (Home variants), `css/editor/editor-overrides.css` |
| **Consumer pages** | **Global definition authority:** loaded by all pages via `css/global.css`.<br>**Static HTML consumers:** `index.html` (`.btn-round.btn-primary`, `.btn-round.btn-outline`), `pages/my-trees.html` (`.btn-round.btn-primary`).<br>**Runtime/template-generated consumers:** `pages/search.html` — Browse (`js/search/search-preview-action-helper.js` lines 102, 122, 144: `.btn-round.preview-secondary-action`, `.btn-round.preview-share-action`, `.btn-round.btn-primary.preview-primary-action`); `pages/detail.html` — Detail (`js/detail/detail-loading-error-boundary.js` lines 21-22: `.btn-round.btn-outline`); all pages — Auth header (`js/auth/auth-ui-templates.js` line 20: `.btn-round.btn-outline` login button, conditionally rendered when unauthenticated; `js/auth.js` line 419: inline fallback).<br>**CSS-only references:** `pages/editor.html` (editor CSS references `.btn-round` in descendant selectors, defines `.sidebar-btn-primary`, `.editor-action-btn-primary`). |
| **Approved variants** | `btn-round.btn-primary`, `btn-round.btn-outline`, `btn-header-create`, `sidebar-btn-primary`, `editor-action-btn-primary` |

**Structure:**

- OBSERVED_SOURCE_FACT: Global `.btn-round` (base rounded button), `.btn-primary` (filled primary rose), `.btn-outline` (outlined variant) at `css/global.css` lines 112-161. Mobile override at line 161 (full-width). High-specificity `body .btn-round` override at line 474.
- OBSERVED_SOURCE_FACT: Home `.btn-round` in `.home-v3-actions` at `css/index/components.css` lines 8-47 — Home-specific icon layout.
- OBSERVED_SOURCE_FACT: My Trees `.btn-header-create` in `css/my-trees/my-trees-header.css` — distinct create-tree button with icon.
- OBSERVED_SOURCE_FACT: Editor `.sidebar-btn-primary` in `css/editor/editor-overrides.css` line 32, `.btn-icon` line 47, `.btn-label` line 53.
- OBSERVED_SOURCE_FACT: Browse runtime — `js/search/search-preview-action-helper.js` functions `renderPreviewActionButton()` (line 93), `renderShareButton()` (line 114), `renderOpenTreeButton()` (line 135) generate `.btn-round.preview-secondary-action`, `.btn-round.preview-share-action`, `.btn-round.btn-primary.preview-primary-action` respectively.
- OBSERVED_SOURCE_FACT: Detail runtime — `js/detail/detail-loading-error-boundary.js` function `renderMissingMemoryState()` (line 3) generates `.btn-round.btn-outline` anchor tags for fallback UI (lines 21-22).
- OBSERVED_SOURCE_FACT: Auth header runtime — `js/auth/auth-ui-templates.js` function `buildLoginButton()` (line 17) generates `.btn-round.btn-outline` login anchor (line 20). Included by all 7 pages. `js/auth.js` line 419 provides inline fallback. Output lands conditionally in `#auth-nav` container when unauthenticated; replaced by user dropdown when authenticated.

**Approved variant names:** `primary-action` (`.btn-round.btn-primary`), `outline-action` (`.btn-round.btn-outline`), `header-create` (My Trees), `sidebar-primary` (Editor), `editor-action-primary`, `editor-action-secondary`, `floating-toolbar-primary`.

---

### 4.3 Secondary Button

**UNRESOLVED.** No shared secondary button class exists. Each page defines its own pattern:

- OBSERVED_SOURCE_FACT: Editor `.editor-action-btn-secondary` in `css/editor/editor-detail-actions.css` line 72
- OBSERVED_SOURCE_FACT: Editor `.btn-icon` in `css/editor/editor-overrides.css` line 47
- OBSERVED_SOURCE_FACT: Settings `.settings-close-btn` (close × glyph)
- OBSERVED_SOURCE_FACT: Detail `.detail-back-link` with `material-symbols-outlined` + text
- OBSERVED_SOURCE_FACT: Memory edit `.btn-cancel` in `css/editor/editor-memory-edit.css`

---

### 4.4 Search Input

| Field | Value |
|---|---|
| **Canonical family** | Search Input |
| **Exact source owner** | `css/search/search-controls.css` (Browse), `css/my-trees/my-trees-finder.css` (My Trees) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-search-input`, `my-trees-finder` |

- OBSERVED_SOURCE_FACT: Browse `.search-input-wrapper` > `span.material-symbols-outlined.search-icon` + `input.search-input[type="text"]` at `css/search/search-controls.css`. ID: `searchInput`.
- OBSERVED_SOURCE_FACT: My Trees `.search-input-wrapper.my-trees-search-box` > `span.material-symbols-outlined.search-icon` + `input.search-input.my-trees-search-input[type="text"]` at `css/my-trees/my-trees-finder.css`. ID: `myTreesSearchInput`.

**Semantic differences:** Browse search is public discovery. My Trees finder is owner tree filtering. Same HTML structure pattern with page-specific class appended.

---

### 4.5 Filter Chip

| Field | Value |
|---|---|
| **Canonical family** | Filter Chip |
| **Exact source owner** | `css/global.css` (`.tag-chip` base), `css/search/search-controls.css` (Browse chip layout), `css/my-trees/my-trees-finder.css` (My Trees chip layout) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-filter-chip`, `my-trees-filter-chip` |

- OBSERVED_SOURCE_FACT: Global `.tag-chip` in `css/global.css` lines 154-160 (base), lines 541-601 (overrides).
- OBSERVED_SOURCE_FACT: Browse uses `<span class="tag-chip active" data-category="...">` elements. My Trees uses `<button type="button" class="my-trees-filter-chip tag-chip active" data-filter="...">` elements.
- OBSERVED_SOURCE_FACT: My Trees mobile chip scroll at `css/my-trees/my-trees-responsive.css` lines 51-63.

**Semantic divergence:** Browse chips use `<span>` (no button semantics). My Trees chips use `<button>` (correct interactive semantics). This is an accessibility divergence.

---

### 4.6 Card Shell

| Field | Value |
|---|---|
| **Canonical family** | Card Shell |
| **Exact source owner** | `css/global/tokens.css` (card tokens), `css/shared/love-tree-card-composition.css` (shared shell), `css/search/search-tree-card/layout.css` (Browse card), `css/my-trees/my-trees-cards.css` (My Trees cards), `css/global.css` (`.lovetree-card` legacy) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html`, `pages/detail.html` |
| **Approved variants** | `love-tree-card` (shared), `tree-card` (Browse), `my-trees-card` (My Trees), `lovetree-card` (legacy) |

- OBSERVED_SOURCE_FACT: Shared `.love-tree-card` in `css/shared/love-tree-card-composition.css` — base shell with surface, border-radius, hover states, `::before`/`::after` accent bars.
- OBSERVED_SOURCE_FACT: Browse `.tree-card` in `css/search/search-tree-card/layout.css` — extends shared shell with padding, media height, active/selected states.
- OBSERVED_SOURCE_FACT: My Trees page-specific card selectors in `css/my-trees/my-trees-cards.css`.
- OBSERVED_SOURCE_FACT: Mode variants `large`, `compact`, `list`, `story` — controlled via `#resultsList[data-tree-view-mode="..."]` in `css/tree-view-mode.css`.
- OBSERVED_SOURCE_FACT: Legacy `.lovetree-card` in `css/global.css`.

**Approved variant names:** `love-tree-card-browser`, `tree-card-browse`, `tree-card-my-trees`, `tree-card-large`, `tree-card-compact`, `tree-card-list`, `tree-card-story`, `lovetree-card-legacy`.

---

### 4.7 Result/Section Header

| Field | Value |
|---|---|
| **Canonical family** | Results Header |
| **Exact source owner** | `css/search/search-controls.css`, `css/my-trees/my-trees-header.css` |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-results-head`, `my-trees-results-head` |

- OBSERVED_SOURCE_FACT: Browse `.browse-results-head.lovetree-calm-results-head` > `.browse-results-title-slot` + `.browse-results-sort-slot` + `.browse-results-view-mode-slot`.
- OBSERVED_SOURCE_FACT: My Trees `.my-trees-results-head.lovetree-calm-results-head` > `.browse-results-title-slot` + `.browse-results-owner-cta-slot` + `.browse-results-view-mode-slot`. Sort slot replaced by owner CTA slot.

---

### 4.8 Right-Side Hub

| Field | Value |
|---|---|
| **Canonical family** | Preview Hub |
| **Exact source owner** | `css/shared/preview-hub-scroll.css`, `css/shared/preview-hub-content-slots.css`, `css/search/` (Browse hub), `css/my-trees/my-trees-preview-hub/` (My Trees hub) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-preview-hub`, `my-trees-preview-hub` |

- OBSERVED_SOURCE_FACT: Shared `.preview-hub` scroll container at `css/shared/preview-hub-scroll.css`.
- OBSERVED_SOURCE_FACT: Shared `.preview-hub-social-slot` at `css/shared/preview-hub-content-slots.css`.
- OBSERVED_SOURCE_FACT: Browse hub shows tree preview, social bar, moments list.
- OBSERVED_SOURCE_FACT: My Trees hub at `css/my-trees/my-trees-preview-hub/` — layered layout, content, flow, states, actions, responsive, social-bar. Includes `.my-trees-hub-panel`, `.my-trees-hub-content`, `.my-trees-hub-actions`, `.my-trees-hub-social-bar`. States: `.is-empty`, `.is-loading`.

---

### 4.9 Loading Presentation

| Field | Value |
|---|---|
| **Canonical family** | Loading Presentation |
| **Exact source owner** | `css/global/lovetree-loading-states.css` (shared primitives), page-specific CSS (page-owned transitions) |
| **Consumer pages (shared primitives — exact verified):** | `pages/search.html` (Browse: `.lt-loading-inline`, `.lt-spinner`), `pages/my-trees.html` (My Trees: `.lt-spinner`, `.lt-loading-compact`) |
| **Consumer pages (page-owned loading):** | `index.html` (Home modal: `.hero-video-modal-loading*` LOADING / LONG_WAIT / READY / ERROR / RETRYING state machine), `pages/editor.html` (editor staged runtime: `.editor-loading-shell`), `pages/search.html` (Browse search runtime), `pages/my-trees.html` (My Trees hub runtime) |
| **Approved variants** | `lt-loading-inline`, `lt-loading-compact`, `lt-long-wait`, `lt-degraded`, `lt-skeleton*`, page-owned variants |

**Consumer structure:**

```text
Shared presentation primitives:
  exact verified consumers: Browse (.lt-loading-inline, .lt-spinner),
                           My Trees (.lt-spinner, .lt-loading-compact)
  Unused in direct DOM: Home, Editor, Settings, Detail, Intro

Home modal:
  page-owned .hero-video-modal-loading* | LOADING / LONG_WAIT / READY / ERROR / RETRYING

Editor:
  page-owned .editor-loading-shell staged runtime + verified shared primitive availability

Browse:
  page-owned .search-loading search runtime + verified shared primitive use (.lt-loading-inline, .lt-spinner)

My Trees:
  page-owned hub runtime + verified shared spinner use (.lt-spinner, .lt-loading-compact)
```

**Shared primitives** (in `css/global/lovetree-loading-states.css`):
- OBSERVED_SOURCE_FACT: `.lt-loading-inline` — inline spinner + text
- OBSERVED_SOURCE_FACT: `.lt-loading-compact` — compact spinner
- OBSERVED_SOURCE_FACT: `.lt-spinner` — shared spinning animation
- OBSERVED_SOURCE_FACT: `.lt-long-wait` — extended wait message
- OBSERVED_SOURCE_FACT: `.lt-degraded` — degraded state

**Page-owned loading:**
- OBSERVED_SOURCE_FACT: Home modal: `.hero-video-modal-loading`, `.hero-video-modal-loading-spinner`, `.hero-video-modal-loading-text` in `css/index/visual/growth-stage.css`. Runtime states: `LOADING`, `LONG_WAIT` (`.is-long-wait` at 8s), `READY` (`.hero-video-modal-ready`), `ERROR` (`.hero-video-modal-error`), `RETRYING`. Owned by `js/index-inline-init.js` functions `openVideoModal()`, `createModalLoadingEl()`, `handleModalIframeLoad()`, `handleModalLongWait()`, `handleModalTimeout()`, `showModalError()`, `retryVideoModal()`, `cleanupModalTimers()`.
- OBSERVED_SOURCE_FACT: Editor staged loading: `.editor-loading-shell`, `js/editor/editor-initial-load-flow.js`.
- OBSERVED_SOURCE_FACT: Browse: `.search-loading`, result-list loading.
- OBSERVED_SOURCE_FACT: My Trees: `.my-trees-loading`, hub loading states.

**Distinction:** Shared primitives are presentation-only. Page-owned loading includes runtime transition logic and region-owned indicators. These are distinct patterns and should not be merged into a single component.

---

### 4.10 Empty Presentation

| Field | Value |
|---|---|
| **Canonical family** | Empty State |
| **Exact source owner** | `css/global/tokens.css` (empty-state token authority), page-specific CSS |
| **Shared token consumers** | `pages/search.html` (Browse: `css/search/search-empty-state.css`, `css/search/search-preview-sidebar/states.css`), `pages/my-trees.html` (My Trees: `css/my-trees/my-trees-states.css`) |
| **Page-owned empty-state implementations** | `pages/editor.html` (`.editor-empty-state-cta` in `css/editor/editor-detail-content/detail-info.css` line 258) |
| **Approved variants** | Shared tokens, page-specific empty presentations |

- OBSERVED_SOURCE_FACT: Shared `--lovetree-empty-state-*` tokens in `css/global/tokens.css` lines 83-97.
- OBSERVED_SOURCE_FACT: My Trees `.empty-state` in `css/my-trees/my-trees-states.css` line 27.
- OBSERVED_SOURCE_FACT: Editor `.editor-empty-state-cta` in `css/editor/editor-detail-content/detail-info.css` line 258.
- OBSERVED_SOURCE_FACT: Browse has inline empty result states.

**No single empty-state component exists.** Shared token consumption and page-owned implementations are distinct patterns.
- **Shared token consumers:** Browse (`css/search/`), My Trees (`css/my-trees/`).
- **Page-owned implementation:** Editor (`.editor-empty-state-cta`).
- **No shared token or page-owned empty state:** Home, Settings, Detail.

---

### 4.11 Error Presentation

| Field | Value |
|---|---|
| **Canonical family** | Error State |
| **Exact source owner (shared):** `css/global/lovetree-loading-states.css` (shared error shell) |
| **Exact source owner (page-owned):** `css/index/visual/growth-stage.css` (Home modal), page-specific CSS |
| **Consumer pages (shared):** `pages/editor.html`, `pages/search.html`, `pages/my-trees.html` |
| **Consumer pages (page-owned):** `index.html` (Home modal) |
| **Approved variants** | `lt-error-shell`, `hero-video-modal-error` (Home page-owned) |

**Shared shell** (in `css/global/lovetree-loading-states.css` lines 120-170):
- OBSERVED_SOURCE_FACT: `.lt-error-shell` — error container; `.lt-error-icon` — icon area; `.lt-error-heading` — heading; `.lt-error-body` — description; `.lt-retry-btn` — retry action button.

**Page-owned Home modal error** (in `css/index/visual/growth-stage.css`):
- OBSERVED_SOURCE_FACT: `.hero-video-modal-error` — error overlay panel; `.hero-video-modal-error-icon` — error icon; `.hero-video-modal-error-text` — error heading; `.hero-video-modal-error-desc` — error description; `.hero-video-modal-retry-btn` — retry button. Owned by `js/index-inline-init.js` functions `showModalError()`, `handleModalIframeError()`, `handleModalTimeout()`.

**Distinction:** Shared `.lt-error-shell` and page-owned `.hero-video-modal-error` are separate patterns. The Home modal error is specific to video playback within the modal overlay and should not be consolidated with the shared error shell without separate authorization.

---

### 4.12 Media Control

| Field | Value |
|---|---|
| **Canonical family** | Media Control / Thumbnail |
| **Exact source owner** | `css/index/visual/growth-stage.css` (Home growth-stage cards), `css/search/search-tree-card/media.css` (Browse cards), page-specific CSS |
| **Consumer pages** | `index.html` (Home), `pages/search.html` (Browse), `pages/detail.html`, `pages/editor.html` |
| **Approved variants** | `home-card-media`, `tree-card-media`, `detail-main-media`, `editor-canvas-media` |

- OBSERVED_SOURCE_FACT: Home `.growth-stage-card-media` with `.growth-stage-card-play` at `css/index/visual/growth-stage.css`. Cards have `.growth-stage-card-fallback` placeholder.
- OBSERVED_SOURCE_FACT: Browse `.tree-card-media` at `css/search/search-tree-card/media.css`. Height: `--lovetree-card-image-height` (136px). Includes `.tree-card-media-fallback`.
- OBSERVED_SOURCE_FACT: Detail `.detail-main-media` with `.video-main` and `.detail-media-loading`.
- OBSERVED_SOURCE_FACT: Editor canvas node media with edit controls. Specific selectors and ownership are PAGE_SPECIFIC (not documented in detail here).

---

### 4.13 Modal/Dialog

| Field | Value |
|---|---|
| **Canonical family** | Modal / Dialog |
| **Exact source owner** | Dispersed. No single modal authority. |
| **Consumer pages** | `index.html` (Home), `pages/editor.html`, `pages/settings.html` |
| **Approved variants** | `hero-video-modal`, `editor-memory-form-modal`, `settings-card-dialog`, `editor-rename-modal`, `editor-connect-modal` |

**Home video modal:**
- OBSERVED_SOURCE_FACT: CSS at `css/index/visual/growth-stage.css` lines 704-920. Selectors: `.hero-video-modal` (full-screen overlay), `.hero-video-modal-panel` (centered panel), `.hero-video-modal-player` (16:9 iframe container), `.hero-video-modal-close` (close button). Animations: `hero-video-modal-fade` 0.18s, `hero-video-modal-pop` 0.24s.
- OBSERVED_SOURCE_FACT: JS owner: `js/index-inline-init.js`. Functions: `openVideoModal()` — creates modal + iframe; `closeVideoModal()` — removes modal + resumes spotlight; `retryVideoModal()` — recreates exactly one iframe; `cleanupModalTimers()` — clears all timers on close/error; `handleModalIframeLoad()` — transitions to READY; `handleModalIframeError()` — transitions to ERROR; `handleModalLongWait()` — transitions to LONG_WAIT at 8s; `handleModalTimeout()` — transitions to ERROR at 30s; `showModalError()` — renders error UI; `createModalLoadingEl()` — creates loading indicator; `modalAttemptId` — stale-event guard.
- OBSERVED_SOURCE_FACT: Staged loading states (added by #3709):
  - `LOADING` — `.hero-video-modal-loading` with spinner and text
  - `LONG_WAIT` — `.hero-video-modal-loading.is-long-wait` at 8-second threshold
  - `READY` — `.hero-video-modal-ready`, hides loading/error
  - `ERROR` — `.hero-video-modal-error` with icon, text, description, retry button
  - `RETRYING` — `retryVideoModal()` recreates iframe, increments `modalAttemptId`, reuses loading states
- OBSERVED_SOURCE_FACT: Modal implements: `role="dialog"`, `aria-modal="true"`, initial focus on Close button, focus trap, Escape close, backdrop close, focus restoration on close, reduced-motion status preservation, spotlight pause/resume. The player has `aria-busy` during loading.
- OBSERVED_SOURCE_FACT: No `<dialog>` element is used. Overlay is a `<div>` with ARIA dialog semantics.

**Editor memory form modal:**
- OBSERVED_SOURCE_FACT: `.editor-memory-form-modal` in `css/editor/editor-memory-form-modal-layout.css`. Uses `.is-open` class toggle. Internal sections: `.editor-modal-eyebrow`, `.editor-modal-title`, `.editor-modal-intro`. Form fields, textarea, connect row, actions.

**Settings dialog:**
- OBSERVED_SOURCE_FACT: `.settings-card` with `role="dialog"` `aria-modal="true"` on a non-`<dialog>` element. Close button, sectioned content, profile edit form.

**No shared modal component. Each modal is page-specific and independently styled.**

---

### 4.14 Focus Treatment

| Field | Value |
|---|---|
| **Canonical family** | Focus Treatment |
| **Exact source owner** | `css/global.css` (`.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible`, `.tag-chip:focus-visible`), `css/shared/love-tree-card-composition.css` (card focus-visible) |
| **Consumer pages** | `index.html`, `pages/search.html`, `pages/my-trees.html`, `pages/editor.html`, `pages/settings.html`, `pages/detail.html`, `pages/intro.html` |
| **Approved variants** | `global-focus-ring`, `card-focus-visible`, `button-focus-visible`, `chip-focus-visible` |

- OBSERVED_SOURCE_FACT: Global `.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible` in `css/global.css` lines 591-593.
- OBSERVED_SOURCE_FACT: `.tag-chip:focus-visible` in `css/global.css` lines 564, 595.
- OBSERVED_SOURCE_FACT: `.love-tree-card:focus-visible` in `css/shared/love-tree-card-composition.css`.
- OBSERVED_SOURCE_FACT: Home video modal implements initialCloseFocus, focus trap, Escape close, focus restoration.

**UNRESOLVED:** No shared `--focus-ring` token or `.focus-ring` utility class exists. Each component defines its own `:focus-visible` treatment. Home modal focus behavior is page-owned.

---

## 5. Variant Taxonomy

| Variant Type | Items | Count |
|---|---|---|
| **CANONICAL_CANDIDATE** | `.btn-round` / `.btn-primary` / `.btn-outline` base, `.tag-chip` visual base, `--lovetree-card-*` tokens, `--lovetree-empty-state-*` tokens, `.lt-loading-*` primitives, `.lt-error-shell`, `.preview-hub` scroll/content | 7 |
| **APPROVED_VARIANT** | `btn-primary` / `btn-outline`, `browse-filter-chip` / `my-trees-filter-chip` (visual), `tree-card-browse` / `tree-card-my-trees`, `browse-preview-hub` / `my-trees-preview-hub`, `browse-search-input` / `my-trees-finder`, `browse-results-head` / `my-trees-results-head` | 6 pairs (12) |
| **PAGE_SPECIFIC** | Home hero, Browse hero, My Trees hero, Detail hero, Intro hero, Editor memory form modal, Settings card dialog, Home video modal, Home modal loading/error states, Editor canvas media | 10 |
| **AUTHORITY_SPECIFIC** | Browse public card vs My Trees owner card (CTA, hub actions, permissions), Editor view vs Editor edit (toolbar, memory form access) | 2 boundaries |
| **LEGACY_CANDIDATE** | `.lovetree-card` in `global.css`, `gemini-v2/`, `gemini-v3/`, `kimi-v2/`, `gpt-v2/`, `v2/` page directories | 6 |
| **DUPLICATE_CANDIDATE** | Browse `<span>` filter chip vs My Trees `<button>` filter chip (same visual, different element), hero eyebrow implementations across Home/Browse/My Trees (same utility class) | 2 |
| **UNRESOLVED** | Secondary button (no shared class), Focus ring (no shared mixin/token), Modal/dialog (no shared overlay/panel abstraction), Loading boundary (shared primitives vs page-owned transitions), Accessibility semantics of `<span>` filter chips | 5 |

---

## 6. Semantic-Difference Matrix

| Component | Browse (Public) | My Trees (Owner) | Editor | Difference type |
|---|---|---|---|---|
| Hero | Copy only. Shared eyebrow/title. | Copy only. Shared eyebrow/title. | None | Page-specific |
| Card CTA | `tree-card-open-link` → public detail | Owner actions (edit, delete, share) | Canvas interaction | Authority |
| Preview hub | Tree preview + social bar | Tree preview + edit actions + social bar | N/A | Authority |
| Filter chip | `<span>` element | `<button>` element | N/A | Accessibility |
| Results header | Has sort control | Has owner create-tree CTA | N/A | Authority |
| Search input | Public discovery | Owner tree filtering | N/A | Authority |
| Loading | verified shared primitive use + page-owned search runtime | verified shared primitive use + page-owned hub runtime | page-owned staged runtime only (no verified direct shared primitive DOM use) | Page-owned + shared |
| Modal | No distinct modal | N/A | Memory form modal | Page-specific |
| Card media | Thumbnail + fallback + preview strip | Thumbnail + fallback + preview strip | Canvas edit | Visual/authority |

---

## 7. Consumer-Page Matrix

| Component family | `index.html` | `pages/search.html` | `pages/my-trees.html` | `pages/editor.html` | `pages/settings.html` | `pages/detail.html` | `pages/intro.html` |
|---|---|---|---|---|---|---|---|
| Hero | ✅ Home | ✅ Browse | ✅ My Trees | ❌ | ❌ | ✅ Detail | ✅ Intro |
| Primary Button (static HTML) | ✅ Home | ❌ | ✅ My Trees | ❌ | ❌ | ❌ | ❌ |
| Primary Button (runtime/template) | ✅ auth-header | ✅ auth-header, Browse preview actions | ✅ auth-header | ✅ auth-header | ✅ auth-header | ✅ auth-header, Detail error boundary | ✅ auth-header |
| Secondary Button | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Search Input | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Filter Chip | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Card Shell | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Results Header | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Preview Hub | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Loading (shared primitives) | ❌ | ✅ Browse | ✅ My Trees | ❌ | ❌ | ❌ | ❌ |
| Loading (page-owned) | ✅ (modal) | ✅ (search) | ✅ (hub) | ✅ (staged) | ❌ | ❌ | ❌ |
| Empty State — shared token consumption | ❌ | ✅ Browse | ✅ My Trees | ❌ | ❌ | ❌ | ❌ |
| Empty State — page-owned implementation | ❌ | ❌ | ❌ | ✅ (`.editor-empty-state-cta`) | ❌ | ❌ | ❌ |
| Error State (shared) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Error State (page-owned) | ✅ (modal) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Media Control | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Modal/Dialog | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Focus Treatment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 8. Accessibility Obligations

| Component | Current obligation | Evidence |
|---|---|---|
| Hero | Screen-reader eyebrow, heading hierarchy (`h1`) | Present in all heroes |
| Buttons | Accessible name via ARIA/visible text, `:focus-visible` | Present in global.css |
| Search input | Label, placeholder | Present (`aria-label`, `required`, placeholder) |
| Filter chips | Active state, role, ARIA selection | My Trees uses `<button>` (correct), Browse uses `<span>` (needs role) |
| Cards | `:focus-visible`, select/active state, link CTA | `.love-tree-card:focus-visible` present |
| Preview hub | Scroll container semantics, social bar labels | Present |
| Loading | `role="status"`, `aria-live="polite"` | Present in shared primitives |
| Empty state | Role, aria-live | `.empty-state` with status role |
| Error state | Retry button, error heading, error description | `.lt-error-shell` has `.lt-retry-btn` |
| Media control | Play button aria-label, YouTube link | `.growth-stage-card-play` has `aria-label` |
| Modal/Dialog | `role="dialog"`, `aria-modal`, focus trap, close button, Escape close, backdrop close, focus restoration | Settings uses `role="dialog"` on non-`<dialog>` element. Home modal implements: `role="dialog"`, `aria-modal="true"`, initial Close focus, focus trap, Escape close, backdrop close, focus restoration, `aria-busy` on player. |
| Focus | `:focus-visible` for interactive elements | Present in global.css, shared-card CSS |

**Browse filter chip accessibility issue:** Browse uses `<span>` elements for filter chips instead of `<button>` or `role="button"`. My Trees correctly uses `<button>` elements. This is a documented semantic divergence requiring a separate U2 implementation child.

---

## 9. Responsive Obligations

| Component | Mobile (390px) | Tablet (768px) | Desktop (1440px) |
|---|---|---|---|
| Hero | Single column, reduced font, stacked actions | Two-column or stacked | Two-column with visual |
| Buttons | Full-width (`.btn-round` mobile override) | Inline | Inline with hover |
| Search input | Full width | Full width with max | Inline |
| Filter chips | Horizontal scroll (`.filter-row::-webkit-scrollbar`) | Inline wrap | Inline |
| Cards | Single column | 2-column grid | 3-column grid (large), denser (compact) |
| Preview hub | Below results (column switch) | Side panel | Side panel |
| Modal | Full-screen overlay, reduced padding | Centered with max-width | Centered |
| Loading | Same pattern | Same pattern | Same pattern |

---

## 10. Authority/Privacy Boundaries

| Component | Public (Browse) | Owner (My Trees) | Editor |
|---|---|---|---|
| Card click | Public detail page | Owner actions + detail | Edit node |
| Hub actions | Appreciation | Edit, delete, social | N/A |
| Media | Public thumbnail | Same + edit | Upload/manage |
| Search | Public discovery | Owner tree filter | N/A |
| Empty state | "No results found" | "Create your first tree" | Guide CTA |

---

## 11. Compatibility Identifiers to Preserve

The following identifiers have established contract assertions and consumer bindings. Removal is not authorized:

| Identifier | Type | Location | Consumers |
|---|---|---|---|
| `.btn-round` | CSS class | `css/global.css` | global definition; static HTML: Index, My Trees; runtime: Browse (preview actions), Detail (error boundary), all pages (auth header login button) |
| `.btn-primary` | CSS class | `css/global.css` | global definition; static HTML: Index, My Trees; runtime: Browse (`.preview-primary-action`) |
| `.btn-outline` | CSS class | `css/global.css` | global definition; static HTML: Index; runtime: Detail (`.btn-round.btn-outline` fallback), all pages (auth header login button) |
| `.tag-chip` | CSS class | `css/global.css` | Search, My Trees |
| `.filter-row` | CSS class | `css/search/search-controls.css` | Search, My Trees |
| `.search-input-wrapper` | CSS class | `css/search/search-controls.css` | Search, My Trees |
| `.search-input` | CSS class | `css/search/search-controls.css` | Search, My Trees |
| `.tree-card` | CSS class | `css/search/search-tree-card/layout.css` | Browse |
| `.lovetree-card` | CSS class | `css/global.css` | Multiple (legacy) |
| `.love-tree-card` | CSS class | `css/shared/love-tree-card-composition.css` | Browse, My Trees |
| `.browse-results-head` | CSS class | `css/search/search-controls.css` | Search, My Trees |
| `.preview-hub` | CSS class | `css/shared/preview-hub-scroll.css` | Search, My Trees |
| `.page-hero-eyebrow` | CSS class | `css/global.css` | Search, My Trees |
| `.shared-mobile-hero-eyebrow` | CSS class | `css/global.css` | Index, Search, My Trees |
| `.shared-mobile-hero-title` | CSS class | `css/global.css` | Index, Search, My Trees |
| `.lt-loading-inline` | CSS class | `css/global/lovetree-loading-states.css` | Browse |
| `.lt-error-shell` | CSS class | `css/global/lovetree-loading-states.css` | Editor, Browse, My Trees |
| `.lt-spinner` | CSS class | `css/global/lovetree-loading-states.css` | Browse, My Trees |
| `.empty-state` | CSS class | `css/my-trees/my-trees-states.css` | My Trees |
| `--lovetree-card-*` | CSS custom properties | `css/global/tokens.css` | token authority; direct CSS consumers: Browse, My Trees |
| `--lovetree-empty-state-*` | CSS custom properties | `css/global/tokens.css` | token authority; direct CSS consumers: Browse, My Trees |
| `.browse-story-navigation` | CSS class | `css/tree-view-mode.css` | Browse Story |
| `.hero-video-modal` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-panel` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-player` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-close` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-loading` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-ready` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-error` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.hero-video-modal-retry-btn` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.editor-memory-form-modal` | CSS class | `css/editor/editor-memory-form-modal-layout.css` | Editor |
| `data-tree-view-mode` | data attribute | `css/tree-view-mode.css` | Browse, My Trees |

---

## 12. Candidate Disposition Summary

| Disposition | Count | Items |
|---|---|---|
| CANONICAL_CANDIDATE | 7 | Button base, Tag chip visual, Card tokens, Loading primitives, Error shell, Empty state tokens, Preview hub scroll |
| APPROVED_VARIANT | 12 (6 pairs) | Button pairs, Chip pairs, Card pairs, Hub pairs, Search pairs, Header pairs |
| PAGE_SPECIFIC | 10 | 5 heroes (Home/Browse/My Trees/Detail/Intro), Editor form modal, Settings dialog, Home video modal, Home modal loading/error, Editor canvas media |
| AUTHORITY_SPECIFIC | 2 boundaries | Browse vs My Trees (public/owner), Editor view vs edit |
| LEGACY_CANDIDATE | 6 | `.lovetree-card`, gemini-v2/v3, kimi-v2, gpt-v2, v2 pages |
| DUPLICATE_CANDIDATE | 2 | Browse `<span>` vs My Trees `<button>` chip, hero eyebrow implementations |
| UNRESOLVED | 5 | Secondary button, Focus ring, Modal/dialog abstraction, Loading boundary, Chip accessibility semantics |

---

## 13. Unresolved Component Boundaries

1. **Secondary button.** No shared secondary button class exists. Editor has `.editor-action-btn-secondary`, Settings has `.settings-close-btn`, Detail has `.detail-back-link`. A canonical secondary button would require a separate U2 implementation child.

2. **Focus ring.** No shared `--focus-ring` token or `.focus-ring` utility class exists. Each page/component defines its own `:focus-visible` treatment.

3. **Modal/dialog.** Home, Editor, and Settings each have independent modal implementations with no shared overlay, panel, close, or focus-trap abstraction. Home modal implements `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, backdrop close, and focus restoration. Editor modal uses `.is-open` class. Settings uses ARIA dialog on a non-`<dialog>` element.

4. **Loading state boundary.** The line between shared `lt-loading-*` primitives and page-owned loading transitions is not formally documented. Editor staged loading, Browse search loading, My Trees hub loading, and Home modal loading/ready/error/retrying state machine all have unique ownership.

5. **Chip accessibility semantics.** Browse `<span>` chips lack button semantics. Convergence with My Trees `<button>` pattern requires a separate U2 implementation child with keyboard activation and focus-visible evidence.

---

## 14. Explicit Non-Authorizations

**Technical actions not authorized:**
- Component extraction (no shared component library is created)
- Component consolidation (Browse and My Trees remain separate)
- Token migration (no token rename, replacement, or deletion)
- Selector, ID, class, or route rename
- Compatibility identifier removal (see Section 11)
- Global CSS rewrite
- Framework or library introduction
- Visual redesign or screenshot baseline creation
- Runtime behavior change
- Auth, API, DB, cache, storage, or provider change
- Preview, Cloudflare, Wrangler, or Production action
- New test file creation
- Existing test modification
- Browser or Playwright execution
- Screenshot or baseline image generation
- Merge or closure of #3672, #3674, #3425, #3458, or #1882

**Governance policy:**
- **#3706 is not closed by this document.** It is a source-only inventory contract. A later implementation child must be authorized separately.
- **No PR in this series may merge without Web CTO approval.**
- **No child may alter product HTML, CSS, or JS without its own exact execution contract.**
- **Browser, Preview, Production, and screenshot evidence are unauthorized for all children of #3672 unless explicitly contracted.**

---

## 15. Next-Child Candidate Boundaries

The following boundaries are candidates for a later separately authorized implementation child. **No authority is granted by this document.**

1. **Filter chip accessibility convergence** — Convert Browse `<span>` chips to `<button>` elements with correct ARIA. Requires:
   - Separate U2 implementation child with its own exact execution contract
   - Keyboard activation evidence
   - Focus-visible evidence
   - ARIA pressed-state evidence
   - Desktop and mobile browser evidence
   - No authority granted by this inventory contract

2. **Shared secondary button** — Define a canonical secondary button class aligned to `.btn-round` base. Requires separate Issue and exact execution contract. This inventory contract does not authorize any CSS or JS change.

3. **Shared modal base** — Define shared overlay/panel/close/focus-trap primitives. Requires separate Issue and exact execution contract with browser evidence for focus management, reduced-motion, and responsive behavior.

---

## 16. Rollback

Rollback is deletion/revert of this single document (`docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md`). No product source, test, or deployment state requires restoration.

---

## 17. References

- #3706 — This Issue
- #3672 — Parent: Design System program
- #3674 — Previous child: component/visual baseline audit (`docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md`)
- PR #3677 — Merged parent PR
- `docs/design/CANONICAL_COMPONENT_AND_VISUAL_BASELINE_NEXT_CHILD_DECISION.md`
- `docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md` — Exact evidence limits: source name containing "canonical" is not final approval; candidate dispositions are not deletion/consolidation/approval authority
