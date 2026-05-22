# LoveBud Editor Canvas Runtime Audit

**Date**: 2026-05-22
**Target File**: `js/editor/editor-canvas.js`
**Objective**: Inventory responsibilities, analyze coupling, and define a safe extraction roadmap for issue #1277.

---

## 1. Responsibility Inventory

The `createEditorCanvas` factory in `editor-canvas.js` acts as a monolithic orchestrator managing ~920 lines of logic. Its responsibilities include:

1. **Rendering Lifecycle (`initCanvas`)**:
   - Clearing DOM nodes, branches, and affordances.
   - Determining the initial visible node (handling hidden system root logic).
   - Iterating `drawableMemories` to call `drawNode` and `drawBranchForMemory`.
2. **Node Lifecycle & UI Creation**:
   - Constructing node elements (`createNodeElement`) and attaching behavior (`attachNodeBehavior`, `bindNodeDrag`).
3. **Selection & Affordance State**:
   - Applying `.selected` class (`reapplySelection`).
   - Checking if selection is visible (`keepSelectionVisible`).
   - Managing hover timers and affordance UI rendering (`renderAffordanceForMemory`, `renderAffordanceForHoveredMemory`).
4. **Pan & Zoom (Viewport State)**:
   - Maintaining the central `viewportState` (scale, offsetX, offsetY).
   - Implementing zooming (`zoomBy`), recentering (`recenterViewport`), and focusing (`focusNodeById`).
   - Wiring global canvas panning events (`bindCanvasPan`).
5. **Layout Mode Management**:
   - Toggling and persisting structured vs. free layout (`switchToFreeMode`, `switchToStructuredMode`, `persistStoredPositions`).
   - Updating Layout UI icons and text (`updateLayoutToggleUI`).
6. **Interaction & Event Wiring**:
   - Mouse and touch event handling for dragging nodes (including move thresholds and click suppression).
   - Binding toolbar controls (`bindViewportControls`, `bindCompactModeToggle`).
7. **Resize & Mutation Observers**:
   - Reacting to window resize to ensure the selected node stays within the safe viewport (`bindResizeHandling`).

---

## 2. Coupling Risk Analysis

- **`viewportState` Closure Coupling**: Almost all functions directly read or mutate the `viewportState` closure variable. Extracting functions without carefully passing or encapsulating this state will break panning and zooming.
- **DOM & Metric Projections**: Logic heavily mixes world coordinates with DOM metrics. Functions like `getWorldPosition` and `calcPosition` rely on closures like `getCanonicalRootId` and `getMetrics`.
- **Global Object Fallbacks**: The code supports progressive overrides via `window.LoveBudEditorCanvasLayout`, `window.LoveBudEditorCanvasInteraction`, etc. This means extraction modules must respect these existing global fallback hooks to avoid regressions in already-extracted behaviors.
- **Touch/Mouse Event Complexities**: `bindNodeDrag` mixes standard `click` events with passive/active `touchstart`/`touchend` events. Extracting this requires extreme care to preserve tap-vs-drag threshold logic (`NODE_TAP_SELECT_THRESHOLD`).

---

## 3. Safest Extraction Order

To preserve runtime stability, responsibilities should be sliced from the "purest" to the most state-heavy:

1. **`editor-canvas-utils.js` (Pure Helpers)**
   - Extract `isNodeWithinSafeViewport`, `getWorldPosition`, and `calcPosition`.
2. **`editor-canvas-layout.js` (Storage & Mode Control)**
   - Extract `loadStoredLayout`, `persistLayoutMode`, and the mode switching orchestrations (`switchToFreeMode`, `switchToStructuredMode`).
3. **`editor-canvas-panzoom.js` (Viewport Orchestration)**
   - Encapsulate `viewportState`.
   - Extract `zoomBy`, `recenterViewport`, `focusNodeById`, and the viewport event bindings (`bindCanvasPan`, `bindViewportControls`).
4. **`editor-canvas-selection.js` (Affordance & Focus)**
   - Extract hover timer logic, affordance visibility logic, and `keepSelectionVisible`.
5. **`editor-canvas-renderer.js` (DOM Lifecycle)**
   - Extract `initCanvas`, `drawNode`, `bindNodeDrag` into a dedicated node factory that coordinates with the above modules.

---

## 4. Dangerous Regression Points

- **Local Storage Deserialization**: Modifying how `positions` are read/written could inadvertently clear users' meticulously arranged "Free Layout" positions.
- **Drag vs. Click Collision**: Changes to `dataset.skipNextClick` or `dataset.suppressClick` in `touchend` or `mouseup` handlers often cause double-triggering or unresponsive node clicks on mobile devices.
- **Infinite Rendering Loops**: Re-triggering `initCanvas` inside pan/drag events without proper RAF (Request Animation Frame) debouncing could freeze the browser.
- **Hidden Root Assumption**: The logic (`findInitialVisibleMemory`) explicitly handles `parentId === null` as a hidden system root. Changing this breaks the initial canvas view for newly loaded trees.

---

## 5. Recommended Future Module Map

Once the extraction is complete, the `js/editor/` directory should reflect this architecture:

```text
js/editor/
├── editor-canvas.js                  # Thin orchestrator hooking modules together
├── editor-canvas-utils.js            # Projection, bounds checking, shared constants
├── editor-canvas-layout.js           # localStorage management, structured/free modes
├── editor-canvas-panzoom.js          # Viewport transform, scale, drag-to-pan
├── editor-canvas-selection.js        # Selection tracking, hover timers, branch port sync
└── editor-canvas-renderer.js         # Node DOM creation, event bindings, initCanvas loop
```
