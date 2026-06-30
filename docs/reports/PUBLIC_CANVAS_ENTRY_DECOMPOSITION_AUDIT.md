# Public Canvas Entry Decomposition Audit

## Audit Scope

- **Issue**: #3087
- **Parent**: #3086, #1882
- **Protected**: #2960 (detail panel tree context), #2856 (growth affordance), #3070 (save completion — paused)
- **Explicit exclusions**: #2972 (media playback, YouTube embed, player lifecycle), #2976 (dynamic copy centralization)
- **Runtime (this audit PR)**: No changes
- **Documentation only (this audit PR)**

## 1. Base SHA

- **Current main**: `6355c5198cbc65777a4de863ea9aa2550f4a106f`
- **No open PRs interfering**: only #2960 (protected), #2856 (protected) are open
- **No pending changes** on `main`

## 2. Current `js/viewer/public-canvas-init.js` Responsibility Cluster Map

Total: 904 lines (IIFE-wrapped, line 1–904). Re-entrant guard via `window.LoveBudPublicCanvasInitLoaded`.

### 2.1 Entry guard / marker (lines 4–6)

Sets `window.LoveBudPublicCanvasInitLoaded = true`. Returns early if already loaded.

### 2.2 `escapeHtml` (lines 8–17)

Delegates to `window.LoveBudSecurity.escapeHtml` if available; fallback is a local regex-based sanitizer.

### 2.3 Load failure state (lines 19–81)

- `createLoadFailureState(message)` (lines 19–46) — builds error DOM subtree (icon, title, description). Delegates to `window.LoveBudPublicViewerCanvasEntry.createLoadFailureState` if available.
- `createMissingRouteState()` (lines 48–58) — builds missing-treeId message. Delegates to `window.LoveBudPublicViewerCanvasEntry.createMissingRouteState`.
- `appendMissingRouteState()` (lines 60–67) — appends missing-route state to `document.body`.
- `appendPublicLoadFailureState(container, error)` (lines 69–81) — clears container and appends load failure state. Delegates to `window.LoveBudPublicViewerCanvasEntry.appendPublicLoadFailureState`.
- `handlePublicCanvasLoadFailure(error)` (lines 83–87) — console.error + calls `appendPublicLoadFailureState` targeting `#canvasArea`.

### 2.4 Runtime readiness waiting (lines 89–127)

- `isPublicRuntimeReady()` (lines 89–104) — checks `window.LoveBudPublicViewerCanvasEntry.isPublicRuntimeReady`, or falls back to checking both canvas runtime (`typeof window.createEditorCanvas === 'function'`) and detail UI runtime (`typeof window.createPublicViewerDetailUI === 'function'`).
- `waitForPublicRuntime(startCanvas)` (lines 106–127) — polls `isPublicRuntimeReady` every 50ms up to 100 attempts (5s). Calls `startCanvas()` when ready.

### 2.5 Public canvas creation / configuration (lines 129–190)

- `createPublicEditorCanvas(canvasOptions)` (lines 129–143) — creates editor canvas via `window.LoveBudPublicViewerCanvasAdapter.createPublicViewerCanvas` or falls back to `window.createEditorCanvas(canvasOptions)`.
- `resolvePublicCanvasTargets()` (lines 145–151) — returns `{ canvas: #canvasArea, svg: #canvasSvg, detailPanel: #detailPanel }`.
- `installPublicCanvasRuntimeProfile(canvas)` (lines 153–161) — installs public metrics and viewport profile via `window.LoveBudPublicViewerCanvasEntry`.
- `createPublicCanvasConfig(normalized)` (lines 163–178) — builds config object with `resolveTreeTitleText`, `resolveHintText`, `resolveInfoText`, `resolveMemoryThumbnail`, `getTreeMemories`, `getCurrentTreeData`, `createInitialMemory`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createPublicCanvasConfig`.
- `createPublicCanvasEmptyGuideUpdater(treeMemories)` (lines 180–190) — creates empty guide updater function that toggles `#canvasEmptyGuide` visibility. Delegates to `window.LoveBudPublicViewerCanvasEntry.createEmptyGuideUpdater`.

### 2.6 Memory / root / selection state (lines 192–286)

- `createPublicCanvasMemoryHelpers(treeMemories)` (lines 192–241) — creates `getCanonicalRootId`, `isRootMemory`, `canonicalRootId`, `findFirstSelectableMemory`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createMemorySelectors` or falls back to `window.LoveBudEditorUtils` + local logic.
- `createPublicCanvasSelectionState(canonicalRootId)` (lines 256–286) — creates `{ getSelectedNodeId, setSelectedNodeId, getCurrentEditingMemory, setCurrentEditingMemory, selectMemory }`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createSelectionState`.

### 2.7 Read-only action wiring (lines 243–254)

- `createPublicCanvasReadOnlyActions()` (lines 243–254) — creates `{ noop, noopAsync, noopFalseAsync, getLocalSaveMode, showToast }`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createReadOnlyActions`.

### 2.8 Detail UI integration (lines 288–322)

- `createPublicCanvasDetailUIOptions(ctx)` (lines 288–322) — builds deps object for `window.createPublicViewerDetailUI(detailUIOptions)`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createDetailUIOptions`.

### 2.9 Boot composition (lines 324–410)

- `createPublicCanvasOptions(ctx)` (lines 324–359) — builds options for `createPublicEditorCanvas`. Delegates to `window.LoveBudPublicViewerCanvasEntry.createCanvasOptions`.
- `installPublicCanvasReadOnlyState(canvas, editorCanvas)` (lines 361–372) — sets `canvas.__editorCanvasInstance` and `window.LoveBudEditor.canEdit = false`. Delegates to `window.LoveBudPublicViewerCanvasEntry.installPublicEditorReadOnlyState`.
- `initializePublicEditorCanvas(editorCanvas)` (lines 374–380) — calls `editorCanvas.initCanvas()` if available.
- `runPublicCanvasPostInitRefresh(ctx)` (lines 382–410) — runs empty guide update, sidebar status update, detail panel update. Delegates to `window.LoveBudPublicViewerCanvasEntry.runPublicPostInitRefresh`.

### 2.10 Owner mode UI / capability check (lines 412–871)

- `updateOwnerModeUI(selectionState, providedTreeData)` (lines 412–498) — toggles viewer/editor mode buttons, sidebar owner mode, back-link href, kicker text. Reads `window.LoveBudTreeWorkspacePermission.resolveTreeWorkspaceCanEdit`. Exported as `window.LoveBudPublicCanvasInit.updateOwnerModeUI`.
- `reconcileOwnerCapabilityForActiveTree(targetTreeData)` (lines 713–807) — fetches `/private/trees/{id}/capability` via `window.LoveTreeBaseApiFetch.apiFetch`, caches `viewerCanEdit`, calls `window.LoveBudPublicCanvasInit.updateOwnerModeUI`.
- Auth observer registration (lines 809–848) — registers on-auth-ready callback via `window.registerOnAuthReady`.
- Deferred auth poller (lines 851–871) — polls `window.LoveTreeAuthPolicy.hasConfirmedAuthSession` every 200ms.

### 2.11 Main `initPublicCanvas` orchestrator (lines 536–876)

- `setupPublicRoute()` (lines 536–547) — extracts `treeId` from URL params, adds `editor-readonly` class, removes `editor-preload`. Delegates to `window.LoveBudPublicViewerCanvasEntry.setupPublicRoute`.
- `isPublicCanvasBridgeReady(bridge)` (lines 549–551) — checks `bridge.loadPublicTreeData`.
- `extractPublicCanvasResult(result)` (lines 553–558) — normalizes `{ tree, memories }`.
- `getPublicCanvasBridge()` (lines 878–883) — returns `window.LoveBudPublicViewerCanvasEntry.getPublicCanvasBridge()` or `window.LoveBudPublicCanvasBridge`.
- `normalizePublicCanvasData(bridge, tree, memories)` (lines 885–897) — normalizes via `window.LoveBudPublicViewerCanvasEntry.normalizePublicCanvasData` or `bridge.normalizeForCanvas`.
- `initPublicCanvas()` (lines 560–876) — full boot sequence: route setup → bridge → load → normalize → `startCanvas()` closure → detail UI wiring → canvas creation → post-init refresh → sidebar population → owner capability reconciliation → auth registration.
- DOMContentLoaded boot (lines 899–903) — calls `initPublicCanvas()` on DOMContentLoaded or immediately.

### 2.12 Global surface export (lines 497–498)

Exports `window.LoveBudPublicCanvasInit.updateOwnerModeUI`.

### 2.13 Node click handler (lines 519–534)

- `createPublicCanvasNodeClickHandler(ctx)` — selects memory, updates `selected` class on DOM nodes, calls `updateDetailPanel`, `updateFocusSelectedBtn`, `setDetailEmptyState`, and `editorCanvas.updateAffordance`.

## 3. Public Viewer Script Order and Global Ownership

### Script load order (pages/view.html)

```
Lines 41–45: viewer templates (sidebar, topbar, detail-panel-shell, empty-state, view-mode)
Lines 47–69: editor canvas modules (root-helpers, layout, node, interaction, viewport, edges, geometry, etc.)
Line 69:     editor-canvas.js (type="module") → window.createEditorCanvas
Lines 71–74: public viewer detail modules (tree-meta, builders, ui, channel-link)
Lines 76–87: Firebase, auth modules (auth-state, auth-callbacks, auth-cache, auth-ui, auth-session, auth-firebase, etc.)
Line 87:     auth.js
Lines 89–92: API modules (auth-policy, tree-workspace-permission, base-api-fetch, postgres-client)
Lines 94–99: i18n modules
Lines 101–102: shared-header, page-transitions
Lines 103–106: public canvas modules:
  103: public-canvas-bridge.js → LoveBudPublicCanvasBridge, currentTreeData, currentTreeMemories
  104: public-viewer-canvas-entry.js → LoveBudPublicViewerCanvasEntry (24 methods)
  105: public-viewer-canvas-adapter.js → LoveBudPublicViewerCanvasAdapter
  106: public-canvas-init.js → initPublicCanvas (DOMContentLoaded boot)
Lines 107–109: copy/polish helpers
```

### `window.LoveBudPublicViewer*` / `window.LoveBudPublicCanvas*` / `window.create*` surface ownership

| Global | Owner File | Responsibility |
|--------|-----------|--------------|
| `LoveBudPublicCanvasBridge` | `public-canvas-bridge.js:118` | `loadPublicTreeData`, `normalizeForCanvas` |
| `currentTreeData` | `public-canvas-bridge.js:109` | Tree data cache (side-effect) |
| `currentTreeMemories` | `public-canvas-bridge.js:110` | Memories cache (side-effect) |
| `LoveBudPublicViewerCanvasEntry` | `public-viewer-canvas-entry.js:412` | 24-method namespace: canvas runtime, detail runtime, config, selection, read-only actions, metrics, etc. |
| `LoveBudPublicViewerCanvasAdapter` | `public-viewer-canvas-adapter.js:13` | `createPublicViewerCanvas` wrapper |
| `LoveBudPublicCanvasInit` | `public-canvas-init.js:497` | `updateOwnerModeUI` |
| `createPublicViewerDetailUI` | `public-viewer-detail-ui.js:859` | Detail UI factory |
| `LoveBudPublicViewerDetailUI` | `public-viewer-detail-ui.js:860` | Detail UI namespace |
| `createEditorCanvas` | `editor-canvas.js` (type=module) | Editor canvas factory |
| `LoveBudPublicViewerDetailChannelLink` | `public-viewer-detail-channel-link.js` | Channel link renderer |
| `createPublicViewerDetailUIBuilders` | `public-viewer-detail-builders.js` | Shared UI builders |
| `createEditorDetailUIBuilders` | `public-viewer-detail-builders.js` | Alias — same function |

### `createEditorCanvas` adapter dependency

`public-canvas-init.js:129–143` (`createPublicEditorCanvas`) uses the adapter:
```
window.LoveBudPublicViewerCanvasAdapter.createPublicViewerCanvas({
    createEditorCanvas: window.createEditorCanvas,
    canvasOptions: canvasOptions
})
```
If the adapter is missing, falls back to `window.createEditorCanvas(canvasOptions)` directly. The adapter is an optional compatibility layer; removing it would still work as long as `editor-canvas.js` (type=module) has loaded and set `window.createEditorCanvas`.

### Public route data source and visibility guard owner

Data loading is owned by:
- `public-canvas-bridge.js` (`loadPublicTreeData`, `normalizeForCanvas`)
- `public-canvas-init.js` (calls bridge, normalizes, passes to canvas)

Visibility policy is owned by:
- `tree-workspace-permission.js` (`resolveTreeWorkspaceCanEdit`)
- `auth-policy.js` (`LoveTreeAuthPolicy`)
- `public-canvas-init.js` (owner capability fetch via `/private/trees/{id}/capability`)

The `public-canvas-init.js` file **consumes** visibility/capability but does **not** define the policy.

### Public canvas / detail UI dependency boundary

- `public-canvas-init.js` creates `detailUIOptions` (line 615–623) and calls `window.createPublicViewerDetailUI(detailUIOptions)` (line 625)
- The detail UI receives deps including `detailPanel`, `isRootMemory`, `getCanonicalRootId`, `getSelectedNodeId`, `getTreeMemories`, `getCurrentTreeData`, `resolveMemoryThumbnail`, `escapeHtml`, read-only actions, etc.
- After detail UI construction, `public-canvas-init.js` reads `detailUI.setDetailEmptyState`, `detailUI.updateFocusSelectedBtn`, `detailUI.updateSidebarStatus`, `detailUI.updateDetailPanel` (lines 627–630)
- The boundary is a plain deps object: no shared state, no coupling beyond the documented interface

## 4. Public Invariants

### Read-only / no mutation

- `editor-readonly` class set on `document.body` at `setupPublicRoute()` (line 544)
- `window.LoveBudEditor.canEdit = false` (line 370)
- All mutation actions wired as `noop` / `noopAsync` / `noopFalseAsync` via `createPublicCanvasReadOnlyActions()`
- Canvas options set `canEdit: false` (line 357)

### Private/draft non-discovery

- Data loading uses `bridge.loadPublicTreeData(treeId)` — public endpoint
- Owner capability (`/private/trees/{id}/capability`) is only fetched for authenticated, authorized users
- No draft/private tree rendering in this file

### Public load failure fallback

- Missing `treeId` → `createMissingRouteState()` / `appendMissingRouteState()` — plain text error on `document.body`
- Bridge load failure → `handlePublicCanvasLoadFailure()` → error DOM subtree in `#canvasArea`

### Empty tree / selected moment / unavailable media fallback

- Empty tree: `createPublicCanvasEmptyGuideUpdater` toggles `#canvasEmptyGuide` visibility based on `treeMemories.length`
- Selected moment: `findFirstSelectableMemory()` selects first non-root memory, `selectionState.selectMemory`, `updateDetailPanel(firstSelectable)`, `setDetailEmptyState(false)`
- Unavailable media: delegated to detail UI (see #3090 audit); `public-canvas-init.js` passes `resolveMemoryThumbnail` only, no media logic

### DOM IDs, selection/reset assumptions, accessibility state

- `#canvasArea`, `#canvasSvg`, `#detailPanel` — shell targets resolved by `resolvePublicCanvasTargets()`
- `#canvasEmptyGuide` — toggled by `createPublicCanvasEmptyGuideUpdater`
- `#focusSelectedBtn` — updated by `detailUI.updateFocusSelectedBtn`
- `#viewerModeGroup`, `#viewerModeViewBtn`, `#viewerModeEditBtn` — owner mode UI targets
- `#viewerSidebarOwnerMode`, `#viewerSidebarViewBtn`, `#viewerSidebarEditBtn`, `#viewerSidebarBackLink`, `#viewerSidebarBackLabel`, `#viewerSidebarKicker` — sidebar owner mode targets
- `#viewerSidebarTreeTitle`, `#viewerSidebarSummary`, `#viewerSidebarMomentCount` — sidebar population targets
- Selection: `selectionState.selectMemory` → `data.id` tracked in closure; DOM nodes cleared via `document.querySelectorAll('.memory-node')` class toggle
- Accessibility: `editor-readonly` body class; `aria-current` on mode view/edit buttons; no explicit ARIA attributes set in this file

## 5. Explicit Exclusion Boundaries

### #2972 — Media playback, YouTube embed, player lifecycle

No media URL parsing, YouTube ID extraction, embed building, or player lifecycle in this file. Only `resolveMemoryThumbnail` is passed to the detail UI. No change.

### #2976 — Dynamic copy centralization

No shared copy/builders are defined in this file. It reads `window.createPublicViewerDetailUI` and `window.LoveBudPublicViewerCanvasEntry` but does not define any shared UI builders. No change.

### Editor canvas

- `editor-canvas.js` (type=module) — out of scope
- `public-viewer-canvas-adapter.js` — adapter boundary; extraction should not modify it
- `js/editor/*` — no changes

### API / auth / database / cache schema / public visibility policy

- `public-canvas-bridge.js` data loading — out of scope
- `public-viewer-canvas-entry.js` runtime readiness / metrics — out of scope
- `auth-policy.js`, `tree-workspace-permission.js` — out of scope
- `api/*`, `postgres-client.js` — out of scope

### UI redesign

No design or user-visible changes. No CSS changes.

## 6. First Extraction Candidate (Exact 1)

### Candidate: `escapeHtml` + load/error state functions → dedicated error/fallback module

**Rationale**: The five load/error/fallback functions (`escapeHtml`, `createLoadFailureState`, `createMissingRouteState`, `appendMissingRouteState`, `appendPublicLoadFailureState`, `handlePublicCanvasLoadFailure`) form a self-contained **error/fallback rendering cluster** with no dependency on canvas, detail UI, selection state, or owner capability. They share only `window.LoveBudPublicViewerCanvasEntry` as a delegable boundary. Combined size: ~88 lines.

This cluster is orthogonal to all other responsibilities — it runs early in the boot sequence (before canvas creation) and has no runtime coupling to the rest of `initPublicCanvas`. Extraction would reduce the main file's orchestration surface and isolate a clear, testable responsibility.

**Operation**: Behavior-preserving source split. Extract error/fallback functions into a new `public-canvas-error-fallback.js`. Keep `public-canvas-init.js` calling them through either the same `window.LoveBudPublicCanvasInit` surface or a dedicated `window.LoveBudPublicCanvasErrorFallback` namespace.

**Key invariant**: `handlePublicCanvasLoadFailure` and `appendMissingRouteState` must remain callable from `initPublicCanvas` in `public-canvas-init.js`. Callers (lines 565, 875) continue via local function references or through a new global surface.

**Required changes**:
1. Create `js/viewer/public-canvas-error-fallback.js` — host `escapeHtml`, `createLoadFailureState`, `createMissingRouteState`, `appendMissingRouteState`, `appendPublicLoadFailureState`, `handlePublicCanvasLoadFailure`
2. `js/viewer/public-canvas-init.js` — remove extracted functions; import from the new module via `window.LoveBudPublicCanvasErrorFallback` or keep local wrapper
3. `pages/view.html` — add `<script>` tag for the new module **before** `public-canvas-init.js` (between line 105 and 106)

**Allowed files** (minimum set):
- `js/viewer/public-canvas-error-fallback.js` (new)
- `js/viewer/public-canvas-init.js` (remove extracted functions, add local delegation)
- `pages/view.html` (add `<script>` tag)

**Forbidden files**:
- `css/*.css` (no CSS)
- `js/auth.js`, `js/api/*`, `js/postgres-client.js` (no API/auth/DB)
- `js/editor/*` (no editor modules)
- `js/viewer/public-canvas-bridge.js` (no bridge changes)
- `js/viewer/public-viewer-canvas-entry.js` (no canvas entry changes)
- `js/viewer/public-viewer-canvas-adapter.js` (no adapter changes)
- `js/viewer/public-viewer-detail-*.js` (no detail UI changes)
- `js/viewer/public-canvas-mobile-*.js` (no mobile layout changes)
- `js/viewer/public-canvas-affordance-fallback.js` (no affordance changes)
- `js/shared/*` (no shared modules)
- `pages/*.html` except `pages/view.html`
- `functions/*`, `modal_compute/*`, `netlify/*` (no deployment changes)

**Preserved globals**:
- `window.LoveBudPublicCanvasInit.updateOwnerModeUI` (unchanged)
- `window.LoveBudPublicViewerCanvasEntry.*` (unchanged)
- `window.createPublicViewerDetailUI` (unchanged)
- `window.LoveBudPublicViewerCanvasAdapter` (unchanged)
- `window.LoveBudPublicCanvasBridge` (unchanged)
- New module may export `LoveBudPublicCanvasErrorFallback` as a parallel surface

**Rollback condition**:
- If `initPublicCanvas` cannot resolve `handlePublicCanvasLoadFailure` or `appendMissingRouteState` at runtime → full rollback
- If the new module fails to load before `public-canvas-init.js` due to script order → revert
- If any existing error/fallback behavior changes (error DOM structure, missing route message, load failure container) → revert
- If `pages/view.html` script order breaks any subsequent dependency → revert

**Boundary**: Behavior-preserving source split only. No rename, no namespace flatten, no DOM ID change. No media (#2972), copy (#2976), canvas entry, or canvas adapter scope change.

## 7. Related Existing Contract Test / Smoke Coverage

### Existing tests relevant to public canvas entry:

- `tests/contracts/viewer-public-canvas-init-contract.test.cjs` (if exists) — verify `initPublicCanvas` global surface
- `tests/contracts/viewer-public-ui-contract.test.cjs` (if exists) — verify public UI behavior
- `tests/contracts/viewer-canvas-runtime-contract.test.cjs` (if exists) — verify `createEditorCanvas` adapter behavior

*Note: Actual contract test file names should be verified against the repository before the implementation PR.*

### Future verification matrix:

| Scenario | Verification method |
|----------|-------------------|
| Public tree route (treeId present, data loads) | Focused contract test + user production smoke |
| Missing treeId route | Focused contract test: `appendMissingRouteState` renders to body |
| Load failure (bridge rejects) | Focused contract test: `handlePublicCanvasLoadFailure` renders error in `#canvasArea` |
| Empty tree (no memories, empty guide shown) | Focused contract test + user production smoke |
| Selected moment (first memory selected, detail panel renders) | Focused contract test |
| Unavailable media fallback (detail UI handles it) | Covered by #3090 verification matrix |
| Private/draft non-discovery (no private data leaks to public) | No change — covered by existing visibility guard tests |
| Owner capability fetch (authenticated owner sees edit buttons) | Focused contract test |
| Script order preservation | Focused contract test: verify `window.LoveBudPublicCanvasInit`, `window.LoveBudPublicViewerCanvasEntry`, `window.createEditorCanvas` resolvable at boot |

## 8. No-Go Areas (Explicit)

### Protected PR scope:

- **#2960**: `ux(editor): recompose detail panel with persistent tree context` — no detail-panel scope changes
- **#2856**: `fix(editor): stabilize growth affordance render` — no canvas-affordance scope changes
- **#3070**: `fix(editor): complete save feedback` — paused; no save-completion scope

### Other no-go:

- No API/auth/data-model/user-visible behavior changes
- No global alias reintroduction
- No #2972 media scope changes (URL parsing, embed building, player lifecycle, teardown)
- No #2976 copy centralization scope changes (shared builders, fallback text)
- No `js/editor/*` changes
- No `js/viewer/public-canvas-bridge.js` changes
- No `js/viewer/public-viewer-canvas-entry.js` changes
- No `js/viewer/public-viewer-canvas-adapter.js` changes
- No `js/shared/*` changes
- No `css/*` changes
- No `functions/*`, `modal_compute/*`, `netlify/*` changes
- No test addition/modification in this audit PR (audit-only)
- No `Closes #1882`, `Fixes #1882`, `Resolves #1882` — only `Refs #1882`

## 9. Next Implementation PR Minimum Scope

### First extraction PR (after this audit):

1. **Create** `js/viewer/public-canvas-error-fallback.js` — host error/fallback rendering functions
2. **Remove** extracted functions from `js/viewer/public-canvas-init.js`; delegate via `LoveBudPublicCanvasErrorFallback` namespace
3. **Add** `<script>` tag in `pages/view.html` for the new module before `public-canvas-init.js`
4. **No changes** to `public-canvas-bridge.js`, `public-viewer-canvas-entry.js`, `public-viewer-canvas-adapter.js`, or any file outside the §6 allowed list

**Allowed file scope**: see §6 Allowed files. Anything outside that list is forbidden in this slice.

### Verification (next implementation PR):

- `git diff --check` (no whitespace errors)
- Focused contract tests only:
  - Error fallback global surface preservation: `LoveBudPublicCanvasErrorFallback.*` resolvable
  - Missing route: `appendMissingRouteState` renders to `document.body`
  - Load failure: `handlePublicCanvasLoadFailure` renders error in `#canvasArea`
  - Script order: `pages/view.html` load order does not break
- Remote CI (GitHub Actions) — merge check only
- User signed-in or public production smoke — after merge, one manual smoke: open a public tree with valid/invalid treeId, verify error/fallback behavior
- No blanket `npm test`, no `npm run verify:remote`, no `npm run check:pr-guardrails`

## Audit Summary

- **Current state**: `js/viewer/public-canvas-init.js` = 904 lines, single IIFE, 20+ internal functions, 2 exported to `window.LoveBudPublicCanvasInit` (updateOwnerModeUI) and `window.LoveBudPublicCanvasInitLoaded` (marker)
- **Clusters**: error/fallback (~88 lines), runtime readiness (~39 lines), canvas creation/config (~61 lines), memory/root/selection (~91 lines), read-only actions (~12 lines), detail UI options (~35 lines), boot composition (~87 lines), owner capability (~460 lines), main orchestrator (~341 lines), node click handler (~16 lines), entry guard (~3 lines), sanitizer (~10 lines)
- **Dependencies**: `window.LoveBudPublicViewerCanvasEntry` (primary), `window.LoveBudPublicCanvasBridge`, `window.LoveBudPublicViewerCanvasAdapter`, `window.createEditorCanvas`, `window.createPublicViewerDetailUI`, `window.LoveBudSecurity`, `window.LoveBudEditorUtils`, `window.LoveBudTreeWorkspacePermission`, `window.LoveTreeBaseApiFetch`, `window.LoveTreeAuthPolicy`, `window.registerOnAuthReady`, `window.currentTreeData`, `window.currentTreeMemories`
- **Global surface**: `LoveBudPublicCanvasInit.updateOwnerModeUI`, `LoveBudPublicCanvasInitLoaded` (marker)
- **First extraction candidate**: Error/fallback rendering cluster (escapeHtml + 5 load/error functions) — behavior-preserving source split, ~88 lines
- **Protected**: #2960, #2856, #3070 — all preserved
- **Exclusions**: #2972 (media), #2976 (copy), editor canvas, bridge, canvas entry — not touched
- **No-go**: No API/auth/data-model/behavior change; no media/copy/editor-canvas scope changes; no `public-canvas-bridge.js` or `public-viewer-canvas-entry.js` changes; no global rename or namespace flatten in this slice

Refs #3087
Refs #1882
