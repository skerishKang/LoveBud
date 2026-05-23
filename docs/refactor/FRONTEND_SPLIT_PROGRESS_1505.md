# Frontend Split Progress for Issue #1505

This document tracks the overall progress of decomposing oversized frontend modules under **Issue #1505**.

---

## 1. Completed: Viewport Modularization (Stages 35~46)

The modularization of `js/editor/editor-canvas-viewport.js` has been successfully completed. What was once a high-complexity module has been refactored into a thin **orchestration shell** delegating to 10 isolated helper scripts.

### Stages 35~44: Helper Extractions

| Stage | Helper File Path | Namespace | Extracted API / Responsibility |
|:---|:---|:---|:---|
| **Stage 35** | `editor-canvas-viewport-controls.js` | `window.LoveBudEditorCanvasViewportControls` | Interaction controls & event bindings |
| **Stage 36** | `editor-canvas-viewport-actions.js` | `window.LoveBudEditorCanvasViewportActions` | Actions like zoom, recenter, focus |
| **Stage 37** | `editor-canvas-viewport-branches.js` | `window.LoveBudEditorCanvasViewportBranches` | Connection paths rendering |
| **Stage 38** | `editor-canvas-viewport-fit.js` | `window.LoveBudEditorCanvasViewportFit` | Offset and fit-scale calculations |
| **Stage 39** | `editor-canvas-viewport-state.js` | `window.LoveBudEditorCanvasViewportState` | Viewport application & boundaries |
| **Stage 40** | `editor-canvas-viewport-feedback.js` | `window.LoveBudEditorCanvasViewportFeedback` | Alert banners for zoom extremes |
| **Stage 41** | `editor-canvas-viewport-initial.js` | `window.LoveBudEditorCanvasViewportInitial` | Initial tree visibility positioning |
| **Stage 42** | `editor-canvas-viewport-scale.js` | `window.LoveBudEditorCanvasViewportScale` | Scale presets calculations |
| **Stage 43** | `editor-canvas-viewport-projection.js` | `window.LoveBudEditorCanvasViewportProjection` | Coordinate projection (world $\rightarrow$ canvas) |
| **Stage 44** | `editor-canvas-viewport-targets.js` | `window.LoveBudEditorCanvasViewportTargets` | Target memories filtration |

### Stage 45: Contract Reinforcement
- Added comprehensive unit tests in `tests/contracts/editor-viewport-math-contracts.test.cjs` covering:
  - Property existence checks (`zoomLevels`, `minScale`, `maxScale`, `readableCenter`).
  - Strict arity signature checks for all wrapper delegation APIs.
  - Fallback safety verification checking that the orchestrator shell continues to function correctly without crashes even if helper scripts fail to load.
  - Script load sequence integrity verification.

### Stage 46: Hold Decision
- Documented hold-decision in `docs/engineering/VIEWPORT_ORCHESTRATION_HOLD_DECISION.md`.
- Viewport subsystem decomposition is officially **closed**. Further changes to `viewport.js` runtime/helpers under #1505 are frozen.

---

## 2. Next Oversized Frontend Candidates

Following the completion of the viewport track, future stages under Issue #1505 should target the remaining oversized candidate modules.

| File Path | Lines | Type | Risk | Current mixed responsibilities |
|:---|---:|:---|:---|:---|
| `js/editor/editor-canvas.js` | 1,154 | JS | High | Canvas events, node rendering, pan/drag coordination, layout modes |
| `js/auth.js` | 767 | JS | High | Auth bridges, session caches, Firebase config, login providers |
| `js/my-trees/my-trees-ui.js` | 697 | JS | Medium | Card render templates, stats calculations, scroll pagination |
| `js/editor.js` | 643 | JS | Medium-High | Editor DOM events, form inputs serialization, data-loader binding |
| `js/search/search-preview-renderer.js` | 638 | JS | Medium | Browse flow card templates, preview panel toggle state handlers |

### Recommendations for Future Stages
1. **Stage 48 Preflight Audit**: Conducted a responsibility-mapping audit on `js/editor/editor-canvas.js` (the largest remaining file) prior to structural refactoring. See [EDITOR_CANVAS_PREFLIGHT_AUDIT_1505.md](./EDITOR_CANVAS_PREFLIGHT_AUDIT_1505.md).

2. **Strict PR Boundaries**: Ensure each PR represents exactly one narrow delegation step.
3. **No Direct Import/Module Transition**: Maintain the existing global-load orchestrator script-tag model unless explicit permissions are given.
