# Public tree viewer shell split audit

Refs #2686

## Purpose

Audit/contract-first path to split the public viewer shell into smaller helpers without changing public viewer behavior.

This PR is audit-only. It does not modify JS, HTML, CSS, or runtime behavior.

## Viewer entrypoints by page

Three viewer systems coexist. No single HTML page loads both the legacy shell and a canvas-based viewer.

| Page | Active entry JS | System | Status |
|------|----------------|--------|--------|
| `pages/tree.html` | `js/viewer/tree-viewer.js` (62 lines) → `viewer-init-flow.js` (134 lines) | Visitor viewer | Already split into 10+ focused helpers |
| `pages/view.html` | `public-canvas-init.js` (618 lines) + `public-viewer-detail-ui.js` (873 lines) | Canvas viewer | Active, two large files |
| `pages/detail.html` | `js/detail.js` + `detail-loader.js` + `detail-render.js` + etc. | Detail page (moment detail, not tree viewer) | Separate system, not covered here |
| (none) | `js/viewer/public-tree-viewer.js` (506 lines) | Legacy/static viewer | Not loaded by any HTML page. Kept only for contract test references. |

## Shell responsibility vs detail/canvas separation

### Legacy `public-tree-viewer.js` (506 lines)

Single IIFE combining all responsibilities:

| Responsibility | Lines | Risk |
|---------------|-------|------|
| Selectors (SEL map) | 20–41 | Low |
| Closure state (`currentTreeId`, `currentTree`, `currentMemories`, `selectedMemoryId`, `viewEventSentForTreeId`) | 44–48 | Medium — view-count dedup |
| i18n fallback `t()` | 51–58 | Low — duplicates logic in `i18n-core.js` |
| `escapeHtml()` | 61–70 | Low — fallback if `LoveBudSecurity` absent |
| `sanitizeUrl()` | 73–89 | Low — fallback if `LoveBudSecurity.sanitizeUrl` absent |
| `getCurrentLocale()` | 92–95 | Low |
| View actor key (`createRandomViewActorKey`, `getOrCreateViewActorKey`) | 97–114 | Low |
| `buildTreeViewEndpoint()` | 116–118 | Low |
| `recordPublicTreeView()` | 120–141 | **Risky** — view-count side effect, dedup via `viewEventSentForTreeId` |
| DOM helpers (`resolveElement`, `setContent`, `show`, `hide`) | 144–170 | Low — duplicates `viewer-render-state.js` |
| `getBasePath()` | 172–176 | Low |
| `initViewer()` (main entry) | 179–215 | Medium — orchestrates full flow |
| `loadPublicMemories()` | 217–231 | Medium — community API call + public filter |
| `inferTreeTitle()` | 233–239 | Low |
| Loading/empty/error render | 242–255 | Low |
| `renderTree()` + `renderNodesList()` | 257–308 | Medium — node list DOM rendering |
| `formatMemoryDate()` | 310–320 | Low |
| `extractYouTubeVideoId()` | 322–332 | Low — duplicates `public-tree-adapter.js` |
| `selectMemory()` | 334–348 | Medium — node selection + preview trigger |
| `renderPreview()` + placeholder | 350–379 | Medium — eager video hide branch |
| `renderPreviewMemory()` | 381–444 | **Risky** — iframe/thumbnail/no-media branches, `escapeHtml(safeEmbedUrl)`, `onerror` handlers |
| `bindViewerPreviewImageHandlers()` | 446–470 | Low — YouTube thumbnail fallback |
| `setupRetry()` / `setupBackLink()` | 473–492 | Low |
| `DOMContentLoaded` boot | 495–505 | Low |

### Canvas viewer `public-canvas-init.js` (618 lines)

Large orchestration file. Responsibility map:

| Factory / function | Lines | Risk |
|--------------------|-------|------|
| `escapeHtml` duplication | 8–17 | Low — duplicates `LoveBudSecurity` |
| `createLoadFailureState` | 19–46 | Low — inline fallback |
| `createMissingRouteState` | 48–58 | Low |
| `appendMissingRouteState`/`appendPublicLoadFailureState` | 60–81 | Low |
| `handlePublicCanvasLoadFailure` | 83–87 | Low |
| `isPublicRuntimeReady` | 89–103 | Medium — dual readiness check |
| `waitForPublicRuntime` (polling loop) | 106–127 | **Risky** — timeout-based polling |
| `createPublicEditorCanvas` | 129–143 | Low — adapter bridge |
| `resolvePublicCanvasTargets` | 145–151 | Low |
| `installPublicCanvasRuntimeProfile` | 153–161 | Low |
| `createPublicCanvasConfig` | 163–178 | Medium — fallback chain |
| `createPublicCanvasEmptyGuideUpdater` | 180–190 | Low |
| `createPublicCanvasMemoryHelpers` | 192–236 | Medium — root detection, fallback chain |
| `createPublicCanvasReadOnlyActions` | 238–249 | Low |
| `createPublicCanvasSelectionState` | 251–281 | Low |
| `createPublicCanvasDetailUIOptions` | 283–317 | Medium — fallback chain |
| `createPublicCanvasOptions` | 319–354 | Medium — fallback chain |
| `installPublicCanvasReadOnlyState` | 356–367 | Low |
| `initializePublicEditorCanvas` | 369–375 | Low |
| `runPublicCanvasPostInitRefresh` | 377–405 | Medium — canvas entry delegation |
| `installPublicCanvasToolbarCompactMode` | 407–425 | Low |
| `createPublicCanvasNodeClickHandler` | 427–442 | Medium — DOM + canvas update |
| `setupPublicRoute` | 444–455 | Low |
| `isPublicCanvasBridgeReady` | 457–459 | Low |
| `extractPublicCanvasResult` | 461–466 | Low |
| `initPublicCanvas` (main entry) | 468–590 | **Risky** — 122-line orchestration, bridge loading, normalization, canvas setup, polling wait |
| `getPublicCanvasBridge` | 592–597 | Low |
| `normalizePublicCanvasData` | 599–611 | Medium — fallback chain |
| `DOMContentLoaded` boot | 613–617 | Low |

### Canvas viewer `public-viewer-detail-ui.js` (873 lines)

The largest viewer file. Responsibility map:

| Boundary factory | Lines | Risk |
|------------------|-------|------|
| `createPublicViewerUpdateFocusSelectedBtn` | 4–17 | Low |
| `updatePublicViewerSidebarStatus` (noop) | 19 | Low |
| `createPublicViewerEmptyStateContent` | 21–53 | Low |
| `createPublicViewerSetDetailEmptyState` | 55–73 | Low |
| `createPublicViewerCurrentMomentBadgeBoundary` | 75–113 | Low |
| `createPublicViewerCurrentMomentTitleBoundary` | 115–158 | Low |
| `updatePublicViewerCurrentMomentHint` | 160–165 | Low |
| `updatePublicViewerDetailChannelLink` | 167–171 | Low |
| `createPublicViewerCurrentMomentImageBoundary` | 173–407 | **Risky** — YouTube embed, iframe building, `onclick`, play button binding |
| `updatePublicViewerCurrentMomentDate` | 409–415 | Low |
| `createPublicViewerMemoBodyBoundary` | 417–474 | Low |
| `createPublicViewerCurrentMomentTagsBoundary` | 476–542 | Medium — builder fallback chain |
| `createPublicViewerReadOnlyReactionSummaryBoundary` | 544–667 | **Risky** — API fetch, auth failure caching, fallback read-only state |
| `createPublicViewerTreeMetaBoundary` | 669–784 | Medium — builder fallback chain, icon creation |
| `createPublicViewerDetailHeadingBoundary` | 786–804 | Low |
| `createPublicViewerDetailUI` (orchestrator) | 806–852 | Medium — debounce, boundary coordination |
| `window.LoveBudPublicViewerDetailUI` export | 854–872 | Low |

## Global namespaces / public APIs

### Viewer namespaces

| Namespace | Defined in | Used by |
|-----------|-----------|---------|
| `window.LoveBudPublicTreeViewer` marker | `public-tree-viewer.js` | Contract tests only |
| `window.LoveBudPublicCanvasInitLoaded` marker | `public-canvas-init.js` | Self-guard |
| `window.LoveBudPublicViewerDetailUILoaded` marker | `public-viewer-detail-ui.js` | Self-guard |
| `window.createPublicViewerDetailUI` | `public-viewer-detail-ui.js` | `public-canvas-init.js` |
| `window.LoveBudPublicViewerDetailUI` | `public-viewer-detail-ui.js` | Producer exports |
| `window.LoveBudPublicViewerCanvasEntry` | `public-viewer-canvas-entry.js` | `public-canvas-init.js` |
| `window.LoveBudPublicViewerCanvasAdapter` | `public-viewer-canvas-adapter.js` | `public-canvas-init.js` |
| `window.LoveBudPublicCanvasBridge` | `public-canvas-bridge.js` | `public-canvas-init.js` |
| `window.LoveBudPublicViewerDetailChannelLink` | `public-viewer-detail-channel-link.js` | `public-viewer-detail-ui.js` |
| `window.LoveBudViewerRenderState` | `viewer-render-state.js` | `tree-viewer.js` |
| `window.LoveBudViewerRoute` | `viewer-route.js` | `tree-viewer.js` |
| `window.LoveBudViewerDataTransform` | `viewer-data-transform.js` | `tree-viewer.js` |
| `window.LoveBudViewerShellRender` | `viewer-shell-render.js` | `tree-viewer.js` |
| `window.LoveBudViewerDataLoader` | `viewer-data-loader.js` | `tree-viewer.js` |
| `window.LoveBudViewerState` | `viewer-state.js` | `tree-viewer.js` |
| `window.LoveBudViewerHandlerFactory` | `viewer-handler-factory.js` | `tree-viewer.js` |
| `window.LoveBudViewerShareExportBridge` | `viewer-share-export-bridge.js` | `tree-viewer.js` |
| `window.LoveBudViewerClickActions` | `viewer-click-actions.js` | `tree-viewer.js` |
| `window.LoveBudViewerRetrySetup` | `viewer-retry-setup.js` | `tree-viewer.js` |
| `window.LoveBudViewerTestHooks` | `viewer-test-hooks.js` | `tree-viewer.js` |
| `window.LoveBudViewerInitFlow` | `viewer-init-flow.js` | `tree-viewer.js` |
| `window.LoveBudViewerShareStatusUI` | `viewer-share-status-ui.js` | `viewer-init-flow.js` |
| `window.LoveBudVisitorViewerRenderTree` | `visitor-viewer-render-tree.js` | `viewer-init-flow.js` |
| `window.LoveBudVisitorViewerPanels` | `visitor-viewer-panels.js` | `viewer-init-flow.js` |

### Shared external namespaces (not viewer-owned)

| Namespace | Used by viewer | Owner |
|-----------|---------------|-------|
| `window.LoveBudSecurity` | `public-tree-viewer.js`, `public-canvas-init.js` | Security module |
| `window.apiClient.communityApi` / `window.apiClient.getCachedCommunityMemories` | `public-tree-viewer.js`, `viewer-data-loader.js`, `public-canvas-bridge.js` | API client |
| `window.i18n` / `window.i18nViewer` | `public-tree-viewer.js`, viewer templates | i18n module |
| `window.LoveBudPath` | `public-tree-viewer.js` | Shared header / path module |
| `window.LoveBudMedia` | `public-viewer-detail-ui.js` | Media helper |
| `window.createEditorCanvas` | `public-canvas-init.js` | Editor canvas |
| `window.LoveBudHideEagerVideo` | `public-tree-viewer.js` | Feature flag |

## DOM ownership

Each viewer system owns disjoint DOM subtrees.

| Viewer | Root container | Owned DOM |
|--------|---------------|-----------|
| Legacy `public-tree-viewer.js` | `#viewerTreeShell` | `#viewerLoadingState`, `#viewerEmptyState`, `#viewerErrorState`, `#viewerTreeContainer`, `#viewerNodesList`, `#viewerPreviewContainer`, `#viewerPreviewMedia` |
| Visitor `tree-viewer.js` | `#viewerTreeShell` (same selector, different page) | `#viewerLoadingState`, `#viewerEmptyState`, `#viewerErrorState`, dynamic `.vv-tree-container`, `.vv-panel-host` |
| Canvas `view.html` | `#canvasArea` + `#editorDetailPanelShellTemplateMount` | SVG, memory nodes, detail panel |
| Detail `pages/detail.html` | `.detail-page-shell` | `#detailHero`, `.detail-layout`, `.detail-main-media`, `.diary-section`, `.detail-secondary-stack` |

No two pages share the same DOM subtree. DOM ownership is partitioned by page.

## Script loading order / runtime dependencies

### `pages/view.html` (canvas viewer)

```
public-viewer-canvas-topbar-template.js  (template only)
public-viewer-detail-panel-shell-template.js  (template only)
public-viewer-detail-empty-state-template.js  (template only)
public-viewer-detail-view-mode-template.js  (template only)
editor-root-helpers.js  (required: editor canvas root helpers)
editor-canvas-layout.js  (required: layout engine)
[...14 editor-canvas-*.js modules...]
public-canvas-mobile-profile.js
public-canvas-mobile-layout.js
public-viewer-detail-tree-meta.js
public-viewer-detail-builders.js
public-viewer-detail-ui.js  (873 lines — loads after templates, before init)
public-viewer-detail-channel-link.js
auth-policy.js / base-api-fetch.js / postgres-client.js  (API layer)
i18n modules
shared-header.js / page-transitions.js
public-canvas-bridge.js
public-viewer-canvas-entry.js
public-viewer-canvas-adapter.js
public-canvas-init.js  (618 lines — final boot)
public-viewer-copy-helper.js
public-viewer-control-visibility-helper.js
public-viewer-copy-polish.js
```

Dependency direction: templates → editor modules → detail UI → bridge/entry/adapter → init → copies. `public-canvas-init.js` must be last because it reads `window.createPublicViewerDetailUI` and `window.LoveBudPublicViewerCanvasEntry` which are set by earlier scripts.

### `pages/tree.html` (visitor viewer)

Already well-split. Order is: shared utilities → visitor-viewer render-tree/panels → i18n → viewer helpers (data-loader, state, shell-render, etc.) → handler → init-flow → tree-viewer.

### `public-tree-viewer.js` (legacy)

Self-contained IIFE. No script-order dependency beyond `LoveBudSecurity` and `window.apiClient` and `window.i18n`.

## Test coverage anchors

Viewer contract tests exist in two locations:

| Test file | Coverage |
|-----------|----------|
| `tests/routes/viewer-route-contract.test.js` / `.cjs` | tree.html existence, script order, helper loading order, security contracts (sanitizeUrl before iframe, safeEmbedUrl guard, escapeHtml around embed URL), no editor affordances, Browse CTA routing |
| `tests/routes/viewer-branch-grouping.test.js` / `.cjs` | Branch grouping behavior |
| `tests/routes/viewer-share-contract.test.js` / `.cjs` | Share export contracts |
| `tests/routes/public-viewer-*.test.cjs` (29 files) | Per-boundary contracts: detail-ui-core, detail-builders, detail-channel-link, detail-adapter, canvas-adapter, sidebar, shell, tags, title, date, image, memo, reactions, hint, focus, toolbar, empty-state, badge, etc. |
| `tests/contracts/viewer-final-split-guard.test.js` / `.cjs` | Guard: tree.html must not load public-tree-viewer.js |
| `tests/contracts/viewer-test-hooks-contract.test.js` / `.cjs` | Test hooks export |
| `tests/contracts/viewer-*-contract.test.js` (12+ files) | Per-module contracts: init-flow, handler-factory, click-actions, data-loader, retry-setup, remaining-orchestration, share-export-bridge |
| `tests/contracts/public-tree-viewer-*.test.cjs` (5 files) | Legacy-only: CSS, XSS, media sanitization, view-event wiring |
| `tests/contracts/visitor-viewer-*.test.js` / `.cjs` | CSS, panel, channel display |
| `tests/contracts/frontend-dom-xss-guardrails.test.js` / `.cjs` | Cross-cutting: inline onerror, unsafe innerHTML patterns |

### Coverage gaps

- No contract tests for `public-viewer-detail-ui.js` boundary exports (each inner factory is exported via `window.LoveBudPublicViewerDetailUI` but no test verifies they are present and callable).
- No timeout/retry contract for `waitForPublicRuntime` polling loop in `public-canvas-init.js`.
- No view-count dedup contract for the legacy `viewEventSentForTreeId` guard.
- No contract for `public-viewer-detail-ui.js` debounce logic (`lastDetailKey` / `lastDetailAt`).

## Low-risk split candidates

Ordered by risk (lowest first):

1. **Extract `escapeHtml` + `sanitizeUrl` fallbacks from `public-tree-viewer.js`** — Both duplicate `LoveBudSecurity`. If `LoveBudSecurity` is guaranteed present (verify via contract), the fallback branches can be removed.
2. **Extract `formatMemoryDate` + `getCurrentLocale` from `public-tree-viewer.js`** — Pure functions, no side effects.
3. **Extract `inferTreeTitle` from `public-tree-viewer.js`** — Pure, uses only memory data.
4. **Extract `extractYouTubeVideoId` from `public-tree-viewer.js`** — Duplicates function in `public-tree-adapter.js`. Can delegate to adapter.
5. **Extract DOM helpers (`resolveElement`, `setContent`, `show`, `hide`, `getBasePath`) from `public-tree-viewer.js`** — Low risk, duplicates `viewer-render-state.js`.
6. **Extract `renderPreviewPlaceholder` from `public-tree-viewer.js`** — Static HTML template, no side effects.
7. **Extract node list rendering (`renderNodesList`) from `public-tree-viewer.js`** — Medium risk due to keyboard event binding.
8. **Extract media fallback helpers from `public-viewer-detail-ui.js`** — `clearDetailPlayer`, `getMemoryPlaybackUrl`, `getYouTubeVideoId`, `buildYouTubeEmbedUrl`, `buildInlinePlayerElement` are all pure-ish helpers.
9. **Extract reaction summary cache + auth failure cache from `public-viewer-detail-ui.js`** — Can be a standalone module.
10. **Extract `public-canvas-init.js` fallback factory chain into `public-canvas-init-fallbacks.js`** — Every `create*` function has a fallback branch. Collecting fallbacks into one file halves the init file.

## Risky / defer sections

| Section | File | Risk | Reason |
|---------|------|------|--------|
| `recordPublicTreeView` + view dedup | `public-tree-viewer.js` | High | View-count side effect. Dedup state is closure-scoped. Splitting requires passing state or using module-level guard. May cause double-count if not careful. |
| `renderPreviewMemory` iframe/thumbnail/no-media branches | `public-tree-viewer.js` | High | XSS surface. Changes to sanitization ordering could break security. Contract tests guard specific patterns: `sanitizeUrl` before iframe, `safeEmbedUrl` guard, `escapeHtml` around src. |
| `waitForPublicRuntime` polling loop | `public-canvas-init.js` | High | Race condition. Splitting `waitForPublicRuntime` into a separate module may change timing. Must preserve 100-attempt/50ms polling contract. |
| `initPublicCanvas` orchestration (122 lines) | `public-canvas-init.js` | Medium-High | Too long to extract as a single block. Must decompose into sequenced phases first. |
| `createPublicCanvasMemoryHelpers` fallback chain | `public-canvas-init.js` | Medium | Multiple fallback layers (`window.LoveBudPublicViewerCanvasEntry` → `window.LoveBudEditorUtils` → inline). Extracting without breaking fallback priority requires careful ordering. |
| `createPublicViewerReadOnlyReactionSummaryBoundary` | `public-viewer-detail-ui.js` | Medium | Has API call + cache + auth-failure cache. Extracting the cache alone is low-risk; extracting the full boundary requires maintaining the `reactionSummaryInFlight` dedup and `lastDetailKey` guard. |
| `createPublicViewerCurrentMomentImageBoundary` | `public-viewer-detail-ui.js` | Medium | iframe building, `onclick` assignment, play button binding. Splitting requires keeping `clearDetailPlayer`/`buildInlinePlayerElement`/`bindDetailMediaPlayback` together or carefully separating. |

## One-file-at-a-time follow-up plan

### Phase 1: Legacy cleanup (no behavior change)

1. PR: Extract `escapeHtml`/`sanitizeUrl` fallbacks from `public-tree-viewer.js` (low-risk, remove dead branches if `LoveBudSecurity` is guaranteed).
2. PR: Extract `extractYouTubeVideoId` delegation from `public-tree-viewer.js` to `public-tree-adapter.js`.
3. PR: Extract pure helpers (`formatMemoryDate`, `getCurrentLocale`, `inferTreeTitle`, DOM helpers) from `public-tree-viewer.js`.

### Phase 2: Canvas viewer helpers (no behavior change)

4. PR: Extract media helpers (`clearDetailPlayer`, `getMemoryPlaybackUrl`, `getYouTubeVideoId`, `buildYouTubeEmbedUrl`, `buildInlinePlayerElement`) from `public-viewer-detail-ui.js`.
5. PR: Extract reaction summary cache + auth failure cache from `public-viewer-detail-ui.js`.
6. PR: Extract fallback-only factories from `public-canvas-init.js` into `public-canvas-init-fallbacks.js`.

### Phase 3: Orchestration splitting (needs contract tests first)

7. Add contract tests for `waitForPublicRuntime` poll interval/attempt count.
8. Add contract test for `viewEventSentForTreeId` dedup guard.
9. PR: Extract `waitForPublicRuntime` from `public-canvas-init.js`.
10. PR: Extract node list renderer from `public-tree-viewer.js`.
11. PR: Extract view-count recorder from `public-tree-viewer.js`.

### Phase 4: Thin shell

12. PR: Keep `public-tree-viewer.js` as thin boot shell (selectors + `initViewer` orchestration + `DOMContentLoaded` boot).
13. PR: Keep `public-canvas-init.js` as thin init shell (bridge call + `waitForPublicRuntime` + `startCanvas`).

### Defer (risky or blocked)

- `renderPreviewMemory` iframe/thumbnail/no-media branches — Requires careful security contract preservation. Defer until Phase 3.
- `public-viewer-detail-ui.js` `updateDetailPanel` debounce extraction — Low value, risky timing change.
- `public-canvas-init.js` `initPublicCanvas` full decomposition — 122-line orchestration with many interleaved factory calls. Needs phased extraction first.

## Acceptance criteria checklist

- [x] docs-only: no JS/HTML/CSS changes
- [x] viewer entrypoints documented by page
- [x] shell responsibility vs detail/canvas separation documented
- [x] global namespaces / public APIs inventoried
- [x] DOM ownership mapped per viewer system
- [x] script loading order / runtime dependencies documented
- [x] test coverage anchors listed with gaps identified
- [x] low-risk split candidates ordered by risk
- [x] risky/defer sections identified with reasons
- [x] one-file-at-a-time follow-up plan with phases
- [x] no behavior changes
- [x] no viewer redesign
- [x] no Browse/My Trees/Scout/Cloudflare changes
- [x] no module conversion (type="module")
- [x] does not close #1882, #2636, #2660, #2649
