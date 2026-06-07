# LoveBud Scout Live Endpoint Error Readiness Audit (Before Runtime Auth/KV Work)

## Baseline

- **current main HEAD**: `42606f63`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **recently merged Scout PRs (endpoint live track)**: #2276 / #2278 / #2280 / #2283 / #2285 / #2287 / #2289 / #2291
- **related closed issues**: #2275, #2277, #2279, #2282, #2284, #2286, #2288, #2290
- **current open issues**: #1882 (Scout MVP), #1661 (Browse sorting / out of scope), #2234 (Scout live-provider prompt/response contract)
- **current live provider status**: provider-specific adapter skeleton + selection boundary + canonical auth/rate-limit runtime boundary + endpoint safe-fail wiring + injected dependency contract + sanitized observability contract + endpoint error taxonomy contract all in place; no provider API call; staging_live and production_live remain blocked; real Firebase/KV/provider work remains blocked

## Document Status

- This document is an **audit-only** deliverable. It does not change runtime behavior.
- It is the readiness gate before any runtime Firebase auth adapter or KV/DO/D1 rate-limit adapter work.
- A runtime dependency adapter skeleton slice (mock-disabled, no external calls) may follow this audit; real Firebase / KV / provider work remains blocked.

## Audit Purpose

- 실제 Firebase auth adapter 또는 KV/DO/D1 rate-limit adapter 구현에 들어가기 전에, 지금까지 endpoint live auth/rate-limit 쪽에 들어간 다음 요소들이 충분히 정렬되었는지 통합 점검한다.
- runtime dependency adapter skeleton (mock-disabled, no external calls)을 다음 권장 slice로 제시한다.
- 이 문서는 구현이 아니라 audit이다.
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

## Current State Summary

| Slice | Status | Result |
|---|---|---|
| #2276 — Provider-specific adapter selection boundary | Done | MERGED `41ad6b43` |
| #2278 — Auth/rate-limit runtime boundary skeleton | Done | MERGED `aba0bbe1` |
| #2280 — Reconcile canonical vs parallel | Done | MERGED `06aa2563` |
| #2283 — Endpoint safe-fail wiring | Done | MERGED `017179ca` |
| #2285 — Endpoint DI contract | Done | MERGED `f76b45bb` |
| #2287 — Endpoint observability contract | Done | MERGED `2a3bf2bd` |
| #2289 — Endpoint auth/rate-limit readiness audit | Done | MERGED `cdcaf6d2` |
| #2291 — Endpoint error taxonomy contract | Done | MERGED `42606f63` |
| Runtime dependency adapter skeleton (mock-disabled) | **Conditional next** | this audit unblocks the slice |
| Real Firebase auth verifier | **No** | blocked |
| Persistent rate-limit adapter (KV / DO / D1) | **No** | blocked |
| staging_live execution | **No** | blocked |
| production_live execution | **No** | blocked |
| Real provider API call | **No** | blocked |

## Implemented Endpoint Error/Auth Boundary Inventory

| Boundary | Status | Evidence |
|---|---|---|
| Canonical auth/rate-limit runtime boundary skeleton | Pass | `functions/api/scout/live-auth-rate-limit-boundary.js` (398 lines, v20260607-1) |
| Reconcile decision (canonical vs parallel) | Pass | `tests/contracts/scout-live-auth-rate-limit-boundary-reconcile-contract.test.cjs` (13/13) |
| Endpoint live safe-fail wiring | Pass | `tests/contracts/scout-live-auth-rate-limit-endpoint-safe-fail-wiring-contract.test.cjs` (20/20) |
| Injected dependency contract | Pass | `tests/contracts/scout-live-auth-rate-limit-endpoint-di-contract.test.cjs` (20/20) |
| Sanitized observability contract | Pass | `functions/api/scout/live-auth-rate-limit-observability.js` (257 lines) + `tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` (24/24) |
| Endpoint auth/rate-limit readiness audit | Pass | `docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md` (195 lines) + `tests/contracts/scout-live-auth-rate-limit-readiness-audit-contract.test.cjs` (16/16) |
| Endpoint error taxonomy contract | Pass | `docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md` (240 lines) + `tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs` (24/24) |
| Endpoint default stub preserved | Pass | `suggest.js` default `providerMode:"stub"` |
| Frontend default `local_stub` preserved | Pass | `js/scout/scout-suggestion-source-selector.js` default `LOCAL_STUB: 'local_stub'` |
| Endpoint client default disabled preserved | Pass | `js/scout/scout-suggestion-endpoint-client.js` does NOT import boundary / observability / DI seam / taxonomy |
| Real Firebase Admin SDK | Not implemented | (correct: blocked) |
| Real KV / Durable Object / D1 | Not implemented | (correct: blocked) |
| Real provider API call | Not implemented | (correct: blocked) |

## Confirmed Endpoint Behavior

The following endpoint behaviors are now locked across the canonical boundary, the endpoint wiring, the observability contract, and the error taxonomy contract.

| Scenario | Error Code | HTTP Status | Response Shape | Confirmed By |
|---|---|---|---|---|
| Default stub (no env override) | n/a (success) | 200 | `{ ok: true, providerMode: "stub", suggestion: {...} }` | observability / DI / wiring / taxonomy tests |
| Explicit stub (`SCOUT_SUGGEST_PROVIDER_MODE=stub`) | n/a (success) | 200 | `{ ok: true, providerMode: "stub", suggestion: {...} }` | observability / DI / wiring / taxonomy tests |
| Live mode + missing `Authorization` header | `AUTH_REQUIRED` | **401** | `{ ok: false, providerMode: "live", error: { code, message } }` | observability / wiring / taxonomy tests |
| Live mode + malformed `Authorization` header | `AUTH_INVALID` | **401** | same shape | observability / wiring / taxonomy tests |
| Live mode + auth ok + missing limiter | `RATE_LIMIT_UNAVAILABLE` | **503** | same shape (no Retry-After) | observability / DI / wiring / taxonomy tests |
| Live mode + auth ok + limiter rejects | `RATE_LIMITED` | **429** | same shape + `Retry-After: <seconds>` | observability / wiring / taxonomy tests |
| Live mode + auth ok + limiter allows + provider missing env | `CONFIG_MISSING` | **503** | same shape | wiring / taxonomy tests |
| Live mode + auth ok + limiter allows + provider disabled | `PROVIDER_UNAVAILABLE` | **503** | same shape | wiring / taxonomy tests |
| Live mode + auth ok + limiter allows + adapter READY | `PROVIDER_UNAVAILABLE` (safe-fail placeholder) | **503** | same shape | wiring / taxonomy tests |
| Live mode + observer throws | (no change) | unchanged | unchanged | observability / taxonomy tests |
| Default stub observer skip | n/a | n/a | observer NOT called | observability / taxonomy tests |
| Explicit stub observer skip | n/a | n/a | observer NOT called | observability / taxonomy tests |

## Confirmed Privacy / Safety Behavior

| Guardrail | Status | Confirmed By |
|---|---|---|
| No raw token in response body | Confirmed | DI test #11 / observability test #12 / taxonomy test #14 |
| No API key value in response body | Confirmed | DI test #11 / observability test #13 / taxonomy test #14 |
| No prompt / excerpt in response body | Confirmed | taxonomy test #14 |
| No full `sourceUrl` in response body | Confirmed | taxonomy test #14 |
| No raw token / API key / prompt / excerpt / `sourceUrl` in observability event | Confirmed | observability test #12-#14 / taxonomy test #14 |
| No raw token / API key / prompt / excerpt / `sourceUrl` in limiter payload | Confirmed | observability test #15 / DI test #9-#10 / taxonomy test #14 |
| No raw token / API key / credentials in response headers | Confirmed | taxonomy test #14 (body check; headers are an open regression target) |
| No Firebase Admin SDK in scout source | Confirmed | observability / DI / wiring / taxonomy / readiness audit / this audit tests |
| No KV / Durable Object / D1 runtime access | Confirmed | observability / DI / wiring / taxonomy / readiness audit / this audit tests |
| No provider SDK imports | Confirmed | observability / DI / wiring / taxonomy / readiness audit / this audit tests |
| No fetch / XHR / axios | Confirmed | observability / DI / wiring / taxonomy / readiness audit / this audit tests |

## Go / No-Go Matrix

| Workstream | Verdict | Rationale |
|---|---|---|
| Endpoint error taxonomy contract | **GO** | MERGED #2291; 24 focused tests pass |
| Endpoint auth/rate-limit safe-fail wiring | **GO** | MERGED #2283; 20 focused tests pass |
| Endpoint injected dependency contract | **GO** | MERGED #2285; 20 focused tests pass |
| Sanitized observability contract | **GO** | MERGED #2287; 24 focused tests pass |
| Endpoint auth/rate-limit readiness audit | **GO** | MERGED #2289; 16 focused tests pass |
| Runtime auth/rate-limit **dependency adapter skeleton** (mock-disabled, no external calls) | **CONDITIONAL GO** | this audit unblocks the slice; must be mock-disabled and must not call any external API |
| Runtime **real** Firebase auth verifier | **NO-GO** | no Firebase Admin SDK in repo; admin SDK integration is a separate workstream |
| Runtime **real** persistent rate-limit store (KV / DO / D1) | **NO-GO** | no KV / DO / D1 access; persistent storage is a separate workstream |
| Runtime real observability / logging backend | **NO-GO** | observer seam is in place but no backend integration is added |
| Provider-specific live adapter (real call) | **NO-GO** | selection boundary is inert by design |
| `staging_live` execution | **NO-GO** | all real backends above are NO-GO |
| `production_live` execution | **NO-GO** | all real backends above are NO-GO |
| Real provider API call | **NO-GO** | no provider SDK; no real call path is enabled |

## Remaining Blockers

The following are intentionally **not yet implemented** and block any real runtime work:

1. **Real Firebase auth verifier** — the canonical boundary's `context.verifyToken` is currently `undefined` in production. A Firebase Admin SDK verifier (or alternative IdP verifier) must be wired in before `staging_live`.
2. **Persistent rate-limit adapter** — the canonical boundary's `context.checkRateLimit` is currently `undefined` in production. A real KV / Durable Object / D1 backed limiter must be wired in before `staging_live`.
3. **Production quota backend** — no quota policy is in place; the observability contract emits `quotaBucket` and `latencyMs` but they are not yet consumed by a real backend.
4. **Real observability backend** — the in-memory ring buffer is test-only. A real observability backend (e.g. durable log sink, structured log forwarder) is not wired.
5. **Provider-specific live adapter** — the selection boundary is inert; no provider-specific adapter is enabled.
6. **Staging soak** — no real LLM traffic has been observed in staging; no latency / cost / quota baseline exists.
7. **Kill-switch drill result** — no staged or production kill-switch drill has been performed.
8. **Secret rotation drill result** — no staged or production secret-rotation drill has been performed.

## Recommended Next Slice

| Candidate | Rationale |
|---|---|
| `[TECH] Add Scout live auth/rate-limit dependency adapter skeleton` | Defines thin mock-disabled adapter contracts (verifier adapter + limiter adapter) so a future real Firebase / KV implementation can be slotted in without changing the boundary. **Recommended** as the next slice — the audit unblocks it. |
| `[TECH] Add Scout live auth/rate-limit storage adapter skeleton` | Alternative narrower scope focused on the rate-limit storage adapter only. |
| `[PRODUCT] Define Scout live-provider prompt/response contract (#2234)` | Already open; independent of auth/rate-limit. |

**Recommended**: `[TECH] Add Scout live auth/rate-limit dependency adapter skeleton` first. The slice must be **mock-disabled** (i.e. the real adapter is shipped disabled; only a mock is enabled by default in tests) and must **not** call any external API.

## Explicit Verdict

- Ready for runtime auth/rate-limit dependency adapter skeleton (mock-disabled, no external calls): **Yes, conditional**
- Ready for real Firebase / KV implementation: **No**
- Ready for `staging_live` execution: **No**
- Ready for `production_live` execution: **No**
- Ready for real provider API call: **No**

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

## Storage Adapter Skeleton Status

A [storage adapter skeleton](lovebud-scout-live-rate-limit-storage-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveRateLimitStorageAdapter`) returning default `checkQuota` / `consumeQuota` / `releaseQuota` / `sanitizePayload`
- Default `mockDisabled:true` so the endpoint cannot accidentally read or write real storage in skeleton mode
- No real KV / Durable Object / D1 / database / fetch / env storage binding access
- Storage payload sensitive data guardrails: allowlist (requestId, userKeyHash, ipHash, etc.) + denylist (token, apiKey, prompt, excerpt, sourceUrl, rawRequestBody, etc.)
- Response codes (`STORAGE_MOCK_DISABLED`, `STORAGE_NOT_IMPLEMENTED`) mappable to `RATE_LIMIT_UNAVAILABLE` at the endpoint boundary
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real KV / Durable Object / D1 / database implementations, staging_live, and production_live all remain blocked

## Audited Test Files (all required to keep passing)

```text
tests/contracts/scout-live-endpoint-error-readiness-audit-contract.test.cjs (this slice)
tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs (24/24)
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

- `docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`
- `docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`
- `docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md`
- `docs/product/lovebud-scout-serverless-endpoint-boundary.md`
- `docs/product/lovebud-scout-llm-provider-boundary.md`
- `docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`
- `docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`
- `docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md`
- `docs/product/lovebud-scout-live-provider-readiness-audit.md`

## Storage Adapter Dependency Wiring Status

The storage adapter skeleton is now wired into the live dependency adapter mock path (v20260607-1, wiring slice):
- `live-auth-rate-limit-dependency-adapter.js` imports `createScoutLiveRateLimitStorageAdapter` from `live-rate-limit-storage-adapter.js`
- `createScoutLiveDependencyAdapter(options?)` accepts a `storageAdapter` option
- When `storageAdapter` is not provided, the canonical mock-disabled storage adapter (`createScoutLiveRateLimitStorageAdapter({ mockDisabled: true })`) is used as the default
- `checkRateLimit` routes through `storageAdapter.checkQuota` with an **allowlisted payload only** (no raw token / API key / prompt / excerpt / sourceUrl / raw request body)
- Storage adapter results are mapped to dependency-adapter safe-fail codes (RATE_LIMIT_NOT_IMPLEMENTED / RATE_LIMIT_PAYLOAD_PROHIBITED / RATE_LIMIT_STORAGE_UNAVAILABLE)
- Storage adapter throw is safe-swallowed (no throw propagation)
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- No real KV / Durable Object / D1 / database / fetch / env storage binding
- Real KV / DO / D1 / database / Firebase / provider SDK / staging / production all remain blocked

## Auth Verifier Adapter Skeleton Status

The auth verifier adapter skeleton has been added as a separate file
(`functions/api/scout/live-auth-verifier-adapter.js`, v20260607-1) ahead
of any Firebase Admin SDK integration. Status:

- A new `live-auth-verifier-adapter.js` module has been added with
  `createScoutLiveAuthVerifierAdapter(options?)` factory
- Default `mockDisabled: true` fail-closed behavior; `verifyToken` always
  returns `{ allowed: false, code: "VERIFIER_MOCK_DISABLED", userKey: null, userKeyHash: null }`
- `mockDisabled: false` mode returns `VERIFIER_NOT_IMPLEMENTED` shape
- Object.freeze applied to the returned adapter
- `sanitizeScoutLiveAuthVerifierPayload(payload, options?)` pure helper
  exported with `onProhibitedField: 'drop' | 'reject'` modes
- Allowed fields (allowlist): `requestId`, `tokenHash`,
  `authorizationScheme`, `providerMode`, `endpointPath`, `nowMs`
- Prohibited fields (denylist): `token`, `rawToken`, `authorization`,
  `authorizationHeader`, `apiKey`, `secret`, `password`, `cookie`,
  `sessionCookie`, `firebaseToken`, provider API key fields
  (`openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`,
  `mistralApiKey`, `nvidiaApiKey`), `prompt`, `excerpt`, `sourceUrl`,
  `rawRequestBody`
- No Firebase Admin SDK / no `getAuth` / no `verifyIdToken` /
  no `verifyAccessToken` / no `cert` / no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth service URL
- No env auth binding (`env.AUTH`, `env.FIREBASE`,
  `process.env.SCOUT_*`, `import.meta.env`) access
- No KV / Durable Object / D1 / database runtime access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- `verifyToken` result never includes raw token / authorization /
  apiKey / firebaseToken / sessionCookie
- Dependency adapter is NOT yet wired to the verifier (separate slice)
- `suggest.js` is NOT yet wired to the verifier (separate slice)
- Endpoint default `providerMode: "stub"` preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- Runtime Firebase Admin SDK / real token verification /
  external auth service call: **NO** (blocked)
- `staging_live` / `production_live` rollout: **NO** (blocked)

## Auth Verifier Adapter Dependency Wiring Status

The auth verifier adapter skeleton is now wired into the live dependency
adapter mock path (v20260607-1, wiring slice):

- `live-auth-rate-limit-dependency-adapter.js` imports
  `createScoutLiveAuthVerifierAdapter` from `live-auth-verifier-adapter.js`
- `createScoutLiveDependencyAdapter(options?)` accepts a `verifierAdapter`
  option
- When `verifierAdapter` is not provided, the canonical mock-disabled
  verifier adapter
  (`createScoutLiveAuthVerifierAdapter({ mockDisabled: true })`) is used
  as the default
- `verifyToken` routes through `verifierAdapter.verifyToken` with an
  **allowlisted payload only** (no raw token / authorization header /
  API key / firebaseToken / session cookie / password / prompt /
  excerpt / sourceUrl / raw request body / provider API key fields)
- Allowed verifier payload fields (single source of truth at the dep
  adapter → verifier seam):
  - `requestId`
  - `tokenHash`
  - `authorizationScheme`
  - `providerMode`
  - `endpointPath`
  - `nowMs`
- Verifier result codes are mapped to dependency-adapter safe-fail codes:
  - `VERIFIER_MOCK_DISABLED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_NOT_IMPLEMENTED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_PAYLOAD_PROHIBITED` → `VERIFY_PAYLOAD_PROHIBITED`
  - unknown / missing code → `VERIFY_UNAVAILABLE`
- Verifier adapter throw is safe-swallowed (no throw propagation,
  returns `VERIFY_UNAVAILABLE`)
- The dependency adapter's `checkRateLimit` storage adapter wiring is
  unchanged
- The dependency adapter object remains frozen (immutable)
- `verifyToken` result still includes `userKey: null` and
  `userKeyHash: null` in mock-disabled / not-implemented mode (skeleton
  does not return real user identifiers)
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- New dependency-adapter response codes:
  - `VERIFY_PAYLOAD_PROHIBITED`
  - `VERIFY_UNAVAILABLE`
- No real Firebase Admin SDK, no `getAuth`, no `verifyIdToken`, no
  `verifyAccessToken`, no `cert`, no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth URL
- No KV / Durable Object / D1 / database / env auth binding
  (`env.AUTH`, `env.FIREBASE`, `process.env.SCOUT_*`, `import.meta.env`)
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- Real Firebase Admin SDK / real token verification / external auth
  service / `staging_live` / `production_live` / provider API all
  remain blocked

## Adapter Wiring Readiness Audit Status

The live auth/rate-limit adapter wiring has been audited as a single
coherent mock-disabled stage (v20260607-1, audit-only slice):

- A new readiness audit document has been added:
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
- The audit inventories and confirms:
  - auth verifier adapter skeleton (PR #2302)
  - auth verifier dependency wiring (PR #2304)
  - rate-limit storage adapter skeleton (PR #2299)
  - storage adapter dependency wiring (PR #2301)
  - dependency adapter endpoint wiring (PR #2297)
  - endpoint error taxonomy, observability, DI, safe-fail wiring
  - boundary reconcile and runtime boundary
- `mockDisabled:true` fail-closed default is confirmed consistent across
  verifier, storage, and dependency adapter
- Sensitive data (raw token / authorization / firebaseToken / API key
  / prompt / excerpt / sourceUrl / raw request body) is confirmed not
  propagated to verifier / storage / limiter / observability / response
  payloads
- No real Firebase Admin SDK, no real Firebase token verification, no
  real KV / Durable Object / D1, no real provider API, no external
  observability backend
- Endpoint default `providerMode: "stub"` preserved
- Explicit `providerMode: "stub"` path preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- This audit slice is docs+tests only; no runtime code change
- Recommended next slice: `[TECH] Add Scout live auth/rate-limit
  runtime adapter implementation gate contract`
- Verdict: ready for runtime implementation gate contract: **Yes**;
  ready for real Firebase / KV / staging / production / provider API:
  **No** (all blocked)

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

## Firebase Auth Verifier Implementation Plan Status

The runtime Firebase auth verifier implementation plan/audit has been
added as a docs+tests-only slice (v20260607-1, plan/audit slice, no
runtime code change, no Firebase Admin SDK import):

- A new plan document has been added:
  `docs/product/lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md`
- The plan satisfies step 1 of the runtime adapter implementation gate
  contract's required next implementation order
- The plan inventories the current mock-disabled verifier adapter,
  verifier dependency wiring, endpoint live branch wiring, error
  taxonomy, observability, secret/config policy, rollback policy, and
  privacy/safety payload policy
- The plan defines the future implementation surface for Firebase Admin
  SDK integration **without** implementing it
- The plan defines:
  - future target module (`functions/api/scout/live-auth-verifier-adapter.js`)
  - future target factory (`createScoutLiveAuthVerifierAdapter`)
  - future disabled-by-default `firebase` mode
  - future env-gated config names (example:
    `SCOUT_RUNTIME_FIREBASE_VERIFIER_ENABLED`,
    `SCOUT_RUNTIME_FIREBASE_PROJECT_ID`,
    `SCOUT_RUNTIME_FIREBASE_SERVICE_ACCOUNT_KEY`)
  - Firebase Admin SDK boundary (no global init at import time, no
    token verification at import time, no service account exposure,
    no token / service account logs)
  - token handling policy (raw Authorization header only at endpoint
    auth boundary, raw token only inside verifier call boundary, no
    raw token logs, no raw token persistence, no raw token propagation
    to storage / rate-limit / provider / observability, `tokenHash` /
    `authorizationScheme` only in safe payloads)
  - future verifier input / output contract (private rawToken
    boundary, allowed payload fields, no raw Firebase claims, no raw
    decoded token, no raw UID / email in response)
  - error mapping (`AUTH_INVALID` / `VERIFY_UNAVAILABLE` /
    `CONFIG_MISSING` / `VERIFY_PAYLOAD_PROHIBITED` /
    `VERIFY_NOT_IMPLEMENTED`)
  - required future tests (side-effect-free import, default
    mock-disabled, Firebase mode disabled unless env opt-in, no
    token logs, no service account logs, no provider API call, no
    storage call, no endpoint default live, safe error mapping,
    observer safe-swallow unchanged)
  - required future docs (gate status update, secret/config
    checklist, staging rollout plan, production readiness gates,
    incident/rotation runbook)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
- The 4 runtime files remain locked by md5 normalized for LF/CRLF
  (cross-platform stable): dep-adapter `796a2aef…`, verifier
  `5a0a8534…`, storage `a4419b1e…`, suggest `deb6a6d7…`
- This plan slice is docs+tests only; no runtime code change, no
  Firebase Admin SDK import
- Recommended next slice: `[PRODUCT] Plan Scout runtime rate-limit
  storage implementation` (gate step 2), or `[PRODUCT]` audit
  slice for the rollback / kill-switch policy and observability
  policy docs
- Verdict: Firebase auth verifier implementation plan: **Yes**;
  real Firebase Admin SDK in this PR: **No**; real token
  verification in this PR: **No**; `staging_live` / `production_live`
  / provider API / external auth service / endpoint default live
  in this PR: **No** (all blocked)

## Rate-limit Storage Implementation Plan Status

The runtime rate-limit storage implementation plan/audit has been
added as a docs+tests-only slice (v20260607-1, plan/audit slice, no
runtime code change, no KV / Durable Object / D1 implementation):

- A new plan document has been added:
  `docs/product/lovebud-scout-runtime-rate-limit-storage-implementation-plan.md`
- The plan satisfies step 2 of the runtime adapter implementation
  gate contract's required next implementation order
- The plan inventories the current mock-disabled storage adapter,
  storage dependency wiring, auth verifier plan, endpoint live
  branch wiring, error taxonomy, observability, cost/quota/abuse
  policy, rollback policy, and privacy/safety payload policy
- The plan defines the future implementation surface for KV /
  Durable Object / D1 storage **without** implementing it
- The plan defines:
  - future target module
    (`functions/api/scout/live-rate-limit-storage-adapter.js`)
  - future target factory
    (`createScoutLiveRateLimitStorageAdapter`)
  - future disabled-by-default `kv` / `durable_object` / `d1` modes
  - future env-gated config names (example:
    `SCOUT_RUNTIME_RATE_LIMIT_BACKEND`,
    `SCOUT_RUNTIME_RATE_LIMIT_KV_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_DO_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_D1_BINDING`,
    `SCOUT_RUNTIME_RATE_LIMIT_QUOTA_BUCKET`,
    `SCOUT_RUNTIME_RATE_LIMIT_WINDOW_SECONDS`,
    `SCOUT_RUNTIME_RATE_LIMIT_LIMIT_PER_WINDOW`)
  - storage backend boundary (no storage connection at import time,
    no quota read/write at import time, no binding/secret exposure,
    no raw storage key logs)
  - storage key policy (hash-based userKeyHash / ipHash /
    sessionKeyHash, endpointPath / providerMode / quotaBucket /
    windowKey / limitName, no raw UID/email/IP/token/authorization/
    API key, stable key format required)
  - storage payload policy (allowed fields, prohibited fields, no
    raw token, no authorization header, no firebaseToken, no API
    key, no prompt/excerpt/sourceUrl/raw request body, no raw
    UID/email/IP/provider response)
  - future storage input / output contract (checkQuota /
    consumeQuota / releaseQuota, decisionId, retryAfterSeconds,
    remaining quota if safe, no raw storage key, no raw user
    identifier)
  - quota lifecycle policy (pre-consumption validation, reservation
    before provider call, consume after provider success, release
    on provider failure, failure accounting, idempotency guard)
  - error mapping (RATE_LIMITED / RATE_LIMIT_UNAVAILABLE /
    RATE_LIMIT_STORAGE_UNAVAILABLE / CONFIG_MISSING /
    RATE_LIMIT_PAYLOAD_PROHIBITED / RATE_LIMIT_NOT_IMPLEMENTED)
  - required future tests (side-effect-free import, default
    mock-disabled, KV/DO/D1 modes disabled unless env opt-in, no
    raw token/API key, no raw user identifiers, storage
    unavailable safe-fail, quota exceeded maps to RATE_LIMITED,
    consume/release idempotency, no provider API call, no
    endpoint default live)
  - required future docs (gate status update, cost/quota/abuse
    monitoring contract, staging rollout plan, production
    readiness gates, incident/rotation runbook, separate
    rollback / observability policy docs)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
- The 4 runtime files remain locked by md5 normalized for LF/CRLF
  (cross-platform stable): dep-adapter `796a2aef…`, verifier
  `5a0a8534…`, storage `a4419b1e…`, suggest `deb6a6d7…`
- This plan slice is docs+tests only; no runtime code change, no
  KV / Durable Object / D1 implementation, no runtime quota
  persistence
- Recommended next slice: `[PRODUCT] Add Scout rollback /
  kill-switch policy audit` (gate evidence 2), or `[PRODUCT] Add
  Scout runtime observability policy audit` (gate evidence 3)
- Verdict: rate-limit storage implementation plan: **Yes**; real
  KV / Durable Object / D1 in this PR: **No**; runtime quota
  persistence in this PR: **No**; `staging_live` / `production_live`
  / provider API / external auth service / endpoint default live
  in this PR: **No** (all blocked)

## Rollback / Kill-switch Policy Audit Status

The Scout rollback / kill-switch policy audit has been added as a
docs+tests-only slice (v20260607-1, audit slice, no runtime code
change, no kill-switch implementation, no Cloudflare env/secret
change, no deployment rollback):

- A new audit document has been added:
  `docs/product/lovebud-scout-rollback-kill-switch-policy-audit.md`
- The audit satisfies gate evidence 10 of 11 in the runtime
  adapter implementation gate contract
- The audit inventories the current safe baseline (endpoint
  default `providerMode: "stub"`, explicit stub source,
  frontend default `local_stub`, endpoint client default
  disabled, `verifierAdapter` / `storageAdapter` default
  mock-disabled, `staging_live` / `production_live` blocked)
- The audit defines 8 independent kill-switch surfaces
  (Firebase auth verifier, rate-limit storage, external
  observability, provider API, endpoint live mode, endpoint
  client, `staging_live`, `production_live`) and the required
  future kill-switch controls for each
- The audit defines:
  - rollback baseline (endpoint default stub + explicit stub +
    frontend local_stub + endpoint client disabled + verifier
    and storage mock-disabled)
  - 8-scenario incident rollback decision tree (verifier
    outage / storage outage / provider API failure / external
    observability outage / quota spike / cost spike / safety
    regression / secret rotation)
  - per-surface rollback policies (secret/config rollback,
    quota/cost rollback, auth verifier rollback, rate-limit
    storage rollback, provider API rollback, observability
    rollback, staging / prod rollback)
  - privacy / safety rules during rollback (no raw token, no
    authorization header, no firebaseToken, no API key, no
    prompt / excerpt / sourceUrl / raw request body, no raw
    provider response, no raw user identifier in any log,
    error, event, or incident note)
  - disabled-by-default + env-gated + safe-fallback pattern
    for every kill-switch
  - required future tests (default mock-disabled, env opt-in
    paths, no live default, safe-fallback to stub / local_stub
    / disabled, no raw secrets or identifiers in any log /
    error / event)
  - required future docs (gate status update, incident
    runbook, secret rotation runbook, quota incident
    runbook, observability policy doc, separate observability
    policy doc — gate evidence 11 of 11)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
- The 4 runtime files remain locked by md5 normalized for
  LF/CRLF (cross-platform stable): dep-adapter `796a2aef…`,
  verifier `5a0a8534…`, storage `a4419b1e…`, suggest
  `deb6a6d7…`
- This audit slice is docs+tests only; no runtime code change,
  no kill-switch implementation, no Cloudflare env/secret
  change, no deployment rollback, no provider API call, no
  Firebase Admin SDK import, no KV / Durable Object / D1
  implementation
- Recommended next slice: `[PRODUCT] Add Scout runtime
  observability policy audit` (gate evidence 11 of 11).
  After that is merged, all 11 gate evidence items will be
  complete, and gate step 3 (one disabled-by-default runtime
  adapter implementation) may begin
- Verdict: rollback / kill-switch policy audit: **Yes**; real
  kill-switch implementation in this PR: **No**; real Firebase
  Admin SDK in this PR: **No**; real KV / Durable Object / D1
  in this PR: **No**; real provider API in this PR: **No**;
  real external observability backend in this PR: **No**;
  `staging_live` / `production_live` opt-in in this PR: **No**
  (all blocked)
