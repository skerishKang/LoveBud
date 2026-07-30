# Secondary Action and Focus Treatment Decision

## Status

- **Status:** Source-only decision document
- **Parent:** #3672 — Keep OPEN
- **Base SHA:** `292b7ac5029da41ce29f1e659f7817959f497281` (origin/main)
- **Evidence boundary:** Source reading only. No browser, screenshot, Preview, Production, or Cloudflare verification authorized.
- **Preceding contracts:** #3706 / PR #3712 (inventory), #3674 / PR #3677 (audit)
- **Parallel child:** #3716 / PR #3721 (search-input focus treatment) — independent, no overlap

This document does not authorize implementation. It is a decision record only.

---

## 1. Exact Source Inventory

All evidence was read from `origin/main` at base SHA `292b7ac5029da41ce29f1e659f7817959f497281`.

### Required source files read

| File | Purpose |
|---|---|
| `docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md` | Component/variant inventory (Section 4.2 Primary Button, 4.3 Secondary Button, 4.14 Focus Treatment) |
| `docs/design/CANONICAL_COMPONENT_AND_TOKEN_CURRENT_STATE_AUDIT.md` | Token/component audit (Section 4 focus ring, Section 5 variant matrix) |
| `css/global.css` | Global button base (`.btn-round`, `.btn-primary`, `.btn-outline`), `:focus-visible` rules (lines 564, 591-598), `--control-focus-ring` token (line 470) |
| `css/global/tokens.css` | Design tokens: `--primary`, `--primary-rgb`, `--outline-variant`, `--radius-full`, `--lovetree-card-ring-active`, etc. |
| `css/index/components.css` | Home CTA variants (`.home-v3-actions .btn-round`, `.home-v3-actions .btn-outline`) |
| `css/editor/editor-detail-actions.css` | Editor action hierarchy (`.editor-action-btn-primary`, `.editor-action-btn-secondary`, `.editor-action-btn-ghost`) |
| `css/editor/editor-overrides.css` | Editor sidebar buttons (`.sidebar-btn`, `.sidebar-btn-primary`), `.btn-icon`, `.btn-label`, editor modal focus treatment |
| `css/editor/editor-memory-edit.css` | Memory edit actions (`.btn-save`, `.btn-cancel`) |
| `css/settings.css` → `css/settings/components.css` | Settings close button (`.settings-close-btn` with `:focus-visible`) |
| `css/detail/**` → `css/detail/base.css` | Detail back link (`.detail-back-link`) |
| `css/shared/love-tree-card-composition.css` | Shared card `:focus-visible` (line 45-49) |
| `js/auth/auth-ui-templates.js` | Auth login button (`.btn-round.btn-outline`), user dropdown items |
| `js/search/search-preview-action-helper.js` | Browse preview CTA (`.btn-round.preview-secondary-action`), share (`.btn-round.preview-share-action`), open tree (`.btn-round.btn-primary.preview-primary-action`) |
| `js/detail/detail-loading-error-boundary.js` | Detail error boundary fallback buttons (`.btn-round.btn-outline`) |

### Additional source observed

| File | Purpose |
|---|---|
| `css/editor/editor-overrides.css` (lines 443-481) | Editor reaction buttons with `:focus-visible` |
| `css/editor/editor-overrides.css` (lines 516-521) | Editor retry button with `:focus-visible` |
| `css/editor/editor-overrides.css` (lines 544-548) | Editor comment toggle with `:focus-visible` |
| `css/editor/editor-overrides.css` (lines 668-672) | Editor rename modal input `:focus` |
| `css/editor/editor-overrides.css` (lines 753-758) | Editor like button with `:focus-visible` |

---

## 2. Secondary-Action Taxonomy

Actions are classified by **semantic intent**, not visual similarity. Deleting, cancelling, going back, closing, and general secondary actions are **not** merged into one class merely because they look outlined.

### Semantic action classes

| Class | Definition | Examples in source |
|---|---|---|
| **PRIMARY_COMMIT** | Confirms and commits the primary task outcome | `.btn-primary` (global), `.editor-action-btn-primary`, `.sidebar-btn-primary`, `.btn-round.btn-primary.preview-primary-action` (Browse open-tree CTA) |
| **SECONDARY_SAFE_ACTION** | Non-destructive secondary action that does not cancel or dismiss | Browse `.preview-secondary-action` (open viewing), `.preview-share-action` (copy link) |
| **CANCEL_OR_DISMISS** | Aborts or closes a transient surface without committing | `.btn-cancel` (memory edit), `.settings-close-btn` (Settings close), Editor modal `.editor-rename-modal-btn-secondary` |
| **BACK_OR_NAVIGATION** | Returns to a previous page or parent context | `.detail-back-link` (Detail back to browse) |
| **DESTRUCTIVE** | Permanently removes data or state | Editor `.editor-action-btn` with delete action (owner-only), My Trees delete tree |
| **ICON_ONLY** | Action conveyed primarily by icon with minimal/no text | `.editor-action-btn-ghost` (icon + minimal label), `.editor-like-button` (icon + count), `.editor-moment-reaction` (icon + count) |
| **PAGE_AUTHORITY_SPECIFIC** | Action whose visibility/behavior depends on page authority context | My Trees create-tree (`.btn-header-create`), Editor save/cancel (owner edit vs view), Browse public vs owner hub actions |

### Selector-to-disposition matrix

| Selector | Source file | Semantic class | Disposition |
|---|---|---|---|
| `.btn-round` | `css/global.css` | base component | **CANONICAL_CANDIDATE** |
| `.btn-primary` | `css/global.css` | PRIMARY_COMMIT | **APPROVED_VARIANT** |
| `.btn-outline` | `css/global.css` | SECONDARY_SAFE_ACTION / CANCEL_OR_DISMISS | **APPROVED_VARIANT** |
| `.btn-round.btn-outline` (auth login) | `css/global.css` + `js/auth/auth-ui-templates.js` | PAGE_AUTHORITY_SPECIFIC (auth entry; page/auth-authority context) | **APPROVED_VARIANT** |
| `.btn-round.preview-secondary-action` | `js/search/search-preview-action-helper.js` | SECONDARY_SAFE_ACTION | **APPROVED_VARIANT** |
| `.btn-round.preview-share-action` | `js/search/search-preview-action-helper.js` | SECONDARY_SAFE_ACTION | **APPROVED_VARIANT** |
| `.btn-round.btn-primary.preview-primary-action` | `js/search/search-preview-action-helper.js` | PRIMARY_COMMIT | **APPROVED_VARIANT** |
| `.btn-round.btn-outline` (Detail error) | `js/detail/detail-loading-error-boundary.js` | BACK_OR_NAVIGATION (back to home / browse) | **APPROVED_VARIANT** |
| `.btn-cancel` | `css/editor/editor-memory-edit.css` | CANCEL_OR_DISMISS | **PAGE_SPECIFIC** |
| `.settings-close-btn` | `css/settings/components.css` | CANCEL_OR_DISMISS | **PAGE_SPECIFIC** |
| `.detail-back-link` | `css/detail/base.css` | BACK_OR_NAVIGATION | **PAGE_SPECIFIC** |
| `.editor-action-btn-primary` | `css/editor/editor-detail-actions.css` | PRIMARY_COMMIT | **PAGE_SPECIFIC** |
| `.editor-action-btn-secondary` | `css/editor/editor-detail-actions.css` | SECONDARY_SAFE_ACTION | **PAGE_SPECIFIC** |
| `.editor-action-btn-ghost` | `css/editor/editor-detail-actions.css` | ICON_ONLY | **PAGE_SPECIFIC** |
| `.editor-rename-modal-btn-primary` | `css/editor/editor-overrides.css` | PRIMARY_COMMIT | **PAGE_SPECIFIC** |
| `.editor-rename-modal-btn-secondary` | `css/editor/editor-overrides.css` | CANCEL_OR_DISMISS | **PAGE_SPECIFIC** |
| `.editor-like-button` | `css/editor/editor-overrides.css` | SECONDARY_SAFE_ACTION (appreciation toggle) | **PAGE_SPECIFIC** |
| `.editor-moment-reaction` | `css/editor/editor-overrides.css` | SECONDARY_SAFE_ACTION (reaction) | **PAGE_SPECIFIC** |
| `.sidebar-btn` | `css/editor/editor-overrides.css` | SECONDARY_SAFE_ACTION | **PAGE_SPECIFIC** |
| `.sidebar-btn-primary` | `css/editor/editor-overrides.css` | PRIMARY_COMMIT | **PAGE_SPECIFIC** |
| `.home-v3-actions .btn-outline` | `css/index/components.css` | SECONDARY_SAFE_ACTION | **PAGE_SPECIFIC** |
| `.btn-save` | `css/editor/editor-memory-edit.css` | PRIMARY_COMMIT | **PAGE_SPECIFIC** |
| `.cta-appreciation` | `css/global.css` | PRIMARY_COMMIT (verified: uses `--control-primary`, grouped with `.btn-primary` in primary CTA unification) | **APPROVED_VARIANT** |
| `.lovetree-pill` | `css/global.css` | SECONDARY_SAFE_ACTION (filter/selection) | **NOT_TO_CONVERGE** |

### Items explicitly NOT converged

| Selector | Reason | Disposition |
|---|---|---|
| `.settings-close-btn` | Icon-only close (× glyph), page-specific position, no text label | **NOT_TO_CONVERGE** |
| `.detail-back-link` | Link element (not button), icon + text, back-navigation semantics | **NOT_TO_CONVERGE** |
| `.btn-cancel` | Memory-edit context, inline form cancel, different visual weight | **NOT_TO_CONVERGE** |
| `.editor-action-btn-ghost` | Icon-only, transparent background, editor-specific layout | **NOT_TO_CONVERGE** |
| `.lovetree-pill` | Selection/filter control with `.is-active` state; not a commit/dismiss action | **NOT_TO_CONVERGE** |

---

## 3. Focus-Treatment Contract

### Current state (source-observed)

| Selector | Source | Focus treatment |
|---|---|---|
| `.btn-round:focus-visible`, `.btn-primary:focus-visible`, `.btn-outline:focus-visible`, `.cta-appreciation:focus-visible`, `.tag-chip:focus-visible` | `css/global.css` lines 564, 591-598 | `outline: 2px solid var(--control-focus-ring); outline-offset: 2px;` |
| `.love-tree-card:focus-visible` | `css/shared/love-tree-card-composition.css` line 45 | `outline: 2px solid rgba(122, 139, 110, 0.48); outline-offset: 4px; border-color: rgba(122, 139, 110, 0.24);` |
| `.settings-close-btn:focus-visible` | `css/settings/components.css` line 31 | `outline: 2px solid var(--primary); outline-offset: 2px;` |
| `.editor-moment-reaction:focus-visible` | `css/editor/editor-overrides.css` line 444 | `background: rgba(144, 73, 81, 0.10); color: var(--primary);` (no outline) |
| `.editor-moment-reaction-readonly:focus-visible` | `css/editor/editor-overrides.css` line 475 | `background: transparent; color: inherit;` (no outline) |
| `.editor-retry-button:focus-visible` | `css/editor/editor-overrides.css` line 517 | `background: var(--primary-container); color: var(--on-primary-container); outline: none;` |
| `.editor-comment-toggle:focus-visible` | `css/editor/editor-overrides.css` line 545 | `background: var(--surface-variant); outline: none;` |
| `.editor-like-button:focus-visible` | `css/editor/editor-overrides.css` line 754 | `background: rgba(144, 73, 81, 0.10); color: var(--primary); outline: none;` |
| `.editor-rename-modal-input:focus` | `css/editor/editor-overrides.css` line 668 | `border-color: rgba(144, 73, 81, 0.48); box-shadow: 0 0 0 4px rgba(144, 73, 81, 0.10);` (uses `:focus` not `:focus-visible`) |
| `.search-input:focus-visible` | `css/search/search-controls.css` (PR #3721) | `border-color: rgba(144, 73, 81, 0.32); box-shadow: 0 0 0 3px rgba(144, 73, 81, 0.15);` |
| `.browse-sort-select:focus-visible` | `css/search/search-controls.css` | `border-color: rgba(144, 73, 81, 0.32); box-shadow: 0 0 0 2px rgba(144, 73, 81, 0.12);` |

### Focus-treatment matrix

| Property | Decision | Rationale |
|---|---|---|
| **Minimum visible focus-ring thickness** | 2px | Proposed LoveBud focus-ring baseline (not a universal WCAG 2.2 thickness rule). A 2px outline provides sufficient indicator area when paired with the 3:1 contrast requirement below; matches existing `.btn-round:focus-visible`, `.settings-close-btn:focus-visible`, and PR #3721 `.search-input:focus-visible` |
| **Contrast requirement** | 3:1 against adjacent background | WCAG 2.2 AA for non-text focus indicators; existing `--control-focus-ring` = `rgba(144, 73, 81, 0.42)` provides sufficient contrast on white/surface backgrounds |
| **`:focus-visible` scope** | Keyboard-visible treatment only | Mouse users should not see persistent rings; `:focus-visible` is the correct heuristic. Existing `.btn-round:focus-visible` and PR #3721 `.search-input:focus-visible` already follow this pattern |
| **outline vs border vs box-shadow role** | `outline` for ring (non-layout-affecting); `border-color` for integrated focus state; `box-shadow` for layered ring when border is occupied | `outline` does not shift layout; `box-shadow` allows layered rings (e.g., PR #3721 search input uses both border-color and box-shadow) |
| **forced-colors fallback** | **NOT YET IMPLEMENTED** — no `@media (forced-colors: active)` exists in source | Gap: Windows High Contrast Mode focus-ring fallback (`outline: 2px solid CanvasText; outline-offset: 2px`) must be added in a future child |
| **reduced-motion** | **NOT YET IMPLEMENTED** — no `@media (prefers-reduced-motion: reduce)` for focus transitions | Gap: focus transition removal (`transition: none`) under reduced-motion must be added in a future child |
| **Token vs utility vs component-owned** | Token authority for ring color (`--control-focus-ring` or `--primary`); component-owned for ring thickness/offset | `--control-focus-ring` already exists in `css/global.css` line 470; ring thickness and offset remain component-owned to avoid global layout impact |
| **Focus trap vs visual focus ring** | Distinct concerns: focus trap = keyboard navigation containment (page-owned); visual focus ring = CSS `:focus-visible` (component-owned) | Home modal focus trap (`js/index-inline-init.js`) and Editor modal focus management are page-owned authority; visual rings are component-level CSS |
| **`--lovetree-focus-*` token family** | **Justified — future child should define** | Current focus colors are dispersed: `--control-focus-ring` (global), `rgba(122, 139, 110, 0.48)` (card), `var(--primary)` (settings). A `--lovetree-focus-ring` token family would centralize the ring color; `--lovetree-focus-ring-width` and `--lovetree-focus-ring-offset` would centralize thickness/offset. This is a candidate for a future token-migration child |

### Focus-treatment disposition by selector

| Selector | Current | Disposition |
|---|---|---|
| `.btn-round:focus-visible` etc. (global) | `outline: 2px solid var(--control-focus-ring); outline-offset: 2px;` | **APPROVED_VARIANT** — canonical pattern |
| `.love-tree-card:focus-visible` | `outline: 2px solid rgba(122, 139, 110, 0.48); outline-offset: 4px;` | **APPROVED_VARIANT** — card-specific offset |
| `.settings-close-btn:focus-visible` | `outline: 2px solid var(--primary); outline-offset: 2px;` | **PAGE_SPECIFIC** — uses `--primary` instead of `--control-focus-ring` |
| `.search-input:focus-visible` (PR #3721) | `border-color` + `box-shadow` ring | **APPROVED_VARIANT** — input-specific pattern |
| `.browse-sort-select:focus-visible` | `border-color` + `box-shadow` ring | **APPROVED_VARIANT** — select-specific pattern |
| `.editor-moment-reaction:focus-visible` | `background` + `color` (no outline) | **UNRESOLVED** — no visible ring; relies on background change only |
| `.editor-retry-button:focus-visible` | `background` + `color` + `outline: none` | **UNRESOLVED** — explicit `outline: none` with no replacement ring |
| `.editor-comment-toggle:focus-visible` | `background` + `outline: none` | **UNRESOLVED** — explicit `outline: none` with no replacement ring |
| `.editor-like-button:focus-visible` | `background` + `color` + `outline: none` | **UNRESOLVED** — explicit `outline: none` with no replacement ring |
| `.editor-rename-modal-input:focus` | `border-color` + `box-shadow` (uses `:focus` not `:focus-visible`) | **UNRESOLVED** — uses `:focus` instead of `:focus-visible` |

### Accessibility requirements

| Requirement | Current status | Gap |
|---|---|---|
| `:focus-visible` on all interactive elements | Present for buttons, chips, cards, settings close | Editor reaction/retry/comment/like buttons use `:focus-visible` but provide no ring (only background change) |
| Minimum 2px ring thickness | Present in global, settings, PR #3721 | Editor buttons have no ring; card uses 2px |
| 3:1 contrast ratio | `--control-focus-ring` (rgba 0.42) on white surface | `--primary` (settings) may not meet 3:1 on all backgrounds; editor buttons have no ring to evaluate |
| Focus order preservation | Not evaluated (no browser evidence) | Future child must verify tab order |
| Focus non-clipping | Not evaluated (no browser evidence) | Future child must verify ring is not clipped by `overflow: hidden` containers |

### Forced-colors requirements

| Requirement | Current status | Gap |
|---|---|---|
| `@media (forced-colors: active)` | Not present anywhere in source | No forced-colors fallback exists for any focus ring |
| `outline: 2px solid CanvasText` | Not present | Must be added in a future child |
| `outline-offset: 2px` | Not present | Must be added in a future child |

### Reduced-motion requirements

| Requirement | Current status | Gap |
|---|---|---|
| `transition: none` under `prefers-reduced-motion: reduce` | Present in `css/index/components.css` (Home hero copy) | Not present for focus-related transitions in global, editor, settings, or search |
| Focus transition removal | Not present | All focus transitions should be removed under reduced-motion |

### Page-owned focus traps vs visual focus rings

| Component | Focus trap owner | Visual ring owner | Disposition |
|---|---|---|---|
| Home video modal | `js/index-inline-init.js` (page-owned) | `css/index/visual/growth-stage.css` (page-owned) | **AUTHORITY_SPECIFIC** — preserve both |
| Editor rename modal | `js/editor/editor-rename-modal.js` (page-owned) | `css/editor/editor-overrides.css` (page-owned) | **AUTHORITY_SPECIFIC** — preserve both |
| Settings card dialog | `js/settings.js` (page-owned) | `css/settings/components.css` (page-owned) | **AUTHORITY_SPECIFIC** — preserve both |
| My Trees create modal | `js/my-trees/my-trees-actions.js` (page-owned) | `css/my-trees/` (page-owned) | **AUTHORITY_SPECIFIC** — preserve both |

---

## 4. Migration Order

Proposed small, independently mergeable children. Each requires its own exact execution contract. **This document does not authorize any implementation.**

### Child 1: Canonical secondary button

**Scope:** Define a canonical `.btn-secondary` class aligned to `.btn-round` base, covering SECONDARY_SAFE_ACTION and CANCEL_OR_DISMISS semantics.

**Exact candidate files:**
- `css/global.css` — add `.btn-secondary` base (new class, no existing selector modification)
- `tests/contracts/secondary-action-contract.test.cjs` — new contract test (new file)

**Does not touch:**
- `css/search/search-controls.css` (PR #3721)
- `css/editor/editor-detail-actions.css`
- `css/editor/editor-overrides.css`
- `css/editor/editor-memory-edit.css`
- `css/settings/components.css`
- `css/detail/base.css`
- `js/auth/auth-ui-templates.js`
- `js/search/search-preview-action-helper.js`
- `js/detail/detail-loading-error-boundary.js`
- Home thumbnail registry files (PR #3724)
- `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` (PR #3726)

### Child 2: Focus token family

**Scope:** Define `--lovetree-focus-ring`, `--lovetree-focus-ring-width`, `--lovetree-focus-ring-offset` tokens in `css/global/tokens.css`. Update global `:focus-visible` rules to use the new tokens.

**Exact candidate files:**
- `css/global/tokens.css` — add `--lovetree-focus-*` tokens
- `css/global.css` — update `:focus-visible` rules to reference new tokens

**Does not touch:**
- Same exclusions as Child 1, plus `.love-tree-card:focus-visible` (separate card child)

### Child 3: Editor focus ring remediation

**Scope:** Replace `outline: none` with visible `:focus-visible` rings on editor reaction/retry/comment/like buttons. Convert `.editor-rename-modal-input:focus` to `:focus-visible`.

**Exact candidate files:**
- `css/editor/editor-overrides.css` — update focus rules

**Does not touch:**
- Same exclusions as Child 1

### Child 4: Forced-colors and reduced-motion

**Scope:** Add `@media (forced-colors: active)` and `@media (prefers-reduced-motion: reduce)` blocks for all focus-visible rules.

**Exact candidate files:**
- `css/global.css` — add forced-colors/reduced-motion blocks
- `css/settings/components.css` — add forced-colors/reduced-motion blocks
- `css/shared/love-tree-card-composition.css` — add forced-colors/reduced-motion blocks

---

## 5. Non-Goals

The following are explicitly out of scope for this decision and any immediate child:

1. **Home modal focus behavior** — Home video modal focus trap, initial focus, focus restoration, and spotlight pause/resume are page-owned authority. They are preserved as-is.
2. **Editor complex control focus management** — Editor toolbar, canvas node focus, memory form focus, and rename modal focus management are page-owned authority. They are preserved as-is.
3. **Visual redesign of secondary actions** — No visual style changes to existing secondary actions. Only classification and canonical token/contract definition.
4. **Selector, ID, class, or route rename** — No existing identifiers are renamed or removed.
5. **Component extraction** — No shared component library or React/Vue component is created.
6. **Framework or library introduction** — No new frameworks, build tools, or dependencies.
7. **Browser, screenshot, Preview, Production, or Cloudflare** — No browser verification, no screenshots, no Preview deployment, no Production action.
8. **Token migration** — No existing token is renamed, replaced, or deleted. New tokens are additive only.
9. **Convergence of NOT_TO_CONVERGE items** — Settings close button, Detail back link, memory edit cancel button, editor ghost buttons, and `.lovetree-pill` remain page-specific.
10. **Parent closure** — #3672, #3674, #3425, #3458, and #1882 remain open.

---

## 6. Stop Conditions

A child implementation is NOT_READY if any of the following are true:

1. Any existing selector, ID, class, or route is renamed or removed without explicit owner approval.
2. Any existing visual style of a secondary action is changed without explicit owner approval.
3. Any existing focus-visible treatment is removed or weakened (contrast < 3:1, thickness < 2px).
4. Any page-owned focus trap or modal focus management is altered.
5. Any new CSS/HTML/JS/test/registry/workflow/package file is created outside the child's exact file boundary.
6. Any Home, loading, registry, classification, modal, or thumbnail file is modified.
7. `css/search/search-controls.css` or `tests/contracts/browse-mytrees-search-input-parity-contract.test.cjs` is modified (reserved for PR #3721).
8. `js/index-inline-init.js` or `css/index/visual/growth-stage.css` is modified (reserved for Home modal children).
9. `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` is modified (reserved for PR #3726).
10. Browser, Preview, Production, or Cloudflare evidence is generated or deployed.

---

## 7. Rollback

Rollback is deletion/revert of this single document (`docs/design/SECONDARY_ACTION_FOCUS_TREATMENT_DECISION.md`). No product source, test, or deployment state requires restoration. No existing file is modified by this document.

---

## 8. Unresolved Items

1. **Editor focus ring gaps** — `.editor-moment-reaction:focus-visible`, `.editor-retry-button:focus-visible`, `.editor-comment-toggle:focus-visible`, and `.editor-like-button:focus-visible` use `outline: none` or provide no ring. A future child must add visible rings.
2. **Editor rename modal input** — Uses `:focus` instead of `:focus-visible`. A future child should convert to `:focus-visible`.
3. **Forced-colors support** — No `@media (forced-colors: active)` exists anywhere. A future child must add CanvasText fallbacks.
4. **Reduced-motion for focus** — No `prefers-reduced-motion` block exists for focus transitions. A future child must add `transition: none` for focus-related transitions.
5. **`--lovetree-focus-*` token family** — Focus colors are dispersed (`--control-focus-ring`, `rgba(122, 139, 110, 0.48)`, `var(--primary)`). A future child should define canonical tokens.
6. **Focus non-clipping** — Not verified (no browser evidence). A future child must verify rings are not clipped by `overflow: hidden` containers.
7. **Focus order** — Not verified (no browser evidence). A future child must verify tab order across all interactive elements.

---

## 9. References

- #3728 — This Issue
- #3672 — Parent: Design System program — Keep OPEN
- #3706 — Canonical component/variant inventory contract — completed
- #3674 — Current-state audit — completed
- #3716 — Search-input focus treatment — parallel, Keep OPEN
- #3721 — Search-input focus treatment PR — parallel, Keep OPEN
- #3724 — Home thumbnail and registry files — parallel
- #3726 — Runtime health error latency taxonomy — parallel
- #1882 — Keep OPEN
