# LoveBud Editor Entry Runtime Audit

**Date**: 2026-05-23
**Target File**: `js/editor.js`
**Objective**: Update inventory after phase 1 extraction, analyze remaining responsibilities, and define a roadmap for high-risk extractions (issue #1276).

---

## 1. Responsibility Inventory (Updated)

The `js/editor.js` orchestrator has been significantly slimmed down. Current state:

1. **Global Fallback & Utilities** (Partially Extracted):
   - Auth, i18n, toast, redirect helpers, and `escapeHtml` initialization remain.
   - *Extracted*: `getYouTubeInputErrorMessage` pure function.
2. **Data Loading & Sync** (Remains):
   - Orchestrating `loadInitialEditorTree` and `loadEditorMemories`.
   - Handling tree load errors (not found, access denied) and rendering fallbacks.
   - Injecting `normalizeMemory` dependencies.
3. **Sub-module Orchestration & Wiring** (Remains):
   - Bootstrapping sub-modules via `createEditorDetailUI`, `createEditorCanvas`, `createEditorMemoryActions`, and `createEditorMemoryForm`.
   - Wiring callbacks between these modules.
   - *Extracted*: `createEditorSaveStatusOrchestration` is now delegated.
4. **DOM Event Binding** (Partially Extracted):
   - Detail panel buttons and form control bindings remain.
   - *Extracted*: Sidebar tree visibility toggle (`updateSidebarTreeActions`, `bindSidebarVisibilityToggle`).
   - *Extracted*: Canvas empty state guide buttons and YouTube input parsing (`createMemoryFromCanvasUrl`).
5. **Application Lifecycle** (Remains):
   - Defining `startEditor` and guarding it with `tryStartEditor`.
   - Binding the application start to `onAuthReady` or `registerOnAuthReady`.

---

## 2. Completed Extractions Summary (Phase 1)

| Order | Module | PR | Extraction Rationale | Applied Pattern |
|---|---|---|---|---|
| 1 | `editor-utils.js` | #1473 | `getYouTubeInputErrorMessage` is a pure function with no external state dependencies. | `window.LoveBudEditorUtils` namespace with inline fallback. |
| 2 | `editor-save-status-ui.js` | #1474 | `createEditorSaveStatusOrchestration` directly manipulated DOM, cluttering entrypoint. | `window.LoveBudEditorSaveStatusUI` namespace, pure UI updates injected with dependencies. |
| 3 | `editor-sidebar-ui.js` | #1475 | Sidebar visibility toggle coupled UI with 409 API logic. | Injected `updateTreeVisibility` via closure-safe getter `getTreeId: () => treeId` to avoid stale state. |
| Pre | `addNodePosition` setter | #1476 | `viewportState.positions` was mutated directly by empty guide logic. | Added robust setter in `editor-canvas.js` to ensure encapsulation. |
| 4 | `editor-empty-guide-ui.js` | #1477 | Event bindings for empty canvas guide mutated canvas state and cluttered orchestration. | Removed direct mutation fallback, ensuring `addNodePosition` is used. DOM refs fetched inside module. |

---

## 3. Residual Responsibility Analysis

### A. Data Loading & Sync (Extraction Feasibility: ⚠️ Medium/High)
- `loadInitialEditorTree` and `loadEditorMemories` are tightly coupled to the initial state preparation and error handling (e.g., rendering "Tree Not Found").
- Extracting this into a `data-loader.js` module is feasible but requires careful handling of the `editorStarted` flag and error states to ensure the UI doesn't hang.

### B. Sub-module Orchestration / Instantiation (Extraction Feasibility: 🛑 High)
- Instantiating `editorCanvas`, `detailUI`, `memoryActions`, and `memoryForm` is the core role of `editor.js`.
- These modules require deeply interdependent callbacks (e.g., `initCanvas` must be passed to form actions, but form actions must be bound to the canvas UI).
- Completely removing this from `editor.js` might over-engineer the orchestrator into a complex DI container. It is recommended to keep basic wiring here while keeping it "thin".

### C. Application Lifecycle (`startEditor`) (Extraction Feasibility: 🛑 High)
- Tied directly to `onAuthReady`. Moving `tryStartEditor` out of `editor.js` risks breaking the initialization sequence, especially considering Firebase auth timing.
- **Verdict**: Lifecycle entry points should remain in `editor.js` to act as the ultimate `main()` function.

---

## 4. Future Refactoring Roadmap

To tackle the high-risk residual areas, the following roadmap is proposed:

1. **Phase 2 (Completed)**: Extract Data Fetching (`editor-data-loader.js`)
   - Removed 5 fallback factories and successfully delegated to `editorDataLoader` with fail-fast patterns.
2. **Phase 3 (On Hold)**: Thin out `editor.js` completely
   - **Status**: Hold
   - **Rationale**: The remaining 580 lines are primarily core orchestrator responsibilities (instantiating sub-modules, wiring callbacks, handling lifecycle). Further extraction risks over-engineering the entrypoint into a complex DI container.
   - **Resolution**: Adopt 580 lines as the new healthy baseline for `editor.js` instead of the original 500-line goal.
3. **Refine Sub-module Contracts (Ongoing Technical Debt)**:
   - Eliminate circular dependencies where `module A` requires a callback from `module B`, but `module B` needs `module A` to be initialized.
   - Use event emitters or explicit setter methods (like `addNodePosition` from PR #1476) instead of passing raw functions during initialization.
