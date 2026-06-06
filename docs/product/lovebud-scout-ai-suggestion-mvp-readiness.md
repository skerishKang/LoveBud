# LoveBud Scout AI Suggestion MVP Readiness Audit

## Baseline

- **current main HEAD**: `bbac249d`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **recently merged Scout PRs**: #2203–#2231 inclusive (Scout Draft MVP through endpoint opt-in QA)
- **current open PR count**: 0
- **current open issues**: #1882 (Scout MVP), #1661 (Browse sorting / out of scope)

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
| 12 | Live-provider prompt/response contract | #2235 | ✅ Complete |

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

3. **Live provider adapter does not exist** — There is no `LiveProvider` class implementing the provider abstraction (`createScoutSuggestionProvider` interface). The `suggest.js` endpoint always returns stub responses even when live provider mode is selected.

4. **Provider prompt/copyright policy — resolved** ❌ → ✅ Live-provider prompt and response contract is now defined. See [lovebud-scout-live-provider-prompt-response-contract.md](lovebud-scout-live-provider-prompt-response-contract.md).

5. **Abuse handling and logging need implementation** — No structured logging, metrics, or abuse detection exists in the endpoint. Observability section in the endpoint boundary doc defines desirable metrics but nothing is wired.

6. **Staging feature flag process needs definition** — How `endpoint_client` is enabled in staging vs production is not documented. The `endpointClientEnabled` config is a code-level flag with no deployment pipeline integration.

7. **Live provider tests must remain opt-in and network-free by default** — Any future live provider implementation must preserve the contract that CI tests run without network calls. A mock provider or stub must remain the default test path.

---

## Deferred Work

### Can be next

| Item | Recommended Slice |
|---|---|
| Live provider prompt / response contract | `[PRODUCT] Define Scout live-provider prompt and response contract` — ✅ COMPLETED |
| Prompt template + copyright policy | `[PRODUCT] Define Scout live-provider prompt and response contract` — ✅ COMPLETED |
| Live provider adapter skeleton | `[TECH] Add Scout live provider adapter skeleton` |
| Firebase auth verification implementation | `[TECH] Add Scout Firebase auth verification boundary` |
| Rate-limit storage implementation | `[TECH] Add Scout rate-limit persistence boundary` |
| Staging flag policy / deployment pipeline | `[PRODUCT] Define Scout staging feature flag process` |

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

```text
[TECH] Add Scout live provider adapter skeleton
```

**Why this comes next:** The prompt and response contract is now defined. The next step is to build the adapter interface, prompt builder, and response validator — still without making any real provider call.

**Caution:** Live provider adapter skeleton should still not make real provider calls until auth, rate-limit, and deployment pipeline blockers are resolved.

---

## Final Decision

```
The Scout AI suggestion MVP is ready for the next boundary/planning slice,
but not ready to enable live AI suggestions by default.
```

All guardrails are confirmed and locked. The system has clear boundaries between frontend, client, endpoint, and provider layers. What remains is a set of well-scoped planning/implementation slices that can be taken in any order, with the prompt contract being the safest next step.
