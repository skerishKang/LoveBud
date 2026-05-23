# Layout Mode Transition Preflight Audit

This document details the preflight analysis and architectural decomposition plan for layout mode transitions in `js/editor/editor-canvas.js` under **Issue #1505**.

---

## 1. Target Functions & Orchestration

The core layout mode transition operations to be audited are:

- `switchToFreeMode()`: Switches the canvas to free layout mode, restores any saved positions or stored positions from storage, and refreshes the UI and canvas renderer.
- `switchToStructuredMode()`: Saves the current node positions as the active free layout draft, switches the canvas to structured layout mode, and triggers redraws.
- `setLayoutMode(mode)`: Orchestrates switching by calling structured/free modes based on parameter arguments.
- `toggleLayoutMode()`: A convenience toggle between structured and free layout modes.
- `updateLayoutToggleUI()`: Triggers DOM UI updates based on the current layout mode.

---

## 2. Dependencies & Coupling Analysis

### DOM and CSS Class Dependencies
- **UI Helper Calls**: Invokes `uiHelpers.applyLayoutModeClasses(mode)` and `uiHelpers.updateLayoutToggleUI(mode, i18n)`. These touch elements like `#canvasArea`, `#canvasContainer`, and `.layout-toggle`.
- **Canvas State**: Binds state classes (such as layout mode styles) to root nodes or container structures.

### Storage & Persistence Coupling
- **Persistence Hooks**: Integrates with `persistLayoutMode(mode)`, `loadStoredLayout()`, and `persistStoredPositions()` (which are thin delegations to `LoveBudEditorCanvasLayoutStorage`).
- **Positions Buffer**: Manipulates local state variables `savedFreePositions`, `storedFreePositions`, and `viewportState.positions`.

### Render Refreshes & Calculations
- **Redraw Triggers**: Calls `fitViewportToTree()` and `initCanvas()` (which schedules the `requestAnimationFrame` loop).

---

## 3. Public Contracts & Namespaces

- **Returned Interfaces**: `setLayoutMode` is exposed directly by the API returned from `createEditorCanvas(deps)`.
- **Global / Legacy Bridges**: Interlocks with `window.LoveBudEditorCanvas` and `window.LoveBudEditor` rendering refresh triggers.

---

## 4. Contract Tests Checklist (Stage 50 Draft)

When splitting these components, the contract tests must verify:
- API parameters arity for `setLayoutMode(mode)`.
- Correct propagation of class toggles to mock helper objects.
- Integration test for state transitioning (e.g. `structured` <=> `free` state toggling) and correct side-effects mapping.
- Validation that positions buffer copies are safely cloned rather than mutated directly.

---

## 5. Browser Smoke Checklist

Verification of these transitions requires confirming:
1. **Initial Mode Restore**: Reloading the editor page properly restores the last layout mode class (`free` or `structured`) on the DOM.
2. **Toggle Button click**: Clicking the layout toggle switches between mode views, changes CSS classes, and updates toolbar indicator copy.
3. **Nodes Persistence**: Dragging nodes in free mode, switching to structured mode, and switching back to free mode restores the free coordinates.
4. **Console Errors**: No runtime uncaught exceptions when clicking layout toggle repeatedly.

---

## 6. Risk Level & Narrow Slice Candidates

- **Risk Level**: **Medium** (Layout transitions coordinate persistence, DOM status, i18n copy updating, and canvas re-renders simultaneously).

### Proposed Stage 51 Narrow Slice Candidate:
- **Component**: `js/editor/editor-canvas-layout-transition.js`
- **Scope**: Extract `switchToFreeMode`, `switchToStructuredMode`, `setLayoutMode`, `toggleLayoutMode`, and `updateLayoutToggleUI` into a dedicated helper module. Maintain the public `setLayoutMode` delegation wrapper in `editor-canvas.js`.
