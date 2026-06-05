# Next Work Track Audit (After #1698 Closure)

## Baseline

- main HEAD: `acf1a402`
- open PR count: 0
- open issues: 3 (1 superseded audit, 2 feature/product)
- npm test: 1846/1846 pass
- TECH DEBT open issues: 0

## Open PRs

| PR | Title | Status | Judgment |
| -- | ----- | ------ | -------- |
| — | 없음 | — | — |

## Open Issues

| Issue | Title | Label | Current Validity | Recommendation |
| ----: | ----- | ----- | ---------------- | -------------- |
| #2192 | Audit remaining editor core split work after alias cleanup | tech-debt | **Superseded** by this audit | CLOSE |
| #1882 | [PRODUCT] Explore LoveBud Scout link-based fan assistant MVP | enhancement, product | Valid product proposal, not tech debt | Product team decision |
| #1661 | [DB/API] Add tree-level social counts for Browse sorting | — | Valid DB/API feature, well-scoped | Backend track candidate |

## Code/Structure Audit Summary

### 1. Global Namespace Bridge (`window.LoveBudXxx`) — MASSIVE

175 JS files use `window.LoveBudXxx = {...}` pattern. This is the single largest remaining tech debt category.

| Hotspot | Bridge Count | Relevance |
| ------- | ----------- | --------- |
| `editor-canvas-viewport.js` | 61 | Editor viewport module (largest bridge count) |
| `editor-floating-toolbar.js` | 34 | Editor toolbar |
| `public-canvas-init.js` | 25 | Viewer canvas entry |
| `search-preview-renderer.js` | 22 | Search renderer |
| `auth.js` | 16 | Auth orchestration |

**Risk:** HIGH — massive scope, needs careful sub-tracking.
**Recommendation:** Not suitable as immediate next track. Needs umbrella tracking issue first.

### 2. Large Production JS Files (non-test, non-editor)

| File | Lines | Notes |
| ---- | ----- | ----- |
| `js/auth.js` | 747 | **Largest production file.** Auth bootstrap orchestration. No split work done. |
| `js/editor/editor-shell-helpers.js` | 583 | **Source module for #1698 alias cleanup.** Natural follow-up. |
| `js/viewer/public-canvas-init.js` | 618 | Viewerside canvas init, mirrors editor-canvas.js structure. |
| `js/viewer/public-viewer-detail-ui.js` | 568 | Viewer detail UI module, large but stable. |
| `js/i18n/i18n-detail.js` | 542 | i18n detail translations, maintenance burden. |

**Top candidate: `js/editor/editor-shell-helpers.js` (583 lines)**
- This is the module whose factory exports were consumed via `deps.shellHelpers.X` throughout editor.js
- Now that aliases are removed, the module itself could be split into focused sub-modules
- Each of the 10+ factory functions (`createEditorStartDependencyGuard`, `createEditorStartDependencyChecker`, etc.) is a potential extraction target
- Contract coverage is comprehensive from #1698 work

### 3. CSS Files

| File | Lines | Notes |
| ---- | ----- | ----- |
| `global-header.css` | 677 | Large, could be split |
| `global.css` | 556 | Base styles, stable |
| `editor-overrides.css` + `editor-canvas.css` | 385 + 306 = 691 | Editor CSS total |

**Risk:** LOW — CSS splitting is lower priority than JS structural debt.
**Recommendation:** Not immediate.

### 4. Contract Coverage

~52 contract test files. 1846 tests pass. Coverage is comprehensive for editor, canvas, auth, viewer areas. No obvious gaps.

### 5. Remaining TODO/FIXME

Only 3 trivial TODOs found, all in auth and ui utils. No blocking technical debt in comments.

## Judgment

**Immediate next track candidates (ranked):**

| Priority | Candidate | Why | Suitable as next slice? |
| -------- | --------- | --- | ----------------------- |
| **1** | `editor-shell-helpers.js` split | Direct follow-up to #1698, same patterns apply | ✅ Yes |
| **2** | `auth.js` split/cleanup | Largest production file, untouched | ⚠️ Audit-first needed |
| **3** | Viewer large file split | `public-canvas-init.js` (618 lines) | ⚠️ Audit-first needed |
| **4** | Global bridge migration | 175 files, too large for immediate start | ❌ Needs umbrella issue |
| **5** | #1661 DB tree-level counts | Well-defined backend feature | ✅ But different track |
| **6** | #1882 LoveBud Scout | Product feature, large scope | ❌ Product/engineering decision |

## Recommendation

**1순위: `editor-shell-helpers.js` modular split**

`js/editor/editor-shell-helpers.js` (583 lines) is the most natural follow-up to #1698:

- The module provides 10+ factory functions that were consumed by `editor.js` via `deps.shellHelpers.X`
- Now that editor.js no longer has shellHelpers namespace alias, the source module can be split without changing consumer code
- Each factory function (`createEditorStartDependencyGuard`, `createEditorStartDependencyChecker`, `createEditorRequiredGlobalWaiter`, `createEditorStartupShellApplier`, `createEditorCanvasEmptyGuideUpdater`, `createEditorSelectNodeHandler`, `createEditorSidebarStatusUpdater`, `createEditorInitialMemoryProvider`, `createEditorNextMemoryIdProvider`, `createEditorInitialSelectionApplier`, `createEditorReadyFinalizer`) is a clean extraction unit
- The existing 11 factories in `editor.js` that reference `deps.shellHelpers.X` would continue to work unchanged
- Contract coverage from #1698 can be reused

**2순위: `auth.js` (747 lines) audit-first**

Or the open #1661 (DB/API feature) if the user wants to switch from frontend tech debt to backend work.

**Suggested next slice:**

```
소이슈: [TECH DEBT] Audit editor shell helpers module split readiness
브랜치: audit/editor-shell-helpers-module-split
PR: audit-only (no production PR yet)
```

This would be an audit-first slice to identify which factory functions can be safely extracted, check for intra-module dependencies, and plan the split order before any production cleanup.
