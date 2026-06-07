# LoveBud Scout Live Provider Staging Rollout Contract

## Document Status

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


- **Status**: Complete — defines staging/production rollout gates, kill switch, rollback, and opt-in policies for the Scout live provider path. Provider-specific adapter selection boundary added.
- **current main HEAD**: `6afb0aa5`
- **related issue**: #1882
- **Browse #1661** remains out of scope
- **current live provider status**: provider-specific adapter selection boundary added; provider-specific adapter skeleton added; disabled-by-default; no provider API call; staging_live and production_live remain blocked

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

## Endpoint Live Auth/Rate-Limit Observability Contract (slice update)

- sanitized observability contract added for endpoint live auth/rate-limit boundary decisions
- allowlist event fields: `requestId`, `providerMode`, `boundaryDecision`, `authStatus`, `rateLimitStatus`, `errorCode`, `retryAfterSeconds`, `quotaBucket`, `userKeyHash` (redacted), `latencyMs`
- prohibited fields: raw token, API key, prompt, excerpt, raw request body, full sourceUrl, raw provider output, PII, credentials
- pure helper module: `functions/api/scout/live-auth-rate-limit-observability.js`
- optional observer wired through `context.observer`; observer throw is safe-swallowed
- default stub / explicit stub: no live auth/rate-limit observability event emitted
- live mode: auth + rate-limit decisions emit one sanitized event each
- no real logging backend / no Firebase Admin SDK / no KV-DO-D1 / no provider SDK / no fetch
- endpoint default stub / frontend `local_stub` / endpoint client disabled remain preserved
- `staging_live` and `production_live` remain blocked
- `tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` — 24 sub-tests

## Live Auth/Rate-Limit Endpoint Safe-Fail Wiring (slice update)

- live auth/rate-limit endpoint safe-fail wiring added
- Live mode now routes through the auth/rate-limit boundary before any provider path
- Default endpoint behavior remains stub
- Frontend default remains local_stub
- No Firebase Admin SDK, KV, DO, D1, provider SDK, fetch, or persistence is added
- No real provider API call is enabled
- staging_live and production_live remain blocked

- Endpoint default remains **`stub`** — deterministic, network-free, no API key
- Frontend default remains **`local_stub`** — no network, no endpoint client
- Live mode safe-fails to `PROVIDER_UNAVAILABLE` or `CONFIG_MISSING` in all states
- No real provider SDK import, no fetch, no API key value propagation
- Mock-only pipeline complete: config → adapter → prompt builder → executor → timeout/retry → response validator → output safety filter → sanitized logging
- Post-mock readiness audit complete: 10 blockers identified, real provider API call verdict: **No**
- Provider-specific adapter skeleton exists, disabled by default, returns safe-fail
- Provider-specific adapter selection boundary exists, disabled-by-default, inert registry, neutral example provider only

## Purpose

- 이 문서는 Scout live provider의 staging/production rollout 조건을 정의한다.
- 실제 provider API 호출이 아니라, "언제 어떻게 live를 켤 수 있는가"를 잠근다.
- 이 문서는 운영 정책 문서이지, 실제 provider 구현이 아니다.
- 이 문서는 API key를 추가하지 않으며, endpoint behavior를 변경하지 않는다.

## Non-goals

- No real provider implementation
- No provider SDK imports
- No API keys or environment variables
- No endpoint behavior change
- No frontend behavior change
- No Firebase Admin SDK integration
- No KV/Durable Object/D1 persistence
- No persistence or auto-save
- No Browse #1661 work

## Rollout Modes

Scout suggestion provider는 5가지 모드로 동작한다.

| Mode | Description | Network | API Key Required | Default | State |
|---|---|---|---|---|---|
| `local_stub` | Browser-side deterministic stub only | No | No | ✅ Yes | Active |
| `endpoint_stub` | Server endpoint returns deterministic stub | Server only | No | No | Active |
| `live_mock` | Adapter interface uses injected mock executor | No | No | No | Active (test-only) |
| `staging_live` | Real provider call behind explicit staging env + feature flag | Yes | Yes | No | **Blocked** |
| `production_live` | Real provider call in production with full rollout gates | Yes | Yes | No | **Blocked** |

### Mode Resolution Order

1. If source selector resolves `local_stub` → `local_stub` (frontend default)
2. If source selector resolves `endpoint_client` → server endpoint `POST /api/scout/suggest`
   - Endpoint checks `SCOUT_SUGGEST_PROVIDER_MODE`:
     - `stub` (default) → `endpoint_stub`
     - `live` → resolves through `createScoutRealProviderAdapterInterface`:
       - DISABLED → `PROVIDER_UNAVAILABLE` (safe-fail)
       - CONFIG_MISSING → `CONFIG_MISSING` (safe-fail)
       - READY_FOR_ADAPTER → currently safe-fail `PROVIDER_UNAVAILABLE`
       - Future: READY_FOR_ADAPTER with env mode `staging_live` → real provider call
3. `live_mock` is test-only via injected executor — never resolved in production or staging

## Default Behavior Policy

- **Endpoint default remains `stub`**: No env var override → `SCOUT_SUGGEST_PROVIDER_MODE` resolves to `stub`.
- **Frontend default remains `local_stub`**: No feature flag → `resolveScoutSuggestionSource({})` returns `{ source: 'local_stub' }`.
- **Live mode never enabled without explicit env**: `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED` must be `true` or `1`.
- **No auto-opt-in**: No code path enables `endpoint_client` or live mode automatically.

## Staging Activation Gates

Staging에서 live provider를 활성화하기 전에 반드시 충족되어야 할 조건:

| # | Gate | Status |
|---|---|---|
| 1 | Explicit environment mode `staging_live` set | ❌ Not implemented |
| 2 | `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=true` | ✅ Exists (env config key) |
| 3 | `SCOUT_SUGGEST_LLM_PROVIDER` configured | ✅ Exists (env config key) |
| 4 | `SCOUT_SUGGEST_MODEL` configured | ✅ Exists (env config key) |
| 5 | `SCOUT_SUGGEST_LLM_API_KEY` present (presence only) | ✅ Exists (env config key) |
| 6 | Firebase auth verification enforced in staging | ❌ Not implemented |
| 7 | Persistent rate-limit storage designed | ❌ Not implemented |
| 8 | Abuse/cost/quota guardrails documented | ⚠️ Defined in checklist but not operationalized |
| 9 | Logging redaction verified (no prompt/excerpt/API key/PII) | ✅ Pass |
| 10 | Output safety filter verified | ✅ Pass |
| 11 | Timeout/retry policy verified | ✅ Pass |
| 12 | Opt-in integration tests defined | ❌ Not defined |
| 13 | Kill switch tested in staging | ❌ Not tested |
| 14 | Rollback plan verified | ⚠️ Defined in checklist but not tested |

Gates 6, 7, 8, 12, 13, 14 are **not yet satisfied**. Staging live execution is blocked until all gates are met.

> **Note:** Gates 6 (Firebase auth) and 7 (rate-limit persistence) are now defined in the [auth/rate-limit boundary document](lovebud-scout-live-provider-auth-rate-limit-boundary.md). Implementation is deferred to a future slice. Gate 8 (abuse/cost/quota guardrails) is now defined in the [cost/quota abuse monitoring contract](lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md). Gate 14 (rollback plan verified) is now defined in the [secret incident runbook contract](lovebud-scout-live-provider-secret-incident-runbook-contract.md).

## Production Activation Gates

Production에서 live provider를 활성화하기 전에 반드시 추가로 충족되어야 할 조건:

| # | Gate | Status |
|---|---|---|
| 1 | Staging soak complete (minimum 7 days with no critical incident) | ❌ Not started |
| 2 | Error budget defined (max error rate in production) | ❌ Not defined |
| 3 | Latency budget defined (p95 latency target, timeout policy) | ❌ Not defined |
| 4 | Quota ceiling defined (max requests/user/day, max tokens/day) | ❌ Not defined |
| 5 | Provider failure rollback tested (env mode revert, kill switch, verification) | ❌ Not tested |
| 6 | Kill switch tested in production-like environment | ❌ Not tested |
| 7 | Secret rotation runbook ready (who, when, how) | ⚠️ Defined in checklist but not operationalized |
| 8 | Abuse monitoring ready (anomaly detection, alerting threshold) | ❌ Not implemented |
| 9 | Manual approval obtained (product owner sign-off) | ❌ Not obtained |
| 10 | Cost monitoring dashboard operational | ❌ Not implemented |

All production gates are **not yet satisfied**. Production live execution is blocked.

## Kill Switch Policy

### Principle

A single env flag or config mode change must immediately disable the live provider path without code deployment.

### Mechanism

```text
Set SCOUT_SUGGEST_PROVIDER_MODE=stub (or unset)
  → endpoint returns providerMode:"stub"
  → no live provider call
  → no adapter invocation
  → no API key retrieval attempt
  → PROVIDER_UNAVAILABLE safe-fail eliminated (clean stub response)
```

Or alternatively:

```text
Set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false (or unset)
  → adapter interface returns DISABLED
  → endpoint returns PROVIDER_UNAVAILABLE
  → no live provider call
```

### Kill Switch Verification

```text
1. Before live activation: verify kill switch works in staging
2. Set SCOUT_SUGGEST_PROVIDER_MODE=stub (or unset)
3. POST to /api/scout/suggest with valid input
4. Verify response providerMode is "stub", not "live"
5. Verify no provider call occurred (no adapter invocation, no fetch)
6. Verify default frontend still uses local_stub
```

### Emergency Kill Switch

In case of live provider incident:

```text
1. Immediately set SCOUT_SUGGEST_PROVIDER_MODE=stub
2. Set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
3. Verify endpoint returns providerMode:"stub"
4. Verify frontend returns to local_stub (no endpoint_client retry)
5. Rotate provider API key if exposure suspected
6. Review logs for secret leakage
7. Document incident
```

## Rollback Policy

### From staging_live to local_stub/endpoint_stub

```text
1. Set SCOUT_SUGGEST_PROVIDER_MODE=stub (or unset)
2. Set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
3. Optionally remove staging secrets (SCOUT_SUGGEST_LLM_API_KEY)
4. Verify endpoint returns providerMode:"stub"
5. Verify frontend uses local_stub
6. Verify no auto-save occurred (should never happen — guardrail)
```

### From production_live to staging_live or stub

```text
1. Set SCOUT_SUGGEST_PROVIDER_MODE=stub (immediate kill)
2. Set SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=false
3. Rotate provider API key
4. Notify product owner
5. Document incident and root cause
6. Schedule post-mortem
```

### Rollback Safety

- No data migration rollback required — no persistence or auto-save exists
- No DB schema rollback required — no DB changes in Scout live provider path
- No frontend bundle rollback required — frontend behavior is independent of live mode
- Only env/config changes needed — no code deployment required for kill

## Opt-in Policy

| Component | Opt-in Mechanism | Default | Status |
|---|---|---|---|
| `endpoint_client` | `isScoutSuggestionEndpointClientEnabled()` → explicit feature flag `true` or `1` | `false` (disabled) | ✅ Locked |
| Source selector `endpoint_client` | `resolveScoutSuggestionSource()` → needs `endpointClientEnabled` flag | `local_stub` | ✅ Locked |
| `staging_live` mode | Explicit `SCOUT_SUGGEST_PROVIDER_MODE=live` + `SCOUT_SUGGEST_LIVE_ADAPTER_ENABLED=true` + staging auth/rate-limit | `stub` | ⚠️ Defined, not gated |
| `production_live` mode | All production gates + manual approval | `stub` | ❌ Blocked |
| Integration tests with live provider | Opt-in test flag, skipped by default in CI | Skipped | ❌ Not defined |

### Rules

1. `endpoint_client` cannot auto-enable based on environment detection — explicit flag required.
2. Source selector default remains `local_stub` in all environments without explicit flag.
3. `staging_live` requires explicit env mode + feature flag + staging-specific auth/rate-limit.
4. `production_live` requires all production gates, manual approval, and cannot be toggled by code change alone.
5. Live provider integration tests must be opt-in and skipped by default in CI.

## Monitoring Policy

### Allowed Safe Fields (Observability)

```text
- requestId
- providerMode
- adapterStatus (from createScoutRealProviderAdapterInterface)
- errorCode
- latencyMs
- retryCount
- maxRetries
- rateLimitTier (free/authenticated)
- outputFieldCount
- emotionTagCount
- hasSourceUrl
- language
- tone
- timestamp
```

### Prohibited Fields (Never Logged)

```text
- prompt (raw assembled prompt)
- excerpt (user-entered text)
- summary (user-entered text)
- memo (user-entered text)
- rawProviderResponse
- rawModelOutput
- sourceUrl (full URL with query parameters that may contain PII)
- apiKey / SCOUT_SUGGEST_LLM_API_KEY
- token / authorization / bearer
- cookie / session
- Firebase credential / uid / email / phone
- password / secret
```

### Logging Rules

1. All log events must pass through `sanitizeScoutLiveProviderLogPayload` or equivalent sanitization.
2. Logger failures must never break suggestion flow.
3. Structured log format (JSON) recommended for production.
4. Log sampling may be introduced at high volume — but no field filtering after initial sanitization.

## Preflight Checklist Before First Real Provider Adapter

Before implementing any real provider (OpenAI-compatible, Anthropic, etc.):

- [ ] Staging rollout contract exists (this document ✅)
- [ ] Kill switch mechanism defined and tested in staging
- [ ] Rollback policy documented
- [ ] Opt-in policy documented
- [ ] Monitoring allowed/prohibited fields documented
- [ ] Firebase auth enforcement decision made (enforce or skip for staging)
- [ ] Rate-limit persistence decision made (KV/Durable Object/D1 or skip for staging)
- [ ] Cost/quota guardrails defined (minimal for staging)
- [ ] Opt-in integration test policy defined
- [ ] Error code mapping for real provider failures defined
- [ ] Provider-specific secret management process operationalized

## Verdict

| Question | Answer |
|---|---|
| Ready for staging rollout contract work | ✅ Yes (this document) |
| Ready for staging live execution | ❌ No — 6 staging gates not satisfied |
| Ready for production live execution | ❌ No — all production gates not satisfied |
| Ready for real provider API call in this slice | ❌ No — docs+tests only |
| Endpoint default remains stub | ✅ Yes |
| Frontend default remains local_stub | ✅ Yes |
| Kill switch documented | ✅ Yes |
| Rollback policy documented | ✅ Yes |
| Opt-in policy documented | ✅ Yes |
| Monitoring policy documented | ✅ Yes |

## Recommended Next Slice

```
[TECH] Add Scout live provider auth/rate-limit persistence boundary
```

**Why:** After staging rollout gates are defined, the next concrete blocker is Firebase auth enforcement and persistent rate-limit storage. This slice would design the auth verification and rate-limit storage contract without implementing real Firebase or KV/Durable Objects — keeping the contract testable with stubs.

**What it would include:**
- Firebase token verification contract (mock token for tests, real Admin SDK decision deferred)
- Rate-limit persistence contract (in-memory stub for tests, KV/Durable Object decision deferred)
- Updated staging activation gates for auth/rate-limit
- No real Firebase Admin SDK integration
- No KV/Durable Object/D1 persistence implemented
- No API keys or credentials

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

## Dependency Adapter Skeleton Status

A [dependency adapter skeleton](lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveDependencyAdapter`) returning default `verifyToken` / `checkRateLimit` / `requestId`
- Default `mockDisabled:true` so the endpoint cannot accidentally allow real traffic in skeleton mode
- No real Firebase Admin SDK, no real KV/DO/D1, no provider SDK, no fetch
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## Non-goals (this document)

- ❌ No real provider implementation
- ❌ No provider SDK imports
- ❌ No API keys or environment variables
- ❌ No endpoint behavior change
- ❌ No frontend behavior change
- ❌ No Firebase Admin SDK integration
- ❌ No KV/Durable Object/D1 persistence
- ❌ No persistence or auto-save
- ❌ No Browse #1661 work

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
