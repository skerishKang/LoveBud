# Legacy Compatibility Retirement Registry

## Purpose

This document defines the repository-owned registry format and the initial inventory
of legacy and transitional structures that LoveBud still retains. It is **not** a
removal list and does not authorize deletion of any runtime artifact.

The registry field set and vocabulary defined here are the official operational
format for tracking legacy/transitional artifacts. The recorded items (LC-001
through LC-005) constitute the **initial inventory**; this inventory is not claimed to be exhaustive. Other legacy or transitional artifacts may exist elsewhere
in the repository. Any newly identified artifact must go through a separate evidence
review before a registry item is added.

For every entry it records:

- why the artifact is still retained,
- which consumers have been confirmed or are only suspected,
- what is explicitly not yet confirmed,
- when removal review may become possible,
- which verification must pass before any future removal.

The registry supports the architecture changeability and production-parity work
tracked under parent Issue #3425. It was created for Issue #3427 through PR #3428,
following the audit foundation merged in PR #3426
(`docs/engineering/lovebud-changeability-production-parity-audit.md`).

## Rules

1. Registry entries are documentation only. No runtime file in this repository is
   modified, deleted, moved, or reactivated by this document.
2. Every factual claim is tagged with an evidence level:
   - `CONFIRMED` — verified directly in the repository source (file content,
     grep/import search) at the recorded `Last-reviewed main SHA`.
   - `LIKELY` — strongly inferred from indirect evidence but not directly proven
     from source.
   - `UNKNOWN` — consumer or removal safety is not established from source.
   Do not force an `UNKNOWN` into a conclusion.
   The item-level `Evidence level` classifies the artifact's existence and its
   primary source evidence (file present, self-described role, source consumers
   found). Individual operational or removal-safety claims inside the item must
   still be tagged `CONFIRMED`, `LIKELY`, or `UNKNOWN` separately when they differ
   from the item-level classification. Source consumer existence can be `CONFIRMED`;
   live payload necessity, deployed legacy-record existence, and client/server
   responsibility overlap are typically `LIKELY` or `UNKNOWN`.
3. Production, staging, databases, and Docker are never queried to fill `UNKNOWN`
   values. The registry stays within repository-source evidence.
4. Classification uses a fixed vocabulary:
   `TRANSITIONAL_ADAPTER`, `COMPATIBILITY_ALIAS`, `DUAL_NORMALIZATION_PATH`,
   `LEGACY_DEPLOYMENT_ARTIFACT`, `PERMANENT_SUPPORT_CANDIDATE`.
   A new value is added only with an explicit written justification in the entry.
5. Status uses a fixed vocabulary:
   `RETAIN`, `REVIEW_REQUIRED`, `REMOVAL_BLOCKED`, `PERMANENT_SUPPORT_PENDING`.
6. New GitHub removal issues are not created from this registry. If a concrete
   narrow gap is found, the follow-up decision records `NEW_NARROW_GAP_REQUIRED`
   or `FOLLOW_UP_UNDECIDED` for separate CTO judgment after merge.

## Domain ownership

Each entry declares a single domain owner so cross-domain concerns are not mixed:

- `PUBLIC_READ_COMPATIBILITY` — public browse/viewer read normalization and adapters.
- `EDITOR_VIEWER_SHARED_STATE` — shared mutable globals between editor and viewer.
- `DEPLOYMENT_LEGACY` — legacy deployment configuration and artifacts.

These must not be confused with other domain owners:

- Tree Social: #3188 / PR #3424 context
- Moment Social: #3075
- Scout: #1882 (Scout is **not** a Social owner; it is a separate discovery surface)
- Architecture parent: #3425

Scout (#1882) is referenced only as a boundary; it is neither implemented nor
extended by this registry work.

## Registry vocabulary reference

Evidence levels: `CONFIRMED`, `LIKELY`, `UNKNOWN`.
Classification: `TRANSITIONAL_ADAPTER`, `COMPATIBILITY_ALIAS`,
`DUAL_NORMALIZATION_PATH`, `LEGACY_DEPLOYMENT_ARTIFACT`,
`PERMANENT_SUPPORT_CANDIDATE`.
Status: `RETAIN`, `REVIEW_REQUIRED`, `REMOVAL_BLOCKED`,
`PERMANENT_SUPPORT_PENDING`.

---

## LC-001 — public tree client adapter

- Registry ID: LC-001
- Artifact / path: `js/api/public-tree-adapter.js`
- Domain owner: PUBLIC_READ_COMPATIBILITY
- Classification: TRANSITIONAL_ADAPTER
- Evidence level: CONFIRMED
- Evidence:
  - File contents read directly at `js/api/public-tree-adapter.js` (271 lines).
  - The adapter's own header states it is `Transitional compatibility only for
    public browse paths` and `Handles legacy { data } wrapper and tree_id,
    created_at, owner_id, emotion_tags`. (CONFIRMED)
  - Consumers found by repository-wide search:
    - `js/viewer/public-canvas-bridge.js:58` reads `window.LoveTreePublicTreeAdapter`. (CONFIRMED)
    - `js/search/search-index.js:262` calls `buildPublicTreeSummaryModels`. (CONFIRMED)
    - `js/search/search-data-adapter.js:13` returns the adapter. (CONFIRMED)
    - `js/postgres-client.js:2` captures `window.LoveTreePublicTreeAdapter` at
      module-evaluation time and throws `'LoveTreePublicTreeAdapter not loaded'`
      if absent. (CONFIRMED)
    - `js/my-trees/my-trees-card-visuals.js:95` uses the adapter. (CONFIRMED)
    - `js/browse-prefetch.js:38` uses `buildPublicTreeSummaryModels`. (CONFIRMED)
  - The adapter also assigns YouTube helpers to `window.__LoveBudApiClientInternals`
    when present. (CONFIRMED)
  - Whether every production page still depends on the legacy `{ data }` unwrap
    path versus only the canonical camelCase path is `UNKNOWN` from source alone.
- Reason retained:
  - Confirmed source consumers (listed under Known consumers) still load or call the
    adapter at runtime start, and the adapter contract still supports legacy
    `{ data }` envelopes and snake_case fields (`tree_id`, `created_at`, `owner_id`,
    `emotion_tags`). Whether current live responses still require each legacy branch
    is `UNKNOWN` from repository source alone.
  - `postgres-client.js` reads the adapter at module load, so removal would break the
    current source-loading contract documented in
    `PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md`. Live legacy-shape necessity is `UNKNOWN`.
- Known consumers:
  - `js/viewer/public-canvas-bridge.js`
  - `js/search/search-index.js`
  - `js/search/search-data-adapter.js`
  - `js/postgres-client.js`
  - `js/my-trees/my-trees-card-visuals.js`
  - `js/browse-prefetch.js`
  - (Potential indirect consumers via `window.__LoveBudApiClientInternals` are
    `UNKNOWN`; no additional indirect consumer is claimed without exact source
    evidence.)
- Compatibility/change risk:
  - High for the public viewer/read path: removing the adapter breaks
    `postgres-client.js` initialization and the confirmed browse/search/viewer
    consumers listed above that depend on snake_case or `{ data }` normalization.
  - The Modal normalization in `modal_compute/public_reads.py` returns canonical
    camelCase, so part of the client-side legacy unwrap may be redundant once the
    API response shape is guaranteed canonical; that overlap is `LIKELY` but not
    proven safe to drop from the client.
- Removal preconditions:
  - Repository-wide import/reference search for `LoveTreePublicTreeAdapter` returns
    zero production consumers outside this transitional adapter contract.
  - `postgres-client.js` no longer captures the adapter at module load, or a
    canonical replacement is wired before removal.
  - Public browse/search/viewer fixed-slot contracts pass using only canonical
    camelCase responses with the `{ data }` unwrap path removed.
  - `PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md` loading-order contract is updated and
    the script tag is removed from all referencing `pages/*.html`.
- Required verification before removal:
  - `node --test tests/contracts/public-tree-adapter-module.test.cjs` and the
    namespace/loading contract tests pass without the adapter present.
  - Preview deployment smoke for `/search.html`, `/detail.html`, and the public
    viewer passes after adapter removal.
  - Rollback is a single commit revert with no data/schema mutation.
- Rollback/recovery expectation:
  - Source revert only. Re-add `js/api/public-tree-adapter.js` and its script tag;
    no DB or schema change is involved.
- Existing issue/audit relationship:
  - Parent: #3425.
  - Audit foundation: PR #3426 (`lovebud-changeability-production-parity-audit.md`,
    editor/viewer + public-read legacy retention section).
  - Related audit: `PUBLIC_TREE_ADAPTER_BOUNDARY_AUDIT.md` (#412),
    `PUBLIC_TREE_YOUTUBE_UTILITY_SPLIT_AUDIT.md`,
    `JS_SCRIPT_LOADING_NAMESPACE_CONTRACT.md`.
  - This is a concrete gap beyond those audit acceptances, so follow-up is
    `NEW_NARROW_GAP_REQUIRED` scoped to client adapter retirement only.
- Follow-up decision: NEW_NARROW_GAP_REQUIRED
- Status: REMOVAL_BLOCKED
- Last-reviewed main SHA: 81d01bb6b5085e0333d901d2e6c929f9b197349e

---

## LC-002 — Modal public read normalization

- Registry ID: LC-002
- Artifact / path: `modal_compute/public_reads.py`
- Domain owner: PUBLIC_READ_COMPATIBILITY
- Classification: DUAL_NORMALIZATION_PATH
- Evidence level: CONFIRMED
- Evidence:
  - File contents read directly at `modal_compute/public_reads.py` (780 lines).
  - The module imports `normalize_row`, `normalize_memory_row`, `normalize_tree_row`
    from `modal_compute.validation` for the modern path. (CONFIRMED)
  - Legacy normalization helpers are present and named explicitly:
    `_is_public_legacy_node`, `_get_legacy_memory_from_payload`,
    `_legacy_payload_node_to_memory_row`, `_normalize_legacy_tree_row`,
    `_normalize_legacy_memory_row`. They convert the legacy
    `name/is_public/payload` tree shape and `payload.nodes` into the canonical
    memory/tree shape expected by the frontend. (CONFIRMED)
  - Multiple public-read functions document a modern/memories-table path with a
    `Falls back to legacy trees.payload format if memories table is missing`
    branch: `fetch_latest_public_tree_snapshots`,
    `fetch_growing_public_tree_snapshots`, `fetch_public_memories`,
    `fetch_public_memory`. (CONFIRMED)
  - API entrypoints confirmed in `modal_compute/app.py`:
    `fetch_latest_public_tree_snapshots` (app.py:157),
    `fetch_growing_public_tree_snapshots` (app.py:178),
    `fetch_public_memories` (app.py:205), `fetch_public_memory` (app.py:225). (CONFIRMED)
  - The client adapter (LC-001) and this module overlap on snake_case/legacy
    unwrap, but the boundary is `LIKELY` split: client handles response envelope
    + YouTube canonicalization, Modal handles DB-row legacy payload. Exact overlap
    ownership is `UNKNOWN` without tracing every live response shape.
- Reason retained:
  - The source retains compatibility for deployments or records that may still use
    the legacy `payload.nodes` shape or lack the modern `memories` table. The legacy
    fallback remains reachable in source and the public-read functions are called by
    the app routes, so the fallback path must stay wired until a future data/schema
    review says otherwise.
  - Whether any currently deployed data or schema still requires this fallback is
    `UNKNOWN` from repository source alone. Removal therefore remains blocked until
    that future evidence is obtained.
- Known consumers:
  - `modal_compute/app.py` FastAPI routes (public tree list, growing trees, public
    memories, single public memory).
  - Frontend public read paths that consume the normalized camelCase output
    (search/browse/detail/viewer via LC-001).
- Compatibility/change risk:
  - High if removed while any legacy-shaped record or missing `memories` table
    remains: public reads would silently drop trees/memories.
  - Single-ownership transfer to the client adapter is risky until the API response
    contract is guaranteed canonical end-to-end.
- Removal preconditions:
  - A separately approved read-only data/schema audit confirms that no deployed
    environment in scope requires the legacy `payload.nodes` fallback and that the
    modern `memories` table/columns are present. This audit is **not** performed by
    this PR; it is a future verification requirement.
  - The audit result must be sanitized and must not expose DB credentials, raw
    records, raw UUIDs, or private endpoints.
  - Executable fixtures cover both the previous legacy input and canonical input and
    prove canonical-only behavior before removal.
  - Repository source search confirms no route still calls the legacy helper
    functions after the approved migration/cutover.
- Required verification before removal:
  - `node --test` and the Modal public-read contract suite
    (`tests/contracts/test_public_legacy_memory_visibility.py`) pass with the
    legacy branch removed.
  - Preview deployment smoke for public browse/search/viewer returns equivalent
    results to the dual-path baseline.
  - Rollback is a single commit revert with no data/schema mutation.
- Rollback/recovery expectation:
  - Source revert only (restore the legacy fallback branch). No DB or schema change.
- Existing issue/audit relationship:
  - Parent: #3425.
  - Audit foundation: PR #3426.
  - This entry is deliberately scoped away from PR #3424 (`tree_comments`
    migration), tree-level Social (#3188), and moment-level Social (#3075). Those
    are separate owners and must not be conflated with public-read normalization.
  - Concrete gap beyond the audit acceptance → `NEW_NARROW_GAP_REQUIRED` scoped to
    Modal legacy normalization retirement only.
- Follow-up decision: NEW_NARROW_GAP_REQUIRED
- Status: REMOVAL_BLOCKED
- Last-reviewed main SHA: 81d01bb6b5085e0333d901d2e6c929f9b197349e

---

## LC-003 — editor/public-viewer compatibility globals

- Registry ID: LC-003
- Artifact / path:
  - `window.currentTreeData` (write: `js/viewer/public-canvas-bridge.js:115`,
    `js/editor/editor-tree-helpers.js:67`, `js/editor/editor-rename-ui.js:240,246`;
    read: editor + viewer handlers)
  - `window.currentTreeMemories` (write: `js/viewer/public-canvas-bridge.js:116`,
    `js/editor/editor-data-loader.js:204,243,268`,
    `js/editor/editor-data-loader-fallbacks.js:195,230,297`, `js/editor.js:559,610`;
    read: editor + viewer)
  - `window.__viewerTreeData` (write: `js/viewer/public-canvas-init.js:697`;
    read: `js/viewer/public-canvas-init.js:700,749,771,802,840`)
- Domain owner: EDITOR_VIEWER_SHARED_STATE
- Classification: COMPATIBILITY_ALIAS
- Evidence level: CONFIRMED
- Evidence:
  - Write/read sites located by repository-wide search of `window.currentTreeData`,
    `window.currentTreeMemories`, `window.__viewerTreeData`. (CONFIRMED)
  - `window.currentTreeData` is written in both the viewer bridge and editor
    helpers/rename UI, and read across editor sidebar/rename/memory-actions and
    viewer handler/canvas entry. (CONFIRMED)
  - `window.currentTreeMemories` is written by both editor loaders and the viewer
    bridge, and read across editor and viewer surfaces. (CONFIRMED)
  - `window.__viewerTreeData` is written in exactly one place
    (`public-canvas-init.js:697`) and read only within the same file as an alias
    that falls back to `window.currentTreeData`. (CONFIRMED)
  - The changeability audit (PR #3426) records these globals as the editor/viewer
    shared-state bridge coupling. (CONFIRMED)
  - Whether every read site can move to an explicit store without behavior change
    is `UNKNOWN` from source alone.
- Reason retained:
  - During the editor/viewer refactor these globals acted as the shared mutable
    bridge so editor authoring state and the public viewer runtime could exchange
    the active tree/memories without a formal store.
  - Existing contract tests pin the globals (e.g. `public-canvas-bridge.js` must
    still set `currentTreeData`), so they are load-bearing for current tests.
- Known consumers:
  - Editor: `editor-tree-helpers.js`, `editor-sidebar-ui.js`, `editor-rename-ui.js`,
    `editor-memory-actions.js`, `editor-detail-sidebar-status-boundary.js`,
    `editor-data-loader.js`, `editor-data-loader-fallbacks.js`, `editor.js`.
  - Viewer: `public-canvas-bridge.js`, `public-viewer-canvas-entry.js`,
    `public-canvas-init.js`, `viewer-handler-factory.js`.
- Compatibility/change risk:
  - Medium-High: the alias couples editor authoring state with viewer runtime; a
    wrong migration order can desync the displayed tree.
  - `window.__viewerTreeData` is a thin alias of `window.currentTreeData` and is the
    lowest-risk to consolidate first.
- Removal preconditions:
  - An explicit editor↔viewer store exists and is wired into every current
    write/read site listed above.
  - Repository-wide search for `currentTreeData`/`currentTreeMemories`/
    `__viewerTreeData` returns zero production consumers outside the store boundary.
  - Editor save and public-viewer read fixed-slot contracts pass without the alias
    globals.
- Required verification before removal:
  - Editor workspace and public-viewer contract tests
    (`editor-tree-visibility-state-helper-contract`,
    `public-canvas-config-helper-contract`, `public-view-normalize-utils-route-contract`)
    pass with the globals removed.
  - Preview deployment smoke for `/editor.html` and the public viewer passes after
    the alias globals are removed.
  - Rollback is a single commit revert with no data/schema mutation.
- Rollback/recovery expectation:
  - Source revert only. Restore the global assignments; no DB or schema change.
- Existing issue/audit relationship:
  - References completed global namespace audit #3120 (do **not** reopen #3120;
    this registry records only the concrete editor↔viewer bridge state, not a
    repeat of the generic global-namespace re-audit).
  - References completed editor large-file track #1698 and completed public-viewer
    split track #1711 (both remain completed; do **not** reopen them). The gap
    recorded here is the residual shared-state alias that those completions left
    outside their acceptance scope.
  - Parent: #3425; audit foundation: PR #3426.
  - Concrete residual gap beyond #1698/#1711 acceptance →
    `NEW_NARROW_GAP_REQUIRED` scoped to editor↔viewer alias consolidation only.
- Follow-up decision: NEW_NARROW_GAP_REQUIRED
- Status: REVIEW_REQUIRED
- Last-reviewed main SHA: 81d01bb6b5085e0333d901d2e6c929f9b197349e

---

## LC-004 — Netlify legacy deployment artifacts

- Registry ID: LC-004
- Artifact / path: `netlify/` (currently `netlify/README.md`,
  `netlify/functions/README.md`, `netlify/sql/README.md`)
- Domain owner: DEPLOYMENT_LEGACY
- Classification: LEGACY_DEPLOYMENT_ARTIFACT
- Evidence level: CONFIRMED
- Evidence:
  - Directory listing confirms `netlify/` currently contains only README files
    (no live functions or SQL scripts). (CONFIRMED)
  - `netlify/README.md` explicitly states the folder is legacy/fallback/artifact
    only and is **not** the active production backend; the active path is
    `Cloudflare Pages (functions/) → Modal compute (modal_compute/)`. (CONFIRMED)
  - `netlify/functions/README.md` and `netlify/sql/README.md` repeat the
    not-active-production rule and forbid new backend policy, reactivation,
    deletion, or movement without CTO approval. (CONFIRMED)
  - AGENTS.md classifies Netlify as legacy artifact and removal candidate, not used
    for active production. (CONFIRMED)
  - Whether any historical CI/build still references `netlify/` is `UNKNOWN` from
    source alone.
- Reason retained:
  - Historical reference and fallback artifact; explicitly preserved (do not delete
    or move) under current ownership rules pending CTO-approved archive.
- Known consumers:
  - None confirmed as active production consumers. Documented rule states Netlify is
    not in the active production path.
- Compatibility/change risk:
  - Low for runtime (no live functions), but deleting/moving could break historical
    build references or archive expectations if a CI job still points at the folder.
- Removal preconditions:
  - Repository-wide search confirms zero active CI/build/deploy references to
    `netlify/`.
  - CTO approves archive/history relocation of the legacy README artifacts.
- Required verification before removal:
  - Grep of CI/workflow/deploy docs returns zero live `netlify/` references.
  - No production/staging path depends on the folder (confirmed from docs, not by
    querying production).
  - Rollback is a single commit revert (restore the folder) with no data/schema
    mutation.
- Rollback/recovery expectation:
  - Deployment config restore: re-add the `netlify/` folder from git history.
  - No DB or schema change.
- Existing issue/audit relationship:
  - Parent: #3425; audit foundation: PR #3426 (deployment revision gap section).
  - The active production path is owned by Cloudflare Pages + Modal, not Netlify;
    this is a legacy ownership boundary, not a Social or Scout concern.
  - No concrete removal gap beyond the documented legacy rule →
    `FOLLOW_UP_UNDECIDED` pending CTO archive decision.
- Follow-up decision: FOLLOW_UP_UNDECIDED
- Status: RETAIN
- Last-reviewed main SHA: 81d01bb6b5085e0333d901d2e6c929f9b197349e

---

## LC-005 — Vercel legacy configuration

- Registry ID: LC-005
- Artifact / path: `vercel.json`
- Domain owner: DEPLOYMENT_LEGACY
- Classification: LEGACY_DEPLOYMENT_ARTIFACT
- Evidence level: CONFIRMED
- Evidence:
  - File contents read directly at `vercel.json` (20 lines). (CONFIRMED)
  - The file carries an explicit `x-lovebud-runtime-note`:
    `Deprecated transitional fallback only. Active user-facing runtime is Cloudflare
    Pages ... This config is not active for production.` (CONFIRMED)
  - It defines `rewrites` mapping `/intro.html`, `/login.html`, `/search.html`,
    `/detail.html`, `/editor.html`, `/my-trees.html` to `pages/*.html`, which
    duplicates the Cloudflare Pages routing contract. (CONFIRMED)
  - AGENTS.md classifies `vercel.json` as a Vercel secondary entry / rewrite
    contract fragment, not a deletion candidate by default. (CONFIRMED)
  - Whether any live Vercel project still consumes this file is `UNKNOWN` from
    source alone and must not be filled by querying production.
- Reason retained:
  - Historical compatibility artifact preserving the `/<page>.html` rewrite contract
    for any secondary Vercel entry; explicitly marked deprecated and non-active.
- Known consumers:
  - No active production consumer confirmed in repository source. Treated as
    historical/secondary only.
- Compatibility/change risk:
  - Low for runtime, but removing it could break a secondary Vercel entry or
    doc/deploy references that still cite the rewrite contract.
- Removal preconditions:
  - Repository-wide search confirms zero active CI/deploy/docs references that
    depend on `vercel.json` rewrites for a live environment.
  - CTO approves removal of the deprecated transitional config.
- Required verification before removal:
  - Grep of CI/workflow/deploy docs returns zero live dependency on `vercel.json`.
  - No production/staging path depends on the file (confirmed from docs, not by
    querying production).
  - Rollback is a single commit revert (restore `vercel.json`) with no data/schema
    mutation.
- Rollback/recovery expectation:
  - Deployment config restore: re-add `vercel.json` from git history.
  - No DB or schema change.
- Existing issue/audit relationship:
  - Parent: #3425; audit foundation: PR #3426 (deployment revision gap section).
  - Cross-references acceptable as boundary only: Tree Social #3188, Moment Social
    #3075, Scout #1882 — none of these own `vercel.json`; #1882 is Scout, not a
    Social owner.
  - No concrete removal gap beyond the documented deprecated rule →
    `FOLLOW_UP_UNDECIDED` pending CTO decision.
- Follow-up decision: FOLLOW_UP_UNDECIDED
- Status: RETAIN
- Last-reviewed main SHA: 81d01bb6b5085e0333d901d2e6c929f9b197349e

---

## Cross-reference summary

| Registry ID | Classification | Domain owner | Status | Evidence |
| --- | --- | --- | --- | --- |
| LC-001 | TRANSITIONAL_ADAPTER | PUBLIC_READ_COMPATIBILITY | REMOVAL_BLOCKED | CONFIRMED |
| LC-002 | DUAL_NORMALIZATION_PATH | PUBLIC_READ_COMPATIBILITY | REMOVAL_BLOCKED | CONFIRMED |
| LC-003 | COMPATIBILITY_ALIAS | EDITOR_VIEWER_SHARED_STATE | REVIEW_REQUIRED | CONFIRMED |
| LC-004 | LEGACY_DEPLOYMENT_ARTIFACT | DEPLOYMENT_LEGACY | RETAIN | CONFIRMED |
| LC-005 | LEGACY_DEPLOYMENT_ARTIFACT | DEPLOYMENT_LEGACY | RETAIN | CONFIRMED |

Issue relationships (no issue is closed or reopened by this registry):

- #3425 — parent (OPEN, unchanged).
- #3426 — merged audit foundation (reference only).
- #3120 — completed global namespace audit (reference only; not reopened).
- #1698 — completed editor large-file track (reference only; not reopened).
- #1711 — completed public-viewer split track (reference only; not reopened).
- #3188 / #3075 / #1882 — boundary references only; #1882 is Scout, not a Social owner.

No new GitHub issues are created by this PR. Actual removal issues are deferred to
separate CTO judgment after this registry merges.
