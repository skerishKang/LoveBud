# Legacy Compatibility Retirement Registry

Canonical record of legacy interfaces, compatibility boundaries, and transitional
artifacts remaining in the LoveBud / LoveTree codebase.

**This registry does not authorize removal, refactoring, or migration.**
It records evidence, ownership, risk, consumers, and preconditions so that
future removal decisions can be made with verified facts.

## Parent issue

- #3425 (Keep OPEN)

## Related issues

- #3075 (Social: moment-level — Keep OPEN)
- #3188 (Social: tree-level — Keep OPEN)
- #1882 (Keep OPEN)
- #3454 (this registry — closes on merge)

---

## Classification vocabulary

Five allowed values. Each entry must carry exactly one.

| Classification | Meaning |
|---|---|
| `RETAIN_TEMPORARILY` | Current consumers exist and a replacement is not yet complete. Must stay until preconditions are met. |
| `PERMANENT_COMPATIBILITY_BOUNDARY` | Product intentionally commits to supporting this boundary indefinitely. |
| `REMOVAL_CANDIDATE` | Evidence of absent consumers or completed replacement exists, but a separate removal issue and verification are required. |
| `OWNED_BY_OTHER_TRACK` | Owned by another product or migration track. This registry records compatibility context only. |
| `EVIDENCE_REQUIRED` | Safe classification cannot be determined from current `main` evidence alone. |

---

## Entry 1: Transitional public-tree adapter

- Evidence paths:
  - `js/api/public-tree-adapter.js`
  - `index.html` (script include)
  - `pages/search.html` (script include)
  - `pages/my-trees.html` (script include)
- Owner domain: Frontend — public browse / search
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  Provides `window.LoveTreePublicTreeAdapter` with `normalizeBrowseTreeRecord`,
  `normalizeBrowseMemoryRecord`, `buildPublicTreeSummaryModels`,
  `buildPublicTreeViewModels`, and YouTube canonicalization helpers.
  Also injects into `window.__LoveBudApiClientInternals` via
  `js/postgres-client.js:238` for internal API client consumption.
  Multiple contract tests parse and execute this module.
- Known consumers:
  - `index.html:85` — page-level script include
  - `pages/search.html:148` — page-level script include
  - `pages/my-trees.html:132` — page-level script include
  - `js/viewer/public-canvas-bridge.js:58-59` — reads `window.LoveTreePublicTreeAdapter`
  - `js/postgres-client.js:238` — sets `window.__LoveBudApiClientInternals`
  - `tests/contracts/public-tree-adapter-*.test.cjs` — 5+ contract tests parse source
  - `tests/contracts/tree-thumbnail-normalization-contract.test.cjs`
  - `tests/contracts/naming-canonical-namespace.test.cjs`
  - `tests/contracts/auth-offline-mode.test.cjs`
  - `tests/contracts/auth-confirmed-session-retry.test.cjs`
  - `tests/contracts/my-trees-visibility-display-contract.test.cjs`
  - `tests/routes/search-script-order-contract.test.cjs` / `.js`
- Compatibility/change risk:
  Breaking the adapter surface breaks all public browse pages, the public canvas
  bridge, and many contract tests. Snake_case → camelCase normalization is the
  core transitional shape. Removing the adapter requires every consumer to read
  canonical camelCase fields directly.
- Exact removal preconditions:
  - All 3 HTML script includes removed (adapter no longer served to browsers)
  - `window.__LoveBudApiClientInternals` injection relocated or removed
  - `public-canvas-bridge.js` reads canonical fields directly without adapter
  - All adapter-dependent contract tests migrated to canonical shape
  - `window.LoveTreePublicTreeAdapter` has zero runtime callers
- Permanent-support decision: (not applicable — classified RETAIN_TEMPORARILY)
- Verification before removal:
  - repository-wide `LoveTreePublicTreeAdapter` reference count = 0
  - repository-wide `__LoveBudApiClientInternals` reference count = 0
  - all browse/search/my-trees pages load and render without the adapter script
  - public canvas bridge loads public tree data without adapter dependency
- Rollback/restore expectation:
  Revert the commit that removes the script includes and adapter file. All
  contract tests will re-pass.
- Linked issue or future-child candidate: (none yet — created as part of #3454)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 2: Modal legacy public-read normalization

- Evidence paths:
  - `modal_compute/public_reads.py`
  - `modal_compute/app.py` (imports from `public_reads` at lines 25-27)
  - `modal_compute/validation.py` (normalize_row, normalize_memory_row, etc.)
- Owner domain: Modal compute — public read endpoints
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  `modal_compute/public_reads.py` (780 lines) contains the canonical public
  browse/detail query layer with legacy normalization fallbacks:
  - `_is_public_legacy_node()` (line 76) — checks legacy payload shape for public visibility
  - `normalize_row()` with `include_like_count` — builds camelCase output from snake_case DB columns
  - `_build_reaction_counts()` — wraps raw counts with `total` key
  - `_table_exists` / `_table_has_column` caching — accommodates gradual schema evolution
  - `like_count` / `view_count` column detection and conditional query building
  - `fetch_public_tree_like_count` consumed by `app.py:254`
  - Browse sort by `likes` / `views` with conditional column presence
- Known consumers:
  - `modal_compute/app.py:25-27` — imports `fetch_public_tree_list`, `fetch_public_tree_detail`, etc.
  - `modal_compute/app.py:254` — calls `fetch_public_tree_like_count`
  - Dozens of contract tests read and assert on `modal_compute/public_reads.py` content
- Compatibility/change risk:
  Normalization layer is deeply embedded in the public read query pipeline.
  Removing it requires schema-level `like_count`/`view_count` column guarantee
  and all consumers to accept raw DB shapes.
- Exact removal preconditions:
  - `tree_social_counts.like_count` and `tree_social_counts.view_count` columns guaranteed present in all environments (no conditional column detection)
  - All public read endpoints return canonical camelCase payloads without normalization
  - `public_reads.py` legacy fallback code (`_is_public_legacy_node`, column-detection SQL paths) has zero callers
  - Contract tests updated to assert canonical shapes only
- Permanent-support decision: (not applicable — classified RETAIN_TEMPORARILY)
- Verification before removal:
  - Deployment with schema migration completes successfully
  - Browse/search/detail public endpoints return correct payloads without `public_reads.py` normalization
  - Sort-by-likes and sort-by-views work without conditional column detection
- Rollback/restore expectation:
  Revert the `public_reads.py` change and re-deploy Modal. Pre-removal
  normalization resumes.
- Linked issue or future-child candidate: (future child for `public_reads.py` decomposition)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 3: Shared Viewer/Editor state aliases

### 3a. `window.currentTreeData`

- Evidence paths:
  - Producer: `js/viewer/public-canvas-bridge.js:115`
  - Producer: `js/editor/editor-tree-helpers.js:67`
  - Producer: `js/editor/editor-rename-ui.js:240`
  - Consumer: `js/editor.js:226`
  - Consumer: `js/editor/editor-canvas.js:27`
  - Consumer: `js/editor/editor-detail-sidebar-status-boundary.js:26`
  - Consumer: `js/editor/editor-memory-actions.js:269`
  - Consumer: `js/editor/editor-page-helpers.js:174`
  - Consumer: `js/editor/editor-rename-ui.js:50`
  - Consumer: `js/viewer/public-canvas-init.js:362`
  - Consumer: `js/viewer/public-viewer-canvas-entry.js:162`
  - Consumer: `js/viewer/viewer-handler-factory.js:33`
  - Many test files set and read this value
- Owner domain: Editor + Viewer shared runtime
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  Global mutable state alias used as the primary tree-data conduit between
  the editor shell, viewer canvas bridge, and legacy `editor.js` entry point.
  The viewer public-canvas-bridge sets it; the editor reads it on startup.
- Known consumers: (see evidence paths above — ~40+ references across editor, viewer, tests)
- Compatibility/change risk: Breaking removes the editor data-loading contract.
- Exact removal preconditions: All direct `window.currentTreeData` reads replaced with
  a scoped data-sharing mechanism; editor.js entry flow no longer depends on the global.
- Verification before removal:
  - repository-wide `currentTreeData` direct reference count = 0
  - editor and viewer both load and operate without relying on the global
- Rollback/restore expectation:
  Re-instate `window.currentTreeData` assignment in the producer files.
- Linked issue or future-child candidate: (related to editor data-flow refactoring)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

### 3b. `window.currentTreeMemories`

- Evidence paths:
  - Producer: `js/viewer/public-canvas-bridge.js:116`
  - Producer: `js/editor/editor-data-loader.js:204,243,268`
  - Producer: `js/editor/editor-data-loader-fallbacks.js:195,230,297`
  - Consumer: `js/editor.js:558-559`
  - Consumer: `js/editor/editor-canvas.js:863`
  - Consumer: `js/editor/editor-floating-toolbar-selection.js:47-48`
  - Consumer: `js/editor/editor-initial-load-flow.js:90`
  - Consumer: `js/editor/editor-page-helpers.js:174`
  - Consumer: `js/viewer/public-canvas-init.js:92`
  - Many test files
- Owner domain: Editor + Viewer shared runtime
- Classification: `RETAIN_TEMPORARILY`
- Reason retained: Same pattern as `currentTreeData` — mutable global array for memories.
- Known consumers: ~30+ references
- Compatibility/change risk: Same as currentTreeData — removing breaks memory data availability.
- Exact removal preconditions: Same as `currentTreeData` — all direct reads replaced.
- Verification before removal:
  - repository-wide `currentTreeMemories` direct reference count = 0
  - editor memory operations work without the global array
- Rollback/restore expectation:
  Re-instate `window.currentTreeMemories` assignment in producer files.
- Linked issue or future-child candidate: (same as 3a)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

### 3c. `window.__viewerTreeData`

- Evidence paths:
  - Producer: `js/viewer/public-canvas-init.js:697`
  - Consumer: `js/viewer/public-canvas-init.js:350,700,749,771,802,840`
- Owner domain: Viewer runtime
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  Viewer-specific tree data cache used within `public-canvas-init.js` to track
  the active viewer tree data independently of `currentTreeData`. Used as a
  fallback source and for periodic refresh checks.
- Known consumers: Only within `public-canvas-init.js` (6 references) plus
  `tests/contracts/modal-tree-capability-contract.test.cjs` (4 references)
- Compatibility/change risk: Low — confined to `public-canvas-init.js` and one test file.
- Exact removal preconditions:
  - `public-canvas-init.js` references replaced by scoped variable or closure state
  - Contract test mocks updated
- Verification before removal:
  - repository-wide `__viewerTreeData` reference count = 0
  - public viewer canvas initialization works without the alias
- Rollback/restore expectation:
  Re-instate `window.__viewerTreeData` assignment in `public-canvas-init.js`.
- Linked issue or future-child candidate: (viewer state management)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 4: Editor canvas global compatibility bridge

- Evidence paths:
  - `js/editor/editor-canvas.js:841-853` — defines `window.LoveBudEditorCanvas` and `window.LoveBudEditor`
  - `js/editor/editor-canvas.js:27` — reads `window.currentTreeData` and `window.currentTreeMemories`
  - `js/editor.js:496` — calls `window.createEditorCanvas({...})`
  - `js/viewer/public-canvas-init.js:58` — calls `window.createEditorCanvas(canvasOptions)`
  - `js/viewer/public-viewer-canvas-entry.js:7-9` — resolves `LoveBudEditorCanvas` or `createEditorCanvas`
  - `js/viewer/public-canvas-bridge.js:114-116` — sets globals expected by `createEditorCanvas`
- Owner domain: Editor canvas runtime
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  `window.createEditorCanvas` and `window.LoveBudEditorCanvas` are the primary
  entry points for creating the tree canvas in both the editor and public viewer.
  The viewer (public-canvas-init.js, public-canvas-bridge.js) depends on these
  globals to render the interactive tree canvas for public read-only display.
  Additionally, `window.LoveBudEditor` (root namespace with `.canEdit`, `.initCanvas`,
  `.refresh`, `.render`) is the legacy entry surface for `editor.js`.
- Known consumers:
  - `js/viewer/public-canvas-init.js:52,58` — calls `window.createEditorCanvas`
  - `js/viewer/public-viewer-canvas-entry.js:7-9,18` — resolves canvas entry
  - `js/viewer/public-canvas-adapter.js:7` — reads `createEditorCanvas` from options
  - `js/editor.js:62,301,496` — orchestrates canvas creation
  - `js/editor/editor-shell-guards.js:74` — checks `createEditorCanvas` presence
  - Multiple `window.LoveBudEditor*` namespace consumers across `js/editor/` and `js/viewer/`
- Compatibility/change risk:
  Removing these globals breaks both the editor page and the public viewer
  canvas rendering. The bridge is the sole mechanism for the viewer to reuse
  the editor canvas rendering pipeline.
- Exact removal preconditions:
  - Viewer canvas no longer depends on editor canvas globals (viewer uses its own rendering pipeline)
  - `editor.js` entry flow uses dependency injection instead of global `window.createEditorCanvas`
  - `window.LoveBudEditor` namespace fully replaced by scoped module system
  - All `window.LoveBudEditor*` global namespace consumers migrated
- Permanent-support decision: (not applicable — classified RETAIN_TEMPORARILY)
- Verification before removal:
  - Editor page loads and renders canvas without global function
  - Public viewer loads and renders canvas without global function
  - All contract tests that assert on `createEditorCanvas` presence updated
- Rollback/restore expectation:
  Revert the commit. Both editor and public viewer canvas rendering resume
  via globals.
- Linked issue or future-child candidate: (future child for editor canvas module decomposition)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 5: Legacy key guard

- Evidence paths:
  - `functions/_shared/legacy-key-guard.js`
  - `functions/_shared/memory-route-proxy.js:1` (imports `validateWritePayload`)
  - `functions/api/trees.js:1` (imports `validateWritePayload`)
- Owner domain: Cloudflare Functions — write boundary
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  Server-side guard that rejects legacy localization keys (dot-separated or
  underscore-separated patterns) in write payloads with HTTP 400.
  Mirrors client-side logic in `js/shared/localization-key-utils.js` (#2940).
  Imported by the memory route proxy and the trees API function.
- Known consumers:
  - `functions/_shared/memory-route-proxy.js:1` — ESM import
  - `functions/api/trees.js:1` — ESM import
  - `tests/contracts/localization-key-write-rejection-contract.test.cjs` — 15+ test assertions
- Compatibility/change risk:
  Removing the guard before all clients send canonical keys would allow legacy
  localization key strings (e.g. `tree.title`, `editor_url_only_youtube_title`)
  to be persisted as actual title/memo values.
- Exact removal preconditions:
  - All write-sending clients (web, test, any automation) send canonical (non-legacy) title/memo values
  - `localization-key-write-rejection-contract.test.cjs` updated or removed
  - No legacy localization key observed in production write payloads for ≥1 release cycle
- Permanent-support decision: (not applicable — classified RETAIN_TEMPORARILY)
- Verification before removal:
  - Monitor production write logs: zero legacy-key rejections over a full release cycle
  - Remove the import from `memory-route-proxy.js` and `trees.js`
  - Deploy and verify no 400 errors for legitimate writes
- Rollback/restore expectation:
  Re-instate the import in both consumer files and re-deploy Cloudflare Functions.
- Linked issue or future-child candidate: #2940 (legacy localization key removal tracking)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 6: Legacy moment/tree Social storage

### 6a. Moment-level Social

- Evidence paths:
  - `modal_compute/reactions.py` — `like_count` handling for moments
  - `modal_compute/comments.py` — `comment_count` handling for moments
  - `modal_compute/app.py` — routes for `/modal/private/memories/{id}/reactions` and `/modal/public/trees/{tid}/memories/{mid}/reactions`
  - Client consumers: `js/detail/detail-loader.js:250-251`, `js/editor/editor-detail-ui.js:55-56`, `js/editor/editor-detail-sidebar-status-boundary.js:73-74`
- Owner domain: Social feature track
- Classification: `OWNED_BY_OTHER_TRACK`
- Reason retained: Moment-level social (reactions, comments) is owned by the Social
  feature track (#3075). This registry records compatibility context only.
- Known consumers: See evidence paths above.
- Compatibility/change risk: Owned by #3075. Schema changes affect moment-level reaction/comment counts.
- Exact removal preconditions:
  - Handled by #3075 Social track. This registry does not authorize moment-level
    Social implementation, schema migration, column deletion, endpoint activation,
    or scope merging.
- Permanent-support decision: (not applicable — OWNED_BY_OTHER_TRACK)
- Verification before removal: Per #3075 scope.
- Rollback/restore expectation: Per #3075 scope.
- Linked issue or future-child candidate: #3075 (Keep OPEN)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

**Important:**
This registry records compatibility context only. It does not authorize Social
implementation, schema migration, column deletion, endpoint activation, or scope
merging.

### 6b. Tree-level Social

- Evidence paths:
  - `modal_compute/tree_likes.py` — `tree_social_counts.like_count`, `toggle_tree_like`, `fetch_public_tree_like_count`
  - `modal_compute/tree_views.py` — `tree_social_counts.view_count`, `record_public_tree_view`, `fetch_public_tree_view_count`
  - `modal_compute/public_reads.py` — conditional SQL with `like_count`/`view_count` column detection
  - `modal_compute/validation.py:128-168` — `normalize_row` with `include_like_count`
  - Client consumers: `js/my-trees/my-trees-preview-hub.js:528-530`, `js/my-trees/my-trees-ui.js:354-356`, `js/search/search-card-renderer.js:161`, `js/search/search-share-link.js:104-105`, `js/shared/appreciation-render-model.js:250-253`
- Owner domain: Social feature track
- Classification: `OWNED_BY_OTHER_TRACK`
- Reason retained: Tree-level social (likes, views, comments) is owned by the Social
  feature track (#3188). This registry records compatibility context only.
- Known consumers: See evidence paths above.
- Compatibility/change risk: Owned by #3188. Schema changes affect tree-level like/view/comment counts.
- Exact removal preconditions:
  - Handled by #3188 Social track. This registry does not authorize tree-level
    Social implementation, schema migration, column deletion, endpoint activation,
    or scope merging.
- Permanent-support decision: (not applicable — OWNED_BY_OTHER_TRACK)
- Verification before removal: Per #3188 scope.
- Rollback/restore expectation: Per #3188 scope.
- Linked issue or future-child candidate: #3188 (Keep OPEN)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

**Important:**
This registry records compatibility context only. It does not authorize Social
implementation, schema migration, column deletion, endpoint activation, or scope
merging.

---

## Entry 7: Deprecated Netlify artifacts

- Evidence paths:
  - `netlify/README.md`
  - `netlify/functions/README.md`
  - `netlify/sql/README.md`
  - `scripts/check-pr-guardrails.js:25` and `scripts/check-pr-guardrails.cjs:25` reference `netlify/`
- Owner domain: Infrastructure / Ops
- Classification: `REMOVAL_CANDIDATE`
- Reason retained:
  Netlify is documented as legacy (see `netlify/README.md:1`: "Legacy / Fallback /
  Artifact (NOT Active Production Backend)"). Files are README-only with no
  active runtime code. No production traffic is served through Netlify.
  However, the infra team may retain these for historical reference or
  emergency rollback documentation.
- Known consumers:
  - `scripts/check-pr-guardrails.js:25` — lists `netlify/` in forbidden-change paths for docs-only PRs
  - `scripts/check-pr-guardrails.cjs:25` — same
  - `netlify/README.md` notes: "Do not delete, move, or reactivate any file in this folder without CTO approval."
- Compatibility/change risk:
  Low — no active runtime depends on `netlify/`. The check-pr-guardrails
  reference actively prevents new Netlify changes from entering docs-only PRs.
- Exact removal preconditions:
  - CTO approval obtained (per `netlify/README.md` ownership rule)
  - `scripts/check-pr-guardrails.js` and `.cjs` `netlify/` entry removed
  - Historical reference preserved in `git log`
- Permanent-support decision: (not applicable — classified REMOVAL_CANDIDATE)
- Verification before removal:
  - Confirm zero active references to Netlify in Cloudflare or Modal configuration
  - Confirm no production traffic routed through Netlify
  - Remove directory and update guardrail scripts
- Rollback/restore expectation:
  `git revert` of the removal commit restores all files.
- Linked issue or future-child candidate: (Netlify cleanup issue)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`

---

## Entry 8: Transitional Vercel fallback

- Evidence paths:
  - `vercel.json`
  - `docs/ops/OPERATIONS.md` (referenced in vercel.json `x-lovebud-runtime-docs`)
  - `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md` (referenced in vercel.json)
- Owner domain: Infrastructure / Ops
- Classification: `RETAIN_TEMPORARILY`
- Reason retained:
  `vercel.json` defines page rewrites (e.g., `/intro.html` → `/pages/intro.html`)
  and is marked as "Deprecated transitional fallback only" with the note that
  "Active user-facing runtime is Cloudflare Pages". It is retained as a
  secondary/transitional entry point for potential rollback or parallel-run scenarios.
- Known consumers:
  - Vercel deployment pipeline (if active)
  - Historical reference in `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- Compatibility/change risk:
  Low — Cloudflare Pages is the active production frontend. The vercel.json
  rewrite rules mirror Cloudflare Pages behavior but are not actively serving
  production traffic.
- Exact removal preconditions:
  - Cloudflare Pages deployment parity confirmed (all page routes work without Vercel rewrites)
  - Migration runbook updated to reflect Vercel as fully decommissioned
  - No consumer or CI pipeline depends on Vercel deployment
- Permanent-support decision: (not applicable — classified RETAIN_TEMPORARILY)
- Verification before removal:
  - Confirm all page routes (`/intro.html`, `/login.html`, `/search.html`, `/detail.html`, `/editor.html`, `/my-trees.html`) resolve correctly via Cloudflare Pages
  - Confirm no CI/CD workflow references Vercel deployment
- Rollback/restore expectation:
  Re-instate `vercel.json` from `git revert` if Vercel fallback is needed again.
- Linked issue or future-child candidate: (Vercel decommission tracking)
- Last evidence baseline:
  - SHA: `0c3b283a235d760a661b1e7fff61f6e3a44d466e`
  - Date: `2026-07-14`
