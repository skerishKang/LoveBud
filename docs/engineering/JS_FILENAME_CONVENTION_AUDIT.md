# JS Filename Convention Audit

Refs #942
Refs #931
Refs #834
Refs #656

## Purpose

This audit defines the pre-rename safety model for JavaScript filename convention cleanup.

CSS filename convention cleanup can usually be verified through stylesheet import paths and visual review. JavaScript filename cleanup is higher risk because file paths participate in runtime loading, script ordering, test contracts, browser globals, Cloudflare static path resolution, and area-specific initialization behavior.

This document is audit-only. It does not rename JavaScript files and does not authorize a broad JavaScript rename PR.

## Current decision

Do not create one broad JS rename PR.

Use narrow implementation PRs after this audit, one runtime surface at a time. Each future rename PR should rename only a small group of files with one clear owner area, exact reference updates, static verification, and browser verification classification.

## Risk model

| Risk class | Meaning | Future PR requirement |
| --- | --- | --- |
| SAFE | File has local references only or clear path references with low runtime coupling. | May be renamed in a small docs-backed implementation PR after reference mapping. |
| MEDIUM_RISK | File participates in HTML script order, browser globals, route tests, or user-visible runtime loading. | Rename only in a one-area PR with `node --check`, `npm run verify`, `npm test`, and browser verification classification. |
| BLOCKED | File participates in unresolved duplicate source-of-truth, active open PR overlap, protected prototype paths, or unclear public/private runtime boundary. | Do not rename until blocker is resolved and the owner document is updated. |

## Reference surfaces that must be checked

Every future JS rename candidate must be mapped against:

```text
- HTML <script src> paths
- ES module import/export paths
- dynamic import or lazy-load paths
- tests/routes runtime module expectations
- docs/contracts mentioning the path
- browser global names such as window.LoveBud...
- event binding initialization order
- Cloudflare Pages static path resolution
- cache-key updates in pages/*.html when applicable
```

A rename is not complete when the file path changes. It is complete only when all known references and route contracts are updated and the affected runtime surface has a verification classification.

## Candidate area inventory

### 1. Search / Browse JS runtime modules

Suggested owner docs:

```text
docs/engineering/SEARCH_RUNTIME_CONTRACT.md
docs/engineering/SEARCH_ROOT_LEGACY_MOVE_PREFLIGHT_656.md
docs/engineering/SEARCH_DUPLICATE_RENDERER_SOURCE_OF_TRUTH_656.md
docs/engineering/LARGE_RUNTIME_DECOMPOSITION_STATUS_656.md
```

Observed risk pattern:

```text
- Search uses multiple js/search/* modules.
- Search has runtime module expectation tests.
- Search has recent path-contract history under #656 and #834.
- Search pages depend on script order and browser globals.
```

Classification:

```text
MEDIUM_RISK by default
```

Recommended first rename type:

```text
Search low-risk helper modules only, 1-3 files maximum, after current active Browse/Search PR overlap is cleared.
```

Do not combine Search JS rename with Browse UI behavior, selected hub behavior, card layout, copy changes, API changes, or route changes.

### 2. My Trees JS modules

Suggested owner docs:

```text
docs/engineering/CORE_RUNTIME_BOUNDARY_MAP.md
docs/ops/MEMBER_JOURNEY_QA_SUITE.md
```

Observed risk pattern:

```text
- My Trees is Auth and data dependent.
- My Trees is part of returning-user member journey verification.
- My Trees cards and actions can touch private/owner state.
```

Classification:

```text
MEDIUM_RISK
```

Recommended first rename type:

```text
Non-entry helper-only files after reference mapping.
```

Browser verification classification is required for any renamed file loaded by My Trees route HTML or involved in Auth-gated rendering.

### 3. Editor JS modules

Suggested owner docs:

```text
docs/engineering/EDITOR_ENTRYPOINT_ORCHESTRATION_BOUNDARY.md
docs/engineering/EDITOR_DETAIL_UI_RESPONSIBILITY_AUDIT.md
docs/engineering/AUTH_EDITOR_RUNTIME_INVENTORY_834.md
```

Observed risk pattern:

```text
- Editor is Auth/data/runtime sensitive.
- Editor has many stateful interactions and compatibility globals.
- Editor route depends on script order and selected tree/moment state.
```

Classification:

```text
MEDIUM_RISK to BLOCKED depending on file
```

Recommended first rename type:

```text
Audit-only until the target file is proven helper-only and outside active Editor decomposition work.
```

Do not rename Editor entrypoint or compatibility/global state files as part of filename convention cleanup without a separate runtime boundary plan.

### 4. Shared / Header / Auth modules

Suggested owner docs:

```text
docs/engineering/SCRIPT_LOAD_ORDER.md
docs/engineering/AUTH_BOOTSTRAP_COMPATIBILITY_BOUNDARY.md
docs/engineering/AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md
docs/engineering/SHARED_HEADER_CONFIG_HELPER_DECISION.md
```

Observed risk pattern:

```text
- Shared header and Auth files can affect every route.
- Script ordering and cached globals are part of the runtime contract.
- Auth state mistakes can expose private route content or break login routing.
```

Classification:

```text
BLOCKED for broad rename
MEDIUM_RISK for proven helper-only rename
```

Recommended first rename type:

```text
Do not start here. Rename only after Search/My Trees lower-risk slices prove the process.
```

### 5. Detail / Public Viewer modules

Suggested owner docs:

```text
docs/engineering/DETAIL_RUNTIME_BOUNDARY_PLAN.md
docs/product/READ_ONLY_LOVETREE_VIEWER_PLAN.md
```

Observed risk pattern:

```text
- Public/private data boundary matters.
- Read-only viewer work is still evolving.
- Route shell and public-safe payload boundary may introduce new viewer-specific modules.
```

Classification:

```text
MEDIUM_RISK for existing detail route modules
BLOCKED for viewer modules until the first viewer route shell stabilizes
```

Recommended first rename type:

```text
Defer until viewer route naming and module ownership are stable.
```

## Recommended PR split after audit

Use narrow PRs only:

```text
PR-JS-A: Search helper-only filename convention cleanup
PR-JS-B: My Trees helper-only filename convention cleanup
PR-JS-C: Editor helper-only filename convention cleanup, only after runtime boundary confirmation
PR-JS-D: Shared/Auth/Header cleanup, only after previous slices pass and script-order risk is re-reviewed
```

Each implementation PR must include:

```text
- exact changed file list
- old path -> new path mapping
- reference update table
- script/import/test update summary
- node --check for changed JS
- npm run verify
- npm test
- browser/fixed-slot verification requirement classification
- PR #7 untouched confirmation
- prototype/reference/demo/variant untouched confirmation
- secret/private exposure: NO
```

## Explicit non-goals

```text
- No JS file rename in this audit document.
- No CSS cleanup.
- No runtime behavior change.
- No Browse/Search UI change.
- No Auth/API/backend/DB change.
- No package or workflow change.
- No PR #7 change.
- No prototype/reference/demo/variant change.
```

## Initial recommendation

Start with Search only after active Browse/Search overlap is cleared. Even then, rename only low-risk helper modules with complete reference mapping. Do not rename entrypoints, route-loaded files, or files listed in runtime module expectation tests unless the PR explicitly updates tests and has a browser verification classification.

The safest immediate next action is not a rename PR. It is a concrete Search JS reference map that names candidate files and blocks unsafe targets before any path changes occur.
