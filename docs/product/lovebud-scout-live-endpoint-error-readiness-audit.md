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
