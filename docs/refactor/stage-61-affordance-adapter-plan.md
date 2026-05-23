# Stage 61 Plan — Extract Editor Canvas Affordance Adapter

Refs #1505

## Purpose

Stage 56–60 intentionally used micro-delegation to lock risky layout-mode transition contracts. That made regression risk low, but it did not materially reduce `js/editor/editor-canvas.js` line count.

Stage 61 must change direction from call-level delegation to a medium-sized responsibility extraction.

## Mandatory Stage 61 Direction

Do **not** create another micro-delegation PR.

Stage 61 should extract the canvas affordance responsibility from `js/editor/editor-canvas.js` into a dedicated adapter/helper module.

Recommended new file:

```text
js/editor/editor-canvas-affordance-adapter.js
```

## Target responsibility

Move the wrapper/adapter logic around:

- `renderAffordanceForMemory`
- `renderAffordanceForHoveredMemory`
- `clearGrowthAffordance`
- `openAddMomentFromCanvas`
- `getGrowthAffordancePosition`
- `drawGrowthAffordanceBranch`
- `createGrowthAffordanceElement`
- `renderGrowthAffordance`
- `updateAffordance`

The exact final function list may be adjusted after local inspection, but the extraction must remain focused on affordance behavior only.

## Expected impact

Target reduction from `js/editor/editor-canvas.js`:

```text
at least 100 lines
preferred 120–160 lines
```

A PR that only delegates one or two calls is not acceptable for Stage 61.

## Safety constraints

Do not move:

- `initCanvas` body
- `switchToFreeMode`
- `switchToStructuredMode`
- `setLayoutMode`
- `toggleLayoutMode`
- renderer DOM creation loop
- pan/zoom interaction logic
- node drag logic
- backend/API/Auth/DB/schema code
- prototype/reference/demo/variant paths

## Contract requirements

Before or with extraction, tests must verify:

1. `editor-canvas-affordance-adapter.js` exists and loads before `editor-canvas.js` if it is a browser global module.
2. The adapter exposes a stable namespace, for example:

```text
window.LoveBudEditorCanvasAffordanceAdapter
```

3. `editor-canvas.js` delegates affordance operations through that adapter.
4. Selection reapply, growth affordance clearing, hover affordance timing, and branch port rendering contracts remain intact.
5. Stage 56–60 layout-mode contracts remain intact:
   - `fitViewportToTree` delegation/fallback
   - `persistStoredPositions` free-only delegation/fallback
   - `initCanvas` layout-mode delegation/fallback
   - layout mode initCanvas order

## Suggested implementation shape

Create a factory/helper such as:

```js
window.LoveBudEditorCanvasAffordanceAdapter = {
  createAffordanceAdapter
};
```

The adapter should receive dependencies explicitly:

```js
createAffordanceAdapter({
  canvas,
  growthAffordance,
  branchPorts,
  getTreeMemories,
  getCanonicalRootId,
  isRootMemory,
  selectionUtils,
  renderUtils,
  createInitialMemory,
  updateDetailPanel,
  onNodeClick,
  documentRef,
  viewportState
});
```

Prefer explicit dependency passing over hidden global reads.

## Acceptance criteria

- Runtime behavior unchanged.
- `editor-canvas.js` reduced by at least 100 lines.
- New adapter file remains focused on affordance behavior.
- Tests pass:

```bash
npm test
npm run verify-static
```

- PR body is exactly:

```text
Refs #1505
```

## Sequencing note

Stage 60 PR #1570 must be resolved first. This Stage 61 plan exists to prevent the next implementation from continuing with overly small micro-delegation slices.
