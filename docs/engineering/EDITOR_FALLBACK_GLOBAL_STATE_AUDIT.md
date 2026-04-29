# Editor Fallback and Global State Audit

**Status:** Audit plan / implementation preflight
**Owner:** CTO / Engineering Lead
**Scope:** Editor fallback factories, `window.currentTreeMemories`, and `window.currentTreeData`
**Related:** Issue #225

---

## 1. Purpose

This document inventories the current Editor fallback and global-state surfaces that must be audited before any implementation cleanup.

The current PR is docs-only. It does not change runtime behavior, script order, editor globals, fallback selection, data loading, cache behavior, or page markup.

---

## 2. Non-goals and hard boundaries

Do not combine this audit with implementation work.

Forbidden in an audit-only PR:

- changing `js/editor.js`;
- changing files under `js/editor/**`;
- changing `pages/editor.html`;
- changing Editor runtime behavior;
- implementing `EditorStore` or an equivalent store;
- removing fallback factories;
- renaming public browser globals;
- changing `window.currentTreeMemories` or `window.currentTreeData` semantics;
- touching PR #319;
- touching PR #7 or prototype/reference/demo/variant paths.

---

## 3. Current runtime shape

`js/editor.js` acts as the Editor entry orchestrator. It prefers extracted helper modules when their browser globals exist, and falls back to inline or fallback-factory implementations when those globals are missing.

Relevant current surfaces:

- `window.LoveBudEditorDataLoader`
- `window.LoveBudEditorDataLoaderFallbacks`
- `window.LoveBudEditorTreeHelpers`
- `window.LoveBudEditorPageHelpers`
- `window.LoveBudEditorShellHelpers`
- `window.LoveBudEditorResolverFallbacks`
- `window.currentTreeMemories`
- `window.currentTreeData`
- compatibility aliases such as `window.refreshMemories` and `window.updateDetailPanel`

The intended migration path is not immediate removal. The safe path is inventory, read/write classification, smoke coverage, then a separately approved implementation PR.

---

## 4. Fallback factory candidate inventory

### 4.1 `createInlineLoadInitialTreeFallback`

Current role:

- Provides an async tree loader when `window.LoveBudEditorDataLoader.loadInitialEditorTree` is unavailable.
- Reads `urlTreeId`, `apiClient`, `createDefaultTreeTitle`, and confirmed session user helper from options.
- Attempts `apiClient.getTree(requestedTreeId)` for URL-scoped editor loads.
- Attempts `apiClient.getFirstTree()` and optionally `apiClient.createTree()` for default editor loads.
- Returns `{ tree, isNewTree, treeLoadStatus, treeLoadErrorMessage, authRequired }`.

Audit questions:

- Is the fallback still reachable in supported script order, or is it only defensive compatibility?
- Does fallback error classification still match current API error wording?
- Does default tree creation still belong in a fallback path, or should fallback creation be explicitly documented as compatibility-only?
- Does `authRequired` detection align with current Firebase/Auth bootstrap behavior?

Implementation gate before change:

- Confirm the primary loader and fallback return shape are identical for all tree-load branches.
- Confirm URL tree loading, no-tree creation, auth-required, access-denied, API-unavailable, and generic-error branches are covered by browser smoke or targeted tests.

### 4.2 `createInlineNormalizeMemoryFallback`

Current role:

- Provides a local memory normalizer when shared normalization is unavailable.
- Converts snake_case and camelCase memory fields into the editor-facing shape.
- Supplies defaults for fields such as `memo`, `visibility`, `sourceType`, `emotionTags`, `createdAt`, and `updatedAt`.

Audit questions:

- Is its output still equivalent to `window.LoveBudNormalize.normalizeMemory` for Editor-required fields?
- Are `visibility`, `parentId`, `treeId`, media fields, and timestamp fields normalized consistently with API_CONTRACT.md?
- Which downstream consumers depend on fallback-only defaults?

Implementation gate before change:

- Add fixture-based comparison between shared normalization and fallback normalization before removing or narrowing this path.
- Confirm Editor canvas, detail panel, add-memory form, edit form, and detail navigation still receive stable normalized fields.

### 4.3 `createInlineLoadEditorMemoriesFallback`

Current role:

- Loads cached memories from `window.LoveBudCache` when available.
- Loads API memories through `apiClient.getMemoriesByTree(treeId)` when available.
- Writes normalized memories into `window.currentTreeMemories`.
- Returns `{ memories, normalizedMemories, cachedMemories }`.

Audit questions:

- Is cache-first display still intended for Editor, or should stale cache behavior be constrained before store migration?
- Are 401/403 warnings still correct for the current private/public policy?
- Are all writes to `window.currentTreeMemories` deliberate and centralized enough to migrate?

Implementation gate before change:

- Verify cache-hit, API-hit, API-failure, empty-tree, and permission-error branches.
- Preserve exact return shape or update all consumers in the same implementation PR.

### 4.4 `createInlineRefreshMemoriesFallback`

Current role:

- Provides `refreshMemories()` when `window.LoveBudEditorDataLoader.createRefreshMemories` is unavailable.
- Calls `apiClient.getMemoriesByTree(treeId)`.
- Normalizes and writes refreshed memory data into `window.currentTreeMemories`.
- Calls `onMemoriesUpdated(window.currentTreeMemories)`.

Audit questions:

- Which code paths call `window.refreshMemories` as a compatibility alias?
- Is refresh expected to update cache, or only in-memory editor state?
- Does every mutation path call refresh or otherwise keep canvas/detail/sidebar synchronized?

Implementation gate before change:

- Confirm add, edit, delete, visibility update, and manual refresh paths preserve canvas/detail/sidebar consistency.
- Keep the `window.refreshMemories` alias until all external callers are proven migrated.

---

## 5. `window.currentTreeMemories` read/write audit plan

### Known write classes

- Initial memory load writes normalized cached/API memories.
- Refresh memory load writes normalized API memories.
- Memory mutation flows may update or depend on refreshed memory state through Editor memory actions.

### Known read classes

- `treeMemories()` reads `window.currentTreeMemories`, normalizes again, and filters falsey values.
- Root resolution uses `treeMemories()`.
- Canvas initialization and redraw use `treeMemories()`.
- Detail panel lookup uses `treeMemories()`.
- Add-memory parent selection uses `treeMemories()` and selected node state.
- Sidebar status and empty-guide state depend on `treeMemories().length`.

### Audit method

Use this checklist before any implementation PR:

1. Search exact reads: `window.currentTreeMemories`, `currentTreeMemories`, and `treeMemories()`.
2. Classify every occurrence as read, write, alias exposure, test fixture, or historical documentation.
3. Record whether the occurrence is in entry orchestration, data loading, canvas, detail UI, memory actions, i18n refresh, tests, or docs.
4. Identify synchronous assumptions: code expecting the array to be available immediately after load or refresh.
5. Identify mutation assumptions: code mutating the array in place versus replacing it wholesale.
6. Confirm external compatibility: any global callers using `window.refreshMemories` must continue to work.

### Migration target behavior

Any future store must preserve these observable behaviors until a separate deprecation plan exists:

- `window.currentTreeMemories` remains readable as an array.
- Refresh replaces the visible memory set atomically from the perspective of canvas/detail updates.
- Empty-tree behavior remains stable.
- Root memory selection remains stable.
- Permission/API failures do not blank an already usable cached state unless explicitly approved.

---

## 6. `window.currentTreeData` read/write audit plan

### Known write classes

- `syncCurrentTreeData(tree)` writes tree data and defaults missing `visibility` to `public`.
- Tree visibility update writes merged updated tree data back into `window.currentTreeData`.

### Known read classes

- Sidebar visibility state reads `window.currentTreeData?.visibility`.
- Detail UI receives `getCurrentTreeData: () => window.currentTreeData || {}`.
- Visibility toggle logic depends on `public` vs non-public state.

### Audit method

Use this checklist before any implementation PR:

1. Search exact reads: `window.currentTreeData`, `currentTreeData`, and `syncCurrentTreeData`.
2. Classify each occurrence as initial sync, mutation sync, UI read, detail read, test fixture, or documentation.
3. Confirm default visibility behavior and public-first product policy are preserved.
4. Confirm tree identity, title, owner fields, and visibility remain available to detail/sidebar consumers.
5. Confirm visibility updates preserve stale-field behavior intentionally rather than accidentally dropping fields.

### Migration target behavior

Any future store must preserve these observable behaviors until compatibility aliases are explicitly retired:

- `window.currentTreeData` remains readable by existing Editor detail/sidebar code.
- Missing visibility defaults to `public` at the same boundary as today.
- Visibility toggle UI updates immediately after successful API update.
- Detail panel receives the same tree object shape as before migration.

---

## 7. EditorStore or equivalent migration criteria

Do not implement a store until all criteria below are satisfied.

Minimum criteria:

- Complete read/write inventory for `window.currentTreeMemories` and `window.currentTreeData`.
- Stable public API for the store is documented before code changes.
- Compatibility aliases are specified in writing.
- Fallback factory return shapes are preserved or intentionally migrated with tests.
- Browser smoke matrix is executed before and after implementation.
- Rollback path is clear: restoring current globals must be possible without data loss.

Candidate store API, for planning only:

```text
getTree()
setTree(tree)
getMemories()
setMemories(memories)
refreshMemories()
subscribe(listener)
```

This API is not approved for implementation by this document. It is a planning vocabulary for later review.

---

## 8. Compatibility alias preservation rule

Until a separate deprecation PR is approved, preserve these browser-visible aliases:

- `window.currentTreeMemories`
- `window.currentTreeData`
- `window.refreshMemories`
- `window.updateDetailPanel`
- existing `window.LoveBudEditor*` module globals

A future implementation may route these aliases through a store, but it must not remove them in the same step that introduces the store.

Required compatibility rule:

1. First implementation PR may introduce an internal store and keep aliases live.
2. Second PR may migrate internal reads/writes away from direct globals while aliases remain live.
3. Alias removal, if ever needed, requires separate inventory, browser smoke, and explicit CTO approval.

---

## 9. Browser smoke matrix before implementation

Run this matrix before any implementation PR that changes fallback factories or global-state handling.

| Area | Scenario | Expected result |
|------|----------|-----------------|
| Auth gate | Logged-out direct `/pages/editor.html` | Login redirect or authorized blocker path remains unchanged |
| Existing tree | Logged-in direct editor load with first tree | Tree loads, canvas renders, detail empty/selected state works |
| URL tree | `/pages/editor.html?treeId=<id>` | Requested tree loads or documented access-denied/not-found UI appears |
| Empty tree | Account with no memories | Empty guide and first-memory path remain usable |
| Add memory | Create first/child memory | Canvas, sidebar count, detail panel, and save status update |
| Edit memory | Edit title/memo/tags | Detail panel and canvas labels remain synchronized |
| Delete memory | Delete selected memory | Selection, empty state, and canvas redraw remain consistent |
| Refresh alias | Call `window.refreshMemories()` from console | Memory state refreshes without fatal error |
| Tree data alias | Inspect `window.currentTreeData` after load | Tree object and visibility are available |
| Memory alias | Inspect `window.currentTreeMemories` after load | Array of normalized memory objects is available |
| Visibility | Toggle tree public/private where authorized | Sidebar button state and detail tree status update |
| API unavailable | Simulate failed tree/memory API | Existing error UI/toast behavior remains unchanged |

Browser verification should use the project URL provenance rules and fixed test slot policy when runtime/auth/API behavior must be verified.

---

## 10. Completion checklist for this audit PR

- [ ] New audit document added under `docs/engineering/`.
- [ ] Engineering index links the audit document.
- [ ] Top-level document index links the audit document.
- [ ] No runtime, JS, CSS, page, API, or test file changed.
- [ ] No fallback implementation changed.
- [ ] No `EditorStore` or equivalent implementation added.
- [ ] PR #319 untouched.
- [ ] PR #7 untouched.

---

## 11. Related documents

- [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md)
- [SCRIPT_LOAD_ORDER.md](./SCRIPT_LOAD_ORDER.md)
- [API_CONTRACT.md](./API_CONTRACT.md)
- [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./BROWSE_FILTER_VS_PUBLICATION_GUARD.md)
- [../ops/BROWSER_VERIFICATION_URL_POLICY.md](../ops/BROWSER_VERIFICATION_URL_POLICY.md)
- [../ops/TEST_PREVIEW_SLOTS.md](../ops/TEST_PREVIEW_SLOTS.md)
