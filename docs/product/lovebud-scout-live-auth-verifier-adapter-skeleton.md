# Scout Live Auth Verifier Adapter Skeleton

> Status: **skeleton only** (mock-disabled)
> Version: v20260607-1
> Audience: Scout live provider engineering
> Scope: auth verifier adapter skeleton for the future runtime auth backend
> Related issue: #1882

## 1. Purpose

This document defines the **mock-disabled auth verifier adapter skeleton**
for the Scout live provider path. The adapter provides a future interface
for Firebase-style auth token verification (`verifyIdToken` or an
equivalent custom auth service) **without** actually calling any external
auth backend in this slice.

Real implementations of the auth verifier (e.g. Firebase Admin SDK with
`getAuth().verifyIdToken`, or a custom JWT verifier) will be added in
future slices. This skeleton locks the interface, default fail-closed
behavior, and sensitive-data payload guardrails so the endpoint can never
accidentally verify a real token while the skeleton is in place.

## 2. Non-goals

- No real LLM provider call
- No provider SDK import
- No Firebase Admin SDK import
- No Firebase token verification
- No `getAuth` / `verifyIdToken` / `cert` / `initializeApp` call
- No external auth service call
- No fetch / XMLHttpRequest / axios
- No env auth binding access
- No raw token, authorization header, API key, or session cookie in any
  response, log, or storage payload
- No wiring into `suggest.js` LIVE branch (separate slice)
- No wiring into the dependency adapter (separate slice)

## 3. Module

`functions/api/scout/live-auth-verifier-adapter.js` (v20260607-1)

Exports:

- `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_VERSION` — `'20260607-1'`
- `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_MODES` — `{ MOCK_DISABLED, NOT_IMPLEMENTED }`
- `SCOUT_LIVE_AUTH_VERIFIER_ADAPTER_CODES` — `{ VERIFIER_MOCK_DISABLED, VERIFIER_NOT_IMPLEMENTED, VERIFIER_PAYLOAD_PROHIBITED }`
- `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_ALLOWED_FIELDS` — allowlist
- `SCOUT_LIVE_AUTH_VERIFIER_PAYLOAD_PROHIBITED_FIELDS` — denylist
- `sanitizeScoutLiveAuthVerifierPayload(payload, options?)` — pure helper
- `createScoutLiveAuthVerifierAdapter(options?)` — factory

## 4. Factory contract

```
createScoutLiveAuthVerifierAdapter(options?) -> adapter
```

Options:

- `mockDisabled: boolean` — default `true`. When `true`, the factory returns
  a mock-disabled adapter. When `false`, the factory returns a
  not-implemented adapter (real implementations are not yet provided).
- `onProhibitedField: 'drop' | 'reject'` — default `'drop'`. Controls how
  `sanitizePayload` handles prohibited fields in a payload.

The returned adapter is **frozen** and has the shape:

```
{
  kind: 'scout_live_auth_verifier_adapter',
  version: '20260607-1',
  mode: 'mock_disabled' | 'not_implemented',
  mockDisabled: boolean,
  isMockDisabled: boolean,
  onProhibitedField: 'drop' | 'reject',
  verifyToken: async (payload) => { allowed, code, reason, userKey, userKeyHash },
  sanitizePayload: (payload, options?) => { payload, rejected, rejectedFields },
}
```

## 5. Default mock-disabled behavior

When `mockDisabled: true` (default), `verifyToken` returns:

```
{
  allowed: false,
  code: 'VERIFIER_MOCK_DISABLED',
  reason: 'Live auth verifier adapter is mock-disabled; no real verification is performed.',
  userKey: null,
  userKeyHash: null,
}
```

This is a fail-closed shape. The endpoint boundary can map
`VERIFIER_MOCK_DISABLED` to `AUTH_UNAVAILABLE` (HTTP 503) or
`AUTH_INVALID` (HTTP 401) depending on caller policy; the verifier
itself does not decide the HTTP mapping.

## 6. Not-implemented mode

When `mockDisabled: false`, `verifyToken` returns:

```
{
  allowed: false,
  code: 'VERIFIER_NOT_IMPLEMENTED',
  reason: 'Live auth verifier adapter is not implemented; real verification is required.',
  userKey: null,
  userKeyHash: null,
}
```

This makes it explicit that a real implementation is required and must
be wired before the endpoint can accept any non-mock traffic.

## 7. Method inventory

### 7.1 verifyToken

Verifies (or would verify) an auth token. The mock-disabled and
not-implemented modes both return safe fail-closed responses and never
return a `userKey` or `userKeyHash`. Future real implementations will
populate `userKey` and `userKeyHash` only when verification succeeds.

The `payload` argument is never persisted, logged, or propagated to
storage. If a future implementation needs to forward fields, it must
use the `sanitizePayload` allowlist helper first.

### 7.2 sanitizePayload (exposed helper)

`adapter.sanitizePayload(payload, options?)` strips prohibited fields
from a verifier payload. It returns `{ payload, rejected, rejectedFields }`
where `rejected` is `true` when in `onProhibitedField: 'reject'` mode and a
prohibited field was encountered.

## 8. Token payload policy

### 8.1 Allowed fields (allowlist)

Only future-safe, derived, non-sensitive fields may be present in a
verifier payload:

- `requestId`
- `tokenHash` (a pre-computed hash of the raw token; the raw token is
  never stored or forwarded)
- `authorizationScheme` (e.g. `"Bearer"`, `"Firebase"`)
- `providerMode`
- `endpointPath`
- `nowMs`

### 8.2 Prohibited fields (denylist)

The following sensitive fields must never enter a verifier payload,
response, log, or storage record:

- `token`
- `rawToken`
- `authorization`
- `authorizationHeader`
- `apiKey`
- `secret`
- `password`
- `cookie`
- `sessionCookie`
- `firebaseToken`
- `openaiApiKey` / `anthropicApiKey` / `geminiApiKey` / `groqApiKey` /
  `mistralApiKey` / `nvidiaApiKey`
- `prompt`
- `excerpt`
- `sourceUrl`
- `rawRequestBody`

The denylist is the single source of truth at the verifier seam. Any
field on this list is dropped (default) or causes the sanitizer to
return `rejected: true` (in `onProhibitedField: 'reject'` mode).

## 9. No external auth access guarantee

The skeleton guarantees that it does **not** access any external auth
backend or runtime:

- **No Firebase Admin SDK** — `firebase-admin` is not imported; no
  `initializeApp`, no `cert(...)`, no `getAuth()` call exists in code.
- **No getAuth / verifyIdToken** — neither function is referenced in
  code.
- **No verifyAccessToken** — no alternative verification path is
  implemented.
- **No external auth service** — no fetch, no XMLHttpRequest, no axios,
  no embedded external URL exists in code.
- **No env auth binding** — `env.AUTH`, `env.FIREBASE`, `process.env.*`,
  and `import.meta.env` are not read.
- **No provider SDK import** — OpenAI, Anthropic, Gemini, Groq,
  Mistral, NVIDIA, Cohere, and Perplexity SDKs are not imported.

The verifier adapter does not import the dependency adapter or the
storage adapter in this slice. The dependency adapter does not import
the verifier adapter. Wiring the verifier adapter into the dependency
adapter is a separate slice.

## 10. Error mapping

The verifier adapter returns one of three codes. The endpoint boundary
(`live-auth-rate-limit-boundary.js`) and the dependency adapter are
responsible for mapping these codes to HTTP responses.

| Verifier code          | Suggested HTTP mapping         | Notes |
|------------------------|--------------------------------|-------|
| `VERIFIER_MOCK_DISABLED`   | 503 Service Unavailable (`AUTH_UNAVAILABLE`) | Skeleton / not yet wired |
| `VERIFIER_NOT_IMPLEMENTED` | 503 Service Unavailable (`AUTH_UNAVAILABLE`) | Real impl required |
| `VERIFIER_PAYLOAD_PROHIBITED` | 400 Bad Request (`AUTH_INVALID`)        | Sanitizer rejected |

The verifier adapter itself never throws, never logs, and never
embeds a raw token in any return value.

## 11. Privacy / safety guardrails

- **No raw token return**: `verifyToken` result never contains
  `token`, `rawToken`, `authorization`, `authorizationHeader`,
  `apiKey`, `firebaseToken`, `password`, `cookie`, or `sessionCookie`.
- **No raw token in logs**: the verifier module does not call
  `console.log`, `console.error`, or any logger; nothing is logged.
- **No raw token in storage**: the verifier module does not import or
  reference any storage adapter; nothing is persisted.
- **No raw token propagation**: the verifier module does not import
  the dependency adapter or the boundary; raw tokens cannot flow
  through the verifier into another layer in this slice.
- **No raw token forwarding**: the verifier module's only external
  integration points are the `payload` argument (caller-controlled
  and not stored) and the sanitized return value (denylist-enforced).

## 12. Boundary inventory

- `functions/api/scout/live-auth-rate-limit-boundary.js` — canonical
  boundary. Unchanged in this slice.
- `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` —
  dependency adapter. Not wired to the verifier in this slice.
- `functions/api/scout/live-rate-limit-storage-adapter.js` — storage
  adapter. Unchanged in this slice.
- `functions/api/scout/live-auth-rate-limit-observability.js` —
  observability helper. Unchanged in this slice.
- `functions/api/scout/suggest.js` — endpoint. Not wired to the
  verifier in this slice.
- `js/scout/scout-suggestion-source-selector.js` — frontend source
  selector. Default `local_stub` preserved.
- `js/scout/scout-suggestion-endpoint-client.js` — frontend endpoint
  client. Default disabled preserved.

## 13. Go / no-go matrix

| Item | Status | Notes |
|------|--------|-------|
| Auth verifier adapter skeleton | **Done** | This slice |
| `verifyToken` interface | **Done** | Mock-disabled default |
| `sanitizePayload` helper | **Done** | Allowlist + denylist |
| Dependency adapter wiring | **No** | Separate slice |
| Endpoint wiring | **No** | Separate slice |
| Runtime Firebase Admin SDK | **No** | Blocked |
| Runtime `getAuth().verifyIdToken` | **No** | Blocked |
| Runtime external auth service | **No** | Blocked |
| `staging_live` rollout | **No** | Blocked |
| `production_live` rollout | **No** | Blocked |
| Real provider API call | **No** | Blocked |

## 14. Remaining blockers

A real implementation is required before the verifier can serve any
non-mock traffic. The blockers are:

- Real Firebase Admin SDK integration (project secret wiring,
  service account credentials, `verifyIdToken` migration).
- Custom JWT verifier (if Firebase is not used).
- Token-hash precomputation pipeline at the endpoint boundary so the
  verifier receives a `tokenHash` rather than a raw token.
- A real auth audit pipeline (out of scope for this slice).
- Production rollout gates (still blocked by upstream readiness).

## 15. Recommended next slice

`[TECH] Wire Scout auth verifier adapter into live dependency mock path`
— mirror the storage-adapter dependency wiring pattern. The dependency
adapter will accept an optional `verifierAdapter` option; the default
will be `createScoutLiveAuthVerifierAdapter({ mockDisabled: true })`.
The verifier payload will be allowlisted (no raw token / API key /
prompt / excerpt / sourceUrl). Verifier result codes will be mapped to
dependency-adapter safe-fail codes (`VERIFIER_MOCK_DISABLED` /
`VERIFIER_NOT_IMPLEMENTED` → `VERIFY_NOT_IMPLEMENTED`;
`VERIFIER_PAYLOAD_PROHIBITED` → `VERIFY_PAYLOAD_PROHIBITED`).

This next slice remains mock-disabled and does not introduce a real
Firebase Admin SDK or real token verification.

## 16. Explicit verdict

The auth verifier adapter skeleton is **complete for this slice**.
It is mock-disabled, fail-closed, and does not access any external
auth backend. The interface and sensitive-data guardrails are locked
by contract tests so the next slice can safely wire it into the
dependency adapter without expanding the trust boundary.

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

## Disabled Firebase Verifier Dependency Wiring Status

The disabled Firebase auth verifier scaffold result codes are now wired into the Scout live dependency adapter contract (v20260607-1, wiring-only slice, no runtime live behavior change, no real Firebase Admin SDK, no real token verification):

- `VERIFIER_FIREBASE_DISABLED` maps to `VERIFY_NOT_IMPLEMENTED`
- `VERIFIER_CONFIG_MISSING` maps to `VERIFY_UNAVAILABLE`
- Existing mappings preserved: `VERIFIER_MOCK_DISABLED`, `VERIFIER_NOT_IMPLEMENTED`, `VERIFIER_PAYLOAD_PROHIBITED` → same dependency-adapter codes
- Unknown verifier code and verifier throw still safe-fail to `VERIFY_UNAVAILABLE`
- No automatic Firebase mode enable in dependency adapter
- Default `createScoutLiveDependencyAdapter()` behavior remains `mockDisabled: true`
- `suggest.js` remains unchanged
- Endpoint default `providerMode: "stub"` preserved
- Explicit stub path preserved
- Frontend default `local_stub` preserved
- Endpoint client default disabled preserved
- `staging_live` / `production_live` remain blocked
- No real Firebase Admin SDK / no real token verification / no fetch / no provider SDK / no env secret usage / no KV / DO / D1
