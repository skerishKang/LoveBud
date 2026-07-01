# LoveBud Tree Workspace Node Keyboard Accessibility Contract

## Status and scope
* **Status**: Initial Planning Contract. No active code modifications have been made to UI markup, styles, event listeners, or schemas in this planning slice.
* **Scope**: Keyboard navigation and focus modeling contract for moment nodes in the Editor and Viewer workspaces.

## Audit method and evidence standard
* **Audit Method**: Analysis of source files (`js/editor/editor-canvas-node.js`, `js/editor/editor-canvas.js`, `js/viewer/public-canvas-init.js`) and route templates.
* **Evidence Standard**: Every verified claim includes exact file paths, DOM selectors, or function signatures.

## Editor node rendering and interaction inventory
* **Element type**: HTML `div` element with class name `memory-node floating-node`.
* **Provider**: `js/editor/editor-canvas-node.js` (`nodeHelpers.createNodeElement`).
* **Child structure**: Renders a card layout using `.node-card`, containing a `.node-img-wrapper`, a `.node-skeleton`, and a child `img` element.
* **Initial accessible attributes**:
  * `tabIndex = 0` (via line 78)
  * `role = "button"` (line 79)
  * `aria-label = safeTitle + ' 선택'` (line 82)
* **Route ownership**: Editor Route (`pages/editor.html`).

## Public Viewer node rendering and interaction inventory
* **Element type**: HTML `div` element with class name `memory-node floating-node`.
* **Provider**: Shares the exact same module file dependency `js/editor/editor-canvas-node.js` loaded via script tag in `pages/view.html` (line 49).
* **Initial accessible attributes**: Same as Editor (shares `setupNodeElement`).
* **Route ownership**: Viewer Route (`pages/view.html`).

## Existing pointer, selection, and detail-panel paths
* **Pointerdown Event**: Bound in `js/editor/editor-canvas.js` (line 455) via `uiHelpers.bindNodePointerSelection()`.
* **Selection State update**: Calls `selectMemoryNode()` which delegates to `selectionUtils.reapplySelection()` to apply the `.selected` class.
* **Detail Panel update**: Invokes `updateDetailPanel(mem)` which mounts information into the side panel templates without database query layout mutations.

## Existing keyboard and focus behavior
* **Arrow navigation**: Keyboard listeners are bound in `js/editor/editor-canvas.js` via `uiHelpers.bindNodeControlShortcuts` which delegates arrow triggers to `navigateNodeByOffset`.
* **Roving tabindex**: Currently absent; all nodes are statically initialized with `tabIndex = 0`, causing tab key explosion on large datasets.
* **Conflicts**: Canvas pan/zoom gestures are handled via D3/panzoom listeners in `js/editor/editor-canvas-viewport.js` and do not conflict with keyboard navigation focus models.

## Needs runtime/browser verification
* Multi-touch mobile zoom interaction behaviors.
* Browser-specific voiceover announcements of dynamic `aria-live` state updates.

## Recommended semantic host and focus model
* **Selected model**: `single-entry roving tabindex model`.
* **Why**: Renders as standard HTML `div` overlays which allow roving tabindex without SVG accessibility tree limitations. Roving tabindex avoids Tab key explosion across dense nodes by maintaining only a single focusable entry point (`tabindex="0"`) and setting all others to `tabindex="-1"`.

## Keyboard interaction contract
* **initial focus entry**: Tab key enters the canvas focusing the root memory node (`tabindex="0"`).
* **Arrow navigation**: Arrow keys move focus adjacent to the current node, shifting `tabindex="0"` dynamically.
* **Home/End behavior**: Home focuses the root node; End focuses the leaf node at the maximum depth.
* **Enter/Space behavior**: Triggers node selection and opens the detail panel.
* **Escape behavior**: Clears selection and returns focus to the root canvas container.
* **detail panel open focus ownership**: Shifting focus to the sidebar detail panel header.
* **detail panel close focus return**: Focus returns cleanly to the active moment node trigger.
* **selection versus focus distinction**: Focused nodes show a dashed focus ring; selected nodes possess the `.selected` class with a solid visual outline.
* **no write/no layout mutation guarantee**: Keyboard navigation must never write to database schemas or change spatial layouts.
* **reduced motion handling**: Transition animations are disabled under user prefers-reduced-motion profiles.

## Selection, detail-panel, and focus-return contract
* Selecting a node opens the detail panel. Closing the detail panel or pressing Escape returns focus to the active node.

## Privacy-safe accessible-name contract
* **Prohibited metadata**:
  * private memo full text
  * raw source URLs
  * owner-only groupName
  * owner-only keywords
  * internal IDs
  * hidden moderation state
  * private media metadata
* **Permitted sources**: `sanitizeTitle(mem.title, '')` only.

## Canvas, drag, pan, zoom, and mobile conflict boundaries
* Arrow keys are ignored when edit mode drag workflows are active. Space/Enter triggers are bypassed during active canvas pan/zoom transforms.

## Protected and delegated ownership
* #3072 — mobile/touch shell policy
* #2960 — protected detail-panel composition
* #2972 — shared media-playback boundary
* #2976 — dynamic-copy centralization boundary
* #3121 — icon-only controls audit
* #1882 — parent product issue

## First implementation slice
* **Exact files**: `js/editor/editor-canvas.js` and `js/viewer/public-canvas-init.js`.
* **Route-local focused test**: `tests/contracts/tree-workspace-node-keyboard-accessibility-contract.test.cjs`.
* **Protected boundary relationship**: Respects all protected boundaries with no touch gesture mutations.

## Regression coverage and browser-validation plan
* Validate roving tabindex changes dynamically on arrow key triggers. Assert focus is restored to the selected node trigger upon closing panels.

## Explicit non-goals
* No HTML, JavaScript, CSS, API, data-model, schema, migration, deployment, Scout, or authentication-policy change in this audit slice.

## References
* Refs #3124
* Refs #3072
* Refs #2960
* Refs #2972
* Refs #2976
* Refs #3121
* Refs #1882
