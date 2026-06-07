# LoveBud Scout AI Suggestion MVP Readiness Audit

## Baseline

## Endpoint Live Error Readiness Audit (slice update)

- endpoint error readiness audit added (`docs/product/lovebud-scout-live-endpoint-error-readiness-audit.md`)
- error taxonomy, safe-fail wiring, DI, and observability are aligned
- runtime Firebase / KV / provider API work remains blocked
- runtime dependency adapter skeleton (mock-disabled, no external calls) is the next recommended slice
- endpoint default remains stub
- UI default remains `local_stub`
- `tests/contracts/scout-live-endpoint-error-readiness-audit-contract.test.cjs` — focused error readiness audit

## Endpoint Live Error Taxonomy Contract (slice update)

- endpoint error taxonomy contract added (`docs/product/lovebud-scout-live-endpoint-error-taxonomy-contract.md`)
- error categories / canonical error codes / HTTP status mapping / response body shape / Retry-After policy / observability mapping / sensitive data prohibition all locked
- real Firebase / KV / provider API work remains blocked
- endpoint default remains stub
- UI default remains `local_stub`
- `tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs` — focused taxonomy contract

## Endpoint Live Auth/Rate-Limit Readiness Audit (slice update)

- endpoint live auth/rate-limit readiness audit added (`docs/product/lovebud-scout-live-auth-rate-limit-readiness-audit.md`)
- endpoint safe-fail wiring, DI contract, and observability contract are complete
- real Firebase / KV / provider API work remains blocked (NO-GO)
- endpoint default remains stub
- UI default remains `local_stub`
- recommended next slice: endpoint error taxonomy contract
- audit verdict: ready for endpoint error taxonomy contract; NOT ready for real Firebase/KV, `staging_live`, `production_live`, or real provider API call

## Auth/Rate-Limit Runtime Boundary Skeleton (slice update)

- auth/rate-limit runtime boundary skeleton added (functions/api/scout/live-auth-rate-limit-boundary.js)
- dependency injection seam only (verifyToken / checkRateLimit injected via context)
- no Firebase Admin SDK import / no Firebase token verification
- no KV / Durable Object / D1 runtime storage call
- no real provider API call
- endpoint default remains stub
- frontend default remains local_stub
- staging_live and production_live remain blocked

- `functions/api/scout/live-auth-rate-limit-boundary.js` — runtime boundary skeleton + DI seam + safe-fail defaults
- `tests/contracts/scout-live-auth-rate-limit-runtime-boundary-contract.test.cjs` — 28 sub-tests covering DI, safe defaults, no SDK / no storage / no fetch
- `verifyScoutLiveAuthBoundary` / `checkScoutLiveRateLimitBoundary` wrappers expose injected `verifyToken` / `checkRateLimit`


- **current main HEAD**: `f7d37545`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **recently merged Scout PRs**: #2203–#2270 inclusive (Scout Draft MVP through production readiness gates audit)
- **current open PR count**: 0
- **current open issues**: #1882 (Scout MVP), #1661 (Browse sorting / out of scope)
- **current live provider status**: provider-specific adapter skeleton added behind disabled mode; no provider API call; staging_live and production_live remain blocked

---

## Current Implemented Capabilities

| # | Capability | PR | Status |
|---|---|---|---|
| 1 | Manual Scout Draft entry + save via `addMemoryFromForm()` | #2209, #2211 | ✅ Complete |
| 2 | Scout suggestion provider abstraction | #2213 | ✅ Complete |
| 3 | Deterministic local stub suggestion provider | #2213, #2215 | ✅ Complete |
| 4 | Scout Draft modal "AI 제안 받기" button → stub provider | #2215 | ✅ Complete |
| 5 | Unavailable / pending configuration boundary | #2217 | ✅ Complete |
| 6 | Serverless endpoint skeleton (`functions/api/scout/suggest.js`) | #2221 | ✅ Complete |
| 7 | Endpoint auth/rate-limit contract (placeholder enforcement) | #2223 | ✅ Complete |
| 8 | Endpoint live-provider configuration boundary (`CONFIG_MISSING` fallback) | #2225 | ✅ Complete |
| 9 | Endpoint client wrapper (`js/scout/scout-suggestion-endpoint-client.js`, disabled by default) | #2227 | ✅ Complete |
| 10 | Suggestion source selector boundary (`local_stub` default, `endpoint_client` requires feature flag) | #2229 | ✅ Complete |
| 11 | Endpoint suggestion opt-in QA scenario (23 contract tests) | #2231 | ✅ Complete |
| 12 | Live-provider prompt/response contract (with Product Prompt safety note) | #2235 | ✅ Complete |
| 13 | Provider-specific adapter skeleton (`functions/api/scout/provider-specific-adapter.js`) | ✅ Complete | #2272 |
| 14 | Provider-specific adapter selection boundary (`functions/api/scout/provider-specific-adapter.js`) | (this PR) | ✅ Complete |

---

## Readiness Verdict

```
Ready for a narrow live-provider implementation planning slice, but not ready for default live usage.
```

### What it means

- **Ready for next planning/implementation boundary**: All guardrails are in place. The system can support a contract-only or planning-only slice to define the live provider prompt and response contract.
- **Not ready for production live AI default**: Several blockers remain (see below) before a live provider can be safely enabled. The default user experience remains `local_stub`, and that should not change until all blockers are resolved.

---

## Guardrails Confirmed

| Guardrail | Status | Evidence |
|---|---|---|
| No frontend API key | ✅ Pass | `js/scout/scout-suggestion-endpoint-client.js` no key injection; `scout-suggestion-provider.js` no API key; `scout-draft-ui.js` no key; contract tests verify no `Authorization`/`x-api-key` auto-injection |
| No default endpoint call | ✅ Pass | `isScoutSuggestionEndpointClientEnabled()` defaults to `false`; `resolveScoutSuggestionSource()` defaults to `local_stub`; Draft UI `handleSuggest()` uses source selector with no config → local_stub |
| Default source is `local_stub` | ✅ Pass | `resolveScoutSuggestionSource({})` returns `{ source: 'local_stub' }`; `createScoutSuggestionSourceProvider()` default creates stub provider |
| Endpoint client opt-in only | ✅ Pass | `endpoint_client` resolved only when `endpointClientEnabled === true \|\| 'true'`; 1/"1"/"yes" rejected |
| No real provider call | ✅ Pass | `suggest.js` always returns deterministic stub; live provider has `TODO` placeholder; `resolveScoutSuggestProviderMode` returns `config_missing` when env vars absent |
| No external source fetch | ✅ Pass | `sourceUrl` is a request body field only, never used as fetch target; `fetch()` only called against same-origin `/api/scout/suggest` |
| No auto-save | ✅ Pass | No `addMemoryFromForm()` or `.save()` call in any Scout suggestion module; `safetyNote` warns "review before saving" |
| Manual save preserved | ✅ Pass | Draft save flow (`handleSave()`) is independent of suggestion flow; works even when suggestion is unavailable |
| CONFIG_MISSING safe fallback | ✅ Pass | `resolveScoutSuggestProviderMode()` returns safe `CONFIG_MISSING` error; endpoint returns `503` with no secret/env leakage in message |
| No DB/schema migration | ✅ Pass | No database, KV, Durable Object, or D1 schema changes introduced in any Scout PR |

---

## Remaining Blockers Before Live Provider

1. **Firebase auth verification is placeholder only** — `verifyScoutFirebaseToken()` is a TODO comment in `suggest.js`. Without real Firebase Admin SDK integration, there is no way to authenticate users or associate suggestion requests with accounts.

2. **Rate-limit persistence is placeholder only** — `checkScoutRateLimit()` is a TODO comment. Without persistent storage (KV, Durable Objects, D1), rate limits cannot be enforced across requests.

3. **Live provider adapter — resolved** ❌ → ✅ Scout live provider adapter skeleton is now implemented. See `functions/api/scout/live-provider-adapter.js`. Includes prompt builder (`buildScoutLiveProviderPrompt`), response validator (`validateScoutLiveProviderResponse`), and adapter interface (`createScoutLiveProviderAdapter`). No real provider call, no SDK import, no fetch, no secrets. The adapter returns `CONFIG_MISSING` when not configured. The `suggest.js` endpoint stub behavior is preserved unchanged.

4. **Provider prompt/copyright policy — resolved** ❌ → ✅ Live-provider prompt and response contract is now defined. See [lovebud-scout-live-provider-prompt-response-contract.md](lovebud-scout-live-provider-prompt-response-contract.md). The Product Prompt safety note is specified with English/Korean canonical versions and 7 invariants.

5. **Abuse handling and logging need implementation** — No structured logging, metrics, or abuse detection exists in the endpoint. Observability section in the endpoint boundary doc defines desirable metrics but nothing is wired.

6. **Staging feature flag process needs definition** — How `endpoint_client` is enabled in staging vs production is not documented. The `endpointClientEnabled` config is a code-level flag with no deployment pipeline integration.

7. **Live provider tests must remain opt-in and network-free by default** — Any future live provider implementation must preserve the contract that CI tests run without network calls. A mock provider or stub must remain the default test path.

---

## Dependency Adapter Skeleton Status

A [dependency adapter skeleton](lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveDependencyAdapter`) returning default `verifyToken` / `checkRateLimit` / `requestId`
- Default `mockDisabled:true` so the endpoint cannot accidentally allow real traffic in skeleton mode
- No real Firebase Admin SDK, no real KV/DO/D1, no provider SDK, no fetch
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Deferred Work

### Can be next

| Item | Recommended Slice | Status |
|---|---|---|
| Live provider prompt / response contract | `[PRODUCT] Define Scout live-provider prompt and response contract` | ✅ Completed (#2235) |
| Prompt template + copyright policy | `[PRODUCT] Define Scout live-provider prompt and response contract` | ✅ Completed (#2235) |
| Live provider adapter skeleton | `[TECH] Add Scout live provider adapter skeleton` | ✅ Completed (#2238) |
| Endpoint adapter skeleton wiring | `[TECH] Wire Scout endpoint to adapter skeleton behind disabled live mode` | ✅ Completed (#2239) |
| Mock execution contract | `[TECH] Add Scout live provider adapter mock execution contract` | ✅ Completed (#2241) |
| Logging boundary | `[TECH] Add Scout live provider adapter logging boundary` | ✅ Completed (#2243) |
| Timeout/retry boundary | `[TECH] Add Scout live provider timeout retry boundary` | ✅ Completed (#2245) |
| Output safety filter | `[TECH] Add Scout live provider output safety filter boundary` | ✅ Completed (#2247) |
| Live provider readiness audit | `[PRODUCT] Audit Scout live provider readiness before real integration` | ✅ Completed (#2249) |
| Mock executor integration | `[TECH] Integrate Scout real provider adapter interface with existing mock executor` | ✅ Completed (#2257) |
| Post-mock integration readiness audit | `[PRODUCT] Audit Scout live-provider integration readiness after mock executor integration` | ✅ Completed (#2259) |
| Staging rollout contract | `[TECH] Add Scout live provider staging rollout contract` | ✅ Completed (#2261) |
| Auth/rate-limit persistence boundary | `[TECH] Add Scout live provider auth/rate-limit persistence boundary` | ✅ Completed (#2263) |
| Cost/quota abuse monitoring contract | `[TECH] Add Scout live provider cost/quota abuse monitoring contract` | ✅ Completed (#2265) |
| Secret rotation and incident runbook contract | `[TECH] Add Scout live provider secret rotation and incident runbook contract` | ✅ Completed (#2267) |
| Firebase auth verification implementation | `[TECH] Add Scout Firebase auth verification boundary` |  |
| Rate-limit storage implementation | `[TECH] Add Scout rate-limit persistence boundary` |  |
| Staging flag policy / deployment pipeline | `[PRODUCT] Define Scout staging feature flag process` |  |

### Still not now

| Item | Reason |
|---|---|
| Default live AI for all users | Must wait until all blockers above are resolved |
| Crawler / fetch / metadata extraction | Out of scope for Scout MVP; prohibited by existing guardrails |
| Auto-save without user review | Prohibited by existing guardrails |
| Schema migration | No DB changes until auth/rate-limit persistence is implemented |
| Browse #1661 | Separate issue, out of Scout scope |

---

## Recommended Next Slice

```
[TECH] Add Scout real provider adapter interface behind disabled live mode
```

**Why this comes next:**
- The readiness audit confirms all intermediate boundaries are in place.
- The next logical step is to build the real provider adapter interface with opt-in live mode.
- This slice would still use mock provider for testing — no real API key needed.

**Alternatives (in order of safety):**

| Slice | Risk Level | Notes |
|---|---|---|
| `[TECH] Add Scout provider secret/config documentation and deployment checklist` | 🟢 Lowest | Docs only; no code changes |
| `[TECH] Add Scout Firebase auth verification boundary` | 🟡 Low | Auth verification contract; can use test tokens |
| `[TECH] Add Scout rate-limit persistence boundary` | 🟡 Low | Storage contract; can use in-memory stub for tests |
| `[TECH] Add Scout real provider adapter interface` | 🟡 Low | Behind disabled live mode; mock-only tests |

**Caution:** Any real provider slice must NOT make real provider calls by default. All CI tests must remain network-free. Provider calls must be behind explicit opt-in config.

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

---

## Final Decision

```
The Scout AI suggestion MVP is ready for the next boundary/planning slice,
but not ready to enable live AI suggestions by default.
```

All guardrails are confirmed and locked. The system has clear boundaries between frontend, client, endpoint, and provider layers. What remains is a set of well-scoped planning/implementation slices that can be taken in any order, with the prompt contract being the safest next step.
