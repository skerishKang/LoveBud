# mobile canvas editor and viewer interaction audit

PR title: `audit(canvas): document mobile editor and viewer interaction gaps`

Scope: audit/docs/contract only. No large UI rewrites in this PR.

## Context

The canvas is shared between two surfaces:

- **Own tree editor** (`pages/editor.html`) — full edit capability
- **Public viewer** (`js/viewer/` or equivalent) — read-only, reuses `createEditorCanvas` with `canEdit=false` and `openAddMoment=noop`

Mobile UX principles established for follow-up PRs:

- Both surfaces default to **view mode**.
- Own tree adds an **"편집하기"** CTA to enter edit mode.
- Moment node tap opens a **full-screen moment detail overlay** instead of the desktop right-panel.
- Edit mode has explicit **저장 / 취소** buttons; changes live in draft state until saved.
- Public viewer never exposes create/edit/delete affordances.

---

## Code-confirmed findings

### Finding A — structured mode blocks all canvas pan on mobile

File: `js/editor/editor-canvas-interaction.js`

```js
// line confirmed in source
if (viewportState.layoutMode === 'structured') return;
```

The `pointerdown` handler returns early when `layoutMode === 'structured'`, so canvas panning via finger drag is **completely disabled** in structured mode. Structured mode is the default layout for LoveBud trees. This means the most common case on mobile has no pan gesture.

Impact: Both own-tree editor and public viewer are affected because both share the same interaction module.

### Finding B — pinch zoom has no implementation in the interaction layer

File: `js/editor/editor-canvas-interaction.js`

The `bind()` function binds only `pointerdown`, `pointermove`, `pointerup`. There is no `touchstart`/`touchmove` handler for multi-touch distance tracking, no `gesturechange` handler, and no `pinchStartDistance` state. `editor-canvas-panzoom.js` provides `calculateZoomScale()` and `zoomByFallback()` as math helpers but they are only called from button click handlers in `editor-canvas-viewport-controls.js`. No code path invokes them from a two-finger gesture.

Impact: Pinch zoom is silently unavailable on every mobile canvas surface.

### Finding C — canvas `touchAction: 'none'` without touch gesture handling

File: `js/editor/editor-canvas-interaction.js`

```js
canvas.style.touchAction = 'none';
```

Setting `touch-action: none` prevents native browser scroll/zoom on the canvas element. Without a custom pinch/pan implementation to replace those native gestures, the canvas becomes an unresponsive dead zone for touch interaction beyond node taps.

### Finding D — mobile bottom bar depends on DOM class, not state event

File: `js/editor/editor-mobile-bottom-bar.js`

The bottom bar reads `document.querySelector('.memory-node.selected')` to decide whether to show `"새 순간 만들기"` or `"이어가기"`. It observes DOM mutations via `MutationObserver` on `#canvasArea`. If `.memory-node.selected` is absent (for example because the canvas has not yet rendered the selected node, or because selection was updated through state but CSS class application was missed), the bar never transitions.

Additionally, the bottom bar may not be visible if its `display` is controlled by CSS that hides it on widths above a threshold, and that threshold may not match all mobile breakpoints.

### Finding E — no back/exit control in the editor shell for mobile

Files: `js/editor/editor-shell-canvas-ui.js`, `js/editor/editor-shell-startup.js`, `pages/editor.html`

The editor shell mounts a shared header, canvas topbar template, floating toolbar, and mobile bottom bar. No canvas-specific back or exit button is added near the canvas area or in the topbar for narrow viewports. Mobile users who navigate into the editor have no in-canvas escape route except the browser's native back gesture, which may conflict with `touchAction: 'none'` on the canvas.

### Finding F — public viewer node tap path depends on synthesized click

The public viewer binds node selection through `selectionState.selectMemory` and `detail panel update`. Node elements receive `touchend` and `click` handlers via `bindNodePointerSelection()`. The `touchend` handler calls `preventDefault()` and sets `dataset.skipNextClick` to suppress the duplicate synthesized `click`. This is correct in isolation, but if any overlay element (growth affordance buttons, editor floating toolbar fragments) intercepts the touch before it reaches `.memory-node`, the selection silently fails with no feedback to the user.

### Finding G — node visual size and hit target

File: `js/editor/editor-canvas-node.js`, `css/editor/editor-overrides.css`

At default or fit-tree zoom scale (approximately 0.35–0.5 for a tree with many moments), node rendered size may be smaller than 44×44px, which is the WCAG/Apple minimum touch target size. No CSS rule in `editor-overrides.css` enforces a minimum hit area independent of visual scale.

### Finding H — multiple nodes can receive identical structured layout positions

File: `js/editor/editor-canvas-geometry.js`

When `canonicalRootId` / `parentId` linkage is inconsistent, `getStructuredWorldPosition()` falls back to `{ x: Math.round(metrics.width / 2), y: ... }` for all unresolved nodes. Multiple unresolved nodes receive the same x coordinate and differ only by depth-based y offset. If multiple nodes share the same depth, they are placed at exactly the same (x, y) and visually overlap. No spread/dedup guard exists today.

---

## Feature matrix — editor vs. viewer vs. required

| Feature | Own tree editor | Public viewer | Confirmed working |
|---|---|---|---|
| Back/exit button | ❌ missing | ❌ missing | ❌ |
| Canvas pan (finger drag) | ❌ blocked in structured mode | ❌ same | ❌ |
| Pinch zoom | ❌ not implemented | ❌ same | ❌ |
| Zoom in/out buttons | ✅ bound to click | ✅ same | ⚠️ synthesized click only |
| Fit tree button | ✅ bound to click | ✅ same | ⚠️ synthesized click only |
| Focus selected button | ✅ bound to click | ✅ same | ⚠️ synthesized click only |
| Moment node tap | ✅ touchend + click | ✅ same | ⚠️ overlay intercept risk |
| Moment detail (mobile) | ❌ desktop panel only | ❌ desktop panel only | ❌ |
| Mobile bottom bar visible | ⚠️ depends on CSS + DOM class | N/A | ⚠️ |
| Bottom bar state flip | ⚠️ depends on .selected class | N/A | ⚠️ |
| Add moment action | ✅ via bottom bar / toolbar | ❌ hidden (canEdit=false) | ⚠️ bar visibility uncertain |
| Continue from selected | ✅ via bottom bar | ❌ not present | ⚠️ bar visibility uncertain |
| Node hit target ≥ 44px | ⚠️ shrinks with zoom | ⚠️ same | ❌ unguarded |
| Multiple nodes overlap | ⚠️ fallback layout risk | ⚠️ same | ❌ no guard |
| Edit mode save/cancel | ❌ not modeled | N/A | ❌ |
| Toolbar overflow guard | ❌ no mobile CSS | ❌ same | ❌ |

---

## Mobile interaction checklist

1. ❌ back/exit control exists on mobile (editor and viewer)
2. ⚠️ mobile bottom action bar is visible when appropriate
3. ⚠️ add moment action is reachable on mobile
4. ⚠️ node tap creates `.memory-node.selected`
5. ⚠️ selected node changes bottom action to `"이어가기"`
6. ❌ structured mode supports mobile pan or provides clear alternative
7. ❌ pinch zoom is supported or explicitly disabled with UI alternative
8. ⚠️ fit tree button works on mobile
9. ⚠️ focus selected button works on mobile
10. ❌ multiple moments do not overlap at one point
11. ❌ node hit target is at least mobile-tappable size

Legend: ✅ confirmed working · ⚠️ partially working or uncertain · ❌ not working or missing

---

## UX state model for follow-up PRs

### States

```
view_mode
  └─ moment_detail_overlay (full-screen, X closes)

edit_mode  (own tree only)
  ├─ moment_detail_overlay (includes edit CTA)
  ├─ new_moment_form
  └─ save_cancel_bar
```

### Transitions

- Any canvas surface enters `view_mode` on load.
- Own tree: `view_mode → edit_mode` via "편집하기" button.
- `edit_mode → view_mode` via "취소" (discard draft) or "저장" (commit draft).
- `view_mode + node tap → moment_detail_overlay`.
- `moment_detail_overlay + X → view_mode` (canvas position/zoom/selection preserved).
- Public viewer: `moment_detail_overlay` has no edit actions.
- Own tree in `view_mode`: `moment_detail_overlay` has "편집하기" entry.
- Own tree in `edit_mode`: `moment_detail_overlay` has edit/delete/continue actions.

---

## Follow-up PR plan

### PR 1 — this audit (merged when this PR lands)

`audit(canvas): document mobile editor and viewer interaction gaps`

### PR 2 — mobile view-mode shell

`ui(canvas): add mobile view-mode shell for editor and viewer`

- Unify public viewer and own-tree default entry into a viewer shell.
- Add back/exit button near canvas topbar for mobile.
- Add "편집하기" CTA to own-tree viewer shell.
- Toolbar overflow CSS guard.

### PR 3 — mobile moment detail overlay

`ui(canvas): add mobile moment detail overlay`

- Full-screen overlay on node tap.
- X closes overlay and restores canvas state.
- No edit actions in public viewer overlay.
- "편집하기" entry in own-tree overlay.

### PR 4 — edit session save and cancel flow

`feat(editor): add mobile edit session save and cancel flow`

- Draft state for edit mode.
- 저장 commits draft; 취소 discards draft and returns to view mode.
- Save/cancel bar visible only in edit mode.

### PR 5 — pan, pinch zoom, and node hit targets

`fix(canvas): enable mobile pan pinch and node hit targets`

- Remove or conditionalize the `layoutMode === 'structured'` pan block for touch input.
- Add two-finger pinch gesture handler using touch distance delta.
- Add minimum hit area CSS independent of render scale.
- Add fallback layout spread guard for unresolved nodes at the same coordinates.

---

## Notes

- Production activation remains BLOCKED.
- Do not close #2649 / #1882 / #2636 / #2660.
- Browse/My Trees card/search/sort work is a separate track.
- Scout / Cloudflare env untouched.
