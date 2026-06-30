# Editor Entry Orchestrator Reduction Audit

## Audit Scope

- **Issue**: #3088
- **Parent**: #3086, #1882
- **Protected**: #2960 (detail panel tree context), #2856 (growth affordance), #3070 (save completion), #3084 (knowledge-link core)
- **Runtime (this audit PR)**: No changes
- **Documentation only (this audit PR)**
- **Next implementation PR**: Required to specify allowed runtime files and immutability invariants (see §9)

## 1. Base SHA

- **Current main**: `e8ceaa6d1add95eb11d415d8d4885eba80955211`
- **Previous plan**: `755c770` (EDITOR_ENTRY_ORCHESTRATOR_REDUCTION_PLAN.md)
- **Remote HEAD**: `origin/main` = `e8ceaa6d1`
- **No open PRs**: only #2960 (protected), #2856 (protected) are open
- **No pending changes** on `main`

## 2. Current `js/editor.js` Responsibility Cluster Map

### 2.1 Bootstrap / dependency readiness

- `DOMContentLoaded` listener — single entry point
- `resolveEditorEntryDependencies()` — main dependency resolution from `window.LoveBudEditorEntryDependencies`
- `entryDependenciesResult.status` — if `'stopped'` → early return
- `deps` = result from `resolveEditorEntryDependencies()` — ~40+ named deps

### 2.2 Editor shell and module resolution

- `applyEditorShellCopy(deps.safeI18nText, deps.i18n)` — i18n shell copy application
- `prepareEditorShell({...})` — shell preparation with i18n, text, href
- `markEditorReady` — readiness marker
- `applyEditorEditabilityState({ canEdit })` — editability state
- `createEditorDomRefs()` — DOM ref creation
- `createEditorStartDependencyGuard`, `createEditorStartDependencyChecker`, `createEditorRequiredGlobalWaiter`, `createEditorStartupShellApplier`, `createEditorCanvasEmptyGuideUpdater`, `createEditorSelectNodeHandler`, `createEditorSidebarStatusUpdater`, `createEditorInitialMemoryProvider`, `createEditorNextMemoryIdProvider`, `createEditorInitialSelectionApplier`, `createEditorReadyFinalizer` — all from `deps.shellHelpers.*`

### 2.3 Data load orchestration

- `runEditorInitialLoadFlow({...})` — data load orchestrator
- `editorDataLoader` — data loading coordination
- `syncCurrentTreeData`, `syncTreeId`, `normalizeMemory`, `treeMemories` — data sync
- `editorTreeHelpers` — `createInitialMemory`, `nextMemoryIdFromMemories`
- `createEditorStartupDependencyWaiter` — data load wait
- `getMemoryActions`, `setCachedMemories` — memory state
- `canonicalRootId`, `selectedNodeId`, `currentEditingMemory`, `editorCanvas`, `memoryActions` — state tracking

### 2.4 State bridge

- `treeMemories()` — memory list
- `currentTreeData` — window.currentTreeData (state)
- `currentTreeMemories` — window.currentTreeMemories (state)
- `saveStatusData` — save status state
- `isLocalSaveMode` — local save flag
- `canEdit` — editability
- `effectiveCanEdit` — resolved editability
- `selectedNodeId` — active node
- `currentEditingMemory` — active memory

### 2.5 Canvas / detail / form / action wiring

- `createEditorDetailUI({...})` — detail UI creation with `canvas`, `detailPanel`, `i18n`, `treeMemories`
- `createEditorCanvas({...})` — canvas creation with `canvas`, `svg`, `getTreeMemories`, `onNodeClick`, `onDisconnectEdge`
- `createEditorMemoryActions({...})` — memory actions with `enterEditMode`, `exitEditMode`, `saveMemoryEdit`, `deleteMemory`, `disconnectMemory`, `connectMemory`, `validateConnectCandidate`
- `createEditorMemoryForm({...})` — memory form with `showAddMemoryForm`, `hideAddMemoryForm`, `addMemoryFromForm`, `addMemoryFromScoutPayload`
- `createSidebarTreeActionsUpdater`, `createEditorSidebarStatusUpdater`, `createEditorCanvasEmptyGuideUpdater`, `createEditorSelectNodeHandler`, `createEditorStartDependencyChecker`, `createEditorStartupDependencyWaiter`, `createEditorRequiredGlobalWaiter`, `createEditorInitialMemoryProvider`, `createEditorNextMemoryIdProvider`, `createEditorInitialSelectionApplier`, `createEditorReadyFinalizer`

### 2.6 Save refresh / navigation coordination

- `createEditorRefreshSaveRuntime({...})` — save refresh runtime with `saveStatusData`, `updateSaveStatus`, `calcPosition`, `drawBranch`, `drawNode`, `initCanvas`
- `refreshSaveRuntime.status` — if `'stopped'` → early return
- `updateCanvasEmptyGuide` — empty guide update
- `editorCanvas.__editorCanvasInstance` — canvas bridge

### 2.7 Auth/Shell preparation

- `registerEditorAuthStart` — auth registration
- `getConfirmedSessionUser`, `redirectToEditorLogin`, `readConfirmedAuthCache`, `showToast`, `buildTreeLoadErrorCopy`, `renderTreeLoadError`
- `LoveBudEditorInteractionMode` — mode toggle (desktop/editor)

## 3. Script Order and `window.LoveBudEditor*` Global Dependency Ownership

### Script load order (in pages/editor.html)

```
1. js/i18n/i18n.js → LoveBudLocale, t()
2. js/i18n.js → i18n
3. js/postgres-client.js → apiClient
4. js/auth.js → getConfirmedAuthUser, registerOnAuthReady
5. js/editor/editor-auth-helpers.js → LoveBudEditorAuthHelpers
6. js/editor/editor-helpers.js → LoveBudEditorHelpers
7. js/editor/editor-root-helpers.js → LoveBudEditorRootHelpers
8. js/editor/editor-shell-helpers.js → LoveBudEditorShellHelpers
9. js/editor/editor-tree-helpers.js → LoveBudEditorTreeHelpers
10. js/editor/editor-entry-dependencies.js → LoveBudEditorEntryDependencies
11. js/editor/editor-page-helpers.js → LoveBudEditorPageHelpers
12. js/editor/editor-data-loader.js → LoveBudEditorDataLoader
13. js/editor/editor-detail-ui.js → createEditorDetailUI
14. js/editor/editor-canvas.js → createEditorCanvas
15. js/editor/editor-memory-actions.js → createEditorMemoryActions
16. js/editor/editor-memory-form.js → createEditorMemoryForm
17. js/editor/editor-save-status-orchestration.js → LoveBudEditorSaveStatusOrchestration
18+ Others (interaction, layout, node, viewport, rename)
```

**Key**: `js/editor/editor-entry-dependencies.js` must be loaded BEFORE `js/editor.js` because `editor.js` calls `window.LoveBudEditorEntryDependencies.resolveEditorEntryDependencies()` synchronously at DOMContentLoaded.

### `window.LoveBudEditor*` surface ownership

| Global | Owner File | Responsibility |
|--------|-----------|--------------|
| `LoveBudEditorEntryDependencies` | `editor-entry-dependencies.js` | Entry resolution |
| `LoveBudEditorShellHelpers` | `editor-shell-helpers.js` | Shell helpers |
| `LoveBudEditorDataLoader` | `editor-data-loader.js` | Data loading |
| `LoveBudEditorDataLoaderFallbacks` | `editor-data-loader-fallbacks.js` | Fallback resolution |
| `LoveBudEditorResolverFallbacks` | `editor-entry-fallbacks.js` | Resolver fallback |
| `LoveBudEditorUtils` | `editor-root-helpers.js` | Root utilities |
| `LoveBudEditorHelpers` | `editor-helpers.js` | General helpers |
| `LoveBudEditorSaveStatus` | `editor-save-status.js` | Save status |
| `LoveBudEditorPageHelpers` | `editor-page-helpers.js` | Page helpers |
| `LoveBudEditorTreeHelpers` | `editor-tree-helpers.js` | Tree helpers |
| `LoveBudEditorBindings` | `editor-bindings.js` | Bindings |
| `LoveBudEditorDataLoader` | `editor-data-loader.js` | Data loader |
| `LoveBudEditorAuthHelpers` | `editor-auth-helpers.js` | Auth helpers |

## 4. Entry-Only Composition vs Canvas/Detail/Form/Action Behavior

### Entry-only (js/editor.js only)

- Bootstrap gate (`DOMContentLoaded` listener)
- Dependency resolution (`resolveEditorEntryDependencies` → `deps`)
- 20+ typeof guards for missing `deps.*`
- Shell copy application (`applyEditorShellCopy`)
- Auth registraration (`registerEditorAuthStart`)
- Shell preparation (`prepareEditorShell`)
- `reportEditorBootstrapMissingDependency` — error reporting
- `reportEditorBootstrapMissingList` — missing list

### Delegated (moved to helper modules)

- **Canvas**: `createEditorCanvas`, `editor-canvas.js` (canvas, svg, interaction, layout)
- **Detail UI**: `createEditorDetailUI`, `editor-detail-ui.js` (panel, tree-meta, channel-link, inline-edit)
- **Form**: `createEditorMemoryForm`, `editor-memory-form.js` (form, payload, preview, time)
- **Actions**: `createEditorMemoryActions`, `editor-memory-actions.js` (enter/exit edit, save, delete, disconnect, connect)
- **Data loading**: `editorDataLoader`, `editor-data-loader.js` (fallbacks, data loading)
- **Auth**: `registerEditorAuthStart`, `auth.js` (auth flow)
- **Save/refresh**: `createEditorRefreshSaveRuntime`, `editor-save-status-orchestration.js` (save status, refresh, save status orchestration)
- **Memory actions**: `createEditorMemoryActions`, `editor-memory-actions.js`
- **Memory form**: `createEditorMemoryForm`, `editor-memory-form.js`
- **Scout**: `scoutDraftUI`, `scout-draft-ui.js`
- **Interaction mode**: `LoveBudEditorInteractionMode`, `editor-interaction-mode.js`
- **Relationship hints**: `relationshipHintsUIController`, `relationship-hints-ui-controller.js`

## 5. Current Shell-Helper Aggregation and Alias Status

### Alias removal status (from previous audits)

- **helper method aliases**: 20/20 removed ✅
- **direct deps function aliases**: 11/11 removed ✅
- **namespace deps aliases**: 14/14 removed ✅
- **remaining**: `const X = deps.X;` patterns in `editor.js` (all clean direct deps)

### Current `const X = deps.X;` patterns in `editor.js`

All 15+ remaining `const X = deps.X;` are clean **direct property reads** from the `deps` object. No `shellHelpers` namespace involved anymore.

### Contract test coverage for aliases

- `tests/contracts/editor-post-bootstrap-alias-inventory-contract.test.cjs` — verifies `expectedNamespaceAliases` = 0
- `tests/contracts/editor-canvas-interaction-helpers-removal-readiness-contract.test.cjs` — verifies interaction helper removal

### `shellHelpers` namespace current location

| Aspect | Detail |
|--------|--------|
| Read from (`window.LoveBudEditorShellHelpers`) | `editor-entry-dependencies.js:25` |
| Wired into `deps` as `deps.shellHelpers` | `editor-entry-dependencies.js:142` (object spread) + lines 54–186 (individual factory extractions) |
| Consumed in `editor.js` via `deps.shellHelpers.X` | `editor.js:43–92` (10 factory consts) |
| Owner file | `js/editor/editor-shell-helpers.js` (exports `window.LoveBudEditorShellHelpers`) |
| Compatibility boundary owner | `editor-entry-dependencies.js` (reads `window.LoveBudEditorShellHelpers`, wraps into `deps.shellHelpers` — isolates `editor.js` from the window surface) |
| Future slice: maintained global surface | `window.LoveBudEditorShellHelpers` until this extraction PR replaces it with `LoveBudEditorShellStartup` |
| Future slice: changed global surface | `deps.shellHelpers.X` → `deps.X` in both `editor-entry-dependencies.js` and `editor.js`; `window.LoveBudEditorShellHelpers` → `window.LoveBudEditorShellStartup` |

## 6. First Extraction Candidate (Exact 1)

### Candidate: `editor-shell-helpers.js` → `editor-shell-startup.js`

**Rationale**: `editor-shell-helpers.js` contains ~11 factory functions from `deps.shellHelpers.*` — all match the `createEditor*<name>` pattern with identical `typeof` guards. This is the **only** remaining `shellHelpers` namespace. Moving these to `editor-shell-startup.js` removes the namespace entirely.

**Operation**: Actual file rename (`editor-shell-helpers.js` → `editor-shell-startup.js`) + `shellHelpers` namespace removal from both `editor-entry-dependencies.js` and `editor.js`.

**Required changes**:
1. Rename `js/editor/editor-shell-helpers.js` → `js/editor/editor-shell-startup.js`; update `window` surface name from `LoveBudEditorShellHelpers` to `LoveBudEditorShellStartup`
2. `js/editor/editor-entry-dependencies.js`: remove `shellHelpers` namespace; wire all `shellHelpers.*` factory results directly into `deps.<name>` (e.g. `applyEditorShellCopy`, `createEditorStartDependencyGuard`, `createEditorStartDependencyChecker`, `createEditorRequiredGlobalWaiter`, `createEditorStartupShellApplier`, `createEditorCanvasEmptyGuideUpdater`, `createEditorSelectNodeHandler`, `createEditorSidebarStatusUpdater`, `createEditorInitialMemoryProvider`, `createEditorNextMemoryIdProvider`, `createEditorInitialSelectionApplier`, `createEditorReadyFinalizer`)
3. `js/editor.js`: change `deps.shellHelpers.X` → `deps.X` (10 lines)
4. `pages/editor.html`: update `<script>` tag filename and global surface name
5. Focused contract test(s): update `shellHelpers` references to new surface and file path

**Allowed files** (minimum set):
- `js/editor/editor-shell-startup.js` (new)
- `js/editor/editor-shell-helpers.js` (remove)
- `js/editor/editor-entry-dependencies.js`
- `js/editor.js`
- `pages/editor.html`
- Focused contract test file(s) covering the renamed global surface and script order

**Forbidden files**:
- `css/editor.css` (no CSS)
- `js/auth.js`, `js/api/*`, `js/postgres-client.js` (no API/auth/DB)
- `js/editor/editor-detail-ui.js`, `js/editor/editor-canvas.js`, `js/editor/editor-memory-actions.js`, `js/editor/editor-memory-form.js` (no behavior modules)
- `pages/*.html` except `pages/editor.html`
- `functions/*`, `modal_compute/*`, `netlify/*` (no deployment changes)

**Preserved globals**:
- `LoveBudEditorEntryDependencies` (unchanged)
- `LoveBudEditorDataLoader` (unchanged)
- `LoveBudEditorShellHelpers` → replaced by `LoveBudEditorShellStartup`
- All `window.createEditor*`, `window.LoveBud*` surfaces (unchanged except `ShellHelpers` → `ShellStartup`)

**Rollback condition**:
- If any `typeof shellHelpers.X !== 'function'` guard still exists in `editor-entry-dependencies.js` or `editor.js` → full rollback
- If any `editor.js` start sequence changes beyond `deps.shellHelpers.X` → `deps.X` → revert
- If any contract test expects `LoveBudEditorShellHelpers` still present → revert

**Boundary**: File rename + `shellHelpers` namespace removal only. No behavior change, no new factory function, no API/auth/DB/data-model change.

## 7. Related Existing Contract Test / Smoke Coverage

### Editor contract tests relevant to script order and API surface:

- `tests/contracts/editor-script-order-contract.test.cjs` — script loading order
- `tests/contracts/editor-api-surface.test.cjs` — API surface availability
- `tests/contracts/editor-entry-dependencies-contract.test.cjs` — entry dependencies
- `tests/contracts/editor-entrypoint-responsibility-contract.test.cjs` — entry orchestration
- `tests/contracts/editor-bootstrap-guard-inventory-contract.test.cjs` — bootstrap guard
- `tests/contracts/editor-canvas-init-order-contract.test.cjs` — canvas init order
- `tests/contracts/editor-startup-context-script-order-contract.test.cjs` — startup context
- `tests/contracts/editor-post-bootstrap-alias-inventory-contract.test.cjs` — alias inventory
- `tests/contracts/editor-entry-dependency-compatibility-inventory-contract.test.cjs` — dependency compatibility

### Smokes:
- `tests/smoke/` — no direct `editor` smoke in this audit

## 8. No-Go Areas (Explicit)

### Protected PR scope:

- **#2960**: `ux(editor): recompose detail panel with persistent tree context` — no detail-panel scope changes
- **#2856**: `fix(editor): stabilize growth affordance render` — no canvas-affordance scope changes
- **#3070**: `fix(editor): complete save feedback` — no save-completion scope
- **#3084**: `feat(editor): add knowledge link validation core` — no knowledge-link core
- **#3069**: CLOSED (previous PR)

### Other no-go:

- No API/auth/data-model/user-visible behavior changes
- No global alias reintroduction
- No `shellHelpers.X` → direct `deps.shellHelpers.X` change — must use `deps.X` path
- No `<script>` order changes in `pages/editor.html`
- No `netlify/functions/**`, `modal_compute/*`, `functions/*` changes
- No `css/*`, `js/*`, `pages/*` changes outside `js/editor/*`
- No test addition/modification in this audit PR (audit-only)
- No `Closes #1882`, `Fixes #1882`, `Resolves #1882` — only `Refs #1882`

## 9. Next Implementation PR Minimum Scope

### First extraction PR (after this audit):

1. **Move** `editor-shell-helpers.js` → `editor-shell-startup.js`
2. **Remove** `shellHelpers` namespace from `editor.js`
3. **Replace** `const X = deps.shellHelpers.X` → `const X = deps.X` in `editor.js` (10 lines, flat namespace removal)
4. **No** other file changes

### Verification (next implementation PR):

- `git diff --check` (no whitespace errors)
- Focused contract tests only:
  - `tests/contracts/editor-script-order-contract.test.cjs` — verify `<script>` tag update does not break load order
  - `tests/contracts/editor-entry-dependencies-contract.test.cjs` — verify `deps.X` replacements match expected surface
  - `tests/contracts/editor-post-bootstrap-alias-inventory-contract.test.cjs` — verify `shellHelpers` namespace alias count drops to 0
  - New focused contract test for the renamed global surface (`LoveBudEditorShellStartup`)
- Remote CI (GitHub Actions) — merge check only
- User signed-in production smoke — after merge, one manual smoke on the editor page
- No blanket `npm test`, no `npm run verify:remote`, no `npm run check:pr-guardrails`

## Audit Summary

- **Current state**: `js/editor.js` = 876 lines, single `DOMContentLoaded` entry point
- **Cluster**: ~20+ `shellHelpers` factory methods, ~15+ `deps.*` direct reads, ~11 global dependency registrations
- **Dependency**: `editor-entry-dependencies.js`, `editor-shell-helpers.js`, `editor-data-loader.js`, `editor-canvas.js`, `editor-detail-ui.js`, `editor-memory-actions.js`, `editor-memory-form.js`
- **Global surface**: `LoveBudEditor*`, `window.createEditor*`, `window.apiClient`, `window.currentTreeData`
- **Alias status**: 0 remaining `const X = shellHelpers.X` → all `const X = deps.X`
- **Extraction candidate**: `editor-shell-startup.js` (1 file)
- **Protected**: #2960, #2856, #3070, #3084 — all preserved
- **No-go**: No API, no auth, no data-model, no user-visible behavior, no alias reintroduction, no protected-scope changes

Refs #3088
Refs #1882