# Global Namespace Bridges Audit Report
v20260702-audit-report-1

**Issue:** #3120
**Date:** 2026-07-02
**Status:** Audit complete — report only

---

## 1. Executive Summary

This audit inventories all `window.*` global namespace bridges in the LoveBud frontend codebase, classifies them by boundary, and recommends a phased reduction plan.

| Metric | Value |
|---|---|
| JS files scanned | 217 |
| Total `window.*` references | 879 |
| Unique `window.LoveBud*` bridge names | 194 |
| Unique `window.LoveTree*` bridge names (legacy) | 8 |
| `window.__*` internal flags | ~50 |
| Overall cleanup progress | **~3.3%** |

---

## 2. Bridge Inventory by Boundary

### Editor Boundary (~80 bridges, ~9% cleaned)

The highest bridge density. Editor shell helpers, canvas, layout, affordances, and interaction modules all expose via `window.*`.

**Already cleaned**: 7 bridges (shell helpers → `editor-shell-helpers.js`)
**Remaining**: ~73 bridges

Key bridges:
- `window.LoveBudEditorCanvas*` (12+ entrypoints)
- `window.LoveBudEditorCanvasLayout*` (5+ entrypoints)
- `window.LoveBudEditorCanvasInteraction`
- `window.LoveBudEditorCanvasViewport*` (8+ entrypoints)
- `window.EditorCanvasGeometry`

### Viewer Boundary (~36 bridges, 0% cleaned)

All viewer bridges remain in `window.*` with no extraction yet.

Key bridges:
- `window.LoveBudViewerState`
- `window.LoveBudViewerInitFlow`
- `window.LoveBudViewerHandlerFactory`
- `window.LoveBudViewerShellRender`

### Auth Boundary (~16 bridges, 0% cleaned)

Auth bridges span multiple files.

Key bridges:
- `window.LoveBudAuthState`
- `window.LoveBudAuthUI`
- `window.LoveBudAuthSession`
- `window.LoveBudAuthFirebase`
- `window.__authBootstrapCompat`

### Search Boundary (~24 bridges, 0% cleaned)

Search bridges for preview, data, cards, and UI modules.

### MyTrees Boundary (~22 bridges, 0% cleaned)

MyTrees bridges for page, state, actions, UI, and preview modules.

### Scout Boundary (~6 bridges, 0% cleaned)

Scout-related draft and provider bridges.

### Shared/Utils Boundary (~14 bridges, 0% cleaned)

Shared utility bridges for media, path, security, UI, and cache.

### Detail/Pages Boundary (~14 bridges, 0% cleaned)

Detail page bridges for render, copy, video, and loader modules.

---

## 3. Cross-Boundary Leak Analysis

**7 cross-boundary leak bridges identified:**

| Bridge | Source Boundary | Used In | Risk |
|---|---|---|---|
| `LoveBudEditorCanvasLayout` | Editor | Viewer | Medium |
| `LoveBudViewerState` | Viewer | Editor (via handler) | Medium |
| `LoveBudEditorMemoryForm*` | Editor | Scout | Low |
| `LoveBudMyTrees*` | MyTrees | Search | Low |
| `LoveBudSearch*` | Search | MyTrees | Low |
| `EditorCanvasGeometry` | Editor | Viewer | Medium |
| `currentTreeData` | Shared | Editor + Viewer | Low |

---

## 4. Phased Reduction Plan

### Phase 1: Low-Hanging Fruit (5 shared utilities)
Extract shared utility bridges that have no runtime boundary crossing:
- `window.LoveBudPathUtils` → `js/utils/path.js`
- `window.LoveBudSecurityUtils` → `js/utils/security.js`
- `window.LoveBudUIUtils` → `js/utils/ui.js`
- `window.LoveBudCacheUtils` → `js/cache-utils.js`
- `window.LoveBudMediaUtils` → `js/utils/media.js`

### Phase 2: Auth Boundary (16 bridges)
Extract auth bridges into a single importable module.

### Phase 3: Viewer Boundary (36 bridges)
Extract viewer bridges following the pattern established by ViewerShellRender.

### Phase 4: Editor Boundary (~73 bridges)
The largest phase — requires careful ordering to avoid breaking the canvas rendering pipeline.

---

## 5. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Cross-boundary leak from Editor→Viewer | Medium | Extract shared coordinate/geometry helpers first |
| Order-dependent bridge initialization | Medium | Document script load order constraints |
| Test contracts referencing window.* | Low | Contract tests can be updated after extraction |
| Legacy `LoveTree*` naming | Low | Alias → migrate → remove pattern |

---

## 6. References

- [Audit: Editor Shell Helpers Split](../audit/audit-editor-shell-helpers-split.md)
- [Next Work Track](../audit/audit-next-work-track.md)
- [Runtime Bridge Inventory (docs)](docs/runtime-global-bridge-inventory)
- [Runtime Bridge Observations](docs/runtime-global-bridge-observations)
