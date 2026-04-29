# Editor Detail UI Responsibility Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #223 item 1  
> **Type:** Docs-only — no JS, CSS, HTML, or runtime changes in this document

---

## 1. Purpose

This document captures the responsibility boundary audit for `js/editor/editor-detail-ui.js`.

The file currently handles several distinct concerns in a single module. This audit maps each responsibility, identifies inline style extraction candidates, proposes small follow-up PR candidates, and records the browser smoke checklist for desktop and mobile editor interactions.

No code changes are made in this document. `js/editor/editor-detail-ui.js`, `js/editor.js`, `pages/editor.html`, and all CSS files are read-only with respect to this PR.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #223 item 1 |
| Audit target | `js/editor/editor-detail-ui.js` |
| Related files (read-only) | `js/editor.js`, `pages/editor.html`, `css/editor*.css` |

---

## 3. Responsibility Map

### 3.1 Current Memory Card

**Responsibility:** Renders the currently-selected memory/moment card in the editor detail panel.

| Aspect | Notes |
|---|---|
| DOM target | Memory card container inside editor detail panel |
| Data source | Selected memory object passed from `js/editor.js` or editor state |
| Render trigger | Memory selection event / editor state change |
| Action surface | Action buttons (edit, delete, pin, etc.) rendered inside card |
| Inline style risk | Card layout may contain inline dimension or color styles — **VERIFY** |

**Concern:** Action button rendering and card layout rendering are currently co-located. These are distinct responsibilities and are candidates for separation in a follow-up PR.

---

### 3.2 Inline Title Edit

**Responsibility:** Manages the in-place editable title field for the current LoveTree in the editor.

| Aspect | Notes |
|---|---|
| DOM target | Tree title element (contenteditable or input) in editor header/detail area |
| Trigger | User clicks / focuses title field |
| Save path | Debounced API call or on-blur save — **VERIFY actual save trigger** |
| Validation | Minimum/maximum length, non-empty guard — **VERIFY** |
| Error state | Inline error or silent revert — **VERIFY** |
| Inline style risk | Focus ring, active-edit highlight may be inline styles — **VERIFY** |

**Concern:** Inline title edit combines DOM event management, validation, and API call triggering. Save-path logic is a candidate for extraction to a dedicated editor-save helper in a follow-up PR.

---

### 3.3 Inline Memo Edit

**Responsibility:** Manages the in-place editable memo/description field for the current memory or tree.

| Aspect | Notes |
|---|---|
| DOM target | Memo/description textarea or contenteditable element |
| Trigger | User clicks / focuses memo field |
| Save path | Debounced or on-blur API call — **VERIFY** |
| Validation | Max length, sanitization — **VERIFY** |
| Shared logic with title edit | Save trigger and error handling may be duplicated — **VERIFY** |
| Inline style risk | Edit-mode height/resize styles may be inline — **VERIFY** |

**Concern:** Title edit and memo edit may share save-path and validation logic that is currently duplicated. Consolidation is a candidate for the title/memo edit cleanup PR.

---

### 3.4 Action Buttons

**Responsibility:** Renders and handles click events for memory/tree action buttons (edit, delete, pin, copy, share, etc.).

| Aspect | Notes |
|---|---|
| DOM target | Action button bar inside memory card or detail header |
| Button set | Varies by ownership state (owner vs. viewer) and memory type — **VERIFY full set** |
| Auth dependency | Owner-only actions gated by auth state — **VERIFY gate mechanism** |
| Event delegation | Inline listener vs. delegated handler — **VERIFY** |
| Inline style risk | Button visibility toggles may use `display:none` inline — **VERIFY** |

**Concern:** Action button state (which buttons are visible) is currently coupled with render logic. Visibility control via inline styles is a high-priority extraction candidate.

---

### 3.5 Tree Meta Render

**Responsibility:** Renders tree-level metadata in the editor detail panel (title, cover image, tag list, owner info, visibility badge).

| Aspect | Notes |
|---|---|
| DOM target | Tree meta section of editor detail panel |
| Data source | Tree object from editor state or API response |
| Update trigger | Tree selection, tree save, or tree reload |
| Inline style risk | Cover image sizing, tag layout may be inline — **VERIFY** |

**Concern:** Tree meta render and memory card render share the same detail panel DOM parent, which creates coupling between two logically independent render paths.

---

## 4. Inline Style Extraction Candidates

Inline styles in `js/editor/editor-detail-ui.js` that are candidates for migration to existing editor CSS files. **No migration is performed in this PR.**

| Candidate | Current location | Target CSS file | Risk |
|---|---|---|---|
| Action button `display:none` / `display:flex` toggles | Inline via `.style.display` | `css/editor.css` or `css/editor-detail.css` | Low — visibility-only |
| Memory card layout dimensions | Inline `style` attributes in rendered HTML | `css/editor.css` | Medium — verify no JS reads `.style.*` for layout calc |
| Title/memo edit focus highlight | Inline via `.style.outline` or `.style.border` | `css/editor.css` `:focus` rule | Low — CSS-only |
| Cover image sizing in tree meta | Inline `width`/`height` on `<img>` | `css/editor.css` or `css/editor-detail.css` | Medium — verify no JS resizes dynamically |
| Tag list flex/gap layout | Inline style on tag container | `css/editor.css` | Low |

**Pre-migration check required for each candidate:**
1. Confirm no JS in `editor-detail-ui.js` or `editor.js` reads `.style.*` of the target element for layout calculation.
2. Confirm the CSS class rule does not exist elsewhere with a conflicting value.
3. Smoke-test desktop and mobile after each individual extraction.

---

## 5. Small PR Candidates

### PR A — Current-Memory Action Simplification

**Branch candidate:** `refactor/editor-detail-action-button-visibility`  
**Scope:**
- Replace inline `display:none` / `display:flex` toggles on action buttons with CSS class toggling (`classList.add/remove`).
- Move visibility rules to `css/editor.css` or `css/editor-detail.css`.
- No behavior change — buttons show/hide identically.

**Guardrails:**
- Only action button visibility — no button logic, auth gate, or event handler changes.
- Smoke test: all action buttons visible/hidden correctly for owner and viewer states, desktop and mobile.
- No other JS changes.

**Pre-condition:** Inline style extraction candidate audit (Section 4) confirmed for action button rows.

---

### PR B — Title / Memo Edit Responsibility Cleanup

**Branch candidate:** `refactor/editor-detail-title-memo-edit-cleanup`  
**Scope:**
- Extract shared save-trigger and validation logic from inline title edit and inline memo edit into a small private helper within `js/editor/editor-detail-ui.js` (no new file required for first pass).
- Remove duplicated debounce / save-path code.
- No API contract change, no save behavior change.

**Guardrails:**
- No change to save endpoint, save payload shape, or error handling UX.
- Smoke test: title edit save, memo edit save, validation rejection — all verified on desktop and mobile.
- No CSS changes in this PR.

**Pre-condition:** Confirmed that save-path logic is actually duplicated (VERIFY in Section 3.2 and 3.3 items).

---

## 6. Desktop / Mobile Browser Smoke Checklist

For use in PR A, PR B, and any follow-up editor-detail PRs.

### Desktop (Chrome / Firefox / Safari — 1280px+)

- [ ] Memory card renders correctly for selected memory
- [ ] Memory card renders empty/placeholder state when no memory selected
- [ ] Inline title edit: click to edit, type, save on blur — title updates
- [ ] Inline title edit: empty value rejected / reverts to previous value
- [ ] Inline memo edit: click to edit, type, save on blur — memo updates
- [ ] Inline memo edit: over-length value rejected or truncated
- [ ] Action buttons: all owner-state buttons visible for own tree
- [ ] Action buttons: viewer-state buttons only for non-owned tree
- [ ] Action buttons: delete triggers confirmation; confirmation cancels cleanly
- [ ] Tree meta: title, cover, tags, visibility badge render correctly
- [ ] Tree meta: updates after save without full page reload

### Mobile (Chrome / Safari — 375px – 430px)

- [ ] Memory card: correct layout at narrow viewport
- [ ] Inline title edit: tap to edit works; keyboard does not obscure save button
- [ ] Inline memo edit: tap to edit works; textarea expands correctly
- [ ] Action buttons: tap targets ≥ 44px; no overflow clipping
- [ ] Tree meta: cover image, tags, badge layout correct at narrow viewport
- [ ] No horizontal overflow on editor detail panel

---

## 7. Guardrails

- **No JS changes in this document or its PR.** `js/editor/editor-detail-ui.js` and `js/editor.js` are read-only.
- **No HTML changes.** `pages/editor.html` is read-only.
- **No CSS changes.** All CSS files are read-only in this PR.
- **No runtime behavior changes.**
- **Do not touch PR #319 or PR #7.**
- **Do not auto-delete or modify prototype/reference/demo/variant files.**
- **Issue #223 remains open** — this document covers item 1 only.

---

## 8. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/engineering/EDITOR_DETAIL_UI_RESPONSIBILITY_AUDIT.md`
- [ ] No JS/CSS/HTML/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #223
