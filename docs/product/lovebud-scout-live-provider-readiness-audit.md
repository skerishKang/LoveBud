# LoveBud Scout Live Provider Readiness Audit

## Baseline

- **current main HEAD**: `34ab91a5`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **Browse #1661** remains out of scope
- **open PR count**: 0
- **current live provider status**: not implemented, not enabled by default

## Audit Purpose

- 실제 provider/API key를 넣기 전에 readiness를 점검한다.
- 지금까지 구현한 boundary가 live integration을 감당할 수 있는지 본다.
- 이번 문서는 구현이 아니라 audit이다.
- default live AI usage는 여전히 금지다.

## Implemented Boundary Inventory

| Boundary | Status | Evidence |
|---|---|---|
| Manual Scout save flow | Pass | 기존 파일/테스트 |
| Local stub provider | Pass | scout-suggestion-provider |
| Draft modal suggestion button | Pass | scout-draft-ui |
| Serverless endpoint skeleton | Pass | functions/api/scout/suggest.js |
| Auth/rate-limit contract | Partial | parsing/policy only, no real Firebase/storage |
| Live config boundary | Pass | CONFIG_MISSING safe fail |
| Endpoint client | Pass | disabled by default |
| Source selector | Pass | local_stub default |
| Endpoint opt-in QA | Pass | mock fetch only |
| Prompt/response contract | Pass | docs + tests |
| Product Prompt safety note | Pass | EN/KR canonical |
| Adapter skeleton | Pass | no real call |
| Mock executor path | Pass | network-free |
| Logging boundary | Pass | safe observability only |
| Timeout/retry boundary | Pass | mock executor only |
| Output safety filter | Pass | unsafe output → PROVIDER_ERROR |
| Secret/config/deployment checklist | Pass | docs + contract |
| Real provider adapter interface | Pass | config normalization + disabled safe-fail |
| Disabled-mode endpoint contract | Pass | endpoint live mode → PROVIDER_UNAVAILABLE/CONFIG_MISSING |
| Mock executor integration | Pass | ready_for_adapter + executor → full mock pipeline |
| Post-mock readiness audit | Pass | blocker inventory + next gate definition (PR #2259) |
| Staging rollout contract | Pass | rollout modes, kill switch, rollback, opt-in policy (PR #2261) |
| Auth/rate-limit persistence boundary | Pass | Firebase auth enforcement, persistent rate-limit storage requirements, quota policy (PR #2263) |
| Cost/quota abuse monitoring contract | Pass | cost caps, quota budget, abuse monitoring, provider failure accounting (PR #2265) |

## Readiness Verdict

```
Ready to plan a narrow real-provider adapter integration behind disabled live mode, but not ready for default live AI usage.
```

명확히 구분:

- **Ready for a narrow implementation slice**: Yes, with restrictions.
- **Ready for production/default live usage**: No.
- **Ready for frontend default endpoint_client**: No.

## Guardrails Confirmed

| Guardrail | Status | Evidence |
|---|---|---|
| No frontend API key | Pass | endpoint client/source selector tests |
| Default source remains local_stub | Pass | source selector tests |
| Endpoint default remains stub | Pass | endpoint tests |
| No real provider SDK import | Pass | adapter tests |
| No fetch/external source retrieval | Pass | guardrail tests |
| No auto-save | Pass | draft/save guardrails |
| CONFIG_MISSING safe fallback | Pass | live config tests |
| Response validation required | Pass | adapter validator |
| Output safety filter applied | Pass | #2248 tests |
| Logging excludes prompt/PII/secrets | Pass | #2244 tests |
| Timeout/retry bounded | Pass | #2246 tests |

## Still Not Ready / Blockers

1. **Firebase auth verification is still placeholder only** — `verifyScoutFirebaseToken()` is a TODO comment in `suggest.js`. Without real Firebase Admin SDK integration, there is no way to authenticate users or associate suggestion requests with accounts.

2. **Persistent rate-limit storage is still placeholder only** — `checkScoutRateLimit()` is a TODO comment. Without persistent storage (KV, Durable Objects, D1), rate limits cannot be enforced across requests.

3. **Real provider adapter implementation does not exist** — The adapter skeleton exists, but no real provider SDK integration, prompt execution, or response parsing is implemented. Only mock executor paths exist.

4. **Provider-specific secret management process is not implemented** — No documented process for how provider API keys will be injected, rotated, or audited in production.

5. **Staging feature-flag rollout process is not fully defined** — How `endpoint_client` or live mode is enabled in staging vs production is not documented beyond code-level flags.

6. **Abuse monitoring / operational alerting is not implemented beyond safe logging boundary** — No cost/quota controls, no usage alerts, no anomaly detection wired.

7. **Cost/quota controls are not implemented** — No spending limits, per-user request caps, or budget tracking mechanisms exist.

8. **No real-provider integration tests exist, and they must remain opt-in/network-off by default** — CI must remain network-free; any future provider test must use mock providers by default.

9. **GitGuardian false positive around safety patterns should be documented as advisory-only if recurring** — The safety filter patterns (`password-like`, `secret-like` values in detection arrays) may trigger false positives. These are safety code, not leaked secrets.

## Conditions for First Real Provider Slice

실제 provider를 붙이는 첫 slice의 조건:

- server/serverless only
- live mode disabled by default
- no frontend API key
- no default UI endpoint_client
- provider call behind explicit env/config
- CONFIG_MISSING remains safe fallback
- prompt builder and response validator must be used
- output safety filter must be applied
- logging must remain sanitized
- timeout/retry policy must remain bounded
- sourceUrl must not be fetched
- no auto-save

## Recommended Next Slice

```
[TECH] Add Scout real provider adapter interface behind disabled live mode
```

다만 이 slice도 실제 provider API를 호출하지 않고, provider-specific adapter interface와 config contract만 먼저 만드는 방향이 더 안전할 수 있다.

**더 안전한 대안:**

- `[TECH] Add Scout provider secret/config documentation and deployment checklist`
- `[TECH] Add Scout Firebase auth verification boundary`
- `[TECH] Add Scout rate-limit persistence boundary`
- `[PRODUCT] Define Scout live suggestion staging rollout checklist`

**실제 provider integration으로 간다면:**

```
[TECH] Add Scout real provider adapter behind disabled live mode
```

조건:
- no default live usage
- tests mock-only by default
- provider call behind explicit opt-in
- no API key committed
- CI must remain network-free

## Final Decision

```
The Scout live provider path is ready for a narrow, disabled-by-default real-provider adapter planning slice,
but not ready for default live AI usage or frontend default endpoint routing.
```

## Non-goals

- no real provider in this PR
- no API keys
- no provider SDK imports
- no live API call
- no external fetch
- no crawler
- no metadata extraction
- no auto-save
- no schema migration
- no #1661 Browse work
