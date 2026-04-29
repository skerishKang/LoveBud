# API Client Naming and Loading Audit

> **Status:** AUDIT_ONLY
> **Source:** Issue #72
> **Type:** Docs-only — no JavaScript, page markup, CSS, runtime, rename, or file-move changes

---

## 1. Purpose

This document records the API client naming and loading audit required by Issue #72 before any implementation work.

The current file name `js/postgres-client.js` is historically named after the backend data store, but the file currently acts as the browser-side API client. It should not be renamed immediately because page script loading order, global `window` contracts, Auth token behavior, public-tree normalization, and protected API flows all depend on the current loading contract.

This PR is the audit-only step. It does not rename, move, wrap, or change any runtime file.

---

## 2. Current API Client Role Summary

Current runtime path:

1. Browser page script calls the browser API client.
2. Browser API client calls same-origin `/api/*`.
3. Cloudflare Pages Functions handle the browser-facing API entry.
4. Cloudflare Pages Functions route active backend calls to Modal.
5. Modal uses Neon for persisted data.

`js/postgres-client.js` currently behaves as a browser API client despite its name:

- It declares itself as the browser-side API client for LoveBud.
- It keeps the browser deployment-agnostic by using same-origin `/api/*`.
- It composes tree, memory, community, and browse API groups.
- It exports the merged API surface as `window.apiClient`.
- It depends on `window.LoveTreeBaseApiFetch`, `window.LoveTreeAuthPolicy`, and `window.LoveTreePublicTreeAdapter` being loaded first.

Because the active browser contract is `/api/*`, not direct browser-to-database access, a future rename to `js/api/browser-client.js` may be directionally clearer. It should still be staged because the current file is directly loaded by multiple pages.

---

## 3. Current Script Loading Order

The table below summarizes the current loading relationship for the API helper files on primary pages.

| Page | `js/api/base-api-fetch.js` | `js/api/public-tree-adapter.js` | `js/postgres-client.js` | Notes |
|---|---|---|---|---|
| `pages/search.html` | Loaded before public-tree adapter | Loaded before postgres client | Loaded before Search modules and `js/search.js` | Search/Browse depends on public tree normalization and `window.apiClient` |
| `pages/detail.html` | Loaded before postgres client | Not part of the detail public-tree path unless explicitly loaded by page | Loaded by page | Detail data loading depends on the shared browser API client contract |
| `pages/editor.html` | Loaded before postgres client | Not a primary editor dependency | Loaded before editor helpers/data loader entry paths | Protected editor flows depend on auth-aware API fetch behavior |
| `pages/my-trees.html` | Loaded before postgres client | Not a primary My Trees dependency | Loaded by page | Protected tree list flow depends on auth-aware API fetch behavior |
| `pages/login.html` | Not part of the login page API client path | Not part of the login page API client path | Not loaded by login page | Login/Auth baseline must still be smoke-tested if API client loading is changed elsewhere |

Current Search-specific ordering from `pages/search.html` is especially important:

1. `js/api/auth-policy.js`
2. `js/api/base-api-fetch.js`
3. `js/api/public-tree-adapter.js`
4. `js/postgres-client.js`
5. Search helper/renderer/cache/UI/state files
6. `js/search.js`

This means `js/postgres-client.js` must continue to load after `base-api-fetch` and `public-tree-adapter` for Search/Browse surfaces.

---

## 4. Global / Window Contract

### `window.apiClient`

Defined by:

- `js/postgres-client.js`

Current role:

- merged browser API surface;
- tree API methods;
- memory API methods;
- community/browse API methods;
- shared entry point used by page-level runtime code.

Risk:

- Renaming the file without preserving `window.apiClient` would break page modules that expect the current global.
- Moving the file without updating every page script path would create load failures.
- Changing the implementation while renaming would mix naming cleanup with behavior risk.

### `window.LoveTreeBaseApiFetch`

Defined by:

- `js/api/base-api-fetch.js`

Current role:

- same-origin `/api/*` fetch wrapper;
- JSON response handling;
- auth header construction;
- retry behavior for protected endpoints when a confirmed auth session exists.

Risk:

- API client renaming must not change token, Auth, or retry behavior.
- Any future wrapper must preserve the existing base fetch contract exactly.

### `window.LoveTreePublicTreeAdapter`

Defined by:

- `js/api/public-tree-adapter.js`

Current role:

- public tree summary normalization;
- public memory hydration helpers;
- YouTube thumbnail canonicalization;
- Search/Browse data shape normalization used by the browser API client and Search runtime.

Risk:

- Search grouping or API client rename work must not move this file.
- YouTube URL utility extraction must preserve this namespace and adapter contract.

---

## 5. Rename Candidate Evaluation

### Candidate A: Keep `js/postgres-client.js`

Pros:

- Lowest risk.
- No page script changes.
- No caller migration.
- Preserves all existing global contracts.

Cons:

- Name is misleading because the browser no longer talks directly to Postgres.
- New contributors may infer direct database coupling from the filename.

Recommended use:

- Keep as-is until a staged migration plan exists.

### Candidate B: Add wrapper `js/api/browser-client.js`

Pros:

- Introduces clearer naming without immediately removing the old path.
- Allows gradual page migration.
- Can preserve `window.apiClient` while reducing future naming ambiguity.

Cons:

- Adds one more script unless bundled later.
- Creates temporary dual-path maintenance risk.
- Requires exact load-order documentation and smoke testing.

Recommended use:

- Possible first implementation PR, but only after this audit is reviewed.
- Must be no behavior change.

### Candidate C: Future rename to `js/api/browser-client.js`

Pros:

- Clean final naming.
- Aligns file location with API helper ownership.

Cons:

- Highest migration risk.
- Requires page script path changes across all consumers.
- Requires old filename deprecation/removal only after all callers migrate.

Recommended use:

- Final staged cleanup only after wrapper or migration path is complete.

---

## 6. Implementations Prohibited in This PR

This audit PR must not include:

- renaming `js/postgres-client.js`;
- moving `js/postgres-client.js`;
- creating `js/api/browser-client.js`;
- changing page script paths;
- changing API behavior;
- changing Auth token or retry behavior;
- changing Search/Browse data loading;
- combining API client naming with Search file grouping;
- modifying any JavaScript, page markup, CSS, runtime, API, Auth, Modal, or data-loading file.

---

## 7. Follow-up PR Split

Recommended staged split:

| PR | Scope | Notes |
|---|---|---|
| PR A | Audit docs only | This PR |
| PR B | Optional thin wrapper | Add `js/api/browser-client.js` only if approved; no behavior change |
| PR C | Page script path migration | One page/domain at a time; preserve `window.apiClient` |
| PR D | Old filename deprecation/removal | Only after all callers have migrated and smoke tests pass |

Do not combine these stages into one implementation PR.

---

## 8. Verification Requirements for Future Implementation

Any future implementation that touches the API client file name, location, wrapper, or script loading order must verify:

- Search/Browse data load;
- Detail page data load;
- My Trees protected API flow;
- Editor protected API flow;
- login/logout baseline;
- Cloudflare Preview or assigned fixed test slot behavior;
- no fatal console errors;
- no API/auth token regression;
- `window.apiClient` remains available until all callers have migrated.

---

## 9. Recommended Next Step

The safest next step is to keep `js/postgres-client.js` unchanged and, if renaming is still desired, open a separate plan for an optional thin wrapper that preserves current behavior and exports.

---

## Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/engineering/API_CLIENT_NAMING_LOADING_AUDIT.md`.
- [ ] No JS/page/CSS/runtime changes.
- [ ] No file moves or renames.
- [ ] No close keywords for Issue #72.

---

## Related

Refs #72
