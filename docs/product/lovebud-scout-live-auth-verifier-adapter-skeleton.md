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
