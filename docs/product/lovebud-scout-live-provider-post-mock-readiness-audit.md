# LoveBud Scout Live Provider Post-Mock Integration Readiness Audit

## Baseline

- **current main HEAD**: `e2697d76`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **recent completion**: Mock executor integration (PR #2258) — real provider adapter interface can route through existing mock pipeline when injected executor is present

## Audit Date / Status

- **Audit date**: 2026-06-06
- **Status**: Complete — post-mock integration readiness gap analysis

## Audit Purpose

- 실제 provider API 연동 전 readiness를 재점검한다.
- Mock executor integration 이후 구현된 경계를 인벤토리한다.
- 실제 provider 구현 전에 해결해야 할 blocker와 gate를 고정한다.
- 이 문서는 audit-only로, 실제 provider call을 추가하지 않는다.

## Current Implemented Boundaries Inventory

| Boundary | Status | Evidence |
|---|---|---|
| Manual Scout save flow | ✅ Pass | 기존 파일/테스트 |
| Local stub provider | ✅ Pass | scout-suggestion-provider |
| Draft modal suggestion button | ✅ Pass | scout-draft-ui |
| Serverless endpoint skeleton | ✅ Pass | functions/api/scout/suggest.js |
| Auth/rate-limit contract | ✅ Partial | parsing/policy only, no real Firebase/storage |
| Live config boundary | ✅ Pass | CONFIG_MISSING safe fail |
| Endpoint client | ✅ Pass | disabled by default |
| Source selector | ✅ Pass | local_stub default |
| Endpoint opt-in QA | ✅ Pass | mock fetch only |
| Prompt/response contract | ✅ Pass | docs + tests |
| Product Prompt safety note | ✅ Pass | EN/KR canonical |
| Adapter skeleton | ✅ Pass | no real call |
| Mock executor path | ✅ Pass | network-free |
| Logging boundary | ✅ Pass | safe observability only |
| Timeout/retry boundary | ✅ Pass | mock executor only |
| Output safety filter | ✅ Pass | unsafe output → PROVIDER_ERROR |
| Secret/config/deployment checklist | ✅ Pass | docs + contract |
| Readiness audit (pre-mock) | ✅ Pass | #2249 |
| Real provider adapter interface | ✅ Pass | config normalization + disabled safe-fail |
| Disabled-mode endpoint contract | ✅ Pass | endpoint live mode → PROVIDER_UNAVAILABLE/CONFIG_MISSING |
| Mock executor integration | ✅ Pass | ready_for_adapter + executor → full mock pipeline |
| **Post-mock readiness audit (this PR)** | ✅ **New** | blocker inventory + next gate definition |

## Confirmed Mock-Only Pipeline

```
config → normalizeScoutLiveProviderConfig
       → createScoutRealProviderAdapterInterface
       → (if READY_FOR_ADAPTER + executor) createScoutLiveProviderAdapter
         → buildScoutLiveProviderPrompt (prompt builder)
         → injected executor (mock-only, network-free)
         → runScoutLiveProviderExecutorWithTimeout (timeout/retry boundary)
         → validateScoutLiveProviderResponse (response validator + output safety filter)
         → createScoutLiveProviderLogEvent (sanitized logging)
       → normalized suggestion response
```

Mock-only pipeline is verified complete. All components are wired together and pass contract tests. No real provider call occurs — executor must be explicitly injected for test/contract use.

## Confirmed Default Behavior

- **Endpoint default remains stub**: Default POST to `/api/scout/suggest` without `SCOUT_SUGGEST_PROVIDER_MODE=live` returns `providerMode:"stub"`.
- **Frontend default remains local_stub**: Source selector defaults to `local_stub`; `endpoint_client` requires explicit feature flag.
- **Live mode without executor safe-fails**: READY_FOR_ADAPTER without injected executor returns `PROVIDER_UNAVAILABLE`.
- **Disabled/config_missing states never run executor**: DISABLED and CONFIG_MISSING states skip executor entirely.

## Confirmed Guardrails

| Guardrail | Status | Evidence |
|---|---|---|
| No SDK import (OpenAI/Anthropic/Gemini/Groq/Mistral/NVIDIA) | ✅ Pass | live-provider-adapter.js + suggest.js grep |
| No fetch/XMLHttpRequest/axios | ✅ Pass | live-provider-adapter.js + suggest.js grep |
| No provider API call | ✅ Pass | all adapter states safe-fail |
| No API key value propagation | ✅ Pass | hasApiKey boolean only; no key value in pipeline/result/log |
| No persistence | ✅ Pass | no localStorage/sessionStorage/addMemory |
| No auto-save | ✅ Pass | no .save() call in suggestion modules |
| sourceUrl attribution-only | ✅ Pass | never fetched |
| Default endpoint stub preserved | ✅ Pass | contract tests verify |
| Frontend local_stub preserved | ✅ Pass | source selector contract tests |
| createScoutLiveProviderAdapter export preserved | ✅ Pass | module exports unchanged |
| Logging excludes prompt/excerpt/sourceUrl/API key/PII | ✅ Pass | #2244 tests + #2258 tests |
| Timeout/retry bounded | ✅ Pass | #2246 tests |
| Output safety filter applied | ✅ Pass | #2248 tests |
| CONFIG_MISSING safe fallback | ✅ Pass | endpoint/adapter/interface tests |

## Remaining Blockers Before Real Provider Implementation

1. **Firebase auth verification still placeholder only** — `verifyScoutFirebaseToken()` is a TODO comment in `suggest.js`. No real Firebase Admin SDK integration exists to authenticate users or associate requests with accounts.

2. **Persistent rate-limit storage still placeholder only** — `checkScoutRateLimit()` is a TODO comment. Without KV/Durable Object/D1 storage, rate limits cannot be enforced across requests.

3. **Staging rollout contract not yet locked** — No documented staging-specific rollout gates, env isolation, preview branch policy, or staging→production promotion workflow exists beyond code-level flags.

4. **Cost/quota controls not yet locked** — No spending limits, per-user request caps, budget tracking, or cost monitoring mechanisms exist.

5. **Abuse monitoring not yet locked** — No usage anomaly detection, abuse pattern analysis, or operational alerting exists beyond the safe logging boundary.

6. **Secret rotation process not operationalized** — How provider API keys will be rotated, who triggers rotation, and what runbook covers exposure incidents is defined at checklist level but not operationalized.

7. **Opt-in live integration test policy not yet added** — No explicit policy for how provider-specific integration tests must be opt-in, skipped by default, and never run in CI without explicit flag.

8. **Provider-specific adapter not implemented** — No real provider SDK adapter (OpenAI-compatible, Anthropic, etc.) exists. Only mock executor path is wired.

9. **Real provider error mapping not tested** — How real provider errors (rate limit, quota exceeded, auth failure, model overload, content filter) map to standardized error codes is not tested or implemented.

10. **Production rollback/kill-switch not verified in code** — The deployment checklist defines a rollback plan, but the code-level kill-switch (set `SCOUT_SUGGEST_PROVIDER_MODE` back to stub) is not verified by contract test as an emergency path.

## Gates for First Real Provider Slice

실제 provider adapter를 구현하기 전에 반드시 충족되어야 할 조건:

- [ ] server/serverless only — no frontend provider call
- [ ] live mode disabled by default
- [ ] no frontend API key
- [ ] no default UI endpoint_client
- [ ] provider call behind explicit env/config
- [ ] CONFIG_MISSING remains safe fallback
- [ ] prompt builder and response validator must be used
- [ ] output safety filter must be applied
- [ ] logging must remain sanitized
- [ ] timeout/retry policy must remain bounded
- [ ] sourceUrl must not be fetched
- [ ] no auto-save
- [ ] mock-only integration pipeline verified complete (✅ done in PR #2258)
- [ ] staging rollout contract locked (❌ next recommended slice)
- [ ] auth/rate-limit persistence decision made (❌ pending)

## Verdict

```
Ready for staging rollout contract work: Yes
Ready for real provider API call: No
```

| Question | Answer |
|---|---|
| Mock-only pipeline complete? | ✅ Yes — all 18 components verified (PR #2258) |
| Ready for real provider API call? | ❌ No — 10 blockers remain |
| Ready for auth/rate-limit persistence slice? | ❌ No — separate infra slice needed |
| Ready for staging rollout contract work? | ✅ Yes — docs-only slice with no code change risk |
| Ready for cost/quota/abuse monitoring slice? | ❌ No — needs staging rollout first |
| Endpoint default remains stub? | ✅ Yes — verified by contract |
| Frontend default remains local_stub? | ✅ Yes — verified by contract |

## Recommended Next Slice

```
**[TECH] Add Scout live provider staging rollout contract** → ✅ Completed (PR #2261)
```

**Why:**
- Staging rollout contract is the highest-priority blocker that can be resolved without real provider calls, API keys, or infra changes.
- It is a docs+tests slice that locks the staging→production promotion workflow, env isolation, and kill-switch verification.
- It does not require Firebase auth, rate-limit storage, or any operational decision — it formalizes what is already implicit.

**Alternative:**
```
[TECH] Add Scout live provider auth/rate-limit persistence boundary
```
This requires KV/Durable Object/D1 decisions and is higher risk. Recommend staging rollout first.

## Next Steps Beyond Staging Rollout

1. ~~`[TECH] Add Scout live provider staging rollout contract`~~ ✅ Completed (PR #2261)
2. ~~`[TECH] Add Scout live provider auth/rate-limit persistence boundary`~~ ✅ Completed (PR #2263)
3. ~~`[TECH] Add Scout live provider cost/quota control boundary`~~ ✅ Completed (PR #2265)
4. ~~`[TECH] Add Scout live provider abuse monitoring boundary`~~ ✅ Completed (PR #2265 — part of cost/quota contract)
5. `[TECH] Add Scout live provider integration test policy`
6. `[PRODUCT] Code-level kill-switch contract for Scout live provider`
7. `[TECH] Add Scout first real provider adapter (behind disabled live mode)`

**Caution for #7:** The first real provider adapter still must:
- No default live usage
- Tests mock-only by default
- Provider call behind explicit opt-in
- No API key committed
- CI must remain network-free

## Non-goals

- ❌ No real provider in this PR
- ❌ No API keys
- ❌ No provider SDK imports
- ❌ No live API call
- ❌ No external fetch
- ❌ No crawler
- ❌ No metadata extraction
- ❌ No auto-save
- ❌ No schema migration
- ❌ No Firebase Admin SDK integration
- ❌ No KV/Durable Object/D1 rate-limit persistence
- ❌ No #1661 Browse work
