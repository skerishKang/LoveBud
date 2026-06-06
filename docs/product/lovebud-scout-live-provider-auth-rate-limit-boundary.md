# LoveBud Scout Live Provider Auth / Rate-Limit Persistence Boundary

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

## Endpoint Live Auth/Rate-Limit Observability Contract (slice update)

- sanitized observability contract added for endpoint live auth/rate-limit boundary decisions
- allowlist event fields: `requestId`, `providerMode`, `boundaryDecision`, `authStatus`, `rateLimitStatus`, `errorCode`, `retryAfterSeconds`, `quotaBucket`, `userKeyHash` (redacted), `latencyMs`
- prohibited fields: raw token, API key, prompt, excerpt, raw request body, full sourceUrl, raw provider output, PII, credentials
- pure helper module: `functions/api/scout/live-auth-rate-limit-observability.js`
  - exports `SCOUT_LIVE_OBSERVABILITY_FIELDS` allowlist, `SCOUT_LIVE_OBSERVABILITY_DECISIONS` constants
  - exports `buildScoutLiveAuthEvent` / `buildScoutLiveRateLimitEvent` pure event builders
  - exports `sanitizeScoutLiveBoundaryEvent` (drops unknown fields, re-applies allowlist)
  - exports `safeInvokeScoutLiveObserver` (safe-swallow wrapper, never throws)
  - exports `createScoutLiveBoundaryObserver` (in-memory ring buffer for tests)
- endpoint wires an **optional** observer through `liveDependencies.observer` (i.e. `context.observer`)
- observer is called BEFORE early-return so all decisions (success + failure) are recorded
- observer throw is safe-swallowed: endpoint response is unchanged
- default stub / explicit stub: observer is NOT called (no live event emitted)
- live mode: auth + rate-limit decisions emit one sanitized event each
- userKey is NEVER logged raw; only `userKeyHash = "hk_" + safeAlnum(userKey)` (max 64 chars)
- no real logging backend (no console.log/error, no fetch-based logger, no external logger SDK)
- no Firebase Admin SDK / no KV / DO / D1 / no provider SDK / no fetch / no axios
- endpoint default stub / frontend `local_stub` / endpoint client disabled remain preserved
- `staging_live` and `production_live` remain blocked
- `tests/contracts/scout-live-auth-rate-limit-endpoint-observability-contract.test.cjs` — 24 sub-tests covering helper exports, allowlist shape, AUTH_REQUIRED / AUTH_INVALID / RATE_LIMIT_UNAVAILABLE / RATE_LIMITED / RATE_LIMIT_ALLOWED events, default/explicit stub observer skip, observer throw safe-swallow, allowlist-only event keys, raw token / API key / prompt / excerpt / full sourceUrl exclusion, limiter payload sanitization regression, no logging backend / no Firebase / no KV-DO-D1 / no provider SDK / no fetch

## Endpoint Injected Dependency Contract (slice update)

- endpoint constructs explicit `liveDependencies = { verifyToken, checkRateLimit, requestId }` DI seam in suggest.js
- default stub / explicit stub skip injected dependencies (verifier/limiter not called)
- live mode uses injected `verifyToken` through `context.verifyToken` (and `checkRateLimit` through `context.checkRateLimit`)
- missing injected `verifyToken` → safe-fail `AUTH_INVALID` / `AUTH_REQUIRED`
- missing injected `checkRateLimit` → safe-fail `RATE_LIMIT_UNAVAILABLE`
- auth failure short-circuits limiter (limiter is not called)
- limiter payload only carries safe fields (`userKey` / `providerMode` / `bucket`); raw token / API key / prompt / excerpt / full sourceUrl are never propagated
- mock dependency helper stores call metadata only (call counts + `tokenWasReceived: Boolean` + length) — raw token value is never retained
- no Firebase Admin SDK / no KV / DO / D1 / no provider SDK / no fetch / no axios
- endpoint default stub / frontend `local_stub` / endpoint client disabled remain preserved
- staging_live and production_live remain blocked
- `tests/contracts/scout-live-auth-rate-limit-endpoint-di-contract.test.cjs` — 20 sub-tests covering DI shape, default-stub skip, explicit-stub skip, live injected verifier/limiter, auth-failure short-circuit, missing-dep safe-fail, safe payload fields, response non-leakage, mock helper no-raw-token, no Firebase / no KV-DO-D1 / no provider SDK / no fetch

## Reconcile (slice update)

- PR #2278 `functions/api/scout/live-auth-rate-limit-boundary.js` is the canonical auth/rate-limit runtime boundary skeleton
- Parallel `functions/api/scout/live-provider-auth-rate-limit-boundary.js` implementation is **not adopted** — different API surface, not merged
- Endpoint live auth/rate-limit wiring: live auth/rate-limit endpoint safe-fail wiring added. Live mode now routes through the auth/rate-limit boundary before any provider path.
- Endpoint default remains **`stub`** — deterministic, no live provider call
- Frontend default remains **`local_stub`** — no network, no endpoint client
- No Firebase Admin SDK / no KV / Durable Object / D1 / no provider API call
- staging_live and production_live remain blocked


- **Status**: Complete — defines Firebase auth enforcement policy, unauthenticated request behavior, persistent rate-limit storage requirements, and quota policies for the Scout live provider path. Provider-specific adapter skeleton added behind disabled mode. Provider-specific adapter selection boundary added behind disabled mode (inert registry, neutral example provider only).
- **current main HEAD**: `f7d37545`
- **related issue**: #1882
- **Browse #1661** remains out of scope
- **current live provider status**: provider-specific adapter skeleton added; provider-specific adapter selection boundary added (inert registry, neutral example provider only); disabled-by-default; no provider API call; staging_live and production_live remain blocked

## Baseline

- Endpoint default remains **`stub`** — deterministic, network-free, no API key
- Frontend default remains **`local_stub`** — no network, no endpoint client
- Live mode safe-fails to `PROVIDER_UNAVAILABLE` or `CONFIG_MISSING` in all states
- No real provider SDK import, no fetch, no API key value propagation
- Staging rollout contract complete (rollout modes, kill switch, rollback, opt-in, monitoring policies)
- Real provider API call verdict: **No** (all slices to date)
- Staging live execution verdict: **No** (staging gates not satisfied)
- Production live execution verdict: **No** (production gates not satisfied)
- Provider-specific adapter skeleton exists, disabled by default, returns safe-fail
- Provider-specific adapter selection boundary exists, disabled-by-default, inert registry, neutral example provider only

## Current State

The `functions/api/scout/suggest.js` endpoint currently has placeholder auth and rate-limit enforcement, and the provider-specific adapter skeleton is added behind disabled mode:

- `parseScoutAuthorizationHeader()` — parses Bearer token but does not verify against Firebase
- `verifyScoutFirebaseToken()` — TODO comment only, no Firebase Admin SDK integration
- `checkScoutRateLimit()` — TODO comment only, no persistent storage integration
- Auth and rate-limit enforcement are **commented out** in the handler — all requests pass through without authentication or rate limiting in stub mode
- This is acceptable for stub-only dev mode but must change before any `staging_live` or `production_live` execution

## Purpose

- 이 문서는 Scout live provider가 실제 provider 호출 전에 반드시 가져야 할 auth/rate-limit persistence 경계를 정의한다.
- Firebase Admin SDK, KV, Durable Object, D1 등 실제 구현은 하지 않는다 — 이 문서는 **설계 계약(design contract)**이다.
- 실제 구현은 별도의 slice에서 진행한다.

## Non-goals

- No real LLM provider implementation
- No provider SDK imports
- No API keys or environment variables
- No Firebase Admin SDK integration
- No KV/Durable Object/D1 implementation
- No runtime rate-limit persistence
- No endpoint behavior change
- No frontend behavior change
- No persistence or auto-save
- No Browse #1661 work

## Auth Boundary

### Principle

Live provider path (staging_live or production_live) **must** require an authenticated user before any real provider call.

### Auth Enforcement Policy

| Scenario | Behavior | Error Code |
|---|---|---|
| Stub mode request, no auth token | Pass through — stub is available without auth | (none, stub returned) |
| Live mode request, no auth token | Fail before adapter execution | `AUTH_REQUIRED` → HTTP 401 |
| Live mode request, invalid/expired token | Fail before adapter execution | `AUTH_INVALID` → HTTP 401 |
| Live mode request, valid token | Allow, extract user identifier | (pass to adapter pipeline) |
| Live mode request, Firebase unavailable | Fail closed (not open) | `AUTH_UNAVAILABLE` → HTTP 503 |

### Auth Verification Method

- **Firebase Admin SDK** (`firebase-admin`) is already a project dependency in `package.json`
- Token verification via `firebase-admin/auth` `verifyIdToken()` method
- Auth result exposes only:
  - `uid` (Firebase user ID) — used for rate-limit key
  - `email` — for logging (hashed, never raw)
- Raw ID token must never be logged, stored, or included in error messages
- Token verification timeout: 5 seconds (fail closed)
- Token caching (optional future): cache verified token within its expiry window, with a max cache TTL of 15 minutes

### Unauthenticated Request Behavior

| Request Type | Behavior |
|---|---|
| Stub mode, no auth | Stub response as normal |
| Live mode, no auth | `AUTH_REQUIRED` error, no provider adapter call |
| Live mode via endpoint_client, no auth | `AUTH_REQUIRED` error (user seen in UI) |
| Source selector local_stub, no auth | local_stub response as normal |

### Auth Boundary for Staging vs Production

| Environment | Auth Enforcement |
|---|---|
| Development / local | May skip auth for testing (controlled by env flag) |
| Staging | Auth enforced for all live mode requests |
| Production | Auth enforced for all requests (stub mode may skip auth) |

### Auth Failure Safety

- Auth failure **must not** reveal whether a user account exists or the token format
- Error messages should be generic: `Authentication required`, `Invalid authentication`, `Authentication service unavailable`
- No token substring, Firebase project ID, or user identifier in error response

## Rate-Limit Persistence Boundary

### Principle

Persistent rate-limit storage **must** exist before `staging_live` can be enabled. In-memory rate limiting is insufficient for cross-request enforcement in serverless environments.

### Storage Requirement

- Storage must persist across function invocations (not in-memory)
- Storage must support atomic increment and TTL expiration
- Storage must be available in the same region as the function (low latency)
- Storage failure must fail closed (not open) — when storage is unavailable, the request must fail with `RATE_LIMIT_UNAVAILABLE`

### Storage Candidates

| Candidate | Pros | Cons | Recommended For |
|---|---|---|---|
| Cloudflare KV | Simple key-value, global replication, TTL support | Eventually consistent, not strongly consistent | Per-minute soft limits (acceptable staleness) |
| Cloudflare Durable Objects | Strong consistency, transactional counters | Per-object throughput limit (~1K ops/sec), higher complexity | Per-user rate-limit counters (hard limits) |
| Cloudflare D1 | SQL-based, strongly consistent | Higher latency, connection pool limits | Audit logging, usage analysis |
| In-memory (not acceptable) | Zero infra | Lost between invocations, no cross-request limit | Dev/test only — never staging/prod |
| Service binding to dedicated rate-limit service | Isolated, scalable | More infra complexity | Future, if KV/DO insufficient |

### Rate-Limit Dimensions

| Dimension | Source | Use |
|---|---|---|
| `userId` (Firebase `uid` hash) | Auth verification result | Primary rate-limit key |
| `clientIpHash` (SHA-256 of IP) | `request.headers.get('CF-Connecting-IP')` or equivalent | Secondary rate-limit key for unauthenticated requests |
| `deviceSessionKey` (if available) | `x-lovebud-session-id` header or similar | Per-session soft limit |
| `providerMode` | `SCOUT_SUGGEST_PROVIDER_MODE` | Separate limits for stub vs live (stub may have higher limit, live lower) |
| `endpointPath` | Request URL path | `/api/scout/suggest` only in current scope |
| `requestId` | Generated per request | Request tracing, deduplication |
| `rollingTimeWindow` | Computed at rate-limit check | Sliding window for soft/hard limits |

### Rate-Limit Key Design

```text
Primary key:  `ratelimit:scout:suggest:<hashedUserId>:<windowBucket>`
Secondary key: `ratelimit:scout:suggest:<clientIpHash>:<windowBucket>`
```

Window bucket format: `YYYYMMDDHHMM` (minute granularity) or `YYYYMMDDHH` (hour granularity), depending on the quota tier.

## Quota Policy

### Rate-Limit Tiers

| Tier | Per-Minute Soft Limit | Per-Hour Hard Limit | Per-Day Cost Cap | Applies When |
|---|---|---|---|---|
| Free / unauthenticated | 5 requests/min (stub only) | N/A | N/A | Source selector `local_stub` or `endpoint_client` in stub mode |
| Authenticated — stub | 30 requests/min | 500 requests/hour | N/A | Stub mode with valid auth |
| Authenticated — live (staging) | 10 requests/min | 100 requests/hour | N/A | Staging live mode |
| Authenticated — live (production) | 20 requests/min | 200 requests/hour | $X/day budget cap | Production live mode (cost cap TBD) |
| Admin / override | No limit (bypass) | No limit | Monitored | Explicit admin flag, audit logged |

### Quota Policy Rules

1. Staging quotas must be **lower** than production quotas (to catch abuse early).
2. Per-minute soft limit: exceed → warn in response header, allow burst of +20%.
3. Per-hour hard limit: exceed → `RATE_LIMITED` error, no further requests in window.
4. Per-day cost cap: if provider usage cost exceeds daily budget, live mode auto-disables for remainder of day (returns `PROVIDER_UNAVAILABLE`).
5. Admin override: separate bypass mechanism, must log all bypassed requests for audit.
6. Quota reset: at window boundary (minute/hour/day) automatically via TTL/expiry.

### Rate-Limit Response Headers

```text
X-RateLimit-Limit: <max_requests_per_window>
X-RateLimit-Remaining: <remaining_requests>
X-RateLimit-Reset: <unix_timestamp>  (window end)
Retry-After: <seconds_to_wait>        (only when rate limited)
```

## Failure Modes

| Error Code | HTTP Status | Cause | User-Facing Message |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | Live mode request missing auth token | 로그인이 필요합니다. / Authentication required. |
| `AUTH_INVALID` | 401 | Live mode request with invalid/expired token | 인증 정보가 올바르지 않습니다. / Invalid authentication. |
| `AUTH_UNAVAILABLE` | 503 | Firebase Admin SDK unavailable | 인증 서비스를 사용할 수 없습니다. / Authentication service unavailable. |
| `RATE_LIMITED` | 429 | Rate-limit quota exceeded | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. / Too many requests. Please try again later. |
| `RATE_LIMIT_UNAVAILABLE` | 503 | Rate-limit storage unavailable | 요청 한도 확인이 불가능합니다. / Rate limit check unavailable. |
| `PROVIDER_UNAVAILABLE` | 503 | Provider adapter unavailable | AI 제안 서비스를 사용할 수 없습니다. / AI suggestion service unavailable. |
| `CONFIG_MISSING` | 503 | Live mode config incomplete | AI 제안 설정이 준비되지 않았습니다. / AI suggestion not configured. |

### Failure Safety Rules

1. Auth failure must **never** fall through to provider adapter execution.
2. Rate-limit check failure must **never** fall through to provider adapter execution.
3. Auth/rate-limit failure must **not** expose internal config, token value, or storage details.
4. When auth is unavailable, stub mode may still serve requests (non-live).
5. When rate-limit storage is unavailable, the request must fail with `RATE_LIMIT_UNAVAILABLE` — not silently pass through.
6. Error responses must include `requestId` for debugging but never include user PII.

## Privacy / Logging Policy

### Allowed Fields (Rate-Limit and Auth Logging)

```text
- requestId
- providerMode
- adapterStatus
- errorCode
- latencyMs
- retryCount
- maxRetries
- quotaBucket (e.g., 'free', 'authenticated', 'admin')
- rateLimitTier
- hashedUserId (SHA-256 of Firebase uid — never raw uid)
- hashedClientIp (SHA-256 of IP — never raw IP)
- timestamp
```

### Prohibited Fields (Never Logged)

```text
- raw ID token / Firebase ID token
- API key / SCOUT_SUGGEST_LLM_API_KEY
- authorization header value
- bearer token
- prompt (raw assembled prompt)
- excerpt, summary, memo (user-entered text)
- rawProviderResponse / rawModelOutput
- sourceUrl with sensitive query parameters
- email (raw)
- phone
- password / secret
- cookie / session
- Firebase credential / uid (raw)
```

### Logging Rules

1. All auth/rate-limit events must pass through `sanitizeScoutLiveProviderLogPayload` or equivalent before logging.
2. Logger failures must never break request flow.
3. Structured JSON logging recommended.
4. Rate-limit counter increments should not be logged individually (only threshold events: quota reached, quota reset, rate-limited response).

## Abuse / Cost Gates

### Pre-Consumption Validation

Before consuming quota or executing a provider call:

```text
1. Validate request body (excerpt required, etc.)
2. Verify auth token (if live mode)
3. Check rate-limit quota
4. Check cost budget
5. Execute provider call (or mock/stub substitute)
6. Deduct quota / update cost counter
```

### Quota Reservation / Release Policy

For long-running provider calls (future):

```text
1. Reserve quota slot before provider call
2. If provider call fails (non-retryable), release quota slot
3. If provider call succeeds, commit quota deduction
4. If provider call times out, release quota slot (retry consumes from reserved slot)
```

Reservation prevents quota exhaustion by concurrent requests but adds complexity. For initial staging, post-execution deduction is acceptable.

### Provider Failure Accounting

```text
- Track consecutive provider failures per user
- After N consecutive failures (configurable, default 5), suspend live mode for that user for 1 hour
- Suspended user receives PROVIDER_UNAVAILABLE (not RATE_LIMITED)
- Suspension is separate from rate-limit quota
```
### Suspicious Repeated Failure Monitoring

```text
- Log per-user failure rate (failures / total requests)
- If failure rate > 50% in a 5-minute window, flag for review
- If failure rate > 80% in a 5-minute window, auto-suspend live mode for that user
- Thresholds are monitoring gates only — no automatic action initially
```

### Cost Tracking

```text
- Track per-user daily cost (estimated from model + token count)
- Track total daily cost across all users
- If total daily cost exceeds budget threshold, auto-disable live mode (all users → stub)
- Cost data stored in same persistent storage as rate-limit data
- Cost tracking is informational in staging, enforced in production
```

### Abuse Prevention Summary

| Gate | Staging | Production |
|---|---|---|
| Pre-consumption validation | ✅ Required | ✅ Required |
| Rate-limit enforcement | ✅ Required | ✅ Required |
| Cost budget tracking | 📋 Informational | ✅ Enforced |
| Provider failure suspension | 📋 Informational | ✅ Enforced |
| Suspicious failure monitoring | 📋 Informational | ✅ Enforced |
| Admin override audit | ✅ Required | ✅ Required |

## Preflight Checklist Before Staging Live

Before enabling `staging_live`:

- [ ] Auth/rate-limit persistence boundary documented (this document ✅)
- [ ] Cost/quota abuse monitoring contract documented — see [cost/quota abuse monitoring contract](lovebud-scout-live-provider-cost-quota-abuse-monitoring-contract.md)
- [ ] Secret rotation and incident runbook contract documented — see [secret incident runbook contract](lovebud-scout-live-provider-secret-incident-runbook-contract.md)
- [ ] Firebase Admin SDK token verification implemented (future slice)
- [ ] Persistent rate-limit storage implemented (future slice)
- [ ] Auth enforcement wired in suggest.js live mode branch
- [ ] Rate-limit enforcement wired in suggest.js live mode branch
- [ ] Unauthenticated live request returns AUTH_REQUIRED
- [ ] Rate-limit unavailable returns RATE_LIMIT_UNAVAILABLE
- [ ] No auth/rate-limit bypass for live mode requests
- [ ] Logging redaction verified for auth/rate-limit events
- [ ] Kill switch verified (staging rollout contract)
- [ ] Staging activation gates verified (staging rollout contract)

## Verdict

| Question | Answer |
|---|---|
| Ready for auth/rate-limit persistence boundary work | ✅ Yes (this document) |
| Ready for auth/rate-limit implementation (Firebase + KV/DO) | ❌ No — implementation deferred to future slice |
| Ready for staging_live execution | ❌ No — auth/rate-limit implementation incomplete |
| Ready for production_live execution | ❌ No — all production gates not satisfied |
| Ready for real provider API call in this slice | ❌ No — docs+tests only |
| Endpoint default remains stub | ✅ Yes |
| Frontend default remains local_stub | ✅ Yes |
| Firebase auth enforcement policy defined | ✅ Yes |
| Persistent rate-limit storage requirement defined | ✅ Yes |
| Storage candidates documented | ✅ Yes |
| Rate-limit dimensions and quota policy defined | ✅ Yes |
| Failure modes defined | ✅ Yes |
| Privacy/logging minimization defined | ✅ Yes |
| Abuse/cost gates defined | ✅ Yes |

## Recommended Next Slice

```
[TECH] Add Scout live provider cost/quota abuse monitoring contract
```

**Why:** After auth/rate-limit boundary is defined, the next requirement before any real provider call is cost cap, quota budget, abuse monitoring, suspicious usage reporting, and provider failure accounting. This slice would document the cost/quota/abuse monitoring contract without implementing billing or monitoring infrastructure.

**Alternative:**
```
[TECH] Implement Scout Firebase auth verification boundary
```
This would implement the Firebase Admin SDK token verification behind the `live` mode flag — still no real provider call, but the auth logic would be wired and testable with mock tokens.

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

## Non-goals (this document)

- ❌ No real LLM provider implementation
- ❌ No provider SDK imports
- ❌ No API keys or environment variables
- ❌ No Firebase Admin SDK integration
- ❌ No KV/Durable Object/D1 implementation
- ❌ No runtime rate-limit persistence
- ❌ No endpoint behavior change
- ❌ No frontend behavior change
- ❌ No persistence or auto-save
- ❌ No Browse #1661 work
