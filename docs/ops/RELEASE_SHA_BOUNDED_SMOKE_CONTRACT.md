# Release SHA and Bounded Route/Static/API/Browser Smoke Contract

> **Status:** partially implemented — canonical release-SHA manifest is implemented and Production-verified (#3761 / PR #3762, #3764). The broader smoke runner, automatic post-deploy orchestration, durable sanitized artifact, route/static/API/browser coverage, provider mutation, and automatic deployment repair remain proposed or unimplemented.
> **Authority labels:** `IMPLEMENTED_CURRENT_CONTRACT`, `OBSERVED_CURRENT_FACT`, `DOCUMENTED_OPERATING_RULE`, `PROPOSED_FUTURE_CONTRACT`, `UNRESOLVED`, `NOT_AUTHORIZED`
> **Parent:** #3673 — Keep OPEN
> **Completed groundwork:** #3714 / PR #3719 (audit), #3725 / PR #3726 (taxonomy), #3740 / PR #3744 (SHA exposure decision), #3761 / PR #3762 (release manifest implementation), #3764 (Production verification)
> **Related:** #3699 (Keep OPEN), #3425 (Keep OPEN), #1882 (Keep OPEN)

This document defines the bounded contract for correlating a LoveBud source release SHA with smoke evidence across route, static-asset, same-origin API, and browser-runtime surfaces. It does not authorize telemetry collection, Cloudflare Dashboard access, provider API calls, database operations, or automatic deployment mutation.

---

## 1. Release Correlation

### 1.1 Fields

Release correlation requires both the expected source identity and the observed serving identity. A single `release_sha` value cannot prove a stale deployment.

```text
expected_release_sha:
40-character Git SHA from merged main

observed_release_sha:
40-character Git SHA | UNKNOWN | NOT_EXPOSED

release_match_state:
MATCH | MISMATCH | UNKNOWN | NOT_EXPOSED
```

- `expected_release_sha` — the canonical source SHA from the merged `main` commit at the time of release. Required for every smoke artifact.
- `observed_release_sha` — the SHA actually observed at the serving endpoint. `UNKNOWN` when no observation was made; `NOT_EXPOSED` when no serving-SHA exposure mechanism is defined in repository source.
- `release_match_state` — the comparison result between expected and observed. `NOT_EXPOSED` when the observed SHA is not available for comparison.

### 1.2 Current serving-SHA source

The canonical public serving-SHA source is:

| Property | Value |
|---|---|
| Endpoint | `/.well-known/release.json` |
| Schema | `{"release_sha": "<40-char hex>", "contract_version": "1"}` |
| `release_sha` | Exact 40-character lowercase Git SHA. Resolved at build time from `git rev-parse HEAD`, validated against `^[0-9a-f]{40}$`. |
| `contract_version` | `"1"` |
| Cache policy | `Cache-Control: no-store` |
| Source file | `_headers` — path-specific entry for `/.well-known/release.json` |
| Build integration | `scripts/build-static.js` — SHA resolution and manifest generation during `npm run build` |
| Contract test | `tests/contracts/release-sha-manifest-contract.test.cjs` — valid JSON, exactly two keys, 40-char hex SHA, main SHA match, fail-closed, block-scoped cache policy assertion |
| Production verification | #3764 — HTTP 200, `application/json`, `no-store`, exact main SHA parity, two-request consistency, no forbidden metadata |

`IMPLEMENTED_CURRENT_CONTRACT`.

### 1.3 Prohibited

- Cloudflare deployment ID (`0c1054ee-...-...`) must never be used as a canonical source SHA.
- No CI workflow may commit a SHA file back into the repository (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §11 stop condition 2).
- No Cloudflare Dashboard or API call is authorized to obtain the observed SHA.

### 1.4 Current evidence

`IMPLEMENTED_CURRENT_CONTRACT`: The canonical release manifest at `/.well-known/release.json` is generated at build time and served with `Cache-Control: no-store`. The `release_sha` field exposes the exact 40-character lowercase Git SHA of the deployed source. Production verification (#3764) confirms HTTP 200, JSON content-type, no-store cache policy, exact main SHA match, and no forbidden metadata.

`OBSERVED_CURRENT_FACT`: No deployment SHA annotation file beyond the canonical manifest exists. No deploy manifest or SHA comparison mechanism other than the `/.well-known/release.json` endpoint exists in the repository.

`DOCUMENTED_OPERATING_RULE`: The current merge-first workflow is:
1. Check Production once after merge (including `/.well-known/release.json` parity).
2. If current main is served and manifest matches, verify affected behavior.
3. If Production is stale or manifest is absent/incorrect, record observation and stop.
4. No manual deployment or Cloudflare mutation without owner explicit request.

`UNRESOLVED`: No automatic stale-release detection, smoke runner orchestration, or durable sanitized artifact aggregation is implemented.

Provider-native behavior:
UNRESOLVED

Provider investigation:
outside this source-only child

---

## 2. Bounded Smoke Operation Codes

`PROPOSED_FUTURE_CONTRACT`

Every smoke operation is identified by a bounded operation code. Raw URLs, query values, `treeId`, `memoryId`, Firebase UID, tokens, cookies, request bodies, response bodies, user text, provider messages, and stack traces are forbidden in durable evidence.

### 2.1 Route surfaces

| Operation code | Surface | Source path |
|---|---|---|
| `ROUTE_HOME` | Home (index) | `index.html` |
| `ROUTE_BROWSE` | Browse / 둘러보기 | `pages/search.html` → `/search` |
| `ROUTE_MY_TREES` | My Trees | `pages/my-trees.html` → `/my-trees` |
| `ROUTE_EDITOR` | Editor | `pages/editor.html` → `/editor` |
| `ROUTE_SETTINGS` | Settings | `pages/settings.html` → `/settings` |
| `ROUTE_PUBLIC_VIEWER` | Tree public viewer | `pages/tree.html` → `/tree` |
| `ROUTE_DETAIL` | Memory detail | `pages/detail.html` → `/detail` |
| `ROUTE_LOGIN` | Login | `pages/login.html` → `/login` |
| `ROUTE_INTRO` | Intro | `pages/intro.html` → `/intro` |

Routes are canonicalized by `_redirects` from `.html` and `.html/` to extensionless `/pages/<name>` paths.

### 2.2 Static asset surfaces

| Operation code | Asset | Source path |
|---|---|---|
| `STATIC_GLOBAL_CSS` | Global stylesheet | `/css/global.css` |
| `STATIC_HOME_ENTRY` | Home page entry JS | `/js/index.js` |
| `STATIC_BROWSE_ENTRY` | Browse page entry JS | `/js/search/index.js` |
| `STATIC_EDITOR_ENTRY` | Editor page entry JS | `/js/editor.js` |
| `STATIC_VIEWER_ENTRY` | Public viewer entry JS | `/js/viewer/tree-viewer.js` |

### 2.3 Same-origin API surfaces

| Operation code | Endpoint | Description |
|---|---|---|
| `API_COMMUNITY_TREES_SUMMARY` | `GET /api/community/trees?view=summary&sort=latest&limit=3` | Browse summary, fixed-parameter public read (`docs/engineering/API_CONTRACT.md` §4.1) |
| `API_PUBLIC_TREE_READ` | `GET /api/trees/:id` (no auth header) | Public tree detail, anonymous read path (`functions/api/[[path]].js`) |

`OBSERVED_CURRENT_FACT`: `GET /api/community/memories?treeId=<treeId>` is identifier-bearing and is not a generic health endpoint (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §5). No `GET /api/community/trees?view=summary` smoke exists in CI; `docs/ops/DEPLOY_CHECKLIST.md` documents it as a manual `curl` command.

### 2.4 Auth guard surface

| Operation code | Endpoint | Description |
|---|---|---|
| `AUTH_GUARD_EXPECTED_REJECTION` | `GET /api/trees/` (no auth header) | Expected 401 from auth-guarded owner route |

### 2.5 Browser runtime surfaces

| Operation code | Signal | Description |
|---|---|---|
| `BROWSER_FATAL_ERROR` | `window.onerror` (future) | Fatal client-side exception. No `window.onerror` handler exists (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2 gap 7). |
| `BROWSER_UNHANDLED_REJECTION` | `unhandledrejection` (future) | Unhandled Promise rejection. No listener exists. |

---

## 3. Expectation-Aware Result Model

`PROPOSED_FUTURE_CONTRACT`

This contract reuses the taxonomy from `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` §3.3 and §4.3. Every smoke observation carries an expectation class that determines whether the observed result is healthy or indicates a failure.

```text
expectation_class:
EXPECTED_SUCCESS
EXPECTED_POLICY_REJECTION
UNEXPECTED_FAILURE
UNKNOWN_EXPECTATION
```

| Field | Values | Source |
|---|---|---|
| `expectation_class` | `EXPECTED_SUCCESS`, `EXPECTED_POLICY_REJECTION`, `UNEXPECTED_FAILURE`, `UNKNOWN_EXPECTATION` | taxonomy §4.3 |
| `status_class` | `HEALTHY`, `DEGRADED`, `FAILED`, `UNKNOWN`, `NOT_EXECUTED`, `NOT_APPLICABLE`, `BLOCKED_BY_AUTHORITY` | taxonomy §4.1 |
| `sanitized_error_code` | `LB_<DOMAIN>_<FAILURE_CLASS>` or `NONE` | taxonomy §3 |
| `severity` | `INFO`, `WARNING`, `ERROR`, `CRITICAL` | taxonomy §5 |
| `latency_bucket` | `LT_250_MS`, `250_TO_999_MS`, `1_TO_2_999_S`, `3_TO_9_999_S`, `GE_10_S`, `TIMEOUT_OR_UNKNOWN`, `NOT_MEASURED` | taxonomy §6 |

Expected policy rejections (e.g. `AUTH_GUARD_EXPECTED_REJECTION` returning HTTP 401) must be classified as `HEALTHY` with `NONE` error code and `INFO` severity. A generic HTTP 4xx alone must never determine health.

---

## 4. Surface Matrix

`PROPOSED_FUTURE_CONTRACT`

### 4.1 Route surfaces

| Operation code | Prerequisite | Method | Expected status/shape | Allowed evidence | Forbidden evidence | Auth requirement | Failure classification | Stop condition |
|---|---|---|---|---|---|---|---|---|
| `ROUTE_HOME` | Deployed URL supplied | `GET /` | HTTP 200, `<body>` present, zero fatal console errors, no horizontal overflow | HTTP status, route template, latency bucket, `<body>` presence | Response HTML, query parameters, cookies, user state | None | `LB_ROUTE_RESPONSE_HTTP_4XX`, `LB_ROUTE_RESPONSE_HTTP_5XX`, `LB_ROUTE_RESPONSE_TIMEOUT`, `LB_ROUTE_RESPONSE_NETWORK` | Expected HTTP 2xx + body rendered. Absence of either is `FAILED`. |
| `ROUTE_BROWSE` | Deployed URL supplied | `GET /search` | HTTP 200, `<body>` present | HTTP status, route template, latency bucket | Response HTML, query parameters, user state | None (public page, API fetched client-side) | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. API fetch failures detected in browser runtime if instrumented. |
| `ROUTE_MY_TREES` | Deployed URL supplied | `GET /my-trees` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state, auth tokens | Auth-guarded page; page loads but content requires auth | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. Auth guard is **expected** — see `AUTH_GUARD_EXPECTED_REJECTION` for the guard smoke. |
| `ROUTE_EDITOR` | Deployed URL supplied | `GET /editor` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state, auth tokens | Auth-guarded page | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. Auth guard expected. |
| `ROUTE_SETTINGS` | Deployed URL supplied | `GET /settings` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state, auth tokens | Auth-guarded page | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. Auth guard expected. |
| `ROUTE_PUBLIC_VIEWER` | Deployed URL supplied | `GET /tree` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state | None (public page) | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. |
| `ROUTE_DETAIL` | Deployed URL supplied | `GET /detail` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state | None (public page) | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. |
| `ROUTE_LOGIN` | Deployed URL supplied | `GET /login` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state, auth tokens, OAuth parameters | None (public page) | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. |
| `ROUTE_INTRO` | Deployed URL supplied | `GET /intro` | HTTP 200, `<body>` present | HTTP status, route template | Response HTML, user state | None (public page) | Same as `ROUTE_HOME` | Expected HTTP 2xx + body. |

`OBSERVED_CURRENT_FACT`: Current supplied-URL smoke (`scripts/cloudflare-supplied-url-smoke.cjs`) covers only 3 routes (`ROUTE_HOME`, `ROUTE_INTRO`, `ROUTE_BROWSE`). The script validates the following actual paths:

```text
/
/pages/intro.html
/pages/search.html
```

The proposed bounded contract canonical routes are:

```text
/
/intro
/search
```

The current script does not validate extensionless routes. The remaining 6 routes have no deployed-URL smoke (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §4.3, §4.4 gap 9).

### 4.2 Static asset surfaces

| Operation code | Prerequisite | Method | Expected status/shape | Allowed evidence | Forbidden evidence | Auth requirement | Failure classification | Stop condition |
|---|---|---|---|---|---|---|---|---|
| `STATIC_GLOBAL_CSS` | Deployed URL supplied | `GET /css/global.css` | HTTP 200, `content-type: text/css` | HTTP status, asset path template, latency bucket | Asset content, CDN cache internals | None | `LB_STATIC_ASSET_MISSING_ASSET`, `LB_STATIC_ASSET_TIMEOUT` | Expected HTTP 2xx. |
| `STATIC_HOME_ENTRY` | Deployed URL supplied | `GET /js/index.js` | HTTP 200, `content-type: application/javascript` | HTTP status, asset path template | Asset content, cache-busting hash value | None | Same as above | Expected HTTP 2xx. |
| `STATIC_BROWSE_ENTRY` | Deployed URL supplied | `GET /js/search/index.js` | HTTP 200, `content-type: application/javascript` | HTTP status, asset path template | Asset content | None | Same as above | Expected HTTP 2xx. |
| `STATIC_EDITOR_ENTRY` | Deployed URL supplied | `GET /js/editor.js` | HTTP 200, `content-type: application/javascript` | HTTP status, asset path template | Asset content | None | Same as above | Expected HTTP 2xx. |
| `STATIC_VIEWER_ENTRY` | Deployed URL supplied | `GET /js/viewer/tree-viewer.js` | HTTP 200, `content-type: application/javascript` | HTTP status, asset path template | Asset content | None | Same as above | Expected HTTP 2xx. |

`OBSERVED_CURRENT_FACT`: No HTTP-level static asset smoke currently exists. `tests/smoke/routes.test.cjs` asserts file existence only (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §4.2). Static asset paths above are confirmed against repository source.

`UNRESOLVED`: HTTP-level static asset smoke is not implemented. A future child may add bounded HTTP smoke against the confirmed paths.

### 4.3 Same-origin API surfaces

| Operation code | Prerequisite | Method | Expected status/shape | Allowed evidence | Forbidden evidence | Auth requirement | Failure classification | Stop condition |
|---|---|---|---|---|---|---|---|---|
| `API_COMMUNITY_TREES_SUMMARY` | Deployed URL supplied; Modal backend reachable | `GET /api/community/trees?view=summary&sort=latest&limit=3` | HTTP 200, `content-type: application/json`, valid JSON array | HTTP status, `x-lovebud-upstream` header, operation code, latency bucket | Response body, query parameter values, `treeId` values in response, `x-lovebud-request-id` | None (public read) | `LB_SAME_ORIGIN_API_HTTP_5XX`, `LB_SAME_ORIGIN_API_TIMEOUT`, `LB_SAME_ORIGIN_API_UPSTREAM_UNAVAILABLE`, `LB_SAME_ORIGIN_API_MALFORMED_RESPONSE`, `LB_SAME_ORIGIN_API_CONTRACT_MISMATCH` | Expected HTTP 2xx + valid JSON. Malformed or non-JSON is `DEGRADED` or `FAILED`. |
| `API_PUBLIC_TREE_READ` | Deployed URL supplied; Modal backend reachable | `GET /api/trees/:id` (no auth header) | HTTP 200, `content-type: application/json`, valid JSON with `visibility: "public"` | HTTP status, `x-lovebud-upstream` header, `x-lovebud-public-tree-cache` header, operation code | Response body, `treeId`, `ownerId`, `x-lovebud-request-id` | None (anonymous read path) | Same as above plus `LB_ROUTE_RESPONSE_HTTP_4XX` for unexpected 404 | Expected HTTP 2xx + public visibility. Identifier-bearing — see §4.3.1 Public-tree fixture gate. |
| `AUTH_GUARD_EXPECTED_REJECTION` | Deployed URL supplied; Modal backend reachable | `GET /api/trees/` (no auth header) | HTTP 401, `x-lovebud-route-status: missing-authorization` | HTTP status, `x-lovebud-route-status` header, operation code | Authorization header, cookie, token, Firebase UID, `x-lovebud-request-id` | None (intentionally unauthenticated) | `LB_ROUTE_RESPONSE_UNEXPECTED_FAILURE` if 2xx received; `HEALTHY` if 401 received | Expected 401 is `HEALTHY`. HTTP 2xx or 5xx is `UNEXPECTED_FAILURE`. |

`OBSERVED_CURRENT_FACT`: No CI job or post-deploy hook calls any `/api/*` endpoint (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §3.3). `docs/ops/DEPLOY_CHECKLIST.md` documents manual `curl` for browse summary only. `scripts/cloudflare-supplied-url-smoke.cjs` checks deferred API health only via Playwright page console/network recording for `ROUTE_BROWSE`.

### 4.3.1 Request-ID privacy boundary

`x-lovebud-request-id` is transiently observable in HTTP responses but is not durable allowed evidence.

```text
transiently observable:
yes

durably recordable:
no, by default

allowed purpose:
bounded troubleshooting only

user/session linkage:
forbidden

cross-system persistence:
separate approval required

retention:
separate bounded policy required
```

§7 sanitized artifact schema is request-ID-free.

### 4.3.2 Public-tree fixture gate

`API_PUBLIC_TREE_READ` is identifier-bearing. The default disposition is `BLOCKED_BY_AUTHORITY` or `NOT_EXECUTED`. Execution requires a separately approved fixture from one of:

```text
deterministic synthetic public fixture
explicitly designated non-user fixture
owner-approved bounded public test record
```

Each fixture requires:

```text
purpose
retention
deletion
ownership
non-user-data proof
```

Forbidden sources:

```text
임의 Production user tree ID
복사한 공개 URL
private log에서 얻은 ID
operator-selected 실제 user record
```

tree ID must never be recorded in the artifact. When parsing a response to check `visibility: public`, only the following bounded schema result may be preserved:

```text
bounded schema result:
PASS / FAIL / UNKNOWN
```

Response body and field values must not be stored.

### 4.4 Browser runtime surfaces

| Operation code | Prerequisite | Method | Expected status/shape | Allowed evidence | Forbidden evidence | Auth requirement | Failure classification | Stop condition |
|---|---|---|---|---|---|---|---|---|
| `BROWSER_FATAL_ERROR` | Instrumented route page load | `window.onerror` observation (future) | Zero uncaught exceptions during page lifecycle | Route template, bounded error category, occurrence count | Stack trace, variable values, DOM content, user text, source file paths | Varies by route | `LB_BROWSER_RUNTIME_FATAL_CLIENT_ERROR` | Zero fatal exceptions. Any fatal exception is `FAILED`. |
| `BROWSER_UNHANDLED_REJECTION` | Instrumented route page load | `unhandledrejection` observation (future) | Zero unhandled promise rejections during page lifecycle | Route template, occurrence count | Stack trace, rejection reason text, variable values | Varies by route | `LB_BROWSER_RUNTIME_UNHANDLED_REJECTION` | Zero unhandled rejections. Any is `DEGRADED` or `FAILED`. |

`OBSERVED_CURRENT_FACT`: No `window.onerror` or `unhandledrejection` handler exists in the client codebase. The 13 `BROWSER_REAL_LOCAL` Playwright contracts in CI check console errors in a local server context only. `scripts/cloudflare-supplied-url-smoke.cjs` observes `pageerror`, `console.error`, `requestfailed`, HTTP response blockers, and horizontal overflow against a supplied URL (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2, §8.2 gap 7).

`PROPOSED_FUTURE_CONTRACT`: A sanitized durable artifact, operator report, and client telemetry transport with central aggregation.

`NOT_AUTHORIZED`: Provider integration, automatic telemetry deployment, and central log collection.

Client source has no `window.onerror` transport. Playwright can observe `pageerror` externally — these are separate facts.

`OBSERVED_CURRENT_FACT` — current supplied-URL script output:

```text
baseUrl
route path
request/response URL
console error text
pageerror message
failure stack
```

`current supplied-URL script`: manual diagnostic evidence.

`current supplied-URL script`: NOT compliant with the proposed durable sanitized artifact.

A future runner child must separate raw diagnostic information from a durable sanitized summary. The existing script is not modified in this child.

### 4.5 Owner-write operations

Owner-write operations (create, update, delete, fork) are **not authorized** by this contract. Journey-level write smoke belongs to a later separately approved child (#3673 Step 4 / Child 4 of this document).

---

## 5. Execution Lanes

`PROPOSED_FUTURE_CONTRACT`

Every smoke operation belongs to exactly one execution lane.

| Lane | Description | Execution context | Example operations |
|---|---|---|---|
| `SOURCE_STATIC` | Source-only static contract tests. File existence, directory structure, string/regex assertions. No runtime or network. | CI via `npm test` (`node --test` glob). | `tests/smoke/routes.test.cjs` file existence checks. |
| `LOCAL_DETERMINISTIC` | Local Playwright browser or process contract tests. Production module source in local HTTP server or `node:vm`. No deployed URL. | CI via `npm test` (13 `BROWSER_REAL_LOCAL` + 4 `PROCESS_REAL_LOCAL`). | DOM/geometry assertions, console error checks against local server. |
| `SUPPLIED_URL_PUBLIC_SMOKE` | Bounded Playwright or fetch-based smoke against a supplied deployed URL. Checks HTTP status, `<body>` presence, console errors, network failures, API responses. No auth. | Manual or future post-merge hook. Not currently in CI. | `scripts/cloudflare-supplied-url-smoke.cjs` (3 routes). |
| `POST_MERGE_PRODUCTION_OBSERVATION` | Manual Production confirmation after merge. Uses browser, DevTools, or curl against `https://lovebud.pages.dev/`. | Manual operator per `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`. | `docs/ops/DEPLOY_CHECKLIST.md` curl commands, manual browser verification, `/.well-known/release.json` parity check. |
| `PROVIDER_MANUAL` | Checks that require Cloudflare Dashboard, Modal Dashboard, Firebase Console, or Neon Dashboard access. | Manual operator with provider access. | Deployment status check, Modal log review, Firebase Auth event inspection. |

`PROVIDER_MANUAL` is `NOT_AUTHORIZED` for automation by this child.

`OBSERVED_CURRENT_FACT`:
- `SOURCE_STATIC` and `LOCAL_DETERMINISTIC` execute in CI (all 5 layers from `tests/test-layer-classification.json`).
- `SUPPLIED_URL_PUBLIC_SMOKE`: only `scripts/cloudflare-supplied-url-smoke.cjs` exists, covering 3 routes, not in CI (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §3.2).
- `POST_MERGE_PRODUCTION_OBSERVATION`: entirely manual per `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`. The `/.well-known/release.json` manifest is now available as a bounded check target in this lane.
- `PROVIDER_MANUAL`: not automated; no Cloudflare API token or deploy action in CI (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §2.1).

---

## 6. Stale-Release Boundary

`PROPOSED_FUTURE_CONTRACT`

```text
automatic stale-release detection:
not implemented

#3699:
OPEN

current behavior:
manual Production observation only; manifest SHA comparison possible

release_match_state for #3699:
expected_release_sha (source main)
observed_release_sha (from manifest /.well-known/release.json)
release_match_state: MATCH | MISMATCH | UNKNOWN (manual comparison)
```

`IMPLEMENTED_CURRENT_CONTRACT`: The canonical manifest at `/.well-known/release.json` provides `release_sha` for comparison. An operator can manually compare the merged `main` SHA against the manifest value to determine `MATCH` or `MISMATCH`. Production verification (#3764) confirms the manifest serves the exact merged `main` SHA.

`OBSERVED_CURRENT_FACT`: No automatic stale-release detection exists. No cron job, webhook, or periodic comparison of source SHA vs Production serving SHA (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §8.1). The manifest provides the comparison value but does not automate detection.

`DOCUMENTED_OPERATING_RULE`: The #3699 operating rule — check Production once after merge (including `/.well-known/release.json` parity); if stale or mismatched, record observation and stop; no manual deployment or Cloudflare mutation without owner explicit request.

`UNRESOLVED`: No serving-SHA exposure mechanism other than the canonical manifest is defined.

Provider-native behavior:
UNRESOLVED

Provider investigation:
outside this source-only child

`x-lovebud-request-id` is correlation metadata only and does not encode the serving SHA.

**Detection mechanism**: The manifest at `/.well-known/release.json` is the sole canonical authority for the observed `release_sha`. A future child may implement automatic comparison between the expected merged SHA and the manifest value, or propose alternative exposure mechanisms. CI committing a SHA file back into the repository is `NOT_AUTHORIZED`.

---

## 7. Sanitized Artifact Schema

`PROPOSED_FUTURE_CONTRACT`

Every smoke evidence artifact must use the following minimum schema. No field may contain raw private payloads.

| Field | Type | Bounded vocabulary | Required / Optional | Privacy rule | Example |
|---|---|---|---|---|---|
| `expected_release_sha` | string (40-char hex) | Git SHA from `main` | Required | No provider deployment ID | `<merged main SHA>` |
| `observed_release_sha` | string (40-char hex or enum) | 40-char SHA, `UNKNOWN`, `NOT_EXPOSED` | Required | No provider deployment ID | `<manifest release_sha>` |
| `release_match_state` | string (enum) | `MATCH`, `MISMATCH`, `UNKNOWN`, `NOT_EXPOSED` | Required | Bounded enum only | `MATCH` |
| `observed_at_bucket` | string (ISO bucket key) | ISO hourly/daily/weekly key, `UNKNOWN` | Required | No exact user-event timestamp | `2026-07-30T14:00Z` |
| `observation_granularity` | string (enum) | `HOURLY`, `DAILY`, `WEEKLY`, `UNKNOWN` | Required | Bounded enum only | `HOURLY` |
| `surface_or_domain` | string (enum) | Taxonomy domain from `docs/ops/RUNTIME_HEALTH_ERROR_LATENCY_TAXONOMY.md` §2 | Required | Bounded enum only | `ROUTE_RESPONSE` |
| `operation_code` | string (enum) | One of the bounded operation codes from §2 of this document | Required | No raw URL. No query string. No arbitrary path. | `RELEASE_MANIFEST_FETCH` |
| `expectation_class` | string (enum) | `EXPECTED_SUCCESS`, `EXPECTED_POLICY_REJECTION`, `UNEXPECTED_FAILURE`, `UNKNOWN_EXPECTATION` | Required | Bounded enum only | `EXPECTED_SUCCESS` |
| `status_class` | string (enum) | `HEALTHY`, `DEGRADED`, `FAILED`, `UNKNOWN`, `NOT_EXECUTED`, `NOT_APPLICABLE`, `BLOCKED_BY_AUTHORITY` | Required | Bounded enum only | `HEALTHY` |
| `sanitized_error_code` | string (enum or `NONE`) | `LB_<DOMAIN>_<FAILURE_CLASS>` or `NONE` | Required | No embedded identifiers, URLs, or payload | `NONE` |
| `severity` | string (enum) | `INFO`, `WARNING`, `ERROR`, `CRITICAL` | Required | Bounded enum only | `INFO` |
| `latency_bucket` | string (enum) | `LT_250_MS`, `250_TO_999_MS`, `1_TO_2_999_S`, `3_TO_9_999_S`, `GE_10_S`, `TIMEOUT_OR_UNKNOWN`, `NOT_MEASURED` | Optional | No raw duration value. Use `NOT_MEASURED` when no measurement taken. | `NOT_MEASURED` |
| `evidence_source` | string (enum) | `SOURCE_STATIC`, `LOCAL_DETERMINISTIC`, `SUPPLIED_URL_PUBLIC_SMOKE`, `POST_MERGE_PRODUCTION_OBSERVATION`, `PROVIDER_MANUAL`, `FUTURE_INSTRUMENTATION` | Required | Bounded enum only. No provider log content. | `POST_MERGE_PRODUCTION_OBSERVATION` |

---

## 8. Outcome Classes

`PROPOSED_FUTURE_CONTRACT`

Every smoke operation produces exactly one outcome class. Outcome classes are distinct from product/visual acceptance labels.

### 8.1 Technical outcome classes

| Outcome | Meaning |
|---|---|
| `TECHNICAL_PASS` | All bounded checks against the surface produced `HEALTHY` status class. No unexpected failures. |
| `TECHNICAL_DEGRADED` | At least one check produced `DEGRADED`. Core surface is available but with reduced quality. |
| `TECHNICAL_FAIL` | At least one check produced `FAILED`. Surface or operation is unavailable. |
| `NOT_EXECUTED` | Smoke was defined but did not run (e.g. prerequisite not met, CI skipped). |
| `BLOCKED_BY_AUTHORITY` | Smoke was prevented by a governance rule, missing prerequisite, or missing approval. |
| `PRODUCTION_UNCONFIRMED` | Post-merge Production observation has not been performed or the result is ambiguous. |

### 8.2 Separation from product judgment

`DOCUMENTED_OPERATING_RULE` (from `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`):

```text
TECHNICAL_PASS does not imply:
UI_APPROVED
VISUAL_PASS
BRAND_ALIGNED
PRODUCT_ACCEPTED
```

A `TECHNICAL_PASS` means the bounded surface responded within the documented contract. Visual correctness, brand alignment, content completeness, and product acceptance require separate Web CTO / owner judgment.

---

## 9. Ordered Future Children

`PROPOSED_FUTURE_CONTRACT`

### Child 1 — Release-SHA public exposure decision and implementation

- **Status:** Completed.
- **Decision:** #3740 / PR #3744 — decided the canonical public serving-SHA exposure boundary. The public JSON manifest at `/.well-known/release.json` is the sole canonical authority.
- **Implementation:** #3761 / PR #3762 — built the release manifest, contract test, headers policy, and classification registry.
- **Production verification:** #3764 — confirmed HTTP 200, `application/json`, `Cache-Control: no-store`, exact main SHA parity, two-request consistency, no forbidden metadata.
- **Stop condition:** Decision document merged, implementation merged, Production parity verified.

### Child 2 — Bounded local/supplied-URL smoke runner

- **Scope:** Define and implement a bounded smoke runner script (or document-only runner design) that executes the surface matrix from §4 against a supplied deployed URL. Runner must accept a target URL, execute checks, and emit a sanitized artifact per §7 schema.
- **Prerequisite:** Child 1 completed (SHA exposure available for correlation).
- **Exact candidate files:** `scripts/supplied-url-smoke-runner.cjs` or `docs/ops/SMOKE_RUNNER_DESIGN.md` (document-only alternative). No existing file changes.
- **Evidence:** Runner output matching §7 schema, or design document with bounded contract.
- **Rollback:** Remove new runner file. No existing file modified.
- **Stop condition:** Runner executes against a supplied URL, produces sanitized artifact, zero private payload exposure proven by contract test pattern.
- **Not-authorized boundary:** No CI workflow modification. No Cloudflare API. No Provider action. No auth-interactive smoke.

### Child 3 — Sanitized report artifact

- **Scope:** Define the aggregation format for multiple smoke operations into a single operator-facing report. Report must use §7 schema per operation.
- **Prerequisite:** Child 2 (smoke runner producing individual artifacts).
- **Exact candidate files:** `docs/ops/SMOKE_REPORT_FORMAT.md` (new file only).
- **Evidence:** Format document with example artifacts.
- **Rollback:** Not applicable (document only).
- **Stop condition:** Format reviewed and merged.
- **Not-authorized boundary:** No report generation automation. No dashboard. No log aggregation.

### Child 4 — Post-merge observation hook

- **Scope:** Define a bounded mechanism to trigger or remind an operator to perform post-merge Production observation. This may be a manual checklist step, a CI status check with instructions, or a separate Issue template.
- **Prerequisite:** Children 1–3 providing SHA exposure and smoke runner.
- **Exact candidate files:** `docs/ops/POST_MERGE_OBSERVATION_HOOK.md` (new file only). No CI workflow modification.
- **Evidence:** Document with exact hook procedure.
- **Rollback:** Not applicable (document only).
- **Stop condition:** Document reviewed and merged.
- **Not-authorized boundary:** No automatic post-merge script. No Cloudflare/Provider/API automation.

### Child 5 — Critical journey success-state contract

- **Scope:** Define measurable success/failure signals for 3–5 critical authenticated journeys (home load, browse load, tree detail load, login, editor load). Define bounded journey-stage vocabulary.
- **Prerequisite:** Children 1–4 for SHA correlation and smoke runner availability.
- **Exact candidate files:** `docs/ops/CRITICAL_JOURNEY_SUCCESS_STATE_CONTRACT.md` (new file only).
- **Evidence:** Journey state document. No implementation.
- **Rollback:** Not applicable (document only).
- **Stop condition:** Document reviewed and merged.
- **Not-authorized boundary:** No browser instrumentation. No telemetry. No client JS modification. No owner-write smoke.

### Active work exclusion

No child above overlaps with:

- #3727 browser isolation (8 test files).
- #3728 design decision document.
- #3729 public viewer (4 files).
- #3730 matchmaking document.
- #3735 Detail file.
- #3721 search files.
- #3722 Story document.

---

## 10. Current Evidence Inventory

`OBSERVED_CURRENT_FACT`:

| Asset | Status | Source |
|---|---|---|
| Release-SHA endpoint | Implemented — `/.well-known/release.json` with `release_sha` + `contract_version` | `scripts/build-static.js`, `_headers` |
| Release-SHA contract test | Implemented — 10 assertions including JSON schema, SHA format, fail-closed, cache policy, cleanup | `tests/contracts/release-sha-manifest-contract.test.cjs` |
| Release-SHA Production verification | Verified — HTTP 200, JSON content-type, no-store, exact main SHA, no forbidden metadata | #3764 |
| CI deploy job | Absent — no `wrangler` or Cloudflare deploy step | `.github/workflows/ci.yml` |
| Post-deploy smoke in CI | Absent | `ci.yml` |
| Deployment SHA annotation beyond manifest | Absent | repository |
| Supplied-URL smoke coverage | 3 of 9 routes | `scripts/cloudflare-supplied-url-smoke.cjs` |
| Supplied-URL smoke in CI | Not executed | `tests/ci-test-group-registry.json` |
| Static asset HTTP smoke | Absent (file existence only) | `tests/smoke/routes.test.cjs` |
| API endpoint smoke in CI | Absent | `ci.yml` |
| Browser error capture | Absent (no `window.onerror`/`unhandledrejection`) | client codebase |
| Production alias stale detection | Absent (manual only; manifest provides comparison value) | #3699 |
| Public API smoke (documented) | Manual `curl` in `docs/ops/DEPLOY_CHECKLIST.md` | `DEPLOY_CHECKLIST.md` |

---

*Refs #3765*
*Refs #3764 — completed*
*Refs #3761 — completed*
*Refs #3740 — completed*
*Refs #3734 — completed*
*Refs #3673 — Keep OPEN*
*Refs #3699 — Keep OPEN*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*
