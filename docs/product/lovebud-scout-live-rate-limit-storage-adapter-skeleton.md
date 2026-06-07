# Scout Live Rate-Limit Storage Adapter Skeleton

> Status: **skeleton only** (mock-disabled)
> Version: v20260607-1
> Audience: Scout live provider engineering
> Scope: storage adapter skeleton for the future runtime rate-limit backend

## 1. Purpose

This document defines the **mock-disabled storage adapter skeleton** for the
Scout live provider path. The adapter provides a future interface for
persistent rate-limit quota state (KV / Durable Object / D1) **without**
actually accessing any external storage in this slice.

Real implementations of the storage adapter (e.g. Cloudflare KV binding,
Durable Object namespace, D1 database) will be added in future slices.
This skeleton locks the interface, default fail-closed behavior, and
sensitive-data payload guardrails so the endpoint can never accidentally
read or write real storage while the skeleton is in place.

## 2. Module

`functions/api/scout/live-rate-limit-storage-adapter.js` (v20260607-1)

Exports:

- `SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_VERSION` — `'20260607-1'`
- `SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_MODES` — `{ MOCK_DISABLED, NOT_IMPLEMENTED }`
- `SCOUT_LIVE_RATE_LIMIT_STORAGE_ADAPTER_CODES` — `{ STORAGE_MOCK_DISABLED, STORAGE_NOT_IMPLEMENTED, STORAGE_PAYLOAD_PROHIBITED }`
- `SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_ALLOWED_FIELDS` — allowlist
- `SCOUT_LIVE_RATE_LIMIT_STORAGE_PAYLOAD_PROHIBITED_FIELDS` — denylist
- `sanitizeScoutLiveRateLimitStoragePayload(payload, options?)` — pure helper
- `createScoutLiveRateLimitStorageAdapter(options?)` — factory

## 3. Factory contract

```
createScoutLiveRateLimitStorageAdapter(options?) -> adapter
```

Options:

- `mockDisabled: boolean` — default `true`. When `true`, the factory returns
  a mock-disabled adapter. When `false`, the factory returns a not-implemented
  adapter (real implementations are not yet provided).
- `onProhibitedField: 'drop' | 'reject'` — default `'drop'`. Controls how
  `sanitizePayload` handles prohibited fields in a payload.

The returned adapter is **frozen** and has the shape:

```
{
  kind: 'scout_live_rate_limit_storage_adapter',
  version: '20260607-1',
  mode: 'mock_disabled' | 'not_implemented',
  mockDisabled: boolean,
  isMockDisabled: boolean,
  onProhibitedField: 'drop' | 'reject',
  checkQuota: async (payload) => { allowed, code, reason, retryAfterSeconds, remaining },
  consumeQuota: async (payload) => { allowed, code, reason },
  releaseQuota: async (payload) => { released, code, reason },
  sanitizePayload: (payload, options?) => { payload, rejected, rejectedFields },
}
```

## 4. Method inventory

### 4.1 checkQuota

Returns a quota-check result.

Mock-disabled:

```
{
  allowed: false,
  code: 'STORAGE_MOCK_DISABLED',
  reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
  retryAfterSeconds: null,
  remaining: null,
}
```

Not-implemented:

```
{
  allowed: false,
  code: 'STORAGE_NOT_IMPLEMENTED',
  reason: 'Live rate-limit storage adapter is not implemented; real implementation is required.',
  retryAfterSeconds: null,
  remaining: null,
}
```

### 4.2 consumeQuota

Returns a consume-quota result.

Mock-disabled:

```
{
  allowed: false,
  code: 'STORAGE_MOCK_DISABLED',
  reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
}
```

### 4.3 releaseQuota

Returns a release-quota result.

Mock-disabled:

```
{
  released: false,
  code: 'STORAGE_MOCK_DISABLED',
  reason: 'Live rate-limit storage adapter is mock-disabled; no real storage is accessed.',
}
```

## 5. Storage payload policy

### 5.1 Allowed fields (allowlist)

The `sanitizePayload` helper only preserves these fields:

- `requestId`
- `userKeyHash`
- `ipHash`
- `sessionKeyHash`
- `endpointPath`
- `providerMode`
- `windowKey`
- `limitName`
- `nowMs`

All other fields (including unknown fields) are dropped.

### 5.2 Prohibited fields (denylist)

These fields are **always** stripped or rejected:

- `token`, `rawToken`, `authorization`
- `apiKey`, `secret`
- `prompt`, `excerpt`, `sourceUrl`
- `rawRequestBody`, `rawProviderResponse`, `rawModelOutput`
- `password`, `cookie`, `sessionCookie`
- `firebaseToken`
- `openaiApiKey`, `anthropicApiKey`, `geminiApiKey`, `groqApiKey`, `mistralApiKey`, `nvidiaApiKey`

### 5.3 `onProhibitedField` modes

- `'drop'` (default) — prohibited fields are silently stripped; the helper
  tracks them in `rejectedFields` but does not fail the call.
- `'reject'` — if any prohibited field is present, the helper returns
  `{ payload: {}, rejected: true, rejectedFields: [...] }` and the
  caller should treat the call as failed.

## 6. No external storage access guarantee

This skeleton does **not** access:

- Cloudflare KV (`env.KV`, `KVNamespace`)
- Durable Objects (`DurableObjectNamespace`, `DurableObjectBinding`)
- D1 database (`env.DB`, `D1Database`, `d1.prepare()`)
- Any other database (Postgres, MySQL, SQLite, etc.)
- Any `fetch`, `XMLHttpRequest`, `axios`, or `new Request(...)` call
- Any `env.SCOUT_*`, `env.STORAGE`, `env.RATE_LIMIT` binding
- Any `process.env.SCOUT_*` or `import.meta.env` reading
- Any Firebase Admin SDK import
- Any provider SDK import (openai, anthropic, gemini, groq, mistral, nvidia, cohere, perplexity)

## 7. Error mapping

| Storage adapter code | Endpoint boundary code | HTTP status |
| --- | --- | --- |
| `STORAGE_MOCK_DISABLED` | `RATE_LIMIT_UNAVAILABLE` | 503 |
| `STORAGE_NOT_IMPLEMENTED` | `RATE_LIMIT_UNAVAILABLE` | 503 |
| `STORAGE_PAYLOAD_PROHIBITED` | `RATE_LIMIT_UNAVAILABLE` | 503 |

The mapping is performed at the endpoint boundary (future slice) — the
storage adapter itself does not perform the mapping.

## 8. Privacy / safety guardrails

- Raw tokens, API keys, prompts, excerpts, source URLs, and raw request
  bodies are never accepted as storage payload fields
- The denylist is exported as a frozen constant so future implementations
  cannot accidentally bypass it
- The allowlist is exported as a frozen constant so future implementations
  have a single source of truth for safe payload fields
- `sanitizePayload` is a pure helper (no side effects, no storage call)
- The adapter is frozen and immutable at runtime

## 9. Boundary inventory

This skeleton sits **alongside** the existing boundary modules:

- `functions/api/scout/live-auth-rate-limit-boundary.js` — canonical runtime
  boundary + DI seam
- `functions/api/scout/live-auth-rate-limit-observability.js` — observability
  helper
- `functions/api/scout/live-auth-rate-limit-dependency-adapter.js` —
  dependency adapter skeleton (verifyToken / checkRateLimit / requestId)
- `functions/api/scout/live-rate-limit-storage-adapter.js` — storage
  adapter skeleton (checkQuota / consumeQuota / releaseQuota) — this document

The storage adapter skeleton is a **separate module** with a **clear
single responsibility** (provide default storage adapter interface for
future KV/DO/D1 implementations). It is not wired into `suggest.js` LIVE
branch in this slice.

## 10. Go / no-go matrix

| Item | Verdict | Notes |
| --- | --- | --- |
| Storage adapter skeleton module itself | **YES** | this slice |
| Wiring the storage adapter into `suggest.js` LIVE branch | **separate slice** | out of scope for this slice |
| Real KV adapter implementation | **NO** | future slice |
| Real Durable Object adapter implementation | **NO** | future slice |
| Real D1 adapter implementation | **NO** | future slice |
| Real database adapter implementation (Postgres / MySQL / SQLite) | **NO** | future slice |
| Real observability backend integration | **NO** | future slice |
| `staging_live` execution | **NO** | blocked |
| `production_live` execution | **NO** | blocked |
| Real provider API call | **NO** | blocked |

## 11. Remaining blockers

- Real KV adapter (Cloudflare KV binding)
- Real Durable Object adapter (DurableObjectNamespace)
- Real D1 adapter (D1Database)
- Wiring the storage adapter into the dependency adapter or `suggest.js`
- Real observability backend integration
- Provider-specific live adapter
- Staging soak
- Kill-switch drill
- Secret rotation drill
- Real `verifyToken` adapter (Firebase Admin SDK or equivalent)
- Real `checkRateLimit` adapter that uses this storage adapter

## 12. Recommended next slice

`[TECH] Wire Scout storage adapter into live dependency adapter mock path`
or
`[TECH] Add Scout live auth verifier adapter skeleton`.

Both slices will continue to be mock-disabled / no external calls / no
real provider API.

## 13. Verdict

- Storage adapter skeleton (this slice): **YES** (mock-disabled)
- Wiring into `suggest.js` LIVE branch: **separate slice** (mock-disabled)
- Real KV / Durable Object / D1 / database implementations: **NO**
- Real Firebase / provider SDK / staging / production: **NO**

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
