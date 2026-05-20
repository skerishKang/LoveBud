# LoveBud Open Issue Batch Plan

> **Last updated**: 2026-05-20
> **Main HEAD**: `cce62abc` (refactor(viewer): extract public viewer render state helper #1357)
> **Open issues**: 10
> **Open PRs**: 0

---

## 1. Completed Works (since previous plan)

| Issue | Title | Closure | Key PRs |
|-------|-------|---------|---------|
| #958 | Print/PDF export for LoveTree keepsake | ✅ **CLOSED** / completed | #1355 merged (browser-native print + print CSS) |
| #1275 | Refactor: split editor floating toolbar runtime | ✅ **CLOSED** | #1329 merged (action click-through extraction) |
| #1278 | Refactor: split editor canvas toolbar CSS | ✅ **CLOSED** | #1320 merged (mobile action bar) |
| #1279 | Refactor: split editor detail panel CSS | ✅ **CLOSED** | #1326–#1328 merged (panel.css → content/actions/edit/responsive) |
| #1321 | UX: chat-first tree workspace concept prototype | ✅ **CLOSED** | Design contract complete, no further action |
| #1282 | Refactor: split public tree viewer runtime | 🔄 **IN PROGRESS** (2 of ~4 slices done) | #1356 (data transform helper) + #1357 (render state helper) merged |

---

## 2. Open Issue Inventory

| Issue | Title | Category | Risk | Status | PR Count |
|-------|-------|----------|------|--------|----------|
| #1276 | Refactor: reduce legacy editor entrypoint | Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` | 0 |
| #1277 | Refactor: split editor canvas runtime | Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` | 0 |
| #1280 | Refactor: slim editor page HTML | Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` | 0 |
| #1281 | Refactor: split Browse search UI runtime | Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` | 0 |
| #1282 | Refactor: split public tree viewer runtime | Frontend Runtime | Medium | `IN_PROGRESS` (2/4 slices) | 2 merged (#1356, #1357) |
| #1285 | Refactor: split My Trees UI runtime | Frontend Runtime | Medium | `NEEDS_FILE_INVENTORY` | 0 |
| #1283 | Refactor: audit and modularize auth entry | High-risk Auth | **High** | `HOLD_HIGH_RISK` | 0 |
| #1284 | Refactor: split Modal owner write handlers | High-risk Backend | **Very High** | `HOLD_HIGH_RISK` | 0 |
| #1288 | Feature: moment-level reactions frontend/public viewer | Feature | Medium | `FEATURE_LATER` | 0 |
| #1291 | Audit: review closed issues #1–#1249 | Meta Audit | Low | `AUDIT_COMPLETE` (open as reference) | 0 |

---

## 3. #1282 Progress Detail

**Current status**: 2 of ~4 extraction slices merged. Remaining: viewer DOM update / route helper / moment panel.

### Completed slices

| PR | Slice | Status | Description |
|----|-------|--------|-------------|
| #1356 | Data transformation layer | ✅ **MERGED** | `getMemoryKey`, `getParentKey`, `mapBranchMoment`, `collectBranchPath`, `buildForkBranches`, `buildBranches` → `viewer-data-transform.js` |
| #1357 | Render state / DOM utility | ✅ **MERGED** | `qs`, `show`, `hide`, `showLoading`, `renderEmpty`, `renderError` → `viewer-render-state.js` |

### Remaining slices (suggested order)

1. **Viewer DOM update / route helper** — extract tree-header rendering, layout-toggle wiring, and tree initialisation DOM helpers from `initViewer()` in `tree-viewer.js`
2. **Moment panel / social summary** — extract moment detail panel state and social affordance helpers (note: may overlap with #1288)

**Current `tree-viewer.js` size**: 244 lines (down from 443 lines in PR #1356 base)

---

## 4. Priority Waves

### Wave 0 — Current refresh (this document) ✅
- [x] Open issue inventory refreshed with actual open count
- [x] Open PR count = 0 reflected
- [x] Completed works listed
- [x] #1282 progress documented

### Wave 1 — Documentation / Audit wrap-up
- [ ] **#1291**: close this umbrella issue or keep open as reference
- [ ] Confirm no stale PR branches or orphan working-tree changes

### Wave 2 — Small remaining public viewer runtime slices
- [ ] **#1282**: viewer DOM update / route helper extraction (1 PR)
- [ ] **#1282**: moment panel / social affordance extraction (1 PR, coordinate with #1288)

### Wave 3 — Frontend runtime refactors (one per PR, behavior-preserving)
- [ ] **#1281**: Browse/Search UI extraction (1 small PR)
- [ ] **#1285**: My Trees UI extraction (1 small PR)
- [ ] **#1276**: Legacy editor entrypoint reduction (1 PR)
- [ ] **#1277**: Editor canvas runtime split (1 PR)
- [ ] **#1280**: Editor page HTML slim (1 PR)

### Wave 4 — High-risk audit/refactor
- [ ] **#1283**: Audit `js/auth.js` first, then modularize
- [ ] **#1284**: Audit `modal_compute/owner_writes.py` first, then split

### Wave 5 — Feature work
- [ ] **#1288**: Design reactions UI approach, then frontend + public viewer PRs
- [ ] Any remaining no-regression features

---

## 5. High-risk Issue Notes

| Issue | Risk | Reason | Precondition |
|-------|------|--------|-------------|
| #1283 | **High** | Auth flow touches login/signup/guards. A refactor mistake could break login for all users. | Code audit PR first, then refactor with full browser smoke |
| #1284 | **Very High** | Backend production write handlers. A mistake could corrupt user data. | Contract review + backend smoke first |
| #1288 | Medium | New feature with UI + behaviour changes. Not a refactor — requires design. | Design review first, then implement in 1-2 PRs |

---

## 6. Refactoring Principles

1. **One issue per PR**. Never close multiple issues in a single PR.
2. **No close keywords in PR body**. Use `Refs #ISSUE_NUMBER` only.
   - Allowed: `Refs #1282`, `Refs #1276`
   - Forbidden: `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`
3. **Behavior-preserving**. Refactoring PRs must not change visible behaviour. No feature changes mixed in.
4. **File-level isolation**. Each refactor targets one file or one responsibility. No bundling.
5. **Smoke required**. Every runtime refactor needs browser smoke before merge.
   - CSS-only changes: visual smoke (no console errors, no layout breakage)
   - JS runtime changes: functional smoke (entry → interaction → exit, all states)
6. **Auth/backend audit first**. #1283 and #1284 need code audit before any split.
7. **Forbidden paths**. Never modify:
   - `prototype/`, `reference/`, `demo/`, `variant/`
   - PR #7 related paths
8. **No production route changes**. New pages go under `pages/` with separate route. No default route override.

---

## 7. Issue Status Reference

| Status | Meaning |
|--------|---------|
| `READY_FOR_SMALL_REFACTOR` | Safe to implement as single-file, behavior-preserving PR |
| `IN_PROGRESS` | At least one slice merged, remaining slices pending |
| `NEEDS_FILE_INVENTORY` | Needs current-source audit before coding |
| `FEATURE_LATER` | Functional feature, requires product decision or design first |
| `HOLD_HIGH_RISK` | Needs pre-audit before any refactor |
| `AUDIT_COMPLETE` | Audit work done, issue kept open as reference |

---

## 8. Per-Issue Detail

### #1291 — Audit: review closed issues #1–#1249
- **Category**: Meta Audit
- **Risk**: Low
- **Current status**: Audit comments recorded in full. 6 issues were reopened and have been handled individually.
- **Next action**: Keep open as reference, or close with completion comment.
- **PR strategy**: No code PR needed. This document serves as the follow-up.

### #1276 — Refactor: reduce legacy editor entrypoint
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `js/editor.js`
- **Next action**: Audit current responsibilities. Extract clearly separable modules.
- **PR strategy**: 1 PR. Requires browser smoke.

### #1277 — Refactor: split editor canvas runtime
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `js/editor/editor-canvas.js`
- **Next action**: Review current structure. Split rendering vs interaction.
- **PR strategy**: 1 PR. Requires browser smoke.

### #1280 — Refactor: slim editor page HTML
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `pages/editor.html`
- **Next action**: Identify static templates that can be extracted.
- **PR strategy**: 1 PR. Smoke: verify all editor sections still render.

### #1281 — Refactor: split Browse search UI runtime
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `js/search/search-ui.js`
- **Next action**: Audit current search-ui.js structure. Suggest starting with small helper extraction (data-only, no DOM).
- **PR strategy**: 1 small PR first, more if needed. Requires browser smoke.

### #1282 — Refactor: split public tree viewer runtime
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `js/viewer/tree-viewer.js`
- **Progress**: 2 of ~4 slices merged (PR #1356 data transform + PR #1357 render state)
- **Remaining**:
  - Viewer DOM update / route helper extraction
  - Moment panel / social affordance extraction (coordinate with #1288)
- **PR strategy**: 1 PR per remaining slice. Requires browser smoke.

### #1285 — Refactor: split My Trees UI runtime
- **Category**: Frontend Runtime
- **Risk**: Medium
- **Target**: `js/my-trees/my-trees-ui.js` or `js/my-trees.js`
- **Current status**: Previous extraction files were not committed. Needs fresh inventory.
- **Next action**: Review current source, then refactor.
- **PR strategy**: 1 PR. Requires browser smoke.

### #1283 — Refactor: audit and modularize auth entry
- **Category**: High-risk Auth
- **Risk**: High
- **Target**: `js/auth.js`
- **Next action**: **Audit first**. Understand auth flow, login/signup/guard code before any change.
- **PR strategy**: Audit doc PR → refactor PR (with full browser smoke on auth flows).

### #1284 — Refactor: split Modal owner write handlers
- **Category**: High-risk Backend
- **Risk**: **Very High** (backend mutation)
- **Target**: `modal_compute/owner_writes.py`
- **Next action**: **Contract review + smoke first**. This touches production write logic.
- **PR strategy**: Audit/contract PR → careful split PR with backend smoke.

### #1288 — Feature: moment-level reactions frontend / public viewer
- **Category**: Feature
- **Risk**: Medium
- **Dependencies**: #1269 (reactions backend) already merged
- **Next action**: Design UI approach first (reaction buttons placement, display in editor + public viewer).
- **PR strategy**: 1–2 PRs (frontend + public viewer). No backend changes.
