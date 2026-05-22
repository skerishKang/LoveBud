# LoveBud Editor Entry Runtime Audit

**Date**: 2026-05-22
**Target File**: `js/editor.js`
**Objective**: Inventory responsibilities, analyze coupling, and define a safe extraction roadmap for issue #1276.

---

## 1. Responsibility Inventory

The `js/editor.js` file acts as the monolithic orchestrator for the editor page, spanning over 700 lines. Its responsibilities include:

1. **Global Fallback & Utilities**:
   - Initializing `LoveBudEditorUtils` (`findRootMemory`, `isRootMemory`, etc.).
   - Initializing auth, i18n, toast, redirect helpers, and `escapeHtml`.
   - **Inline Logic**: `getYouTubeInputErrorMessage` for URL parsing and validation.
2. **Data Loading & Sync**:
   - Orchestrating `loadInitialEditorTree` and `loadEditorMemories`.
   - Handling tree load errors (not found, access denied) and rendering fallbacks.
   - Injecting `normalizeMemory` dependencies.
3. **Sub-module Orchestration & Wiring**:
   - Bootstrapping sub-modules via `createEditorDetailUI`, `createEditorCanvas`, `createEditorMemoryActions`, and `createEditorMemoryForm`.
   - Wiring callbacks between these modules (e.g., passing `initCanvas` to form/actions).
   - **Inline Logic**: `createEditorSaveStatusOrchestration` controlling save status DOM elements directly.
4. **DOM Event Binding**:
   - Sidebar tree visibility toggle (Public/Private switch).
   - Canvas empty state guide buttons and YouTube input parsing (`canvasEmptyStartBtn`, `canvasEmptyYoutubeInput`, `canvasEmptyTextStartBtn`).
   - Detail panel buttons and form control bindings.
5. **Application Lifecycle**:
   - Defining `startEditor` and guarding it with `tryStartEditor`.
   - Binding the application start to `onAuthReady` or `registerOnAuthReady`.

---

## 2. CTO Directives & Additional Investigations

### Extraction Candidate Re-classification

| Candidate | CTO Assessment | Reason |
|---|---|---|
| `getYouTubeInputErrorMessage` | ✅ **Priority 1 Extraction** | Completely pure function, zero external state dependencies. |
| Canvas Empty Guide Handlers | ⚠️ **Medium Risk** | `createMemoryFromCanvasUrl` directly mutates `editorCanvas.viewportState.positions` and invokes `initCanvas`/`focusNodeById`. Highly coupled to canvas state. |
| Sidebar Visibility Toggle | ⚠️ **Medium Risk** | Contains critical business logic (calling `updateTreeVisibility` API) and integrates with publication guards (409 errors). |

### Additional Investigations

**1. DOM Control in `createEditorSaveStatusOrchestration`**
- **Findings**: The orchestration heavily manipulates DOM elements (`saveStatusIndicator`, `saveStatusIcon`, `saveStatusText`, `lastSavedTime`).
- **Verdict**: It **CAN** be safely extracted to a separate module (e.g., `editor-save-status-ui.js`). It only depends on pure functions (`i18n`, `formatTimeAgo`), so it doesn't need to stay in the orchestrator.

**2. `startEditor` Entry Point Analysis**
- **Findings**: The only invocation path to `startEditor` is through the `tryStartEditor` function.
- **Verdict**: `tryStartEditor` is strictly bound to `window.registerOnAuthReady` (or `window.onAuthReady` fallback). There are **no other** entry points. It relies exclusively on the authentication state resolution.

**3. Boundary Contract: `js/editor.js` ↔ `js/editor/editor-canvas.js`**
- **editor.js → editor-canvas.js (Downstream Calls)**:
  - `editorCanvas.initCanvas()` (Triggered after data changes or memory creation)
  - `editorCanvas.focusNodeById()` (Triggered from detail panel or empty canvas guide)
  - `editorCanvas.calcPosition`, `editorCanvas.drawNode`, `editorCanvas.drawBranch` (Passed to memory form module)
  - `editorCanvas.viewportState.positions` (Direct mutation by empty canvas guide)
  - `editorCanvas.persistStoredPositions()`
  - `editorCanvas.updateAffordance()`
- **editor-canvas.js → editor.js (Upstream Callbacks)**:
  - `getTreeMemories`, `getCanonicalRootId`, `isRootMemory` (State reads)
  - `resolveMemoryThumbnail` (Helper dependency)
  - `updateDetailPanel`, `setDetailEmptyState`, `updateFocusSelectedBtn` (UI synchronizations)
  - `createInitialMemory` (State mutation factory)
  - `onNodeClick` (Event delegation)
  - `openAddMoment` (Event delegation)

---

## 3. Coupling Risk Analysis

- **Canvas State Mutation**: Inline functions like `createMemoryFromCanvasUrl` directly mutate `editorCanvas.viewportState.positions`. Moving this requires defining a clear API contract on `editor-canvas` to handle new node placement.
- **Event Listener Bindings**: Handlers for sidebar and empty canvas are bound directly to DOM IDs inside `editor.js`. 
- **API Call Inline Integration**: The visibility toggle integrates UI loading states directly with `updateTreeVisibility`.

---

## 4. Safest Extraction Order

1. **`editor-utils.js` (Pure Helpers)**
   - Extract `getYouTubeInputErrorMessage` immediately.
2. **`editor-save-status-ui.js` (DOM Feedback)**
   - Extract `createEditorSaveStatusOrchestration` to remove hardcoded DOM updates from the entrypoint.
3. **`editor-sidebar-ui.js` (Stateful UI Components)**
   - Extract visibility toggle logic, injecting `updateTreeVisibility` and `showToast` as dependencies.
4. **`editor-empty-guide-ui.js` (Canvas Integration)**
   - Extract canvas empty state logic, ensuring `viewportState` mutation is replaced by a safer setter method on the canvas module.

---

## 5. Dangerous Regression Points

- **Modifying `startEditor` Timing**: Altering when `startEditor` fires relative to `onAuthReady` can cause race conditions with Firebase auth initialization.
- **Breaking `window` Callbacks**: Fallbacks check for `window.LoveBudEditorCanvas`, etc. Any extraction must properly register to `window` for backward compatibility.
- **Circular Dependencies**: Passing `initCanvas` into form logic while form logic triggers `createMemory` could easily lead to infinite renders if not careful.
