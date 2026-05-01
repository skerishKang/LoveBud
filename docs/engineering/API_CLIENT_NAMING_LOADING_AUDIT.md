# API Client Naming and Loading Audit

> **Status:** AUDIT_ONLY
> **Source:** Issue #409, Issue #72
> **Type:** Docs-only — no JavaScript, page markup, CSS, runtime, rename, wrapper, or file-move changes

---

## 1. Purpose

Issue #409 tracks the browser API client naming and loading contract audit after the Issue #72 JS Architecture Cleanup Tracker closure disposition.

This document records whether the browser API client contract should remain as-is or move toward a clearer owner path such as `js/api/browser-client.js`.

The current file name `js/postgres-client.js` is historically named after the backend data store, but the file currently acts as the browser-side API client. It should not be renamed immediately because page script loading order, global `window` contracts, Auth token behavior, public-tree normalization, protected API flows, and page call sites all depend on the current loading contract.

This document is the audit-only step. It does not rename, move, wrap, or change any runtime file.

---

## 2. Current API client role summary

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

## 3. Current reference and call-site inventory

Static search for `window.apiClient` and related client usage shows that the current contract is consumed across Search/Browse, Detail, My Trees, Editor, Auth-adjacent cache cleanup, docs, and tests. The list below is a contract inventory, not implementation approval.

| Area | Representative file/path | Contract use | Risk if renamed or moved without compatibility |
| --- | --- | --- | --- |
| Client definition | `js/postgres-client.js` | Defines and exposes the merged browser API surface as `window.apiClient`. | Full browser API contract break if the global or script path disappears. |
| Search data loading | `js/search/data.js` | Reads `window.apiClient` for Search/Browse data access. | Search/Browse data load failure. |
| Search preview/copy | `js/search/preview-controller.js`, `js/search-copy-ui.js` | Uses API client access for preview/copy/fork-adjacent flows. | Public tree preview/copy behavior can fail or partially regress. |
| Detail page | `js/detail/detail-loader.js` | Reads API client contract for detail data loading. | Detail page data load failure. |
| My Trees data/actions | `js/my-trees/my-trees-data.js`, `js/my-trees/my-trees-actions.js` | Uses protected API client methods for user tree list and actions. | Auth/API/data-sensitive My Trees regression. |
| Editor memory/actions | `js/editor/editor-memory-actions.js`, `js/editor/editor-memory-form.js`, `js/editor/editor-rename-ui.js`, `js/editor.js` | Uses protected API client methods for Editor save/update/rename/memory flows. | High-risk Editor runtime regression. |
| Auth cleanup adjacency | `js/auth.js`, `js/auth/auth-firebase.js` | Reads optional `window.apiClient` for cache/reset or post-login/preload-adjacent behavior. | Auth/logout/login-adjacent side effects if unavailable. |
| Existing docs/contracts | `docs/engineering/API_CLIENT_NAMING_LOADING_AUDIT.md`, `docs/engineering/JS_SCRIPT_LOADING_NAMESPACE_CONTRACT.md`, `docs/engineering/SHARED_ROOT_JS_OWNERSHIP_CONTRACTS.md` | Document the loading/global contract. | Documentation drift if implementation moves ahead without contract update. |

Boundary rule: any change to `js/postgres-client.js`, `window.apiClient`, or the script loading order must be treated as a runtime-sensitive API contract change, not as a simple filename cleanup.

---

## 4. Current script loading order

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

## 5. Global / window contract

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

## 6. Flat API method merge and collision risk

`js/postgres-client.js` exposes a merged browser API surface. That shape is convenient for page call sites, but it creates collision risk if future API groups add methods with overlapping names.

Current risk areas:

- tree methods, memory methods, community methods, browse methods, cache helpers, and compatibility helpers share a single outward-facing object;
- page modules usually call `window.apiClient.<method>()` directly;
- future grouping or wrapper work could accidentally shadow a method name or change call-site expectations;
- a future compatibility namespace must not silently change the flat method contract.

Required guardrail for future implementation:

- document any new method name before adding it to the flat surface;
- avoid renaming existing public methods during a wrapper-only PR;
- keep `window.apiClient` available until all page call sites have migrated;
- if a namespaced API is introduced later, provide explicit compatibility aliases and a call-site migration map first.

---

## 7. Production global exposure risk

The public `window.apiClient` global is a browser convenience contract, not an authorization boundary. Server authorization must remain enforced by same-origin `/api/*`, Cloudflare Functions, Modal, Firebase token verification, and backend policy checks.

Risk framing:

- exposing method names in the browser is expected for static multipage JS;
- exposing private tokens, cookies, session values, credential material, raw private payloads, or service-account material is prohibited;
- debug internals must not be broadly exposed in production;
- any wrapper or namespace should reduce naming ambiguity without increasing production debug surface area.

Allowed in documentation/reports:

- method categories;
- global names;
- file paths;
- PRESENT / ABSENT / UNKNOWN status language.

Prohibited in documentation/reports:

- token values;
- cookie/session values;
- API keys;
- Firebase service-account material;
- raw private tree or memory payloads;
- browser storage dumps.

---

## 8. Naming options and risk comparison

### Candidate A: Keep `js/postgres-client.js`

Pros:

- Lowest risk.
- No page script changes.
- No caller migration.
- Preserves all existing global contracts.

Cons:

- Name is misleading because the browser no longer talks directly to Postgres.
- New contributors may infer direct database coupling from the filename.

Recommendation:

- Keep as-is for now.
- This is the safest closure recommendation for Issue #409.

### Candidate B: Add wrapper `js/api/browser-client.js`

Pros:

- Introduces clearer naming without immediately removing the old path.
- Allows gradual page migration.
- Can preserve `window.apiClient` while reducing future naming ambiguity.

Cons:

- Adds one more script unless bundled later.
- Creates temporary dual-path maintenance risk.
- Requires exact load-order documentation and smoke testing.

Recommendation:

- Possible later narrow implementation PR only if naming ambiguity becomes an active maintenance problem.
- Must be no behavior change.

### Candidate C: Future rename to `js/api/browser-client.js`

Pros:

- Clean final naming.
- Aligns file location with API helper ownership.

Cons:

- Highest migration risk.
- Requires page script path changes across all consumers.
- Requires old filename deprecation/removal only after all callers migrate.

Recommendation:

- Final staged cleanup only after wrapper or migration path is complete.
- Not justified as the immediate next step.

---

## 9. Closure recommendation for Issue #409

Current recommendation: keep `js/postgres-client.js` and `window.apiClient` as-is.

Do not prepare an implementation PR now. A future narrow implementation PR is only justified if:

- `js/postgres-client.js` naming causes repeated contributor confusion;
- a wrapper can be introduced without changing behavior;
- all affected page call sites and script loading order are listed;
- fixed-slot/runtime verification is available for Auth/API/data-sensitive pages.

If implemented later, the preferred first implementation would be a thin compatibility wrapper such as `js/api/browser-client.js` that preserves `window.apiClient`. It must not rename the old file, remove the old path, alter API method behavior, or change page script order in the same PR.

---

## 10. Implementations prohibited in this audit

This audit must not include:

- renaming `js/postgres-client.js`;
- moving `js/postgres-client.js`;
- creating `js/api/browser-client.js`;
- changing page script paths;
- changing API behavior;
- changing Auth token or retry behavior;
- changing Search/Browse data loading;
- changing Search/Auth/Editor/My Trees behavior;
- combining API client naming with Search grouping, public tree adapter work, or Auth cleanup;
- modifying any JavaScript, page markup, CSS, runtime, API, Auth, Modal, or data-loading file;
- touching PR #7/prototype/reference/demo/variant paths.

---

## 11. Follow-up PR split if implementation is later approved

Recommended staged split:

| PR | Scope | Notes |
|---|---|---|
| PR A | Audit docs only | This document |
| PR B | Optional thin wrapper | Add `js/api/browser-client.js` only if approved; no behavior change |
| PR C | Page script path migration | One page/domain at a time; preserve `window.apiClient` |
| PR D | Old filename deprecation/removal | Only after all callers have migrated and smoke tests pass |

Do not combine these stages into one implementation PR.

---

## 12. Verification requirements for future implementation

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

Runtime-sensitive pages such as My Trees, Editor, and authenticated API flows require fixed test slot validation for final PASS.

---

## Verification checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/engineering/API_CLIENT_NAMING_LOADING_AUDIT.md`.
- [ ] No JS/page/CSS/runtime changes.
- [ ] No file moves or renames.
- [ ] No close keywords for Issue #409.
- [ ] No secret/token/session/cookie/private key/private payload values included.

---

## Related

Refs #409
Refs #72
