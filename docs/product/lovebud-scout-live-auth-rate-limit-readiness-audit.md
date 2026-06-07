# LoveBud Scout Live Provider Endpoint Auth/Rate-Limit Readiness Audit (Post DI + Observability)

## Baseline

- **current main HEAD**: `2a3bf2bd`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **recently merged Scout PRs (auth/rate-limit track)**: #2276 (selection boundary), #2278 (runtime boundary skeleton), #2280 (reconcile), #2283 (endpoint safe-fail wiring), #2285 (endpoint DI contract), #2287 (endpoint observability contract)
- **related closed issues**: #2275, #2277, #2279, #2282, #2284, #2286
- **current open issues**: #1882 (Scout MVP), #1661 (Browse sorting / out of scope), #2234 (Scout live-provider prompt/response contract)
- **current live provider status**: provider-specific adapter skeleton + selection boundary added behind disabled mode; no provider API call; staging_live and production_live remain blocked; endpoint live auth/rate-limit now has DI contract + sanitized observability contract in place

## Endpoint Live Error Taxonomy Contract (slice update)

- endpoint error taxonomy contract added (`docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`)
- error categories: `request_validation`, `auth`, `rate_limit`, `config`, `provider_availability`, `provider_response`, `output_safety`, `observability`, `internal_boundary`
- canonical error codes: `INVALID_REQUEST`, `VALIDATION_ERROR`, `AUTH_REQUIRED`, `AUTH_INVALID`, `RATE_LIMITED`, `RATE_LIMIT_UNAVAILABLE`, `CONFIG_MISSING`, `PROVIDER_UNAVAILABLE`, `PROVIDER_ERROR`, `OUTPUT_SAFETY_BLOCKED`, `OBSERVABILITY_UNAVAILABLE`, `INTERNAL_BOUNDARY_ERROR`
- HTTP status mapping locked (400 / 401 / 429 / 503 / 422 / 502 / 500)
- response body shape locked: `{ ok: false, providerMode: "live", error: { code, message } }`
- `Retry-After` header policy: only on `RATE_LIMITED` with positive `retryAfterSeconds`
- observability mapping locked: auth/rate-limit error codes → `boundaryDecision` / `authStatus` / `rateLimitStatus` / `errorCode`; `OBSERVABILITY_UNAVAILABLE` is never returned to the client (safe-swallowed)
- sensitive data prohibition locked for all response headers / bodies / observability events
- endpoint default remains stub
- UI default remains `local_stub`
- real Firebase / KV / provider API work remains blocked
- `tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs` — focused taxonomy contract

## Document Status

- This document is an **audit-only** deliverable. It does not change runtime behavior.
- It is an integration-level read of every endpoint live auth/rate-limit slice that landed
  between #2276 and #2287 inclusive, and a go/no-go matrix for the next steps.

## Audit Purpose

- 통합 점검: DI / safe-fail wiring / observability가 모두 들어간 상태에서, 남은 blocker와 다음 slice 진입 가능 여부를 본다.
- 실제 provider API / Firebase Admin SDK / KV-DO-D1 / 외부 logging backend는 이번 단계에서도 추가하지 않는다.
- default live AI usage는 여전히 금지다.
- 이 문서는 구현이 아니라 audit이다.

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
| Real Firebase auth verifier | **Not done** | blocked |
| Persistent rate-limit store | **Not done** | blocked |
| staging_live execution | **Not done** | blocked |
| production_live execution | **Not done** | blocked |
| Real provider API call | **Not done** | blocked |

## Implemented Endpoint Auth/Rate-Limit Boundary Inventory

| Boundary | Status | Evidence |
|---|---|---|
| Canonical auth/rate-limit runtime boundary skeleton | ✅ Pass | `functions/api/scout/live-auth-rate-limit-boundary.js` (398 lines, v20260607-1) — exports `SCOUT_LIVE_AUTH_RATE_LIMIT_STATUS`, `SCOUT_LIVE_AUTH_RATE_LIMIT_ERROR_CODES`, `createScoutLiveAuthBoundary`, `createScoutLiveRateLimitBoundary`, `verifyScoutLiveAuthBoundary`, `checkScoutLiveRateLimitBoundary` |
| Reconcile decision (canonical vs parallel) | ✅ Pass | `tests/contracts/scout-live-auth-rate-limit-boundary-reconcile-contract.test.cjs` (13/13) — locks canonical vs parallel file decision |
| Endpoint live safe-fail wiring | ✅ Pass | `tests/contracts/scout-live-auth-rate-limit-endpoint-safe-fail-wiring-contract.test.cjs` (20/20) — `suggest.js` LIVE branch routes through `verifyScoutLiveAuthBoundary` and `checkScoutLiveRateLimitBoundary` |
| Injected dependency contract | ✅ Pass | `tests/contracts/scout-live-auth-rate-limit-endpoint-di-contract.test.cjs` (20/20) — explicit `liveDependencies = { verifyToken, checkRateLimit, requestId }` DI seam |
| Sanitized observability contract | ✅ Pass | `functions/api/scout/live-auth-rate-limit-observability.js` (257 lines, v20260607-1) — allowlist + sanitized event builders + safe observer invoker + in-memory ring buffer observer factory; `tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` (24/24) |
| Endpoint default stub preserved | ✅ Pass | `suggest.js` default `providerMode:"stub"`; `STUB: 'stub'` defined in constants |
| Frontend default `local_stub` preserved | ✅ Pass | `js/scout/scout-suggestion-source-selector.js` default `LOCAL_STUB: 'local_stub'` |
| Endpoint client default disabled preserved | ✅ Pass | `js/scout/scout-suggestion-endpoint-client.js` — does NOT import boundary / observability / DI seam |
| Real Firebase Admin SDK | ❌ Not implemented | (correct: blocked) |
| Real KV / Durable Object / D1 | ❌ Not implemented | (correct: blocked) |
| Real provider API call | ❌ Not implemented | (correct: blocked) |

## Confirmed Behavior

| Scenario | Expected Behavior | Confirmed By |
|---|---|---|
| Default stub (no env override) | skip auth + skip rate-limit + skip observer; return deterministic stub suggestion | observability / DI / wiring tests |
| Explicit stub (`SCOUT_SUGGEST_PROVIDER_MODE=stub`) | same as default stub | observability / DI / wiring tests |
| Live mode + missing `Authorization` header | boundary returns `AUTH_REQUIRED` (401); observer records AUTH_REQUIRED event | observability / wiring tests |
| Live mode + malformed `Authorization` header | boundary returns `AUTH_INVALID` (401); observer records AUTH_INVALID event | observability / wiring tests |
| Live mode + auth ok + missing limiter | boundary returns `RATE_LIMIT_UNAVAILABLE` (503); observer records RATE_LIMIT_UNAVAILABLE event | observability / DI / wiring tests |
| Live mode + auth ok + limiter rejects | boundary returns `RATE_LIMITED` (429) with `retry-after` header; observer records RATE_LIMITED event with `retryAfterSeconds` | observability tests |
| Live mode + auth ok + limiter allows | boundary returns ok; endpoint proceeds to provider safe-fail (`PROVIDER_UNAVAILABLE`); observer records RATE_LIMIT_ALLOWED event | observability / wiring tests |
| Live mode + observer throws | endpoint response is unchanged (safe-swallow) | observability test #10 |
| Live mode + missing `verifyToken` | boundary safe-fails `AUTH_INVALID` / `AUTH_REQUIRED` | DI test #7 |
| Live mode + missing `checkRateLimit` | boundary safe-fails `RATE_LIMIT_UNAVAILABLE` | DI test #8 |
| Auth failure short-circuit | limiter is NOT called when verifier fails | DI test #6 |
| Default stub observer skip | observer is NOT called | observability test #8 / #9 |
| Limiter payload sanitization | only `userKey` / `providerMode` / `bucket` are sent to limiter; raw token / API key / prompt / excerpt / full sourceUrl never propagate | observability test #15 / DI test #9-#10 |

## Security / Privacy Guardrails

| Guardrail | Status | Evidence |
|---|---|---|
| No raw token propagation in response body | ✅ Confirmed | DI test #11, observability test #12 |
| No API key value propagation in response body | ✅ Confirmed | DI test #11, observability test #13 |
| No prompt / excerpt / full sourceUrl in observability event | ✅ Confirmed | observability test #14 |
| No raw request body in observability event | ✅ Confirmed | observability test #14 |
| No `console.log` / `console.error` introduced | ✅ Confirmed | observability test #16 |
| No external logger SDK (winston / pino / bunyan / log4js / datadog / newrelic / sentry) | ✅ Confirmed | observability test #16 |
| No Firebase Admin SDK | ✅ Confirmed | observability test #17, DI test #13, wiring test #12 |
| No KV / Durable Object / D1 runtime access | ✅ Confirmed | observability test #18, DI test #14 |
| No provider SDK (openai / @anthropic-ai/sdk / @google/generative-ai / groq-sdk / @mistralai/mistralai / nvidia-modulus / grok-client) | ✅ Confirmed | observability test #19, DI test #15 |
| No fetch / XHR / axios | ✅ Confirmed | observability test #20, DI test #16 |
| `.env` file additions | ❌ None | (correct: blocked) |
| `wrangler secret` real registration | ❌ None | (correct: blocked) |

## Go / No-Go Matrix

| Workstream | Verdict | Rationale |
|---|---|---|
| Endpoint live auth/rate-limit runtime boundary skeleton | **GO** | MERGED #2278 + #2280; 28 + 13 focused tests pass |
| Endpoint safe-fail wiring | **GO** | MERGED #2283; 20 focused tests pass |
| Endpoint injected dependency contract | **GO** | MERGED #2285; 20 focused tests pass |
| Sanitized observability contract | **GO** | MERGED #2287; 24 focused tests pass |
| Endpoint error taxonomy contract | **GO** (next slice) | DI shape + sanitized observability are stable; safe-fail codes already enumerated; ready to fix response shape |
| Real Firebase auth verifier implementation | **NO-GO** | No Firebase Admin SDK in repo; admin SDK integration is a separate workstream |
| Real persistent rate-limit store (KV / DO / D1) | **NO-GO** | No KV / DO / D1 access; persistent storage is a separate workstream |
| Real observability / logging backend integration | **NO-GO** | observer seam is in place but no backend integration is added |
| Provider-specific live adapter (real call) | **NO-GO** | No real provider SDK; selection boundary is inert by design |
| `staging_live` execution | **NO-GO** | All real backends above are NO-GO |
| `production_live` execution | **NO-GO** | All real backends above are NO-GO |
| Real provider API call | **NO-GO** | No provider SDK; no real call path is enabled |

## Remaining Blockers

The following are intentionally **not yet implemented** and block any real runtime work:

1. **Real Firebase auth verifier** — the canonical boundary's `context.verifyToken` is currently `undefined` in production. A Firebase Admin SDK verifier (or alternative IdP verifier) must be wired in before `staging_live`.
2. **Persistent rate-limit store** — the canonical boundary's `context.checkRateLimit` is currently `undefined` in production. A real KV / Durable Object / D1 backed limiter must be wired in before `staging_live`.
3. **Production quota backend** — no quota policy is in place; the observability contract emits `quotaBucket` and `latencyMs` but they are not yet consumed by a real backend.
4. **Real observability backend** — the in-memory ring buffer is test-only. A real observability backend (e.g. durable log sink, structured log forwarder) is not wired.
5. **Provider-specific live adapter** — the selection boundary is inert; no provider-specific adapter is enabled.
6. **Provider error taxonomy** — boundary returns `AUTH_INVALID` / `AUTH_REQUIRED` / `RATE_LIMITED` / `RATE_LIMIT_UNAVAILABLE`; provider-side error codes (e.g. `provider_timeout`, `provider_rate_limited`, `provider_unsafe_output`, `provider_billing_error`) are not yet defined.
7. **Staging soak** — no real LLM traffic has been observed in staging; no latency / cost / quota baseline exists.
8. **Kill-switch drill result** — no staged or production kill-switch drill has been performed.

## Recommended Next Slice

| Candidate | Rationale |
|---|---|
| `[TECH] Add Scout live provider endpoint error taxonomy contract` | Locks the response shape and error codes for live mode decisions (auth + rate-limit + provider error). This is the natural next step now that DI + observability are stable. |
| `[TECH] Add Scout live auth/rate-limit dependency adapter skeleton` | Defines a thin adapter contract (verifier adapter + limiter adapter) so a future real Firebase / KV implementation can be slotted in without changing the boundary. |
| `[PRODUCT] Define Scout live-provider prompt/response contract (#2234)` | Already open; independent of auth/rate-limit. |

**Recommended**: `[TECH] Add Scout live provider endpoint error taxonomy contract` first (builds on top of the current DI + observability contract work).

## Explicit Verdict

- Ready for endpoint error taxonomy contract: **Yes**
- Ready for real Firebase / KV implementation: **No**
- Ready for `staging_live` execution: **No**
- Ready for `production_live` execution: **No**
- Ready for real provider API call: **No**

## Audited Test Files (all required to keep passing)

```text
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

- `docs/product/lovebud-scout-live-provider-auth-rate-limit-boundary.md`
- `docs/product/lovebud-scout-serverless-endpoint-boundary.md`
- `docs/product/lovebud-scout-llm-provider-boundary.md`
- `docs/product/lovebud-scout-live-provider-production-readiness-gates-audit.md`
- `docs/product/lovebud-scout-live-provider-staging-rollout-contract.md`
- `docs/product/lovebud-scout-ai-suggestion-mvp-readiness.md`
- `docs/product/lovebud-scout-live-provider-readiness-audit.md`
- `docs/product/lovebud-scout-live-provider-post-mock-readiness-audit.md`
