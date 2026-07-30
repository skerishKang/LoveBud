# Forced-Colors and Focus-Visible Coverage Audit

Parent #3753 · Refs #3672, #3425, #1882

## Baseline

### Historical audit baseline

| Field | Value |
|---|---|
| Repository | `skerishKang/LoveBud` |
| Audited ref | `origin/main` |
| Exact commit | `9af1f6116566e9b616a89f108bc17e002bcf8485` |
| Expected commit | `9af1f6116566e9b616a89f108bc17e002bcf8485` |
| Drift | `NONE` |

### Current re-audit baseline

| Field | Value |
|---|---|
| Repository | `skerishKang/LoveBud` |
| Audited ref | `origin/main` |
| Exact commit | `7d406f017f654f6a190473c698e4b0e2bd4983c5` |
| Expected commit | `7d406f017f654f6a190473c698e4b0e2bd4983c5` |
| Drift | `NONE` |

This SHA is the evidence boundary. No CSS, token, or selector changes are authorized.

Source-only audit — no browser, screenshot, or Production evidence collected.

## Evidence limits

Read-only evidence was taken from `css/**`, `js/**`, `pages/**`, `docs/design/UI_DESIGN_SYSTEM.md`, `docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md`.

No computed style, accessibility tree, screenshot, browser, Preview, or Production evidence was collected. Static source cannot prove visual pass, focus clipping, contrast, or WHCM rendering correctness.

Dispositions: `SOURCE_CONFIRMED`, `PARTIAL_COVERAGE`, `MISSING_COVERAGE`, `PAGE_OWNED`, `NOT_APPLICABLE`, `UNRESOLVED`.

## Inventory

### 1. Shared primary/secondary buttons

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/global.css:591-598` | `.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible`, `.cta-appreciation:focus-visible` | Interactive action | `outline: 2px solid var(--control-focus-ring)` | `outline` authority (2px, variable) | No authored `@media (forced-colors)` or `forced-color-adjust` | Disabled: not defined on `.btn-round` base (opacity handled per-instance); selected: not applicable (ephemeral actions) | `--control-focus-ring` defined in `global.css:470` (resolves at runtime) but absent from `tokens.css` — maintenance risk for tokens-only consumers. `outline` renders in WHCM with UA automatic system-color adjustment (author color not preserved). No authored forced-colors override or system-color customization. | `PARTIAL_COVERAGE` |
| `css/index/components.css:19-47` | `.btn-outline` (Home hero) | Home hero action | Inherits `global.css` via `body .btn-outline` | `border` + `::after` underline | Zero | Hover: `.btn-outline::after` border-opacity change only | None beyond shared | `PAGE_OWNED` |
| `css/intro/hero/layout.css:86-137` | `.intro-cta-primary:focus-visible`, `.intro-cta-secondary:focus-visible` | Intro CTA action | `outline: 2px solid rgba(144, 73, 81, 0.38)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Hover: scale + shadow changes only | `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override or system-color customization. Low-opacity (0.38) may result in low contrast even in normal mode. | `PAGE_OWNED` |

### 2. Browse/My Trees search & filter

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/search/search-controls.css` | `.search-input` | Text entry | `outline: none` + `:focus { box-shadow }` + `:focus-visible { box-shadow }` | `box-shadow` only; no `outline` re-added for WHCM | Zero | Error: not defined on this selector | **High**: native `outline` removed, replaced with `box-shadow` only. In WHCM, `box-shadow` is rendered as `none` — visible focus indicator is lost. Element remains focusable. PR #3721 added `:focus-visible` with `box-shadow: 0 0 0 3px` (improves normal-mode feedback) but does not address WHCM. | `MISSING_COVERAGE` |
| `css/search/search-controls.css` | `.browse-sort-select:focus-visible` | Sort combobox | `box-shadow: 0 0 0 2px rgba(...)` + `border-color` change + `outline: none` (base) | `box-shadow` as pseudo-outline; no `outline` property | Zero | Disabled: not defined | **High**: `outline: none` on base + `box-shadow`-only focus. In WHCM, `box-shadow` is rendered as `none` — visible focus indicator is lost. Element remains focusable. | `MISSING_COVERAGE` |
| `css/global.css:564-567` + `search-controls.css` | `.tag-chip:focus-visible` | Filter chip (toggle button) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority (2px, variable) | No authored forced-colors override | Active: `.tag-chip.active` background/border change only; disabled: not defined | `--control-focus-ring` defined in `global.css:470` (resolves at runtime) but absent from `tokens.css`. `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override. | `PARTIAL_COVERAGE` |
| `css/search/search-hero-controls.css` | Hero filter row | Filter presentation | Native `<span>` — not button semantics | `outline` inherited from `.tag-chip` when `<button>` is used | Zero | Active: background/border change only | Browse uses `<span>` (no keyboard reachable), My Trees uses `<button>` | `UNRESOLVED` |

### 3. Card links and owner actions

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/shared/love-tree-card-composition.css:45-49` | `.love-tree-card:focus-visible` | Card shell (link) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Selected: `.love-tree-card-selected` accent bar + border-color change; disabled: N/A | `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override. `outline-offset: 4px` may clip on small cards. | `PARTIAL_COVERAGE` |
| `css/search/search-tree-card/actions.css:25-35` | `.tree-card-open-link:focus-visible` | Open link (button-like anchor) | `outline: 2px solid rgba(144, 73, 81, 0.30)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Disabled: not defined | `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override. | `PARTIAL_COVERAGE` |
| `css/search/search-tree-card/layout.css:61-63` | `.tree-card:focus-visible` | Card shell (Browse) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Selected: `.tree-card.is-selected` shadow/ring defined via token | Same as `love-tree-card-composition.css`. `outline` renders in WHCM with UA automatic system-color adjustment. | `PARTIAL_COVERAGE` |
| `css/my-trees/my-trees-cards.css:68-72` | `.tree-card:focus-visible` | Card shell (My Trees) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | Zero | Same as Browse | Duplicate — should inherit from shared | `DUPLICATE` |
| `css/my-trees/my-trees-visibility-gate.css:78` | `.tree-card:focus-visible .tree-card-open-link` | Visibility action reveal | Inherits card focus | `outline` not re-declared | Zero | Visibility: color/border only | Focus is proven on parent, not on link itself | `PAGE_OWNED` |

### 4. Editor view/edit controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/editor/editor-canvas-toolbar/buttons.css:44-47` | `.editor-canvas-tool-btn:focus-visible` | Icon toolbar button | `outline: 2px solid var(--control-focus-ring, rgba(...))` | `outline` authority (2px, variable+fallback) | No authored forced-colors override | Disabled: `.is-disabled` / `:disabled` opacity change; active: `.is-active` background swap | `--control-focus-ring` defined in `global.css:470` (resolves at runtime) but absent from `tokens.css`. `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override. | `PARTIAL_COVERAGE` |
| `css/editor/editor-floating-toolbar/toolbar.css:74-77` | `.editor-floating-toolbar-btn:focus-visible` | Floating toolbar button | `outline: 2px solid var(--control-focus-ring, rgba(...))` | `outline` authority (2px, variable+fallback) | No authored forced-colors override | Disabled: `:disabled` opacity 0.46; pressed: not defined | Same as canvas toolbar: `--control-focus-ring` defined in `global.css` but not in `tokens.css`. `outline` renders in WHCM with UA automatic system-color adjustment. | `PARTIAL_COVERAGE` |
| `css/editor/editor-overrides.css:516-520` | `.editor-retry-button:hover, .editor-retry-button:focus-visible` | Retry action | `outline: none` + background swap | No outline replacement | Zero | Hover/active: background color change only | **High**: hover style copies to `:focus-visible`, then `outline: none` removes native ring. `box-shadow` not used — no replacement at all. Visible focus indicator lost in WHCM. Element remains focusable. | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:544-547` | `.editor-comment-toggle:hover, .editor-comment-toggle:focus-visible` | Comment toggle | `outline: none` + background swap | No outline replacement | Zero | Disabled: opacity + cursor | **High**: same pattern as retry button — `outline: none` with no replacement. Visible focus indicator lost in WHCM. | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:753-757` | `.editor-like-button:hover, .editor-like-button:focus-visible` | Like toggle | `outline: none` + background swap | No outline replacement | Zero | Disabled: opacity 0.55; pressed: `.is-pressed` color change | **High**: `outline: none` with no replacement. Visible focus indicator lost in WHCM. | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:775-778` | `.editor-like-button.is-pressed:focus-visible` | Pressed like | `outline: none` — no visible ring added | No outline replacement | Zero | Pressed state adds background swap | **High**: `outline: none` with no replacement. Visible focus indicator lost in WHCM. | `MISSING_COVERAGE` |
| `css/editor/editor-detail-edit/actions.css:69-72` | `.editor-delete-link:focus-visible` | Destructive delete | `outline: 2px solid var(--primary-vibrant)` | `outline` authority (2px, variable) | Zero | Hover: color + background swap only | `var(--primary-vibrant)` defined in `tokens.css` — best pattern found | `SOURCE_CONFIRMED` |
| `css/editor/editor-detail-comments.css:57-62` | `.editor-moment-reaction:hover, .editor-moment-reaction:focus-visible` | Social reaction | `outline: none` + background/border swap | No outline replacement | Zero | Disabled: not defined | **High**: `outline: none` with no replacement. Visible focus indicator lost in WHCM. | `MISSING_COVERAGE` |
| `css/editor/editor-detail-content/detail-info.css:88-97` | `.memory-preview-overlay .play-btn:focus-visible` | Media play | `outline: 3px solid var(--primary, #904951)` (matches mobile) | `outline` authority (3px, variable+fallback) | No authored forced-colors override | Hover/active: background swap only | `var(--primary)` defined in `tokens.css`. `outline` renders in WHCM with UA automatic system-color adjustment. | `PARTIAL_COVERAGE` |
| `css/editor/editor-detail-edit/form-fields.css:101-105` | `.editor-form-input:focus`, `.editor-form-textarea:focus` | Text entry | `outline: none` + `border-color` + `box-shadow` | `box-shadow` only | Zero | Error: not defined on these selectors | **High**: `outline: none` replaced with `box-shadow` only. In WHCM, `box-shadow` is `none` — visible focus indicator lost. Element remains focusable. | `MISSING_COVERAGE` |
| `css/editor/editor-sidebar.css:52-54, 102-104` | `.editor-rail-collapse-btn:focus-visible`, `.editor-sidebar-back-link:focus-visible` | Rail collapse / back | `outline: 2px solid rgba(144, 73, 81, 0.4 / 0.35)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Disabled: not defined | `outline` renders in WHCM with UA automatic system-color adjustment. No authored forced-colors override. | `PARTIAL_COVERAGE` |
| `css/editor/editor-memory-node.css:181-183` | `.memory-node:focus-visible .node-card` | Memory node card | `outline: 2px solid rgba(144, 73, 81, 0.36)` | `outline` authority (2px, literal rgba) | Zero | Selected: not defined | Focus targets card inside node, not the interactive node itself. `outline` renders in WHCM with system color override. | `PARTIAL_COVERAGE` |

### 5. Settings controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/settings/components.css:31-34` | `.settings-close-btn:focus-visible` | Close/modal dismiss | `outline: 2px solid var(--primary)` | `outline` authority (2px, variable) | No authored forced-colors override | Disabled: not defined | `var(--primary)` defined in `tokens.css`. `outline` renders in WHCM with UA automatic system-color adjustment. | `SOURCE_CONFIRMED` |
| `css/settings/components.css:255-258` | `.logout-btn:focus-visible` | Logout | `outline: 2px solid var(--primary)` | `outline` authority (2px, variable) | Zero | Disabled: not defined for logout | `var(--primary)` defined in `tokens.css`. `outline` renders in WHCM with system color override. | `SOURCE_CONFIRMED` |
| `css/settings/components.css:321-324` | `.settings-profile-name-input:focus` | Profile name input | `outline: 2px solid var(--focus-color, #4a90d9)` | `outline` authority (2px, variable+fallback) | No authored forced-colors override | Error: `.settings-profile-edit-status--error` color change only | `var(--focus-color)` is not defined in tokens. `outline` renders in WHCM with UA automatic system-color adjustment. | `PARTIAL_COVERAGE` |
| `css/settings/components.css:327-365` | `.settings-profile-edit-save`, `.settings-profile-edit-cancel` | Form action (save/cancel) | **No product-specific `:focus` or `:focus-visible` defined** | None — native outline not suppressed | Zero | Disabled: `:disabled` opacity 0.5 | No product-specific focus treatment. UA default focus styling remains available (native `outline` not removed). Source-only audit cannot prove missing visible focus. | `UNRESOLVED` |
| `css/settings/base.css` | Settings page shell | Page structure | Native focus (not removed) | Native `outline` | Zero | N/A | Low — native focus preserved | `NOT_APPLICABLE` |

### 6. Modal/dialog controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/my-trees/my-trees-create-modal.css:9` | `.create-tree-modal-close` | Modal dismiss (icon-only) | **No product-specific `:focus` or `:focus-visible` defined** | None — native outline not suppressed | Zero | Hover: background swap only | No product-specific focus treatment. UA default focus styling remains available (native `outline` not removed). Icon-only button lacks accessible name — separate a11y gap. | `UNRESOLVED` |
| `css/my-trees/my-trees-create-modal.css:28-31` | `.create-tree-modal-btn` (primary, secondary) | Modal action | **No product-specific `:focus` or `:focus-visible` defined** | None — native outline not suppressed | Zero | Disabled: `:disabled` opacity 0.65; selected: N/A | No product-specific focus treatment. UA default focus styling remains available (native `outline` not removed). Source-only audit cannot prove missing visible focus. | `UNRESOLVED` |
| `css/my-trees/my-trees-create-modal.css:21-24` | `.create-tree-visibility-option input:checked + .create-tree-visibility-card` | Visibility radio card | Uses native radio focus via `input:focus-visible` (inherit, not styled) | Native UA `outline` (not removed) | Zero | Checked: border/background swap; error: not defined | Native radio remains keyboard-accessible; card visual does not signal focus | `PARTIAL_COVERAGE` |
| `css/index/visual/growth-stage.css:781-787` | `.hero-video-modal-close:focus-visible` | Video modal dismiss | `outline: 2px solid rgba(255,255,255,0.85)` | `outline` authority (2px, literal rgba) | No authored forced-colors override | Hover: scale + background swap | `outline` renders in WHCM with UA automatic system-color adjustment. White author color not preserved — visibility depends on system color selection (dark overlay + dark system color may reduce contrast). | `PARTIAL_COVERAGE` |
| `css/index/visual/growth-stage.css:903-907` | `.hero-video-modal-retry-btn:focus-visible` | Video modal retry | `outline: 2px solid rgba(255,255,255,0.3)` | `outline` authority (2px, low-opacity literal) | No authored forced-colors override | Disabled: not defined | Very low opacity (0.3) — low contrast even in normal mode. `outline` renders in WHCM with UA automatic system-color adjustment. | `PARTIAL_COVERAGE` |
| `css/editor/editor-overrides.css:654-671` | `.editor-rename-modal-input:focus` | Rename input | `outline: none` + `box-shadow: 0 0 0 4px rgba(...)` | `box-shadow` only (4px) | Zero | Error: `.editor-rename-modal-error` text only | **High**: `outline: none` replaced with `box-shadow` only. In WHCM, `box-shadow` is `none` — visible focus indicator lost. Element remains focusable. | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:688-702` | `.editor-rename-modal-btn` | Rename modal action | **No product-specific `:focus` or `:focus-visible` defined** | None — native outline not suppressed | Zero | Disabled: `:disabled` opacity 0.55 | No product-specific focus treatment. UA default focus styling remains available (native `outline` not removed). Source-only audit cannot prove missing visible focus. | `UNRESOLVED` |

### 7. Icon-only controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/my-trees/my-trees-create-modal.css:9` | `.create-tree-modal-close` | Modal dismiss (icon-only) | **See modal section** | None | Zero | Hover: color/background swap | No accessible label or focus ring | `MISSING_COVERAGE` |
| `css/settings/components.css:1-34` | `.settings-close-btn:focus-visible` | Settings close (icon+glyph) | `outline: 2px solid var(--primary)` | `outline` authority | Zero | Hover: border/color/background | Has glyph text fallback, has focus ring | `SOURCE_CONFIRMED` |
| `css/editor/editor-canvas-toolbar/buttons.css:44-47` | `.editor-canvas-tool-btn:focus-visible` | Canvas toolbar (icon+label variants) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority | Zero | Disabled: opacity; active: `.is-active` swap | Wide variant has label text; narrow is icon-only with tooltip | `PARTIAL_COVERAGE` |
| `css/editor/editor-floating-toolbar/toolbar.css:74-77` | `.editor-floating-toolbar-btn:focus-visible` | Floating toolbar (icon+label) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority | Zero | Disabled: opacity | Has label text — not truly icon-only | `PARTIAL_COVERAGE` |
| `css/search/search-preview-social-bar.css:62-66` | `.preview-social-action:not([disabled]):focus-visible` | Social action (icon+optional text) | `outline: none` (line 66) after `background` swap via `:focus-visible` | `outline: none` | Zero | Disabled: `[disabled]` excluded; selected: not defined | Hover style copies to focus, then outline removed | `MISSING_COVERAGE` |
| `css/index/visual/growth-stage.css:406-413` | `.growth-stage-card-play:focus-visible` | Home play button (icon-only overlay) | `outline: 2px solid rgba(255,255,255,0.85)` | `outline` authority | Zero | Hover: scale transform; disabled: not defined | `outline` renders in WHCM with system color override; white author color not preserved. May produce inadequate contrast on dark overlay depending on system color selection. | `PAGE_OWNED` |

### 8. Destructive controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/editor/editor-detail-edit/actions.css:52-72` | `.editor-delete-link:focus-visible` | Delete moment | `outline: 2px solid var(--primary-vibrant)` | `outline` authority (2px, `var(--primary-vibrant)` defined in `tokens.css`) | Zero | Hover: color + background swap; disabled: not defined | Best destructive-control pattern in codebase | `SOURCE_CONFIRMED` |
| `css/editor/editor-detail-edit/actions.css:3-13` | `.editor-edit-danger-action` | Edit danger action button | **No `:focus` or `:focus-visible` defined** | Inherits `.btn-round` / `.btn-outline` focus from `global.css` | Zero | Hover: background swap; disabled: not defined | Inherits shared button focus — adequate if parent selector applies | `PAGE_OWNED` |
| `css/settings/components.css:231-258` | `.logout-btn:focus-visible` | Account logout | `outline: 2px solid var(--primary)` | `outline` authority | Zero | Hover: background/border; disabled: not defined | Clean pattern | `SOURCE_CONFIRMED` |

### 9. Disabled / selected / pressed / error states

| State category | Example sources | forced-colors risk | Disposition |
|---|---|---|---|
| Opacity-based disabled | `.btn-round:disabled` (opacity), `.editor-floating-toolbar-btn:disabled` (opacity 0.46), `.editor-rename-modal-btn:disabled` (opacity 0.55) | `opacity` is not a color property that forced-colors overrides. The opacity distinction **survives** forced-colors in source terms. Runtime adequacy (whether the dimmed appearance provides sufficient contrast) remains unverified. | `PARTIAL_COVERAGE` |
| Font-weight-based pressed | `.editor-like-button.is-pressed` (font-weight change + color) | `font-weight` distinction **survives** forced-colors. Color portion of the distinction is overridden. | `PARTIAL_COVERAGE` |
| Color/background/border-only selected | `.love-tree-card-selected`, `.tag-chip.active`, `.create-tree-visibility-card input:checked + card` | Author color/background/border intent is overridden in WHCM. State distinction may collapse and requires per-selector runtime verification. | `MISSING_COVERAGE` |
| Color-only error | `.editor-rename-modal-error`, `.settings-profile-edit-status--error`, `.scout-input.has-error` | Author color intent overridden. State distinction may collapse. Requires per-selector verification. | `MISSING_COVERAGE` |
| Native form-control state | `<input>`, `<select>`, `<textarea>` with UA default styling | UA default form controls have built-in WHCM state distinction. No product CSS overrides these. | `NOT_APPLICABLE` |

## Cross-cutting findings

### 1. Explicit forced-colors rule counts

| Metric | Count |
|---|---|
| Explicit `@media (forced-colors)` | 0 |
| Explicit `forced-color-adjust` | 0 |
| UA automatic forced-color adjustment | Present (applied by the browser in WHCM) |
| `outline` — solid structure | Preserved in WHCM; `outline-color` mapped to a system color |
| `box-shadow` | `none` in forced-colors mode |
| System-color keywords (`Canvas`, `ButtonText`, `Highlight`, `GrayText`) | 0 |

**Important WHCM distinction:** `box-shadow` is rendered as `none` in WHCM — box-shadow-only focus indicators are genuinely invisible. `outline` with an author color continues to render in WHCM, but the user agent applies UA automatic forced-color adjustment: `outline-color` is mapped to a system color (typically `Highlight` or `CanvasText`). The outline's structure (width, style, offset) is preserved; only the color is adjusted. Static source alone cannot prove that the resulting system-color outline provides adequate contrast — runtime verification is required.

### 2. `outline: none` — raw declaration count vs. verified defect count

**Raw declaration count:** 27 locations use `outline: none` in CSS files.

**Verified high-risk selectors** (meet all three conditions: native outline removed, replacement is `box-shadow`-only or absent, no surviving non-color focus cue):

| Selector | File | Replacement |
|---|---|---|
| `.editor-retry-button:focus-visible` | `editor-overrides.css:516-520` | None (background swap only) |
| `.editor-comment-toggle:focus-visible` | `editor-overrides.css:544-547` | None (background swap only) |
| `.editor-like-button:focus-visible` | `editor-overrides.css:753-757` | None (background swap only) |
| `.editor-like-button.is-pressed:focus-visible` | `editor-overrides.css:775-778` | None (no ring added) |
| `.editor-moment-reaction:focus-visible` | `editor-detail-comments.css:57-62` | None (border/background swap) |
| `.search-input:focus` / `:focus-visible` | `search-controls.css` | `box-shadow` only |
| `.browse-sort-select:focus-visible` | `search-controls.css` | `box-shadow` only |
| `.editor-form-input:focus` | `form-fields.css:101-105` | `box-shadow` only |
| `.editor-rename-modal-input:focus` | `editor-overrides.css:668-671` | `box-shadow` only |
| `.preview-social-action:focus-visible` | `search-preview-social-bar.css:62-66` | None (background swap only) |

**10 verified high-risk selectors** (5 box-shadow-only, 5 outline suppression with no surviving replacement) where visible focus indicator is lost in WHCM. Remaining `outline: none` locations may have adequate alternative indicators (border-color, background, or adjacent element styling) but require per-selector verification.

The element remains focusable (keyboard reachable, `:focus-visible` fires) — but the user cannot see where focus is.

### 3. `box-shadow` as sole focus indicator — 5 critical locations

In WHCM, `box-shadow` is rendered as `none`. These locations use `box-shadow` as the sole focus indicator with no `outline` fallback. The visible focus indicator is lost in WHCM; the element remains focusable.

| File | Selector | Issue |
|---|---|---|
| `css/search/search-controls.css:32-35` | `.search-input:focus` | Visible focus indicator lost in WHCM |
| `css/search/search-controls.css:224-227` | `.browse-sort-select:focus-visible` | Visible focus indicator lost in WHCM |
| `css/my-trees/my-trees-create-modal.css:15` | `.create-tree-input:focus` | Visible focus indicator lost in WHCM |
| `css/editor/editor-overrides.css:668-671` | `.editor-rename-modal-input:focus` | Visible focus indicator lost in WHCM |
| `css/editor/editor-detail-edit/form-fields.css:101-105` | `.editor-form-input:focus` | Visible focus indicator lost in WHCM |

### 4. `2px` is the universal custom-outline width

Every custom focus outline uses exactly `2px` (except one `3px` outlier for the play button). `2px` is not a universal WCAG success criterion — the required visible thickness depends on contrast ratio, WHCM `CanvasText` rendering, and `outline-offset`.

### 5. Variable `--control-focus-ring` is defined in `global.css` but not in `tokens.css`

`var(--control-focus-ring)` is **declared** in `css/global.css:470` as `--control-focus-ring: rgba(var(--primary-rgb), 0.42);` — inside a PR3 `:root` block. It appears in `css/editor/editor-canvas-toolbar/buttons.css`, `css/editor/editor-floating-toolbar/toolbar.css`, `css/editor/editor-floating-toolbar/quick-add.css`, `css/editor/editor-floating-toolbar/dropdown.css`, `css/global.css:565` (shared buttons), and `css/global.css:596` (tag-chip).

It is **not** declared in `css/global/tokens.css`. Because it lives in `global.css` (which imports `tokens.css` before the `:root` block), the token is available at runtime. However, it is not centralized in the design-token source of truth, which carries a maintenance risk: a consumer that imports `tokens.css` alone will not receive this variable.

### 6. `outline-offset` values vary without pattern

| `outline-offset` | Prevalence | Examples |
|---|---|---|
| `2px` | Most common | buttons, chips, select, toolbar, settings controls |
| `4px` | Cards | `.love-tree-card:focus-visible`, `.tree-card:focus-visible` (2x card outline) |
| `-1px` | Inputs | `.settings-profile-name-input:focus` |
| (none) | Several | `.browse-story-nav-btn:focus-visible`, `.editor-floating-toolbar-btn:focus-visible` |

No single convention establishes when `2px` vs `4px` offset is appropriate. `-1px` on the settings input conflates outline with border.

### 7. Multiple literal rgba focus-ring colors, no single source of truth

| Color literal | Locations | Opacities used |
|---|---|---|
| `rgba(144, 73, 81, ...)` | 18+ locations | 0.12, 0.30, 0.32, 0.35, 0.36, 0.38, 0.40, 0.42, 0.45, 0.48, 0.85, 0.92 |
| `rgba(122, 139, 110, ...)` | 4 locations | 0.48 |
| `rgba(255, 255, 255, ...)` | 3 locations | 0.3, 0.85 |

## Completed work incorporated

### #3716 / PR #3721 — shared search-input focus treatment (completed)

Browse/My Trees search input and sort select now have `:focus-visible` styles:
- `.search-input:focus-visible` — `box-shadow: 0 0 0 3px rgba(...)` + `border-color` change
- `.browse-sort-select:focus-visible` — `box-shadow: 0 0 0 2px rgba(...)` + `border-color` change
- `transition: all` replaced with bounded `border-color, box-shadow` transitions
- `prefers-reduced-motion` handling present

**Impact on this audit:** The stale claim "search input has no `:focus-visible`" is now resolved. The normal-mode keyboard focus feedback is improved. However, the forced-colors vulnerability persists — both use `box-shadow` as the sole focus indicator, which is invisible in WHCM. The `outline: none` on `.search-input` and `.browse-sort-select` base remains unremediated for WHCM. The audit conclusion (`MISSING_COVERAGE`) is unchanged — the root WHCM risk is not addressed.

### #3729 / PR #3733 — public viewer loading-state semantics (completed)

Viewer loading state (`aria-busy`, `role=status`, `role=alert`, spinner hidden attribute) added forced-colors-relevant patterns but no direct `forced-colors` media query or system-color tokens. Impacts none of the existing audit findings.

**Impact on this audit:** Reviewed — no change to audit conclusion.

### #3728 / PR #3732 — secondary action/focus decision (completed)

Secondary action and focus treatment decisions were aligned per design review. No new `forced-colors` media queries or system-color tokens were introduced.

**Impact on this audit:** Reviewed — no change to audit conclusion.

## Correction principles (applied)

1. **`2px` is not a universal WCAG rule**: Do not assert `2px` as the required minimum. The PR will need per-variant visibility measurement or a token-driven approach that can vary by contrast context.

2. **`outline` vs `box-shadow` must be distinguished for WHCM**:
   - `outline` structure (width, style, offset) is **preserved** in WHCM. Only `outline-color` is subject to system override. An element with `outline: 2px solid var(--x)` remains visibly outlined in WHCM — with a system color instead of the author color.
   - `box-shadow` is **rendered as `none`** in WHCM. Any focus indicator that relies solely on `box-shadow` (without `outline` fallback) loses its visible indicator.
   - Therefore: `box-shadow`-only focus = high risk. Explicit `outline` with author color = partially covered (system color fallback is automatic, but author intent is lost).
   - Static source cannot prove that the resulting system-color outline provides adequate contrast — that requires runtime verification.

3. **`box-shadow` alone is not a valid forced-colors support claim**: Every `box-shadow`-only focus indicator loses visibility in WHCM (spec-confirmed: `box-shadow` renders as `none`). Default remediation: remove native outline suppression, add solid `outline`, add a non-color cue that survives WHCM, or use an authored system-color rule. `forced-color-adjust: none` is not a default remediation — it is reviewed only when a component provides a complete accessible alternative style and passes runtime WHCM verification.

4. **Semantic action vs. visual similarity**: Selectors that are visually similar (e.g., `.btn-round`, `.btn-primary`, `.btn-outline`) but serve different semantic roles should be distinguished. The shared focus rule in `global.css` is acceptable for common styling, but each semantic variant may need separate forced-colors behavior (e.g., primary button on dark hero vs. secondary on white surface).

5. **`ICON_ONLY` is a presentation modifier, not a semantic class**: Icon-only controls (`.create-tree-modal-close`, `.editor-canvas-tool-btn` with no label) are not classified as a separate semantic role. Their focus treatment must match their interactive role (button, link, toggle). The accessibility deficiency is the missing label, not the icon nature.

## Future child candidates (maximum 4)

### Child 1: `--control-focus-ring` token definition + global focus ring baseline

| Field | Value |
|---|---|
| Verified defect | `--control-focus-ring` is defined in `global.css:470` but absent from `tokens.css`. Any consumer that imports `tokens.css` alone will lack this variable. 18+ literal rgba focus-ring colors exist across the codebase with no single source of truth. |
| Minimum expected file scope | `css/global/tokens.css` (declare variable), `css/global.css` (remove duplicate `:root` declaration, keep usage) |
| Implementation prerequisite | None |
| Stop condition | `tokens.css` contains `--control-focus-ring` definition, `global.css` uses it via `var(--control-focus-ring)`, all literal rgba focus-ring colors in `global.css` shared rules replaced. |
| Risk | Low — token addition is non-breaking; consumer replacement is mechanical |
| Dependencies | None |
| Blocks | Children 2, 3 |

### Child 2: `outline: none` / `box-shadow`-only forced-colors remediation

| Field | Value |
|---|---|
| Verified defect | 27 locations use `outline: none` on interactive elements. 5 locations use `box-shadow` as sole focus indicator. In WHCM, `box-shadow` is `none` — these elements lose visible focus indicator. Element remains focusable. |
| Minimum expected file scope | `css/editor/editor-overrides.css`, `css/editor/editor-detail-comments.css`, `css/search/search-controls.css`, `css/search/search-preview-social-bar.css`, `css/editor/editor-detail-edit/form-fields.css`, `css/my-trees/my-trees-create-modal.css`, `css/editor/editor-canvas.css`, `css/editor/editor-detail-content/detail-info.css`, `css/editor/editor-memory-edit.css`, `css/components/lovebud-ai-panel.css`, `css/chat-first-workspace/*.css` |
| Implementation prerequisite | Each `outline: none` must gain an `outline` fallback or be removed. `box-shadow`-only focus must add `outline` as primary indicator. |
| Stop condition | Zero `outline: none` on interactive elements without WHCM-safe replacement. Zero `box-shadow`-only focus indicators. |
| Risk | Medium — 27 locations require per-selector remediation (outline restoration, solid outline addition, or non-color cue). `forced-color-adjust: none` is not a default fix; it requires complete alternative styling and runtime WHCM verification. |
| Dependencies | Child 1 (so remediation uses the token) |

### Child 3: `@media (forced-colors)` baseline for verified failures

| Field | Value |
|---|---|
| Verified defect | 10 verified high-risk selectors: 5 box-shadow-only (visible focus indicator lost in WHCM per spec), 5 outline suppression with no surviving replacement. Elements with `outline` preserve structure — author color override is UA adjustment, not a defect. |
| Minimum expected file scope | `css/editor/editor-overrides.css` (retry/comment/like/reaction), `css/search/search-controls.css` (search-input, sort-select), `css/editor/editor-detail-edit/form-fields.css`, `css/search/search-preview-social-bar.css` |
| Implementation prerequisite | None — remediation can use existing tokens or system-color keywords directly. |
| Stop condition | Every verified high-risk selector has a WHCM-safe visible focus indicator. Must be confirmed by runtime WHCM test (browser-level verification). |
| Risk | Low — additive `@media (forced-colors)` blocks for verified failures only |
| Dependencies | None (can proceed independently of Child 1) |

### Child 4: Selected/disabled/error state distinction for forced-colors

| Field | Value |
|---|---|
| Verified defect | Per-category source-confirmed classification: opacity-based disabled — opacity difference survives forced-colors in source terms (runtime adequacy unverified); font-weight-based pressed — font-weight difference survives; color/background/border-only selected — author color overridden by system color, state distinction may collapse (verified selectors: `.love-tree-card-selected`, `.tag-chip.active`, `.create-tree-visibility-card input:checked + card`); color-only error — state distinction may collapse (verified selectors: `.editor-rename-modal-error`, `.settings-profile-edit-status--error`); native form-control state — UA forced-colors handling exists, source-only audit cannot assert failure. |
| Minimum expected file scope | `css/global/tokens.css` (if new state tokens needed), `css/shared/love-tree-card-composition.css`, `css/search/search-controls.css`, `css/editor/editor-overrides.css` |
| Implementation prerequisite | Child 1 (tokens), Child 3 (forced-colors baseline) |
| Stop condition | Verified selected/error selectors (`.love-tree-card-selected`, `.tag-chip.active`, `.create-tree-visibility-card input:checked + card`, `.editor-rename-modal-error`, `.settings-profile-edit-status--error`) gain a WHCM-safe secondary indicator (border style, underline, icon, or `text-decoration`) beyond color. Confirmed by runtime WHCM test. |
| Risk | Medium — depends on design decisions per component family |
| Dependencies | Child 1, Child 3 |

## Summary

| Component family | Source size | focus-visible covered | forced-colors covered | Primary risk |
|---|---|---|---|---|
| Shared buttons | 4 primary selectors | Yes (shared rule) | None authored; UA automatic system-color adjustment applies | `--control-focus-ring` not in `tokens.css` (defined in `global.css`); `outline` renders in WHCM but author color overridden by UA adjustment |
| Search/filter | 4 selectors | Yes (both input and sort have `:focus-visible`, but WHCM risk remains) | None authored; UA automatic adjustment applies | 2 `box-shadow`-only verified high-risk (`.search-input`, `.browse-sort-select`); `.tag-chip` has `outline` preserved |
| Card links & actions | 6 selectors | Yes (card+link) | None authored; UA automatic adjustment applies | `outline` renders in WHCM with UA automatic system-color adjustment; 3 distinct literal rgba colors used |
| Editor controls | 15+ selectors | Partial (7 verified high-risk outline:none) | None authored; UA automatic adjustment applies | 7 verified high-risk selectors (5 with no replacement, 2 box-shadow-only); 6 with explicit `outline` preserved |
| Settings controls | 4 selectors | Partial (2 have explicit outline, 2 have no product-specific focus) | None authored; UA automatic adjustment applies | 2 confirmed patterns (outline with var(--primary)); 2 unresolved (no product-specific focus, UA default available) |
| Modal/dialog | 8 selectors | 3 have explicit outline, 3 unresolved (UA default), 2 box-shadow-only | None authored; UA automatic adjustment applies | 3 with outline preserved in WHCM; 3 unresolved (no native outline suppression); 2 verified high-risk (rename input box-shadow, create-tree-input box-shadow) |
| Icon-only | 6 selectors | 3 have explicit outline, 1 outline:none, 2 unresolved | None authored; UA automatic adjustment applies | `.create-tree-modal-close` unresolved (no native outline suppression); `.preview-social-action` verified high-risk (outline:none) |
| Destructive | 3 selectors | Good for delete, logout | None authored; UA automatic adjustment applies | Clean patterns exist (delete-link with var(--primary-vibrant), logout with var(--primary)) |
| State distinction | 5 categories (see Section 9) | N/A | Per-category (see Section 9) | Opacity-based disabled and font-weight pressed survive; color-only selected and error categories may collapse |

Refs #3753
Refs #3716 — completed (PR #3721)
Refs #3728 — completed (PR #3732)
Refs #3729 — completed (PR #3733)
Refs #3672 — Keep OPEN
Refs #3425 — Keep OPEN
Refs #1882 — Keep OPEN
