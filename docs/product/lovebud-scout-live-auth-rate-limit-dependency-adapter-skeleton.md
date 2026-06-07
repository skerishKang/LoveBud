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

## 10. Verdict

- Dependency adapter skeleton (this slice): **YES** (mock-disabled)
- Wiring into `suggest.js` LIVE branch: **separate slice** (mock-disabled)
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations: **NO**
- Real Firebase / KV / DO / D1 / provider SDK / staging / production: **NO**
