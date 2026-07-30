# Canonical Component Variant Inventory Contract

## 1. Status and Exact Base SHA

- **Status:** Source-only decision contract
- **Base SHA:** `ca7a1c53532030497523c671ab0e4e45f5747921`
- **Merge Base:** `ca7a1c53532030497523c671ab0e4e45f5747921`
- **Evidence boundary:** Source reading only. No browser, screenshot, Preview, or Production verification authorized.
- **Parent:** #3672 — Keep OPEN
- **Previous child:** #3674 — Design System audit baseline

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
- `css/index/` — Home page visual system
- `css/search/` — Browse search system
- `css/my-trees/` — My Trees system
- `css/editor/` — Editor system
- `css/settings.css` — Settings system
- `css/shared/` — Shared component CSS
- `js/shared/` — Shared component JS
- `css/components/lovebud-ai-panel.css` — AI panel component

## 3. Source Authority Rules

1. **css/global/tokens.css** is the single token authority for visual properties shared across consumer pages.
2. **css/global.css** defines ground styles (card, button, chip, page shell, header). Page-specific overrides exist in respective `css/<page>/` directories and are loaded after global.css.
3. **css/shared/** contains page-agnostic component CSS consumed by both Browse and My Trees.
4. **js/shared/** contains page-agnostic component JS consumed by both Browse and My Trees.
5. **css/components/** contains self-contained component CSS for the AI panel (currently the only standalone component).
6. Page-specific styles in `css/<page>/` own their layout, hero, and state presentation. They may reuse shared tokens but must not mutate shared selectors.
7. The `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title` classes in `css/global.css` are the designated shared page-hero utility classes.

---

## 4. Canonical Component Inventory Matrix

### 4.1 Page Hero

| Field | Value |
|---|---|
| **Canonical family** | Page Hero |
| **Exact source owner** | `css/global.css` (shared eyebrow/title utilities), `css/index/` (Home hero), `css/search/` (Browse hero), `css/my-trees/` (My Trees hero), `css/editor/` (Editor shell), `css/settings.css` (Settings), `css/detail/` (Detail hero), `css/intro/` (Intro hero) |
| **Consumer pages** | `index.html`, `pages/search.html`, `pages/my-trees.html`, `pages/editor.html`, `pages/settings.html`, `pages/detail.html`, `pages/intro.html` |
| **Approved variants** | `home-v3-hero`, `search-page-hero`, `my-trees-page-hero`, `editor-shell`, `settings-shell`, `detail-hero`, `intro-hero` |

**Structure:**

- **Home (`index.html`):** `<section class="home-v3-hero">` with `.home-v3-copy`, `.home-v3-identity-copy`, `.home-v3-eyebrow`, `.home-v3-title`, `.home-v3-desc`, `.home-v3-actions`, `.home-v3-collage`
  - Source: `css/index/layout.css`, `css/index/responsive.css`
  - Uses shared classes: `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`
  - Eyebrow has `home.v3.eyebrow` i18n key

- **Browse (`pages/search.html`):** `<div class="browse-curation-shell">` with `.search-panel-header`, `.page-hero-eyebrow.shared-mobile-hero-eyebrow`, `.headline.shared-mobile-hero-title`
  - Source: `css/search/search-hero-controls.css`
  - Uses shared classes: `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`

- **My Trees (`pages/my-trees.html`):** `<div class="browse-curation-shell">` with `.search-panel-header`, `.page-hero-eyebrow.shared-mobile-hero-eyebrow`, `.headline.shared-mobile-hero-title`
  - Source: `css/my-trees/` (same shared eyebrow/title classes)
  - Uses shared classes: `.page-hero-eyebrow`, `.shared-mobile-hero-eyebrow`, `.shared-mobile-hero-title`

- **Editor (`pages/editor.html`):** No hero section. The page shell is `.editor-layout` with sidebar and canvas. No `page-hero-eyebrow` usage.

- **Settings (`pages/settings.html`):** No hero section. The page shell is `.settings-layout` with `.settings-card`. No hero eyebrow.

- **Detail (`pages/detail.html`):** `<section class="detail-hero">` with `.detail-hero-kicker`, `.detail-hero-title`, `.detail-hero-desc`
  - Source: `css/detail/`

- **Intro (`pages/intro.html`):** `<section class="intro-hero">` with `.intro-hero-eyebrow`, `h1`, `.lead`, `.intro-hero-actions`
  - Source: `css/intro/hero/` (layered: base, layout, tree-visual, moments, animations, responsive)

**Semantic differences:**
- Home hero is emotional/youtube-titled with growth-stage collage; Browse/My Trees hero is text/copy-only with shared shared-mobile-hero classes; Detail hero is kicker+title+desc; Editor and Settings have no hero section; Intro hero uses its own distinct system.

**Approved variant names:**
- `home-hero`, `browse-hero`, `my-trees-hero`, `detail-hero`, `intro-hero`
- `editor-shell`, `settings-shell` are NOT hero variants but page shell patterns.

**Visual-only differences:** Home hero uses a collage/growth-stage visual. Intro hero uses a scrapbook tree visual. Browse/My Trees are copy-only with shared-mobile-hero-title.

**Authority/security differences:** None — hero is public. Editor and Settings have no hero.

---

### 4.2 Primary Button

| Field | Value |
|---|---|
| **Canonical family** | Primary Button |
| **Exact source owner** | `css/global.css` lines 112-161 (`.btn-round`, `.btn-primary`, `.btn-outline`), `css/index/components.css` (Home variants), `css/editor/editor-overrides.css` |
| **Consumer pages** | All pages |
| **Approved variants** | `btn-round.btn-primary`, `btn-round.btn-outline`, `btn-header-create`, `sidebar-btn-primary`, `editor-action-btn-primary` |

**Structure:**

- **Global:** `.btn-round` (base rounded button), `.btn-primary` (filled primary rose), `.btn-outline` (outlined variant)
  - `css/global.css` lines 112-161
  - Mobile override at line 161 (full-width)
  - High-specificity `body .btn-round` override at line 474 for page-specific needs

- **Home:** `.btn-round` used in `.home-v3-actions` with `.btn-primary` and `.btn-outline`
  - `css/index/components.css` line 8-47 — Home-specific button styling (icon layout for `.btn-round`)

- **Browse:** `.btn-round` used in `result card CTA`, no page-specific button override beyond global

- **My Trees:** `.btn-header-create` in `css/my-trees/my-trees-header.css` — distinct `create tree` button
  - Responsive override in `css/my-trees/my-trees-responsive.css` line 11

- **Editor:** `.sidebar-btn-primary` in `css/editor/editor-overrides.css` line 32, `.btn-icon` line 47, `.btn-label` line 53

**Approved variant names:**
- `primary-action` (global `.btn-round.btn-primary`): filled rose, white text, rounded
- `outline-action` (global `.btn-round.btn-outline`): transparent, rose border, rose text
- `header-create` (My Trees `.btn-header-create`): primary variant with icon
- `sidebar-primary` (Editor `.sidebar-btn-primary`): sidebar context
- `editor-action-primary` (Editor `.editor-action-btn-primary`): detail action
- `editor-action-secondary` (Editor `.editor-action-btn-secondary`): secondary detail action
- `floating-toolbar-primary` (Editor `.editor-floating-toolbar-btn-primary`): toolbar action

---

### 4.3 Secondary Button

| Field | Value |
|---|---|
| **Canonical family** | Secondary/Link/Tertiary Button |
| **Exact source owner** | Dispersed across page-specific CSS. No single authority. |
| **Consumer pages** | Editor, Settings, My Trees, Detail |
| **Approved variants** | `editor-action-btn-secondary`, `sidebar-icon`, `settings-close-btn`, `detail-back-link`, `memory-edit-cancel` |

**Evidence:**
- Editor: `.editor-action-btn-secondary` in `css/editor/editor-detail-actions.css` line 72
- Editor: `.btn-icon` in `css/editor/editor-overrides.css` line 47
- Editor: `.sidebar-btn-primary` (no secondary counterpart defined)
- Settings: `.settings-close-btn` in `pages/settings.html` (close × glyph)
- Detail: `.detail-back-link` with `material-symbols-outlined` + text
- Memory edit: `.btn-save`, `.btn-cancel` in `css/editor/editor-memory-edit.css`

**No shared secondary button class exists.** Each page defines its own secondary/link/icon button pattern.

---

### 4.4 Search Input

| Field | Value |
|---|---|
| **Canonical family** | Search Input |
| **Exact source owner** | `css/search/search-controls.css` (Browse), `css/my-trees/my-trees-finder.css` (My Trees) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-search-input`, `my-trees-finder` |

**Structure:**

- **Browse:** `.search-input-wrapper` > `span.material-symbols-outlined.search-icon` + `input.search-input[type="text"]`
  - Source: `css/search/search-controls.css`
  - ID: `searchInput`
  - Placeholder uses i18n

- **My Trees:** `.search-input-wrapper.my-trees-search-box` > `span.material-symbols-outlined.search-icon` + `input.search-input.my-trees-search-input[type="text"]`
  - Source: `css/my-trees/my-trees-finder.css`
  - ID: `myTreesSearchInput`

**Semantic differences:** Browse search is public discovery. My Trees finder is owner tree filtering. Same HTML structure pattern with page-specific class appended.

---

### 4.5 Filter Chip

| Field | Value |
|---|---|
| **Canonical family** | Filter Chip |
| **Exact source owner** | `css/global.css` (`.tag-chip` base), `css/search/search-controls.css` (Browse chip layout), `css/my-trees/my-trees-finder.css` (My Trees chip layout) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-filter-chip`, `my-trees-filter-chip` |

**Structure:**

- **Global base:** `.tag-chip` in `css/global.css` lines 154-160 (base), lines 541-601 (higher-specificity overrides)
- **Browse filter:** `.tag-chip.active` in `css/search/search-controls.css` line 61, `.filter-row` line 67
  - HTML: `<span class="tag-chip active" data-category="전체">전체</span>` — span elements
- **My Trees filter:** `<button type="button" class="my-trees-filter-chip tag-chip active" data-filter="all">전체</button>` — button elements
  - HTML uses `<button>` instead of `<span>` for accessibility
  - `css/my-trees/my-trees-responsive.css` line 51-63 for mobile chip scroll

**Semantic difference:** Browse chips use `<span>` with `data-category`. My Trees chips use `<button>` with `data-filter`. This is an accessibility divergence (button provides press semantics, span does not).

---

### 4.6 Card Shell

| Field | Value |
|---|---|
| **Canonical family** | Card Shell |
| **Exact source owner** | `css/global/tokens.css` (card tokens), `css/shared/love-tree-card-composition.css` (shared shell), `css/search/search-tree-card/layout.css` (Browse card), `css/my-trees/my-trees-cards.css` (My Trees cards), `css/global.css` (`.lovetree-card` legacy) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html`, `pages/detail.html` |
| **Approved variants** | `love-tree-card` (shared), `tree-card` (Browse), `my-trees-card` (My Trees), `lovetree-card` (legacy) |

**Structure:**

- **Shared shell:** `.love-tree-card` in `css/shared/love-tree-card-composition.css` — base shell with surface, border-radius, hover states, ::before/::after accent bars
- **Browse card:** `.tree-card` in `css/search/search-tree-card/layout.css` — extends shared shell with padding, media height, active/selected states
- **My Trees card:** page-specific card selectors in `css/my-trees/my-trees-cards.css`
- **Mode variants:** `large`, `compact`, `list`, `story` — controlled via `#resultsList[data-tree-view-mode="..."]` in `css/tree-view-mode.css`
- **Legacy:** `.lovetree-card` in `css/global.css` — simpler card with `--lovetree-card-radius`, `--lovetree-card-shadow`

**Approved variant names:**
- `love-tree-card-browser` — shared cross-page card shell
- `tree-card-browse` — Browse public card with media, metadata, CTA
- `tree-card-my-trees` — My Trees owner card with filter/hub integration
- `tree-card-large` — large mode with emphasis media
- `tree-card-compact` — compact mode with thumbnail
- `tree-card-list` — list mode with horizontal layout
- `tree-card-story` — story mode with grouped cards
- `lovetree-card-legacy` — older simpler card pattern

---

### 4.7 Result/Section Header

| Field | Value |
|---|---|
| **Canonical family** | Results Header |
| **Exact source owner** | `css/search/search-controls.css`, `css/my-trees/my-trees-header.css` |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-results-head`, `my-trees-results-head` |

**Structure:**

- **Browse:** `.browse-results-head.lovetree-calm-results-head` > `.browse-results-title-slot` + `.browse-results-sort-slot` + `.browse-results-view-mode-slot`
  - Source: `css/search/search-controls.css`
- **My Trees:** `.my-trees-results-head.lovetree-calm-results-head` > `.browse-results-title-slot` + `.browse-results-owner-cta-slot` + `.browse-results-view-mode-slot`
  - Source: `css/my-trees/my-trees-header.css`
  - Same slot structure with owner CTA slot replacing sort slot

**Semantic difference:** Browse has sort control; My Trees has create-tree CTA. The view-mode slot is shared.

---

### 4.8 Right-Side Hub

| Field | Value |
|---|---|
| **Canonical family** | Preview Hub |
| **Exact source owner** | `css/shared/preview-hub-scroll.css`, `css/shared/preview-hub-content-slots.css`, `css/search/` (Browse hub), `css/my-trees/my-trees-preview-hub/` (My Trees hub) |
| **Consumer pages** | `pages/search.html`, `pages/my-trees.html` |
| **Approved variants** | `browse-preview-hub`, `my-trees-preview-hub` |

**Structure:**

- **Shared scroll:** `css/shared/preview-hub-scroll.css` — shared `.preview-hub` scroll container styling
- **Shared content slots:** `css/shared/preview-hub-content-slots.css` — `.preview-hub-social-slot`
- **Browse hub:** embedded in `css/search/search-preview-media-no-overlays.css`
  - Shows tree preview, social bar, moments list
- **My Trees hub:** `css/my-trees/my-trees-preview-hub/` — layered: layout, content, flow, states, actions, responsive, social-bar
  - Includes `.my-trees-hub-panel`, `.my-trees-hub-content`, `.my-trees-hub-actions`, `.my-trees-hub-social-bar`
  - States: `.is-empty`, `.is-loading`

**Semantic difference:** Browse hub is public preview. My Trees hub is owner preview with edit/CTA actions.

---

### 4.9 Loading Presentation

| Field | Value |
|---|---|
| **Canonical family** | Loading Presentation |
| **Exact source owner** | `css/global/lovetree-loading-states.css` (shared primitives), page-specific CSS (page-owned transitions) |
| **Consumer pages** | All pages |
| **Approved variants** | `lt-loading-inline`, `lt-loading-compact`, `lt-long-wait`, `lt-degraded`, `lt-skeleton*` |

**Structure:**

- **Shared primitives** (in `css/global/lovetree-loading-states.css`):
  - `.lt-loading-inline` — inline spinner + text
  - `.lt-loading-compact` — compact spinner
  - `.lt-spinner` — shared spinning animation
  - `.lt-long-wait` — extended wait message
  - `.lt-degraded` — degraded state with reduced functionality
  - `.lt-skeleton*` — skeleton placeholder primitives (if defined)

- **Page-owned loading:**
  - Editor: `.editor-loading-shell`, page-specific initial-load flow (`js/editor/editor-initial-load-flow.js`)
  - Browse: `.search-loading`, result-list loading
  - My Trees: `.my-trees-loading`, hub loading states
  - Home: growth-stage loading and metadata loading

**Distinction:** Shared primitives are presentation-only. Page-owned loading includes runtime transition logic and region-owned indicators.

---

### 4.10 Empty Presentation

| Field | Value |
|---|---|
| **Canonical family** | Empty State |
| **Exact source owner** | `css/global/tokens.css` (empty-state tokens), page-specific CSS |
| **Consumer pages** | All pages |
| **Approved variants** | `empty-state` (shared pattern), page-specific empty presentations |

**Structure:**

- **Shared tokens** (in `css/global/tokens.css` lines 83-97):
  - `--lovetree-empty-state-*` tokens for surface, border, radius, shadow, text, heading, icon, action, error
- **My Trees:** `.empty-state` in `css/my-trees/my-trees-states.css` line 27 — uses shared tokens, page-specific layout
- **Editor:** `.editor-empty-state-cta` in `css/editor/editor-detail-content/detail-info.css` line 258
- **Browse:** inline empty result states in search results

**No single empty-state component exists.** Pages use shared tokens but own their layout and structure independently.

---

### 4.11 Error Presentation

| Field | Value |
|---|---|
| **Canonical family** | Error State |
| **Exact source owner** | `css/global/lovetree-loading-states.css` (shared error shell) |
| **Consumer pages** | Editor, Browse, My Trees |
| **Approved variants** | `lt-error-shell`, page-specific error presentations |

**Structure:**

- **Shared shell** (in `css/global/lovetree-loading-states.css` lines 120-170):
  - `.lt-error-shell` — error container
  - `.lt-error-icon` — icon area
  - `.lt-error-heading` — heading
  - `.lt-error-body` — description
  - `.lt-retry-btn` — retry action button
- **Page-owned errors:** Dispersed across page-specific JS (editor inline error, Browse network error, My Trees hub error)

---

### 4.12 Media Control

| Field | Value |
|---|---|
| **Canonical family** | Media Control / Thumbnail |
| **Exact source owner** | `css/index/visual/growth-stage.css` (Home growth-stage cards), `css/search/search-tree-card/media.css` (Browse cards), page-specific CSS |
| **Consumer pages** | `index.html` (Home), `pages/search.html` (Browse), `pages/detail.html`, `pages/editor.html` |
| **Approved variants** | `home-card-media`, `tree-card-media`, `detail-main-media`, `editor-canvas-media` |

**Structure:**

- **Home:** `.growth-stage-card-media` with `.growth-stage-card-play` (YouTube play button)
  - Source: `css/index/visual/growth-stage.css`
  - Cards have `.growth-stage-card-fallback` placeholder until thumbnail loads
- **Browse:** `.tree-card-media` with image, fallback, and preview strip
  - Source: `css/search/search-tree-card/media.css`
  - Height: `--lovetree-card-image-height` (136px)
  - Includes fallback: `.tree-card-media-fallback` in `css/search/search-tree-card/fallback.css`
- **Detail:** `.detail-main-media` with `.video-main` and `.detail-media-loading`
- **Editor:** canvas node media with edit controls

---

### 4.13 Modal/Dialog

| Field | Value |
|---|---|
| **Canonical family** | Modal / Dialog |
| **Exact source owner** | Dispersed. No single modal authority. |
| **Consumer pages** | `index.html` (Home), `pages/editor.html`, `pages/settings.html`, `pages/search.html` |
| **Approved variants** | `hero-video-modal`, `editor-memory-form-modal`, `settings-card-dialog`, `editor-rename-modal`, `editor-connect-modal` |

**Structure:**

- **Home video modal:** `.hero-video-modal` in `css/index/visual/growth-stage.css` lines 704-791
  - Full-screen overlay, centered panel, 16:9 iframe player, close button with SVG
  - Animations: `hero-video-modal-fade`, `hero-video-modal-pop`
  - Created by JS: `js/index-spotlight.js` (appends overlay to body)
  - No `<dialog>` element usage

- **Editor memory form modal:** `.editor-memory-form-modal` in `css/editor/editor-memory-form-modal-layout.css`
  - Uses `.is-open` class toggling
  - Internal sections: `.editor-modal-eyebrow`, `.editor-modal-title`, `.editor-modal-intro`
  - Form fields, textarea, connect row, actions

- **Settings dialog:** `.settings-card` with `role="dialog"` `aria-modal="true"`
  - Uses native dialog semantics without `<dialog>` element
  - Close button, sectioned content, profile edit form

- **Editor rename modal:** `.editor-rename-modal-btn-primary`, `.editor-rename-modal-btn-secondary` in `css/editor/editor-overrides.css` lines 703-708

**No shared modal component.** Each modal is page-specific and independently styled.

---

### 4.14 Focus Treatment

| Field | Value |
|---|---|
| **Canonical family** | Focus Treatment |
| **Exact source owner** | `css/global.css` (`.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible`, `.tag-chip:focus-visible`), `css/shared/love-tree-card-composition.css` (card focus-visible) |
| **Consumer pages** | All pages |
| **Approved variants** | `global-focus-ring`, `card-focus-visible`, `button-focus-visible`, `chip-focus-visible` |

**Structure:**

- **Global focus:** `.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible` in `css/global.css` lines 591-593
- **Tag chip focus:** `.tag-chip:focus-visible` in `css/global.css` lines 564, 595
- **Card focus:** `.love-tree-card:focus-visible` in `css/shared/love-tree-card-composition.css`
- **Editor controls:** scattered focus-visible styles per control

**No shared focus-ring token or mixin exists.** Each component defines its own focus-visible treatment.

---

## 5. Variant Taxonomy

| Variant Type | Examples | Count |
|---|---|---|
| **CANONICAL_CANDIDATE** | `.btn-round` (primary/secondary base), `.tag-chip` (global), `.lovetree-card` tokens, `.lt-loading-*` primitives, `.lt-error-shell`, `--lovetree-empty-state-*` tokens, `.preview-hub` scroll/content | 7 |
| **APPROVED_VARIANT** | `btn-primary` / `btn-outline`, `browse-filter-chip` / `my-trees-filter-chip`, `tree-card-browse` / `tree-card-my-trees`, `browse-preview-hub` / `my-trees-preview-hub`, `browse-search-input` / `my-trees-finder`, `browse-results-head` / `my-trees-results-head` | 6 pairs |
| **PAGE_SPECIFIC** | Home hero (`home-v3-hero`), Detail hero (`detail-hero`), Intro hero (`intro-hero`), Editor shell, Settings card dialog, Hero video modal, Editor memory form modal, Editor canvas media | 8 |
| **AUTHORITY_SPECIFIC** | Browse public card vs My Trees owner card (different CTA, hub actions, permissions), Editor view vs Editor edit (different toolbar, memory form access) | 2 boundaries |
| **LEGACY_CANDIDATE** | `.lovetree-card` in `global.css` (superseded by `.love-tree-card` in shared CSS), `gemini-v2/`, `gemini-v3/`, `kimi-v2/`, `gpt-v2/`, `v2/` page directories | 6 |
| **DUPLICATE_CANDIDATE** | Browse `<span>` filter chip vs My Trees `<button>` filter chip (same visual, different element), Browser header hero eyebrow in `search.html`/`my-trees.html` vs Home/Intro hero eyebrow (same utility class but page-specific implementation) | 2 |
| **UNRESOLVED** | Secondary button (no shared class across pages), Focus ring (no shared mixin/token), Modal/dialog (no shared overlay/panel component), Loading presentation boundary between shared primitives and page-owned transitions | 4 |

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
| Loading | `lt-loading-*` + page loading | `lt-loading-*` + page + hub | `lt-loading-*` + editor | Page-owned + shared |
| Modal | No distinct modal | N/A | Memory form modal | Page-specific |
| Card media | Thumbnail + fallback + preview strip | Thumbnail + fallback + preview strip | Canvas edit | Visual/authority |

---

## 7. Consumer-Page Matrix

| Component family | `index.html` | `pages/search.html` | `pages/my-trees.html` | `pages/editor.html` | `pages/settings.html` | `pages/detail.html` | `pages/intro.html` |
|---|---|---|---|---|---|---|---|
| Hero | ✅ Home | ✅ Browse | ✅ My Trees | ❌ | ❌ | ✅ Detail | ✅ Intro |
| Primary Button | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secondary Button | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Search Input | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Filter Chip | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Card Shell | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Results Header | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Preview Hub | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Loading | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Empty State | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Error State | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Media Control | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Modal/Dialog | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Focus Treatment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 8. Accessibility Obligations

| Component | Current obligation | Evidence |
|---|---|---|
| Hero | Screen-reader eyebrow (`.hero-eyebrow`), heading hierarchy (`h1`) | Present in all heroes |
| Buttons | Accessible name via ARIA/visible text, focus-visible | Present in global.css (`.btn-round:focus-visible`) |
| Search input | Label, placeholder, clear action | Present (`aria-label`, `required`, placeholder) |
| Filter chips | Active state, role, aria-selection | My Trees uses `<button>` (correct), Browse uses `<span>` (needs role) |
| Cards | Focus-visible, select/active state, link CTA | `.love-tree-card:focus-visible` present |
| Preview hub | Scroll container semantics, social bar labels | Present |
| Loading | `role="status"`, `aria-live="polite"` | `.lt-loading-inline` uses `aria-live` |
| Empty state | Role, aria-live | `.empty-state` with status role |
| Error state | Retry button, error heading, error description | `.lt-error-shell` has `.lt-retry-btn` |
| Media control | Play button aria-label, YouTube link | `.growth-stage-card-play` has `aria-label` |
| Modal/Dialog | `role="dialog"` / `aria-modal`, focus trap, close button | Settings uses `role="dialog"`; Home/Editor use custom overlay |
| Focus | `:focus-visible` for all interactive elements | Present in global.css, shared-card CSS |

**Browse filter chip accessibility issue:** Browse uses `<span>` elements for filter chips instead of `<button>` or `role="button"`. My Trees correctly uses `<button>` elements. This is a documented semantic divergence.

---

## 9. Responsive Obligations

| Component | Mobile (390px) | Tablet (768px) | Desktop (1440px) |
|---|---|---|---|
| Hero | Single column, reduced font, stacked actions | Two-column or stacked | Two-column with visual |
| Buttons | Full-width (`.btn-round` mobile override) | Inline | Inline with hover |
| Search input | Full width | Full width with max | Inline with utility row |
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
| `.btn-round` | CSS class | `css/global.css` | All pages |
| `.btn-primary` | CSS class | `css/global.css` | All pages |
| `.btn-outline` | CSS class | `css/global.css` | All pages |
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
| `.lt-loading-inline` | CSS class | `css/global/lovetree-loading-states.css` | All pages |
| `.lt-error-shell` | CSS class | `css/global/lovetree-loading-states.css` | Editor, Browse, My Trees |
| `.lt-spinner` | CSS class | `css/global/lovetree-loading-states.css` | All pages |
| `.empty-state` | CSS class | `css/my-trees/my-trees-states.css` | My Trees |
| `--lovetree-card-*` | CSS custom properties | `css/global/tokens.css` | All pages |
| `--lovetree-empty-state-*` | CSS custom properties | `css/global/tokens.css` | All pages |
| `.browse-story-navigation` | CSS class | `css/tree-view-mode.css` | Browse Story |
| `.hero-video-modal` | CSS class | `css/index/visual/growth-stage.css` | Home |
| `.editor-memory-form-modal` | CSS class | `css/editor/editor-memory-form-modal-layout.css` | Editor |
| `data-tree-view-mode` | data attribute | `css/tree-view-mode.css` | Browse, My Trees |

---

## 12. Candidate Disposition Summary

| Disposition | Count | Components |
|---|---|---|
| CANONICAL_CANDIDATE | 7 | Button base, Tag chip, Card tokens, Loading primitives, Error shell, Empty state tokens, Preview hub scroll |
| APPROVED_VARIANT | 12 (6 pairs) | Button pairs, Chip pairs, Card pairs, Hub pairs, Search pairs, Header pairs |
| PAGE_SPECIFIC | 8 | Home/Browse/My Trees/Detail/Intro heroes, Editor shell, Settings dialog, Home video modal |
| AUTHORITY_SPECIFIC | 2 boundaries | Browse vs My Trees (public vs owner), Editor view vs edit |
| LEGACY_CANDIDATE | 6 | `.lovetree-card`, gemini-v2/v3, kimi-v2, gpt-v2, v2 pages |
| DUPLICATE_CANDIDATE | 2 | Browse `<span>` chip vs My Trees `<button>` chip, hero eyebrow implementations |
| UNRESOLVED | 4 | Secondary button, Focus ring, Modal/dialog, Loading boundary |

---

## 13. Unresolved Component Boundaries

1. **Secondary button.** No shared secondary button exists. Editor has `.editor-action-btn-secondary`, Settings has `.settings-close-btn`, Detail has `.detail-back-link`. A canonical secondary button should be defined if cross-page convergence is desired.

2. **Focus ring.** No shared `--focus-ring` token or `.focus-ring` utility class exists. Each page/component defines its own `:focus-visible` treatment. A shared focus-ring mixin could reduce divergence.

3. **Modal/dialog.** Home, Editor, and Settings each have independent modal implementations with no shared overlay, panel, close, or focus-trap abstraction. A shared modal component could reduce duplication.

4. **Loading state boundary.** The line between shared `lt-loading-*` primitives and page-owned loading transitions is not formally documented. Editor's staged loading, Browse's search loading, and My Trees hub loading all have unique ownership that may or may not align with the shared primitive contract.

---

## 14. Explicit Non-Authorizations

The following are **not authorized** by this inventory contract:

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

## 15. Recommended Next Child

The following boundaries are ready for a focused implementation child:

1. **Filter chip accessibility convergence** — Convert Browse `<span>` chips to `<button>` elements with correct ARIA, converging on the My Trees pattern. Minimal, source-only, no visual change.

2. **Shared secondary button** — Define a canonical `.btn-secondary` class in `global.css` (aligned to existing `.btn-round` base), adopt in Editor and Settings. No redesign.

3. **Shared modal base** — Define shared `.lt-overlay`, `.lt-modal-panel`, `.lt-modal-close` primitives in `css/global/`, adopt in Home and Editor. No full modal library.

---

## 16. Rollback

Rollback is deletion/revert of this single document (`docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md`). No product source, test, or deployment state requires restoration.

---

## 17. References

- #3706 — This Issue
- #3672 — Parent: Design System program
- #3674 — Previous child: component/visual baseline audit
- PR #3677 — Merged parent PR
- `docs/design/CANONICAL_COMPONENT_AND_VISUAL_BASELINE_NEXT_CHILD_DECISION.md`
- `docs/design/CANONICAL_UI_SYSTEM_CURRENT_STATE_AUDIT.md` (empty — no current state audit exists; elevation to UNRESOLVED pending)
