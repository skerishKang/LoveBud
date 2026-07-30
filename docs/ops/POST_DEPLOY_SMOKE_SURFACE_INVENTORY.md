# Post-Deploy Smoke Surface Inventory

> **Status:** source-only audit — no Production requests, deployment mutation, secret inspection, database access, provider calls, or workflow changes are authorized.
> **Classification labels:** `SOURCE_CONFIRMED`, `RUNTIME_REQUIRES_AUTH`, `RUNTIME_PUBLIC`, `RUNTIME_UNRESOLVED`, `NOT_AUTHORIZED`
> **Parent:** #3673 — Keep OPEN
> **Completed groundwork:** #3734 / PR #3738 (smoke contract), #3740 / PR #3744 (SHA exposure decision), #3725 / PR #3726 (runtime health taxonomy)
> **Related:** #3699 — Keep OPEN; #3425 — Keep OPEN; #1882 — Keep OPEN
> **Base SHA:** `9af1f6116566e9b616a89f108bc17e002bcf8485`

This document inventories every LoveBud post-deploy smoke surface and its evidence boundary. It is a source-only audit. No runtime, network, or Production observation was performed.

---

## 1. Classification Labels

| Label | Meaning |
|---|---|
| `SOURCE_CONFIRMED` | Source path exists. Expected shape (file existence, HTTP status, content-type) is verifiable from repository source. No runtime observation needed. |
| `RUNTIME_PUBLIC` | Surface requires a deployed URL and network call to verify. Source confirms route exists. Response is public (no auth). Bounded Production observation is permitted after a relevant merge per `MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`. |
| `RUNTIME_REQUIRES_AUTH` | Surface requires a deployed URL, network call, and valid auth session to verify. Source confirms route exists but response is auth-guarded. Production observation requires operator credentials. |
| `RUNTIME_UNRESOLVED` | Surface exists in source but the runtime contract (expected status, evidence boundary, or fixture requirement) is not fully determined from source evidence alone. |
| `NOT_AUTHORIZED` | Surface, evidence type, or operation is explicitly forbidden by governance boundaries. |

---

## 2. Route Surfaces

### 2.1 Home

| Field | Value |
|---|---|
| Route/path | `/` (index) |
| Public vs authenticated | Public |
| Source owner files | `index.html`, `js/index.js`, `js/index-inline-init.js`, `css/index.css`, `css/index-visual.css`, `css/global.css` |
| Classification | `RUNTIME_PUBLIC` |
| Source-known expected state | HTTP 200 with `<body>` present. Home loads client-side JS from `js/index.js`. CSP per `_headers` global block. |
| Safe evidence | HTTP status, `<body>` DOM presence, latency bucket, `content-type` header, route operation code `ROUTE_HOME` |
| Prohibited evidence | Response HTML content, query parameters, cookies, user state, private identifiers, YouTube media URL patterns |
| Bounded Production observation | Yes — per merge-first workflow. `scripts/cloudflare-supplied-url-smoke.cjs` already validates `/` for HTTP 200, `<body>`, zero fatal console errors, no horizontal overflow (desktop + mobile). |
| Unresolved dependency | Supplied-URL smoke not in CI (`tests/ci-test-group-registry.json`: `REMOTE_OR_PROVIDER_MANUAL`, `MANUAL` execution state). CDN cache behavior for `index.html` is not covered by `_headers` no-store (the global `/*` block only sets CSP; the `/pages/*` no-store does not apply to `/`). |
| Stop condition | `SOURCE_CONFIRMED` (HTML serving verified at source). `RUNTIME_PUBLIC` Production observation requires deployed URL. No auth dependency. |

### 2.2 Browse

| Field | Value |
|---|---|
| Route/path | `/search` → `pages/search.html` → `/pages/search` |
| Public vs authenticated | Public (page loads without auth; API fetch client-side) |
| Source owner files | `pages/search.html`, `js/search/index.js`, `js/search.js`, `css/search.css`, `css/global.css`, `_redirects` (`.html` → extensionless) |
| Classification | `RUNTIME_PUBLIC` |
| Source-known expected state | HTTP 200 with `<body>` present. API-dependent content fetches after page load. |
| Safe evidence | HTTP status, route template `ROUTE_BROWSE`, `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, query parameters, user state, API response body, `treeId` or `memoryId` values, search terms |
| Bounded Production observation | Yes — per merge-first workflow. `scripts/cloudflare-supplied-url-smoke.cjs` validates `/pages/search.html` for HTTP 200, `<body>`, zero fatal console errors (desktop + mobile). Extensionless `/search` route is not covered by current script. |
| Unresolved dependency | API health deferred to browser runtime. Extensionless canonical path `/search` not covered by supplied-URL smoke. Current script uses `/pages/search.html` (non-canonical). Supplied-URL smoke not in CI. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_PUBLIC` observation requires deployed URL. |

### 2.3 My Trees

| Field | Value |
|---|---|
| Route/path | `/my-trees` → `pages/my-trees.html` → `/pages/my-trees` |
| Public vs authenticated | Auth-guarded (page loads HTTP 200; content population requires auth) |
| Source owner files | `pages/my-trees.html`, `js/my-trees.js`, `js/my-trees/`, `css/my-trees.css`, `css/global.css`, `_redirects` |
| Classification | `RUNTIME_REQUIRES_AUTH` |
| Source-known expected state | HTTP 200 with `<body>` present. Page HTML is served to unauthenticated requests; JS runtime then detects auth state and populates content or shows empty/login-prompt state. |
| Safe evidence | HTTP status, route template `ROUTE_MY_TREES`, `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, user state, auth tokens, `treeId` values, Firebase UID, owner email, tree data |
| Bounded Production observation | Yes — but requires operator auth session. Page load (HTTP 200) is verifiable without auth. Content population smoke requires authenticated session. |
| Unresolved dependency | Auth guard is expected per `RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §4.1 (`ROUTE_MY_TREES`). Authenticated content population smoke is `NOT_AUTHORIZED` by this document. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_REQUIRES_AUTH` — page-load smoke is public; content smoke requires operator auth. |

### 2.4 Editor

| Field | Value |
|---|---|
| Route/path | `/editor` → `pages/editor.html` → `/pages/editor` |
| Public vs authenticated | Auth-guarded |
| Source owner files | `pages/editor.html`, `js/editor.js`, `js/editor/`, `css/editor.css`, `_redirects` |
| Classification | `RUNTIME_REQUIRES_AUTH` |
| Source-known expected state | HTTP 200 with `<body>` present. Full functionality requires auth and a selected tree. |
| Safe evidence | HTTP status, route template `ROUTE_EDITOR`, `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, user state, auth tokens, tree/memory data, editor content |
| Bounded Production observation | Yes — HTTP 200 check without auth. Tree-selected editor state smoke requires auth. |
| Unresolved dependency | Tree-selection smoke (`ROUTE_EDITOR` with a known tree) is `NOT_AUTHORIZED` without separately approved fixture. Auth guard is expected. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_REQUIRES_AUTH` — page-load only. |

### 2.5 Settings

| Field | Value |
|---|---|
| Route/path | `/settings` → `pages/settings.html` → `/pages/settings` |
| Public vs authenticated | Auth-guarded |
| Source owner files | `pages/settings.html`, `js/settings.js`, `js/settings-bootstrap.js`, `css/settings.css`, `_redirects` |
| Classification | `RUNTIME_REQUIRES_AUTH` |
| Source-known expected state | HTTP 200 with `<body>` present. Full functionality requires auth. |
| Safe evidence | HTTP status, route template `ROUTE_SETTINGS`, `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, user state, auth tokens, display name, email, password fields |
| Bounded Production observation | Yes — HTTP 200 check without auth. Settings content smoke requires auth. |
| Unresolved dependency | Auth guard is expected. Content verification requires operator auth session. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_REQUIRES_AUTH` — page-load only. |

### 2.6 Public Viewer / Detail

| Field | Value |
|---|---|
| Route/path | `/tree` → `pages/tree.html` → `/pages/tree`; `/detail` → `pages/detail.html` → `/pages/detail` |
| Public vs authenticated | Public |
| Source owner files | `pages/tree.html`, `pages/detail.html`, `js/viewer/`, `js/detail/`, `css/viewer/`, `css/detail/`, `_redirects` |
| Classification | `RUNTIME_PUBLIC` |
| Source-known expected state | HTTP 200 with `<body>` present. Content population requires a valid `treeId` (viewer) or `memoryId` (detail) in query string, fetched client-side. |
| Safe evidence | HTTP status, route template (`ROUTE_PUBLIC_VIEWER`, `ROUTE_DETAIL`), `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, query parameters (`treeId`, `memoryId`), user state, tree/memory data, owner identity |
| Bounded Production observation | Yes — HTTP 200 check. Content verification requires a known public tree ID (separate fixture gate per `RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §4.3.2). |
| Unresolved dependency | `API_PUBLIC_TREE_READ` smoke requires synthetic public fixture. Memory detail smoke (`API_COMMUNITY_MEMORIES_HYDRATE`) is identifier-bearing. Neither fixture exists. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_PUBLIC` — page-only. Content smoke is `BLOCKED_BY_AUTHORITY` without approved fixture. |

### 2.7 Login / Intro

| Field | Value |
|---|---|
| Route/path | `/login` → `pages/login.html` → `/pages/login`; `/intro` → `pages/intro.html` → `/pages/intro` |
| Public vs authenticated | Public |
| Source owner files | `pages/login.html`, `pages/intro.html`, `js/login/`, `js/intro/`, `js/login-page.js`, `css/login.css`, `css/intro.css`, `_redirects` |
| Classification | `RUNTIME_PUBLIC` |
| Source-known expected state | HTTP 200 with `<body>` present. |
| Safe evidence | HTTP status, route template (`ROUTE_LOGIN`, `ROUTE_INTRO`), `<body>` presence, latency bucket |
| Prohibited evidence | Response HTML, OAuth parameters, login state, auth tokens |
| Bounded Production observation | Yes — per merge-first workflow. Intro covered by existing supplied-URL smoke (as `/pages/intro.html`). Login not covered. |
| Unresolved dependency | `/intro` path in supplied-URL smoke uses non-canonical `/pages/intro.html`. Login route has no supplied-URL smoke. |
| Stop condition | `SOURCE_CONFIRMED`. `RUNTIME_PUBLIC` — no auth dependency. |

---

## 3. Critical Static Assets

| Asset | Source path | Expected content-type | Classification | Safe evidence | Prohibited evidence | Production observation | Stop condition |
|---|---|---|---|---|---|---|---|
| Global stylesheet | `/css/global.css` | `text/css` | `SOURCE_CONFIRMED` | HTTP status, asset path template, latency bucket | Asset content, CDN cache internals | Yes — HTTP 200 check | File exists in source |
| Home entry JS | `/js/index.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content, cache-busting hash value | Yes — HTTP 200 check | File exists in source |
| Browse entry JS | `/js/search/index.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |
| Editor entry JS | `/js/editor.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |
| Viewer entry JS | `/js/viewer/tree-viewer.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |
| My Trees entry JS | `/js/my-trees.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |
| Settings entry JS | `/js/settings.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |
| Login entry JS | `/js/login-page.js` | `application/javascript` | `SOURCE_CONFIRMED` | HTTP status, asset path template | Asset content | Yes — HTTP 200 check | File exists in source |

`SOURCE_CONFIRMED` status is based on file existence in repository at base SHA. No HTTP-level static asset smoke currently exists in CI (`tests/smoke/routes.test.cjs` asserts file existence only). HTTP-level verification requires a deployed URL.

---

## 4. Same-Origin API Surfaces

### 4.1 Public API routes

| Route | Method | Parameters | Classification | Expected status | Safe evidence | Prohibited evidence | Production observation | Unresolved dependency |
|---|---|---|---|---|---|---|---|---|
| `/api/community/trees` | GET | `view=summary`, `sort=latest`, `limit=3` | `RUNTIME_PUBLIC` | HTTP 200, `content-type: application/json`, valid JSON array | HTTP status, `x-lovebud-upstream` header, operation code `API_COMMUNITY_TREES_SUMMARY`, latency bucket | Response body, query parameter values, `treeId` in response, `x-lovebud-request-id` | Yes — curl check per `DEPLOY_CHECKLIST.md` | No CI job calls this endpoint. Modal backend must be reachable. |
| `/api/trees/:id` | GET | Path param `treeId` | `RUNTIME_UNRESOLVED` | HTTP 200, valid JSON with `visibility: "public"` | HTTP status, `x-lovebud-upstream`, `x-lovebud-public-tree-cache` | Response body, `treeId`, `ownerId`, `x-lovebud-request-id` | Conditional — requires approved public-tree fixture | Identifier-bearing. `BLOCKED_BY_AUTHORITY` without approved fixture (`RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §4.3.2). |
| `/api/community/memories` | GET | `treeId=<id>` | `RUNTIME_UNRESOLVED` | HTTP 200 | HTTP status | Response body, `treeId`, `memoryId` | Not authorized — identifier-bearing | Not a generic health endpoint. Requires known `treeId`. |

### 4.2 Auth-guard API routes

| Route | Method | Classification | Expected status | Safe evidence | Prohibited evidence | Production observation |
|---|---|---|---|---|---|---|
| `/api/trees/` (no auth header) | GET | `RUNTIME_PUBLIC` (intentional rejection) | HTTP 401, `x-lovebud-route-status: missing-authorization` | HTTP status, `x-lovebud-route-status` header, operation code `AUTH_GUARD_EXPECTED_REJECTION` | Authorization header, cookie, token, Firebase UID, `x-lovebud-request-id` | Yes — expected 401 is `HEALTHY` |
| `/api/trees/` (with auth) | GET | `RUNTIME_REQUIRES_AUTH` | HTTP 200 | HTTP status, latency bucket | Response body, `treeId` values, user data, auth tokens | Yes — requires operator auth session |
| `/api/trees/:id` (write methods) | PUT, DELETE | `RUNTIME_REQUIRES_AUTH` | HTTP 200 or 403 | HTTP status, `x-lovebud-route-status` | Request body, response body, tree data | Yes — requires operator auth session and owned tree |

`OBSERVED_CURRENT_FACT`: `functions/api/[[path]].js` implements bounded response headers (`x-lovebud-upstream`, `x-lovebud-route-status`, `x-lovebud-degraded`, `x-lovebud-request-id`). Modal fetch timeout is 25 000 ms. Write body size bounded to 128 KB.

`NOT_AUTHORIZED`: Owner-write smoke (create, update, delete, fork) without separately approved fixture.

---

## 5. Browser Runtime Evidence Boundaries

| Signal | Source status | Classification | Safe evidence | Prohibited evidence | Instrumentation | Production observation |
|---|---|---|---|---|---|---|
| HTTP response status | Per-route response object | `SOURCE_CONFIRMED` | HTTP status code, route template, latency bucket | Response body, headers (except bounded `x-lovebud-*`), request ID | Playwright `response.status()` (supplied-URL smoke) | Yes — per merge-first workflow |
| `<body>` DOM presence | Per-route DOM | `SOURCE_CONFIRMED` | Boolean presence/absence, route template | Full DOM content, text, attributes | Playwright `waitForSelector('body')` | Yes |
| Console errors (`console.error`) | Client-side runtime | `RUNTIME_UNRESOLVED` | Error count, route template, operation code | Error message text, stack trace, variable values, user text | Playwright `page.on('console')` in supplied-URL smoke. YouTube media URLs filtered via `isIgnoredConsoleError()`. | Yes — supplied-URL smoke observes console errors |
| Page errors (`pageerror`) | Client-side runtime | `RUNTIME_UNRESOLVED` | Error count, route template | Stack trace, error message, variable values, DOM state | Playwright `page.on('pageerror')` in supplied-URL smoke | Yes |
| Network failures (`requestfailed`) | Client-side runtime | `RUNTIME_UNRESOLVED` | Failure count, route template, operation code | Request URL, error text, response body | Playwright `page.on('requestfailed')` in supplied-URL smoke. YouTube media URLs filtered. | Yes |
| Network blockers (HTTP 4xx/5xx) | Client-side runtime | `RUNTIME_UNRESOLVED` | HTTP status, operation code, route template | Request URL, response body, query string | Playwright `page.on('response')` `isNetworkBlocker()` in supplied-URL smoke | Yes |
| Horizontal overflow | Client-side layout | `SOURCE_CONFIRMED` | Overflow pixels (expected 0), viewport name, route template | Full layout details, element sizes | Playwright `page.evaluate()` scrollWidth comparison | Yes — supplied-URL smoke |
| `window.onerror` | Client-side runtime | `RUNTIME_UNRESOLVED` | Not yet instrumented | Stack trace, error message, variable values | No handler exists (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2 gap 7) | Not yet possible |
| `unhandledrejection` | Client-side runtime | `RUNTIME_UNRESOLVED` | Not yet instrumented | Rejection reason, promise chain | No listener exists | Not yet possible |

`OBSERVED_CURRENT_FACT` (from `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2, §8.2):

- 12 `BROWSER_REAL_LOCAL` Playwright contracts execute in CI via `npm test` against a local HTTP server. They assert DOM/geometry, not deployed HTTP status.
- `scripts/cloudflare-supplied-url-smoke.cjs` is classified `REMOTE_OR_PROVIDER_MANUAL` with `MANUAL` default execution state — not in CI.
- No `window.onerror` or `unhandledrejection` handler exists in client codebase.
- All browser evidence currently collected by the supplied-URL smoke is raw diagnostic information, not a durable sanitized artifact.

---

## 6. Release / Deployment Correlation Sources

| Source | Path | Classification | Description | Safe evidence | Prohibited evidence |
|---|---|---|---|---|---|
| Smoke contract | `docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` | `SOURCE_CONFIRMED` | Defines release correlation fields (`expected_release_sha`, `observed_release_sha`, `release_match_state`) and bounded smoke contract. | Document text, bounded enum values | Cloudflare deployment ID, build log, provider data |
| SHA exposure decision | `docs/ops/RELEASE_SHA_PUBLIC_EXPOSURE_DECISION.md` | `SOURCE_CONFIRMED` | Recommends canonical JSON manifest at `/.well-known/release.json` with `release_sha` (40-char) and `contract_version`. | Document text, bounded enum values | Deployment ID, environment data, build metadata |
| Runtime health taxonomy | `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` | `SOURCE_CONFIRMED` | Defines runtime domains, error-code grammar, expectation-aware health derivation. | Document text, bounded enum values | Private payload, stack traces, user content |
| Deployment checklist | `docs/ops/DEPLOY_CHECKLIST.md` | `SOURCE_CONFIRMED` | Documents manual `curl` checks for API endpoints. | Document text | Command output, API responses |
| Merge-first workflow | `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` | `SOURCE_CONFIRMED` | Defines post-merge Production confirmation as the normal final check. | Document text | Production observation data |

`OBSERVED_CURRENT_FACT` (from `docs/ops/RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §1.3, `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §2.3):

- No serving-SHA exposure mechanism is currently implemented.
- No deployment SHA annotation file or deploy manifest exists in repository.
- No CI job or post-deploy hook calls any `/api/*` endpoint.
- Cloudflare Pages auto-deploys from `main` with no CI workflow trigger.
- Stale Production is manually detected per #3699 operating rule.

---

## 7. Evidence Grid Summary

### 7.1 Route surfaces

| Operation code | Route | Auth | Classification | Expected status | Supplied-URL smoke | In CI | Production observation |
|---|---|---|---|---|---|---|---|
| `ROUTE_HOME` | `/` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | Yes (`/`) | No | Yes |
| `ROUTE_INTRO` | `/intro` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | Yes (`/pages/intro.html`) | No | Yes |
| `ROUTE_BROWSE` | `/search` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | Yes (`/pages/search.html`) | No | Yes |
| `ROUTE_MY_TREES` | `/my-trees` | Yes | `RUNTIME_REQUIRES_AUTH` | HTTP 200, `<body>` | No | No | Yes (page-load only) |
| `ROUTE_EDITOR` | `/editor` | Yes | `RUNTIME_REQUIRES_AUTH` | HTTP 200, `<body>` | No | No | Yes (page-load only) |
| `ROUTE_SETTINGS` | `/settings` | Yes | `RUNTIME_REQUIRES_AUTH` | HTTP 200, `<body>` | No | No | Yes (page-load only) |
| `ROUTE_PUBLIC_VIEWER` | `/tree` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | No | No | Yes (page-load only; content requires fixture) |
| `ROUTE_DETAIL` | `/detail` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | No | No | Yes (page-load only; content requires fixture) |
| `ROUTE_LOGIN` | `/login` | No | `RUNTIME_PUBLIC` | HTTP 200, `<body>` | No | No | Yes |

### 7.2 Static asset surfaces

| Operation code | Path | Classification | Supplied-URL smoke | In CI |
|---|---|---|---|---|
| `STATIC_GLOBAL_CSS` | `/css/global.css` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_HOME_ENTRY` | `/js/index.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_BROWSE_ENTRY` | `/js/search/index.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_EDITOR_ENTRY` | `/js/editor.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_VIEWER_ENTRY` | `/js/viewer/tree-viewer.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_MY_TREES_ENTRY` | `/js/my-trees.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_SETTINGS_ENTRY` | `/js/settings.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |
| `STATIC_LOGIN_ENTRY` | `/js/login-page.js` | `SOURCE_CONFIRMED` | No (file existence only) | No |

### 7.3 API surfaces

| Operation code | Endpoint | Auth | Classification | In CI | Production observation |
|---|---|---|---|---|---|
| `API_COMMUNITY_TREES_SUMMARY` | `GET /api/community/trees?view=summary&sort=latest&limit=3` | No | `RUNTIME_PUBLIC` | No | Yes (manual curl) |
| `API_PUBLIC_TREE_READ` | `GET /api/trees/:id` (no auth) | No | `RUNTIME_UNRESOLVED` | No | Conditional (fixture gate) |
| `AUTH_GUARD_EXPECTED_REJECTION` | `GET /api/trees/` (no auth) | No (intentional) | `RUNTIME_PUBLIC` | No | Yes (expected 401) |

---

## 8. Unresolved Dependencies and Gaps

| # | Gap | Impact | Source |
|---|---|---|---|
| 1 | Supplied-URL smoke (3 routes) not executed in CI | Post-deploy route/DOM/console errors unchecked | `tests/ci-test-group-registry.json` |
| 2 | 6 of 9 canonical routes have no supplied-URL smoke | Detail, Editor, My Trees, Settings, Tree, Login uncovered | `scripts/cloudflare-supplied-url-smoke.cjs` |
| 3 | No HTTP-level static asset smoke (file existence only) | CDN cache, content-type, or 404 served for critical assets undetected | `tests/smoke/routes.test.cjs` |
| 4 | No CI job calls any `/api/*` endpoint | API health unverified after merge | `.github/workflows/ci.yml` |
| 5 | No serving-SHA exposure mechanism | Cannot correlate deployed build to source commit | repository |
| 6 | No `window.onerror` or `unhandledrejection` handler | Browser runtime errors invisible without Playwright | client codebase |
| 7 | Supplied-URL smoke uses non-canonical paths (`/pages/intro.html`, `/pages/search.html`) | Smoke does not match user-facing route structure | `scripts/cloudflare-supplied-url-smoke.cjs` |
| 8 | `API_PUBLIC_TREE_READ` requires approved fixture | Public viewer content smoke blocked | `RELEASE_SHA_BOUNDED_SMOKE_CONTRACT.md` §4.3.2 |
| 9 | Stale Production detection is manual only | #3699 operating rule; no automation | #3699 |

---

## 9. Hard Boundaries

The following apply to all surfaces:

- No raw response bodies, user-generated content, identifiers, cookies, tokens, headers, credentials, DB URLs, provider payloads, or private screenshots in any smoke evidence.
- Technical smoke evidence (`HTTP 200`, `<body>` present, zero fatal console errors) is distinct from subjective visual/product acceptance (`UI_APPROVED`, `VISUAL_PASS`, `BRAND_ALIGNED`). Per `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`, a technical pass does not imply product acceptance.
- Stale Production must be recorded under #3699 and must not trigger manual deployment. Per `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`, the operating rule is: check Production once after merge; if stale, record observation and stop.
- Source existence does not equal runtime health. A file existing in the repository means its source path is confirmed. HTTP-level serving, CDN cache behavior, API response validity, and browser runtime health require separate runtime observation.
- No network calls or Production access were performed in this audit.
- No script, workflow, package, runtime, API, DB, or UI change is authorized.

---

## 10. Recommended Next Implementation Child

### Child: Add 6 missing routes to supplied-URL smoke coverage

- **Scope:** Extend `scripts/cloudflare-supplied-url-smoke.cjs` to cover the 6 canonical routes that currently have no supplied-URL smoke: `/my-trees`, `/editor`, `/settings`, `/tree`, `/detail`, `/login`. Each route checks HTTP 200, `<body>` presence, zero fatal console errors, and no horizontal overflow. Auth-guarded routes (`/my-trees`, `/editor`, `/settings`) are verified for page-load only — content-population smoke is not included.
- **Prerequisite:** This inventory document merged. Owner approval recorded.
- **Exact candidate files:**
  - `scripts/cloudflare-supplied-url-smoke.cjs` (**existing file, to be modified**): add 6 new targets (12 new viewport runs) to the `TARGETS` array. Use canonical extensionless routes (`/my-trees`, `/editor`, `/settings`, `/tree`, `/detail`, `/login`).
  - `tests/contracts/supplied-url-smoke-contract.test.cjs` (**new file**): contract test asserting that `TARGETS` in the script include all 9 canonical routes and that each target uses an extensionless path.
  - `docs/ops/SUPPLIED_URL_SMOKE_CONTRACT.md` (**new file**): contract document defining the expanded target set, evidence boundaries, and cache/no-store limitations.
- **Evidence boundary:**
  - Auth-guarded routes: verify HTTP 200, `<body>`, console errors, overflow — no auth required.
  - Public routes: verify HTTP 200, `<body>`, console errors, overflow.
  - API-dependent page (`/search`): existing behavior preserved (API health deferred to browser runtime).
- **Failure handling:**
  - Contract test fails if TARGETS does not include all 9 canonical routes.
  - Smoke script exits non-zero if any route fails assertion.
- **Rollback:** Revert the TARGETS addition in `scripts/cloudflare-supplied-url-smoke.cjs`. Remove new contract test and contract document.
- **Stop condition:**
  - Inventory document reviewed and merged.
  - Implementation child Issue created with owner approval.
  - Contract test passes on `main`.
  - Expanded supplied-URL smoke executes against deployed URL and validates all 9 canonical routes.
  - No private payload exposure proven by contract test.
  - #3699 referenced but not closed.
- **Not-authorized boundary:**
  - No CI workflow modification (smoke remains `MANUAL`).
  - No Cloudflare API call.
  - No Wrangler deploy.
  - No Production mutation.
  - No automatic stale-detection cron.
  - No auth-interactive smoke.
  - No API endpoint smoke (already covered by existing deferred API-health pattern).

---

*Refs #3751*
*Refs #3673 — Keep OPEN*
*Refs #3699 — Keep OPEN*
*Refs #3734 — completed*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*
