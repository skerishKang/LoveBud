# Forced-Colors and Focus-Visible Coverage Audit

Parent #3753 · Refs #3672, #3425, #1882

## Exact baseline

| Field | Value |
|---|---|
| Repository | `skerishKang/LoveBud` |
| Audited ref | `origin/main` |
| Exact commit | `9af1f6116566e9b616a89f108bc17e002bcf8485` |
| Expected commit | `9af1f6116566e9b616a89f108bc17e002bcf8485` |
| Drift | `NONE` |
| Class | Generic Tier 2 / U0 source-only audit |
| Browser, screenshot, Production | not used |

This SHA is the evidence boundary. No CSS, token, or selector changes are authorized.

## Evidence limits

Read-only evidence was taken from `css/**`, `js/**`, `pages/**`, `docs/design/UI_DESIGN_SYSTEM.md`, `docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md`.

No computed style, accessibility tree, screenshot, browser, Preview, or Production evidence was collected. Static source cannot prove visual pass, focus clipping, contrast, or WHCM rendering correctness.

Dispositions: `SOURCE_CONFIRMED`, `PARTIAL_COVERAGE`, `MISSING_COVERAGE`, `PAGE_OWNED`, `NOT_APPLICABLE`, `UNRESOLVED`.

## Inventory

### 1. Shared primary/secondary buttons

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/global.css:591-598` | `.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible`, `.cta-appreciation:focus-visible` | Interactive action | `outline: 2px solid var(--control-focus-ring)` | `outline` authority (2px, variable) | Zero. No `@media (forced-colors)` or `forced-color-adjust` present | Disabled: not defined on `.btn-round` base (opacity handled per-instance); selected: not applicable (ephemeral actions) | Variable `var(--control-focus-ring)` is defined nowhere in `tokens.css` — falls through to UA default (browser blue outline) | `MISSING_COVERAGE` |
| `css/index/components.css:19-47` | `.btn-outline` (Home hero) | Home hero action | Inherits `global.css` via `body .btn-outline` | `border` + `::after` underline | Zero | Hover: `.btn-outline::after` border-opacity change only | None beyond shared | `PAGE_OWNED` |
| `css/intro/hero/layout.css:86-137` | `.intro-cta-primary:focus-visible`, `.intro-cta-secondary:focus-visible` | Intro CTA action | `outline: 2px solid rgba(144, 73, 81, 0.38)` | `outline` authority (2px, literal rgba) | Zero | Hover: scale + shadow changes only | Literal rgba never adapts to WHCM | `PAGE_OWNED` |

### 2. Browse/My Trees search & filter

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/search/search-controls.css:15-35` | `.search-input` | Text entry | `outline: none` + `:focus { box-shadow }` | `box-shadow` only; no `outline` re-added for WHCM | Zero | Error: not defined on this selector | **High**: native `outline` removed, `box-shadow` invisible in WHCM | `MISSING_COVERAGE` |
| `css/search/search-controls.css:224-227` | `.browse-sort-select:focus-visible` | Sort combobox | `box-shadow: 0 0 0 2px rgba(...)` + `border-color` change | `box-shadow` as pseudo-outline; no `outline` property | Zero | Disabled: not defined | **High**: `outline: none` (line 215), replacement `box-shadow` invisible in WHCM | `MISSING_COVERAGE` |
| `css/global.css:564-567` + `search-controls.css:47-65` | `.tag-chip:focus-visible` | Filter chip (toggle button) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority (2px, variable) | Zero | Active: `.tag-chip.active` background/border change only; disabled: not defined | Variable `--control-focus-ring` undefined in `tokens.css` | `PARTIAL_COVERAGE` |
| `css/search/search-hero-controls.css` | Hero filter row | Filter presentation | Native `<span>` — not button semantics | `outline` inherited from `.tag-chip` when `<button>` is used | Zero | Active: background/border change only | Browse uses `<span>` (no keyboard reachable), My Trees uses `<button>` | `UNRESOLVED` |

### 3. Card links and owner actions

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/shared/love-tree-card-composition.css:45-49` | `.love-tree-card:focus-visible` | Card shell (link) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | Zero | Selected: `.love-tree-card-selected` accent bar + border-color change; disabled: N/A | Literal rgba never adapts to WHCM; `outline-offset: 4px` may clip on small cards | `PARTIAL_COVERAGE` |
| `css/search/search-tree-card/actions.css:25-35` | `.tree-card-open-link:focus-visible` | Open link (button-like anchor) | `outline: 2px solid rgba(144, 73, 81, 0.30)` | `outline` authority (2px, literal rgba) | Zero | Disabled: not defined | Literal rgba invisible in WHCM | `PARTIAL_COVERAGE` |
| `css/search/search-tree-card/layout.css:61-63` | `.tree-card:focus-visible` | Card shell (Browse) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | Zero | Selected: `.tree-card.is-selected` shadow/ring defined via token | Matches `love-tree-card-composition.css` pattern | `PARTIAL_COVERAGE` |
| `css/my-trees/my-trees-cards.css:68-72` | `.tree-card:focus-visible` | Card shell (My Trees) | `outline: 2px solid rgba(122, 139, 110, 0.48)` | `outline` authority (2px, literal rgba) | Zero | Same as Browse | Duplicate — should inherit from shared | `DUPLICATE` |
| `css/my-trees/my-trees-visibility-gate.css:78` | `.tree-card:focus-visible .tree-card-open-link` | Visibility action reveal | Inherits card focus | `outline` not re-declared | Zero | Visibility: color/border only | Focus is proven on parent, not on link itself | `PAGE_OWNED` |

### 4. Editor view/edit controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/editor/editor-canvas-toolbar/buttons.css:44-47` | `.editor-canvas-tool-btn:focus-visible` | Icon toolbar button | `outline: 2px solid var(--control-focus-ring, rgba(...))` | `outline` authority (2px, variable+fallback) | Zero | Disabled: `.is-disabled` / `:disabled` opacity change; active: `.is-active` background swap | Variable `--control-focus-ring` undefined in `tokens.css`; fallback is literal rgba | `PARTIAL_COVERAGE` |
| `css/editor/editor-floating-toolbar/toolbar.css:74-77` | `.editor-floating-toolbar-btn:focus-visible` | Floating toolbar button | `outline: 2px solid var(--control-focus-ring, rgba(...))` | `outline` authority (2px, variable+fallback) | Zero | Disabled: `:disabled` opacity 0.46; pressed: not defined | Same variable fallback problem | `PARTIAL_COVERAGE` |
| `css/editor/editor-overrides.css:516-520` | `.editor-retry-button:hover, .editor-retry-button:focus-visible` | Retry action | `outline: none` + background swap | No outline replacement | Zero | Hover/active: background color change only | **High**: hover style copies to `:focus-visible`, then `outline: none` removes native ring | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:544-547` | `.editor-comment-toggle:hover, .editor-comment-toggle:focus-visible` | Comment toggle | `outline: none` + background swap | No outline replacement | Zero | Disabled: opacity + cursor | **High**: same pattern as retry button | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:753-757` | `.editor-like-button:hover, .editor-like-button:focus-visible` | Like toggle | `outline: none` + background swap | No outline replacement | Zero | Disabled: opacity 0.55; pressed: `.is-pressed` color change | **High**: same pattern | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:775-778` | `.editor-like-button.is-pressed:focus-visible` | Pressed like | `outline: none` — no visible ring added | No outline replacement | Zero | Pressed state adds background swap | Completely invisible focus | `MISSING_COVERAGE` |
| `css/editor/editor-detail-edit/actions.css:69-72` | `.editor-delete-link:focus-visible` | Destructive delete | `outline: 2px solid var(--primary-vibrant)` | `outline` authority (2px, variable) | Zero | Hover: color + background swap only | `var(--primary-vibrant)` defined in `tokens.css` — best pattern found | `SOURCE_CONFIRMED` |
| `css/editor/editor-detail-comments.css:57-62` | `.editor-moment-reaction:hover, .editor-moment-reaction:focus-visible` | Social reaction | `outline: none` + background/border swap | No outline replacement | Zero | Disabled: not defined | Hover style copies to focus, then outline removed | `MISSING_COVERAGE` |
| `css/editor/editor-detail-content/detail-info.css:88-97` | `.memory-preview-overlay .play-btn:focus-visible` | Media play | `outline: 3px solid var(--primary, #904951)` (matches mobile) | `outline` authority (3px, variable+fallback) | Zero | Hover/active: background swap only | `3px` (unique), variable defined | `PARTIAL_COVERAGE` |
| `css/editor/editor-detail-edit/form-fields.css:101-105` | `.editor-form-input:focus`, `.editor-form-textarea:focus` | Text entry | `outline: none` + `border-color` + `box-shadow` | `box-shadow` only | Zero | Error: not defined on these selectors | **High**: invisible in WHCM | `MISSING_COVERAGE` |
| `css/editor/editor-sidebar.css:52-54, 102-104` | `.editor-rail-collapse-btn:focus-visible`, `.editor-sidebar-back-link:focus-visible` | Rail collapse / back | `outline: 2px solid rgba(144, 73, 81, 0.4 / 0.35)` | `outline` authority (2px, literal rgba) | Zero | Disabled: not defined | Literal rgba invisible in WHCM | `PARTIAL_COVERAGE` |
| `css/editor/editor-memory-node.css:181-183` | `.memory-node:focus-visible .node-card` | Memory node card | `outline: 2px solid rgba(144, 73, 81, 0.36)` | `outline` authority (2px, literal rgba) | Zero | Selected: not defined | Focus targets card inside node, not the interactive node itself | `PARTIAL_COVERAGE` |

### 5. Settings controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/settings/components.css:31-34` | `.settings-close-btn:focus-visible` | Close/modal dismiss | `outline: 2px solid var(--primary)` | `outline` authority (2px, variable) | Zero | Disabled: not defined | Variable defined; clean pattern | `SOURCE_CONFIRMED` |
| `css/settings/components.css:255-258` | `.logout-btn:focus-visible` | Logout | `outline: 2px solid var(--primary)` | `outline` authority (2px, variable) | Zero | Disabled: not defined for logout | Variable defined | `SOURCE_CONFIRMED` |
| `css/settings/components.css:321-324` | `.settings-profile-name-input:focus` | Profile name input | `outline: 2px solid var(--focus-color, #4a90d9)` | `outline` authority (2px, variable+fallback) | Zero | Error: `.settings-profile-edit-status--error` color change only | Fallback `#4a90d9` is hardcoded — not a design-system color | `PARTIAL_COVERAGE` |
| `css/settings/components.css:327-365` | `.settings-profile-edit-save`, `.settings-profile-edit-cancel` | Form action (save/cancel) | **No `:focus` or `:focus-visible` defined** | None | Zero | Disabled: `:disabled` opacity 0.5 | **High**: no visible focus on form actions | `MISSING_COVERAGE` |
| `css/settings/base.css` | Settings page shell | Page structure | Native focus (not removed) | Native `outline` | Zero | N/A | Low — native focus preserved | `NOT_APPLICABLE` |

### 6. Modal/dialog controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/my-trees/my-trees-create-modal.css:9` | `.create-tree-modal-close` | Modal dismiss (icon-only) | **No `:focus` or `:focus-visible` defined** | None | Zero | Hover: background swap only | **High**: icon-only button with no focus visual; no accessible name fallback | `MISSING_COVERAGE` |
| `css/my-trees/my-trees-create-modal.css:28-31` | `.create-tree-modal-btn` (primary, secondary) | Modal action | **No `:focus` or `:focus-visible` defined** | None | Zero | Disabled: `:disabled` opacity 0.65; selected: N/A | **High**: modal actions with no visible focus | `MISSING_COVERAGE` |
| `css/my-trees/my-trees-create-modal.css:21-24` | `.create-tree-visibility-option input:checked + .create-tree-visibility-card` | Visibility radio card | Uses native radio focus via `input:focus-visible` (inherit, not styled) | Native UA `outline` (not removed) | Zero | Checked: border/background swap; error: not defined | Native radio remains keyboard-accessible; card visual does not signal focus | `PARTIAL_COVERAGE` |
| `css/index/visual/growth-stage.css:781-787` | `.hero-video-modal-close:focus-visible` | Video modal dismiss | `outline: 2px solid rgba(255,255,255,0.85)` | `outline` authority (2px, literal rgba) | Zero | Hover: scale + background swap | White outline works on dark overlay but fails in WHCM | `PARTIAL_COVERAGE` |
| `css/index/visual/growth-stage.css:903-907` | `.hero-video-modal-retry-btn:focus-visible` | Video modal retry | `outline: 2px solid rgba(255,255,255,0.3)` | `outline` authority (2px, low-opacity literal) | Zero | Disabled: not defined | Very low opacity (0.3) — low contrast even in normal mode | `PARTIAL_COVERAGE` |
| `css/editor/editor-overrides.css:654-671` | `.editor-rename-modal-input:focus` | Rename input | `outline: none` + `box-shadow: 0 0 0 4px rgba(...)` | `box-shadow` only (4px) | Zero | Error: `.editor-rename-modal-error` text only | **High**: invisible in WHCM | `MISSING_COVERAGE` |
| `css/editor/editor-overrides.css:688-702` | `.editor-rename-modal-btn` | Rename modal action | **No `:focus` or `:focus-visible` defined** | None | Zero | Disabled: `:disabled` opacity 0.55 | **High**: modal action button with no focus | `MISSING_COVERAGE` |

### 7. Icon-only controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/my-trees/my-trees-create-modal.css:9` | `.create-tree-modal-close` | Modal dismiss (icon-only) | **See modal section** | None | Zero | Hover: color/background swap | No accessible label or focus ring | `MISSING_COVERAGE` |
| `css/settings/components.css:1-34` | `.settings-close-btn:focus-visible` | Settings close (icon+glyph) | `outline: 2px solid var(--primary)` | `outline` authority | Zero | Hover: border/color/background | Has glyph text fallback, has focus ring | `SOURCE_CONFIRMED` |
| `css/editor/editor-canvas-toolbar/buttons.css:44-47` | `.editor-canvas-tool-btn:focus-visible` | Canvas toolbar (icon+label variants) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority | Zero | Disabled: opacity; active: `.is-active` swap | Wide variant has label text; narrow is icon-only with tooltip | `PARTIAL_COVERAGE` |
| `css/editor/editor-floating-toolbar/toolbar.css:74-77` | `.editor-floating-toolbar-btn:focus-visible` | Floating toolbar (icon+label) | `outline: 2px solid var(--control-focus-ring)` | `outline` authority | Zero | Disabled: opacity | Has label text — not truly icon-only | `PARTIAL_COVERAGE` |
| `css/search/search-preview-social-bar.css:62-66` | `.preview-social-action:not([disabled]):focus-visible` | Social action (icon+optional text) | `outline: none` (line 66) after `background` swap via `:focus-visible` | `outline: none` | Zero | Disabled: `[disabled]` excluded; selected: not defined | Hover style copies to focus, then outline removed | `MISSING_COVERAGE` |
| `css/index/visual/growth-stage.css:406-413` | `.growth-stage-card-play:focus-visible` | Home play button (icon-only overlay) | `outline: 2px solid rgba(255,255,255,0.85)` | `outline` authority | Zero | Hover: scale transform; disabled: not defined | White outline works on image overlay, fails in WHCM | `PAGE_OWNED` |

### 8. Destructive controls

| Source file | Selector | Role | focus-visible | outline/box-shadow/border | forced-colors | selected/disabled/error | keyboard risk | Disposition |
|---|---|---|---|---|---|---|---|---|
| `css/editor/editor-detail-edit/actions.css:52-72` | `.editor-delete-link:focus-visible` | Delete moment | `outline: 2px solid var(--primary-vibrant)` | `outline` authority (2px, `var(--primary-vibrant)` defined in `tokens.css`) | Zero | Hover: color + background swap; disabled: not defined | Best destructive-control pattern in codebase | `SOURCE_CONFIRMED` |
| `css/editor/editor-detail-edit/actions.css:3-13` | `.editor-edit-danger-action` | Edit danger action button | **No `:focus` or `:focus-visible` defined** | Inherits `.btn-round` / `.btn-outline` focus from `global.css` | Zero | Hover: background swap; disabled: not defined | Inherits shared button focus — adequate if parent selector applies | `PAGE_OWNED` |
| `css/settings/components.css:231-258` | `.logout-btn:focus-visible` | Account logout | `outline: 2px solid var(--primary)` | `outline` authority | Zero | Hover: background/border; disabled: not defined | Clean pattern | `SOURCE_CONFIRMED` |

### 9. Disabled / selected / pressed / error states

| State | Pattern prevalence | Selected source | forced-colors risk | Disposition |
|---|---|---|---|---|
| Disabled (`:disabled`) | Widespread — opacity 0.4-0.65 | `.btn-round:disabled`, `.editor-rename-modal-btn:disabled`, `.editor-floating-toolbar-btn:disabled` | Opacity-only distinction fails in WHCM (high-contrast mode may still render full opacity) | `MISSING_COVERAGE` |
| Selected (`.is-selected`, `.active`, `.is-pressed`) | Background/border/shadow swap only | `.love-tree-card-selected`, `.tag-chip.active`, `.create-tree-visibility-card input:checked+`, `.editor-like-button.is-pressed` | Color-only swap invisible in WHCM (which overrides background/color/border) | `MISSING_COVERAGE` |
| Pressed (`.is-pressed`) | Color + font-weight swap only | `.editor-like-button.is-pressed` | Weight change survives but color swap does not | `MISSING_COVERAGE` |
| Error (`[aria-invalid]`, `.has-error`, error status) | Border-color + text color change | `.editor-rename-modal-error`, `.settings-profile-edit-status--error`, `.scout-input.has-error` | Color-only change invisible in WHCM | `MISSING_COVERAGE` |

## Cross-cutting findings

### 1. No `forced-colors` or `forced-color-adjust` anywhere

Zero matches for `forced-colors` or `forced-color-adjust` across all CSS files. Every `outline` / `box-shadow` focus indicator uses color-only rules that are suppressed or overridden in Windows High Contrast Mode.

### 2. `outline: none` without replacement — 26+ locations

Every `outline: none` on an interactive element creates a forced-colors vulnerability. When the native focus ring is removed without a `forced-color-adjust: none` or `@media (forced-colors)` alternate, the element becomes unfocusable in WHCM.

Worst offenders: editor retry button, comment toggle, like button (pressed and unpressed), social reaction, search input, browse sort select, form inputs, rename modal input, preview social action.

### 3. `box-shadow` as sole focus indicator — 5 critical locations

| File | Selector | Issue |
|---|---|---|
| `css/search/search-controls.css:32-35` | `.search-input:focus` | Invisible in WHCM |
| `css/search/search-controls.css:224-227` | `.browse-sort-select:focus-visible` | Invisible in WHCM |
| `css/my-trees/my-trees-create-modal.css:15` | `.create-tree-input:focus` | Invisible in WHCM |
| `css/editor/editor-overrides.css:668-671` | `.editor-rename-modal-input:focus` | Invisible in WHCM |
| `css/editor/editor-detail-edit/form-fields.css:101-105` | `.editor-form-input:focus` | Invisible in WHCM |

### 4. `2px` is the universal custom-outline width

Every custom focus outline uses exactly `2px` (except one `3px` outlier for the play button). `2px` is not a universal WCAG success criterion — the required visible thickness depends on contrast ratio, WHCM `CanvasText` rendering, and `outline-offset`.

### 5. Variable `--control-focus-ring` is referenced but never defined

`var(--control-focus-ring)` appears in `css/editor/editor-canvas-toolbar/buttons.css`, `css/editor/editor-floating-toolbar/toolbar.css`, `css/editor/editor-floating-toolbar/quick-add.css`, `css/editor/editor-floating-toolbar/dropdown.css`, and `css/global.css` — but it is **not declared** in `css/global/tokens.css` or any other `:root` block. At runtime it falls through to the user-agent default (typically a browser-blue `outline`), which is ironically the most accessible behavior currently, but this is accidental, not intentional.

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

## Correction principles (applied)

1. **`2px` is not a universal WCAG rule**: Do not assert `2px` as the required minimum. The PR will need per-variant visibility measurement or a token-driven approach that can vary by contrast context.

2. **`box-shadow` alone is not a valid forced-colors support claim**: Every `box-shadow`-only focus indicator is invisible in WHCM. These must gain a `outline` fallback or a `forced-color-adjust` reset.

3. **Semantic action vs. visual similarity**: Selectors that are visually similar (e.g., `.btn-round`, `.btn-primary`, `.btn-outline`) but serve different semantic roles should be distinguished. The shared focus rule in `global.css` is acceptable for common styling, but each semantic variant may need separate forced-colors behavior (e.g., primary button on dark hero vs. secondary on white surface).

4. **`ICON_ONLY` is a presentation modifier, not a semantic class**: Icon-only controls (`.create-tree-modal-close`, `.editor-canvas-tool-btn` with no label) are not classified as a separate semantic role. Their focus treatment must match their interactive role (button, link, toggle). The accessibility deficiency is the missing label, not the icon nature.

## Future child candidates (maximum 4)

### Child 1: `--control-focus-ring` token definition + global focus ring baseline

| Field | Value |
|---|---|
| Exact candidate files | `css/global/tokens.css`, `css/global.css` |
| Scope | Declare `--control-focus-ring` in `:root` (`tokens.css`); replace literal rgba focus-ring colors with the token in `global.css` shared rules |
| Risk | Low — token addition is non-breaking; consumer replacement is mechanical |
| Dependencies | None |
| Blocks | Children 2, 3 |

### Child 2: `outline: none` forced-colors audit and remediation

| Field | Value |
|---|---|
| Exact candidate files | `css/editor/editor-overrides.css`, `css/editor/editor-detail-comments.css`, `css/search/search-controls.css`, `css/search/search-preview-social-bar.css`, `css/editor/editor-detail-edit/form-fields.css`, `css/my-trees/my-trees-create-modal.css`, `css/editor/editor-canvas.css`, `css/editor/editor-detail-content/detail-info.css`, `css/editor/editor-memory-edit.css`, `css/components/lovebud-ai-panel.css`, `css/chat-first-workspace/*.css` |
| Scope | Every `outline: none` on an interactive element must either be removed (let native ring show) or paired with a `forced-color-adjust: none` + custom `outline` fallback that works in WHCM |
| Risk | Medium — 26+ locations, some may require `forced-color-adjust: none` which has side effects |
| Dependencies | Child 1 (so remediation uses the token) |

### Child 3: `@media (forced-colors)` baseline for all interactive states

| Field | Value |
|---|---|
| Exact candidate files | `css/global.css` (shared button/card/chip focus), `css/editor/editor-overrides.css` (like/reaction/retry/toggle focus) |
| Scope | Add `@media (forced-colors: active) { ... }` block for interactive elements that lose focus/selected/disabled/error visual distinction in WHCM. Ensure `outline` is used for focus, `border` or custom `outline` for selected/error |
| Risk | Low-medium — additive only; requires testing in Windows High Contrast Mode |
| Dependencies | Child 1 |

### Child 4: Selected/disabled/error state distinction for forced-colors

| Field | Value |
|---|---|
| Exact candidate files | `css/global/tokens.css` (if new state tokens needed), `css/shared/love-tree-card-composition.css`, `css/search/search-controls.css`, `css/editor/editor-overrides.css` |
| Scope | Ensure that `.is-selected`, `.active`, `.is-pressed`, `:disabled`, and `[aria-invalid]` are visually distinguishable in WHCM. Color-only swaps must gain a secondary indicator (border style, underline, icon, or `text-decoration`) |
| Risk | Medium — depends on design decisions per component family |
| Dependencies | Child 1, Child 3 |

## Summary

| Component family | Source size | focus-visible covered | forced-colors covered | Primary risk |
|---|---|---|---|---|
| Shared buttons | 4 primary selectors | Yes (shared rule) | Zero | Variable undefined in tokens |
| Search/filter | 4 selectors | Partial (sort, input missing) | Zero | 2 `box-shadow`-only, 1 `outline:none` |
| Card links & actions | 6 selectors | Yes (card+link) | Zero | Literal rgba unmatched across surfaces |
| Editor controls | 15+ selectors | Partial (7 missing outline:none) | Zero | 7 controls with `outline:none` + no replacement |
| Settings controls | 4 selectors | Partial (form buttons missing) | Zero | Form action buttons have zero focus style |
| Modal/dialog | 8 selectors | Mostly missing (6 of 8) | Zero | Icon-only close button, modal actions, rename buttons |
| Icon-only | 6 selectors | Mixed (3 ok, 3 missing) | Zero | `.create-tree-modal-close` worst offender |
| Destructive | 3 selectors | Good for delete, logout | Zero | Clean patterns exist (delete-link, logout) |
| State distinction | Whole codebase | N/A | Zero | Color-only states fail WHCM |

Refs #3753
Refs #3672 — Keep OPEN
Refs #3728 — parallel
Refs #3706 — completed
Refs #3425 — Keep OPEN
Refs #1882 — Keep OPEN
