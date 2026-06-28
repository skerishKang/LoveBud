# Tree Visibility Default and Control Placement Decision

**Date**: 2026-06-28
**Status**: Decided
**Authors**: LoveBud team
**Refs**: #2935, #2934, #2882, #1882

---

## 1. Decision Summary

New trees are **private by default**. Visibility can be changed to public via Tree Settings surfaced through the My Trees card or editor tree context. There is no per-memory granularity — visibility is a tree-level property. Existing public trees are not migrated.

---

## 2. Current-State Audit Table

| Dimension | Current Behavior |
|---|---|
| **Create default** | `visibility: 'public'` set explicitly in `my-trees-actions.js` (modal submit, API call, demo fallback) and `editor-data-loader.js` (auto-create first tree) |
| **API/storage field** | `tree.visibility` — values `'public'` \| `'private'`. Unset/null defaults to `'public'` in `editor-detail-tree-meta.js` and `editor-tree-helpers.js` |
| **Browse eligibility** | `public-tree-adapter.js:158` and `browse-prefetch.js:58` filter to `visibility === 'public'`. Browse surfaces only public trees |
| **Viewer/share behavior** | Public viewer (`detail.html`) renders any tree the viewer has access to. Share routes (`share-actions.js`) use `LoveBudVisitorViewerData` populated server-side. Public viewer canvas `updateTreeVisibility` is a no-op |
| **My Trees badge/card** | `my-trees-filter.js` uses filter chips: `tree.visibility === 'public'` for public, `!== 'public'` for private. Visibility is included in search text. `my-trees-actions.js` has `toggleTreeVisibility()` calling `apiClient.updateTree(treeId, { visibility })` |
| **Editor tree context / right panel** | `editor-detail-tree-meta.js` reads `window.currentTreeData?.visibility` and builds a public/private badge with `updateTreeVisibility()` on click. `editor-sidebar-ui.js` also calls `updateTreeVisibility()`. **Guard**: sidebar shows `"공개 순간이 3개 이상일 때만 이 트리를 공개할 수 있어요."` on 409 server rejection |
| **Memory-level visibility** | `memory.visibility` exists (defaults to `'public'`). Editor loads all memories for owner regardless of visibility. Viewer/search filter to `visibility === 'public'` only |
| **Memory Atlas strictest** | Derived/deduped nodes are public only when ALL contributing memories are public (`docs/product/lovebud-memory-atlas-strictest-visibility-fix-note.md`) |

---

## 3. Chosen Policy

### New Tree Default: Private

New trees are created with `visibility: 'private'`. This applies to:
- Modal form submit in `my-trees-actions.js`
- API tree creation call in `my-trees-actions.js`
- Demo/fallback tree creation in `my-trees-actions.js`
- Auto-creation of first tree in `editor-data-loader.js`

The server-side write path must also accept and persist `visibility: 'private'` as the default when no explicit value is provided.

### Legacy `memory.visibility` Bridge Rule

The product treats **tree visibility as the publication state** (tree-level). The legacy `memory.visibility` field remains in storage and filtering paths but is a separate data attribute.

- A newly created private-default tree must not leak to Browse or public share/viewer routes, even if its internal memories carry legacy `visibility: 'public'`.
- When publishing a tree to public, the API slice must explicitly reconcile the 3-public-moments guard with the legacy memory visibility field — i.e., define whether the guard counts moments with `memory.visibility === 'public'` or moments belonging to a public tree.
- This decision does **not** perform memory visibility migration or data rewrite. The API consistency slice (Slice B) is responsible for validating and documenting the reconciliation.

> The user-facing statement is: **“The published state is tree-level. Legacy memory visibility will be reconciled in the API consistency slice.”**

### Existing Public Tree Non-Migration

Existing trees with `visibility: 'public'` are **not migrated**. Their current state is preserved. A future migration slice may address the population of private trees that were mistakenly created as public, but that is out of scope for this decision.

---

## 4. Primary Control / Secondary Display

### Primary Control: Tree Settings (My Trees card + editor tree context)

The primary surface for changing a tree's visibility is **Tree Settings**, reachable via:

- **My Trees card** → context menu or card action → Tree Settings
- **Editor tree context** → tree meta block → Tree Settings entry

Tree Settings is defined as the surface that manages the tree as a whole, including its visibility. This is the only place where a user can publish (make public) or unpublish (make private) a tree.

The editor **selected-moment right panel does not contain a visibility toggle**. The right panel manages moment-level metadata (emotions, tags, content), not tree-level properties.

### Secondary Display: Status Indicators

The following surfaces **display** the current visibility state but do not contain interaction controls:

- **My Trees card**: shows public/private badge or chip
- **Editor tree context**: shows green (public) or gray (private) badge/icon
- **Editor header**: may show a status indicator (not a control)

Display-only surfaces may include a **"Go to Tree Settings"** link when the user needs to change visibility.

---

## 5. Owner Permission Boundary

Only the **tree owner** can change visibility. There is no co-owner or editor-level permission for visibility changes in the current system.

Share recipients (via `detail.html?id=...&tree=...` links) receive read-only access to public trees and cannot change visibility.

---

## 6. Publish / Private Confirmation Copy Requirements

When a user attempts to change a private tree to public, the system must present a confirmation that communicates:

1. **"This tree will be discoverable in Browse."** — users must understand the tree becomes publicly listed.
2. **"Existing share links will work for anyone with the link."** — existing share recipients retain access.
3. **"The published state is tree-level. Legacy memory visibility will be reconciled in the API consistency slice."** — no per-moment granularity; legacy memory visibility is a separate data field that will be reconciled later.

> **Note on existing share link behavior**: Client code alone cannot confirm private/public share authorization outcomes. The publish/private transition effects on Browse visibility, existing share link access, and unauthorized responses are gated on **Slice C server-side verification**. Before that gate passes, the UI must not guarantee “existing links will immediately open/close for everyone.” The confirmation copy reflects intended behavior, subject to server-side authorization invariants.

When changing public to private:
1. **"This tree will no longer appear in Browse."**
2. **"Existing share links will stop working for unauthorized users."** — subject to Slice C server-side verification.

---

## 7. Explicit Non-Goals

This decision does **not** include:

- Per-memory or per-moment visibility granularity
- Co-owner or editor-level visibility permissions
- Migration of existing public trees to private
- Changes to the Memory Atlas strictest-visibility rule
- Browse filtering UI changes beyond what is already implemented
- Search index visibility changes

---

## 8. Follow-Up Implementation Slices

The following slices are identified for future implementation and are gated on this decision:

### Slice A: Control UI (Tree Settings surface)
Implement or connect the Tree Settings surface accessible from My Trees card and editor tree context. Tree Settings panel contains:
- Visibility toggle (private ↔ public)
- Confirmation dialog with copy from Section 6 above
- Server-side `updateTree` call with `{ visibility }`

### Slice B: API Mutation Behavior
Ensure the API write path (`apiClient.updateTree`) correctly persists `visibility` changes and enforces the minimum 3 public moments guard (currently enforced server-side, returns 409 on violation).

### Slice C: Browse/Share Consistency
Verify that after publishing, the tree appears in Browse within the expected propagation window, and that share links immediately become functional for public trees.

### Slice D: Editor Right Panel Display-Only Alignment
Confirm the editor selected-moment right panel does not render a visibility toggle. Display the current tree visibility state with a "Manage in Tree Settings" link if the owner needs to change it.

---

## Appendix: Key File References

| File | Role |
|---|---|
| `js/my-trees-actions.js` | Tree create (visibility: 'public' default), `toggleTreeVisibility()` |
| `js/editor/editor-detail-tree-meta.js` | Tree meta badge display, `updateTreeVisibility()` |
| `js/editor/editor-sidebar-ui.js` | Sidebar visibility toggle + 3-public-moment guard |
| `js/editor/editor-tree-helpers.js` | `visibility` field defaulting |
| `js/api/public-tree-adapter.js:158` | Browse public-tree filter |
| `js/browse-prefetch.js:58` | Browse prefetch public filter |
| `js/viewer/viewer-data-loader.js:16` | Viewer memory public filter |
| `js/search/search-data-adapter.js:92` | Search memory public filter |
| `js/my-trees-filter.js:56-61` | My Trees public/private filter chips |
| `docs/product/lovebud-memory-atlas-strictest-visibility-fix-note.md` | Derived-node privacy rule |
| `docs/product/lovebud-browse-final-social-sort-labels-decision.md` | Sort=views/likes only public trees |