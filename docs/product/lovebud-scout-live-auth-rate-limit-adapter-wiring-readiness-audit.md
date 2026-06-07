# Scout Live Auth/Rate-Limit Adapter Wiring Readiness Audit

> Status: **audit complete (mock-disabled stage)**
> Version: v20260607-1
> Audience: Scout live provider engineering, CTO, Document Lead
> Scope: comprehensive audit of the mock-disabled live auth/rate-limit
> adapter wiring before any runtime implementation gate.
> Related issue: #1882

## 1. Purpose

This document audits the **completed mock-disabled live auth/rate-limit
adapter wiring** before any runtime implementation gate contract is
introduced. It inventories every mock-disabled piece — auth verifier
adapter skeleton, auth verifier dependency wiring, rate-limit storage
adapter skeleton, storage adapter dependency wiring, dependency adapter
endpoint wiring, endpoint error taxonomy, observability, DI, and
safe-fail boundaries — and confirms they are aligned, fail-closed, and
do not reach any external runtime backend.

The goal of this audit is to give the next reviewer a single source of
truth for the current state so that the runtime implementation gate
contract can be added without surprise gaps.

## 2. Non-goals

- No runtime behavior changes
- No endpoint code changes
- No real LLM provider implementation
- No live provider API call
- No provider SDK imports
- No Firebase Admin SDK integration
- No real Firebase token verification
- No KV / Durable Object / D1 implementation
- No runtime persistent rate-limit storage call
- No external observability / logging backend integration
- No external URL fetching
- No crawler or metadata extraction
- No frontend default endpoint_client behavior
- No source selector default change
- No backend / schema migration
- No automatic save
- No Browse #1661 work

## 3. Baseline commit

- main HEAD at audit time: `3ac2d940` (post PR #2304)
- last runtime code change: PR #2304 (`refactor(scout): wire auth
  verifier into live dependency mock path`)
- last test-only / docs-only change: none yet (this audit is the first
  pure audit slice)
- open issues at audit time: #1882, #1661, #2281, #2234
- pre-existing test failure bucket: 3 editor-canvas failures (out of
  scope for this audit)

## 4. Completed wiring inventory

| # | Slice | Module / Contract | Status |
|---|-------|-------------------|--------|
| 1 | Auth verifier adapter skeleton | `functions/api/scout/live-auth-verifier-adapter.js` | **Done** |
| 2 | Auth verifier dependency wiring | `live-auth-rate-limit-dependency-adapter.js` `verifierAdapter` option | **Done** |
| 3 | Rate-limit storage adapter skeleton | `functions/api/scout/live-rate-limit-storage-adapter.js` | **Done** |
| 4 | Storage adapter dependency wiring | `live-auth-rate-limit-dependency-adapter.js` `storageAdapter` option | **Done** |
| 5 | Dependency adapter endpoint wiring | `functions/api/scout/suggest.js` LIVE branch `liveDependencies` | **Done** |
| 6 | Endpoint error taxonomy | `SCOUT_LIVE_ENDPOINT_ERROR_TAXONOMY` codes | **Done** |
| 7 | Endpoint error readiness audit | `scout-live-endpoint-error-readiness-audit` doc + contract | **Done** |
| 8 | Endpoint observability | `live-auth-rate-limit-observability.js` allowlist + ring buffer | **Done** |
| 9 | Endpoint DI | `liveDependencies = { verifyToken, checkRateLimit, observer, requestId }` | **Done** |
| 10 | Endpoint safe-fail wiring | `live-auth-rate-limit-boundary.js` safe-fail mappings | **Done** |
| 11 | Boundary reconcile | `live-auth-rate-limit-boundary.js` canonical / `live-provider-auth-rate-limit-boundary.js` not adopted | **Done** |
| 12 | Runtime boundary | `live-auth-rate-limit-boundary.js` mock-disabled default | **Done** |

All 12 items are locked by contract tests (see §13).

## 5. Confirmed default behavior

| Default | Status | Source of truth |
|---------|--------|-----------------|
| `createScoutLiveAuthVerifierAdapter` default `mockDisabled: true` | Confirmed | module default + skeleton test |
| `createScoutLiveRateLimitStorageAdapter` default `mockDisabled: true` | Confirmed | module default + skeleton test |
| `createScoutLiveDependencyAdapter` default `mockDisabled: true` | Confirmed | module default + skeleton test |
| `createScoutLiveDependencyAdapter` default `verifierAdapter` is mock-disabled | Confirmed | verifier dependency wiring test |
| `createScoutLiveDependencyAdapter` default `storageAdapter` is mock-disabled | Confirmed | storage dependency wiring test |
| Endpoint `providerMode` default `"stub"` in `suggest.js` | Confirmed | endpoint wiring test |
| Explicit `providerMode: "stub"` path | Confirmed | endpoint wiring test |
| Frontend source selector default `local_stub` | Confirmed | source selector contract |
| Frontend endpoint client default disabled | Confirmed | endpoint client contract |
| Dependency adapter object remains frozen | Confirmed | all wiring tests |

## 6. Confirmed auth path

- `verifyToken` is provided by the dependency adapter.
- It routes through the injected (or default mock-disabled) verifier
  adapter via `verifierAdapter.verifyToken`.
- The verifier payload is built from `AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS`
  only: `requestId`, `tokenHash`, `authorizationScheme`, `providerMode`,
  `endpointPath`, `nowMs`.
- Prohibited fields are dropped before the verifier call: `token`,
  `rawToken`, `authorization`, `authorizationHeader`, `apiKey`, `secret`,
  `password`, `cookie`, `sessionCookie`, `firebaseToken`,
  `openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`,
  `mistralApiKey`, `nvidiaApiKey`, `prompt`, `excerpt`, `sourceUrl`,
  `rawRequestBody`.
- Verifier result codes are mapped to dependency-adapter safe-fail codes:
  - `VERIFIER_MOCK_DISABLED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_NOT_IMPLEMENTED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_PAYLOAD_PROHIBITED` → `VERIFY_PAYLOAD_PROHIBITED`
  - unknown / missing code → `VERIFY_UNAVAILABLE`
- Verifier adapter throw is safe-swallowed → `VERIFY_UNAVAILABLE`.
- `userKey` / `userKeyHash` remain `null` in skeleton / mock-disabled
  mode (the skeleton does not return real user identifiers).
- The dep adapter does not propagate raw user identifiers from the
  verifier result in this slice.

## 7. Confirmed rate-limit path

- `checkRateLimit` is provided by the dependency adapter.
- It routes through the injected (or default mock-disabled) storage
  adapter via `storageAdapter.checkQuota`.
- The storage payload is built from `STORAGE_PAYLOAD_ALLOWED_FIELDS`
  only: `requestId`, `userKeyHash`, `ipHash`, `sessionKeyHash`,
  `endpointPath`, `providerMode`, `windowKey`, `limitName`, `nowMs`.
- Prohibited fields are dropped before the storage call: the same
  denylist as the verifier payload plus `rawProviderResponse`,
  `rawModelOutput`.
- Storage result codes are mapped to dependency-adapter safe-fail codes:
  - `STORAGE_MOCK_DISABLED` → `RATE_LIMIT_NOT_IMPLEMENTED`
  - `STORAGE_NOT_IMPLEMENTED` → `RATE_LIMIT_NOT_IMPLEMENTED`
  - `STORAGE_PAYLOAD_PROHIBITED` → `RATE_LIMIT_PAYLOAD_PROHIBITED`
  - unknown / missing code → `RATE_LIMIT_STORAGE_UNAVAILABLE`
- Storage adapter throw is safe-swallowed → `RATE_LIMIT_STORAGE_UNAVAILABLE`.
- `consumeQuota` / `releaseQuota` are defined on the storage adapter
  skeleton but not yet called from the dependency adapter in this
  slice (consume / release are separate, future slices).

## 8. Confirmed privacy / safety behavior

| Concern | Verifier payload | Storage payload | Endpoint response | Observability event |
|---------|------------------|-----------------|-------------------|---------------------|
| Raw token | Not propagated (dropped at dep adapter seam) | Not propagated (dropped at dep adapter seam) | Not present in any response field | Not logged |
| `authorization` header | Not propagated | Not propagated | Not present in response | Not logged |
| `firebaseToken` | Not propagated | Not propagated | Not present in response | Not logged |
| API key (`apiKey` / `openaiApiKey` / etc.) | Not propagated | Not propagated | Not present in response | Not logged |
| `password` / `cookie` / `sessionCookie` | Not propagated | Not propagated | Not present in response | Not logged |
| `prompt` / `excerpt` / `sourceUrl` | Not propagated | Not propagated | Not present in response | Not logged |
| `rawRequestBody` / `rawProviderResponse` / `rawModelOutput` | Not propagated | Not propagated | Not present in response | Not logged |
| `userKey` / `userKeyHash` | n/a (skeleton returns `null`) | n/a (storage uses `userKeyHash` only) | `null` in skeleton mode | Not logged in skeleton mode |

The denylist enforcement is the **single source of truth** at the
dep-adapter seam and is locked by both the verifier dependency wiring
and storage dependency wiring contract tests.

## 9. Confirmed no external runtime access

| External access | Status in code | Locked by |
|-----------------|----------------|-----------|
| Firebase Admin SDK (`firebase-admin`) | **No** import | verifier + storage + dep adapter code-only checks |
| `getAuth` | **No** reference | verifier + dep adapter code-only checks |
| `verifyIdToken` | **No** reference | verifier + dep adapter code-only checks |
| `verifyAccessToken` | **No** reference | verifier + dep adapter code-only checks |
| `cert(...)` | **No** call | verifier + dep adapter code-only checks |
| `initializeApp(...)` | **No** call | verifier + dep adapter code-only checks |
| KV / Durable Object / D1 / database | **No** import / reference | storage + dep adapter code-only checks |
| `env.KV` / `env.DB` / `env.AUTH` / `env.FIREBASE` | **No** read | all scout module code-only checks |
| `fetch` / `XMLHttpRequest` / `axios` | **No** call | all scout module code-only checks |
| OpenAI / Anthropic / Gemini / Groq / Mistral / NVIDIA / Cohere / Perplexity SDK | **No** import | all scout module code-only checks |
| `process.env.SCOUT_*` / `import.meta.env` | **No** read | all scout module code-only checks |
| `api_key =` assignment / `bearer ` embedding | **No** | all scout module code-only checks |

## 10. Go / no-go matrix

| Item | Status | Notes |
|------|--------|-------|
| Auth verifier adapter skeleton | **Done** | PR #2302 |
| Auth verifier dependency wiring | **Done** | PR #2304 |
| Rate-limit storage adapter skeleton | **Done** | PR #2299 |
| Storage adapter dependency wiring | **Done** | PR #2301 |
| Dependency adapter endpoint wiring | **Done** | PR #2297 |
| Endpoint error taxonomy | **Done** | PR #2291 / #2293 |
| Endpoint observability | **Done** | PR #2287 |
| Endpoint DI | **Done** | PR #2285 |
| Endpoint safe-fail wiring | **Done** | PR #2283 / #2280 / #2278 |
| Boundary reconcile | **Done** | PR #2280 |
| Runtime boundary | **Done** | PR #2278 |
| Runtime Firebase auth verifier | **No** | Blocked |
| Runtime `getAuth().verifyIdToken` | **No** | Blocked |
| Runtime external auth service | **No** | Blocked |
| Runtime KV / Durable Object / D1 rate-limit storage | **No** | Blocked |
| Runtime persistent rate-limit storage | **No** | Blocked |
| Runtime external observability backend | **No** | Blocked |
| `staging_live` rollout | **No** | Blocked |
| `production_live` rollout | **No** | Blocked |
| Real provider API call | **No** | Blocked |

## 11. Remaining blockers

A runtime implementation gate is the next step. The remaining blockers
that must be cleared (or explicitly waived by the gate contract) are:

1. **Runtime implementation gate contract not yet added** — no audit
   lock exists for the conditions under which a real Firebase verifier
   or real KV / DO / D1 storage may be wired in.
2. **No real Firebase Admin SDK integration** — `firebase-admin` import,
   `getAuth().verifyIdToken`, `cert(...)`, secret wiring all blocked.
3. **No real persistent quota backend** — no KV binding, no Durable
   Object namespace, no D1 database, no third-party quota service.
4. **No external observability backend** — no Sentry, no Datadog, no
   Cloudflare Logpush wiring.
5. **No staging soak** — no `staging_live` rollout, no traffic mirror,
   no synthetic load.
6. **No kill-switch drill result** — no runbook exercise, no incident
   simulation.
7. **No secret rotation drill result** — no rotation runbook, no
   break-glass credential plan.
8. **No production approval** — CTO / Document Lead / Document Web
   approval chain not yet exercised.
9. **No consume / release rate-limit path** — `consumeQuota` and
   `releaseQuota` are skeleton-only and not yet wired into the
   dep adapter.
10. **No `userKey` / `userKeyHash` propagation from a real verifier** —
    skeleton returns `null`; the propagation contract is documented
    but never exercised in mock-disabled mode.

## 12. Recommended next slice

`[TECH] Add Scout live auth/rate-limit runtime adapter implementation
gate contract`

Scope of the next slice (mock-disabled / no real implementation):

- Add a runtime implementation gate contract (a contract test +
  accompanying doc) that locks the conditions under which any real
  Firebase Admin SDK, real KV / DO / D1, real external auth service,
  real provider API, or `staging_live` / `production_live` rollout may
  be wired in.
- The gate contract must explicitly forbid any runtime change without
  (a) a real implementation contract, (b) a real audit trail of the
  mock-disabled wiring, (c) CTO approval, (d) secret rotation
  readiness.
- No actual Firebase / KV / DO / D1 / provider API call is introduced
  in the gate slice. The gate slice is a contract / docs / test-only
  slice.
- The gate contract becomes a precondition for any future PR that
  would introduce a real runtime adapter.

## 13. Locks / evidence

This audit is locked by:

- `tests/contracts/scout-live-auth-verifier-dependency-wiring-contract.test.cjs` (25 sub-tests)
- `tests/contracts/scout-live-auth-verifier-adapter-skeleton-contract.test.cjs` (24 sub-tests)
- `tests/contracts/scout-live-storage-adapter-dependency-wiring-contract.test.cjs` (24 sub-tests)
- `tests/contracts/scout-live-rate-limit-storage-adapter-skeleton-contract.test.cjs` (24 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-dependency-adapter-endpoint-wiring-contract.test.cjs` (20 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-dependency-adapter-skeleton-contract.test.cjs` (21 sub-tests)
- `tests/contracts/scout-live-endpoint-error-readiness-audit-contract.test.cjs` (16 sub-tests)
- `tests/contracts/scout-live-endpoint-error-taxonomy-contract.test.cjs` (24 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-readiness-audit-contract.test.cjs` (16 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` (24 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-endpoint-di-contract.test.cjs` (20 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-endpoint-safe-fail-wiring-contract.test.cjs` (20 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-boundary-reconcile-contract.test.cjs` (13 sub-tests)
- `tests/contracts/scout-live-auth-rate-limit-runtime-boundary-contract.test.cjs` (28 sub-tests)
- `tests/contracts/scout-live-provider-auth-rate-limit-boundary.test.cjs`
- `tests/contracts/scout-live-provider-production-readiness-gates-audit-contract.test.cjs`
- `tests/contracts/scout-live-provider-staging-rollout-contract.test.cjs`
- `tests/contracts/scout-real-provider-mock-executor-integration-contract.test.cjs`
- `tests/contracts/scout-real-provider-disabled-endpoint-contract.test.cjs`
- `tests/contracts/scout-real-provider-adapter-interface-contract.test.cjs`
- `tests/contracts/scout-live-auth-rate-limit-adapter-wiring-readiness-audit-contract.test.cjs` (this slice)

The audit contract test (this slice) verifies the **content** of this
document against the actual repository state and the locked default
behavior.

## 14. Explicit verdict

- Ready for runtime implementation gate contract: **Yes**
- Ready for real Firebase Admin SDK implementation: **No**
- Ready for real KV / DO / D1 rate-limit storage implementation: **No**
- Ready for real external auth service call: **No**
- Ready for real external observability backend: **No**
- Ready for `staging_live` rollout: **No**
- Ready for `production_live` rollout: **No**
- Ready for real provider API call: **No**

The mock-disabled wiring is consistent, fail-closed, and free of
external runtime access. The next prerequisite is the runtime
implementation gate contract, not a real implementation PR.

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

## Runtime Observability Policy Audit Status

The Scout runtime observability policy audit has been added as a
docs+tests-only slice (v20260607-1, audit slice, no runtime code
change, no external observability backend, no live metrics sink,
no live alerting pipeline):

- A new audit document has been added:
  `docs/product/lovebud-scout-runtime-observability-policy-audit.md`
- The audit satisfies **gate evidence 11 of 11** in the runtime
  adapter implementation gate contract
- After this audit, all 11 gate evidence items are now complete;
  gate step 3 (one disabled-by-default runtime adapter
  implementation scaffold) may begin
- The audit defines the safe event schema for all 10 observability
  surfaces (endpoint request lifecycle / auth verifier / rate-limit
  storage / provider adapter / error taxonomy / rollback /
  cost-quota / staging_live / production_live / incident
  response)
- The audit defines the allowed observability field allowlist
  (17 safe fields: requestId / providerMode / endpointPath /
  errorCode / safeStatus / latencyMs / retryAfterSeconds /
  quotaBucket / decisionId / adapterKind / mockDisabled /
  environmentLabel / severity / retryCount / maxRetries /
  timeoutMs / eventType)
- The audit defines the prohibited observability fields (raw
  token / authorization / firebaseToken / API key / secret /
  service account / prompt / excerpt / sourceUrl / raw request
  body / raw provider response / raw Firebase claims / raw
  decoded token / raw storage key / raw UID / email / raw IP /
  cookie / sessionCookie)
- The audit defines:
  - safe event schema (base / auth / rate-limit / provider /
    rollback / cost / staging / production / incident)
  - error taxonomy alignment (AUTH_REQUIRED / AUTH_INVALID /
    RATE_LIMITED / RATE_LIMIT_UNAVAILABLE /
    RATE_LIMIT_PAYLOAD_PROHIBITED /
    RATE_LIMIT_STORAGE_UNAVAILABLE / PROVIDER_UNAVAILABLE /
    CONFIG_MISSING / PROVIDER_ERROR / VALIDATION_ERROR)
  - privacy / safety policy (safe metadata only / no sensitive
    payload capture / no replay of sensitive payloads / no raw
    source material / no prompt/excerpt/sourceUrl logging / no
    token/API key/service account logging)
  - external observability backend policy (not implemented /
    disabled-by-default / environment-gated / independent
    kill-switch / fail closed or silently drop telemetry / must
    not block endpoint response / must not change endpoint
    response body / must not auto-save data)
  - alerting policy (no alerts implemented / future alerts
    sanitized fields only / alert thresholds documented before
    staging_live / alert messages no sensitive values)
  - incident observability policy (safe IDs/hashes only / no raw
    token/API key/prompt/sourceUrl in incident reports /
    sensitive logging suspected disables external backend first
    / rollback decision trace safe fields only)
  - rollback / kill-switch alignment (observability backend
    independent kill-switch / rollback events safe / kill-switch
    activation no secrets / fallback baseline stub/local_stub)
  - required future tests (observer safe-swallow / external
    backend disabled by default / external backend kill-switch
    prevents export / no sensitive fields in emitted events / no
    prompt/excerpt/sourceUrl in events / no raw token/API
    key/service account in events / endpoint response unaffected
    by observer failures / no provider API call from
    observability / no storage/auth call from observability /
    docs examples safe fake metadata only)
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - external observability backend not integrated
  - live alerting pipeline not implemented
- The 4 runtime files remain locked by md5 normalized for
  LF/CRLF (cross-platform stable): dep-adapter `796a2aef…`,
  verifier `5a0a8534…`, storage `a4419b1e…`, suggest
  `deb6a6d7…`
- This audit slice is docs+tests only; no runtime code change,
  no external observability backend integration, no live metrics
  sink, no live tracing sink, no live alerting sink, no
  Firebase Admin SDK import, no KV / Durable Object / D1
  implementation, no provider API call
- Recommended next slice: `[TECH] Add one disabled-by-default
  runtime adapter implementation scaffold` (gate step 3, still
  scaffold, not a real production live implementation)
- Verdict: runtime observability policy audit: **Yes**; gate
  evidence 11 of 11 complete after this audit: **Yes**; real
  external observability backend in this PR: **No**; real
  alerting in this PR: **No**; real Firebase Admin SDK in this
  PR: **No**; real KV / Durable Object / D1 in this PR: **No**;
  real provider API in this PR: **No**; `staging_live` /
  `production_live` opt-in in this PR: **No** (all blocked)

## Firebase Auth Verifier Disabled Scaffold Status

The first disabled-by-default runtime adapter implementation
scaffold for the Scout Firebase auth verifier has been added as a
scaffold slice (v20260607-1, scaffold slice, no real Firebase
Admin SDK, no real token verification, no endpoint default live
behavior):

- The auth verifier adapter
  (`functions/api/scout/live-auth-verifier-adapter.js`) has been
  extended with a future Firebase scaffold mode
- New mode constants: `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES`
  now includes `FIREBASE_DISABLED` and `FIREBASE_CONFIG_MISSING`
- New response code constants:
  `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES` now includes
  `VERIFIER_FIREBASE_DISABLED` and `VERIFIER_CONFIG_MISSING`
- The factory `createScoutLiveAuthVerifierAdapter(options)` now
  accepts an optional `verifierMode` option that, combined with
  `mockDisabled: false`, selects one of the Firebase scaffold
  branches
- The Firebase scaffold branches safe-fail with
  `VERIFIER_FIREBASE_DISABLED` or `VERIFIER_CONFIG_MISSING`
  without importing or calling the Firebase Admin SDK, without
  verifying any token, and without reading any env / secret
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({})` default behavior
  (`mockDisabled: true`, `mode: MOCK_DISABLED`,
  `code: VERIFIER_MOCK_DISABLED`)
- The scaffold does **not** change the existing
  `createScoutLiveAuthVerifierAdapter({ mockDisabled: false })`
  behavior (`mode: NOT_IMPLEMENTED`,
  `code: VERIFIER_NOT_IMPLEMENTED`)
- Module import remains side-effect-free: no Firebase init, no
  token verify, no storage call, no provider call, no env read
- No Firebase Admin SDK import (`firebase-admin`,
  `firebase-admin/app`, `firebase-admin/auth`)
- No `getAuth` / `verifyIdToken` / `verifyAccessToken` /
  `cert` / `initializeApp` call
- No fetch / XMLHttpRequest / axios
- No KV / Durable Object / D1 / database access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq /
  Mistral / NVIDIA / Cohere / Perplexity)
- No `process.env` / `import.meta.env` / `env.SCOUT_*` /
  `env.FIREBASE_*` reads
- No raw token / authorization header / API key / firebaseToken
  in any response, log, or storage payload
- All previous defaults are preserved:
  - endpoint default `providerMode: "stub"`
  - explicit stub path (`providerMode: "stub"`) unchanged
  - frontend source selector default `local_stub`
  - endpoint client default disabled
  - source selector `endpoint_client` default disabled
  - `verifierAdapter` / `storageAdapter` default mock-disabled
  - `staging_live` / `production_live` blocked
  - dependency adapter behavior unchanged
  - `suggest.js` unchanged
- The 3 locked runtime files (dep-adapter, storage, suggest)
  remain locked by md5 normalized for LF/CRLF (cross-platform
  stable). The auth verifier adapter is intentionally modified
  in this scaffold slice (it gets the new Firebase scaffold
  code) and is therefore NOT in the lock list
- This scaffold slice is disabled-by-default and safe-fail
  only; no real Firebase Admin SDK, no real token verification,
  no real external auth service call, no real provider API call,
  no real KV / Durable Object / D1 implementation
- Recommended next slice: `[TECH] Wire disabled Firebase auth
  verifier scaffold into dependency adapter contract` or
  `[TECH] Add disabled rate-limit storage runtime scaffold`
- Verdict: Firebase auth verifier disabled scaffold: **Yes**;
  real Firebase Admin SDK in this PR: **No**; real token
  verification in this PR: **No**; real external auth service
  call in this PR: **No**; real provider API in this PR:
  **No**; real KV / Durable Object / D1 in this PR: **No**;
  `staging_live` / `production_live` opt-in in this PR: **No**
  (all blocked)

## Firebase Auth Verifier Disabled Scaffold Readiness Audit Status

A CTO review / readiness audit (v20260607-1) has been added for the
first disabled-by-default runtime adapter implementation scaffold
(Scout Firebase auth verifier). The audit is docs+tests only — no
runtime behavior change. Findings:

- The scaffold remains disabled-by-default and safe-fail only
- The scaffold is **not** a real Firebase implementation
- The scaffold does **not** import `firebase-admin`
- The scaffold does **not** perform real token verification
- The dependency adapter and `suggest.js` remain unchanged
- The endpoint default `providerMode: "stub"` is preserved
- The explicit stub path is preserved
- The frontend default `local_stub` is preserved
- The endpoint client default disabled state is preserved
- The locked runtime files remain locked by LF/CRLF-normalized
  md5 (verifier `81f80368…`, dep-adapter `796a2aef…`, storage
  `a4419b1e…`, suggest `deb6a6d7…`)
- Recommended next slice:
  `[TECH] Wire disabled Firebase auth verifier scaffold into
  dependency adapter contract`
- Verdict: CTO review / readiness audit complete: **Yes**; real
  Firebase Admin SDK: **No**; real token verification: **No**;
  `staging_live` / `production_live` opt-in: **No** (all blocked)

## Disabled Firebase Verifier Dependency Wiring Status

A subsequent slice (PR #2324) has wired the disabled Firebase auth verifier scaffold into the dependency adapter contract. It provides:
- `VERIFIER_FIREBASE_DISABLED` → `VERIFY_NOT_IMPLEMENTED` safe-fail mapping
- `VERIFIER_CONFIG_MISSING` → `VERIFY_UNAVAILABLE` safe-fail mapping
- Existing verifier mappings preserved
- Default dependency adapter `mockDisabled:true` behavior unchanged
- Dependency adapter does not auto-enable Firebase mode
- No Firebase Admin SDK / real token verification / fetch / provider SDK / env secret usage
- `suggest.js` unchanged (no Firebase scaffold wiring in this slice)
- Endpoint default remains `stub`; explicit `stub` preserved
- Frontend default remains `local_stub`; endpoint client default remains disabled

