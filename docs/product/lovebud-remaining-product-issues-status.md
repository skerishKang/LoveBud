# LoveBud Remaining Product Issues — Status Assessment

> **Author:** CTO Agent (delegated by Chulwon Kang / 박사님)
> **Date:** 2026-07-02
> **Scope:** Unified assessment of issues #3086, #2980, #2863
> **Status:** Documentation-only — no code changes included

This document consolidates three outstanding issues into a single status assessment. Each section provides current-state analysis, gap identification, and resolution pathways. The issues are independent but are grouped here for executive visibility and staged execution planning.

---

## Table of Contents

1. [#3086 — Oversized Module Refactoring Tracking](#section-1-3086--oversized-module-refactoring-tracking)
2. [#2980 — Emotion-Flow Defer Status](#section-2-2980--emotion-flow-defer-status)
3. [#2863 — Shared Editing Roles Initial Assessment](#section-3-2863--shared-editing-roles-initial-assessment)
4. [Cross-Cutting Dependencies & Sequencing](#appendix-cross-cutting-dependencies--sequencing)

---

## Section 1: #3086 — Oversized Module Refactoring Tracking

> **Title:** Track staged refactoring of oversized production modules  
> **Status:** `AUDIT/PLANNING` — refactoring plan exists, no execution started  
> **Parent umbrella:** #1882

### 1.1 Current State

The codebase has multiple modules that exceed or approach the 500-line reviewability threshold. These were inventoried in existing audits (`LARGE_FILE_MODULARIZATION_CANDIDATES.md`, `LARGE_JS_MODULE_SPLIT_AUDIT.md`, and per-domain decomposition audits). No staged refactoring PR has been executed yet for the specific modules tracked under #3086.

#### Top 10 largest JS Editor modules (by line count)

| # | Module | Lines | Primary Responsibility |
|---|--------|------:|-----------------------|
| 1 | `js/editor/editor-memory-actions.js` | 927 | Moment edit/save orchestration, undo comparison, server response validation |
| 2 | `js/editor/editor-canvas.js` | 866 | Canvas rendering, drag-drop, edge connections, layout coordination, pan/zoom |
| 3 | `js/editor/editor-detail-ui.js` | 809 | Detail panel DOM rendering, mode switching, template mounting |
| 4 | `js/editor/editor-memory-atlas-preview-panel.js` | 638 | Atlas preview panel with emotion/artist rendering |
| 5 | `js/editor/editor-bindings.js` | 603 | Global event bindings, keyboard navigation, mouse/touch coordination |
| 6 | `js/editor/editor-memory-form.js` | 541 | Memory creation form — media source, title, memo, tags input |
| 7 | `js/editor/editor-canvas-ui-helpers.js` | 482 | Canvas UI helper rendering and positioning |
| 8 | `js/editor/editor-entity-autocomplete.js` | 468 | Entity link autocomplete UI |
| 9 | `js/editor/editor-canvas-growth-affordance.js` | 459 | Growth affordance rendering and interaction |
| 10 | `js/editor/editor-detail-tree-meta.js` | 420 | Tree-level metadata editing in sidebar |

#### Top 5 largest Modal backend modules (by line count)

| # | Module | Lines | Primary Responsibility |
|---|--------|------:|-----------------------|
| 1 | `modal_compute/public_reads.py` | 739 | Public tree/memory reads, legacy normalization, browse snapshots |
| 2 | `modal_compute/app.py` | 453 | FastAPI route definitions, middleware, request orchestration |
| 3 | `modal_compute/memory_writes.py` | 323 | Memory CRUD — create, update with field-level validation |
| 4 | `modal_compute/validation.py` | 263 | Validation helpers, tag parsing, stage estimation |
| 5 | `modal_compute/tree_writes.py` | 256 | Tree CRUD — create, update, delete with ownership checks |

### 1.2 Gap Analysis

| Gap | Severity | Detail |
|-----|----------|--------|
| No staged splitting PRs executed | **High** | Several decomposition audits exist (EDITOR_ENTRY_ORCHESTRATOR_REDUCTION, EDITOR_MEMORY_FORM_DECOMPOSITION, PUBLIC_VIEWER_DETAIL_UI_DECOMPOSITION, AUTH_BOOTSTRAP_ORCHESTRATION_SPLIT) but none have produced actual refactoring PRs under #3086 |
| Split boundaries not settled for `editor-memory-actions.js` | **High** | 927 lines with mixed responsibilities: edit payload building, save orchestration, server response validation, no-change guard, inline tag comparison, toast display. No audit exists for this module yet |
| `editor-canvas.js` has partial extraction | **Medium** | Layout, node rendering, interaction, and pan/zoom have been extracted to separate files, but `editor-canvas.js` remains the main coordinator at 866 lines coordinating ~15+ sub-modules |
| `modal_compute/app.py` route ownership unclear | **Medium** | The FastAPI app file mixes public routes, private owner routes, exception handlers, CORS config, and Modal app definition. Route split to separate module files started but owner-write routes remain in `app.py` |
| No decomposition plan exists for editor-memory-actions.js | **Medium** | Unlike other modules (detail-ui, memory-form, public-viewer-detail-ui), there is no audit document for the largest editor module |
| `public_reads.py` (739 lines) growing | **Low** | Already extracted from app.py but continues to grow with legacy normalization and browse snapshot variants |

### 1.3 Resolution Path

#### Stage 1 — Audit `editor-memory-actions.js` (Recommended first)
- **Why:** It is the single largest editor file (927 lines) and has no decomposition audit
- **Action:** Create audit document (`EDITOR_MEMORY_ACTIONS_DECOMPOSITION_AUDIT.md`) identifying:
  - Edit save orchestration (~250 lines)
  - Inline edit form build (~200 lines)
  - No-change guard and response validation (~150 lines)
  - Payload diffing and server response parsing (~100 lines)
  - Tag/memo/title edit helpers (~100 lines)
- **Expected split:** 3–4 files (e.g., `editor-memory-save.js`, `editor-memory-edit-form.js`, `editor-memory-validation.js`)

#### Stage 2 — Split `modal_compute/app.py` route definitions
- **Action:** Move owner write routes to `owner_writes.py` route registration, keep only public read routes and middleware in `app.py`
- **Existing work:** Public read extraction already done. Owner route definitions remain inline.

#### Stage 3 — Reduce `editor-canvas.js` coordinator surface
- **Action:** Delegate `canEdit` gating, layout persistence coordination, and edge interaction setup further into sub-modules rather than keeping branching logic in the main coordinator

#### Stage 4 — Monitor `public_reads.py` growth
- **Action:** If it exceeds 800 lines, split legacy normalization to a dedicated `legacy_normalizer.py`

---

## Section 2: #2980 — Emotion-Flow Defer Status

> **Title:** Defer emotion-flow until core tree contracts are defined  
> **Status:** `DEFERRED` — core emotion_tags field exists but higher-level emotion-flow UX is on hold

### 2.1 Current State

The **emotion-flow** feature refers to a user experience where emotions (tagged on individual "Moment" memories) are visualized as a flow across the LoveTree over time, showing emotional progression. The issue documents that implementation should be deferred until core tree contracts (tree creation, node connection, layout) are fully stabilized.

#### What Is Already Implemented

**Database Layer (Production)**
- `memories.emotion_tags` column: `JSONB NOT NULL DEFAULT '[]'::jsonb`
- Schema defined in `scripts/migration-add-reactions-comments.sql` (line 25)

**Backend API Layer (Modal Compute)**

| Component | File | Status |
|-----------|------|--------|
| CREATE memory accepts `emotionTags` | `memory_writes.py:35-38, 43, 64` | ✅ Active — max 20 items, stripped, validated |
| UPDATE memory accepts `emotionTags` | `memory_writes.py:150-156` | ✅ Active — in `ALLOWED_UPDATE_FIELDS` |
| Public memory reads normalize `emotion_tags` | `public_reads.py:111, 150-156` | ✅ Active — camelCase + snake_case fallback |
| Legacy tree normalization handles old format | `public_reads.py:148-156` | ✅ Active — string→list conversion |
| Tag parsing utility | `validation.py:30-57` (`parse_tags()`) | ✅ Active — unique, flattened, cleaned |

**Frontend Editor Layer**

| Component | File | What It Does |
|-----------|------|-------------|
| Create memory form payload | `editor-memory-form-payload.js:205` | Sends `emotionTags` from comma-separated tag input |
| Edit/save memory action | `editor-memory-actions.js:250,327,393,490-493` | Reads current tags, sends update, verifies server response |
| Canvas node color indicator | `editor-canvas-node.js:96-97` | Shows first emotion tag as `#tagname` color |
| Detail UI tag rendering | `editor-detail-ui-builders.js:40` | Renders tag chips from `emotionTags` |
| Empty guide check | `editor-empty-guide-ui.js:38` | Checks if memory has emotion tags |
| Data loader normalization | `editor-data-loader.js:33` | Normalizes `emotionTags || emotion_tags` |
| Atlas preview panel | `editor-memory-atlas-preview-panel.js:354` | Collects tags from multiple field names |
| Detail sidebar status | `editor-detail-sidebar-status-boundary.js` | Uses tags in status rendering |
| Root helpers | `editor-root-helpers.js:47,64` | Checks emotion tag presence |
| Tree helpers | `editor-tree-helpers.js:58` | Initializes `emotionTags: []` |
| Data loader fallbacks | `editor-data-loader-fallbacks.js:77,263` | Normalizes in fallback paths |

#### What Is Deferred

| Component | Description | Reason |
|-----------|-------------|--------|
| **Emotion-flow visualization** | An interactive, visual flow of emotions across the tree timeline showing how tagged emotions change/evolve | Core tree contracts (node connection, layout stability) not yet fully stabilized |
| **Emotion analytics / insights** | Aggregated emotion patterns, most-frequent tags, emotional arc computation | Depends on emotion-flow visualization |
| **Timeline-based emotion rendering** | Color-coded emotional progression along the tree's temporal axis | Requires stable layout contracts |
| **Tree-level emotion summary** | Emotion tag aggregation at tree level (beyond simple `emotionTags` array in browse snapshots) | Requires emotion-flow UX definition |
| **Emotion tag search/filter** | Search memories by emotion tags across the tree | Tag search could impact DB schema (possible join table) |

### 2.2 Gap Analysis

| Gap | Severity | Detail |
|-----|----------|--------|
| Emotion-flow UX spec not written | **High** | No product spec exists for what emotion-flow looks like as a user-facing experience. Current tag functionality is basic CRUD only |
| Core tree contracts still evolving | **High** | Tree creation, node connection, layout persistence, and free/structured layout modes are still being iterated. Emotion-flow visualization cannot be built on unstable foundations |
| No deferred milestone defined | **Medium** | "Until core tree contracts are defined" is ambiguous. No specific milestone or trigger condition documented |
| Frontend tag UI is basic | **Low** | Tag input is comma-separated text with no autocomplete, color picker, or suggested tags. This is acceptable for MVP but insufficient for emotion-flow |
| Emotion tags max 20 items limit | **Low** | Current limit of 20 emotion tags per memory is reasonable. May need expansion for emotion-flow |
| API serialization hybrid | **Low** | Code handles both camelCase (`emotionTags`) and snake_case (`emotion_tags`). This is production-working but adds complexity |

### 2.3 Resolution Path

#### Phase 1 — Document deferral gate (Immediate)
- Define the specific gate condition: *"Emotion-flow unblocked when: (a) tree node layout persistence is stable in both structured and free modes, (b) tree create/fork/delete has 95%+ reliability in CI, (c) no open P0 layout bugs in production."*
- Track this gate in a project milestone or checklist, not just a one-line deferral note.

#### Phase 2 — Emotion-flow UX blueprint (When gate opens)
- Create a product spec document covering:
  - Visual emotion arc visualization (e.g., gradient path along tree edges)
  - Tag color mapping (user-assignable vs. auto-generated)
  - Emotion filter mode (view only memories with specific tags)
  - Timeline emotion breakdown
  - Emotion summary card in tree insights sidebar

#### Phase 3 — Infrastructure expansion (When gate opens)
- Evaluate if `emotion_tags` JSONB column needs a join table for efficient search/queries
- Add tag autocomplete in editor (suggest existing tags from same tree)
- Consider tag normalization (lowercase, deduplicate, trim)

---

## Section 3: #2863 — Shared Editing Roles Initial Assessment

> **Title:** Add shared LoveTree editing roles with revision-aware layout conflicts  
> **Status:** `NOT_STARTED` — current model is owner-only edit; no shared editing infrastructure exists

### 3.1 Current State

#### Permission Architecture (Frontend)

The current editing permission model is defined in `js/shared/tree-workspace-permission.js`:

```javascript
function resolveTreeWorkspaceCanEdit(tree, options) {
    if (!tree) return false;
    if (options && options.requestedReadOnly === true) return false;
    var currentUser = resolveAuthSessionUser();
    if (tree.viewerCanEdit === true) {
        return !!(currentUser && currentUser.uid && tree._viewerCapabilityAuthUid === currentUser.uid);
    }
    if (tree.viewerCanEdit === false) return false;
    if (!currentUser || !currentUser.uid) return false;
    var ownerId = resolveTreeOwnerId(tree);
    if (!ownerId) return false;
    if (ownerId !== currentUser.uid) return false;
    return true;
}
```

**Key observations:**
- Only tree **owner** (matching `ownerId` / `owner_id`) can edit
- A `viewerCanEdit` capability flag from the backend can override, but it is still scoped to the same UID
- `requestedReadOnly: true` (from `?readonly=1` URL param) can force read-only
- No role-based multi-user editing exists

#### `canEdit` Usage Map

| File | What it gates |
|------|---------------|
| `js/editor/editor-canvas.js` (21,40,59,134,140,145,147,207,209,269,393,431,445,450) | Node drag, layout storage read/write, edge operations, cursor mode, viewport controls |
| `js/editor/editor-canvas-layout-storage.js` | Layout persistence to localStorage (skip if read-only) |
| `js/editor/editor-canvas-interaction.js` | drag state initialization |
| `js/editor/editor-canvas-edges.js` | Edge creation affordance |
| `js/editor/editor-shell-startup.js` | `.editor-readonly` CSS class toggle |
| `js/editor/editor-memory-actions.js` | Edit/delete action affordances |
| `js/editor/editor.js` (229) | Calls `resolveTreeWorkspaceCanEdit` during tree load |
| `js/viewer/public-canvas-init.js` | Falls back to `canEdit: false` in read-only viewer |

#### Backend Permission Model

| Endpoint | Auth Check | Edit Scope |
|----------|-----------|------------|
| `POST /modal/private/trees` | `require_firebase_user` | Owner only |
| `PUT /modal/private/trees/{tree_id}` | `require_firebase_user` + owner fetch | Owner only |
| `DELETE /modal/private/trees/{tree_id}` | `require_firebase_user` + owner fetch | Owner only |
| `POST /modal/private/memories` | `require_firebase_user` + owner tree check | Owner only |
| `PUT /modal/private/memories/{memory_id}` | `require_firebase_user` + memory owner check | Owner only |
| `GET /modal/private/trees/{tree_id}/capability` | `require_firebase_user` | Returns `{viewerCanEdit: tree is not None}` |
| All public read endpoints | No auth or minimal auth | Read-only |

#### Layout Persistence Model

The layout persistence is currently **single-user localStorage only**:

- `localStorage.getItem('lovebud_tree_layout_v2_' + treeId)` — stores node positions
- `localStorage.getItem('lovebud_tree_layout_mode_' + treeId)` — stores layout mode (structured/free)
- `editor-canvas-layout-storage.js` routes through `canvasLayout.createLayoutStore(treeId)` when available (Modal-backed store), otherwise falls back to localStorage
- No revision tracking, conflict detection, or merge logic exists

### 3.2 Gap Analysis

#### Critical Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| No shared editor role model | **P0** | Current code has no concept of "editor," "viewer," or "contributor" roles. Everything is owner-or-nothing |
| No collaborator data model | **P0** | No DB schema for tree collaborators, invited users, or access grants. The `trees` table has `owner_id` only |
| No capability API for non-owners | **P0** | `/capability` endpoint checks only if the requesting user is the tree owner. No support for delegated access |
| Layout is localStorage-only | **P0** | Node positions are stored in browser localStorage per client. Multiple editors would each have their own layout state with no backend synchronization |
| No revision/version system | **P0** | No version tracking on tree data, memory data, or layout state. Conflict detection is impossible without revision IDs |
| No conflict resolution strategy | **P1** | Even if backend sync existed, there is no strategy for handling concurrent edits to the same memory or layout state |

#### Medium Gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| `canEdit` checks are scattered | **Medium** | 14+ usage sites in `editor-canvas.js` alone. Adding role support requires consolidating into a centralized permission check |
| Auth session dependency | **Medium** | `resolveTreeWorkspaceCanEdit` depends on `window.LoveTreeAuthPolicy` which is a global. Role system would need to decouple from auth-only checks |
| Editor readiness depends on tree owner fetch | **Medium** | The editor flow fetches the tree from owner endpoints. For non-owner editors, a different data path is needed |
| No permission change propagation | **Medium** | If a collaborator is added/removed while someone has the editor open, there's no real-time propagation mechanism |

### 3.3 Resolution Path

#### Stage 1 — Role & Data Model Definition (Design Phase)
- **Define roles:**
  - **Owner** (current: full control, can delete tree, manage collaborators)
  - **Editor** (can add/edit/delete memories, modify layout)
  - **Contributor** (can add memories only, cannot delete or modify layout)
  - **Viewer** (read-only, current public/public-shared behavior)
- **DB schema additions:**
  ```sql
  CREATE TABLE tree_collaborators (
      tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
      user_id VARCHAR(128) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'editor',  -- editor, contributor
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      invited_by VARCHAR(128) NOT NULL,
      PRIMARY KEY (tree_id, user_id)
  );
  ```
- **API additions:**
  - `POST /modal/private/trees/{tree_id}/collaborators` — invite a collaborator
  - `DELETE /modal/private/trees/{tree_id}/collaborators/{user_id}` — remove collaborator
  - `GET /modal/private/trees/{tree_id}/capability` — extended return includes role
  - `PUT/POST/DELETE /modal/private/memories` — check collaborator role (not just owner)

#### Stage 2 — Revision-Aware Layout Foundation (Backend)
- **Introduce layout revision tracking:**
  - Add `layout_revision` column to `trees` table (integer, default 0, increment on each layout save)
  - Create a `tree_layouts` table for server-side layout persistence (optional, or use existing Modal layout store)
- **Conflict detection primitive:**
  - Save request includes `expected_revision` (client's known revision)
  - Backend rejects save if `expected_revision < current_revision` (optimistic concurrency)
  - Returns `409 Conflict` with current revision and current layout state

#### Stage 3 — Editor `canEdit` Centralization (Frontend)
- **Create a centralized permission module** rather than scattered `canEdit` checks:
  ```javascript
  window.LoveBudEditorPermission = {
      canEdit: function() { ... },         // resolved from role + capability
      canDelete: function() { ... },       // owner only
      canManageCollaborators: function() { ... }, // owner only
      currentRole: function() { ... }      // 'owner' | 'editor' | 'contributor' | 'viewer'
  };
  ```
- **Consolidate `canEdit` in editor-canvas.js** — reduce 14+ inline checks to a single centralized call
- **Gate layout persistence on role** — only owner and editor can persist layout

#### Stage 4 — Multi-Editor Layout Conflict Resolution (Advanced)
- **Layout sync mechanism:**
  - Editor periodically pushes layout state to backend (debounced, ~2s)
  - On conflict (revision mismatch), editor receives current state + diff
  - Use last-write-wins for position data; surface conflict UI for structural changes
- **Layout merge strategy:**
  - Position data: last-write-wins (acceptable for visual layout)
  - Edge connect/disconnect: operational-transform style merge or lock during edit
  - Node add/delete: owner-only to prevent structural conflicts
- **UI feedback:**
  - Toast notification when another editor modifies the tree
  - Visual indicator of which nodes are currently being edited by someone else
  - "Layout updated" banner when conflict resolution auto-merges

---

## Appendix: Cross-Cutting Dependencies & Sequencing

### Dependency Graph

```
#2863 Shared Editing Roles
  ├── Needs #3086 editor-canvas.js canEdit consolidation (Stage 3 of #2863 blocks on Stage 1-3 of #3086)
  └── Independent of #2980

#3086 Oversized Modules Refactoring
  ├── Independent of #2980
  └── Independent of #2863 (though #2863 benefits from cleaner modules)

#2980 Emotion-Flow Defer
  └── Gate: Core tree contracts stable (partially overlaps with #2863 layout revision work)
```

### Recommended Execution Sequence

1. **Now (Docs/Planning Phase):**
   - ✅ This document is the artifact
   - #3086 Stage 1: Create `editor-memory-actions.js` decomposition audit

2. **Sprint 1–2:**
   - #3086 Stage 2: Split `modal_compute/app.py` route definitions
   - #2863 Stage 1: Define role data model + DB migration (schema only, no frontend changes yet)

3. **Sprint 3–4:**
   - #3086 Stage 3: Reduce `editor-canvas.js` coordinator surface
   - #2863 Stage 2: Backend revision tracking + API endpoint for collaborator management

4. **Sprint 5–6:**
   - #2863 Stage 3: Centralize `canEdit` in frontend permission module
   - #2863 Stage 4: Minimum viable multi-editor support (editor role only, no conflict resolution)

5. **Future Gate:**
   - #2980 triggered when core tree contracts are stable and no P0 layout bugs exist
   - #2863 Stage 4: Full conflict resolution when multi-editor usage warrants it
