# LoveBud Scout Serverless Suggestion Endpoint Boundary Audit

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

## Live Auth/Rate-Limit Endpoint Safe-Fail Wiring (slice update)

- live auth/rate-limit endpoint safe-fail wiring added
- Live mode now routes through the auth/rate-limit boundary before any provider path
- Default endpoint behavior remains stub
- Frontend default remains local_stub
- No Firebase Admin SDK, KV, DO, D1, provider SDK, fetch, or persistence is added
- No real provider API call is enabled
- staging_live and production_live remain blocked

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


- **current main HEAD**: `6afb0aa5`
- **related PRs**: #2203-2272 inclusive (Scout Draft MVP through provider-specific adapter skeleton)
- **related issues**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP), #1661 (DB/API: Add tree-level social counts for Browse sorting)
- **current Scout status**: provider-specific adapter selection boundary added; provider-specific adapter skeleton added behind disabled mode; no provider API call; staging_live and production_live remain blocked
- **endpoint default**: remains stub (deterministic, network-free)
- **frontend default**: remains local_stub (no endpoint client)

---

## Purpose

This audit documents the **server/serverless endpoint boundary** for Scout suggestions **before** any implementation. It defines the contract that the `/api/scout/suggest` endpoint must satisfy, ensuring:

- Frontend never holds API keys
- All LLM calls go through this endpoint
- Rate limiting, authentication, and abuse controls are designed upfront
- Request/response schemas are versioned and validated
- Failure modes are explicit and safe

---

## Endpoint Specification

### HTTP Interface

| Property | Value |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/scout/suggest` |
| **Content-Type** | `application/json` |
| **Auth** | Bearer token (Firebase ID token) |
| **Rate Limit** | 10 req/min per user (configurable) |
| **Timeout** | 30s (client), 25s (server) |

### Request Schema

```json
{
  "excerpt": "string (required, 1-5000 chars, user-provided)",
  "memo": "string (optional, 0-5000 chars, user-provided)",
  "sourceUrl": "string (optional, valid URL, attribution only)",
  "lang": "string (optional, 'ko' | 'en', default: 'ko')",
  "tone": "string (optional, 'casual' | 'polite' | 'emotional', default: 'polite')",
  "maxTokens": "integer (optional, 50-500, default: 200)"
}
```

**Validation Rules:**
- `excerpt` is required and must be non-empty after trimming
- `sourceUrl` if provided must be a valid HTTP/HTTPS URL
- `lang` must be one of allowed values
- `tone` must be one of allowed values
- `maxTokens` must be within bounds
- No extra fields allowed (strict schema)

### Response Schema (Success: 200)

```json
{
  "titleSuggestion": "string (max 50 chars)",
  "summarySuggestion": "string (max 200 chars)",
  "translationSuggestion": "string (max 500 chars)",
  "emotionTags": "string[] (max 4 items, each max 20 chars)",
  "memoSuggestion": "string (max 2000 chars)",
  "safetyNote": "string",
  "meta": {
    "provider": "string (e.g., 'openai-gpt-4o-mini' | 'stub')",
    "model": "string",
    "requestId": "string (uuid)",
    "latencyMs": "integer"
  }
}
```

### Response Schema (Error)

```json
{
  "error": {
    "code": "string (ERROR_CODE)",
    "message": "string (user-facing, localized)",
    "details": "object (optional, internal debugging only)"
  },
  "meta": {
    "requestId": "string (uuid)",
    "retryAfterMs": "integer (optional, for rate limit)"
  }
}
```

---

## Error Codes

| Code | HTTP Status | User Message (ko) | User Message (en) | Retryable |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 데이터가 올바르지 않습니다. | Invalid request data. | No |
| `UNAUTHORIZED` | 401 | 인증이 필요합니다. 로그인해 주세요. | Authentication required. Please log in. | No |
| `FORBIDDEN` | 403 | 이 기능을 사용할 권한이 없습니다. | You don't have permission to use this feature. | No |
| `RATE_LIMITED` | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. | Too many requests. Please try again later. | Yes (after `retryAfterMs`) |
| `PROVIDER_UNAVAILABLE` | 503 | AI 제안 서비스를 일시적으로 사용할 수 없습니다. | AI suggestion service is temporarily unavailable. | Yes |
| `PROVIDER_ERROR` | 502 | AI 제안을 생성하지 못했습니다. | Failed to generate AI suggestion. | Yes |
| `CONFIG_MISSING` | 503 | AI 제안 설정이 준비되지 않았습니다. | AI suggestion is not configured yet. | No |
| `INTERNAL_ERROR` | 500 | 서버 오류가 발생했습니다. | An internal server error occurred. | Yes |

---

## Authentication & Authorization

### Token Requirements

- Frontend sends Firebase ID token in `Authorization: Bearer <token>` header
- Endpoint verifies token via Firebase Admin SDK
- Token must be valid and not expired
- User must have `scout:suggest` permission (future: role-based)

### Token Handling

- **Never log** the full token
- Log only token hash (first 8 chars) for debugging
- Reject requests without valid token with `401 UNAUTHORIZED`
- Token verification timeout: 5s (fail closed)

---

## Rate Limiting

### Limits

| Tier | Requests/Window | Window | Burst Allowance |
|---|---|---|---|
| Free/Anonymous | 5 | 1 minute | 2 |
| Authenticated User | 10 | 1 minute | 3 |
| Premium (future) | 30 | 1 minute | 5 |

### Implementation

- Redis-based sliding window (or Cloudflare KV / Durable Objects)
- Key: `ratelimit:scout:suggest:<userId>`
- On limit exceeded: return `429 RATE_LIMITED` with `Retry-After` header
- Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers

### Exemptions

- Health check endpoint (`GET /api/scout/suggest/health`) exempt
- Admin users (future) exempt

---

## Provider Abstraction (Backend)

### Interface

```typescript
interface ScoutSuggestionProvider {
  // Returns suggestion or throws ProviderError
  async suggest(input: SuggestionInput): Promise<SuggestionOutput>;
  
  // Health check for readiness
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
  
  // Provider metadata
  readonly name: string;
  readonly version: string;
  readonly supportedModels: string[];
}
```

### Provider Chain (Priority Order)

1. **Configured Live Provider** (e.g., OpenAICompatibleProvider) — if env vars present
2. **Stub Provider** — deterministic, no network, always available
3. **Mock Provider** — test only, not in production

### Configuration

```bash
# Required for live provider
SCOUT_LLM_PROVIDER=openai-compatible
SCOUT_LLM_API_KEY=<secret>           # Never in frontend, only server env
SCOUT_LLM_BASE_URL=https://api.openai.com/v1  # Or compatible endpoint
SCOUT_LLM_MODEL=gpt-4o-mini
SCOUT_LLM_MAX_TOKENS=500
SCOUT_LLM_TEMPERATURE=0.3

# Optional
SCOUT_LLM_TIMEOUT_MS=25000
SCOUT_LLM_RETRY_ATTEMPTS=2
```

### Missing Config Behavior

- If `SCOUT_LLM_API_KEY` not set → use Stub Provider
- Log warning at startup: `"SCOUT_LLM_API_KEY not set, using stub provider"`
- Never crash or expose config absence to frontend as error

---

## Security Boundaries

### Input Sanitization

- **Never** pass raw user input directly to LLM without validation
- Truncate `excerpt` to 5000 chars, `memo` to 5000 chars
- Strip control characters except newlines/tabs
- Reject requests with suspected prompt injection patterns (basic heuristics)

### Output Sanitization

- Truncate all string fields to schema max lengths
- Ensure `emotionTags` array length ≤ 4, each tag ≤ 20 chars
- Escape HTML entities in all string outputs (defense in depth)
- Validate output matches schema before returning

### Data Handling

| Data | Treatment |
|---|---|
| User excerpt/memo | Processed by LLM, **not logged** in full |
| Source URL | Logged (attribution), not fetched |
| Auth token | Verified, never logged in full |
| LLM request/response | Logged **metadata only** (latency, token counts, model) |
| PII | Never sent to LLM (enforced by input schema) |

### Secrets Management

- API keys **only** in server environment variables
- Never in code, never in frontend, never in logs
- Rotate via secret manager (Cloudflare/GCP/AWS secrets)
- Audit key access via Cloudflare Workers / Pages Functions secrets

---

## Failure Modes & Fallbacks

### Provider Failure Matrix

| Scenario | Behavior | Frontend Response |
|---|---|---|
| Live provider timeout | Retry (2x), then fallback to stub | Stub suggestion returned |
| Live provider 5xx | Retry (2x), then fallback to stub | Stub suggestion returned |
| Live provider 4xx (auth, quota) | Log alert, fallback to stub | Stub suggestion returned |
| Live provider invalid output | Validate, fallback to stub | Stub suggestion returned |
| All providers fail | Return `PROVIDER_ERROR` | Show error, manual save still works |
| Config missing at runtime | Use stub, log warning | Stub suggestion returned |

### Circuit Breaker (Future)

- Track consecutive failures per provider
- Open circuit after 5 failures in 1 minute
- Half-open after 30s, test with single request
- Log circuit state changes

### Degraded Mode

- If live provider unavailable > 5 min: serve stub only
- Frontend sees `meta.provider: "stub"` and can show "AI 제안은 제한된 모드입니다" banner
- Manual save path **always** functional

---

## Observability

### Required Metrics

| Metric | Type | Labels |
|---|---|---|
| `scout_suggest_requests_total` | Counter | `status` (success/error), `error_code` |
| `scout_suggest_latency_ms` | Histogram | `provider` (live/stub) |
| `scout_suggest_tokens_used` | Histogram | `type` (prompt/completion) |
| `scout_suggest_rate_limited` | Counter | `user_tier` |
| `scout_suggest_fallback_stub` | Counter | `reason` (timeout/error/config) |

### Logging

- **Structured JSON logs** only
- Log level: `info` for requests, `warn` for fallbacks, `error` for failures
- Include: `requestId`, `userId` (hashed), `provider`, `latencyMs`, `tokensUsed`
- **Never** log: full excerpt, memo, sourceUrl, auth token, API key

### Tracing

- Propagate `traceparent` header
- Add `requestId` to all log entries
- Correlate frontend → endpoint → provider

---

## Testing Contracts

### Unit Tests (No Network)

- Input validation (valid/invalid/boundary)
- Output schema validation
- Rate limiter logic (Redis mock)
- Provider fallback chain
- Error code mapping

### Contract Tests (This Repo)

- Request schema compliance
- Response schema compliance (success + all error codes)
- Auth verification (valid/expired/missing token)
- Rate limit headers present
- Stub provider deterministic output
- No API key in frontend bundle (static analysis)

### Integration Tests (Staging Only)

- End-to-end with live provider (optional, behind flag)
- Rate limit enforcement
- Circuit breaker behavior
- Degraded mode UI

---

## Implementation Phases (Recap)

| Phase | Scope | Deliverable |
|---|---|---|
| **Phase A** | LLM Provider Audit | `lovebud-scout-llm-provider-boundary.md` |
| **Phase B** | Stub Provider + UI Contract | `scout-suggestion-provider.js`, UI wiring, contracts |
| **Phase C** | **Serverless Endpoint Boundary** | **This document + endpoint contract tests** |
| **Phase D prep** | **Endpoint Skeleton (stub-first)** | `functions/api/scout/suggest.js`, skeleton contract tests |
| **Auth/RL Contract** | **Auth/Rate-Limit Boundary** | `parseScoutAuthorizationHeader`, `getScoutSuggestRateLimitPolicy`, auth/RL contract tests |
| **Live Config Boundary** | **Provider Config Boundary** | `resolveScoutSuggestProviderMode`, `SCOUT_SUGGEST_PROVIDER_MODES`, CONFIG_MISSING fallback, config contract tests |
| **Source Selector Boundary** | **Suggestion Source Selector** | `js/scout/scout-suggestion-source-selector.js`, source selector contract tests, local_stub default, endpoint_client requires feature flag |
| **Adapter Skeleton** | **Live Provider Adapter Skeletons** | `functions/api/scout/live-provider-adapter.js`, adapter skeleton contract tests, no real provider call |
| **Endpoint Adapter Wiring** | **Endpoint recognizes adapter skeleton** | `functions/api/scout/suggest.js` imports adapter, live mode calls adapter.suggest() with safe-fail, default stub preserved |
| **Phase D** | Live Provider Implementation | OpenAICompatibleProvider, env config, deployment |
| **Phase E** | Hardening | Rate limiting, circuit breaker, observability, abuse controls |

---

## Dependency Adapter Skeleton Status

A [dependency adapter skeleton](lovebud-scout-live-auth-rate-limit-dependency-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveDependencyAdapter`) returning default `verifyToken` / `checkRateLimit` / `requestId`
- Default `mockDisabled:true` so the endpoint cannot accidentally allow real traffic in skeleton mode
- No real Firebase Admin SDK, no real KV/DO/D1, no provider SDK, no fetch
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real `verifyToken` / `checkRateLimit` / `requestId` implementations, staging_live, and production_live all remain blocked

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

## Storage Adapter Skeleton Status

A [storage adapter skeleton](lovebud-scout-live-rate-limit-storage-adapter-skeleton.md) has been added (v20260607-1). It provides:
- A mock-disabled factory (`createScoutLiveRateLimitStorageAdapter`) returning default `checkQuota` / `consumeQuota` / `releaseQuota` / `sanitizePayload`
- Default `mockDisabled:true` so the endpoint cannot accidentally read or write real storage in skeleton mode
- No real KV / Durable Object / D1 / database / fetch / env storage binding access
- Storage payload sensitive data guardrails: allowlist (requestId, userKeyHash, ipHash, etc.) + denylist (token, apiKey, prompt, excerpt, sourceUrl, rawRequestBody, etc.)
- Response codes (`STORAGE_MOCK_DISABLED`, `STORAGE_NOT_IMPLEMENTED`) mappable to `RATE_LIMIT_UNAVAILABLE` at the endpoint boundary
- Not wired into `suggest.js` LIVE branch in this slice (wiring is a separate slice)
- Endpoint default `providerMode:"stub"` and frontend default `local_stub` preserved
- Real KV / Durable Object / D1 / database implementations, staging_live, and production_live all remain blocked

## Non-goals (This Audit)

- ❌ No actual endpoint implementation
- ❌ No live provider deployment
- ❌ No API key provisioning
- ❌ No Redis/Infrastructure provisioning
- ❌ No #1661 Browse work
- ❌ No schema migration
- ❌ No auto-save

---

## Next Slice Recommendation

### `[TECH] Implement Scout suggestion serverless endpoint (Phase D prep)`

**Scope:**
- Create `/api/scout/suggest` endpoint (Cloudflare Pages Function / Worker)
- Wire provider abstraction (stub + live behind env)
- Implement request validation, auth, rate limiting
- Deploy to staging behind feature flag
- Contract tests pass against live endpoint

**Files to create/modify:**
- `functions/api/scout/suggest.js` — endpoint handler
- `functions/api/scout/suggest-validation.js` — request/response validation
- `functions/api/scout/suggest-rate-limit.js` — rate limiter
- `js/scout/scout-suggestion-client.js` — frontend client (replaces direct provider call)
- Update `docs/product/lovebud-scout-serverless-endpoint-boundary.md` with implementation notes

**Non-goals:**
- No production live provider yet (stub only in staging)
- No #1661 Browse work

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

---

## Document Metadata

- **Created**: 2026-06-06
- **Author**: Audit follow-up for #1882
- **Status**: Phase C (serverless endpoint boundary audit) complete, **Phase D prep (endpoint skeleton) implemented**, **Auth/RL contract added (placeholder enforcement)**, **Live Config boundary added (CONFIG_MISSING fallback)**, **Endpt Client boundary added (disabled by default)**, **Source Selector boundary added (local_stub default, endpoint_client requires feature flag)**, **Endpoint opt-in QA scenario added (default local_stub, endpoint_client behind explicit flag only)**, **MVP Readiness Audit completed (ready for next boundary planning, not ready for default live usage)**, **Prompt/Response Contract completed (Product Prompt safety note, English/Korean). See lovebud-scout-live-provider-prompt-response-contract.md**, **Live Provider Adapter Skeleton added (prompt builder + response validator + adapter interface, no real provider call). See functions/api/scout/live-provider-adapter.js**, **Endpoint Adapter Wiring added (endpoint recognizes adapter skeleton, live mode calls adapter.suggest() with safe-fail, default stub preserved). See tests/contracts/scout-endpoint-adapter-skeleton-wiring-contract.test.cjs**, **Mock Execution Contract added (adapter accepts injected executor, runs prompt builder → executor → response validator, network-free, no real provider call). See tests/contracts/scout-live-provider-mock-execution-contract.test.cjs**, **Logging Boundary added (safe observability helpers: createScoutLiveProviderLogEvent + sanitizeScoutLiveProviderLogPayload, allowed/prohibited log fields, optional injected logger with safe swallow, no prompt/excerpt/sourceUrl/API key/PII logging). See tests/contracts/scout-live-provider-logging-boundary-contract.test.cjs**, **Timeout/Retry Boundary added (timeout/retry policy constants, runScoutLiveProviderExecutorWithTimeout helper, executor throw/timeout retry with safe clamping, retry exhaustion → PROVIDER_ERROR, malformed output no retry, sanitized retryCount/maxRetries logging). See tests/contracts/scout-live-provider-timeout-retry-boundary-contract.test.cjs**, **Output Safety Filter added (SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS + filterScoutLiveProviderOutput integrated into validator: strips metadata fields, blocks credential patterns, blocks excessive/full excerpt reproduction, blocks sourceUrl raw repetition, clamps text fields, unsafe → PROVIDER_ERROR). See tests/contracts/scout-live-provider-output-safety-filter-contract.test.cjs**, **Live Provider Readiness Audit completed (ready for narrow disabled-by-default real-provider slice, not ready for default live AI, 9 blockers documented). See docs/product/lovebud-scout-live-provider-readiness-audit.md**, **Secret/Config Deployment Checklist added (secret management rules, allowed config names, Cloudflare platform secrets, staging/prod rollout checklists, rollback/kill switch, CI/test policy, logging/observability policy, user-facing safety policy, pre-integration gates. No real provider call, no API key, no live default behavior). See docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md**, **Real Provider Adapter Interface added (normalizeScoutLiveProviderConfig: normalizes env/config into structured provider config with hasApiKey boolean, timeout/retry clamp; createScoutRealProviderAdapterInterface: returns disabled-by-default adapter interface, suggest() safe-fails with PROVIDER_UNAVAILABLE/CONFIG_MISSING, no API key value returned, no SDK no fetch no credentials). See functions/api/scout/live-provider-adapter.js**, **Disabled-Mode Endpoint Contract added (endpoint live mode branch uses createScoutRealProviderAdapterInterface: DISABLED→PROVIDER_UNAVAILABLE, CONFIG_MISSING→CONFIG_MISSING, READY_FOR_ADAPTER→safe-fail PROVIDER_UNAVAILABLE, default stub unchanged, existing createScoutLiveProviderAdapter export preserved, no real call). See functions/api/scout/suggest.js**, **Mock Executor Integration added (createScoutRealProviderAdapterInterface accepts injected executor/logger/requestId; READY_FOR_ADAPTER+executor routes through createScoutLiveProviderAdapter mock pipeline: prompt builder→executor→timeout/retry→validator→safety filter→sanitized logging; no executor→safe-fail; DISABLED/CONFIG_MISSING→no executor call; API key value never reaches pipeline/result/logs). See functions/api/scout/live-provider-adapter.js**, **Post-Mock Integration Readiness Audit added (blocker inventory, gates, updated verdict). See tests/contracts/scout-live-provider-post-mock-readiness-audit-contract.test.cjs**, **Staging Rollout Contract added (rollout modes, kill switch, rollback, opt-in, monitoring policies). See tests/contracts/scout-live-provider-staging-rollout-contract.test.cjs**, **Auth/Rate-Limit Persistence Boundary added (Firebase auth enforcement, persistent storage requirements, quota policy). See tests/contracts/scout-live-provider-auth-rate-limit-boundary.test.cjs**, **Cost/Quota Abuse Monitoring Contract added (cost caps, quota budget, abuse monitoring, provider failure accounting). See tests/contracts/scout-live-provider-cost-quota-abuse-monitoring-contract.test.cjs**, **Secret Rotation and Incident Runbook Contract added (secret storage/rotation, emergency revocation, incident response, compromise handling). See tests/contracts/scout-live-provider-secret-incident-runbook-contract.test.cjs**
- **Next Review**: After Phase D implementation decision

## Reconcile (slice update)

- PR #2278 `functions/api/scout/live-auth-rate-limit-boundary.js` is the **canonical** auth/rate-limit runtime boundary skeleton
- **Parallel** `functions/api/scout/live-provider-auth-rate-limit-boundary.js` implementation is **not adopted** (different API surface, not merged)
- Endpoint live auth/rate-limit wiring remains a **separate future slice** — this slice does not wire the boundary into `suggest.js`
- Endpoint default remains `stub` — deterministic, no live provider call
- Frontend default remains `local_stub` — no network, no endpoint client
- No Firebase Admin SDK / no KV / Durable Object / D1 / no provider API call

## Storage Adapter Dependency Wiring Status

The storage adapter skeleton is now wired into the live dependency adapter mock path (v20260607-1, wiring slice):
- `createScoutLiveDependencyAdapter(options?)` accepts a `storageAdapter` option
- When `storageAdapter` is not provided, the canonical mock-disabled storage adapter is used as the default
- `checkRateLimit` routes through `storageAdapter.checkQuota` with an allowlisted payload only
- Storage adapter results are mapped to dependency-adapter safe-fail codes
- Storage adapter throw is safe-swallowed
- `suggest.js` is NOT modified in this slice (wiring is dependency-internal)
- No real KV / Durable Object / D1 / database / fetch / env storage binding
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
