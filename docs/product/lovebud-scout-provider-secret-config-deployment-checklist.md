# LoveBud Scout Provider Secret Config Deployment Checklist

## Baseline

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


- current main HEAD: `f7d37545`
- related issue: #1882
- Browse #1661 remains out of scope
- current provider status: provider-specific adapter skeleton added behind disabled mode; provider-specific adapter selection boundary added (inert registry, neutral example provider only)
- endpoint default remains stub
- frontend default remains local_stub
- no real provider API call is made, no SDK/fetch/credentials

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
19. secret rotation and incident runbook contract exists (secret storage/rotation, emergency revocation, incident response, compromise handling documented).
20. post-mock readiness audit exists (blocker inventory + next gate definition).

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

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
