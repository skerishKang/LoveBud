# Public viewer canvas entrypoint boundary

Issue: #1711

This note documents the current public viewer canvas boundary after the dead-dependency removal pass through PR #1791. It is intentionally audit-only and does not propose a runtime behavior change by itself.

## Current state

`pages/view.html` is now lighter than the original public viewer route, but it still reuses the editor canvas runtime for canvas creation, rendering, viewport behavior, node and edge rendering, layout mode handling, and interaction scaffolding.

The public viewer route now owns more of the read-only viewer shell and detail path, while the canvas path still depends on `js/editor/editor-canvas.js` and its canvas runtime dependencies.

## Current viewer-owned boundary

The viewer-owned scripts around the canvas path are:

- `js/viewer/public-canvas-mobile-profile.js`
- `js/viewer/public-canvas-mobile-layout.js`
- `js/viewer/public-canvas-affordance-fallback.js`
- `js/viewer/public-canvas-bridge.js`
- `js/viewer/public-canvas-init.js`
- `js/viewer/public-viewer-copy-helper.js`
- `js/viewer/public-viewer-control-visibility-helper.js`
- `js/viewer/public-viewer-copy-polish.js`

These scripts are transitional viewer adapters around the shared editor canvas runtime. They should be preserved until a viewer-specific canvas entrypoint owns the relevant public-only configuration directly.

## Remaining editor canvas runtime boundary

The remaining editor canvas scripts in `pages/view.html` should be treated as runtime dependencies, not dead scripts:

- `js/editor/editor-root-helpers.js`
- `js/editor/editor-canvas-layout.js`
- `js/editor/editor-canvas-node.js`
- `js/editor/editor-canvas-interaction.js`
- `js/editor/editor-canvas-viewport.js`
- `js/editor/editor-canvas-viewport-scale.js`
- `js/editor/editor-canvas-viewport-projection.js`
- `js/editor/editor-canvas-viewport-targets.js`
- `js/editor/editor-canvas-viewport-feedback.js`
- `js/editor/editor-canvas-viewport-state.js`
- `js/editor/editor-canvas-viewport-fit.js`
- `js/editor/editor-canvas-viewport-initial.js`
- `js/editor/editor-canvas-viewport-branches.js`
- `js/editor/editor-canvas-viewport-actions.js`
- `js/editor/editor-canvas-viewport-controls.js`
- `js/editor/editor-canvas-edges.js`
- `js/editor/editor-utils.js`
- `js/editor/editor-canvas-geometry.js`
- `js/editor/editor-canvas-layout-storage.js`
- `js/editor/editor-canvas-layout-transition.js`
- `js/editor/editor-canvas.js`

These should not be removed one-by-one without a replacement boundary, because the current public route still relies on editor canvas ownership for initialization and rendering behavior.

## Completed dead-dependency pass

The following public viewer runtime scripts have already been removed from `pages/view.html` and are guarded by `tests/routes/public-canvas-route-dependency-contract.test.cjs`:

- floating toolbar stack
- editor create/drop helpers
- editor save/empty-guide helpers
- canvas growth/branch affordance helpers
- editor detail UI stack replaced by viewer detail helpers
- `js/editor/editor-dom-selectors.js`
- `js/editor/editor-canvas-interaction-helpers.js`
- `js/editor/editor-canvas-state-boundary.js`
- `js/editor/editor-canvas-layout-helpers.js`

After this pass, no remaining canvas script should be considered removable solely because it has an editor-prefixed filename.

## Proposed staged direction

### Stage A: thin viewer canvas entry wrapper

Introduce `js/viewer/public-viewer-canvas-entry.js` as a thin wrapper around the existing editor canvas creation path.

This stage should not change behavior. Its purpose is to create a named viewer-owned boundary where public-only canvas options and setup can be centralized.

Expected constraints:

- Keep `js/editor/editor-canvas.js` loaded.
- Keep the current public API read path unchanged.
- Keep mobile structured layout behavior unchanged.
- Keep node and edge rendering unchanged.
- Keep the public route read-only.

### Stage B: move public-only boot configuration into the wrapper

Move public-only boot and read-only viewer options from scattered viewer patches into the wrapper where safe.

Candidate responsibilities:

- read-only canvas mode flags
- public viewer layout defaults
- public viewer control visibility defaults
- safe no-op affordance constructors where still needed

### Stage C: absorb mobile viewer patches

After the wrapper is stable, move the behavior currently represented by:

- `public-canvas-mobile-profile.js`
- `public-canvas-mobile-layout.js`

into the viewer canvas entry boundary or into explicitly named viewer canvas helpers.

This should only happen with regression coverage for phone-width public viewer behavior.

### Stage D: evaluate editor canvas runtime split

Only after the viewer entrypoint owns public-only boot behavior should the project evaluate whether the viewer can consume shared lower-level helpers directly, instead of loading the full editor canvas runtime.

Potential shared pieces may include:

- geometry
- layout
- node rendering
- edge rendering
- viewport projection/fit helpers

This is a later extraction step and should not be combined with the initial entrypoint wrapper.

## Guardrails

Any follow-up PR under #1711 should preserve these rules:

- No backend/API/schema changes.
- No CSS changes unless a separate visual regression task requires them.
- Do not remove `editor-canvas.js` until a viewer canvas replacement exists.
- Do not remove `editor-canvas-interaction.js` until interaction coupling is explicitly replaced or proven unnecessary.
- Do not remove viewport/layout/geometry scripts as a bundle without a replacement plan and route contract update.
- Keep private trees inaccessible through the public route.
- Keep public viewer read-only.
- Keep phone-width public viewer structured layout behavior.
- Do not introduce new `innerHTML`, `insertAdjacentHTML`, or `outerHTML`.
- Keep #1711 open until the lightweight entrypoint target is actually achieved.

## Recommended next PR after this audit

The safest next implementation PR is a thin wrapper PR:

- add `js/viewer/public-viewer-canvas-entry.js`
- load it immediately before `js/viewer/public-canvas-init.js`
- make it expose an inspectable namespace such as `window.LoveBudPublicViewerCanvasEntry`
- delegate to the existing editor canvas path without changing behavior
- add a route dependency contract assertion for the new wrapper and its load order

That PR should still keep `editor-canvas.js` and all required editor canvas runtime dependencies loaded.