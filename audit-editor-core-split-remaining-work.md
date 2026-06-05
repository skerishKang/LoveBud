# Editor Core Split Remaining Work Audit (After Alias Cleanup)

## Baseline

- main HEAD: `acf1a402`
- #1698: OPEN
- open PR count: 0
- npm test: 1846/1846 pass
- sub-issue count: 63 closed + 2 open (#2074, #2192)

## Alias Cleanup Final Status

| Category | Before | After | Status |
| -------- | ------ | ----- | ------ |
| Helper method aliases | 20 | 0 | ✅ 20/20 removed |
| Direct deps function aliases | 11 | 0 | ✅ All removed |
| Namespace deps aliases | 14 | 0 | ✅ All removed |
| **Total** | **45** | **0** | **✅ 완전 제거** |

Remaining `const X = deps.X;` patterns in `editor.js` (15 items) are all **clean direct deps references** (previously refactored from `shellHelpers.X` → `deps.X`). They are expected and maintained.

## #1698 Original Scope vs Current State

### Original Goal (from #1698 body)
- Split `editor-canvas.js` (969 lines → 640 lines, **-329 lines**)
- Split `editor.js` (653 lines → 596 lines, **-57 lines**)
- Goal: both ≤ 500 lines

### Current State

| File | Original | Current | Goal | Status | Δ |
| ---- | -------- | ------- | ---- | ------ | - |
| `editor-canvas.js` | 969 | 640 | ≤ 500 | ⚠️ -140 lines over | 5 sub-modules (ES imports) |
| `editor.js` | 653 | 596 | ≤ 500 | ⚠️ -96 lines over | 18+ sub-modules via deps |

### What's Been Done (63 closed sub-issues)
- ✅ Canvas sub-modules extracted: geometry, interaction, viewport (12 files), layout (6 files), nodes, edges, affordance, UI helpers, renderer, selection, panzoom, state boundary
- ✅ Editor bootstrap/guard delegation: dependency checker, guard, waiter, startup context, shell applier
- ✅ Editor delegation: initial memory provider, next memory ID, initial selection applier, finalizer, sidebar status, canvas empty guide, select node handler, detail opener
- ✅ Alias cleanup: 45 aliases → 0 (all 3 categories)
- ✅ Editor runtime extraction: save status, data loader, tree visibility, debug reporter, memory actions readiness
- ✅ Canvas fallback removal: interaction helpers, mouse fallback, node drag fallback, viewport fallback, layout storage fallback

## Remaining Work Assessment

### Area 1: editor.js — StartEditor Orchestrator (lines 104-589)

**Current state:** The `startEditor` async function is a single large orchestration sequence (485 lines) that wires factories together in order.

**Analysis:** This is the "orchestrator" in the title. It calls factories, passes results between them, and manages the editor lifecycle. Each step is already delegated to a sub-module factory. The remaining "debt" is the orchestration sequence itself — which by nature must exist somewhere.

**Risk:** Low risk. The orchestration is stable (all sub-issues pass 1846/1846 tests). Extracting the sequence would require an orchestrator module, which would just move lines without structural benefit.

**Recommendation:** Keep as-is. The orchestration is the necessary wiring that binds sub-modules together.

### Area 2: editor-canvas.js — Remaining Inline Functions (640 lines)

**Current state:** 36 inline functions + 1 main `createEditorCanvas` function. Functions are thin wrappers delegating to sub-modules:
- `loadStoredLayout`, `loadLayoutMode`, `persistLayoutMode` — delegate to `storageUtils`
- `getWorldPosition`, `calcPosition` — thin wrappers around `utils`
- `fitViewportToTree`, `focusNodeById`, `recenterViewport`, `zoomBy` — delegate to `canvasViewport`
- `bindCanvasPan`, `bindNodeDrag` — delegate to `canvasInteraction`/`uiHelpers`
- `initCanvas` — main render orchestration (85 lines, with guardrails)
- `createNodeElement`, `attachNodeInfo`, `attachNodeBehavior` — thin wrappers around `renderUtils`

**Analysis:** The file is 140 lines over budget but most functions are thin wrappers. The only substantial remaining inline logic is:
- `initCanvas` (85 lines) — DOM render orchestration (explicitly marked as high-risk boundary)
- `bindNodeDrag` (26 lines) — partial delegation to uiHelpers
- `renderAffordanceForMemory` + related affordance functions (~20 lines)

**Risk:** Low. The thin wrappers are largely delegation patterns. Extracting them would create many tiny 3-4 line sub-modules without meaningful benefit. `initCanvas` is intentionally kept as a single unit with regression guardrails.

**Recommendation:** Accept as-is. The remaining 140 over-budget lines are largely delegation wrappers. A formal refactor would not improve maintainability.

### Area 3: Bootstrap/Guard Section (editor.js lines 1-103)

**Current state:** 11 typeof guards + dependency checker sequence. Each guard is explicit with its own `reportEditorBootstrapMissingDependency` message. No remaining duplicate guards.

**Analysis:** The bootstrap was consolidated from a prior state that had aggregate guard arrays. Now each guard is explicit and individually maintainable.

**Risk:** Very low. Guards are well-tested.

**Recommendation:** Keep as-is.

### Area 4: Contract Coverage

**Current state:** 50+ contract test files covering alias inventory, bootstrap guards, delegation patterns, fallback preservation, and runtime behavior.

**Analysis:** Coverage is comprehensive. All 1846 tests pass. No known gaps.

**Recommendation:** Sufficient.

### Area 5: Open Sub-Issues

| Issue | Title | Status | Assessment |
| ----- | ----- | ------ | ---------- |
| #2074 | Audit editor canvas interaction fallback removal readiness | OPEN | Valid remaining audit. Need to assess whether the `canvasInteraction.bind` fallback path in `editor-canvas.js:555` can be simplified. |
| #2189 | Audit editor shell helpers namespace deps alias removal | OPEN → **CLOSED** | Superseded by #2191 production cleanup. Just closed. |
| #2192 | (This audit) | Just created | |

### #2074 Assessment

Issue #2074 ("Audit editor canvas interaction fallback removal readiness") checks whether remaining canvas interaction fallbacks (`if (typeof canvasInteraction.xxx === 'function')`) can be simplified. Looking at `editor-canvas.js`:
- L48: `typeof storageUtils.loadStoredLayout === 'function'` guard
- L54: `typeof storageUtils.loadLayoutMode === 'function'` guard
- L61: `typeof storageUtils.persistLayoutMode === 'function'` guard
- L123: `typeof storageUtils.persistStoredPositions === 'function'` guard
- L229: `typeof canvasEdges[name] !== 'function'` — required, not fallback
- L275: `typeof canvasInteraction.beginNodeDrag === 'function'` guard
- L394: `typeof canvasViewport.prepareInitialViewport === 'function'` guard
- L484: `typeof canvasViewport.focusNodeById === 'function'` guard
- L502: `typeof canvasViewport.recenterViewport === 'function'` guard
- L524: `typeof canvasViewport.bindControls === 'function'` guard
- L555: `typeof canvasInteraction.bind === 'function'` guard
- L571: `typeof canvasViewport.zoomBy === 'function'` guard

These are all typeof delegation guards that check whether the sub-module loaded correctly. They're NOT "fallback" in the traditional sense (no alternative path, they just return if missing). They're **load-order safety guards**.

## Judgment

| Question | Answer |
| -------- | ------ |
| #1698 즉시 close 가능 여부 | **NO** — file size goal (≤500) not met for either file |
| 추가 production cleanup 필요 여부 | **NO** — remaining over-budget lines are thin delegation wrappers or intentional orchestration |
| Contract-only PR 필요 여부 | **NO** — coverage is sufficient |
| 후속 subissue 필요 여부 | **YES** — or **close #1698** and accept current state |

## Recommendation

**Option A (Recommended): Close #1698 as completed in spirit**

The original goal was to modularize and split large editor files. Both files have been substantially reduced (editor-canvas: 969→640, editor.js: 653→596). The alias cleanup track (45 aliases) is complete. Remaining over-budget lines are:
- **editor-canvas.js**: Thin delegation wrappers and guarded `initCanvas` orchestration — extracting these would create many tiny modules without benefit
- **editor.js**: The bootstrap guards (103 lines) and `startEditor` orchestration (485 lines) — the orchestration is inherently a single sequence

**Option B: Continue with smaller sub-issues**

1. **#2074** — Complete the canvas interaction fallback audit (already OPEN)
2. Post-#2074, close #1698

Neither file will likely reach ≤500 lines without artificial splitting that harms maintainability. The meaningful debt — alias indirection, duplicated guards, inline fallback code — has been fully addressed.

### Recommendation: Keep #1698 OPEN until #2074 is resolved, then CLOSE

- Complete #2074 audit
- Close #1698 after #2074 completes
- Do NOT create additional split sub-issues for editor.js/editor-canvas.js
