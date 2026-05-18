# LoveBud Open Issue Batch Plan

> **Last updated**: 2026-05-18
> **Main HEAD**: `f9c23a96` (docs: define chat-first tree workspace contract #1323)
> **Open issues**: 15
> **Open PRs**: 2 (#1320 ready, #1324 draft)

---

## 1. Open PRs

| PR | Title | Status | Linked Issue | Note |
|----|-------|--------|-------------|------|
| #1320 | `refactor(editor): split floating toolbar CSS` | **Ready, MERGEABLE** | #1278 | First slice of #1278. Can merge. Remaining floating toolbar extraction stays open. |
| #1324 | `feat: add isolated chat-first workspace shell` | **Draft** | #1321 | Isolated UI shell. Deferred — no immediate merge needed. |

**Decision**: PR #1320 can be merged when convenient. PR #1324 stays draft until #1321 is prioritised.

---

## 2. Issue Inventory

| Issue | Title | Labels | Category | Risk | Recommended Status |
|-------|-------|--------|----------|------|--------------------|
| #1321 | UX: chat-first tree workspace concept prototype | — | A. Experimental | Low | `READY_FOR_LATER_PROTOTYPE` |
| #1291 | Audit: review closed issues #1–#1249 | audit, product | B. Meta Audit | Low | `AUDIT_COMPLETE` (no new creation needed) |
| #1288 | Feature: moment-level reactions frontend UI / public viewer | frontend, product, feature | C. Feature | Medium | `FEATURE_LATER` |
| #958 | Print/PDF export for LoveTree keepsake | UX | C. Feature | Low | `FEATURE_LATER` (backlog) |
| #1278 | Refactor: split editor canvas toolbar CSS | frontend | D. Low-risk CSS | Low | `READY_FOR_SMALL_REFACTOR` (first slice in #1320) |
| #1279 | Refactor: split editor detail panel CSS | frontend | D. Low-risk CSS | Low | `READY_FOR_SMALL_REFACTOR` |
| #1275 | Refactor: split editor floating toolbar runtime | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1276 | Refactor: reduce legacy editor entrypoint | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1277 | Refactor: split editor canvas runtime | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1280 | Refactor: slim editor page HTML | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1281 | Refactor: split Browse search UI runtime | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1282 | Refactor: split public tree viewer runtime | frontend | E. Frontend Runtime | Medium | `READY_FOR_SMALL_REFACTOR` |
| #1285 | Refactor: split My Trees UI runtime | frontend | E. Frontend Runtime | Medium | `NEEDS_FILE_INVENTORY` (files created, needs commit) |
| #1283 | Refactor: audit and modularize auth entry | frontend | F. High-risk Auth | High | `HOLD_HIGH_RISK` |
| #1284 | Refactor: split Modal owner write handlers | backend | F. High-risk Auth/Backend | Very High | `HOLD_HIGH_RISK` |

---

## 3. Category Breakdown

### A. Experimental / Product Concept

| #1321 | Status |
|-------|--------|
| image assets organized | ✅ Done via PR #1322 |
| product contract created | ✅ Done via PR #1323 |
| isolated UI shell | ⏸️ Deferred (PR #1324 exists as draft) |
| real DB/API/AI integration | ❌ Not planned yet |
| monetisation | Evaluation only, not decided |

**Handling**: Keep open. No immediate action. PR #1324 stays draft.

---

### B. Meta Audit / Close-readiness Audit

| #1291 | Status |
|-------|--------|
| Closed-issues audit | ✅ Audit comments recorded in full |
| Reopened issues | #628, #958, #976, #1031, #1034, #1134 |
| Follow-ups created | #1288, #1289, #1290 |

**Handling**: Issue can stay open as reference. No new audit pass needed at this time. The reopened issues (#628, #976, #1031, #1034, #1134) should be handled separately, not under this umbrella.

---

### C. Feature / Product Implementation

| Issue | Slice idea | Depends on | Suggested Wave |
|-------|-----------|------------|----------------|
| #1288 | Moment reactions frontend: add reaction buttons to moment cards in editor + public viewer | #1269 backend foundation merged | Wave 5 |
| #958 | Print/PDF: public viewer print CSS + browser print action | Product decision first | Wave 5 (or backlog) |

---

### D. Low-risk CSS / Docs-adjacent Refactor

| Issue | Target | PR exists | Suggested Wave |
|-------|--------|-----------|----------------|
| #1278 | `css/editor/editor-canvas-toolbar.css` → split by toolbar surface | ✅ #1320 (first slice: mobile action bar) | Wave 2 |
| #1279 | `css/editor/editor-detail-panel.css` → split into focused sections | ❌ | Wave 2 |

---

### E. Medium-risk Frontend Runtime Refactor

| Issue | Target file(s) | Suggested Wave | Smoke Required |
|-------|---------------|----------------|----------------|
| #1275 | `js/editor/editor-floating-toolbar.js` | Wave 3 | ✅ Browser smoke |
| #1276 | `js/editor.js` | Wave 3 | ✅ Browser smoke |
| #1277 | `js/editor/editor-canvas.js` | Wave 3 | ✅ Browser smoke |
| #1280 | `pages/editor.html` | Wave 3 | ✅ Browser smoke |
| #1281 | `js/search/search-ui.js` | Wave 3 | ✅ Browser smoke |
| #1282 | `js/viewer/tree-viewer.js`, `js/viewer/public-tree-viewer.js` | Wave 3 | ✅ Browser smoke |
| #1285 | `js/my-trees/my-trees-ui.js` (or `my-trees.js`) | Wave 3 | ✅ Browser smoke |

---

### F. High-risk Auth / Backend Refactor

| Issue | Target | Suggested Wave | Precondition |
|-------|--------|----------------|-------------|
| #1283 | `js/auth.js` modularization | Wave 4 | Code audit first, not blind refactor |
| #1284 | `modal_compute/owner_writes.py` split | Wave 4 | Backend contract review + smoke first |

---

## 4. Priority Waves

### Wave 0 — Current state (this document) ✅
- [x] Open issue inventory complete
- [x] Open PRs identified
- [x] Batch plan written

### Wave 1 — Immediate safe actions
- [ ] Merge PR #1320 (refactor: split floating toolbar CSS — first slice of #1278)
- [ ] Verify #1278 remaining scope and update issue

### Wave 2 — Low-risk CSS refactors
- [ ] #1278 remaining: floating toolbar CSS extraction (after #1320)
- [ ] #1279: split editor detail panel CSS

### Wave 3 — Frontend runtime refactors (one per PR, behavior-preserving)
- [ ] #1275 → #1276 → #1277 → #1280 (editor cluster, do in order)
- [ ] #1281 → #1282 (search/viewer cluster)
- [ ] #1285 (My Trees cluster)

### Wave 4 — High-risk audit/refactor
- [ ] #1283: audit `js/auth.js` first, then modularize
- [ ] #1284: audit `modal_compute/owner_writes.py` first, then split

### Wave 5 — Feature work
- [ ] #1288: moment-level reactions frontend/public viewer
- [ ] #958: print/PDF export (after product decision)
- [ ] #1321: isolated UI shell (if still desired)

---

## 5. Refactoring Principles

1. **One issue per PR**. Never close multiple issues in a single PR.
2. **No close keywords in PR body**. Use `Refs #ISSUE_NUMBER` only.
   - Allowed: `Refs #1275`, `Refs #1275, #1276`
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

## 6. Issue Status Reference

| Status | Meaning |
|--------|---------|
| `READY_FOR_LATER_PROTOTYPE` | Concept defined, implementation deferred |
| `AUDIT_COMPLETE` | Audit work done, no new pass needed |
| `READY_FOR_SMALL_REFACTOR` | Safe to implement as single-file, behavior-preserving PR |
| `NEEDS_FILE_INVENTORY` | Needs current-source audit before coding |
| `FEATURE_LATER` | Functional feature, requires product decision first |
| `HOLD_HIGH_RISK` | Needs pre-audit before any refactor |
| `NEEDS_BROWSER_SMOKE` | Implementation exists but smoke verification missing |

---

## 7. Per-Issue Detail

### #1321 — UX: chat-first tree workspace concept prototype
- **Category**: A. Experimental / Product Concept
- **Risk**: Low
- **Current status**: Contract complete, image assets organised
- **Draft PR**: #1324 (isolated UI shell) exists but deferred
- **Next action**: No immediate action. PR #1324 stays draft.
- **PR strategy**: Single PR (#1324) when prioritised.

### #1291 — Audit: review closed issues #1–#1249
- **Category**: B. Meta Audit
- **Risk**: Low
- **Current status**: Audit comments recorded in full. 6 issues reopened.
- **Next action**: No new pass needed. Reopened issues handled individually.
- **PR strategy**: No code PR needed.

### #1288 — Feature: moment-level reactions frontend / public viewer
- **Category**: C. Feature
- **Risk**: Medium
- **Dependencies**: #1269 (reactions backend) already merged
- **Next action**: Design UI approach, then frontend + public viewer PRs
- **PR strategy**: 1–2 PRs (frontend + public viewer). No backend changes.

### #958 — Print/PDF export for LoveTree keepsake
- **Category**: C. Feature
- **Risk**: Low
- **Current status**: Reopened by #1291 audit. Planning doc exists at `docs/planning/PRINT_PDF_EXPORT_PLANNING.md`
- **Next action**: Product decision on scope and priority
- **PR strategy**: Start with public viewer print CSS + print action.

### #1278 — Refactor: split editor canvas toolbar CSS
- **Category**: D. Low-risk CSS
- **Risk**: Low
- **Current status**: First slice (mobile action bar) done via PR #1319. Second slice (floating toolbar) in PR #1320 (ready to merge).
- **Next action**: Merge #1320. Remaining scope: further CSS extraction.
- **PR strategy**: One CSS file per PR. Smoke: visual regression check only.

### #1279 — Refactor: split editor detail panel CSS
- **Category**: D. Low-risk CSS
- **Risk**: Low
- **Next action**: Similar pattern to #1278: extract focused sections.
- **PR strategy**: One PR. Smoke: visual regression.

### #1275 — Refactor: split editor floating toolbar runtime
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/editor/editor-floating-toolbar.js`
- **Next action**: Audit current file structure first. Extract interaction vs rendering.
- **PR strategy**: 1 PR per split. Requires browser smoke.

### #1276 — Refactor: reduce legacy editor entrypoint
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/editor.js`
- **Next action**: Audit current responsibilities. Extract clearly separable modules.
- **PR strategy**: 1 PR. Requires browser smoke.

### #1277 — Refactor: split editor canvas runtime
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/editor/editor-canvas.js`
- **Next action**: Review current structure. Split rendering vs interaction.
- **PR strategy**: 1 PR per split. Requires browser smoke.

### #1280 — Refactor: slim editor page HTML
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `pages/editor.html`
- **Next action**: Identify static templates that can be extracted.
- **PR strategy**: 1 PR. Smoke: verify all editor sections still render.

### #1281 — Refactor: split Browse search UI runtime
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/search/search-ui.js`
- **Next action**: Audit current search-ui.js structure.
- **PR strategy**: 1 PR per split. Requires browser smoke.

### #1282 — Refactor: split public tree viewer runtime
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/viewer/tree-viewer.js`, `js/viewer/public-tree-viewer.js`
- **Next action**: Audit viewer files for split boundaries.
- **PR strategy**: 1 PR per viewer file. Requires browser smoke.

### #1285 — Refactor: split My Trees UI runtime
- **Category**: E. Medium-risk Frontend Refactor
- **Risk**: Medium
- **Target**: `js/my-trees/my-trees-ui.js` or `js/my-trees.js`
- **Current status**: Files `rendering.js` and `interaction.js` were created but not committed/PR'd.
- **Next action**: Review current source, then refactor.
- **PR strategy**: 1 PR. Requires browser smoke.

### #1283 — Refactor: audit and modularize auth entry
- **Category**: F. High-risk Auth
- **Risk**: High
- **Target**: `js/auth.js`
- **Next action**: **Audit first**. Understand auth flow, login/signup/guard code before any change.
- **PR strategy**: Audit doc PR → refactor PR (with smoke).

### #1284 — Refactor: split Modal owner write handlers
- **Category**: F. High-risk Backend
- **Risk**: **Very High** (backend mutation)
- **Target**: `modal_compute/owner_writes.py`
- **Next action**: **Contract review + smoke first**. This touches production write logic.
- **PR strategy**: Audit/contract PR → careful split PR with backend smoke.
