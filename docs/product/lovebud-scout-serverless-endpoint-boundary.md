# LoveBud Scout Serverless Suggestion Endpoint Boundary Audit

## Baseline

- **current main HEAD**: `06ce3b67`
- **related PRs**: #2203-2225 inclusive (Scout Draft MVP through live config boundary)
- **related issues**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP), #1661 (DB/API: Add tree-level social counts for Browse sorting)
- **current Scout capabilities**: Manual draft entry + stub suggestion UI wiring + unavailable/pending boundary

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
| **Phase D** | Live Provider Implementation | OpenAICompatibleProvider, env config, deployment |
| **Phase E** | Hardening | Rate limiting, circuit breaker, observability, abuse controls |

---

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

---

## Document Metadata

- **Created**: 2026-06-06
- **Author**: Audit follow-up for #1882
- **Status**: Phase C (serverless endpoint boundary audit) complete, **Phase D prep (endpoint skeleton) implemented**, **Auth/RL contract added (placeholder enforcement)**, **Live Config boundary added (CONFIG_MISSING fallback)**, **Endpt Client boundary added (disabled by default)**, **Source Selector boundary added (local_stub default, endpoint_client requires feature flag)**
- **Next Review**: After Phase D implementation decision