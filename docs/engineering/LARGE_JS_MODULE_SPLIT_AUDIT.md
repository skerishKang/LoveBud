# LARGE_JS_MODULE_SPLIT_AUDIT

Refs #2713
Refs #1882 (keep open)

> Status: audit/docs-only. No runtime, bundle, or script-loading changes.
> Baseline: `dc39c6afcbfa49b8ad5e9f745ef851f05831d10a` (origin/main)

## Purpose

Audits five JS modules at or above the 500-line reviewability threshold so the team can plan **one-file-at-a-time** follow-up split issues. This document records what each module owns, depends on, and where safe extraction boundaries might exist — without authorizing any split today.

## Related audit documents

- `docs/engineering/LARGE_RUNTIME_FILE_AUDIT.md` — earlier 500+ inventory (Refs #656)
- `docs/engineering/LARGE_FILE_MODULARIZATION_CANDIDATES.md` — classification labels and refresh commands (Refs #408)
- `docs/engineering/EDITOR_JS_ARCHITECTURE_AUDIT.md` — editor JS structure overview (Refs #72)
- `docs/engineering/EDITOR_DETAIL_UI_RESPONSIBILITY_AUDIT.md` — editor-detail-ui responsibility buckets (Refs #518)

This audit **extends** those documents with current line counts, public API inventories, and per-file extraction/risk analysis at the baseline SHA above.

## Baseline line counts

| File | Lines | Page | Domain |
| --- | --- | --- | --- |
| `js/viewer/public-viewer-detail-ui.js` | 873 | detail / viewer | Viewer detail rendering |
| `js/editor.js` | 691 | editor | Editor page entry / bootstrap |
| `js/editor/editor-canvas.js` | 640 | editor | Canvas rendering + layout |
| `js/scout/scout-draft-ui.js` | 632 | editor (loaded in editor.html) | Scout draft modal UI |
| `js/viewer/public-canvas-init.js` | 618 | detail / viewer | Viewer canvas bootstrap |

---

## 1. `js/editor.js` (691 lines)

### Public API / global side effects

- **No `window.` export** — acts as the page-level IIFE entry script for `pages/editor.html`.
- Reads many `window.*` globals: `LoveBudEditorEntryDependencies`, `LoveBudEditorDebug`, `apiClient`, `currentTreeData`, `LoveBudCache`, `LoveBudNormalize`, `createEditorDetailUI`, `createEditorCanvas`, `createEditorMemoryActions`, etc.
- Writes: `window.LoveBudEditorDebug` (logs/errors), `window.editorDataLoader`, `window.editorCanvas`, `window.memoryActions`.

### Major responsibility groups

| Group | Approx. lines | Description |
| --- | --- | --- |
| Dependency resolution & bootstrap guard | 1–60 | Resolves `LoveBudEditorEntryDependencies`, creates ~20 helper factories via deps object |
| `startEditor()` async entry | 60–500+ | Orchestrates: auth check → data load → DOM refs → sidebar → detail UI → canvas → memory actions → Scout → floating toolbar → initial load → ready marker |
| Auth & redirect logic | 100–170 | Reads `auth.currentUser`, redirects unauthenticated users |
| Initial load & refresh flow | 370–500 | `runEditorInitialLoadFlow`, `createEditorRefreshSaveRuntime` |
| Scout wiring | 430–450 | Wires `LoveBudScoutDraftUI.open()` |
| Floating toolbar wiring | 460–480 | Creates toolbar via template, binds dropdown |

### DOM ownership

- Does not directly create DOM — delegates to child modules (`createEditorDetailUI`, `createEditorCanvas`, `createEditorMemoryActions`, template builders).
- Queries: `#editorReadyMarker`, `#editorRoot`, `#editorSidebar`, `#editorDetailPanel`, `#ftbScoutAction`.

### Runtime dependencies

- ~20 helper factories from `LoveBudEditorEntryDependencies`
- `apiClient`, `LoveBudCache`, `LoveBudNormalize`, `LoveBudSecurity`
- Auth: `auth.currentUser`
- Child modules: `createEditorDetailUI`, `createEditorCanvas`, `createEditorMemoryActions`, `LoveBudScoutDraftUI`
- Templates: `LoveBudFloatingToolbarElements`, `LoveBudFloatingToolbarDropdown`

### Test coverage anchors

- `tests/contracts/editor-entrypoint-responsibility-contract.test.cjs`
- `tests/contracts/editor-entry-dependencies-contract.test.cjs`
- `tests/contracts/editor-startup-context-contract.test.cjs`
- `tests/contracts/editor-script-order-contract.test.cjs`
- `tests/contracts/editor-ready-marker-contract.test.cjs`
- `tests/contracts/editor-ready-finalizer-contract.test.cjs`
- `tests/contracts/editor-bootstrap-guard-inventory-contract.test.cjs`
- `tests/contracts/editor-page-event-bindings-contract.test.cjs`
- ~30+ additional editor-* contracts in `tests/contracts/`

### Low-risk extraction candidates

| Candidate | Rationale | Suggested follow-up |
| --- | --- | --- |
| Auth redirect guard (lines ~100–170) | Self-contained, runs before UI init | One narrow PR: extract to `js/editor/editor-auth-redirect.js` |
| Scout wiring block (lines ~430–450) | 3-4 lines, reads `LoveBudScoutDraftUI` | Can fold into floating-toolbar or a tiny helper |

### Risky / defer sections

| Section | Why risky |
| --- | --- |
| `startEditor()` orchestrator (60–500+) | Tightly coupled dependency chain; extracting parts requires all downstream consumer awareness |
| Initial load flow + refresh save runtime | Shared state (`window.editorDataLoader`, `window.editorCanvas`, `window.memoryActions`) written during init |

---

## 2. `js/viewer/public-viewer-detail-ui.js` (873 lines)

### Public API / global side effects

- `window.createPublicViewerDetailUI(deps)` — factory, exported at line 854
- `window.LoveBudPublicViewerDetailUI` — namespace object with `{ createPublicViewerDetailUI }`, exported at line 855

### Major responsibility groups

| Group | Approx. lines | Description |
| --- | --- | --- |
| Individual boundary factories | 4–100 | ~15 small boundary functions (badge, title, hint, image, date, memo, tags, channel link, empty state, focus button) |
| `updatePublicViewerSidebarStatus` | ~21 | Sidebar status updater (currently a no-op stub) |
| `createPublicViewerCurrentMomentImageBoundary` | 173–408 | Image rendering with media helper, including YouTube embed logic and URL sanitization (~235 lines — largest single function) |
| `createPublicViewerMemoBodyBoundary` | 417–530 | Memo body rendering with fallback builders |
| `createPublicViewerCurrentMomentTagsBoundary` | 476–543 | Tags rendering with fallback builders |
| `createPublicViewerReadOnlyReactionSummaryBoundary` | 544–665 | Read-only reaction summary fetch + render |
| `createPublicViewerTreeMetaBoundary` | 669–790 | Tree meta card (owner, visibility, moment counts) |
| `createPublicViewerDetailHeadingBoundary` | 786–805 | Section heading |
| `createPublicViewerDetailUI` orchestrator | 806–853 | Factory that assembles all boundary functions into a composite update API |

### DOM ownership

- Reads/updates: `#publicViewerDetailPanel`, `#publicViewerCurrentMomentBadge`, `#publicViewerCurrentMomentTitle`, `#publicViewerCurrentMomentHint`, `#publicViewerCurrentMomentImage`, `#publicViewerCurrentMomentDate`, `#publicViewerMemoBody`, `#publicViewerCurrentMomentTags`, `#publicViewerReactionSummary`, `#publicViewerTreeMeta`, `#publicViewerDetailHeading`.
- Each boundary function owns a specific DOM subtree.

### Runtime dependencies

- `window.LoveBudPublicViewerDetailChannelLink`
- `window.LoveBudMedia`
- `window.apiClient` (reaction summary fetch)
- `window.createPublicViewerDetailUIBuilders` (fallback to `createEditorDetailUIBuilders`)
- `window.createPublicViewerDetailTreeMetaBoundary` (fallback to `createEditorDetailTreeMetaBoundary`)
- i18n via `window.t`

### Test coverage anchors

- `tests/contracts/public-tree-viewer-css-contracts.test.cjs`
- `tests/contracts/public-tree-viewer-media-url-sanitization-contract.test.cjs`
- `tests/contracts/public-tree-viewer-user-content-xss-contract.test.cjs`
- `tests/contracts/public-viewer-reaction-safe-fallback-contract.test.cjs`

### Low-risk extraction candidates

| Candidate | Rationale | Suggested follow-up |
| --- | --- | --- |
| Image boundary (173–408) | Largest single function, self-contained media helper usage | One PR: extract to `js/viewer/public-viewer-detail-image.js` |
| Reaction summary boundary (544–665) | Self-contained API fetch + render, no shared mutable state | One PR: extract to `js/viewer/public-viewer-detail-reactions.js` |
| Tree meta boundary (669–790) | Self-contained card rendering | One PR: extract to `js/viewer/public-viewer-detail-tree-meta.js` |

### Risky / defer sections

| Section | Why risky |
| --- | --- |
| Orchestrator `createPublicViewerDetailUI` (806–853) | Couples all boundaries; changes here affect the entire detail panel update cycle |
| Fallback builder resolution (`createDetailUIBuilders` fallthrough to editor) | Shared code path with editor detail UI; splitting needs coordination |

---

## 3. `js/editor/editor-canvas.js` (640 lines)

### Public API / global side effects

- `window.createEditorCanvas(deps)` — factory, exported at line ~640 (implicit IIFE return)
- Writes: node/edge DOM inside `#editorCanvas` SVG + HTML container.

### Major responsibility groups

| Group | Approx. lines | Description |
| --- | --- | --- |
| Layout state & storage | 7–70 | `loadStoredLayout()`, `loadLayoutMode()`, `persistLayoutMode()`, viewport state initialization |
| Geometry helpers | 96–120 | `getMetrics()`, `getWorldPosition()`, `calcPosition()`, `persistStoredPositions()` |
| Layout mode toggle | 128–170 | `fitViewportToTree()`, `switchToFreeMode()`, `switchToStructuredMode()`, `setLayoutMode()`, `toggleLayoutMode()` |
| Growth affordance | 170–200, 333–355 | Branch ports, affordance position calc, element creation |
| Edge drawing | 229–238 | Delegates to `LoveBudEditorCanvasEdges.drawBranch/clearBranches/drawBranchForMemory` |
| Node rendering | 241–355 | `renderAffordanceForMemory`, `createNodeElement`, `attachNodeInfo`, `attachNodeBehavior`, `drawNode`, `clearGrowthAffordance`, `openAddMomentFromCanvas`, `updateAffordance` |
| Selection & visibility | 316–325 | `reapplySelection`, `keepSelectionVisible` |
| Resize handling | 222–228 | `bindResizeHandling` |
| Main render loop | 355–640 | `render()`, re-render logic, interaction binding, layout application |

### DOM ownership

- Full ownership of `#editorCanvas` container (SVG for edges + HTML div for nodes)
- Creates: SVG path elements for branches, div nodes for moments, affordance elements

### Runtime dependencies

- `window.LoveBudEditorCanvasLayout`, `window.LoveBudEditorCanvasNode`, `window.LoveBudEditorCanvasInteraction`, `window.LoveBudEditorCanvasViewport`
- `window.createEditorCanvasEdges`
- `window.LoveBudEditorCanvasLayoutStorage`
- `window.LoveBudEditorCanvasLayoutTransition`
- `window.EditorCanvasGeometry`
- `window.createEditorCanvasGrowthAffordance`, `window.createEditorCanvasBranchPorts`
- `window.i18n` / `window.t`

### Test coverage anchors

- `tests/contracts/editor-canvas-init-order-contract.test.cjs`
- `tests/contracts/editor-canvas-interaction-runtime-contract.test.cjs`
- `tests/contracts/editor-canvas-layout-storage-contracts.test.cjs`
- `tests/contracts/editor-canvas-layout-mode-transition-contracts.test.cjs`
- `tests/contracts/editor-canvas-viewport-controls-delegation-contract.test.cjs`
- `tests/contracts/editor-canvas-topbar-template-contract.test.cjs`
- `tests/contracts/editor-canvas-empty-guide-updater-contract.test.cjs`
- `tests/contracts/editor-canvas-node-drag-delegation-contract.test.cjs`
- `tests/contracts/editor-canvas-ui-helper-contracts.test.cjs`
- `tests/contracts/editor-canvas-fit-viewport-delegation-contract.test.cjs`
- ~15+ additional editor-canvas-* contracts

### Low-risk extraction candidates

| Candidate | Rationale | Suggested follow-up |
| --- | --- | --- |
| Layout storage helpers (47–70) | Self-contained `localStorage` read/write | One PR: extract to `js/editor/editor-canvas-layout-storage-helper.js` |
| Geometry wrappers (96–120) | Pure calculation, no DOM | One PR: extract to `js/editor/editor-canvas-geometry.js` (may already exist as `EditorCanvasGeometry`) |

### Risky / defer sections

| Section | Why risky |
| --- | --- |
| Main render loop (355–640) | Core orchestration; node creation, edge drawing, affordance, selection — all interdependent |
| Layout mode toggle + transition | State machine coupled to storage, viewport, and render cycle |
| Interaction binding (drag, click, resize) | Event listeners coupled to viewport state and affordance lock |

---

## 4. `js/scout/scout-draft-ui.js` (632 lines)

### Public API / global side effects

- `window.LoveBudScoutDraftUI = { createScoutDraftUI }` — factory export at line ~630

### Major responsibility groups

| Group | Approx. lines | Description |
| --- | --- | --- |
| Module setup & debug helpers | 1–25 | `isScoutUIDebugEnabled()`, `scoutUIDebugLog()`, suggestion state tracking |
| `createScoutDraftUI()` factory | 35–100 | Dependency injection, ref management, open/close state |
| Form field error handling | 72–114 | `setError()`, `clearAllErrors()`, `setSuggestionState()`, `resetForm()` |
| Modal DOM creation | 116–265 | `createModalInDOM()` — builds entire Scout modal (header, intro, form fields, actions) |
| Open/close lifecycle | 267–351 | `openModal()`, `closeModal()`, ESC/outside-click handlers, field binding |
| Save handler | 353–402 | `handleSave()` — builds draft, validates, converts to payload, triggers callback |
| Suggestion handler | 404–462 | `handleSuggest()` — availability check, stub/live provider call, fills fields (no auto-save) |
| Preview overlay | 464–620 | `handlePreview()`, `showPreview()` — builds preview overlay with confirm/edit |

### DOM ownership

- Creates: `#scoutDraftModal` overlay, `#scoutDraftIntro`, `#scoutSourceUrlInput`, `#scoutExcerptTextarea`, `#scoutMemoTextarea`, `#scoutEmotionTagsInput`, `#scoutSuggestFeedback`, `#scoutPreviewOverlay`
- All DOM is created dynamically in `createModalInDOM()` and `showPreview()`
- Appends to `document.body`

### Runtime dependencies

- `window.LoveBudScoutDraft` (validation, build, parse)
- `window.LoveBudScoutSuggestionProvider` (availability, stub/live provider)
- `window.LoveBudScoutSuggestionSourceSelector` (source selector)
- `window.t` / i18n

### Test coverage anchors

- `tests/contracts/scout-toolbar-wiring-contract.test.cjs`
- `tests/contracts/scout-draft-suggestion-ui-contract.test.cjs`
- `tests/contracts/scout-draft-validation-contract.test.cjs`
- `tests/contracts/scout-moment-creation-copy-clarity-contract.test.cjs` (PR #2830)

### Low-risk extraction candidates

| Candidate | Rationale | Suggested follow-up |
| --- | --- | --- |
| Preview overlay (464–620) | Self-contained DOM creation, no shared mutable state with save flow | One PR: extract to `js/scout/scout-draft-preview-ui.js` |

### Risky / defer sections

| Section | Why risky |
| --- | --- |
| Modal DOM creation (116–265) | Single function builds the entire form; splitting requires careful lifecycle coordination |
| Suggestion handler (404–462) | Wired to stub/live provider; changes risk affecting Scout runtime behavior |
| Open/close lifecycle (267–351) | Manages refs, ESC handler, outside-click — tightly coupled to modal state |

---

## 5. `js/viewer/public-canvas-init.js` (618 lines)

### Public API / global side effects

- `window.getPublicCanvasBridge()` — bridge accessor at line ~592
- Writes: `window.LoveBudEditor.canEdit = false` (line ~365) — sets read-only flag
- **Idempotency guard**: checks `window[PUBLIC_CANVAS_MARKER]` and returns early if already initialized.

### Major responsibility groups

| Group | Approx. lines | Description |
| --- | --- | --- |
| Guard & utility | 1–15 | Idempotency check, `escapeHtml()` |
| Error/missing state factories | 19–85 | `createLoadFailureState()`, `createMissingRouteState()`, `appendMissingRouteState()`, `appendPublicLoadFailureState()`, `handlePublicCanvasLoadFailure()` |
| Runtime readiness check | 89–128 | `isPublicRuntimeReady()`, `waitForPublicRuntime()` — polls for required globals |
| Canvas adapter | 129–145 | `createPublicEditorCanvas()` — wraps `createEditorCanvas` with public-viewer adapter |
| Config & helpers | 145–265 | `resolvePublicCanvasTargets()`, `installPublicCanvasRuntimeProfile()`, `createPublicCanvasConfig()`, `createPublicCanvasEmptyGuideUpdater()`, `createPublicCanvasMemoryHelpers()`, `createPublicCanvasReadOnlyActions()`, `createPublicCanvasSelectionState()` |
| Detail UI options builder | 283–320 | `createPublicCanvasDetailUIOptions()` |
| Full options builder | 319–355 | `createPublicCanvasOptions()` — assembles all sub-configs |
| Read-only state install | 356–370 | `installPublicCanvasReadOnlyState()` |
| Post-init refresh | 377–405 | `initializePublicEditorCanvas()`, `runPublicCanvasPostInitRefresh()` |
| Toolbar compact mode | 407–425 | `installPublicCanvasToolbarCompactMode()` |
| Node click handler | 427–440 | `createPublicCanvasNodeClickHandler()` |
| Route setup | 444–460 | `setupPublicRoute()` |
| Bridge helpers | 457–468 | `isPublicCanvasBridgeReady()`, `extractPublicCanvasResult()` |
| Main init | 468–592 | `initPublicCanvas()` — orchestrator: route → data → canvas → detail UI → ready |

### DOM ownership

- Reads: query params via `URLSearchParams`
- Delegates canvas rendering to `createEditorCanvas`
- Delegates detail UI to `createPublicViewerDetailUI`
- Manipulates: toolbar compact mode via `matchMedia`

### Runtime dependencies

- `window.LoveBudPublicViewerCanvasEntry` (config namespace)
- `window.LoveBudPublicViewerCanvasAdapter`
- `window.createEditorCanvas`
- `window.createPublicViewerDetailUI`
- `window.currentTreeData`
- `window.apiClient`
- `window.LoveBudEditorUtils`
- `window.LoveBudEditorCanvasLayout`
- Auth: `window.auth`

### Test coverage anchors

- `tests/contracts/viewer-init-flow-contract.test.cjs`
- `tests/contracts/viewer-data-loader-contract.test.cjs`
- `tests/contracts/viewer-remaining-orchestration-contract.test.cjs`
- `tests/contracts/viewer-handler-factory-contract.test.cjs`
- `tests/contracts/viewer-click-actions-contract.test.cjs`
- `tests/contracts/viewer-retry-setup-contract.test.cjs`
- `tests/contracts/viewer-test-hooks-contract.test.cjs`

### Low-risk extraction candidates

| Candidate | Rationale | Suggested follow-up |
| --- | --- | --- |
| Error/failure state factories (19–85) | Self-contained DOM creation for error states | One PR: extract to `js/viewer/public-canvas-error-states.js` |
| Runtime readiness + polling (89–128) | Self-contained dependency check, no DOM mutation | One PR: extract to `js/viewer/public-canvas-readiness.js` |
| Toolbar compact mode (407–425) | Self-contained media query handler | One PR: fold into existing toolbar helper or extract as tiny utility |

### Risky / defer sections

| Section | Why risky |
| --- | --- |
| Main init orchestrator `initPublicCanvas()` (468–592) | Central coordinator; all sub-configs and wiring happen here |
| Config assembly (145–355) | Many small factories but deeply coupled to canvas entry config namespace |
| Bridge accessor | Used by viewer shell; interface change requires coordination with `view.js` / `pages/view.html` |

---

## Summary: Recommended follow-up split order

Priority is based on extraction risk (low-risk first) and impact (smaller, self-contained modules first).

### Phase 1 — Low-risk, self-contained extractions

| # | Module | Extraction | New file | Risk |
| --- | --- | --- | --- | --- |
| 1 | `public-viewer-detail-ui.js` | Image boundary (235 lines) | `js/viewer/public-viewer-detail-image.js` | LOW |
| 2 | `public-viewer-detail-ui.js` | Reaction summary boundary (120 lines) | `js/viewer/public-viewer-detail-reactions.js` | LOW |
| 3 | `public-viewer-detail-ui.js` | Tree meta boundary (120 lines) | `js/viewer/public-viewer-detail-tree-meta.js` | LOW |
| 4 | `public-canvas-init.js` | Error/failure state factories (65 lines) | `js/viewer/public-canvas-error-states.js` | LOW |
| 5 | `public-canvas-init.js` | Runtime readiness polling (40 lines) | `js/viewer/public-canvas-readiness.js` | LOW |

### Phase 2 — Moderate-risk, needs more careful integration testing

| # | Module | Extraction | New file | Risk |
| --- | --- | --- | --- | --- |
| 6 | `scout-draft-ui.js` | Preview overlay (160 lines) | `js/scout/scout-draft-preview-ui.js` | MEDIUM |
| 7 | `editor.js` | Auth redirect guard (~70 lines) | `js/editor/editor-auth-redirect.js` | MEDIUM |
| 8 | `editor-canvas.js` | Layout storage helpers (~25 lines) | `js/editor/editor-canvas-layout-storage-helper.js` | MEDIUM |

### Phase 3 — Defer (high coupling, orchestration-level)

| Module | Section | Why defer |
| --- | --- | --- |
| `editor.js` | `startEditor()` orchestrator | Central bootstrap chain; needs entry-dependency architecture review first |
| `editor-canvas.js` | Main render loop | Interdependent node/edge/affordance/selection |
| `editor-canvas.js` | Interaction binding | Coupled to viewport state and affordance lock |
| `public-viewer-detail-ui.js` | Orchestrator factory | Couples all boundary functions |
| `public-canvas-init.js` | Main init + config assembly | Central coordinator for viewer canvas |
| `scout-draft-ui.js` | Modal DOM creation | Single function builds entire form; lifecycle coordination needed |

---

## Acceptance verification

- [x] All 5 modules audited with public API / responsibility groups / DOM ownership / runtime deps / test coverage / extraction candidates / risky sections
- [x] Follow-up splits are one-file-at-a-time, not batch
- [x] No behavior changes in this audit slice
- [x] No bundle/runtime load order changes
- [x] No Scout live/runtime/provider changes
- [x] No My Trees / Browse parity changes
- [x] `#1882` remains open

## Validation commands

```bash
git diff --check HEAD
npm run verify
node --test tests/contracts/large-js-module-split-audit-contract.test.cjs
```
