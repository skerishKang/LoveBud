# Structured Tree Layout Mode — Product/UX Contract

**Issue:** #1037  
**Status:** Contract / Planning  
**Last updated:** 2026-05-12  

---

## 1. Current state audit

### Editor (js/editor/editor-canvas-geometry.js)
- Nodes positioned via radial/hierarchical algorithm:
  - Root node at center-left of canvas (~42% from left, ~48% from top)
  - L1 children (root's direct children): distributed radially at radius 180–250px, angle spread 90–220°
  - L2+ children (grandchildren): positioned from parent at radius 130–190px
- **Free-position override**: Users can drag nodes; custom positions stored in `localStorage` key `lovebud_tree_layout_v2_<treeId>` as `{ positions: {}, offsetX, offsetY, scale }`
- No structured/auto-layout toggle exists
- Viewport state is independent: `recenterCanvasBtn` resets offset/scale

### Public Viewer (js/visitor-viewer/visitor-viewer-render-tree.js)
- Tree rendered as SVG paths + leaf nodes
- Positions are pre-computed in the dataset (`branch.startY`, `branch.endY`, `branch.curveA`, `branch.curveB`, `branch.endX`)
- No user position editing; all rendering is deterministic from the data
- No layout mode concept exists

### Canvas toolbar (editor.html)
- Current toolbar buttons: zoom in/out, recenter, focus selected moment
- No layout mode toggle

---

## 2. Layout mode contract

Four modes are defined. Modes are **display/view modes only** — they do not alter stored position data.

### `free` (default, existing)
- Current behavior: nodes displayed at their stored positions (drag-modified or algorithm-derived)
- User drag is enabled
- This is the authoring mode

### `structured` (new)
- Nodes arranged automatically based on tree topology:
  - Root at top or center-left
  - Children laid out in a deterministic tree structure (e.g., top-down hierarchy or left-to-right)
  - Branch depth determines position
  - Sibling nodes evenly spaced
- Free-position data is preserved but not displayed
- User drag is disabled in this mode
- Useful for readability and overview

### `fit-to-view` (mostly exists as "recenter")
- Zoom and pan adjusted so all nodes are visible
- Implemented by `recenterCanvasBtn` — recalculates offset/scale to fit all nodes
- Should be available in any layout mode

### `focus-selected` (partially exists as "focus selected moment" button)
- Viewport moves to center on the selected node
- Available in `free` mode via `focusSelectedBtn`
- In `structured` mode, could animate or highlight the focused branch/path

---

## 3. Mode interactions

| Feature | `free` | `structured` | `fit-to-view` | `focus-selected` |
|---------|--------|-------------|---------------|-----------------|
| User drag | ✅ Enabled | ❌ Disabled | N/A | N/A |
| Free position data | ✅ Displayed & saved | ✅ Preserved, not displayed | N/A | N/A |
| Auto-layout | ❌ | ✅ Active | N/A | N/A |
| Zoom/pan | ✅ | ✅ | ✅ (auto) | ✅ (auto to selection) |
| Selection | ✅ | ✅ | N/A | ✅ |
| Node mutation | ✅ Allowed | ❌ Read-only | N/A | N/A |

Mode transitions:
- `free` ↔ `structured`: Toggle. When switching to `structured`, auto-layout is computed from topology (not from free positions). When switching back to `free`, stored free positions are restored.
- `fit-to-view` + `focus-selected`: These are transient viewport adjustments available in any mode. They do not change the layout mode.

---

## 4. UI placement

### Proposed toolbar location

The structured layout toggle should sit in the **canvas toolbar**, grouped with view controls:

```
[ zoom controls ] | [ fit-to-view ] [ focus-selected ] | [ layout: free ▼ ]
```

The layout mode selector can be:
- A dropdown button showing the current mode label
- A toggle button group: `free` / `structured`
- The `free` label above the current `focusSelectedBtn` area

### Public Viewer

The structured view is the more natural default for Public Viewer because:
- Public viewers cannot edit positions
- Deterministic layout is more predictable and accessible
- But Public Viewer currently uses pre-computed render data (SVG paths + embedded positions)

**Recommendation**: Public Viewer structured layout is a separate future task that requires changes to the data pipeline or renderer.

---

## 5. Technical approach for Editor structured mode

### Option A: CSS transform + re-layout
- Calculate auto-positions from tree topology in `editor-canvas-geometry.js`
- Apply positions as transforms or SVG attributes
- Preserve free positions in localStorage
- Toggle between position sets by swapping the position lookup

### Option B: Separate layout pass
- Add a `layoutMode` parameter to `getWorldPosition`/`calcPosition`
- When `layoutMode === 'structured'`, ignore stored positions and compute from topology only
- This keeps the layout logic in the geometry module

**Recommended**: Option B — minimal change, single source of truth for position calculation.

---

## 6. First-slice scope (this PR)

This PR is a **docs/contract-only** PR. It defines the mode contract without implementation.

**In scope:**
- This document
- Issue #1037 acceptance criteria clarification

**Out of scope (future PRs):**
- Structured layout implementation in Editor canvas
- Structured layout in Public Viewer
- Layout mode toggle UI
- Animation between modes
- Collision avoidance
- User custom layout saving outside localStorage
- Public Viewer layout preference

---

## 7. Future work

| Item | Priority | Depends on |
|------|----------|------------|
| Editor structured layout mode (Option B) | High | #1037 contract approved |
| Layout mode toggle UI in toolbar | High | Mode implementation |
| Public Viewer structured layout | Medium | Editor structured mode, data pipeline changes |
| Animation between layout modes | Low | Both modes implemented |
| Collision avoidance for auto-layout | Medium | Structured mode |
| Branch-depth-based auto-layout algorithm | High | Structured mode |
| User custom layout saved to server (not localStorage) | Low | #1035, #1045 decisions |

---

## 8. Safety notes

- Free-position data in localStorage is **never overwritten** by structured mode
- Switching modes is purely a display toggle
- No backend/API/schema changes
- No Editor runtime mutation behavior changed
- No Public Viewer rendering changed
