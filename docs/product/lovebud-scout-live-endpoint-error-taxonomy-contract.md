# LoveBud Scout Live Provider Endpoint Error Taxonomy Contract

## Endpoint Live Error Readiness Audit (slice update)

- endpoint error readiness audit added (`docs/product/lovebud-scout-live-endpoint-error-readiness-audit.md`)
- error taxonomy, safe-fail wiring, DI, and observability are aligned
- runtime Firebase / KV / provider API work remains blocked
- runtime dependency adapter skeleton (mock-disabled, no external calls) is the next recommended slice
- endpoint default remains stub
- UI default remains `local_stub`
- `tests/contracts/scout-live-endpoint-error-readiness-audit-contract.test.cjs` — focused error readiness audit

## Baseline

- **current main HEAD**: `cdcaf6d2`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **recently merged Scout PRs (auth/rate-limit track)**: #2276 / #2278 / #2280 / #2283 / #2285 / #2287 / #2289
- **related closed issues**: #2275, #2277, #2279, #2282, #2284, #2286, #2288
- **current open issues**: #1882 (Scout MVP), #1661 (Browse sorting / out of scope), #2234 (Scout live-provider prompt/response contract)
- **current live provider status**: provider-specific adapter skeleton + selection boundary + canonical auth/rate-limit runtime boundary + endpoint safe-fail wiring + injected dependency contract + sanitized observability contract all in place; no provider API call; staging_live and production_live remain blocked; real Firebase/KV/provider work remains blocked

## Document Status

- This document is a **contract-only** deliverable. It does not change runtime behavior.
- It locks the Scout live endpoint error taxonomy so that future real Firebase / KV / provider work can be slotted in without renegotiating error codes, HTTP statuses, or response shapes.

## Purpose

- 실제 Firebase / KV / provider API 구현 전에, Scout live endpoint의 error code, HTTP status, response body shape, retry-after policy, observability decision mapping을 고정한다.
- 이 문서는 구현이 아니라 contract이다.
- default live AI usage는 여전히 금지다.

## Non-goals

- No real LLM provider implementation
- No live provider API call
- No provider SDK imports
- No Firebase Admin SDK integration
- No real Firebase token verification
- No KV/Durable Object/D1 implementation
- No runtime persistent rate-limit storage call
- No external observability/logging backend integration
- No external URL fetching
- No crawler or metadata extraction
- No frontend default endpoint_client behavior change
- No source selector default change
- No backend/schema migration
- No automatic save
- No Browse #1661 work

## Error Categories

The Scout live endpoint organizes its errors into the following categories. Every canonical error code belongs to exactly one category.

| Category | Description |
|---|---|
| `request_validation` | Request shape, method, content-type, body size, JSON validity, and field-level validation failures |
| `auth` | Missing / malformed / rejected bearer token in the live path |
| `rate_limit` | Rate-limit decision outcomes (allowed / limited / unavailable) |
| `config` | Provider / runtime configuration that prevents live path from running |
| `provider_availability` | Live provider is disabled or adapter is not yet wired |
| `provider_response` | Provider returned an error or the adapter interface reports a non-success state |
| `output_safety` | Output was rejected by a safety filter (placeholder for a future slice) |
| `observability` | Internal observability event emission (never returned to the client; safe-swallowed) |
| `internal_boundary` | Unexpected boundary / runtime failures (kept for contract completeness) |

## Canonical Error Codes

| Error Code | Category | Description |
|---|---|---|
| `INVALID_REQUEST` | request_validation | The request did not match the documented request shape (mirrors `VALIDATION_ERROR` from existing endpoint code) |
| `VALIDATION_ERROR` | request_validation | Field-level validation failure (length, language code, tone, etc.) |
| `AUTH_REQUIRED` | auth | Live path was reached without an `Authorization` header |
| `AUTH_INVALID` | auth | Authorization header is malformed, scheme is wrong, token is empty, token is rejected, or no verifier is wired |
| `RATE_LIMITED` | rate_limit | Limiter returned `allowed: false` with a positive `retryAfterSeconds` |
| `RATE_LIMIT_UNAVAILABLE` | rate_limit | Limiter is not configured, threw, or returned an invalid result; auth failed before limiter was called |
| `CONFIG_MISSING` | config | Required provider env vars are missing |
| `PROVIDER_UNAVAILABLE` | provider_availability | Provider adapter is disabled or not yet connected |
| `PROVIDER_ERROR` | provider_response | Provider returned a non-success state (placeholder; future slice) |
| `OUTPUT_SAFETY_BLOCKED` | output_safety | Output was rejected by a safety filter (placeholder; future slice) |
| `OBSERVABILITY_UNAVAILABLE` | observability | Observability event emission failure (never returned to the client) |
| `INTERNAL_BOUNDARY_ERROR` | internal_boundary | Unexpected boundary / runtime failure (500) |

## HTTP Status Mapping

The Scout live endpoint follows the convention below. Numbers in **bold** are the values that the current `suggest.js` LIVE branch actually returns today; other numbers are the contracted target values that future slices must preserve.

| Error Code | HTTP Status | Notes |
|---|---|---|
| `INVALID_REQUEST` | **400** (or **405** for method, **413** for body size) | method/JSON/header validation |
| `VALIDATION_ERROR` | **400** | field-level validation |
| `AUTH_REQUIRED` | **401** | live path requires bearer token |
| `AUTH_INVALID` | **401** | malformed or rejected token |
| `RATE_LIMITED` | **429** | includes `Retry-After` header when `retryAfterSeconds > 0` |
| `RATE_LIMIT_UNAVAILABLE` | **503** | boundary could not run a real check |
| `CONFIG_MISSING` | **503** | required env vars missing |
| `PROVIDER_UNAVAILABLE` | **503** | adapter disabled or not wired |
| `PROVIDER_ERROR` | **502** (contracted) | provider returned a non-success state |
| `OUTPUT_SAFETY_BLOCKED` | **422** (contracted) | output was rejected by a safety filter |
| `OBSERVABILITY_UNAVAILABLE` | n/a (never returned) | safe-swallowed before response is built |
| `INTERNAL_BOUNDARY_ERROR` | **500** (contracted) | unexpected runtime failure |

## Response Body Shape

All error responses follow this shape. The body is JSON with `charset=utf-8`.

```json
{
  "ok": false,
  "providerMode": "live",
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Scout live auth requires a Bearer token."
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `ok` | `false` | yes | literal `false` on error |
| `providerMode` | `"live"` | yes | always `"live"` for live-mode error responses; stub path uses `"stub"` in success responses |
| `error.code` | string | yes | one of the canonical error codes above |
| `error.message` | string | yes | safe user-facing message; never contains raw token / API key / prompt / excerpt / full sourceUrl / raw request body / raw provider output / PII / credentials |

## Response Headers

| Header | When Present | Notes |
|---|---|---|
| `content-type` | always | `application/json; charset=utf-8` |
| `x-lovebud-request-id` | always | request id; safe characters only |
| `x-lovebud-upstream` | always | `cloudflare` (current convention) |
| `x-lovebud-route-status` | always on error | lowercase, dash-separated error code (e.g. `auth-required`, `rate-limited`, `rate-limit-unavailable`, `config-missing`, `provider-unavailable`) |
| `retry-after` | `RATE_LIMITED` only, when `retryAfterSeconds > 0` | integer seconds; the value comes from the limiter's `retryAfterSeconds` |

Sensitive data prohibition applies to **all** response headers and bodies: no raw token, no API key, no prompt, no excerpt, no full sourceUrl, no raw request body, no raw provider output, no credentials, no PII.

## Retry-After Policy

- `Retry-After` is **only** emitted on `RATE_LIMITED` responses, and **only** when the limiter returned a positive `retryAfterSeconds`.
- The value is an integer (seconds) and is bounded by what the limiter returned. The boundary floors it to a non-negative integer.
- `RATE_LIMIT_UNAVAILABLE`, `CONFIG_MISSING`, `PROVIDER_UNAVAILABLE`, `OUTPUT_SAFETY_BLOCKED`, `INTERNAL_BOUNDARY_ERROR` responses **do not** include `Retry-After`. The client may retry later based on its own policy, but the endpoint does not promise a specific delay.

## Observability Mapping

The endpoint's sanitized observability events (see `live-auth-rate-limit-observability.js`) record the decision behind every error. The mapping below locks the relationship between HTTP response error codes and observability event fields.

| HTTP Error Code | `boundaryDecision` | `authStatus` | `rateLimitStatus` | `errorCode` |
|---|---|---|---|---|
| `AUTH_REQUIRED` | `auth_required` | `auth_required` | `null` | `AUTH_REQUIRED` |
| `AUTH_INVALID` | `auth_invalid` | `auth_invalid` | `null` | `AUTH_INVALID` |
| `RATE_LIMITED` | `rate_limited` | `authenticated` | `rate_limited` | `RATE_LIMITED` |
| `RATE_LIMIT_UNAVAILABLE` | `rate_limit_unavailable` | `authenticated` (or upstream auth status) | `rate_limit_unavailable` | `RATE_LIMIT_UNAVAILABLE` |
| `CONFIG_MISSING` | (no observability event) | n/a | n/a | n/a |
| `PROVIDER_UNAVAILABLE` | (no observability event) | n/a | n/a | n/a |
| `PROVIDER_ERROR` | (no observability event) | n/a | n/a | n/a |
| `OUTPUT_SAFETY_BLOCKED` | (no observability event) | n/a | n/a | n/a |
| `OBSERVABILITY_UNAVAILABLE` | n/a | n/a | n/a | n/a (safe-swallowed; never reaches client) |
| `INTERNAL_BOUNDARY_ERROR` | (no observability event) | n/a | n/a | n/a |

Only auth and rate-limit decisions are currently emitted as observability events. Future slices may extend this matrix to include provider and safety events, but the auth/rate-limit mapping is locked by this contract.

## Dependency Adapter Skeleton Status

A [dependency adapter skeleton](lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveDependencyAdapter`) returning default `verifyToken` / `checkRateLimit` / `requestId`
- Default `mockDisabled:true` so the endpoint cannot accidentally allow real traffic in skeleton mode
- No real Firebase Admin SDK, no real KV/DO/D1, no provider SDK, no fetch
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Dependency Adapter Endpoint Wiring Status

The dependency adapter skeleton is now wired into `functions/api/scout/suggest.js` LIVE branch (v20260607-1, wiring slice):
- `suggest.js` imports `createScoutLiveDependencyAdapter` from `live-auth-rate-limit-dependency-adapter.js`
- Wiring is **live-branch-only** (only inside `providerConfig.providerMode === "live"`)
- Default stub path and explicit stub path do NOT use the adapter
- Live mode uses the mock-disabled adapter by default (fail-closed)
- Tests can inject a real adapter via `context.liveAdapter` or `context.liveDependencies`
- Legacy direct DI (`context.verifyToken` / `context.checkRateLimit`) still works alongside the new injection
- When no real limiter is configured, the boundary's "rate-limit unavailable" safe-fail path fires (RATE_LIMIT_UNAVAILABLE / 503), preserving the existing taxonomy
- Observer safe-swallow remains
- Endpoint default `providerMode:"stub"`, frontend default `local_stub`, and endpoint client default disabled are all unchanged
- Real Firebase Admin SDK, real KV/DO/D1, provider SDK, and fetch are still NOT used
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Sensitive Data Prohibition

The following are **prohibited** from any response header, response body, or observability event payload:

- raw `Authorization` token
- raw API key value (any provider)
- prompt text
- excerpt text
- full `sourceUrl` (including query string)
- raw request body
- raw provider output
- user email / phone / address / PII
- Firebase / Cloudflare / Modal / Neon / signing credentials
- password / secret / cookie / session token / private key fields

Any error response that violates this contract is considered a regression. Test fixtures use `TEST_FIXTURE_*_NOT_A_REAL_SECRET_*` markers to keep GitGuardian from flagging obviously-fake strings.

## Default Behavior Guardrails

| Guardrail | Status |
|---|---|
| Endpoint default `providerMode` is `"stub"` | ✅ preserved |
| Explicit stub (`SCOUT_SUGGEST_PROVIDER_MODE=stub`) returns `providerMode: "stub"` | ✅ preserved |
| Frontend default `local_stub` | ✅ preserved |
| Endpoint client default disabled | ✅ preserved |
| Default stub does not call boundary | ✅ preserved |
| Explicit stub does not call boundary | ✅ preserved |
| Live mode invokes boundary | ✅ preserved |
| `staging_live` execution | ❌ blocked (no real backends) |
| `production_live` execution | ❌ blocked (no real backends) |
| Real provider API call | ❌ blocked (no real backends) |

## Audit Anchor

This document builds on top of the readiness audit (see `docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`). All five readiness verifications are reproduced here for clarity.

| Workstream | Verdict | Rationale |
|---|---|---|
| Endpoint live auth/rate-limit runtime boundary skeleton | **GO** | MERGED #2278 + #2280 |
| Endpoint safe-fail wiring | **GO** | MERGED #2283 |
| Endpoint injected dependency contract | **GO** | MERGED #2285 |
| Sanitized observability contract | **GO** | MERGED #2287 |
| Endpoint error taxonomy contract | **GO** | this slice |
| Real Firebase auth verifier implementation | **NO-GO** | no Firebase Admin SDK in repo |
| Persistent rate-limit store (KV / DO / D1) | **NO-GO** | no real storage in repo |
| Real observability backend | **NO-GO** | observer seam only |
| Provider-specific live adapter (real call) | **NO-GO** | inert by design |
| `staging_live` execution | **NO-GO** | all real backends are NO-GO |
| `production_live` execution | **NO-GO** | all real backends are NO-GO |
| Real provider API call | **NO-GO** | no provider SDK; no real call path enabled |

## Audited Test Files (all required to keep passing)

```text
tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs (this slice)
tests/contracts/scout-live-auth-rate-limit-readiness-audit-contract.test.cjs (16/16)
tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs (24/24)
tests/contracts/scout-live-auth-rate-limit-endpoint-di-contract.test.cjs (20/20)
tests/contracts/scout-live-auth-rate-limit-endpoint-safe-fail-wiring-contract.test.cjs (20/20)
tests/contracts/scout-live-auth-rate-limit-boundary-reconcile-contract.test.cjs (13/13)
tests/contracts/scout-live-auth-rate-limit-runtime-boundary-contract.test.cjs (28/28)
tests/contracts/scout-provider-specific-adapter-selection-boundary-contract.test.cjs
tests/contracts/scout-provider-specific-adapter-skeleton-contract.test.cjs
tests/contracts/scout-live-provider-auth-rate-limit-boundary.test.cjs
tests/contracts/scout-live-provider-production-readiness-gates-audit-contract.test.cjs
tests/contracts/scout-live-provider-staging-rollout-contract.test.cjs
tests/contracts/scout-real-provider-mock-executor-integration-contract.test.cjs
tests/contracts/scout-real-provider-disabled-endpoint-contract.test.cjs
tests/contracts/scout-real-provider-adapter-interface-contract.test.cjs
```

## Related Documents

- `docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`
- `docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md`
- `docs/product/lovebud-scout-serverless-endpoint-boundary.md`
- `docs/product/lovebud-scout-llm-provider-boundary.md`
- `docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`
- `docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`
- `docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md`
- `docs/product/lovebud-scout-live-provider-readiness-audit.md`

## Runtime Adapter Implementation Gate Status

The live auth/rate-limit runtime adapter implementation gate contract
has been added as a docs+tests-only slice (v20260607-1, gate contract
slice, no runtime code change):

- A new gate contract document has been added:
  `docs/product/lovebud-scout-live-auth-rate-limit-runtime-adapter-implementation-gate-contract.md`
- The gate locks 8 surfaces as forbidden until the gate is satisfied:
  - real Firebase Admin SDK
  - real external auth service
  - real KV / Durable Object / D1 storage
  - real external observability backend
  - real provider API call
  - `staging_live` opt-in
  - `production_live` opt-in
  - parallel `live-provider-auth-rate-limit-boundary.js` adoption
- The gate requires 11 pre-implementation evidence items to exist on
  `main` before any of the 8 surfaces can be unlocked
- The gate requires 5 ordered implementation steps
  (plan verifier → plan storage → one disabled-by-default impl →
  staging smoke → staging opt-in)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
- The 4 runtime files remain locked by md5 normalized for LF/CRLF
  (cross-platform stable): dep-adapter `796a2aef…`, verifier
  `5a0a8534…`, storage `a4419b1e…`, suggest `deb6a6d7…`
- This gate slice is docs+tests only; no runtime code change
- Recommended next slice: `[PRODUCT] Plan Scout runtime Firebase
  auth verifier implementation` (or `[PRODUCT] Plan Scout runtime
  rate-limit storage implementation`)
- Verdict: gate contract locked: **Yes**; all 8 surfaces
  (Firebase Admin SDK / external auth / KV / DO / D1 / external
  observability / provider API / `staging_live` / `production_live`
  / parallel boundary): **No** (all blocked)

## Runtime Observability Policy Audit Status

The Scout runtime observability policy audit has been added as a
docs+tests-only slice (v20260607-1, audit slice, no runtime code
change, no external observability backend, no live metrics sink,
no live alerting pipeline):

- A new audit document has been added:
  `docs/product/lovebud-scout-runtime-observability-policy-audit.md`
- The audit satisfies **gate evidence 11 of 11** in the runtime
  adapter implementation gate contract
- After this audit, all 11 gate evidence items are now complete;
  gate step 3 (one disabled-by-default runtime adapter
  implementation scaffold) may begin
- The audit defines the safe event schema for all 10 observability
  surfaces (endpoint request lifecycle / auth verifier / rate-limit
  storage / provider adapter / error taxonomy / rollback /
  cost-quota / staging_live / production_live / incident
  response)
- The audit defines the allowed observability field allowlist
  (17 safe fields: requestId / providerMode / endpointPath /
  errorCode / safeStatus / latencyMs / retryAfterSeconds /
  quotaBucket / decisionId / adapterKind / mockDisabled /
  environmentLabel / severity / retryCount / maxRetries /
  timeoutMs / eventType)
- The audit defines the prohibited observability fields (raw
  token / authorization / firebaseToken / API key / secret /
  service account / prompt / excerpt / sourceUrl / raw request
  body / raw provider response / raw Firebase claims / raw
  decoded token / raw storage key / raw UID / email / raw IP /
  cookie / sessionCookie)
- The audit defines:
  - safe event schema (base / auth / rate-limit / provider /
    rollback / cost / staging / production / incident)
  - error taxonomy alignment (AUTH_REQUIRED / AUTH_INVALID /
    RATE_LIMITED / RATE_LIMIT_UNAVAILABLE /
    RATE_LIMIT_PAYLOAD_PROHIBITED /
    RATE_LIMIT_STORAGE_UNAVAILABLE / PROVIDER_UNAVAILABLE /
    CONFIG_MISSING / PROVIDER_ERROR / VALIDATION_ERROR)
  - privacy / safety policy (safe metadata only / no sensitive
    payload capture / no replay of sensitive payloads / no raw
    source material / no prompt/excerpt/sourceUrl logging / no
    token/API key/service account logging)
  - external observability backend policy (not implemented /
    disabled-by-default / environment-gated / independent
    kill-switch / fail closed or silently drop telemetry / must
    not block endpoint response / must not change endpoint
    response body / must not auto-save data)
  - alerting policy (no alerts implemented / future alerts
    sanitized fields only / alert thresholds documented before
    staging_live / alert messages no sensitive values)
  - incident observability policy (safe IDs/hashes only / no raw
    token/API key/prompt/sourceUrl in incident reports /
    sensitive logging suspected disables external backend first
    / rollback decision trace safe fields only)
  - rollback / kill-switch alignment (observability backend
    independent kill-switch / rollback events safe / kill-switch
    activation no secrets / fallback baseline stub/local_stub)
  - required future tests (observer safe-swallow / external
    backend disabled by default / external backend kill-switch
    prevents export / no sensitive fields in emitted events / no
    prompt/excerpt/sourceUrl in events / no raw token/API
    key/service account in events / endpoint response unaffected
    by observer failures / no provider API call from
    observability / no storage/auth call from observability /
    docs examples safe fake metadata only)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - external observability backend not integrated
  - live alerting pipeline not implemented
- The 4 runtime files remain locked by md5 normalized for
  LF/CRLF (cross-platform stable): dep-adapter `796a2aef…`,
  verifier `5a0a8534…`, storage `a4419b1e…`, suggest
  `deb6a6d7…`
- This audit slice is docs+tests only; no runtime code change,
  no external observability backend integration, no live metrics
  sink, no live tracing sink, no live alerting sink, no
  Firebase Admin SDK import, no KV / Durable Object / D1
  implementation, no provider API call
- Recommended next slice: `[TECH] Add one disabled-by-default
  runtime adapter implementation scaffold` (gate step 3, still
  scaffold, not a real production live implementation)
- Verdict: runtime observability policy audit: **Yes**; gate
  evidence 11 of 11 complete after this audit: **Yes**; real
  external observability backend in this PR: **No**; real
  alerting in this PR: **No**; real Firebase Admin SDK in this
  PR: **No**; real KV / Durable Object / D1 in this PR: **No**;
  real provider API in this PR: **No**; `staging_live` /
  `production_live` opt-in in this PR: **No** (all blocked)

## Firebase Auth Verifier Disabled Scaffold Status

The first disabled-by-default runtime adapter implementation
scaffold for the Scout Firebase auth verifier has been added as a
scaffold slice (v20260607-1, scaffold slice, no real Firebase
Admin SDK, no real token verification, no endpoint default live
behavior):

- The auth verifier adapter
  (`functions/api/scout/live-auth-verifier-adapter.js`) has been
  extended with a future Firebase scaffold mode
- New mode constants: `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES`
  now includes `FIREBASE_DISABLED` and `FIREBASE_CONFIG_MISSING`
- New response code constants:
  `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES` now includes
  `VERIFIER_FIREBASE_DISABLED` and `VERIFIER_CONFIG_MISSING`
- The factory `createScoutLiveAuthVerifierAdapter(options)` now
  accepts an optional `verifierMode` option that, combined with
  `mockDisabled: false`, selects one of the Firebase scaffold
  branches
- The Firebase scaffold branches safe-fail with
  `VERIFIER_FIREBASE_DISABLED` or `VERIFIER_CONFIG_MISSING`
  without importing or calling the Firebase Admin SDK, without
  verifying any token, and without reading any env / secret
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({})` default behavior
  (`mockDisabled: true`, `mode: MOCK_DISABLED`,
  `code: VERIFIER_MOCK_DISABLED`)
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({ mockDisabled: false })`
  behavior (`mode: NOT_IMPLEMENTED`,
  `code: VERIFIER_NOT_IMPLEMENTED`)
- Module import remains side-effect-free: no Firebase init, no
  token verify, no storage call, no provider call, no env read
- No Firebase Admin SDK import (`firebase-admin`,
  `firebase-admin/app`, `firebase-admin/auth`)
- No `getAuth` / `verifyIdToken` / `verifyAccessToken` /
  `cert` / `initializeApp` call
- No fetch / XMLHttpRequest / axios
- No KV / Durable Object / D1 / database access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No `process.env` / `import.meta.env` / `env.SCOUT_*` /
  `env.FIREBASE_*` reads
- No raw token / authorization header / API key / firebaseToken
  in any response, log, or storage payload
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - explicit stub path (`providerMode: "stub"`) unchanged
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - dependency adapter behavior unchanged
  - `suggest.js` unchanged
- The 3 locked runtime files (dep-adapter, storage, suggest)
  remain locked by md5 normalized for LF/CRLF (cross-platform
  stable). The auth verifier adapter is intentionally modified
  in this scaffold slice (it gets the new Firebase scaffold
  code) and is therefore NOT in the lock list
- This scaffold slice is disabled-by-default and safe-fail
  only; no real Firebase Admin SDK, no real token verification,
  no real external auth service call, no real provider API call,
  no real KV / Durable Object / D1 implementation
- Recommended next slice: `[TECH] Wire disabled Firebase auth
  verifier scaffold into dependency adapter contract` or
  `[TECH] Add disabled rate-limit storage runtime scaffold`
- Verdict: Firebase auth verifier disabled scaffold: **Yes**;
  real Firebase Admin SDK in this PR: **No**; real token
  verification in this PR: **No**; real external auth service
  call in this PR: **No**; real provider API in this PR:
  **No**; real KV / Durable Object / D1 in this PR: **No**;
  `staging_live` / `production_live` opt-in in this PR: **No**
  (all blocked)

## Firebase Auth Verifier Disabled Scaffold Readiness Audit Status

A CTO review / readiness audit (v20260607-1) has been added for the
first disabled-by-default runtime adapter implementation scaffold
(Scout Firebase auth verifier). The audit is docs+tests only — no
runtime behavior change. Findings:

- The scaffold remains disabled-by-default and safe-fail only
- The scaffold is **not** a real Firebase implementation
- The scaffold does **not** import `firebase-admin`
- The scaffold does **not** perform real token verification
- The dependency adapter and `suggest.js` remain unchanged
- The endpoint default `providerMode: "stub"` is preserved
- The explicit stub path is preserved
- The frontend default `local_stub` is preserved
- The endpoint client default disabled state is preserved
- The locked runtime files remain locked by LF/CRLF-normalized
  md5 (verifier `81f80368…`, dep-adapter `796a2aef…`, storage
  `a4419b1e…`, suggest `deb6a6d7…`)
- Recommended next slice:
  `[TECH] Wire disabled Firebase auth verifier scaffold into
  dependency adapter contract`
- Verdict: CTO review / readiness audit complete: **Yes**; real
  Firebase Admin SDK: **No**; real token verification: **No**;
  `staging_live` / `production_live` opt-in: **No** (all blocked)
