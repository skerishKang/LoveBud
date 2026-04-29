# JS Script Loading and Namespace Contract

> **Status:** AUDIT_ONLY
> **Source:** Issue #72
> **Type:** Docs-only — no JavaScript, page markup, CSS, runtime, or file-move changes

---

## 1. Purpose

This document fixes the current JavaScript script loading order and browser `window` namespace contract before any JS architecture cleanup resumes.

Issue #72 is currently paused. This audit document exists so that future Search, Detail, Editor, or shared JS file movement can be reviewed against the current runtime contract before implementation.

This PR is intentionally docs-only:

- no file moves;
- no script path changes;
- no JavaScript behavior changes;
- no page markup changes;
- no runtime/API/Auth/data loading changes.

---

## 2. Current State Summary

The current `js/` tree mixes page-specific entry files with shared/domain files.

Examples:

- page/root files such as `js/search.js`, `js/search-card-renderer.js`, and `js/search-preview-renderer.js`;
- domain folders such as `js/api/`, `js/auth/`, `js/editor/`, `js/mytree/`, and `js/utils/`;
- shared root files such as `js/postgres-client.js`, `js/auth.js`, `js/i18n.js`, `js/shared-header.js`, and `js/page-shell.js`.

Issue #72 remains paused because earlier file-move work created operational risk during parallel execution. Before implementation resumes, the project needs:

- a clean clone or clean worktree per task;
- one implementation PR at a time;
- no shared local working directories across models;
- Search, Detail, and Editor refactors kept separate;
- Cloudflare Preview or assigned fixed test slot validation before merge.

---

## 3. Search Page Loading Contract

`pages/search.html` currently loads Search and shared scripts in this order:

1. `js/page-shell.js`
2. `js/cache-utils.js`
3. `js/api/auth-policy.js`
4. `js/api/base-api-fetch.js`
5. `js/api/public-tree-adapter.js`
6. `js/postgres-client.js`
7. `js/search-title-helper.js`
8. `js/search-data-adapter.js`
9. `js/search-shared-utils.js`
10. `js/search-card-renderer.js`
11. `js/search-preview-renderer.js`
12. `js/search/search-preview-cache.js`
13. `js/search/search-ui.js`
14. `js/search/search-url-state.js`
15. `js/search.js`
16. Firebase SDK scripts
17. `js/firebase-config.js`
18. i18n bundle scripts
19. `js/i18n.js`
20. `js/shared-header.js`
21. `js/auth/*` helper modules
22. `js/auth.js`
23. inline `LoveTreePageShell.initSharedPage(...)`

Important current contract:

- `js/api/public-tree-adapter.js` is loaded before `js/postgres-client.js` and before the Search entry script.
- `js/postgres-client.js` remains a shared/root browser API client file and is not part of Search grouping.
- `js/search-card-renderer.js` and `js/search-preview-renderer.js` are root Search-related files that expose renderer namespaces.
- `js/search/search-ui.js`, `js/search/search-url-state.js`, and `js/search/search-preview-cache.js` are already under `js/search/` and should not be mixed with root-file movement without a focused plan.
- `js/search.js` remains the Search page entry/orchestrator and currently depends on earlier loaded renderer, adapter, UI, URL-state, shared utility, and API client contracts.

### Search grouping rule

A future Search grouping PR may move root Search files only after a clean implementation slot is assigned.

Do not move these files in Search grouping:

- `js/api/public-tree-adapter.js`
- `js/postgres-client.js`

---

## 4. Known Global / Window Contracts

### `window.apiClient`

Defined by:

- `js/postgres-client.js`

Consumed by:

- Search page runtime through the Search entry/orchestrator path;
- other runtime pages that rely on the browser API client;
- Auth/session preload flows and page modules where `window.apiClient` is used as the browser API gateway.

Contract notes:

- Treat `window.apiClient` as a shared browser runtime contract.
- Do not rename `js/postgres-client.js` or `window.apiClient` inside a Search grouping PR.
- API client naming requires a separate audit before implementation.

### `window.LoveTreePublicTreeAdapter`

Defined by:

- `js/api/public-tree-adapter.js`

Consumed by:

- `js/postgres-client.js` and Search data/loading code paths that normalize public tree and memory data for Browse/Search surfaces.

Contract notes:

- Preserve `LoveTreePublicTreeAdapter` exports during any YouTube URL utility split.
- Do not replace this with a broad media abstraction during Search grouping.
- Do not move `js/api/public-tree-adapter.js` in a Search grouping PR.

### `window.LoveBudSearchCardRenderer`

Defined by:

- `js/search-card-renderer.js`

Consumed by:

- `js/search.js` and related Search rendering flows.

Contract notes:

- Future movement to `js/search/card-renderer.js` must preserve the same window namespace first.
- Any path move must be paired with `pages/search.html` script path updates and Cloudflare Preview or fixed slot smoke.

### `window.LoveBudSearchPreviewRenderer`

Defined by:

- `js/search-preview-renderer.js`

Consumed by:

- `js/search.js` and Search preview controller/UI flows.

Contract notes:

- Future movement to `js/search/preview-renderer.js` must preserve the same window namespace first.
- Desktop and mobile preview behavior must be smoke-tested after any move.

### Auth / i18n / page shell globals

Known global entry points include:

- `window.LoveTreePageShell` from `js/page-shell.js`;
- shared header functions from `js/shared-header.js`;
- i18n globals from `js/i18n.js` and the loaded `js/i18n/*` bundles;
- Auth globals and callback/bootstrap entry points from `js/auth.js` and `js/auth/*` helper modules.

Contract notes:

- Search page calls `LoveTreePageShell.initSharedPage(...)` after shared header, i18n, and Auth scripts load.
- Auth/Login runtime cleanup must not be mixed with Search file grouping.
- i18n bundle load order must not be changed by page-specific JS grouping.

---

## 5. Refactor Guardrails

Future JS architecture cleanup must follow these guardrails:

- PR #7 prototype/reference/demo/variant paths remain untouched.
- Search, Detail, and Editor refactors must be separated.
- File-move refactors must happen one implementation PR at a time.
- Search grouping must be behavior unchanged.
- Search grouping must not move `js/api/public-tree-adapter.js` or `js/postgres-client.js`.
- API client naming must not proceed before a separate audit.
- YouTube URL utility split must preserve the current thumbnail URL and public-tree adapter contracts.
- Cloudflare Preview or assigned fixed test slot validation is required before merge for Search/Browse runtime changes.
- Do not use `Fixes`, `Closes`, or `Resolves` for Issue #72 unless CTO explicitly approves.

---

## 6. Follow-up Candidates

Recommended follow-ups remain staged and implementation-free until separately approved:

1. Search file grouping — later implementation only.
2. API client naming audit — separate audit required.
3. YouTube URL utility split — separate audit required.
4. Search URL state / controls split — only after Search grouping.
5. Detail / My Trees / Home / Settings grouping — separate audit before any implementation.
6. Editor JS architecture audit — do not mix with Editor UI polish.

---

## 7. Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/engineering/JS_SCRIPT_LOADING_NAMESPACE_CONTRACT.md`.
- [ ] No JS/page/CSS/runtime changes.
- [ ] Issue #72 remains open.
- [ ] No close keywords for Issue #72.

---

## Related

Refs #72
