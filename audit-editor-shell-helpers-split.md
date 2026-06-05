# Editor Shell Helpers Module Split Readiness Audit

## Baseline

- main HEAD: `acf1a402`
- open PR count: 0
- open issues: 2 (#1661 DB/API, #1882 Product)
- npm test: 1846/1846 pass
- 소이슈 #2193: OPEN

## `editor-shell-helpers.js` 현황

| 항목 | 값 |
| ---- | --- |
| file path | `js/editor/editor-shell-helpers.js` |
| line count | **583 lines** |
| export mechanism | `window.LoveBudEditorShellHelpers = { ... }` (global bridge) |
| 함수 수 | **31** |
| 함수당 평균 lines | 18.8 |
| 함수당 최대 lines | `applyEditorShellCopy`: 64 |
| 함수당 최소 lines | `getEditorBasePath`: 4 |
| DOM 접근 함수 | 3 (`applyEditorShellCopy`, `markEditorReady`, `applyEditorEditabilityState`) |
| Global bridge 참조 | 5 (bridge/exposure functions + fallback) |
| 함수 간 내부 호출 | **1** (`buildEditorRedirectTarget` → `this.getEditorBasePath()`) |
| 의존성 주입 형태 | 모든 함수가 `options` 객체로 의존성 수신 |

## Function / Responsibility Inventory

### Cat A — Guard / Load-Order Safety (4 functions, 95 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 1 | `createEditorStartDependencyGuard` | 200 | 12 | Ensures dep is function, reports if missing | `reportError` | none | 6 | ✅ **Yes** | Low |
| 2 | `createEditorStartDependencyChecker` | 212 | 18 | Iterates dep list through guard | `ensureStartEditorDependency`, `dependencies[]` | none | 16 | ✅ **Yes** | Low |
| 3 | `createEditorStartupDependencyWaiter` | 230 | 33 | Polls `windowRef[name]` until function | `log`, `reportError`, `windowRef`, `wait`, `maxAttempts`, `intervalMs` | `windowRef` | 6 | ✅ **Yes** | Low |
| 4 | `createEditorRequiredGlobalWaiter` | 263 | 22 | Waits for 4 required global factories | `waitForGlobal` | none | 7 | ✅ **Yes** | Low |

### Cat B — Shell Copy / DOM (3 functions, 90 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 5 | `applyEditorShellCopy` | 85 | 64 | **Largest function.** Applies i18n text to 30+ DOM elements | `safeI18nText`, `i18n` | ✅ `document.getElementById` | 7 | ✅ **Yes** (with guard) | Medium |
| 6 | `markEditorReady` | 149 | 10 | Removes `editor-preload` class from body | `body` | ✅ `body.classList.remove` | 8 | ✅ **Yes** | Low |
| 7 | `applyEditorEditabilityState` | 159 | 16 | Sets `canEdit` on editor namespace, toggles `.editor-readonly` | `canEdit`, `editorNamespace`, `body` | ✅ `body.classList.toggle` + `window.LoveBudEditor` | 6 | ✅ **Yes** | Low |

### Cat C — Bridge / Exposure (3 functions, 33 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 8 | `exposeCanvasEmptyGuideUpdater` | 29 | 11 | Sets `editorNamespace.updateCanvasEmptyGuide` | `updateCanvasEmptyGuide`, `editorNamespace` | `window.LoveBudEditor` | 6 | ✅ **Yes** | Low |
| 9 | `exposeDetailPanelUpdater` | 40 | 11 | Sets `windowRef.updateDetailPanel` | `updateDetailPanel`, `windowRef` | ✗ | 5 | ✅ **Yes** | Low |
| 10 | `exposeRefreshMemoriesBridge` | 51 | 11 | Sets `windowRef.refreshMemories` | `refreshMemories`, `windowRef` | ✗ | 4 | ✅ **Yes** | Low |

### Cat D — Canvas/UI/Select Factories (6 functions, 138 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 11 | `createEditorCanvasEmptyGuideUpdater` | 285 | 19 | Creates empty guide updater (or returns warning fallback) | `emptyGuideUIHelper`, `getTreeMemories`, `log` | none | 8 | ✅ **Yes** | Medium |
| 12 | `createEditorSelectNodeHandler` | 344 | 41 | Creates node selection handler with UI updates | 9 injected deps | none | 9 | ✅ **Yes** | Low |
| 13 | `createSelectedMomentFocusHandler` | 328 | 16 | Creates moment focus function | `getEditorCanvas`, `getSelectedNodeId` | none | 6 | ✅ **Yes** | Low |
| 14 | `createSidebarTreeActionsUpdater` | 385 | 19 | Creates sidebar tree actions updater | `sidebarUIHelper`, `i18n`, `safeI18nText`, `getTreeId` | none | 7 | ✅ **Yes** | Low |
| 15 | `createEditorSidebarStatusUpdater` | 404 | 14 | Creates sidebar status update aggregator | 3 sub-updaters | none | 6 | ✅ **Yes** | Low |
| 16 | `createEditorInitialSelectionApplier` | 505 | 26 | Creates initial selection logic | 6 deps | none | 6 | ✅ **Yes** | Low |

### Cat E — Memory/Moment Factories (4 functions, 87 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 17 | `createEditorInitialMemoryProvider` | 473 | 21 | Creates `createInitialMemory()` factory | `editorTreeHelpers`, `getTreeMemories`, 4 more | none | 8 | ✅ **Yes** | Low |
| 18 | `createEditorNextMemoryIdProvider` | 494 | 11 | Creates `nextMemoryId()` factory | `nextMemoryIdFromMemories`, `getTreeMemories` | none | 8 | ✅ **Yes** | Low |
| 19 | `createCurrentMomentDetailOpener` | 437 | 36 | Opens detail page for current moment | 8 deps | none | 7 | ✅ **Yes** | Low |
| 20 | `createMemoryActionsReadinessWrapper` | 418 | 19 | Wraps memory actions readiness | `getMemoryActions`, `consoleRef` | none | 4 | ✅ **Yes** | Low |

### Cat F — Shell/Startup/Ready (4 functions, 63 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 21 | `createEditorStartupShellApplier` | 545 | 16 | Orchestrates shell preparation sequence | 4 deps | none | 7 | ✅ **Yes** | Low |
| 22 | `createEditorReadyFinalizer` | 531 | 14 | Finalizes editor ready sequence | 3 deps | none | 7 | ✅ **Yes** | Low |
| 23 | `createSaveStatusOrchestrationFallback` | 561 | 22 | Creates minimal save status fallback | `consoleRef` | none | 3 | ✅ **Yes** | Low |
| 24 | `createEditorDebugReporter` | 175 | 25 | Creates `{log, reportError}` object | `debugState`, `consoleRef`, `now` | none | 6 | ✅ **Yes** | Low |

### Cat G — Utilities (8 functions, 75 lines)

| # | Function | Lines | Lines | Responsibility | Dependencies | DOM/Global | Contract Files | Split Candidate | Risk |
| -:| -------- | ----: | ----- | -------------- | ------------ | ---------- | :------------: | --------------- | ---- |
| 25 | `getI18n` | 5 | 5 | Returns i18n function | none | `window.t` | 3 | ✅ **Yes** | Low |
| 26 | `getEditorBasePath` | 10 | 4 | Returns editor base path | none | `window.location.pathname` | 5 | ✅ **Yes** | Low |
| 27 | `buildEditorRedirectTarget` | 15 | 5 | Builds redirect URL | none (calls `this.getEditorBasePath()`) | `window.location.search` | 2 | ✅ **Yes** (split after `getEditorBasePath`) | Low |
| 28 | `getHttpStatus` | 19 | 10 | Extracts HTTP status from error | none | none | 5 | ✅ **Yes** | Low |
| 29 | `resolveSaveStatusTimeFormatter` | 62 | 8 | Resolves time formatter from editor save status | `editorSaveStatus` | none | 3 | ✅ **Yes** | Low |
| 30 | `createInlineShowToastFallback` | 70 | 15 | Creates toast fallback function | none | `window.LoveBudUI`, `window.__editorToastWarningShown` | 3 | ✅ **Yes** | Low |
| 31 | `getYouTubeInputErrorMessageFallback` | 304 | 24 | Validates YouTube URL | `i18n` | none | 3 | ✅ **Yes** | Low |

### Summary by Category

| Category | Functions | Total Lines | Avg Lines |
| -------- | --------: | ---------: | --------: |
| Guard/Safety (A) | 4 | 95 | 23.8 |
| Shell Copy/DOM (B) | 3 | 90 | 30.0 |
| Bridge/Exposure (C) | 3 | 33 | 11.0 |
| Canvas/UI Factories (D) | 6 | 138 | 23.0 |
| Memory/Moment (E) | 4 | 87 | 21.8 |
| Shell/Startup/Ready (F) | 4 | 63 | 15.8 |
| Utilities (G) | 7 | 75 | 10.7 |
| **Total** | **31** | **581** | **18.8** |

## Key Observations

1. **All 31 functions accept options via parameter** — no hard-coded external dependencies except DOM in 3 cases. This means extraction is mechanically straightforward.

2. **Zero circular dependencies** — `buildEditorRedirectTarget` calls `this.getEditorBasePath()` (the only internal call), which can be resolved by importing the extracted module.

3. **`applyEditorShellCopy` (64 lines) is the largest and most DOM-coupled function** — it sets textContent/placeholder on 30+ DOM elements. This is the primary candidate for controlled extraction.

4. **Window bridge pattern consistent** — all functions live on `window.LoveBudEditorShellHelpers`. A split must preserve this bridge for consumer compatibility.

5. **Contract coverage is comprehensive** — every function is referenced in contract files (2-16 files per function). Split must maintain function names on the window bridge.

## Split Recommendation

### Strategy: Aggregator Module Pattern

Keep `editor-shell-helpers.js` as an aggregator that imports from sub-modules:

```
js/editor/editor-shell-helpers.js           ← aggregator (imports + re-exports to window bridge)
js/editor/editor-shell-guards.js            ← Cat A: 4 guard/safety factories
js/editor/editor-shell-copy.js              ← Cat B: 3 shell copy/DOM functions
js/editor/editor-shell-bridges.js           ← Cat C: 3 bridge/exposure utilities
js/editor/editor-shell-canvas-ui.js         ← Cat D: 6 canvas/UI factory functions
js/editor/editor-shell-memory.js            ← Cat E: 4 memory/moment factories
js/editor/editor-shell-startup.js           ← Cat F: 4 shell/startup/ready factories
js/editor/editor-shell-utils.js             ← Cat G: 7 utility functions
```

Each sub-module exports a named object that the aggregator merges into `window.LoveBudEditorShellHelpers`. The aggregator content becomes:

```js
window.LoveBudEditorShellHelpers = {
    ...require('./editor-shell-guards.js'),
    ...require('./editor-shell-copy.js'),
    ...require('./editor-shell-bridges.js'),
    ...require('./editor-shell-canvas-ui.js'),
    ...require('./editor-shell-memory.js'),
    ...require('./editor-shell-startup.js'),
    ...require('./editor-shell-utils.js'),
};
```

### Production Split Phasing

| Phase | Sub-modules | Functions | Risk | Notes |
| ----- | ----------- | --------- | ---- | ----- |
| **1** | Utils (G) + Bridges (C) | 12 | Very Low | Smallest, simplest functions. No DOM. |
| **2** | Guard (A) | 4 | Low | Bootstrap-critical but pure functional. |
| **3** | Shell/Startup (B+F) | 7 | Low-Medium | Includes DOM functions. ApplyEditorShellCopy needs care. |
| **4** | Canvas/UI (D) + Memory (E) | 10 | Low | All dependency-injected via options. |

### Order Recommendation

**Phase 1 (safest start):** Extract Cat G (Utilities) + Cat C (Bridges) — 11 functions, minimal risk, quick win.

**Phase 2:** Extract Cat A (Guards) — bootstrap critical but functionally pure.

**Phase 3:** Extract Cat F (Shell/Startup/Ready) + Cat B (Shell Copy/DOM) — includes the 3 DOM functions, requires attention to `applyEditorShellCopy`.

**Phase 4:** Extract Cat D (Canvas/UI) + Cat E (Memory) — largest extraction but mechanically straightforward.

## Judgment

| Question | Answer |
| -------- | ------ |
| 생산 split 바로 가능? | **YES** — aggregator pattern 사용, 모든 함수가 옵션 주입 가능 |
| contract-only PR 선행 필요? | **NO** — aggregator가 기존 window bridge를 유지하므로 contract 불변 |
| sub-slice 분할 필요? | **YES** — 4 phase로 나누어 추천 |
| 다음 1순위 후보? | **Phase 1: Utilities + Bridges** (12 functions, minimal risk) |

## 다음 추천

**1순위: Phase 1 — Extract Utilities + Bridges**

```
소이슈: [TECH DEBT] Extract editor shell utilities and bridges sub-modules
브랜치: refactor/extract-editor-shell-utils-bridges
PR 제목: refactor(editor): extract shell utilities and bridge sub-modules
작업 방식: production split (audit 완료, 바로 가능)
```

**핵심 수정 방향:**
- `js/editor/editor-shell-utils.js` 생성: getI18n, getEditorBasePath, buildEditorRedirectTarget, getHttpStatus, resolveSaveStatusTimeFormatter, createInlineShowToastFallback, getYouTubeInputErrorMessageFallback, createEditorDebugReporter
- `js/editor/editor-shell-bridges.js` 생성: exposeCanvasEmptyGuideUpdater, exposeDetailPanelUpdater, exposeRefreshMemoriesBridge
- `editor-shell-helpers.js` aggregator로 변경: sub-modules import 후 병합
- Contract coverage: 함수 이름 불변, window bridge 불변, contract 수정 불필요
- 검증: `npm test` 1846/1846 pass 확인
