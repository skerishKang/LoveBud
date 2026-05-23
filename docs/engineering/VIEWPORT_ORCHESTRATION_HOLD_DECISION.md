# Viewport Orchestration Hold Decision

This document details the architectural decisions, current modular state, and stabilization criteria for `js/editor/editor-canvas-viewport.js` under Issue #1505.

---

## 1. Current State: Orchestration Shell

`editor-canvas-viewport.js` has been successfully refactored from a large, multi-responsibility file into a thin **orchestration shell**. 

- **State Retention**: It retains only basic constant configurations (`minScale`, `maxScale`, `zoomLevels`) and default configuration templates (`readableCenter`).
- **Delegation Wrapper**: All functional logic and operations have been extracted into focused, single-responsibility helper modules. The core object delegating these APIs acts as a wrapper layer.

### Extracted Viewport Helpers Inventory

| Stage | Helper File Path | Namespace | Extracted API(s) / Responsibility |
| :--- | :--- | :--- | :--- |
| **Stage 35** | `editor-canvas-viewport-controls.js` | `window.LoveBudEditorCanvasViewportControls` | Mouse wheel / trackpad / drag controls binding |
| **Stage 36** | `editor-canvas-viewport-actions.js` | `window.LoveBudEditorCanvasViewportActions` | Actions like `focusNodeById`, `recenterViewport`, `zoomBy` |
| **Stage 37** | `editor-canvas-viewport-branches.js` | `window.LoveBudEditorCanvasViewportBranches` | Connection lines / branch SVG path rendering |
| **Stage 38** | `editor-canvas-viewport-fit.js` | `window.LoveBudEditorCanvasViewportFit` | Calculating center offsets and fits (`getReadableViewportOffset`, `getFitViewport`) |
| **Stage 39** | `editor-canvas-viewport-state.js` | `window.LoveBudEditorCanvasViewportState` | Viewport boundaries extreme checks and application (`applyViewport`) |
| **Stage 40** | `editor-canvas-viewport-feedback.js` | `window.LoveBudEditorCanvasViewportFeedback` | Alert notifications when viewport zoom limits are met |
| **Stage 41** | `editor-canvas-viewport-initial.js` | `window.LoveBudEditorCanvasViewportInitial` | Calculating initial tree visibility positioning |
| **Stage 42** | `editor-canvas-viewport-scale.js` | `window.LoveBudEditorCanvasViewportScale` | Scale clamping and zooming levels calculations |
| **Stage 43** | `editor-canvas-viewport-projection.js` | `window.LoveBudEditorCanvasViewportProjection` | Coordinate projection (world coordinate $\rightarrow$ screen canvas) |
| **Stage 44** | `editor-canvas-viewport-targets.js` | `window.LoveBudEditorCanvasViewportTargets` | Finding target memories to fit on screen |

---

## 2. Hold Decision: Stop Further Decomposition

To balance modularity and maintainability, **no further extraction or code changes** will be performed on `editor-canvas-viewport.js` under this issue. Specifically:

1. **Keep Configs Local**: Configuration variables such as `minScale`, `maxScale`, `zoomLevels`, and the template `readableCenter` are tightly coupled with the editor page configuration. Moving them to separate runtime modules introduces overhead without benefits.
2. **Preserve Wrapper Contracts**: The wrapper methods (e.g., `window.LoveBudEditorCanvasViewport.getScale()`) must remain in place to maintain API compatibility for other modules (`editor.js`, `editor-canvas-interaction.js`, etc.) that query coordinate states.
3. **No Direct Import Transition**: The script loading model remains script-tag-based. Converting to module-import patterns is deferred to prevent loading timing/CORS regressions.

---

## 3. Regression Prevention Safeguards

Two critical rules guarantee that modifications to the viewport subsystem do not cause breaking changes:

### A. Script Load Order Integrity
The scripts in `pages/editor.html` must be loaded in the exact dependency order verified by contracts. Any modification to this order may cause references to undefined namespaces during initialization:

1. `editor-canvas-viewport.js` (Orchestrator core namespace setup)
2. `editor-canvas-viewport-scale.js`
3. `editor-canvas-viewport-projection.js`
4. `editor-canvas-viewport-targets.js`
5. `editor-canvas-viewport-feedback.js`
6. `editor-canvas-viewport-state.js`
7. `editor-canvas-viewport-fit.js`
8. `editor-canvas-viewport-initial.js`
9. `editor-canvas-viewport-branches.js`
10. `editor-canvas-viewport-actions.js`
11. `editor-canvas-viewport-controls.js`
12. `editor-canvas-edges.js`

### B. Namespace Missing Fallbacks
All delegation wrappers in the orchestrator shell must maintain null-safety checks:
```javascript
if (!window.LoveBudEditorCanvasViewportHelper || typeof window.LoveBudEditorCanvasViewportHelper.method !== 'function') {
  // Graceful fallback returns or math inline operations
}
```
This ensures that the editor interface remains robust and doesn't crash even if some files fail to load due to network conditions.

---

## 4. Testing & Verification Principles

Any future changes touching the viewport subsystem must adhere to:
1. **Contract Tests First**: Prioritize adding/verifying assertion checks inside `tests/contracts/editor-viewport-math-contracts.test.cjs` (e.g. arity checks, VM sandbox isolations, and script tag pattern regex matchers).
2. **Browser Smoke Tests**: Verify visually that the tree canvas centers correctly upon loading, zoom operations snap to presets, and branch port lines draw between parent-child memory card nodes without offsets.
