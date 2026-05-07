# Search Root Legacy Move Preflight

- Work type: Local Docs/Audit
- Parent tracker: #656
- Audit source: #834 / PR #886
- Base main SHA: 664e4d0167cadc5d8d2343ebaedbd913d86f0204
- Status: docs-only preflight

## Purpose

This document audits whether the remaining root `js/search-*.js` files can be moved into `js/search/` in a future implementation PR.

No code is moved here. No HTML, runtime JavaScript, CSS, package, workflow, backend, API, database, or deployment behavior is changed here.

## Source Inputs

| Source | Status | Notes |
|---|---|---|
| #656 | OPEN | Parent large-file/refactor tracker. |
| #834 | REFERENCED | Naming consistency audit source. |
| PR #886 | MERGED | Added `JS_CSS_ENTRYPOINT_PREFIX_AUDIT_834.md`, which classifies the six root Search files as move candidates requiring script-order review. |
| `docs/engineering/JS_CSS_ENTRYPOINT_PREFIX_AUDIT_834.md` | PRESENT | Lists the six root legacy Search files as `MOVE_CANDIDATE + NEEDS_SCRIPT_ORDER_REVIEW`. |
| `pages/search.html` | READ_ONLY_AUDITED | Current Search script order reviewed without edits. |
| `js/i18n/i18n-search.js` | READ_ONLY_AUDITED | Dynamic `search-copy-ui.js` loader reviewed without edits. |
| Search route/contract tests | READ_ONLY_AUDITED | Current path assumptions reviewed without edits. |

## Non-action Statement

This preflight does not authorize a single broad move. Any future implementation must update script references, affected tests, and browser verification evidence in the same PR that performs the move.

Forbidden in this audit:

- file moves;
- file renames;
- HTML script changes;
- runtime behavior changes;
- Search/Browse UI changes;
- API, backend, database, package, or workflow changes;
- prototype/reference/demo/variant changes;
- private values, credentials, raw payloads, or private identifiers.

## Current Candidate Inventory

| Candidate | Current runtime reference | Target path availability | Collision risk | Test/doc reference risk | Preflight disposition |
|---|---|---|---|---|---|
| `js/search-title-helper.js` | Directly loaded by `pages/search.html` before Search renderers and Search entrypoint. | `js/search/search-title-helper.js` is available. | LOW | Docs mention root path. Runtime tests do not directly pin this root path. | MOVE_READY_WITH_HTML_UPDATE |
| `js/search-data-adapter.js` | Directly loaded by `pages/search.html` before Search entrypoint. | `js/search/search-data-adapter.js` is available. | LOW | `tests/contracts/public-tree-fallback-boundary.test.js` reads the current root path. | MOVE_READY_WITH_HTML_AND_TEST_UPDATE |
| `js/search-shared-utils.js` | Directly loaded by `pages/search.html` before active Search renderers. | `js/search/search-shared-utils.js` is available. | LOW | Docs mention root path. Contract tests do not currently pin the root path. | MOVE_READY_WITH_HTML_UPDATE |
| `js/search-copy-ui.js` | Dynamically injected by `js/i18n/i18n-search.js`; not directly loaded by `pages/search.html`. | `js/search/search-copy-ui.js` is available. | LOW | Dynamic loader path must change. Add/update a contract test for the injected path. | MOVE_READY_WITH_DYNAMIC_LOADER_AND_TEST_UPDATE |
| `js/search-card-renderer.js` | Not directly loaded by current `pages/search.html`; active page loads `js/search/search-card-renderer.js`. | `js/search/search-card-renderer.js` already exists. | HIGH | Root file and folder file both expose `window.LoveBudSearchCardRenderer`; root appears legacy and cannot move to the same target path as-is. | BLOCKED_DUPLICATE_TARGET_PATH |
| `js/search-preview-renderer.js` | Not directly loaded by current `pages/search.html`; active page loads `js/search/search-preview-renderer.js`. | `js/search/search-preview-renderer.js` already exists. | HIGH | `tests/routes/detail-alias-consistency.test.js` reads the root path while active Search runtime uses the folder path. Root appears legacy and cannot move to the same target path as-is. | BLOCKED_DUPLICATE_TARGET_PATH |

## Current Search Script Order

Current `pages/search.html` loads Search-related scripts in this relevant order:

1. `js/search-title-helper.js`
2. `js/search-data-adapter.js`
3. `js/search-shared-utils.js`
4. `js/search/search-card-renderer.js`
5. `js/search/search-preview-media-helper.js`
6. `js/search/search-preview-copy-helper.js`
7. `js/search/search-preview-action-helper.js`
8. `js/search/search-preview-renderer-builders.js`
9. `js/search/search-preview-renderer.js`
10. `js/search/search-preview-cache.js`
11. `js/search/search-ui.js`
12. `js/search/search-url-state.js`
13. `js/search/search-controls.js`
14. `js/search/search-data.js`
15. `js/search/search-preview-controller.js`
16. `js/search/index.js`

The first three root helpers are runtime dependencies and must stay before the active folder renderers and `js/search/index.js` after any future move.

## Dynamic Loader Finding

`js/i18n/i18n-search.js` appends `../js/search-copy-ui.js?v=20260426-1` on Search pages.

Future move requirement:

- update the dynamic loader to `../js/search/search-copy-ui.js`;
- keep the `data-lovebud-search-copy-ui` guard;
- add or update a contract test so the dynamic injected path does not drift.

## Duplicate Target Finding

Two root files cannot be moved into `js/search/` as simple path moves because active same-name files already exist:

- `js/search-card-renderer.js` conflicts with `js/search/search-card-renderer.js`;
- `js/search-preview-renderer.js` conflicts with `js/search/search-preview-renderer.js`.

Both root files expose the same global namespaces as their active folder counterparts. A future implementation must first decide whether each root file is stale, still used by an untested path, or should be removed after replacement of all references.

Preflight disposition:

- do not move these two files as-is;
- compare behavior against the active folder files before any deletion or archival decision;
- update tests that still read the root path only after the active runtime source of truth is confirmed.

## Recommended Future PR Split

| Future PR | Scope | Required local validation | Required browser verification |
|---|---|---|---|
| PR-C1 | Move `search-title-helper`, `search-data-adapter`, and `search-shared-utils` into `js/search/`; update `pages/search.html` and affected tests. | `git diff --check`, `node --check` changed JS files, `npm test`, `npm run verify`. | Search/Browse fixed-slot or Cloudflare preview with deployed SHA match. |
| PR-C2 | Move `search-copy-ui` into `js/search/`; update dynamic loader and add path contract coverage. | `git diff --check`, `node --check` changed JS files, `npm test`, `npm run verify`. | Search/Browse copy UI smoke with credential-safe reporting if auth is involved. |
| PR-C3 | Resolve duplicate root renderer files after source-of-truth comparison. | Add contract coverage proving active renderer path and detail alias expectations. | Search/Browse desktop and mobile smoke, preview open, card render, detail CTA route. |

## Required Browser Verification For Any Future Runtime Move

- fixed slot or Cloudflare preview deployed SHA match required;
- Search page loads without fatal console errors;
- Browse cards render;
- selected preview opens;
- preview CTA still routes to `detail.html`;
- share/copy controls remain wired;
- mobile 375 render has no horizontal overflow;
- no private values, credentials, raw payloads, or private identifiers are exposed.

## Final Preflight Decision

| Decision field | Value |
|---|---|
| Can all six files be moved in one PR? | NO |
| Non-colliding direct-load files ready for future move? | YES_WITH_HTML_AND_TEST_UPDATES |
| Dynamic loader file ready for future move? | YES_WITH_DYNAMIC_LOADER_AND_TEST_UPDATE |
| Duplicate renderer files ready for direct move? | NO |
| Recommended implementation shape | SPLIT_PR_SEQUENCE |
| Runtime changes made by this audit | NO |
| Browser verification performed by this audit | NOT_RUN |

Refs #656
Refs #834
