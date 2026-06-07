# Scout Live Auth/Rate-Limit Dependency Adapter Skeleton

> Status: **skeleton only** (mock-disabled)
> Version: v20260607-1
> Audience: Scout live provider engineering
> Scope: dependency adapter skeleton for the LIVE branch DI seam

## 1. Purpose

This document defines the **mock-disabled dependency adapter skeleton** for the
Scout live provider path. The adapter provides default implementations of
`verifyToken`, `checkRateLimit`, and `requestId` for the DI seam established in
`functions/api/scout/suggest.js` LIVE branch (shape:

```
liveDependencies = { verifyToken, checkRateLimit, observer, requestId }
```

The adapter is **mock-disabled by default** and returns safe "not implemented"
responses so the endpoint can never accidentally allow real traffic while the
skeleton is in place. Real implementations of `verifyToken` (Firebase Admin SDK
or equivalent) and `checkRateLimit` (KV / Durable Object / D1 or equivalent)
will be added in future slices.

## 2. Module

`functions/api/scout/live-auth-rate-limit-dependency-adapter.js` (v20260607-1)

Exports:

- `SCOUT_LIVE_DEPENDENCY_ADAPTER_VERSION` — `'20260607-1'`
- `SCOUT_LIVE_DEPENDENCY_ADAPTER_MODES` — `{ MOCK_DISABLED, NOT_IMPLEMENTED }`
- `SCOUT_LIVE_DEPENDENCY_ADAPTER_CODES` — `{ VERIFY_NOT_IMPLEMENTED, RATE_LIMIT_NOT_IMPLEMENTED }`
- `createScoutLiveDependencyAdapter(options?)` — factory

## 3. Factory contract

```
createScoutLiveDependencyAdapter(options?) -> adapter
```

Options:

- `mockDisabled: boolean` — default `true`. When `true`, the factory returns
  a mock-disabled adapter. When `false`, the factory returns a not-implemented
  adapter (real implementations are not yet provided; future slices will
  replace this).

The returned adapter is **frozen** and has the shape:

```
{
  version: '20260607-1',
  mode: 'mock_disabled' | 'not_implemented',
  isMockDisabled: boolean,
  verifyToken: async () => ({ allowed, code, reason }),
  checkRateLimit: async () => ({ allowed, code, reason }),
  requestId: () => string,
}
```

### 3.1 Mock-disabled mode (default)

- `verifyToken` returns:
  ```
  { allowed: false, code: 'VERIFY_NOT_IMPLEMENTED', reason: 'verifyToken is mock-disabled; real implementation is required' }
  ```
- `checkRateLimit` returns:
  ```
  { allowed: false, code: 'RATE_LIMIT_NOT_IMPLEMENTED', reason: 'rate limiting is mock-disabled; real implementation is required' }
  ```
- `requestId` returns a string starting with `req_mock_disabled_` followed by
  a base36 timestamp and a random suffix.

Both `verifyToken` and `checkRateLimit` **deny by default** (fail-closed) so
the endpoint cannot accidentally allow real traffic in skeleton mode.

### 3.2 Not-implemented mode

When `mockDisabled: false` is passed, the factory returns the same shape but
with `mode: 'not_implemented'` and `isMockDisabled: false`. The
`requestId` returns a string starting with `req_not_implemented_`. This mode
is reserved for future slices that will replace the mock-disabled responses
with real ones.

## 4. Boundary inventory

This skeleton sits **alongside** the canonical boundary skeleton:

- `functions/api/scout/live-auth-rate-limit-boundary.js` — canonical runtime
  boundary + DI seam (v20260607-1)
- `functions/api/scout/live-auth-rate-limit-observability.js` — observability
  helper (v20260607-1)
- `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` —
  dependency adapter skeleton (this document, v20260607-1)
- `functions/api/scout/live-rate-limit-storage-adapter.js` — storage adapter
  skeleton (v20260607-1, separate slice)

The dependency adapter skeleton is a **separate module** with a **clear
single responsibility** (provide default `verifyToken` / `checkRateLimit` /
`requestId` implementations). It is not wired into `suggest.js` LIVE branch
in this slice.

## 5. Confirmed behavior

| Scenario | verifyToken | checkRateLimit | requestId | Note |
| --- | --- | --- | --- | --- |
| Default `mockDisabled:true` | `allowed:false`, `VERIFY_NOT_IMPLEMENTED` | `allowed:false`, `RATE_LIMIT_NOT_IMPLEMENTED` | `req_mock_disabled_*` | fail-closed |
| Explicit `mockDisabled:false` | `allowed:false`, `VERIFY_NOT_IMPLEMENTED` | `allowed:false`, `RATE_LIMIT_NOT_IMPLEMENTED` | `req_not_implemented_*` | reserved for future slices |
| Same module across multiple calls | same code, different reason timestamps are not embedded | same | different ids | idempotent on each call |

## 6. Privacy / safety behavior

The adapter skeleton does not:

- Import or reference the Firebase Admin SDK
- Import or reference any KV / Durable Object / D1 runtime
- Import or reference any provider SDK (openai, anthropic, gemini, groq,
  mistral, nvidia, cohere, perplexity, etc.)
- Call `fetch`, `XMLHttpRequest`, `axios`, or construct a new `Request`
- Read `process.env.SCOUT_*` (no API key / token propagation)
- Persist any state across calls
- Wire into `suggest.js` LIVE branch in this slice (out of scope)

## 7. Go / no-go matrix

| Item | Verdict | Notes |
| --- | --- | --- |
| Dependency adapter skeleton module itself | **YES** | this slice |
| Wiring the adapter into `suggest.js` LIVE branch | **separate slice** | out of scope for this slice |
| Real `verifyToken` (Firebase Admin SDK) implementation | **NO** | future slice |
| Real `checkRateLimit` (KV / DO / D1) implementation | **NO** | future slice |
| Real `requestId` (W3C trace context) implementation | **NO** | future slice |
| Real observability backend integration | **NO** | future slice |
| `staging_live` execution | **NO** | blocked |
| `production_live` execution | **NO** | blocked |

## 8. Remaining blockers

- Real `verifyToken` adapter (Firebase Admin SDK or equivalent)
- Real `checkRateLimit` adapter (KV / DO / D1 or equivalent)
- Real `requestId` adapter (W3C trace context or equivalent)
- Wiring the adapter into `suggest.js` LIVE branch
- Real observability backend integration
- Provider-specific live adapter
- Staging soak
- Kill-switch drill
- Secret rotation drill
- Real storage adapter implementation (KV / Durable Object / D1) — see
  [storage adapter skeleton](lovebud-scout-live-rate-limit-storage-adapter-skeleton.md)

## 9. Recommended next slice

`[TECH] Wire Scout live dependency adapter into suggest.js LIVE branch (mock-disabled)`.

That slice will:
- Add an optional `context.liveAdapter` to the `suggest.js` LIVE branch
- Inject the adapter's `verifyToken` / `checkRateLimit` / `requestId` into
  `liveDependencies` when `context.liveAdapter` is provided
- Remain **mock-disabled by default** (no real Firebase / KV / provider)
- Not change endpoint default `providerMode:"stub"` behavior
- Not change frontend default `local_stub` behavior
- Not change endpoint client default disabled behavior

## Dependency Adapter Endpoint Wiring Status

The dependency adapter skeleton is now wired into `functions/api/scout/suggest.js` LIVE branch (v20260607-1, wiring slice):
- `suggest.js` imports `createScoutLiveDependencyAdapter` from `live-auth-rate-limit-dependency-adapter.js`
- Wiring is **live-branch-only** (only inside `providerConfig.providerMode === "live"`)
- Default stub path and explicit stub path do NOT use the adapter
- Live mode uses the mock-disabled adapter by default (fail-closed)
- Tests can inject a real adapter via `context.liveAdapter` or `context.liveDependencies`
- Legacy direct DI (`context.verifyToken` / `context.checkRateLimit`) still works alongside the new injection
- When no real limiter is configured, the boundary's "rate-limit unavailable" safe-fail path fires (RATE_LIMIT_UNAVAILABLE / 503), preserving the existing taxonomy
- Observer safe-swallow remains
- Endpoint default `providerMode:"stub"`, frontend default `local_stub`, and endpoint client default disabled are all unchanged
- Real Firebase Admin SDK, real KV/DO/D1, provider SDK, and fetch are still NOT used
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

## 10. Verdict

- Dependency adapter skeleton (this slice): **YES** (mock-disabled)
- Wiring into `suggest.js` LIVE branch: **DONE** (mock-disabled, live-branch-only)
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations: **NO**
- Real Firebase / KV / DO / D1 / provider SDK / staging / production: **NO**

## Storage Adapter Dependency Wiring Status

The storage adapter skeleton is now wired into the live dependency adapter mock path (v20260607-1, wiring slice):
- `live-auth-rate-limit-dependency-adapter.js` imports `createScoutLiveRateLimitStorageAdapter` from `live-rate-limit-storage-adapter.js`
- `createScoutLiveDependencyAdapter(options?)` accepts a `storageAdapter` option
- When `storageAdapter` is not provided, the canonical mock-disabled storage adapter (`createScoutLiveRateLimitStorageAdapter({ mockDisabled: true })`) is used as the default
- `checkRateLimit` routes through `storageAdapter.checkQuota` with an **allowlisted payload only** (no raw token / API key / prompt / excerpt / sourceUrl / raw request body)
- Storage adapter results are mapped to dependency-adapter safe-fail codes:
  - `STORAGE_MOCK_DISABLED` → `RATE_LIMIT_NOT_IMPLEMENTED`
  - `STORAGE_NOT_IMPLEMENTED` → `RATE_LIMIT_NOT_IMPLEMENTED`
  - `STORAGE_PAYLOAD_PROHIBITED` → `RATE_LIMIT_PAYLOAD_PROHIBITED`
  - unknown / missing → `RATE_LIMIT_STORAGE_UNAVAILABLE`
- Storage adapter throw is safe-swallowed (no throw propagation)
- The dependency adapter's `verifyToken` mock-disabled default behavior is unchanged
- The dependency adapter object remains frozen (immutable)
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- No real KV / Durable Object / D1 / database / fetch / env storage binding
- No Firebase Admin SDK, no provider SDK, no env.SCOUT_*
- Real KV / DO / D1 / database / Firebase / provider SDK / staging / production all remain blocked

## Auth Verifier Adapter Skeleton Status

The auth verifier adapter skeleton has been added as a separate file
(`functions/api/scout/live-auth-verifier-adapter.js`, v20260607-1) ahead
of any Firebase Admin SDK integration. Status:

- A new `live-auth-verifier-adapter.js` module has been added with
  `createScoutLiveAuthVerifierAdapter(options?)` factory
- Default `mockDisabled: true` fail-closed behavior; `verifyToken` always
  returns `{ allowed: false, code: "VERIFIER_MOCK_DISABLED", userKey: null, userKeyHash: null }`
- `mockDisabled: false` mode returns `VERIFIER_NOT_IMPLEMENTED` shape
- Object.freeze applied to the returned adapter
- `sanitizeScoutLiveAuthVerifierPayload(payload, options?)` pure helper
  exported with `onProhibitedField: 'drop' | 'reject'` modes
- Allowed fields (allowlist): `requestId`, `tokenHash`,
  `authorizationScheme`, `providerMode`, `endpointPath`, `nowMs`
- Prohibited fields (denylist): `token`, `rawToken`, `authorization`,
  `authorizationHeader`, `apiKey`, `secret`, `password`, `cookie`,
  `sessionCookie`, `firebaseToken`, provider API key fields
  (`openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`,
  `mistralApiKey`, `nvidiaApiKey`), `prompt`, `excerpt`, `sourceUrl`,
  `rawRequestBody`
- No Firebase Admin SDK / no `getAuth` / no `verifyIdToken` /
  no `verifyAccessToken` / no `cert` / no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth service URL
- No env auth binding (`env.AUTH`, `env.FIREBASE`,
  `process.env.SCOUT_*`, `import.meta.env`) access
- No KV / Durable Object / D1 / database runtime access
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- `verifyToken` result never includes raw token / authorization /
  apiKey / firebaseToken / sessionCookie
- Dependency adapter is NOT yet wired to the verifier (separate slice)
- `suggest.js` is NOT yet wired to the verifier (separate slice)
- Endpoint default `providerMode: "stub"` preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- Runtime Firebase Admin SDK / real token verification /
  external auth service call: **NO** (blocked)
- `staging_live` / `production_live` rollout: **NO** (blocked)

## Auth Verifier Adapter Dependency Wiring Status

The auth verifier adapter skeleton is now wired into the live dependency
adapter mock path (v20260607-1, wiring slice):

- `live-auth-rate-limit-dependency-adapter.js` imports
  `createScoutLiveAuthVerifierAdapter` from `live-auth-verifier-adapter.js`
- `createScoutLiveDependencyAdapter(options?)` accepts a `verifierAdapter`
  option
- When `verifierAdapter` is not provided, the canonical mock-disabled
  verifier adapter
  (`createScoutLiveAuthVerifierAdapter({ mockDisabled: true })`) is used
  as the default
- `verifyToken` routes through `verifierAdapter.verifyToken` with an
  **allowlisted payload only** (no raw token / authorization header /
  API key / firebaseToken / session cookie / password / prompt /
  excerpt / sourceUrl / raw request body / provider API key fields)
- Allowed verifier payload fields (single source of truth at the dep
  adapter → verifier seam):
  - `requestId`
  - `tokenHash`
  - `authorizationScheme`
  - `providerMode`
  - `endpointPath`
  - `nowMs`
- Verifier result codes are mapped to dependency-adapter safe-fail codes:
  - `VERIFIER_MOCK_DISABLED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_NOT_IMPLEMENTED` → `VERIFY_NOT_IMPLEMENTED`
  - `VERIFIER_PAYLOAD_PROHIBITED` → `VERIFY_PAYLOAD_PROHIBITED`
  - unknown / missing code → `VERIFY_UNAVAILABLE`
- Verifier adapter throw is safe-swallowed (no throw propagation,
  returns `VERIFY_UNAVAILABLE`)
- The dependency adapter's `checkRateLimit` storage adapter wiring is
  unchanged
- The dependency adapter object remains frozen (immutable)
- `verifyToken` result still includes `userKey: null` and
  `userKeyHash: null` in mock-disabled / not-implemented mode (skeleton
  does not return real user identifiers)
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- New dependency-adapter response codes:
  - `VERIFY_PAYLOAD_PROHIBITED`
  - `VERIFY_UNAVAILABLE`
- No real Firebase Admin SDK, no `getAuth`, no `verifyIdToken`, no
  `verifyAccessToken`, no `cert`, no `initializeApp` in code
- No fetch / XMLHttpRequest / axios / external auth URL
- No KV / Durable Object / D1 / database / env auth binding
  (`env.AUTH`, `env.FIREBASE`, `process.env.SCOUT_*`, `import.meta.env`)
- No provider SDK imports (OpenAI / Anthropic / Gemini / Groq / Mistral
  / NVIDIA / Cohere / Perplexity)
- Real Firebase Admin SDK / real token verification / external auth
  service / `staging_live` / `production_live` / provider API all
  remain blocked

## Adapter Wiring Readiness Audit Status

The live auth/rate-limit adapter wiring has been audited as a single
coherent mock-disabled stage (v20260607-1, audit-only slice):

- A new readiness audit document has been added:
  `docs/product/lovebud-scout-live-auth-rate-limit-adapter-wiring-readiness-audit.md`
- The audit inventories and confirms:
  - auth verifier adapter skeleton (PR #2302)
  - auth verifier dependency wiring (PR #2304)
  - rate-limit storage adapter skeleton (PR #2299)
  - storage adapter dependency wiring (PR #2301)
  - dependency adapter endpoint wiring (PR #2297)
  - endpoint error taxonomy, observability, DI, safe-fail wiring
  - boundary reconcile and runtime boundary
- `mockDisabled:true` fail-closed default is confirmed consistent across
  verifier, storage, and dependency adapter
- Sensitive data (raw token / authorization / firebaseToken / API key
  / prompt / excerpt / sourceUrl / raw request body) is confirmed not
  propagated to verifier / storage / limiter / observability / response
  payloads
- No real Firebase Admin SDK, no real Firebase token verification, no
  real KV / Durable Object / D1, no real provider API, no external
  observability backend
- Endpoint default `providerMode: "stub"` preserved
- Explicit `providerMode: "stub"` path preserved
- Frontend source selector default `local_stub` preserved
- Frontend endpoint client default disabled preserved
- This audit slice is docs+tests only; no runtime code change
- Recommended next slice: `[TECH] Add Scout live auth/rate-limit
  runtime adapter implementation gate contract`
- Verdict: ready for runtime implementation gate contract: **Yes**;
  ready for real Firebase / KV / staging / production / provider API:
  **No** (all blocked)

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
