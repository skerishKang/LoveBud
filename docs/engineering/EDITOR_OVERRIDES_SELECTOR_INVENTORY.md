# Editor Overrides Selector Inventory

## Purpose

Follow-up from PR #482 and Issue #419. This document provides a detailed selector-level inventory of `css/editor/overrides.css` for role-based relocation planning. No CSS changes are made in this PR.

This is a docs-only inventory document.

Non-goals:

- No CSS implementation changes.
- No selector movement, removal, or renaming.
- No HTML or JavaScript changes.
- No Editor runtime behavior changes.
- No required checks or workflow changes.
- No credential, token, cookie, session values included.
- No PR #7, prototype, reference, demo, or variant path changes.

Refs #419

---

## Inventory Method

Selectors are grouped by functional role and assessed for:
- **Current Purpose**: What UI element or behavior the selector controls
- **Likely Owner File**: Where this selector should live after relocation
- **Relocation Readiness**: READY / NEEDS_USAGE_CHECK / HOLD
- **Risk Level**: LOW / MEDIUM / HIGH
- **Required Future Smoke Check**: Specific editor states to verify

---

## Selector Role Inventory Table

### Group A: Status & Settings Panel

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-status-section` | Status panel container | overrides.css:1 | `status-settings.css` | READY | LOW | Empty tree, Populated tree |
| `.editor-add-section` | Add memory section container | overrides.css:1 | `status-settings.css` | READY | LOW | Empty tree, Populated tree |
| `.editor-status-section h3` | Section headings | overrides.css:6 | `status-settings.css` | READY | LOW | All tree states |
| `.editor-add-section h3` | Section headings | overrides.css:6 | `status-settings.css` | READY | LOW | All tree states |
| `.editor-status-card` | Tree status card styling | overrides.css:15 | `status-settings.css` | READY | LOW | Empty, Populated, Selected memory |
| `.editor-space-between-row` | Flex layout utility | overrides.css:25 | `status-settings.css` | READY | LOW | All sidebar states |
| `.editor-status-card strong` | Tree title display | overrides.css:32 | `status-settings.css` | READY | LOW | All tree states |
| `.editor-status-card p` | Status description text | overrides.css:44 | `status-settings.css` | READY | LOW | All tree states |
| `.editor-rename-btn` | Rename button (hidden) | overrides.css:54 | `status-settings.css` | HOLD | LOW | Verify hidden state |
| `.editor-tree-visibility-pill` | Public/private indicator | overrides.css:67 | `status-settings.css` | READY | LOW | Both visibility states |
| `.editor-tree-visibility-pill.is-public` | Public state styling | overrides.css:81 | `status-settings.css` | READY | LOW | Public tree smoke |
| `.editor-tree-visibility-pill.is-private` | Private state styling | overrides.css:87 | `status-settings.css` | READY | LOW | Private tree smoke |
| `.editor-title-settings-panel` | Settings button grid | overrides.css:93 | `status-settings.css` | READY | LOW | Settings panel open |
| `.editor-mini-setting-btn` | Mini action buttons | overrides.css:100 | `status-settings.css` | READY | LOW | All button states |
| `.editor-mini-setting-btn .material-symbols-outlined` | Button icons | overrides.css:119 | `status-settings.css` | READY | LOW | Icon rendering |
| `.editor-mini-setting-btn:hover` | Button hover state | overrides.css:126 | `status-settings.css` | READY | LOW | Hover interaction |
| `.editor-flow-summary` | Flow summary text | overrides.css:132 | `status-settings.css` | READY | LOW | Populated tree |
| `.editor-sidebar-actions` | Sidebar action container | overrides.css:136 | `status-settings.css` | READY | LOW | All action states |
| `.editor-add-section .secondary-btn` | Add memory button | overrides.css:142 | `status-settings.css` | READY | LOW | Empty tree state |
| `.editor-sidebar-actions .secondary-btn` | Sidebar action buttons | overrides.css:142 | `status-settings.css` | READY | LOW | All sidebar actions |
| `.sidebar-btn` | Generic sidebar button | overrides.css:182 | `status-settings.css` | NEEDS_USAGE_CHECK | MEDIUM | Verify all button instances |
| `.sidebar-btn:hover` | Button hover state | overrides.css:203 | `status-settings.css` | READY | LOW | Hover states |
| `.sidebar-btn-primary` | Primary action button | overrides.css:210 | `status-settings.css` | READY | LOW | Primary button states |
| `.sidebar-btn-primary:hover` | Primary hover | overrides.css:219 | `status-settings.css` | READY | LOW | Hover interaction |
| `.btn-icon` | Button icon container | overrides.css:225 | `status-settings.css` | READY | LOW | Icon alignment |
| `.btn-label` | Button text label | overrides.css:231 | `status-settings.css` | READY | LOW | Text rendering |
| `.editor-sidebar-meta` | Meta information section | overrides.css:241 | `status-settings.css` | READY | LOW | Meta display |

### Group B: Paper Tone & Visual Theme

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `body .editor-layout` | Editor layout background | overrides.css:283 | `theme.css` or keep | HOLD | HIGH | All editor states - comprehensive regression |
| `body .sidebar` | Sidebar paper texture | overrides.css:288 | `theme.css` or keep | HOLD | HIGH | Sidebar all states |
| `body .detail-panel` | Detail panel paper texture | overrides.css:288 | `theme.css` or keep | HOLD | HIGH | Detail panel all states |
| `body .canvas-area` | Canvas background texture | overrides.css:295 | `theme.css` or keep | HOLD | HIGH | Canvas all interactions |
| `body .canvas-area::before` | Canvas decorative border | overrides.css:302 | `theme.css` or keep | HOLD | HIGH | Canvas visual |
| `body .editor-status-card` | Status card paper effect | overrides.css:307 | `theme.css` or keep | HOLD | HIGH | Status card all states |
| `body .editor-status-card strong` | Title color override | overrides.css:314 | `theme.css` or keep | HOLD | MEDIUM | Title rendering |
| `body .editor-tree-quiet-note` | Quiet note styling | overrides.css:318 | `theme.css` or keep | HOLD | MEDIUM | Note display |
| `body .node-card` | Memory node card style | overrides.css:324 | `theme.css` or keep | HOLD | HIGH | Node all states |
| `body .memory-node:hover .node-card` | Node hover state | overrides.css:332 | `theme.css` or keep | HOLD | HIGH | Node hover interaction |
| `body .memory-node.selected .node-card` | Node selected state | overrides.css:332 | `theme.css` or keep | HOLD | HIGH | Node selection |
| `body .node-img-wrapper` | Node image container | overrides.css:338 | `theme.css` or keep | HOLD | MEDIUM | Image display |
| `body .editor-current-moment-card` | Current moment card | overrides.css:344 | `theme.css` or keep | HOLD | MEDIUM | Moment card states |
| `body .editor-moment-info-card` | Moment info card | overrides.css:344 | `status-settings.css` | READY | MEDIUM | Info card display |
| `body .editor-save-status-card` | Save status card | overrides.css:344 | `status-settings.css` | READY | MEDIUM | Save status display |
| `body .diary-note` | Diary/note styling | overrides.css:356 | `theme.css` or keep | HOLD | MEDIUM | Note rendering |
| `@media (max-width: 375px)` | Mobile responsive overrides | overrides.css:387 | `responsive.css` or keep | NEEDS_USAGE_CHECK | HIGH | Mobile all states |

### Group C: Memory Inline Edit

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.memory-inline-edit` | Inline edit container | overrides.css:413 | `memory-edit.css` | READY | MEDIUM | Inline edit mode |
| `.memory-inline-edit input` | Inline edit input | overrides.css:418 | `memory-edit.css` | READY | MEDIUM | Input field states |
| `.memory-edit-textarea` | Memo/diary textarea | overrides.css:430 | `memory-edit.css` | READY | MEDIUM | Textarea states |
| `.memory-edit-button` | Edit action button | overrides.css:446 | `memory-edit.css` | READY | LOW | Button display |
| `.memory-edit-button:hover` | Button hover | overrides.css:457 | `memory-edit.css` | READY | LOW | Hover state |
| `.memory-edit-actions` | Action button group | overrides.css:461 | `memory-edit.css` | READY | LOW | Actions layout |
| `.memory-edit-actions .btn-save` | Save button | overrides.css:467 | `memory-edit.css` | READY | LOW | Save action |
| `.memory-edit-actions .btn-cancel` | Cancel button | overrides.css:477 | `memory-edit.css` | READY | LOW | Cancel action |
| `.memory-edit-error` | Error message | overrides.css:487 | `memory-edit.css` | READY | LOW | Error display |
| `.memory-edit-hint` | Hint text | overrides.css:493 | `memory-edit.css` | READY | LOW | Hint display |

### Group D: Memory Mode & Form Support

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-memory-mode-group` | Mode selection container | overrides.css:499 | `mode-selection.css` | READY | LOW | Mode group display |
| `.editor-memory-mode-chip` | Mode chip base | overrides.css:506 | `mode-selection.css` | READY | LOW | Chip rendering |
| `.editor-memory-mode-chip.is-active` | Active mode state | overrides.css:522 | `mode-selection.css` | READY | LOW | Mode switching |
| `.editor-memory-mode-chip .material-symbols-outlined` | Mode chip icon | overrides.css:529 | `mode-selection.css` | READY | LOW | Icon alignment |
| `.editor-form-support-note` | Form helper note | overrides.css:533 | `memory-edit.css` | READY | LOW | Note display |
| `.editor-form-support-note .material-symbols-outlined` | Note icon | overrides.css:547 | `memory-edit.css` | READY | LOW | Icon styling |
| `.editor-form-field.is-deemphasized` | Deemphasized field | overrides.css:553 | `memory-edit.css` | READY | LOW | Field state |

### Group E: Layout & Canvas Components (Paper Tone Pass 4)

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-layout` (Pass 4) | Layout background gradient | overrides.css:557 | `layout.css` or keep | NEEDS_USAGE_CHECK | HIGH | Conflicts with Pass 3 |
| `.sidebar` (Pass 4) | Panel borders/background | overrides.css:564 | `layout.css` or keep | NEEDS_USAGE_CHECK | HIGH | Conflicts with Pass 3 |
| `.detail-panel` (Pass 4) | Panel borders/background | overrides.css:564 | `layout.css` or keep | NEEDS_USAGE_CHECK | HIGH | Conflicts with Pass 3 |
| `.canvas-area` (Pass 4) | Canvas styling | overrides.css:580 | `layout.css` or keep | NEEDS_USAGE_CHECK | HIGH | Conflicts with Pass 3 |
| `.canvas-area::before` (Pass 4) | Canvas decoration | overrides.css:587 | `layout.css` or keep | NEEDS_USAGE_CHECK | HIGH | Conflicts with Pass 3 |
| `.canvas-svg` | Canvas SVG layer | overrides.css:598 | `layout.css` | READY | LOW | Z-index only |
| `.memory-node` | Memory node element | overrides.css:598 | `layout.css` | NEEDS_USAGE_CHECK | MEDIUM | Also styled in Group B |
| `#canvasEmptyGuide` | Empty canvas guide | overrides.css:598 | `layout.css` | READY | LOW | Empty state |
| `#addMemoryForm` | Add memory form | overrides.css:598 | `layout.css` | READY | LOW | Form display |

### Group F: Canvas Topbar & Toolbar (Pass 4)

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-canvas-topbar` | Canvas top bar | overrides.css:677 | `canvas-toolbar.css` | READY | MEDIUM | Topbar positioning |
| `.editor-canvas-topbar > *` | Topbar children | overrides.css:690 | `canvas-toolbar.css` | READY | LOW | Child elements |
| `.editor-canvas-title h2` | Canvas title | overrides.css:694 | `canvas-toolbar.css` | READY | MEDIUM | Title display |
| `.editor-canvas-caption` | Canvas caption | overrides.css:702 | `canvas-toolbar.css` | READY | LOW | Caption text |
| `.editor-canvas-toolbar` | Floating toolbar | overrides.css:710 | `canvas-toolbar.css` | READY | MEDIUM | Toolbar display |
| `.editor-canvas-toolbar .sidebar-btn` | Toolbar buttons | overrides.css:722 | `canvas-toolbar.css` | READY | MEDIUM | Button styling |

### Group G: Hidden/Compatibility Selectors

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-status-section > h3` | Hidden heading | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `.editor-flow-lead` | Hidden flow element | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `#sidebarMomentCount` | Hidden moment count | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `#sidebarFlowSummary` | Hidden flow summary | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `#sidebarSelectionHint` | Hidden selection hint | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `.editor-add-section-bottom` | Hidden add section | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `.editor-tree-meta-section` | Hidden meta section | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `#detailEmptyStartBtn` | Hidden detail button | overrides.css:732 | REMOVE or HOLD | HOLD | LOW | Verify not used |
| `.editor-status-card` (margin-top) | Margin override | overrides.css:743 | `status-settings.css` | READY | LOW | Card spacing |
| `.editor-canvas-empty-guide__desc` | Empty guide description | overrides.css:747 | `layout.css` | READY | LOW | Empty state text |

### Group H: Legacy/Ambiguous (Paper Tone Pass 3)

| Selector / Family | Current Purpose | Current Location | Likely Owner File | Readiness | Risk | Required Future Smoke |
|---|---|---|---|---|---|---|
| `.editor-status-card` (gradient) | Pass 3 gradient | overrides.css:251 | CONSOLIDATE | HOLD | HIGH | Conflicts with Pass 4 |
| `.editor-status-card` (select) | Text selection | overrides.css:256 | `status-settings.css` | READY | LOW | Verify selection works |
| `.memory-node` (user-select) | Node selection disable | overrides.css:272 | `layout.css` | NEEDS_USAGE_CHECK | MEDIUM | Also in Pass 4 |

---

## Relocation Readiness Criteria

### READY
- Low-risk selector family with clear owner and isolated visual surface
- Single-purpose selectors without cross-cutting concerns
- No conflicts with other passes or groups

### NEEDS_USAGE_CHECK
- Selector used across multiple editor states or dynamic classes
- Selector appears in multiple groups (e.g., Pass 3 and Pass 4)
- Requires verification of all usage instances before relocation

### HOLD
- Selector has unclear ownership or compatibility role
- Part of complex visual theme that touches all surfaces
- Selector marked for removal (obsolete/hidden elements)
- Conflicts detected between multiple style passes

---

## Risk Assessment Summary

| Risk Level | Count | Groups | Notes |
|---|---|---|---|
| **LOW** | 42 | A, C, D, F, G | Ready for narrow relocation PRs |
| **MEDIUM** | 16 | B, C, E, F | Requires targeted smoke testing |
| **HIGH** | 15 | B, E | Keep centralized or extensive regression testing |

---

## Future Implementation Split

### PR B1 — Relocate One READY Low-Risk Role Group Only
**Recommended Starting Point:** Group D (Memory Mode UI)
- 6 selectors, all READY, LOW risk
- Self-contained functional area
- Clear visual smoke requirements

**Alternative:** Group A subset (Status card only, not buttons)

### PR B2 — Browser Visual Smoke for Affected Editor States
**Required for any relocation:**
- Editor empty state (no memories)
- Editor populated tree with memories
- Memory detail panel open
- Memory edit mode (inline)
- Memory mode chip switching
- Mobile 375px viewport

### PR C — Remove Obsolete Overrides (Group G)
**After verifying no JavaScript references:**
- 8 hidden selectors with `display: none !important`
- Requires JS file search for selector references
- Browser smoke with all editor features

### PR D — Consolidate Paper Tone Passes (Groups B, E, H)
**Only if necessary:**
- Pass 3 and Pass 4 have overlapping selectors
- Consider consolidating rather than splitting
- Comprehensive visual regression required

---

## Verification Requirements for Future CSS PRs

### Required Editor States
1. **Empty tree** - No memories, initial state
2. **Populated tree** - Multiple memories visible
3. **Selected memory** - Detail panel open
4. **Memory edit mode** - Inline editing active
5. **Memory create form** - Add new memory
6. **Tree settings** - Settings panel visible
7. **Mobile 375px** - Responsive layout

### Technical Checks
- [ ] No fatal console errors
- [ ] No visual regressions in canvas/toolbar
- [ ] No broken layout or overlapping elements
- [ ] No Auth/API/runtime behavior changes

---

## Guardrails

- **No selector movement in this PR** - This is inventory only.
- **No broad editor CSS rewrite** - Relocation must be narrow.
- **No runtime behavior change** - CSS-only changes.
- **Do not combine with #418** (Global CSS Hardening).
- **Do not combine with #412/#481** (Public tree adapter work).
- **Do not touch Browse/Search UI** - Editor work stays isolated.
- **Do not touch Auth/API/backend**.
- **PR #7/prototype/reference/demo/variant untouched**.
- **PR #450/YouTube PoC untouched**.

---

## Verification Matrix

| Verification Item | Status for This Inventory PR | Notes |
|---|---|---|
| `git diff --check` | PASS | Required before PR creation. |
| Docs-only changed files | YES | Only `docs/engineering/EDITOR_OVERRIDES_SELECTOR_INVENTORY.md` modified. |
| Source file inspected | YES | `css/editor/overrides.css` (752 lines) fully reviewed. |
| Selector role groups documented | YES | 8 groups (A-H) with 73+ selectors. |
| Relocation readiness documented | YES | READY / NEEDS_USAGE_CHECK / HOLD criteria applied. |
| Risk levels documented | YES | LOW (42), MEDIUM (16), HIGH (15). |
| Future implementation split | YES | PR B1, B2, C, D defined. |
| Future visual smoke requirements | YES | 7 editor states documented. |
| No CSS/HTML/JS changes | YES | Inventory only. |
| PR #7/prototype/reference/demo/variant untouched | YES | — |
| PR #450/YouTube PoC untouched | YES | — |

---

## Related Documents

- [EDITOR_OVERRIDES_ROLE_RELOCATION_PLAN.md](./EDITOR_OVERRIDES_ROLE_RELOCATION_PLAN.md) - High-level relocation planning from PR #482

---

## Final Inventory Status

Issue #419's editor override selectors are now fully inventoried by role, risk, and relocation readiness. Future implementation should follow the narrow PR sequence (B1 → B2 → C → D), with comprehensive browser smoke on all affected editor states before merge. Keep editor CSS work isolated from other ongoing efforts.

Refs #419
