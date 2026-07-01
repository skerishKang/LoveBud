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
### Existing selection activation
- Pointer selection is activated by `click` and qualified `touchend` in `bindNodePointerSelection()`.
- `pointerdown` and `mousedown` are drag-start events through `bindNodeDragStart()`, not node-selection events.
- Free-layout drag suppression prevents a moved node from immediately reselecting through its follow-up click path.

## Existing keyboard and focus behavior
### Editor current keyboard evidence
- Editable desktop Editor nodes support Arrow-based sequential navigation when focus is already on a node.
- Enter and Space activate node selection.
- All generated nodes currently have `tabIndex = 0`.

### Public Viewer current keyboard evidence
- Public Viewer reuses the HTML node host and Enter/Space activation path.
- Its canvas configuration sets `canEdit: false`.
- Current Editor Arrow navigation guard therefore does not enable Arrow navigation in public Viewer.
- Viewer Arrow parity is a proposed implementation requirement, not existing behavior.

## Needs runtime/browser verification
* keyboard interaction during an active drag;
* focus behavior after pan/zoom or rerender;
* touch and multi-touch coexistence;
* reduced-motion behavior;
* VoiceOver/NVDA announcement behavior.

## Recommended semantic host and focus model
* **Selected model**: `single-entry roving tabindex model`.
* **Why**: Renders as standard HTML `div` overlays which allow roving tabindex without SVG accessibility tree limitations. Roving tabindex avoids Tab key explosion across dense nodes by maintaining only a single focusable entry point (`tabindex="0"`) and setting all others to `tabindex="-1"`.

## Keyboard interaction contract
### Verified current behavior
- Enter and Space trigger node selection.

### Proposed implementation contract
- **initial focus entry**: Tab key enters the canvas focusing the root memory node (`tabindex="0"`).
- **Arrow navigation**: Arrow keys move focus adjacent to the current node, shifting `tabindex="0"` dynamically.
- **Home/End behavior**: Home focuses the root node; End focuses the leaf node at the maximum depth.
- **Escape behavior**: Clears selection and returns focus to the root canvas container.
- **reduced-motion focus transition behavior**: Transition animations are disabled under user prefers-reduced-motion profiles.

## Selection, detail-panel, and focus-return contract
### Proposed implementation contract
- **detail panel open focus ownership**: Shifting focus to the sidebar detail panel header.
- **detail panel close focus restoration**: Focus returns cleanly to the active moment node trigger.
- **selection versus focus distinction**: Focused nodes show a dashed focus ring; selected nodes possess the `.selected` class with a solid visual outline.
- **no write/no layout mutation guarantee**: Keyboard navigation must never write to database schemas or change spatial layouts.

## Privacy-safe accessible-name contract
### Verified current behavior
- The current node `aria-label` uses sanitized title plus a selection action phrase (`sanitizeTitle(mem.title, '') + " 선택"`).
- Displayed node information in `js/editor/editor-canvas-node.js` can include timestamp and memo-derived highlight text, but this memo-derived highlight text must not become part of the accessible node name.

### Proposed implementation contract
* **Editor owner route**:
  * accessible name may use the sanitized node title visible to that owner;
  * it must not concatenate memo-derived highlight text, raw URLs, hidden identifiers, or owner-only grouping metadata.
* **Public Viewer route**:
  * accessible name may use only the sanitized title provided in the public Viewer payload;
  * it must never expose non-public metadata even when shared rendering helpers are reused.

Any richer future naming must remain route-specific and privacy-gated.

## Canvas, drag, pan, zoom, and mobile conflict boundaries
### Verified static evidence
- Canvas panning ignores events originating within `.memory-node`.
- Free-layout node drag starts through `mousedown` / `pointerdown`.
- Editor Arrow handling is limited to editable desktop nodes and excludes specific form/dialog/toolbar targets.

## Protected and delegated ownership
* #3072 — mobile/touch shell policy
* #2960 — protected detail-panel composition
* #2972 — shared media-playback boundary
* #2976 — dynamic-copy centralization boundary
* #3121 — icon-only controls audit
* #1882 — parent product issue

## First implementation slice
* **Exact files**:
  * `js/editor/editor-canvas-node.js`: initial tabindex, role, aria-label host
  * `js/editor/editor-canvas-ui-helpers.js`: keyboard event behavior and focus utility boundary
  * `js/editor/editor-canvas.js`: Editor selection, Arrow navigation, rerender synchronization
  * `js/viewer/public-canvas-init.js`: Viewer canEdit:false behavior and route-specific keyboard parity wiring
* **CSS focus-indicator**: implementation discovery required (do not hardcode static paths).
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
