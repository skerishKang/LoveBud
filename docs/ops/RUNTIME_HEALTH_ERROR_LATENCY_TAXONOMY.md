# Runtime Health Error and Latency Taxonomy

> **Status:** proposed vocabulary — no instrumentation authorized
> **Parent:** #3673 — Keep OPEN
> **Completed audit:** #3714 / PR #3719 — `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md`
> **Related:** #3699 (Keep OPEN), #3670 (Keep OPEN), #3672 (Keep OPEN), #3425 (Keep OPEN), #1882 (Keep OPEN)
> **Base SHA:** `8bf90816cfed8ce22be5cb8c3917356a99ae5fb8`

This document defines a stable, privacy-preserving vocabulary for describing LoveBud Production runtime health. It does not authorize telemetry collection, client error reporting, provider access, Production mutation, API calls, or database access.

---

## 1. Authority and Evidence Labels

The following labels are used throughout this document. Every claim is tagged with exactly one.

| Label | Meaning |
|---|---|
| `OBSERVED_CURRENT_FACT` | Verified from repository source at the base SHA. No runtime or provider observation. |
| `DOCUMENTED_OPERATING_RULE` | Established by an owner-approved governance document in the repository. |
| `PROPOSED_FUTURE_CONTRACT` | Defined here as a candidate vocabulary. Not implemented. Not collected. Requires a separate child Issue and owner approval before any instrumentation. |
| `UNRESOLVED` | Cannot be determined from repository evidence alone. Requires provider dashboard, Production observation, or separate investigation. |
| `NOT_AUTHORIZED` | Explicitly outside the scope of this document and any currently approved child. |

### Source evidence read

| Path | Role |
|---|---|
| `docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` | Completed operations audit (#3714 / PR #3719) |
| `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` | Planning/audit for observability strategy |
| `docs/ops/MVP_AGENT_GOVERNANCE.md` | Canonical hard blockers and CI classification |
| `docs/ops/CI_UNAVAILABLE_INFRA_MERGE_POLICY.md` | Infrastructure-unavailable merge policy |
| `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` | Post-merge Production verification workflow |
| `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md` | Technical vs visual judgment separation |
| `docs/ops/DEPLOY_CHECKLIST.md` | Manual deployment checklist and endpoint references |
| `docs/engineering/API_CONTRACT.md` | API response contract and route map |
| `functions/api/[[path]].js` | Cloudflare Pages catch-all proxy handler |
| `functions/api/trees.js` | Cloudflare Pages tree route handler |
| `functions/api/memories.js` | Cloudflare Pages memory route handler |
| `modal_compute/app.py` | Modal FastAPI application (error boundaries) |
| `modal_compute/auth.py` | Firebase auth and PlusRequiredError |
| `modal_compute/api_response_helpers.py` | Modal response helpers (400/413) |
| `modal_compute/social_errors.py` | Social write error codes |

---

## 2. Runtime Domains

Each domain describes a bounded surface for health observation. No domain is currently instrumented for structured telemetry collection.

### 2.1 RELEASE_CORRELATION

- **Purpose:** Correlate a deployed Production build to its source commit SHA.
- **Allowed evidence:** Git SHA from `main` merge commit; deployment manifest if one is created by a future child.
- **Prohibited payload:** Cloudflare deployment ID, build log content, provider dashboard state, environment values.
- **Current instrumentation state:** `UNRESOLVED` — no deployment SHA annotation file, deploy manifest, or SHA comparison mechanism exists in the repository (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §2.3, §8.2 gap 3).
- **Future owner:** Release-SHA child (#3673 Step 2).

### 2.2 ROUTE_RESPONSE

- **Purpose:** HTTP response health for page routes served by Cloudflare Pages.
- **Allowed evidence:** HTTP status code, route template, latency bucket, presence of `<body>` DOM node.
- **Prohibited payload:** Raw URL with query parameters, response body, HTML content, user session state.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `scripts/cloudflare-supplied-url-smoke.cjs` checks HTTP status and `<body>` presence for 3 routes (`/`, `/pages/intro.html`, `/pages/search.html`) against a supplied deployed URL. This script is classified `REMOTE_OR_PROVIDER_MANUAL` and does not execute in CI (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §3.2, §4.3). The 12 `BROWSER_REAL_LOCAL` Playwright contracts execute in CI against a local HTTP server and assert DOM/geometry, not deployed HTTP status.
- **Future owner:** Release-SHA and smoke contract child (#3673 Step 2).

### 2.3 STATIC_ASSET

- **Purpose:** Availability of critical static assets (CSS, JS, images) required for page rendering.
- **Allowed evidence:** HTTP status code for asset path, asset path template, latency bucket.
- **Prohibited payload:** Asset content, CDN cache internals, full asset URL with cache-busting parameters.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `tests/smoke/routes.test.cjs` asserts file existence for core static pages (`index.html`, `pages/login.html`, `pages/search.html`, `pages/my-trees.html`) and `functions/api/` directory structure. No HTTP-level static asset smoke exists (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §4.2).
- **Future owner:** Release-SHA and smoke contract child (#3673 Step 2).

### 2.4 SAME_ORIGIN_API

- **Purpose:** Health of same-origin `/api/*` endpoints proxied through Cloudflare Pages Functions to Modal.
- **Allowed evidence:** HTTP status code, route template or operation code, latency bucket, `x-lovebud-upstream` header value, `x-lovebud-route-status` header value.
- **Prohibited payload:** Request body, response body, query parameter values, `treeId`, `memoryId`, Authorization header, cookies, Firebase UID.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `functions/api/[[path]].js` implements structured proxy error responses with bounded header signals: `x-lovebud-upstream` (`modal` | `cloudflare`), `x-lovebud-route-status` (`payload-too-large` | `unhandled` | `method-not-allowed` | `missing-authorization` | `modal-timeout`), `x-lovebud-degraded` (`modal-unavailable`), and `x-lovebud-request-id`. Modal fetch timeout is 25 000 ms. No structured telemetry collection or log aggregation consumes these signals (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2).
- **Future owner:** Separately approved instrumentation child (#3673 Step 5).

### 2.5 BROWSER_RUNTIME

- **Purpose:** Client-side JavaScript health: fatal exceptions, unhandled rejections, console error signals.
- **Allowed evidence:** Error class (fatal vs non-fatal), route template, bounded error category, latency bucket.
- **Prohibited payload:** Stack trace, variable values, user-generated text, DOM content, session storage, local storage values, cookies.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — no `window.onerror`, `unhandledrejection`, or structured console error reporting exists in the client codebase (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §6.2, §8.2 gap 7). The 12 `BROWSER_REAL_LOCAL` Playwright contracts check console errors in a local server context only.
- **Future owner:** Separately approved instrumentation child (#3673 Step 5).

### 2.6 AUTH_JOURNEY

- **Purpose:** Authentication flow health: login initiation, token validation, session establishment.
- **Allowed evidence:** Auth stage (initiation | validation | establishment), bounded failure category, latency bucket.
- **Prohibited payload:** Firebase UID, email, token, cookie, session identifier, OAuth callback parameters, Authorization header.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — Firebase Auth token validation occurs in Modal (`modal_compute/auth.py`). No structured auth event logging or cross-layer auth correlation exists (`docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` §3.1). Firebase Auth event logs are available only through the Firebase Console.
- **Future owner:** Critical journey success-state child (#3673 Step 4).

### 2.7 OWNER_READ_JOURNEY

- **Purpose:** Authenticated owner read operations: tree list, tree detail, memory list.
- **Allowed evidence:** Operation code, HTTP status code, latency bucket, bounded failure category.
- **Prohibited payload:** `treeId`, `memoryId`, Firebase UID, response body, request body, query parameter values.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `functions/api/trees.js` and `functions/api/[[path]].js` proxy owner reads to Modal `/modal/private/trees`. No structured journey-level health signal exists.
- **Future owner:** Critical journey success-state child (#3673 Step 4).

### 2.8 OWNER_WRITE_JOURNEY

- **Purpose:** Authenticated owner write operations: tree create/update/delete, memory create/update/delete, fork.
- **Allowed evidence:** Operation code, HTTP status code, latency bucket, bounded failure category, `x-lovebud-route-status` header value.
- **Prohibited payload:** Request body, response body, `treeId`, `memoryId`, Firebase UID, user-generated content, Authorization header.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `functions/api/[[path]].js` enforces bounded write body size (128 KB), missing-authorization guard, and payload-too-large response before proxying to Modal. `modal_compute/social_errors.py` defines bounded social write error codes. No structured write-journey health signal exists.
- **Future owner:** Critical journey success-state child (#3673 Step 4).

### 2.9 UPSTREAM_DEPENDENCY

- **Purpose:** Health of upstream services: Modal compute, Neon database, Firebase Auth, Vercel transitional fallback.
- **Allowed evidence:** Upstream identifier (bounded enum), HTTP status code, latency bucket, bounded failure category.
- **Prohibited payload:** Database URL, SQL, connection string, Modal function logs, provider dashboard state, environment values, secrets.
- **Current instrumentation state:** `OBSERVED_CURRENT_FACT` — `functions/api/[[path]].js` returns `503` with `x-lovebud-degraded: modal-unavailable` when Modal fetch fails, and `504` with `x-lovebud-route-status: modal-timeout` on 25 s abort. `docs/ops/DEPLOY_CHECKLIST.md` documents manual `curl` checks for `/modal/health` and `/modal/browse/latest`. No automated upstream health monitoring exists.
- **Future owner:** Health thresholds child (#3673 Step 5).

### 2.10 DEPLOYMENT_ALIAS

- **Purpose:** Detect whether the Production alias serves the expected source commit.
- **Allowed evidence:** Expected SHA (from `main`), observed serving state (bounded enum), detection method.
- **Prohibited payload:** Cloudflare deployment ID, build log, provider API response, dashboard screenshot content.
- **Current instrumentation state:** `UNRESOLVED` — no mechanism exists to compare source SHA against Production serving SHA. No cron job, webhook, or periodic check exists (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §8.1, §8.2 gap 5). #3699 documents a stale Production incident. Detection is manual and unresolved.
- **Future owner:** Release-SHA child (#3673 Step 2) for annotation; stale-detection automation is `NOT_AUTHORIZED`.

---

## 3. Sanitized Error-Code Grammar

### 3.1 Grammar definition

`PROPOSED_FUTURE_CONTRACT`

```text
LB_<DOMAIN>_<FAILURE_CLASS>
```

- `LB` — fixed prefix (LoveBud).
- `<DOMAIN>` — one of the 10 runtime domain identifiers from Section 2, uppercased.
- `<FAILURE_CLASS>` — one of the bounded failure classes below.

Error codes are bounded enum values. They must never embed:

- raw URL or path string;
- query parameter value;
- `treeId`, `memoryId`, `commentId`, `reactionId`;
- Firebase UID;
- token, cookie, session identifier;
- request body or response body;
- user-generated text;
- provider error message;
- stack trace or variable value.

### 3.2 Failure classes

| Failure class | Exact semantics | Allowed evidence source | Default severity | Recommended status class | Forbidden embedded information |
|---|---|---|---|---|---|
| `TIMEOUT` | Upstream or route did not respond within the bounded timeout window. `OBSERVED_CURRENT_FACT`: Modal fetch timeout is 25 000 ms (`functions/api/[[path]].js`). | HTTP status 504, `x-lovebud-route-status: modal-timeout` header, latency bucket `GE_10_S` or `TIMEOUT_OR_UNKNOWN`. | `ERROR` | `FAILED` | Raw URL, request body, Modal function name. |
| `HTTP_4XX` | Client-side HTTP error returned by the route or proxy. | HTTP status 400–499, `x-lovebud-route-status` header value. | `WARNING` | `DEGRADED` | Query values, request body, user text. |
| `HTTP_5XX` | Server-side HTTP error returned by the route, proxy, or upstream. | HTTP status 500–599, `x-lovebud-upstream` header value. | `ERROR` | `FAILED` | Response body, stack trace, provider message. |
| `NETWORK` | Connection failure, DNS failure, or TLS handshake failure before any HTTP response. | Absence of HTTP status, latency bucket `TIMEOUT_OR_UNKNOWN`. | `ERROR` | `FAILED` | Raw URL, IP address, DNS record. |
| `MALFORMED_RESPONSE` | HTTP response received but body is not valid JSON or does not match the expected contract shape. | HTTP status 200 with parse failure, `content-type` mismatch. | `WARNING` | `DEGRADED` | Response body, partial JSON, field values. |
| `CONTRACT_MISMATCH` | Response shape is valid JSON but violates the documented API contract (e.g. missing required field, wrong type). | Contract test assertion, bounded field name (not value). | `WARNING` | `DEGRADED` | Field values, user content, identifiers. |
| `MISSING_ASSET` | Critical static asset returned HTTP 404 or was not found. | HTTP status 404 for asset path template. | `ERROR` | `FAILED` | Full asset URL with cache-busting hash, CDN internals. |
| `FATAL_CLIENT_ERROR` | Unrecoverable browser JavaScript exception that prevents page interaction. | `window.onerror` signal (future), route template, bounded error category. | `CRITICAL` | `FAILED` | Stack trace, variable values, DOM content, user text. |
| `UNHANDLED_REJECTION` | Unhandled Promise rejection in browser runtime. | `unhandledrejection` signal (future), route template. | `ERROR` | `DEGRADED` | Stack trace, rejection reason text, variable values. |
| `AUTH_REQUIRED` | Route or operation requires authentication but no valid credential was presented. | HTTP status 401, `x-lovebud-route-status: missing-authorization`. | `WARNING` | `DEGRADED` | Token, cookie, Firebase UID, email. |
| `AUTH_FAILED` | Authentication was attempted but credential validation failed. | HTTP status 401 from Modal auth layer, bounded failure stage. | `ERROR` | `FAILED` | Token, Firebase UID, email, OAuth parameters. |
| `PERMISSION_DENIED` | Authenticated user lacks entitlement for the requested operation. | HTTP status 403, `PlusRequiredError` (`modal_compute/auth.py`), bounded entitlement category. | `WARNING` | `DEGRADED` | Firebase UID, entitlement field values, user profile. |
| `STALE_RELEASE` | Production alias serves a build whose SHA does not match the expected `main` head. | Manual SHA comparison (current), future release-SHA annotation. | `CRITICAL` | `FAILED` | Cloudflare deployment ID, build log content. |
| `UPSTREAM_UNAVAILABLE` | Upstream service (Modal, Neon, Firebase) is unreachable or returning service-unavailable. | HTTP status 503, `x-lovebud-degraded: modal-unavailable`, `SOCIAL_WRITE_UNAVAILABLE` (`modal_compute/social_errors.py`). | `ERROR` | `FAILED` | Database URL, connection string, Modal logs, environment values. |
| `RATE_LIMITED` | Request rejected due to rate-limit policy. | HTTP status 429, `RATE_LIMITED` / `RATE_LIMITED_MEMORY` / `RATE_LIMIT_UNAVAILABLE` (`modal_compute/social_errors.py`), `Retry-After` header presence. | `WARNING` | `DEGRADED` | User identifier, request body, rate-limit counter values. |
| `UNKNOWN_SANITIZED` | Failure occurred but cannot be classified into any bounded category. Fail-closed default. | Absence of recognizable signal. | `WARNING` | `UNKNOWN` | All private payload categories. |

### 3.3 Code families by domain

| Domain | Example codes |
|---|---|
| `RELEASE_CORRELATION` | `LB_RELEASE_CORRELATION_STALE_RELEASE` |
| `ROUTE_RESPONSE` | `LB_ROUTE_RESPONSE_HTTP_4XX`, `LB_ROUTE_RESPONSE_HTTP_5XX`, `LB_ROUTE_RESPONSE_TIMEOUT`, `LB_ROUTE_RESPONSE_NETWORK` |
| `STATIC_ASSET` | `LB_STATIC_ASSET_MISSING_ASSET`, `LB_STATIC_ASSET_TIMEOUT` |
| `SAME_ORIGIN_API` | `LB_SAME_ORIGIN_API_HTTP_5XX`, `LB_SAME_ORIGIN_API_TIMEOUT`, `LB_SAME_ORIGIN_API_MALFORMED_RESPONSE`, `LB_SAME_ORIGIN_API_CONTRACT_MISMATCH`, `LB_SAME_ORIGIN_API_UPSTREAM_UNAVAILABLE`, `LB_SAME_ORIGIN_API_RATE_LIMITED` |
| `BROWSER_RUNTIME` | `LB_BROWSER_RUNTIME_FATAL_CLIENT_ERROR`, `LB_BROWSER_RUNTIME_UNHANDLED_REJECTION` |
| `AUTH_JOURNEY` | `LB_AUTH_JOURNEY_AUTH_REQUIRED`, `LB_AUTH_JOURNEY_AUTH_FAILED`, `LB_AUTH_JOURNEY_TIMEOUT` |
| `OWNER_READ_JOURNEY` | `LB_OWNER_READ_JOURNEY_HTTP_5XX`, `LB_OWNER_READ_JOURNEY_TIMEOUT`, `LB_OWNER_READ_JOURNEY_PERMISSION_DENIED` |
| `OWNER_WRITE_JOURNEY` | `LB_OWNER_WRITE_JOURNEY_HTTP_5XX`, `LB_OWNER_WRITE_JOURNEY_TIMEOUT`, `LB_OWNER_WRITE_JOURNEY_PERMISSION_DENIED`, `LB_OWNER_WRITE_JOURNEY_RATE_LIMITED` |
| `UPSTREAM_DEPENDENCY` | `LB_UPSTREAM_DEPENDENCY_UPSTREAM_UNAVAILABLE`, `LB_UPSTREAM_DEPENDENCY_TIMEOUT`, `LB_UPSTREAM_DEPENDENCY_NETWORK` |
| `DEPLOYMENT_ALIAS` | `LB_DEPLOYMENT_ALIAS_STALE_RELEASE` |

---

## 4. Technical Status Classes

`PROPOSED_FUTURE_CONTRACT`

### 4.1 Technical health status

| Status class | Meaning |
|---|---|
| `HEALTHY` | Route, asset, or operation responded within expected bounds. No error code required. |
| `DEGRADED` | Partial failure or reduced quality. User can still complete some actions. |
| `FAILED` | Complete failure. User cannot complete the intended action. |
| `UNKNOWN` | Status cannot be determined from available evidence. |
| `NOT_EXECUTED` | Check or smoke was defined but did not run. |
| `NOT_APPLICABLE` | Check does not apply to this surface or context. |
| `BLOCKED_BY_AUTHORITY` | Check was prevented by a governance rule, missing approval, or missing prerequisite. |

### 4.2 Product and visual acceptance (separate)

The following labels belong to product/visual judgment and are **not** technical health status classes:

```text
UI_APPROVED
VISUAL_PASS
BRAND_ALIGNED
PRODUCT_ACCEPTED
```

`DOCUMENTED_OPERATING_RULE`: `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md` establishes that functional verification and subjective visual judgment are separate activities. Executors report `SCREENSHOT_CAPTURED`, `PAGE_LOADED`, `NO_FATAL_CONSOLE_ERRORS` — never `VISUAL_PASS`, `UI_APPROVED`, or `BRAND_ALIGNED`.

A technical smoke result of `HEALTHY` does not imply `UI_APPROVED`, `VISUAL_PASS`, `BRAND_ALIGNED`, or `PRODUCT_ACCEPTED`. These require separate Web CTO / owner judgment.

---

## 5. Severity Model

`PROPOSED_FUTURE_CONTRACT`

| Severity | Blast radius | Evidence threshold | User action impact | Escalation expectation | Forward-fix consideration | Rollback consideration boundary |
|---|---|---|---|---|---|---|
| `INFO` | Single request or non-user-facing signal. | Bounded status signal present. | None. | No escalation. Log for trend analysis only. | Not applicable. | Not applicable. |
| `WARNING` | Subset of users or degraded experience. | Bounded error code with `DEGRADED` status class. | Some actions slower or partially unavailable. | Record and monitor. Escalate if recurrence exceeds threshold defined by a future child. | Forward-fix preferred. | Rollback considered only if forward-fix is not feasible within the operator-defined window. |
| `ERROR` | Majority of users or critical path blocked. | Bounded error code with `FAILED` status class. | Primary user action cannot complete. | Escalate to operator within the response window defined by a future child. | Forward-fix preferred. | Rollback considered if forward-fix cannot restore service within the operator-defined window. |
| `CRITICAL` | All users or data-integrity risk. | Bounded error code with `FAILED` status class plus evidence of systemic impact. | Product is effectively unavailable or serving incorrect data. | Immediate operator escalation. | Forward-fix and rollback both evaluated. | Rollback requires explicit owner approval. |

`DOCUMENTED_OPERATING_RULE`: Automatic rollback is `NOT_AUTHORIZED`. `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md` §8 requires a dedicated correction or revert PR for material regressions. No automatic mechanism exists or is approved.

```text
automatic rollback: NOT_AUTHORIZED
```

---

## 6. Latency Buckets

`PROPOSED_FUTURE_CONTRACT`

These buckets are a proposed vocabulary. They are not currently collected. Domain-specific thresholds belong to a later child (#3673 Step 5).

| Bucket | Range |
|---|---|
| `LT_250_MS` | < 250 ms |
| `250_TO_999_MS` | 250 ms – 999 ms |
| `1_TO_2_999_S` | 1 000 ms – 2 999 ms |
| `3_TO_9_999_S` | 3 000 ms – 9 999 ms |
| `GE_10_S` | ≥ 10 000 ms |
| `TIMEOUT_OR_UNKNOWN` | Timeout reached or duration not measurable |

`OBSERVED_CURRENT_FACT`: The Modal fetch timeout in `functions/api/[[path]].js` is 25 000 ms. A Modal timeout therefore maps to `GE_10_S` or `TIMEOUT_OR_UNKNOWN` depending on whether the abort fires before or at the 25 s boundary.

Raw high-cardinality duration values (exact millisecond timestamps) must not be stored in durable summaries. Only the bounded bucket label is permitted.

---

## 7. Minimum Future Evidence Record

`PROPOSED_FUTURE_CONTRACT`

This section defines the minimum field contract for a future structured health evidence record. No collection is authorized.

| Field | Type | Bounded vocabulary | Required / Optional | Privacy rule | Example |
|---|---|---|---|---|---|
| `release_sha` | string (40-char hex) | Git SHA from `main` | Required | No provider deployment ID. No build log. | `8bf90816cfed8ce22be5cb8c3917356a99ae5fb8` |
| `observed_at_bucket` | string (enum) | `HOURLY`, `DAILY`, `WEEKLY`, `UNKNOWN` | Required | No exact timestamp in durable summaries. Exact timestamps permitted only in transient operator sessions. | `HOURLY` |
| `surface_or_domain` | string (enum) | One of the 10 domain identifiers from Section 2 | Required | Bounded enum only. | `SAME_ORIGIN_API` |
| `route_template_or_operation_code` | string (enum) | See bounded list below | Required | No raw URL. No query string. No arbitrary path. | `API_COMMUNITY_TREES_SUMMARY` |
| `status_class` | string (enum) | `HEALTHY`, `DEGRADED`, `FAILED`, `UNKNOWN`, `NOT_EXECUTED`, `NOT_APPLICABLE`, `BLOCKED_BY_AUTHORITY` | Required | Bounded enum only. | `HEALTHY` |
| `sanitized_error_code` | string (enum or `NONE`) | `LB_<DOMAIN>_<FAILURE_CLASS>` or `NONE` | Required | No embedded identifiers, URLs, or payload. `NONE` for healthy events. | `NONE` |
| `severity` | string (enum) | `INFO`, `WARNING`, `ERROR`, `CRITICAL` | Required | Bounded enum only. | `INFO` |
| `latency_bucket` | string (enum) | `LT_250_MS`, `250_TO_999_MS`, `1_TO_2_999_S`, `3_TO_9_999_S`, `GE_10_S`, `TIMEOUT_OR_UNKNOWN` | Optional | No raw duration value. | `LT_250_MS` |
| `evidence_source` | string (enum) | `CI_STATIC`, `CI_BROWSER_LOCAL`, `CI_PROCESS_LOCAL`, `CI_DB_ENGINE`, `MANUAL_SMOKE`, `MANUAL_CURL`, `PRODUCTION_OBSERVATION`, `FUTURE_INSTRUMENTATION` | Required | Bounded enum only. No provider log content. | `CI_BROWSER_LOCAL` |

### 7.1 Bounded route templates and operation codes

`PROPOSED_FUTURE_CONTRACT`

| Code | Surface |
|---|---|
| `ROUTE_HOME` | `/` (index) |
| `ROUTE_BROWSE` | `/pages/search` (Browse / 둘러보기) |
| `ROUTE_MY_TREES` | `/pages/my-trees` |
| `ROUTE_EDITOR` | `/pages/editor` |
| `ROUTE_SETTINGS` | `/pages/settings` |
| `ROUTE_LOGIN` | `/pages/login` |
| `ROUTE_DETAIL` | `/pages/detail` |
| `ROUTE_TREE` | `/pages/tree` |
| `ROUTE_INTRO` | `/pages/intro` |
| `API_COMMUNITY_TREES_SUMMARY` | `GET /api/community/trees?view=summary` |
| `API_COMMUNITY_MEMORIES_HYDRATE` | `GET /api/community/memories` |
| `API_COMMUNITY_GROWING_TREES` | `GET /api/community/growing-trees` |
| `OWNER_TREE_READ` | `GET /api/trees` (authenticated) |
| `OWNER_TREE_SAVE` | `POST /api/trees` |
| `OWNER_TREE_UPDATE` | `PUT /api/trees/:id` |
| `OWNER_TREE_DELETE` | `DELETE /api/trees/:id` |
| `OWNER_MEMORY_SAVE` | `POST /api/memories` |
| `OWNER_MEMORY_UPDATE` | `PUT /api/memories/:id` |
| `OWNER_MEMORY_DELETE` | `DELETE /api/memories/:id` |
| `OWNER_TREE_FORK` | `POST /api/trees/:id/fork` |
| `UPSTREAM_MODAL_HEALTH` | Modal `/modal/health` |
| `UPSTREAM_MODAL_BROWSE` | Modal `/modal/browse/latest` |

Raw URLs, arbitrary path strings, and query parameter values must not appear in the `route_template_or_operation_code` field.

---

## 8. Privacy, Redaction, and Cardinality Rules

`DOCUMENTED_OPERATING_RULE` (derived from `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` §4, `docs/ops/MVP_AGENT_GOVERNANCE.md` §Hard standing rules, `docs/ops/AGENTS.md`)

### 8.1 Fail-closed design principles

| Rule | Rationale |
|---|---|
| Route templates instead of raw URLs | Prevents query-parameter and identifier leakage. |
| Operation codes instead of arbitrary messages | Prevents user text and provider message leakage. |
| Timestamp buckets instead of exact event time | Reduces re-identification risk in durable summaries. |
| Bounded enum values only | Prevents unbounded cardinality and free-text injection. |
| Unknown values collapse to `UNKNOWN_SANITIZED` | Fail-closed: unrecognized signals are never passed through raw. |
| No raw stack traces in durable summaries | Stack traces may embed variable values, file paths, and user context. |
| No user-generated text | Titles, memos, descriptions, comments are private content. |
| No private identifiers | Firebase UID, `treeId`, `memoryId`, `commentId`, `reactionId` are private. |
| No pseudonymous hashes without separate approval | Hashed identifiers remain linkable and require explicit privacy review. |
| No headers, cookies, tokens, environment data | Credential and session exposure risk. |

### 8.2 Prohibited collection and storage

The following must never be collected, stored, logged, or transmitted in any health evidence record:

```text
raw request or response bodies
user-generated content (titles, memos, descriptions, comments)
private tree or memory data
Firebase UID
treeId
memoryId
commentId
reactionId
cookies
tokens (Firebase ID token, refresh token, custom token)
authorization headers
credentials
secrets
environment values (MODAL_BASE_URL, DATABASE_URL, LOVEBUD_UPSTREAM_ORIGIN)
database URLs
SQL statements or query parameters
provider payloads (Cloudflare, Modal, Firebase, Neon)
private logs
session replay data
keystrokes
```

### 8.3 Allowed diagnostic fields

`DOCUMENTED_OPERATING_RULE` (from `docs/ops/OBSERVABILITY_RUNTIME_LOGGING_AUDIT.md` §5.1):

| Field | Sensitivity |
|---|---|
| Generated request ID (`x-lovebud-request-id`) | Non-sensitive (`OBSERVED_CURRENT_FACT`: implemented in `functions/api/[[path]].js`) |
| Route template (bounded enum) | Non-sensitive |
| HTTP method | Non-sensitive |
| HTTP status code | Non-sensitive |
| Coarse error category (bounded enum) | Non-sensitive |
| Latency bucket (bounded enum) | Non-sensitive |
| Deployment label (`production` / `preview`) | Non-sensitive |
| Timestamp bucket (bounded enum) | Non-sensitive |
| Environment label (`cloudflare-pages` / `modal`) | Non-sensitive |

---

## 9. Domain Mapping Matrix

`PROPOSED_FUTURE_CONTRACT`

For healthy events, `sanitized_error_code` is `NONE`. No separate bounded value is required for the healthy case.

| Event | Domain | Status class | Sanitized error code | Severity | Latency bucket | Allowed evidence | Forbidden evidence |
|---|---|---|---|---|---|---|---|
| Home route HTTP 200 | `ROUTE_RESPONSE` | `HEALTHY` | `NONE` | `INFO` | `LT_250_MS` | HTTP status, route template `ROUTE_HOME`, `<body>` presence | Response body, HTML content, query parameters |
| Route HTTP 404 | `ROUTE_RESPONSE` | `FAILED` | `LB_ROUTE_RESPONSE_HTTP_4XX` | `ERROR` | `LT_250_MS` | HTTP status, route template | Raw URL, response body |
| Critical static asset HTTP 404 | `STATIC_ASSET` | `FAILED` | `LB_STATIC_ASSET_MISSING_ASSET` | `ERROR` | `LT_250_MS` | HTTP status, asset path template | Full asset URL with cache hash, CDN internals |
| Same-origin API HTTP 500 | `SAME_ORIGIN_API` | `FAILED` | `LB_SAME_ORIGIN_API_HTTP_5XX` | `ERROR` | varies | HTTP status, `x-lovebud-upstream`, operation code | Response body, stack trace, Modal logs |
| Malformed API response | `SAME_ORIGIN_API` | `DEGRADED` | `LB_SAME_ORIGIN_API_MALFORMED_RESPONSE` | `WARNING` | varies | HTTP status, `content-type` mismatch, operation code | Response body, partial JSON, field values |
| Fatal browser exception | `BROWSER_RUNTIME` | `FAILED` | `LB_BROWSER_RUNTIME_FATAL_CLIENT_ERROR` | `CRITICAL` | `TIMEOUT_OR_UNKNOWN` | Route template, bounded error category | Stack trace, variable values, DOM content, user text |
| Unhandled promise rejection | `BROWSER_RUNTIME` | `DEGRADED` | `LB_BROWSER_RUNTIME_UNHANDLED_REJECTION` | `ERROR` | `TIMEOUT_OR_UNKNOWN` | Route template | Stack trace, rejection reason, variable values |
| Owner route requires authentication | `AUTH_JOURNEY` | `DEGRADED` | `LB_AUTH_JOURNEY_AUTH_REQUIRED` | `WARNING` | `LT_250_MS` | HTTP 401, `x-lovebud-route-status: missing-authorization` | Token, cookie, Firebase UID, email |
| Authentication failure | `AUTH_JOURNEY` | `FAILED` | `LB_AUTH_JOURNEY_AUTH_FAILED` | `ERROR` | varies | HTTP 401, bounded auth stage | Token, Firebase UID, email, OAuth parameters |
| Permission denied | `OWNER_WRITE_JOURNEY` | `DEGRADED` | `LB_OWNER_WRITE_JOURNEY_PERMISSION_DENIED` | `WARNING` | `LT_250_MS` | HTTP 403, bounded entitlement category | Firebase UID, entitlement field values, user profile |
| Production serves stale release SHA | `DEPLOYMENT_ALIAS` | `FAILED` | `LB_DEPLOYMENT_ALIAS_STALE_RELEASE` | `CRITICAL` | `TIMEOUT_OR_UNKNOWN` | Expected SHA, observed serving state (bounded enum) | Cloudflare deployment ID, build log, dashboard content |
| Upstream unavailable | `UPSTREAM_DEPENDENCY` | `FAILED` | `LB_UPSTREAM_DEPENDENCY_UPSTREAM_UNAVAILABLE` | `ERROR` | `TIMEOUT_OR_UNKNOWN` | HTTP 503, `x-lovebud-degraded: modal-unavailable`, upstream enum | Database URL, connection string, Modal logs, env values |
| Rate limited | `OWNER_WRITE_JOURNEY` | `DEGRADED` | `LB_OWNER_WRITE_JOURNEY_RATE_LIMITED` | `WARNING` | `LT_250_MS` | HTTP 429, `RATE_LIMITED` code, `Retry-After` presence | User identifier, request body, counter values |
| Smoke not executed | `ROUTE_RESPONSE` | `NOT_EXECUTED` | `NONE` | `INFO` | `TIMEOUT_OR_UNKNOWN` | Smoke definition reference, execution state | N/A |
| Smoke blocked by authority | `ROUTE_RESPONSE` | `BLOCKED_BY_AUTHORITY` | `NONE` | `INFO` | `TIMEOUT_OR_UNKNOWN` | Governance rule reference, blocked reason category | N/A |
| Technical smoke healthy but visual concern exists | `ROUTE_RESPONSE` | `HEALTHY` | `NONE` | `INFO` | varies | Technical status `HEALTHY`, `SCREENSHOT_READY_FOR_CTO_UI_REVIEW` | `VISUAL_PASS`, `UI_APPROVED`, `BRAND_ALIGNED` (these are not technical signals) |

---

## 10. Current Versus Future Boundary

### 10.1 Current repository evidence

`OBSERVED_CURRENT_FACT`:

- Cloudflare Pages Functions proxy (`functions/api/[[path]].js`) returns bounded error responses with structured headers (`x-lovebud-upstream`, `x-lovebud-route-status`, `x-lovebud-degraded`, `x-lovebud-request-id`).
- Modal fetch timeout is 25 000 ms.
- Write body size is bounded to 128 KB.
- `modal_compute/social_errors.py` defines bounded social write error codes.
- `modal_compute/auth.py` defines `PlusRequiredError` for entitlement denial.
- `modal_compute/api_response_helpers.py` returns HTTP 400 for invalid JSON and HTTP 413 for oversized body.
- 12 `BROWSER_REAL_LOCAL` Playwright contracts execute in CI via `npm test` (`tests/ci-test-group-registry.json`).
- 15 `REMOTE_OR_PROVIDER_MANUAL` scripts do not execute in CI.
- `scripts/cloudflare-supplied-url-smoke.cjs` checks 3 routes against a supplied deployed URL (manual, not CI).
- `tests/smoke/routes.test.cjs` asserts file existence for core pages (static, no HTTP).

### 10.2 Current manual operating rules

`DOCUMENTED_OPERATING_RULE`:

- Post-merge Production verification is the normal final check (`docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`).
- Technical smoke and visual/product acceptance are separate (`docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`).
- CI classification uses exactly `CI_GREEN`, `CI_EXECUTED_FAILURE`, `CI_PENDING_EXECUTION`, `CI_UNAVAILABLE_INFRA` (`docs/ops/MVP_AGENT_GOVERNANCE.md`).
- Secret safety is a hard standing rule (`docs/ops/MVP_AGENT_GOVERNANCE.md`, `docs/ops/AGENTS.md`).

### 10.3 Proposed taxonomy (this document)

`PROPOSED_FUTURE_CONTRACT`:

- Evidence labels (Section 1).
- Runtime domains (Section 2).
- Sanitized error-code grammar (Section 3).
- Technical status classes (Section 4).
- Severity model (Section 5).
- Latency buckets (Section 6).
- Minimum future evidence record (Section 7).
- Privacy and redaction rules (Section 8).
- Domain mapping matrix (Section 9).

### 10.4 Future instrumentation (not implemented)

The following do not currently exist and are not authorized by this document:

```text
telemetry collection
browser error transport (window.onerror, unhandledrejection reporting)
central log aggregation
alerting
dashboard
release health automation
automatic stale-release detection
automatic rollback
cross-boundary trace ID propagation (beyond the existing x-lovebud-request-id header)
structured Production error reporting
operator-facing health summary generation
```

`UNRESOLVED`: Cloudflare Pages deployment status, Modal runtime logs, Firebase Auth events, and Neon database health are observable only through provider dashboards, which are outside repository evidence boundaries.

### 10.5 Future thresholds

`PROPOSED_FUTURE_CONTRACT` — belongs to #3673 Step 5. No quantitative thresholds (error rate, latency percentile, availability percentage) are defined in this document.

### 10.6 Future operator reporting

`PROPOSED_FUTURE_CONTRACT` — belongs to #3673 Step 6. No operator-facing summary format, report cadence, or aggregation script is defined in this document.

---

## 11. Relation to #3699

#3699 documents a Production deployment incident where `main` merged successfully while Production continued serving an older build.

```text
domain:
DEPLOYMENT_ALIAS

proposed code:
LB_DEPLOYMENT_ALIAS_STALE_RELEASE

current detection:
manual / unresolved

automatic detection:
NOT_AUTHORIZED / not implemented
```

`OBSERVED_CURRENT_FACT`: No mechanism exists to automatically detect a stale Production alias. There is no cron job, webhook listener, or periodic comparison of source SHA vs Production serving SHA (`docs/operations/RELEASE_SMOKE_RUNTIME_OBSERVABILITY_AUDIT.md` §8.1).

`DOCUMENTED_OPERATING_RULE`: The #3699 operating rule states: check Production once after merge; if stale, record observation and stop; no manual deployment or Cloudflare mutation without owner explicit request.

#3699 remains OPEN. This taxonomy does not resolve, close, or supersede #3699.

---

## 12. Ordered Follow-Up Child Plan

`PROPOSED_FUTURE_CONTRACT`

### Child 1 — Release-SHA and bounded route/static/API smoke contract

- **Scope:** Define how each `main` merge is annotated with its deploy SHA. List exact route and static-asset smoke targets with expected HTTP status and minimal DOM signals. Define the minimum smoke evidence record format.
- **Prerequisite:** This taxonomy document merged.
- **Exact evidence:** Repository document + contract test pair. No Cloudflare, Wrangler, Preview, Production, API, DB, or secret action.
- **Likely files:** `docs/ops/RELEASE_SHA_AND_SMOKE_CONTRACT.md`, `tests/contracts/release-sha-smoke-contract.test.cjs` (new files only).
- **Stop condition:** Document reviewed and merged. Contract test passes on `main`. #3699 referenced but not closed.
- **Not-authorized boundary:** No Cloudflare API call. No Wrangler deploy. No Production mutation. No automatic stale-detection cron.

### Child 2 — Critical journey success-state contract

- **Scope:** Define measurable success/failure signals for 3–5 critical journeys: home load, browse load, tree detail load, login, editor load. Define bounded journey-stage vocabulary.
- **Prerequisite:** Child 1 (release-SHA annotation) for correlation.
- **Exact evidence:** Design document defining journey stages, success criteria, and bounded failure categories. No implementation.
- **Likely files:** `docs/ops/CRITICAL_JOURNEY_SUCCESS_STATE_CONTRACT.md` (new file only).
- **Stop condition:** Document reviewed and merged. No runtime code changed.
- **Not-authorized boundary:** No browser instrumentation. No telemetry. No client JS modification.

### Child 3 — Health thresholds and forward-fix/rollback policy

- **Scope:** Define per-route and per-API health thresholds (error rate, latency percentile). Define stale-deployment detection criteria. Define escalation path and forward-fix vs rollback decision boundary.
- **Prerequisite:** Children 1 and 2 for data sources and journey definitions.
- **Exact evidence:** Policy document with bounded threshold vocabulary. No implementation.
- **Likely files:** `docs/ops/HEALTH_THRESHOLDS_AND_ESCALATION_POLICY.md` (new file only).
- **Stop condition:** Document reviewed and merged. Automatic rollback remains `NOT_AUTHORIZED`.
- **Not-authorized boundary:** No automatic rollback. No alerting integration. No provider dashboard mutation.

### Child 4 — Operator summary/report format

- **Scope:** Define the format for an operator-facing health summary that aggregates release SHA, smoke results, error taxonomy codes, and health thresholds into a single bounded report.
- **Prerequisite:** Children 1–3 for data sources, vocabulary, and thresholds.
- **Exact evidence:** Document or script design. No runtime implementation.
- **Likely files:** `docs/ops/OPERATOR_HEALTH_SUMMARY_FORMAT.md` (new file only).
- **Stop condition:** Document reviewed and merged. No automated report generation.
- **Not-authorized boundary:** No log aggregation. No dashboard. No third-party vendor.

### Child 5 — Separately approved instrumentation

- **Scope:** Implement the minimum instrumentation required to populate the evidence record defined in Section 7. Requires separate owner approval, privacy review, and security review before any code change.
- **Prerequisite:** Children 1–4 for vocabulary, thresholds, and report format. Separate owner approval. Privacy review. Security review.
- **Exact evidence:** Implementation PR with contract test proving zero private payload exposure (matching the pattern in `tests/contracts/gate-a-moment-social-write-smoke-runner-contract.test.cjs`).
- **Likely files:** `functions/api/[[path]].js` (structured logging only), `modal_compute/logging.py` (structured logging only), client error transport (new file, separately approved).
- **Stop condition:** Contract test passes. Zero private payload exposure proven. Owner approval recorded.
- **Not-authorized boundary:** No third-party error tracking vendor. No analytics script. No session replay. No broad Modal route rewrite. No DB schema change.

### Parallel work exclusion

This plan does not propose scope overlapping with:

- #3724 Home thumbnail (`js/index-inline-init.js`, `css/index/visual/growth-stage.css`, related test/registry files).
- #3720 CI isolation (`docs/architecture/CI_TEST_ISOLATION_HARDENING_DECISION.md`).
- #3721 search focus (`css/search/search-controls.css`, related contract test).
- #3722 Story readiness (`docs/product/MY_TREES_STORY_PARITY_READINESS_DECISION.md`).

---

*Refs #3725*
*Refs #3673 — Keep OPEN*
*Refs #3714 — completed*
*Refs #3699 — Keep OPEN*
*Refs #3670 — Keep OPEN*
*Refs #3672 — Keep OPEN*
*Refs #3425 — Keep OPEN*
*Refs #1882 — Keep OPEN*
