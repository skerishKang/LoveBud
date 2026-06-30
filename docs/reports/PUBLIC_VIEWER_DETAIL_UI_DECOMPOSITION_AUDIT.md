# Public Viewer Detail UI Decomposition Audit

## Audit Scope

- **Issue**: #3090
- **Parent**: #3086, #1882
- **Protected**: #2960 (detail panel tree context), #2856 (growth affordance), #3070 (save completion — paused)
- **Explicit exclusions**: #2972 (media playback, YouTube embed, player lifecycle), #2976 (dynamic copy centralization)
- **Runtime (this audit PR)**: No changes
- **Documentation only (this audit PR)**

## 1. Base SHA

- **Current main**: `4833cd007650760dca91047d16915669b72322a9`
- **No open PRs interfering**: only #2960 (protected), #2856 (protected) are open
- **No pending changes** on `main`

## 2. Current `js/viewer/public-viewer-detail-ui.js` Responsibility Cluster Map

Total: 878 lines (IIFE-wrapped, line 1–878).

### 2.1 `safeDisplayTitle` (lines 4–19)

Title sanitization helper. Delegates to `window.LoveBudTreeWorkspaceClassifier.isLocalizationKeyTitle` and `.sanitizeDisplayTitle`.

### 2.2 Focus selected button (lines 21–34)

`createPublicViewerUpdateFocusSelectedBtn(deps)` → `updatePublicViewerFocusSelectedBtn()`. Reads `deps.getSelectedNodeId`; toggles `#focusSelectedBtn` disabled state and `is-disabled` class.

### 2.3 Sidebar status (line 36)

`updatePublicViewerSidebarStatus` — no-op stub.

### 2.4 Empty state rendering (lines 38–90)

- `createPublicViewerEmptyStateContent()` (lines 38–70) — builds empty-state DOM subtree (icon, title, description).
- `createPublicViewerSetDetailEmptyState(deps)` → `setPublicViewerDetailEmptyState(isEmpty)` (lines 72–90) — creates or toggles `#detailEmptyState` and `#detailViewMode` visibility.

### 2.5 Current moment badge (lines 92–130)

`createPublicViewerCurrentMomentBadgeBoundary(deps)` → `updatePublicViewerCurrentMomentBadge(data)`. Reads `deps.i18n`, `isRootMemory`, `getCanonicalRootId`, `getTreeMemories`. Sets text on `#detailCurrentMomentBadge` to waiting/start/selected label.

### 2.6 Current moment title (lines 132–177)

`createPublicViewerCurrentMomentTitleBoundary(deps)` → `updatePublicViewerCurrentMomentTitle(data)`. Reads `deps.i18n`, `getTreeMemories`. Rebuilds children of `#detailCurrentMomentTitle` with inline-edit container.

### 2.7 Current moment hint (lines 179–184)

`updatePublicViewerCurrentMomentHint()` — clears and hides `#detailCurrentMomentHint`.

### 2.8 Channel link (lines 186–190)

`updatePublicViewerDetailChannelLink(data)` — delegates to `window.LoveBudPublicViewerDetailChannelLink.renderDetailChannelLink(data)`. No deps injection.

### 2.9 Current moment image / media (lines 192–411)

`createPublicViewerCurrentMomentImageBoundary(deps)` → `updatePublicViewerCurrentMomentImage(data)`. Contains:
- `clearDetailPlayer` (lines 208–217) — removes inline player iframe, resets overlay and thumbnail
- `getMemoryPlaybackUrl` (lines 219–231) — URL extraction from multiple data fields
- `getYouTubeVideoId` (lines 233–252) — YouTube video ID extraction (delegates to `window.LoveBudMedia.extractYouTubeId` if available, else manual URL parsing)
- `buildYouTubeEmbedUrl` (lines 254–307) — builds `youtube-nocookie.com/embed/` URL with start/end params
- `buildInlinePlayerElement` (lines 309–323) — creates iframe element
- `bindDetailMediaPlayback` (lines 325–346) — binds play button click to inline player insertion
- Main update function (lines 348–411) — renders thumbnail, play button, or empty state for `#detailImg` / `.detail-video`

This cluster is the largest single responsibility (~219 lines) and is closely tied to #2972 media scope.

### 2.10 Current moment date (lines 414–420)

`updatePublicViewerCurrentMomentDate(data)` — sets `#detailDateText.textContent` from `data.timestamp`.

### 2.11 Memo body (lines 422–479)

`createPublicViewerMemoBodyBoundary(deps)` → `updatePublicViewerMemoBody(data)`. Reads `deps.i18n`, `getTreeMemories`, `window.createPublicViewerDetailUIBuilders` / `window.createEditorDetailUIBuilders`. Rebuilds children of `#detailMemo` / `.diary-note`.

### 2.12 Tags (lines 481–547)

`createPublicViewerCurrentMomentTagsBoundary(deps)` → `updatePublicViewerCurrentMomentTags(data)`. Reads `deps.i18n`, `isRootMemory`, `getCanonicalRootId`, shared builders. Rebuilds `#detailTags` children.

### 2.13 Read-only reaction summary (lines 549–672)

`createPublicViewerReadOnlyReactionSummaryBoundary(deps)` → `updatePublicViewerReadOnlyReactionSummary(data)`. Reads `deps.isRootMemory`, `getCanonicalRootId`, optional `getSelectedNodeId`. Manages `#momentReactionsCard` / `#momentLikeBtn` / `#momentLikeCount` / `#momentCommentBtn` / `#momentCommentCount`. Fetches reaction summary via `window.apiClient.fetchReactionSummary` with cache, in-flight dedup, auth-failure tracking, and read-only fallback.

### 2.14 Tree meta (lines 674–789)

`createPublicViewerTreeMetaBoundary(deps)` → `updatePublicViewerTreeMeta(data)`. Reads extensive deps (`i18n`, `resolveTreeTitleText`, `isRootMemory`, `getCanonicalRootId`, `getTreeMemories`, `getCurrentTreeData`, `getLocalSaveMode`, `showToast`, shared builders). Delegates to `window.createPublicViewerDetailTreeMetaBoundary` / `window.createEditorDetailTreeMetaBoundary`. Builds and renders into `#detailTreeMetaMount`.

### 2.15 Detail heading (lines 791–809)

`createPublicViewerDetailHeadingBoundary(deps)` → `updatePublicViewerDetailHeading()`. Sets `h3` text in `deps.detailPanel` / `#detailPanel` to i18n heading.

### 2.16 Master orchestrator (lines 811–857)

`createPublicViewerDetailUI(deps)` → `detailUI` object. Composes all boundaries. Exposes:
- `detailUI.updateFocusSelectedBtn`
- `detailUI.updateSidebarStatus`
- `detailUI.setDetailEmptyState`
- `detailUI.updateDetailPanel(data)` — orchestration with debounce guard (150ms for same memoryId)

### 2.17 Global surface export (lines 859–877)

Exports `window.createPublicViewerDetailUI(fn)` and `window.LoveBudPublicViewerDetailUI` namespace object containing all boundary factories plus `delegatesToEditorDetailUI: false`.

## 3. Script Order and `window.LoveBudPublicViewer*` Global Dependency Ownership

### Script load order (relevant section of `pages/view.html`)

```
35–38: viewer templates (sidebar, canvas-topbar, detail-panel-shell, empty-state, view-mode)
47–68: editor-root-helpers, canvas modules, public-canvas-mobile-*, public-canvas-affordance-fallback
69:   editor-canvas.js (type="module")
71:   js/viewer/public-viewer-detail-tree-meta.js → LoveBudPublicViewerDetailTreeMeta, createPublicViewerDetailTreeMetaBoundary
72:   js/viewer/public-viewer-detail-builders.js → createPublicViewerDetailUIBuilders, createEditorDetailUIBuilders, LoveBudPublicViewerDetailBuilders
73:   **js/viewer/public-viewer-detail-ui.js** → **createPublicViewerDetailUI, LoveBudPublicViewerDetailUI**
74:   js/viewer/public-viewer-detail-channel-link.js → LoveBudPublicViewerDetailChannelLink
76–99: auth, API, i18n
101–109: shared-header, page-transitions, public-canvas-bridge, public-viewer-canvas-*, public-viewer-copy-*
```

**Key**: `public-viewer-detail-tree-meta.js` (#71) and `public-viewer-detail-builders.js` (#72) must load **before** `public-viewer-detail-ui.js` (#73) because `createPublicViewerDetailUI` calls `createPublicViewerTreeMetaBoundary(deps)` which resolves from `window.createPublicViewerDetailTreeMetaBoundary` or `window.createEditorDetailTreeMetaBoundary`. The builders are accessed via `window.createPublicViewerDetailUIBuilders` and `window.createEditorDetailUIBuilders` at runtime (lazy, not at construction).

### `window.LoveBudPublicViewer*` and `window.create*` surface ownership

| Global | Owner File | Responsibility |
|--------|-----------|--------------|
| `LoveBudPublicViewerDetailPanelShellTemplate` | `public-viewer-detail-panel-shell-template.js` | Detail panel shell mount |
| `LoveBudPublicViewerDetailViewModeTemplate` | `public-viewer-detail-view-mode-template.js` | View mode template |
| `LoveBudPublicViewerDetailEmptyStateTemplate` | `public-viewer-detail-empty-state-template.js` | Empty state template |
| `LoveBudPublicViewerDetailTreeMeta` | `public-viewer-detail-tree-meta.js` | Tree meta namespace |
| `createPublicViewerDetailTreeMetaBoundary` | `public-viewer-detail-tree-meta.js` | Tree meta boundary factory |
| `createPublicViewerDetailUIBuilders` | `public-viewer-detail-builders.js` | Shared UI builders (tags, memo, icon) |
| `createEditorDetailUIBuilders` | `public-viewer-detail-builders.js` | Alias — same function |
| `LoveBudPublicViewerDetailBuilders` | `public-viewer-detail-builders.js` | Builders namespace |
| `createPublicViewerDetailUI` | `public-viewer-detail-ui.js` | Main detail UI factory |
| `LoveBudPublicViewerDetailUI` | `public-viewer-detail-ui.js` | Detail UI namespace object |
| `LoveBudPublicViewerDetailChannelLink` | `public-viewer-detail-channel-link.js` | Channel link renderer |

### Dependency boundary between public canvas entry and detail UI

- `public-canvas-init.js` (line 625) calls `window.createPublicViewerDetailUI(detailUIOptions)`
- `detailUIOptions` is built by `createPublicCanvasDetailUIOptions` (line 288) which reads from `window.LoveBudPublicViewerCanvasEntry.createDetailUIOptions` or falls back to inline options
- The detail UI receives **deps** as a plain object: `detailPanel`, `i18n`, `resolveTreeTitleText`, `resolveHintText`, `resolveInfoText`, `resolveMemoryThumbnail`, `escapeHtml`, `isRootMemory`, `getCanonicalRootId`, `getSelectedNodeId`, `getTreeMemories`, `getCurrentTreeData`, `getLocalSaveMode`, `showToast`, and several no-op read-only actions

### Current public data and visibility guard ownership

Data loading, visibility checks, and publication guard are owned by:
- `js/viewer/public-canvas-bridge.js`
- `js/viewer/public-viewer-canvas-entry.js`
- `js/viewer/public-viewer-canvas-adapter.js`
- `js/viewer/public-canvas-init.js`
- Shared `js/shared/tree-workspace-permission.js`

Detail UI **consumes** resolved data but does **not** own data fetch, visibility decision, or publication guard logic.

## 4. DOM ID / Class / Data Contract Map

### Detail panel structure

```
#detailPanel (shell template)
├── #detailContent
│   ├── #detailEmptyState (created dynamically — see §2.4)
│   │   └── (icon, title, description)
│   └── #detailViewMode (view mode template)
│       ├── .editor-tree-meta-section
│       │   ├── #detailTreeStatusLabel
│       │   └── #detailTreeMetaMount
│       ├── .editor-current-moment-card
│       │   ├── .editor-current-moment-head
│       │   │   └── #detailCurrentMomentBadge
│       │   ├── #detailCurrentMomentTitle
│       │   ├── #detailCurrentMomentHint
│       │   ├── .detail-video
│       │   │   ├── #detailImg
│       │   │   ├── .memory-preview-overlay
│       │   │   │   └── .play-btn
│       │   │   └── [data-editor-detail-player="1"] iframe (dynamically inserted)
│       │   └── #detailCurrentMomentChannel (dynamically inserted by channel-link)
│       ├── .editor-moment-info-card
│       │   ├── #detailMomentInfoLabel
│       │   ├── .detail-info-group.is-compact
│       │   │   ├── #detailDateLabel
│       │   │   └── #detailDateText
│       │   ├── .detail-info-group.is-compact
│       │   │   ├── #detailTagsLabel
│       │   │   └── #detailTags
│       │   └── .detail-info-group
│       │       ├── #detailMemoLabel
│       │       └── .diary-note (#detailMemo)
│       └── .editor-moment-reactions-card (#momentReactionsCard)
│           ├── #momentLikeBtn
│           │   ├── .editor-reaction-like-icon
│           │   └── #momentLikeCount
│           └── #momentCommentBtn
│               ├── .editor-reaction-comment-icon
│               └── #momentCommentCount
```

### Accessibility attributes

- `#detailPanel` — implicit landmark
- `#momentReactionsCard` — `aria-label="순간 반응"`
- `#momentLikeBtn` — `aria-label="좋아요"`, `aria-disabled` set by read-only fallback
- `#momentCommentBtn` — `aria-label="댓글 보기"`, `aria-disabled` set by read-only fallback
- `.editor-tree-meta-section` — `aria-hidden="true"`
- `.editor-current-moment-channel` icon — `aria-hidden="true"`
- `#detailImg` — `alt` set from title or empty
- `.detail-video` — `is-empty` class for failed thumbnail resolution
- `.editor-moment-reactions-card` — `is-public-readonly` class set by read-only fallback, `data-read-only-fallback="true"`

### Reset / selection assumptions

- `updateDetailPanel(data)` with `null` data → all sections cleared or set to empty state
- `setDetailEmptyState(true)` → `#detailViewMode` hidden, `#detailEmptyState` shown
- Media player (`[data-editor-detail-player="1"]`) cleared on each `updateDetailPanel` call
- `#detailCurrentMomentChannel` removed and recreated by channel-link on each call
- `#detailCurrentMomentTitle` and `#detailMemo` children fully rebuilt on each call (no diffing)
- `#detailTags` children fully rebuilt on each call

## 5. Explicit Exclusion Boundaries

### #2972 — Media playback, YouTube embed, player lifecycle

The following in `public-viewer-detail-ui.js` belong to #2972 and must **not** be modified in this extraction:
- `getMemoryPlaybackUrl` (lines 219–231)
- `getYouTubeVideoId` (lines 233–252)
- `buildYouTubeEmbedUrl` (lines 254–307)
- `buildInlinePlayerElement` (lines 309–323)
- `bindDetailMediaPlayback` (lines 325–346)
- `clearDetailPlayer` (lines 208–217)
- The media-specific branches in `updatePublicViewerCurrentMomentImage` (lines 371–410)
- Any `window.LoveBudMedia` dependency

### #2976 — Dynamic copy centralization

The following are shared between viewer and editor and belong to #2976:
- `createPublicViewerDetailUIBuilders` in `public-viewer-detail-builders.js` (shared tag/memo/icon builders)
- `window.createEditorDetailUIBuilders` alias
- `getMemoFallbackText` and `getDisplayEmotionTags` resolution in `createPublicViewerMemoBodyBoundary` and `createPublicViewerCurrentMomentTagsBoundary`

### Owner editor detail panel

The editor's equivalent detail panel (`js/editor/editor-detail-ui.js`) is out of scope. No shared code between editor and viewer detail UI should be moved or refactored in this extraction.

### Public discovery, graph, API, auth, visibility policy

- `public-canvas-init.js` data loading is out of scope
- `public-viewer-canvas-entry.js` canvas entry is out of scope
- `public-canvas-bridge.js` data bridge is out of scope
- `api/*`, `auth/*`, `tree-workspace-permission.js`, visibility policy are out of scope

## 6. First Extraction Candidate (Exact 1)

### Candidate: `createPublicViewerCurrentMomentBadgeBoundary` + `createPublicViewerCurrentMomentTitleBoundary` + `updatePublicViewerCurrentMomentHint` + `updatePublicViewerCurrentMomentDate` → dedicated metadata text module

**Rationale**: These four functions form a self-contained **moment metadata text cluster** that handles read-only text rendering for badge, title, hint, and date. They share the same dependency pattern (`i18n`, `getTreeMemories`, `isRootMemory`, `getCanonicalRootId`) and have no media (#2972), copy centralization (#2976), or API dependency. They are pure DOM text update functions with no side effects beyond the targeted element. Combined size: ~95 lines.

**Operation**: Behavior-preserving source split. Extract metadata text functions into a new `public-viewer-detail-metadata-text.js`. Keep `public-viewer-detail-ui.js` calling them through the same `window.LoveBudPublicViewerDetailUI` namespace.

**Key invariant**: `window.LoveBudPublicViewerDetailUI.createPublicViewerCurrentMomentBadgeBoundary`, `.createPublicViewerCurrentMomentTitleBoundary`, `.updatePublicViewerCurrentMomentHint`, `.updatePublicViewerCurrentMomentDate` must remain resolvable from the same global path after extraction. Callers (`updateDetailPanel` in `createPublicViewerDetailUI`) continue reading from `LoveBudPublicViewerDetailUI.*`.

**Required changes**:
1. Create `js/viewer/public-viewer-detail-metadata-text.js` — host `safeDisplayTitle`, badge, title, hint, date functions
2. `js/viewer/public-viewer-detail-ui.js` — remove extracted functions; import from the new module via `window.LoveBudPublicViewerDetailMetadataText` or keep a local wrapper
3. `pages/view.html` — add `<script>` tag for the new module **before** `public-viewer-detail-ui.js` (between line 72 and 73)
4. Focused contract test(s): verify global surface remains resolvable, verify badge/title/hint/date elements are updated

**Allowed files** (minimum set):
- `js/viewer/public-viewer-detail-metadata-text.js` (new)
- `js/viewer/public-viewer-detail-ui.js` (remove extracted functions, add local delegation)
- `pages/view.html` (add `<script>` tag)
- Focused contract test file(s) covering global surface preservation and metadata text rendering

**Forbidden files**:
- `css/*.css` (no CSS)
- `js/auth.js`, `js/api/*`, `js/postgres-client.js` (no API/auth/DB)
- `js/editor/*` (no editor modules)
- `js/viewer/public-viewer-detail-tree-meta.js` (no tree meta)
- `js/viewer/public-viewer-detail-builders.js` (no shared builders — #2976 scope)
- `js/viewer/public-viewer-detail-channel-link.js` (no channel link)
- `js/viewer/public-canvas-init.js` (no data loading / wiring changes)
- `js/viewer/public-viewer-canvas-entry.js`, `js/viewer/public-canvas-bridge.js` (no canvas entry)
- `js/shared/*` (no shared modules)
- `pages/*.html` except `pages/view.html`
- `functions/*`, `modal_compute/*`, `netlify/*` (no deployment changes)

**Preserved globals**:
- `window.createPublicViewerDetailUI` (unchanged)
- `window.LoveBudPublicViewerDetailUI.*` (all existing boundary methods unchanged; new module may export `LoveBudPublicViewerDetailMetadataText` as a parallel surface)
- `window.LoveBudPublicViewerDetailChannelLink` (unchanged)
- `window.createPublicViewerDetailUIBuilders`, `window.createEditorDetailUIBuilders` (unchanged)
- `window.createPublicViewerDetailTreeMetaBoundary`, `window.LoveBudPublicViewerDetailTreeMeta` (unchanged)

**Rollback condition**:
- If `LoveBudPublicViewerDetailUI.createPublicViewerCurrentMomentBadgeBoundary` is no longer resolvable from `public-viewer-detail-ui.js` → full rollback
- If `updateDetailPanel` breaks badge/title/hint/date rendering → revert
- If `pages/view.html` script order breaks any dependency → revert
- If any existing contract test expects the extracted functions in their original location and they are missing → revert

**Boundary**: Behavior-preserving source split only. No rename, no namespace flatten, no DOM ID change. No new factory function. No media (#2972), copy (#2976), or editor detail panel scope change.

## 7. Related Existing Contract Test / Smoke Coverage

### Existing tests relevant to public viewer detail:

- `tests/contracts/viewer-detail-contracts.test.cjs` (if exists) — verify detail UI global surface
- `tests/contracts/viewer-public-tree-readonly-contract.test.cjs` (if exists) — verify public tree readonly rendering
- `tests/contracts/viewer-public-ui-contract.test.cjs` (if exists) — verify public UI behavior

*Note: Actual contract test file names should be verified against the repository before the implementation PR.*

### Future verification matrix:

| Scenario | Verification method |
|----------|-------------------|
| Public tree route (tree data loads, detail renders) | Focused contract test + user production smoke |
| Empty tree (`isNewTree=true`, no memories) | Focused contract test |
| Selected moment (badge = "선택된 순간", title rendered) | Focused contract test |
| Unavailable media fallback (image empty, `is-empty` class) | Focused contract test (note: media impl in #2972) |
| Load failure fallback (detail empty state) | Focused contract test |
| Public/private or draft non-discovery invariant | No change — covered by existing visibility guard tests |

## 8. No-Go Areas (Explicit)

### Protected PR scope:

- **#2960**: `ux(editor): recompose detail panel with persistent tree context` — no detail-panel scope changes
- **#2856**: `fix(editor): stabilize growth affordance render` — no canvas-affordance scope changes
- **#3070**: `fix(editor): complete save feedback` — paused; no save-completion scope

### Other no-go:

- No API/auth/data-model/user-visible behavior changes
- No global alias reintroduction
- No #2972 media scope changes (URL parsing, embed building, player lifecycle, teardown)
- No #2976 copy centralization scope changes (shared builders, fallback text)
- No editor detail panel (`js/editor/editor-detail-ui.js`) changes
- No `js/editor/*` changes
- No `js/shared/*` changes
- No `js/viewer/public-canvas-init.js`, `public-viewer-canvas-entry.js`, `public-canvas-bridge.js` changes
- No `css/*` changes
- No `functions/*`, `modal_compute/*`, `netlify/*` changes
- No test addition/modification in this audit PR (audit-only)
- No `Closes #1882`, `Fixes #1882`, `Resolves #1882` — only `Refs #1882`

## 9. Next Implementation PR Minimum Scope

### First extraction PR (after this audit):

1. **Create** `js/viewer/public-viewer-detail-metadata-text.js` — host badge, title, hint, date functions
2. **Remove** extracted functions from `js/viewer/public-viewer-detail-ui.js`; delegate to new module via `LoveBudPublicViewerDetailUI` namespace
3. **Add** `<script>` tag in `pages/view.html` for the new module before `public-viewer-detail-ui.js`
4. **No changes** to `public-canvas-init.js`, `public-viewer-canvas-entry.js`, `public-canvas-bridge.js`, or any file outside the §6 allowed list

**Allowed file scope**: see §6 Allowed files. Anything outside that list is forbidden in this slice.

### Verification (next implementation PR):

- `git diff --check` (no whitespace errors)
- Focused contract tests only:
  - Global surface preservation: `LoveBudPublicViewerDetailUI.createPublicViewerCurrentMomentBadgeBoundary` still resolvable
  - Badge/title/hint/date DOM update contract: `#detailCurrentMomentBadge`, `#detailCurrentMomentTitle`, `#detailCurrentMomentHint`, `#detailDateText` updated correctly
  - Script order: `pages/view.html` load order does not break
- Remote CI (GitHub Actions) — merge check only
- User signed-in or public production smoke — after merge, one manual smoke: open a public tree, verify badge/title/hint/date render on moment selection and empty state
- No blanket `npm test`, no `npm run verify:remote`, no `npm run check:pr-guardrails`

## Audit Summary

- **Current state**: `js/viewer/public-viewer-detail-ui.js` = 878 lines, single IIFE, 15+ internal functions, 4 exported to `window.LoveBudPublicViewerDetailUI` namespace, plus `window.createPublicViewerDetailUI`
- **Clusters**: image/media (~219 lines, #2972), tree meta (~115 lines), reaction summary (~124 lines), metadata text (~95 lines), memo (~58 lines), tags (~67 lines), empty state (~53 lines), focus btn (~14 lines), heading (~19 lines), sanitizer (~16 lines), sidebar stub (~1 line), master orchestrator (~47 lines)
- **Dependency**: `public-viewer-detail-tree-meta.js`, `public-viewer-detail-builders.js`, `public-viewer-detail-channel-link.js`, `public-canvas-init.js`, `LoveBudMedia` (lazy), `LoveBudTreeWorkspaceClassifier` (lazy), `apiClient` (lazy)
- **Global surface**: `createPublicViewerDetailUI`, `LoveBudPublicViewerDetailUI.*`, `createPublicViewerDetailUIBuilders`, `createEditorDetailUIBuilders`, `LoveBudPublicViewerDetailChannelLink`
- **First extraction candidate**: Metadata text cluster (badge + title + hint + date) — behavior-preserving source split, ~95 lines
- **Protected**: #2960, #2856, #3070 — all preserved
- **Exclusions**: #2972 (media), #2976 (copy) — not touched
- **No-go**: No API/auth/data-model/behavior change; no media/copy/editor-detail-panel scope changes; no `public-canvas-init.js` changes; no `js/editor/*` changes; no global rename or namespace flatten in this slice

Refs #3090
Refs #1882
