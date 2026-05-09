# Editor Overrides Role-Based Relocation Plan

## Purpose

Follow-up from Issue #137 and Issue #399. This document plans the role-based relocation of editor CSS overrides without immediate implementation. The goal is to split future editor CSS relocation work into narrow, verifiable PR scopes.

This is a docs-only planning document.

Non-goals:

- No CSS implementation changes.
- No selector movement in this PR.
- No HTML or JavaScript changes.
- No Editor runtime behavior changes.
- No global CSS hardening implementation.
- No Search/Browse changes.
- No Auth/API/backend changes.
- No required checks or workflow changes.
- No credential, token, cookie, session values included.
- No PR #7, prototype, reference, demo, or variant path changes.

Refs #419

---

## Current Target Area

### Primary File
- `css/editor/overrides.css` (752 lines)

### Current Override Categories

The editor overrides file currently contains styles for the following functional areas:

#### 1. Status & Settings Panel (Lines 1-140)
- `.editor-status-section`, `.editor-add-section` - Layout containers
- `.editor-status-card` - Tree status display card
- `.editor-rename-btn` - Tree rename button (currently hidden via `display: none`)
- `.editor-tree-visibility-pill` - Public/private visibility indicator
- `.editor-title-settings-panel` - Settings button grid
- `.editor-mini-setting-btn` - Mini setting action buttons
- `.editor-flow-summary` - Flow summary text
- `.editor-sidebar-actions` - Sidebar action buttons
- `.sidebar-btn`, `.sidebar-btn-primary` - Sidebar button variants
- `.btn-icon`, `.btn-label` - Button child elements
- `.editor-sidebar-meta` - Meta information section

#### 2. Paper Tone & Visual Theme (Lines 277-410)
- `body .editor-layout` - Editor layout background gradients
- `body .sidebar`, `body .detail-panel` - Panel styling
- `body .canvas-area` - Canvas area with radial gradient
- `body .editor-status-card` - Status card paper texture
- `body .editor-tree-quiet-note` - Quiet note styling
- `body .node-card` - Memory node cards
- `body .memory-node:hover/selected` - Node interaction states
- `body .node-img-wrapper` - Node image wrapper
- Editor card styling (moment cards, info cards, save status)
- Mobile polish at 375px breakpoint

#### 3. Memory Inline Edit (Lines 412-498)
- `.memory-inline-edit` - Inline editing container
- `.memory-inline-edit input` - Inline edit input fields
- `.memory-edit-textarea` - Memo/diary edit textarea
- `.memory-edit-button` - Edit action buttons
- `.memory-edit-actions` - Action button container
- `.memory-edit-actions .btn-save/.btn-cancel` - Save/cancel buttons
- `.memory-edit-error`, `.memory-edit-hint` - Error and hint messages

#### 4. Memory Mode & Form Support (Lines 499-556)
- `.editor-memory-mode-group` - Mode selection group
- `.editor-memory-mode-chip` - Mode selection chips
- `.editor-memory-mode-chip.is-active` - Active mode state
- `.editor-form-support-note` - Form helper notes
- `.editor-form-field.is-deemphasized` - Deemphasized fields

#### 5. Layout & Canvas Components (Lines 557-603)
- `.editor-layout` - Overall layout structure
- `.sidebar`, `.detail-panel` - Panel backgrounds and borders
- `.canvas-area` - Canvas styling with pseudo-elements
- `.canvas-svg`, `.memory-node`, etc. - Z-index layering

#### 6. Canvas Topbar & Toolbar (Lines 605-731)
- `.editor-canvas-topbar` - Canvas top bar positioning
- `.editor-canvas-title h2` - Title styling
- `.editor-canvas-caption` - Caption text
- `.editor-canvas-toolbar` - Floating toolbar
- Toolbar button overrides

#### 7. Hidden Elements (Lines 732-752)
- Multiple selectors with `display: none !important` for UI elements that are temporarily or permanently hidden

---

## Role-Based Relocation Candidates

### Category A: Structural Layout (LOW RISK)
**Current Selectors:**
- `.editor-layout`
- `.sidebar`, `.detail-panel`
- `.canvas-area`

**Proposed Location:** `css/editor/layout.css` or remain in base CSS

**Rationale:** These define the fundamental editor layout structure and could be moved to a dedicated layout file without affecting component styling.

### Category B: Status & Settings (MEDIUM RISK)
**Current Selectors:**
- `.editor-status-section`, `.editor-status-card`
- `.editor-tree-visibility-pill`
- `.editor-title-settings-panel`
- `.editor-mini-setting-btn`

**Proposed Location:** `css/editor/status-settings.css`

**Rationale:** Self-contained functional group. Relocation requires verification of all tree status display states.

### Category C: Memory Edit Forms (MEDIUM RISK)
**Current Selectors:**
- `.memory-inline-edit` and children
- `.memory-edit-textarea`
- `.memory-edit-button`, `.memory-edit-actions`

**Proposed Location:** `css/editor/memory-edit.css`

**Rationale:** Memory editing is a distinct functional area. Relocation requires inline editing smoke tests.

### Category D: Memory Mode UI (LOW RISK)
**Current Selectors:**
- `.editor-memory-mode-group`
- `.editor-memory-mode-chip`

**Proposed Location:** `css/editor/mode-selection.css`

**Rationale:** Small, self-contained component group. Relocation is straightforward but requires mode-switching verification.

### Category E: Visual Theme/Texture (HIGH RISK)
**Current Selectors:**
- `body .editor-layout` background
- `body .sidebar`, `body .detail-panel` backgrounds
- `body .canvas-area` styling
- Paper tone gradient overrides

**Proposed Location:** Keep in overrides or `css/editor/theme.css`

**Rationale:** Visual theme touches all surfaces. Relocation requires comprehensive visual regression testing. Consider keeping centralized.

### Category F: Canvas Toolbar (MEDIUM RISK)
**Current Selectors:**
- `.editor-canvas-topbar`
- `.editor-canvas-title`
- `.editor-canvas-toolbar`

**Proposed Location:** `css/editor/canvas-toolbar.css`

**Rationale:** Canvas-specific UI that could be isolated. Relocation requires canvas interaction testing.

### Category G: Hidden Elements (OBSOLETE)
**Current Selectors:**
- All `display: none !important` rules

**Proposed Action:** Review for permanent removal or document why hidden

**Rationale:** Elements with `!important` display:none may be obsolete. Need to verify if selectors can be removed rather than relocated.

---

## Proposed Future PR Split

### PR A — Inventory Editor Override Selectors by Role
**Scope:**
- Create detailed inventory of all selectors in `css/editor/overrides.css`
- Map each selector to its functional role
- Document current usage status (active, partially used, obsolete)

**Verification:**
- Static CSS review
- No runtime changes

### PR B — Relocate One Low-Risk Role Group Only
**Scope:**
- Select ONE low-risk category (recommended: Category D - Memory Mode UI)
- Move selectors to new file `css/editor/mode-selection.css`
- Update `pages/editor.html` stylesheet link order

**Verification Required:**
- Editor empty state visual smoke
- Memory mode chip rendering
- Mode switching functionality
- Mobile 375px viewport

### PR C — Visual Verification Checklist for Editor States
**Scope:**
- Document comprehensive editor visual states requiring verification
- Define smoke test checklist for future CSS changes

**Editor States to Verify:**
- Empty tree (no memories)
- Populated tree with memories
- Selected memory detail panel
- Memory edit mode (inline)
- Memory create form
- Tree settings panel
- Mobile 375px layout

### PR D — Remove Obsolete Overrides Only After Verified Ownership Transfer
**Scope:**
- Identify selectors with `display: none !important` that may be obsolete
- Verify no JavaScript references before removal
- Remove confirmed obsolete selectors

**Verification Required:**
- Search JS files for selector references
- Browser smoke test with all editor features

---

## Parallel-Work Guardrails

- **Do not touch `css/global.css`** unless explicitly scoped separately from Issue #418 (Global CSS Hardening).
- **Do not touch Browse/Search UI** - Keep editor work isolated from Search/Browse architecture.
- **Do not touch public tree adapter** work from Issue #412/#481.
- **Do not touch runtime/API/Auth/backend** - Editor CSS changes should not affect behavior.
- **One editor role group per future implementation PR** - Avoid broad CSS relocations.
- **No broad visual redesign** - Relocation should preserve exact visual output.

---

## Verification Matrix

| Verification Item | Status for This Plan PR | Notes |
|---|---|---|
| `git diff --check` | PASS | Required before PR creation. |
| Docs-only changed files | YES | Only `docs/engineering/EDITOR_OVERRIDES_ROLE_RELOCATION_PLAN.md` modified. |
| Editor override target area documented | YES | `css/editor/overrides.css` fully reviewed. |
| Role categories identified | YES | 7 functional groups mapped. |
| Future PR split documented | YES | PR A, B, C, D defined. |
| No CSS/HTML/JS changes | YES | Planning only. |
| PR #7/prototype/reference/demo/variant untouched | YES | — |
| PR #450/YouTube PoC files untouched | YES | — |

### Future Editor Visual Smoke Requirements (for implementation PRs)
- [ ] Editor empty state renders correctly
- [ ] Populated tree with memories renders correctly
- [ ] Memory detail panel styling correct
- [ ] Inline memory edit form styling correct
- [ ] Memory mode chips render and switch correctly
- [ ] Tree settings panel renders correctly
- [ ] Mobile 375px layout correct
- [ ] No fatal console errors
- [ ] No visual regressions in canvas/toolbar

---

## Final Planning Status

Issue #419's editor overrides role-based relocation plan is now documented. Future implementation should follow the narrow PR sequence above, with comprehensive browser smoke on all editor visual states before merge. Keep editor CSS work isolated from global CSS hardening (#418), public tree adapter work (#412/#481), and Search/Browse architecture changes.

Refs #419
