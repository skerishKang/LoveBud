# LoveBud Scout Provider Secret Config Deployment Checklist

## Baseline

- current main HEAD: `6a28387e`
- related issue: #1882
- Browse #1661 remains out of scope
- current provider status: real provider adapter interface added (disabled by default)
- endpoint default remains stub
- frontend default remains local_stub

## Purpose

- 실제 provider 구현 전에 secret/config/deployment 운영 기준을 고정한다.
- 이 문서는 API key를 추가하지 않는다.
- 이 문서는 provider call을 추가하지 않는다.
- future live provider integration은 disabled-by-default 원칙을 따라야 한다.

## Secret Management Rules

- no secrets committed to repository
- no `.env` committed
- no API key in frontend JS
- no API key in HTML
- no API key in docs examples
- no API key in tests
- no secret values in logs
- no secret values in error messages
- no secret values in screenshots/artifacts
- secrets must be managed through deployment platform secret storage only

## Allowed Future Config Names

예시 이름은 문서화하되 실제 값을 넣지 않는다.

```
SCOUT_SUGGEST_PROVIDER_MODE
SCOUT_SUGGEST_LLM_PROVIDER
SCOUT_SUGGEST_MODEL
SCOUT_SUGGEST_LLM_API_KEY
SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED
SCOUT_SUGGEST_TIMEOUT_MS
SCOUT_SUGGEST_MAX_RETRIES
SCOUT_SUGGEST_LLM_BASE_URL
```

정책:

- names may appear in docs/code as config keys
- values must never appear
- missing values must return CONFIG_MISSING
- config names must not be shown in user-facing error messages if they reveal secret structure
- frontend must never read provider API key config

## Deployment Storage Policy

- Cloudflare Pages/Workers secret storage only for API keys
- preview/staging/prod separated
- no shared production secret in preview
- rotation process required
- least privilege key if provider supports scoped keys
- manual operator confirmation before enabling live mode
- rollback plan required before live mode enablement

## Staging Rollout Checklist

- [ ] main is green
- [ ] open PR count is 0
- [ ] endpoint default stub verified
- [ ] frontend default local_stub verified
- [ ] staging secret exists only in platform secret storage
- [ ] live mode remains disabled
- [ ] explicit staging flag required
- [ ] test request uses non-sensitive sample input
- [ ] logs checked for no prompt/excerpt/sourceUrl/token leakage
- [ ] CONFIG_MISSING path verified
- [ ] PROVIDER_ERROR path verified
- [ ] output safety filter verified
- [ ] no auto-save verified

## Production Rollout Checklist

- [ ] staging checklist passed
- [ ] cost/quota limit confirmed
- [ ] abuse monitoring confirmed
- [ ] Firebase auth verification decision confirmed
- [ ] rate-limit persistence decision confirmed
- [ ] rollback owner identified
- [ ] live mode still disabled by default
- [ ] product owner approval required
- [ ] emergency disable path documented

## Rollback / Kill Switch

- set provider mode back to stub
- remove/disable live adapter flag
- rotate provider key if exposed
- verify endpoint returns providerMode:"stub"
- verify frontend remains local_stub
- verify no auto-save occurred
- review logs for secret leakage
- document incident if needed

## CI and Test Policy

- CI must remain network-free by default
- no real provider calls in CI
- mock executor only
- contract tests must not require secrets
- tests must pass without env vars
- provider-specific integration tests must be opt-in and skipped by default
- no snapshots containing secrets or prompt raw text

## Logging / Observability Policy

- allowed: requestId, providerMode, status, errorCode, latencyMs, retryCount, timeoutMs
- prohibited: prompt, excerpt, summary, memo, sourceUrl raw, API key, token, cookie, session, Firebase credential, PII, raw provider response
- logger failures must not break suggestion flow
- logs must be sanitized before write

## User-Facing Safety Policy

- user sees suggestion only
- user must review before saving
- manual save remains available
- no auto-save
- errors should be safe and non-technical
- no secret/config details in UI errors
- no claim that URL was fetched/read if only sourceUrl string was provided

## Required Pre-Integration Gates

실제 provider adapter 전 gate:

1. secret/config checklist exists and passes contract.
2. prompt/response contract exists.
3. output safety filter exists.
4. logging boundary exists.
5. timeout/retry boundary exists.
6. endpoint default remains stub.
7. frontend default remains local_stub.
8. provider integration PR proves no default live usage.
9. CI remains network-free.
10. rollback plan documented.
11. disabled-mode endpoint contract exists (live mode recognizes adapter interface states).
12. mock executor integration exists (ready_for_adapter + executor → full mock pipeline).
14. staging rollout contract exists (rollout modes, kill switch, rollback, opt-in policy documented).
17. auth/rate-limit persistence boundary exists (Firebase auth enforcement, persistent storage requirements, quota policy documented).
18. cost/quota abuse monitoring contract exists (cost caps, quota budget, abuse monitoring, provider failure accounting documented).
19. post-mock readiness audit exists (blocker inventory + next gate definition).

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

## Recommended Next Slice

```
[TECH] Add Scout real provider adapter interface behind disabled live mode
```

단, 여전히 실제 provider call이 아니라 provider-specific adapter interface/config contract까지만 먼저 갈 수 있다고 명시한다.

더 안전한 대안:

- [TECH] Add Scout Firebase auth verification boundary
- [TECH] Add Scout rate-limit persistence boundary
- [PRODUCT] Define Scout live suggestion staging rollout checklist

## Final Decision

```
The Scout provider secret/config checklist is ready to guide a future disabled-by-default provider adapter interface,
but this PR adds no provider call, no API key, and no live default behavior.
```
