# Lightweight Floating Editor Toolbar — Design Contract

**Issue:** #1150
**Status:** Contract / Planning (Prototype stage)
**Last updated:** 2026-05-17

---

## 1. Purpose

Define the design boundary, display conditions, candidate actions, and runtime implementation constraints for a lightweight floating contextual toolbar that appears near a selected moment inside the LoveBud Editor canvas.

This contract is a **planning document only**. It does not add runtime behavior, DOM elements, JavaScript, CSS, backend endpoints, database changes, or any implementation. A separate runtime PR will follow after this contract is accepted.

---

## 2. Current state audit

### 2.1 Canvas toolbar (existing)

The current `editor-canvas-topbar` is a **fixed horizontal bar** at the top of the canvas area. It contains:

| Group | Buttons |
|-------|---------|
| Zoom controls | `zoom_out`, zoom indicator (100%), `zoom_in` |
| View controls | `fit_screen` (트리 한눈에 보기), `center_focus_strong` (선택한 순간 보기) |
| Layout mode | `auto_awesome` (자유 배치/구조적 배치 toggle) |
| Compact mode | `unfold_more` (간략 모드 toggle) |

- The toolbar is static (always rendered, not contextual).
- It uses `backdrop-filter: blur(8px)` with a warm glassmorphism style (`rgba(255,250,244,0.85)`).
- It supports a compact mode via `is-compact` CSS class.

### 2.2 Growth affordance (existing)

The current `editor-canvas-growth-affordance.js` renders a **single `+` tip** near the selected moment node, connected by a curved SVG line. This affordance:

- Appears when a moment is selected and a "continue" intent is triggered.
- Shows a speech-bubble-style card offering to add the next moment.
- Is the only node-adjacent contextual UI today.

### 2.3 Selected moment detail panel (existing)

The right detail panel (`editor-detail-panel`) shows:
- Moment title / preview
- Detail metadata (date, tags, memo)
- Primary edit actions (edit, continue, create branch, delete)

All moment actions currently live in this panel or in the top toolbar — **nothing appears natively on the canvas near the selected node**.

### 2.4 Canvas interaction (existing)

- Clicking a node selects it (`setSelectedNodeId`).
- Selected nodes get a highlight ring.
- Double-clicking on empty canvas opens the add-moment form.
- Node drag repositions nodes in `free` layout mode.
- No contextual toolbar appears on selection.

---

## 3. Non-goals

The following are **explicitly not goals** of this contract or the first runtime implementation:

- ❌ Full editor redesign or heavy Figma-like professional toolbar.
- ❌ Multi-select or multi-node toolbar.
- ❌ Toolbar customization / drag-to-reorder / user-configurable buttons.
- ❌ Keyboard shortcut system (future optional scope).
- ❌ Right-click contextual menu.
- ❌ Toolbar animations beyond simple fade/scale transitions.
- ❌ Branch shape selector or branching UI (tracked by #1166 — see §9).
- ❌ Backend, database, API, Auth, schema, or persistence changes.
- ❌ Changing the existing top canvas toolbar — the floating toolbar supplements, not replaces.

---

## 4. Floating toolbar display conditions

### 4.1 When to show

| Condition | Required |
|-----------|:--------:|
| A moment node is selected on the canvas | ✅ **Required** |
| The editor is in `free` (authoring) layout mode | ✅ **Required** |
| The selected moment is fully rendered and visible in viewport | ✅ **Required** |
| The user is authenticated as the tree owner | ✅ **Required** |
| At least one action is available for the selected moment | ✅ **Required** |

### 4.2 When NOT to show

| Condition | Reason |
|-----------|:-------|
| No moment selected | No target node |
| `structured` layout mode | Read-only overview mode — floating toolbar implies editing |
| Selected moment off-screen / outside viewport | No visible anchor |
| Detail panel edit mode active | Dual toolbar confusion |
| Empty canvas (no moments) | No selection possible |
| Mobile narrow viewport (< 480px) | Space constraint — see §7 |

### 4.3 Visibility transitions

| Event | Behavior |
|-------|----------|
| Moment selected | Floating toolbar appears (fade + scale-up, ~200ms) |
| Selection changes to another moment | Toolbar re-positions to new node (no hide/show flash) |
| Selection cleared | Toolbar fades out (~180ms) |
| Layout mode switched to `structured` | Toolbar hides immediately |
| Compact mode toggled on | Toolbar hides (redundant with top-bar compact intent) |
| Viewport panned/zoomed | Toolbar follows node world position |
| Window resized | Toolbar recalculates position relative to selected node |

---

## 5. Candidate toolbar actions

### 5.1 Primary actions (always shown when applicable)

| Action | Icon | Label | Implementation status |
|--------|------|-------|:--------------------:|
| **Edit moment** | `edit` | 순간 수정 | ✅ Already exists (detail panel button) |
| **Continue from moment** | `arrow_forward` | 이어가기 | ✅ Already exists (detail panel + growth affordance) |
| **Create branch** | `call_split` | 가지 만들기 | ✅ Already exists (detail panel button) |
| **View moment detail** | `visibility` | 감상하기 | ✅ Already exists (detail panel button) |

### 5.2 Secondary actions (shown conditionally)

| Action | Icon | Label | Condition |
|--------|------|-------|-----------|
| **Focus moment** | `center_focus_strong` | 선택한 순간 보기 | When node is partially out of view |
| **Delete moment** | `delete` | 순간 삭제 | Always available, requires confirmation |
| **Copy link** | `link` | 링크 복사 | Tree is public |

### 5.3 Future candidates (not in first implementation)

| Action | Rationale |
|--------|:----------|
| **Branch shape selector** | See §9 — #1166 dependency. Add after branch shape contract is accepted. |
| **Add reaction** | Tracked by #1237. Add after reaction feature is implemented. |
| **Pin / bookmark** | Future product scope. Not in first PR. |

---

## 6. Position policy

### 6.1 Anchor point

- The floating toolbar anchors to the **top-right edge** of the selected moment node card.
- Offset: `10px` horizontal gap, `0px` vertical alignment with the node's top edge.
- Rationale: top-right keeps the toolbar visible without overlapping the node's content area. The growth affordance already uses the right side — the toolbar sits above it.

### 6.2 Overflow behavior

| Scenario | Behavior |
|----------|----------|
| Toolbar exceeds right viewport edge | Flip to **left side** of the node |
| Toolbar exceeds top viewport edge | Anchor to **bottom-right** of the node |
| Both edges overflow | Anchor to **bottom-left** of the node |
| Viewport contains neither side | Hide toolbar (node is effectively off-screen) |

### 6.3 Z-index

- Floating toolbar: `z-index: 10` (above memory nodes at z=5, below modal overlays at z=20).

---

## 7. Responsive behavior

### 7.1 Desktop (≥ 1024px)

- Full toolbar with label text visible.
- Primary actions shown as icon + label buttons.
- Secondary actions in a "more" overflow menu if > 5 buttons.

### 7.2 Narrow (480px – 1023px)

- Compact toolbar: icons only, no labels.
- Max 4 buttons visible; extra actions collapse into a `more_horiz` overflow button.
- Toolbar width limited to `min(240px, 60vw)`.

### 7.3 Mobile (< 480px)

- **Floating toolbar is NOT shown** on mobile narrow viewport.
- All moment actions remain accessible via the **bottom detail panel** (existing behavior).
- Rationale: canvas space is too constrained; bottom panel is the primary mobile interaction surface.

---

## 8. Accessibility considerations

| Requirement | Implementation |
|-------------|:---------------|
| **Keyboard navigation** | All toolbar buttons must be focusable via Tab. Arrow keys navigate between buttons within the toolbar. Escape closes/hides the toolbar. |
| **Screen reader** | Toolbar container has `role="toolbar"` and `aria-label="선택한 순간 도구"`. Each button has `aria-label`. |
| **Focus management** | When toolbar appears, first button receives focus. When toolbar hides, focus returns to the selected node button or canvas. |
| **Motion sensitivity** | Toolbar appearance animation respects `prefers-reduced-motion`. No movement — instant opacity toggle only. |
| **Touch targets** | Each button minimum `44×44px` tap target on touch devices (480px+ viewports where toolbar is shown). |

---

## 9. Relationship with #1166 (branch shape selector)

Issue #1166 proposes user-selectable branch shapes (simple / balanced / full tree) for a selected moment.

### 9.1 No dependency

- The floating toolbar contract (#1150) and the branch shape contract (#1166) are **fully independent**.
- #1150 can be implemented and merged without any #1166 work.
- #1166 can be implemented with or without the floating toolbar.

### 9.2 Future integration

When both #1150 and #1166 have accepted contracts, the branch shape selector **may** be surfaced as an additional floating toolbar action button or a small popover triggered from the toolbar:

```
┌─────────────────────┐
│ [edit] [continue] [🪴] ⋮ │
└─────────────────────┘
                         ↓
                  ┌──────────┐
                  │ 단순     │
                  │ 균형     │
                  │ 전체     │
                  └──────────┘
```

This integration is **not required** in either contract. Each feature must work correctly when the other is absent. The floating toolbar must degrade gracefully if branch shape is not implemented.

### 9.3 Future integration with #1237 (reactions)

When #1237 is implemented, a lightweight reaction summary (like count) **may** appear as a non-interactive badge on the floating toolbar near the edit button. Interactive reaction UI remains in the right detail panel per the existing contract (`SELECTED_MOMENT_REACTION_PLACEMENT_CONTRACT.md`).

---

## 10. Runtime implementation — expected changed files

The following is a **forecast only**. No actual changes are made in this contract PR.

| File | Change type | Description |
|------|:-----------:|:------------|
| `pages/editor.html` | **Add** | Floating toolbar HTML template. No change to existing toolbar. |
| `css/editor/editor-canvas-toolbar.css` | **Extend** | Floating toolbar variant styles. Existing top-bar styles unchanged. |
| `js/editor/editor-memory-actions.js` | **Extend** | Add floating toolbar rendering function. New `createFloatingToolbar()` or similar. |
| `js/editor/editor-canvas-interaction.js` | **Extend** | Hook into selection-change event to show/hide toolbar. |
| `js/editor/editor-canvas-geometry.js` | **No change** | Node position data already available via `calcPosition`. |
| `js/i18n/*.js` | **Extend** | New i18n keys for toolbar labels. |

### 10.1 Files NOT changed

| File | Reason |
|:-----|:-------|
| `functions/` directory | Backend/API — no change needed. Floating toolbar is frontend-only. |
| `modal_compute/` directory | Modal backend — no change needed. |
| `tests/` directory | New tests may be added for toolbar presence, but no existing tests modified. |
| `js/editor/editor-canvas-growth-affordance.js` | Existing growth affordance preserved. Floating toolbar is supplementary. |
| `js/editor/editor-detail-ui.js` | Detail panel preserved. Floating toolbar does not replace it. |
| `js/editor/editor-memory-form*.js` | Memory form logic unchanged. |

---

## 11. Acceptance criteria

### 11.1 Functional

| # | Criterion | Verification |
|:-:|-----------|:-------------|
| F1 | Floating toolbar appears when a moment is selected in `free` mode | Manual click test |
| F2 | Floating toolbar hides when selection is cleared | Manual click on empty canvas |
| F3 | Floating toolbar re-positions when selection changes to another node | Click different nodes |
| F4 | Floating toolbar follows node during viewport pan/zoom | Canvas pan + scroll wheel |
| F5 | Floating toolbar hides in `structured` layout mode | Toggle layout mode |
| F6 | Floating toolbar hides during detail panel edit mode | Click edit button in detail panel |
| F7 | Floating toolbar hides on compact mode toggle | Click compact mode |
| F8 | Edit moment button in toolbar triggers the same edit flow as detail panel | Click edit in both locations |
| F9 | Continue from moment in toolbar triggers the same add-moment flow as growth affordance | Click continue in both locations |
| F10 | Create branch in toolbar triggers the same branch flow | Click create branch |
| F11 | View moment detail in toolbar opens the same moment detail view | Click view moment detail |
| F12 | Floating toolbar is NOT shown on viewport width < 480px | Resize browser below 480px |

### 11.2 Visual

| # | Criterion | Verification |
|:-:|-----------|:-------------|
| V1 | Toolbar matches the warm, calm LoveBud visual tone | Visual inspection |
| V2 | Toolbar does not overlap or obscure the selected node's content | Visual inspection |
| V3 | Toolbar does not cover nearby sibling/child nodes | Visual inspection with complex tree |
| V4 | Toolbar has glassmorphism treatment consistent with top toolbar | CSS comparison |
| V5 | Toolbar appearance animation is subtle (fade + slight scale, ~200ms) | Visual inspection |

### 11.3 Accessibility

| # | Criterion | Verification |
|:-:|-----------|:-------------|
| A1 | Toolbar has `role="toolbar"` and descriptive `aria-label` | DOM inspection |
| A2 | All buttons have distinct `aria-label` | DOM inspection |
| A3 | Tab navigates through buttons; Escape hides toolbar | Keyboard test |
| A4 | First button receives focus on toolbar appear | Keyboard test |
| A5 | `prefers-reduced-motion` respected — no animation | DevTools emulation |

### 11.4 Regression

| # | Criterion | Verification |
|:-:|-----------|:-------------|
| R1 | Top canvas toolbar unchanged and functional | Existing tests still pass |
| R2 | Detail panel actions unchanged | Click edit/continue/branch in detail panel |
| R3 | Growth affordance still works when not in toolbar mode | Click `+` tip near node |
| R4 | Node selection/deselection behavior unchanged | Click behavior same as before |
| R5 | Canvas pan/zoom unaffected | Scroll wheel and drag unchanged |
| R6 | Compact mode toggle still hides labels correctly | Toggle compact mode button |

---

## 12. Smoke checklist (pre-merge for runtime PR)

No smoke needed for this design contract PR (no runtime changes).

For the runtime implementation PR, smoke must verify:

- [ ] Node selection → toolbar appears
- [ ] Click different node → toolbar re-positions
- [ ] Deselect → toolbar hides
- [ ] Structured mode → no toolbar
- [ ] Compact mode → no toolbar
- [ ] Edit panel edit mode → no toolbar
- [ ] Viewport < 480px → no toolbar
- [ ] All toolbar buttons trigger correct actions
- [ ] Top toolbar still works
- [ ] Detail panel still works
- [ ] Growth affordance still works
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes

---

## 13. Implementation order (future)

1. **This contract PR** (design docs only) ← **You are here**
2. Runtime implementation PR:
   - Add floating toolbar HTML template to `editor.html`
   - Add CSS styles (extends `editor-canvas-toolbar.css`)
   - Add `createFloatingToolbar()` rendering function
   - Hook into selection events in `editor-canvas-interaction.js`
   - Add i18n keys
   - Add tests
3. Post-merge follow-up:
   - If #1166 is accepted, integrate branch shape selector as optional toolbar action
   - If #1237 is accepted, add reaction count badge

---

## 14. Revision history

| Date | Change | Author |
|------|--------|--------|
| 2026-05-17 | Initial contract — Issue #1150 design planning phase | CTO |
