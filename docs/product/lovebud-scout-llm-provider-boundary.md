# LoveBud Scout LLM Provider Boundary Audit

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

## Why LLM Support Comes After Manual Save

- Scout Draft manual save is already working end-to-end (PR #2209)
- AI suggestion is an **enhancement**, not a prerequisite
- Save flow stabilization was required before adding non-deterministic AI layer
- Now that manual path is solid, provider boundary can be defined for future enhancement
- This audit documents the boundary **before** any implementation

---

## 400-ai-finder Patterns Worth Reusing

| 400-ai-finder Pattern | Use in LoveBud? | Notes |
|---|---|---|
| LLM provider abstraction | Yes | Scout suggestion provider에 적용 |
| mock provider | Yes | Unit/contract tests용 |
| stub provider | Yes | Deterministic suggestion output for tests |
| openai-compatible provider | Later | Server/serverless only, not in frontend |
| model preset system | Maybe later | MVP에는 과함 |
| site profile/search pipeline | No | LoveBud scope와 다름 |
| fetch/crawler/indexer | No | Scout Phase 2 전까지 금지 |
| API key 없는 테스트 경로 | Yes | Frontend에 API key 없음 원칙 |
| live/API 호출 경계 | Yes | Server/serverless만 live call |
| structured output schema | Yes | Suggestion output schema 정의 |
| fallback/pending configuration | Yes | Missing config 시 안전한 fallback |

---

## Scout Suggestion Use Cases

### 초기 LLM suggestion 범위 (허용)

1. **summarize user-entered excerpt** — 사용자가 입력한 발췌문을 1-2문장으로 요약
2. **translate or rewrite into Korean/English** — 발췌/메모를 요청 언어로 번역/다듬기
3. **suggest emotion tags** — 내용 기반 감정 태그 1-4개 제안 (max 4, each ≤20 chars)
4. **suggest save-ready title** — 저장용 제목 50자 내외 제안
5. **suggest memo draft** — 발췌+메모를 자연스러운 메모 초안으로 재구성

### 명확히 금지 (Non-goals)

- ❌ Automatic URL fetch / content extraction
- ❌ Private/paywalled content processing
- ❌ Full copyrighted article storage/reproduction
- ❌ Background crawling of linked sources
- ❌ Auto-save without user review
- ❌ Any network call from frontend to LLM provider
- ❌ API keys in frontend code

---

## Proposed Suggestion Output Schema

```javascript
{
  // 제안된 제목 (max 50 chars)
  titleSuggestion: string,

  // 제안된 요약/번역 (max 200 chars)
  summarySuggestion: string,

  // 제안된 번역/재작성 (Korean/English)
  translationSuggestion: string,

  // 제안된 감정 태그 (max 4, each ≤20 chars)
  emotionTags: string[],

  // 제안된 메모 초안
  memoSuggestion: string,

  // 안전/저작권 관련 안내
  safetyNote: string
}
```

### 제약 조건

- `emotionTags` max 4개, 각각 max 20자
- 원문(full-text) 재생산 금지 — 요약/번역만 허용
- 사용자 리뷰 전 자동 저장 금지
- 출력은 편집 가능해야 함
- 자동 영속화(persistence) 없음 — 사용자가 "저장" 클릭 전까지 메모리만

---

## Provider Boundary

### 권장 아키텍처

```text
Scout UI (frontend)
  → Scout Suggestion Client (frontend, no API keys)
  → Server/serverless endpoint (/api/scout/suggest)
  → LLM Provider Abstraction (backend)
      ├── MockProvider (tests)
      ├── StubProvider (deterministic CI)
      └── OpenAICompatibleProvider (production, behind env config)
```

### 중요 정책

| 정책 | 설명 |
|---|---|
| **Frontend API key 없음** | 브라우저 JS에 LLM API key 절대 저장/노출 금지 |
| **브라우저 직접 LLM 호출 금지** | 모든 LLM 호출은 server/serverless endpoint 경유 |
| **Tests default to mock/stub** | CI에서 네트워크 없는 테스트 가능 |
| **Live provider opt-in only** | 환경변수 설정 없으면 mock/stub만 동작 |
| **Missing config → safe fallback** | 설정 누락 시 "AI 제안은 현재 비활성화됨" 메시지 반환 |

---

## Stub Provider Requirements

Stub provider는 실제 API 호출 없이 **결정론적(deterministic)**인 suggestion을 반환한다.

### 필수 요구사항

- ✅ Deterministic output — 같은 입력에 항상 같은 출력
- ✅ No network — 네트워크 호출 없음
- ✅ No API key — 키 불필요
- ✅ No environment dependency — env var 없이 동작
- ✅ Test-friendly — 단위/계약 테스트에서 바로 사용 가능
- ✅ Schema-compliant — 위 output schema 준수

### 구현 예시 (개념)

```javascript
// StubProvider — 테스트용
class ScoutStubSuggestionProvider {
  async suggest(input) {
    return {
      titleSuggestion: `제안: ${input.excerpt?.slice(0, 30) || '제목'}`,
      summarySuggestion: `요약: ${input.excerpt?.slice(0, 100) || '내용 없음'}`,
      translationSuggestion: input.lang === 'en' ? 'Translated suggestion' : '번역 제안',
      emotionTags: ['감동', '행복'],
      memoSuggestion: `메모 초안: ${input.memo || input.excerpt || ''}`,
      safetyNote: '이 제안은 사용자 검토 후 저장해 주세요.'
    };
  }
}
```

---

## Prompt Boundary

### 프롬프트에 포함 가능한 것 (Allow)

- 사용자가 직접 입력한 `excerpt` (발췌/요약)
- 사용자가 직접 입력한 `memo` (메모)
- `sourceUrl` 문자열 (attribution용, 내용 fetch 안 함)
- 요청 언어 (`ko` | `en`)
- 원하는 톤 (`casual` | `polite` | `emotional` 등)
- 최대 출력 길이 제한

### 프롬프트에 포함하지 말 것 (Deny)

- ❌ Hidden/private 사용자 데이터
- ❌ 자동으로 가져온 전체 기사(full article) 내용
- ❌ Auth/session token
- ❌ API key 또는 provider credentials
- ❌ 무관한 트리/메모리 데이터
- ❌ 사용자 식별 정보 (PII)

---

## Safety / Copyright Boundary

| 원칙 | 적용 |
|---|---|
| **User-provided text only** | 사용자가 직접 입력한 텍스트만 LLM에 전달 |
| **Public source URL as attribution** | URL 문자열만 포함, 내용 fetch 금지 |
| **No automatic fetching** | 외부 콘텐츠 자동 크롤링/가져오기 금지 |
| **No paywalled/private content** | 유료/비공개 콘텐츠 처리 금지 |
| **No full article reproduction** | 원문 전체 재생산 금지 — 요약/번역만 |
| **No auto-save** | 사용자 명시적 "저장" 액션 전까지 영속화 금지 |
| **User review required** | 제안 필드 편집 가능, 저장 전 검토 필수 |
| **Generated content marked as suggestion** | UI에서 "AI 제안" 표시, 원본과 구분 |

---

## Implementation Phases

| Phase | Scope | Deliverable |
|---|---|---|
| **Phase A** | Audit only | 이 문서 (`lovebud-scout-llm-provider-boundary.md`) |
| **Phase B** | Stub suggestion provider + UI contract | `ScoutStubSuggestionProvider`, suggestion request/response contract test |
| **Phase C** | Server/serverless endpoint boundary | Endpoint boundary audit + contract tests |
| **Phase D prep** | **Endpoint Skeleton (stub-first)** | `functions/api/scout/suggest.js`, skeleton contract tests |
| **Auth/RL Contract** | **Auth/Rate-Limit Boundary** | `parseScoutAuthorizationHeader`, `getScoutSuggestRateLimitPolicy`, auth/RL contract tests |
| **Live Config Boundary** | **Provider Config Boundary** | `resolveScoutSuggestProviderMode`, `SCOUT_SUGGEST_PROVIDER_MODES`, CONFIG_MISSING fallback, config contract tests |
| **Source Selector Boundary** | **Suggestion Source Selector** | `js/scout/scout-suggestion-source-selector.js`, source selector contract tests, local_stub default, endpoint_client requires feature flag |
| **Phase D** | Real provider behind env config | OpenAICompatibleProvider, env-based model selection |
| **Phase E** | Rate limiting / abuse controls / hardening | Quota, caching, monitoring, fallback UX |

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

## Recommended Next Slice

### `[PRODUCT] Add Scout stub suggestion provider contract`

**Scope:**
- No real LLM
- No network
- No API key
- Deterministic stub output
- UI can request suggestion and fill preview fields
- User must still click save

**Files to create/modify:**
- `js/scout/scout-suggestion-provider.js` — provider abstraction + stub implementation
- `js/scout/scout-draft-ui.js` — suggestion request button + preview fill
- `tests/contracts/scout-suggestion-provider-contract.test.cjs` — contract test
- Update `docs/product/lovebud-scout-llm-provider-boundary.md` with implementation notes

**Non-goals for this slice:**
- No real AI
- No external fetch
- No crawler
- No source metadata extraction
- No schema migration
- No #1661 Browse work

---

## Non-goals (Overall)

- ❌ No actual AI provider implementation in this audit
- ❌ No API keys or environment variables
- ❌ No frontend API key exposure
- ❌ No external URL fetching
- ❌ No crawler or metadata extraction
- ❌ No backend/schema migration
- ❌ No #1661 Browse work

## Production Readiness Gates Audit Status

A consolidated [production readiness gates audit](lovebud-scout-live-provider-production-readiness-gates-audit.md) has been completed. It provides:
- Go/no-go matrix for first real provider adapter, staging_live, and production_live
- Endpoint default remains stub; UI default remains local_stub
- First provider-specific adapter skeleton is conditional only if disabled-by-default and no provider API call
- staging_live and production_live remain blocked
- Real provider API call remains blocked in the current slice

---

## Document Metadata

- **Created**: 2026-06-05
- **Author**: Audit follow-up for #1882
- **Status**: Phase A (audit) complete, Phase B (stub contract) implemented, **Phase D prep (endpoint skeleton) implemented**, **Auth/RL contract added (placeholder enforcement)**, **Live Config boundary added (CONFIG_MISSING fallback)**, **Endpt Client boundary added (disabled by default)**, **Source Selector boundary added (local_stub default, endpoint_client requires feature flag)**, **Endpoint opt-in QA scenario added (default local_stub, endpoint_client behind explicit flag only)**, **MVP Readiness Audit completed (ready for next boundary planning, not ready for default live usage)**, **Prompt/Response Contract completed (Product Prompt safety note, English/Korean). See lovebud-scout-live-provider-prompt-response-contract.md**, **Live Provider Adapter Skeleton added (prompt builder + response validator + adapter interface, no real provider call). See functions/api/scout/live-provider-adapter.js**, **Endpoint Adapter Wiring added (endpoint recognizes adapter skeleton, live mode safe-fails with CONFIG_MISSING, default stub preserved). See tests/contracts/scout-endpoint-adapter-skeleton-wiring-contract.test.cjs**, **Mock Execution Contract added (adapter accepts injected executor, runs prompt builder → executor → response validator, network-free, no real provider call). See tests/contracts/scout-live-provider-mock-execution-contract.test.cjs**, **Logging Boundary added (safe observability helpers: createScoutLiveProviderLogEvent + sanitizeScoutLiveProviderLogPayload, allowed/prohibited log fields, optional injected logger with safe swallow, no prompt/excerpt/sourceUrl/API key/PII logging). See tests/contracts/scout-live-provider-logging-boundary-contract.test.cjs**, **Timeout/Retry Boundary added (timeout/retry policy constants, runScoutLiveProviderExecutorWithTimeout helper, executor throw/timeout retry with safe clamping, retry exhaustion → PROVIDER_ERROR, malformed output no retry, sanitized retryCount/maxRetries logging). See tests/contracts/scout-live-provider-timeout-retry-boundary-contract.test.cjs**, **Output Safety Filter added (SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS + filterScoutLiveProviderOutput integrated into validator: strips metadata fields, blocks credential patterns, blocks excessive/full excerpt reproduction, blocks sourceUrl raw repetition, clamps text fields, unsafe → PROVIDER_ERROR). See tests/contracts/scout-live-provider-output-safety-filter-contract.test.cjs**, **Live Provider Readiness Audit completed (ready for narrow disabled-by-default real-provider slice, not ready for default live AI, 9 blockers documented). See docs/product/lovebud-scout-live-provider-readiness-audit.md**, **Secret/Config Deployment Checklist added (secret management rules, allowed config names, Cloudflare platform secrets, staging/prod rollout checklists, rollback/kill switch, CI/test policy, logging/observability policy, user-facing safety policy, pre-integration gates. No real provider call, no API key, no live default behavior). See docs/product/lovebud-scout-provider-secret-config-deployment-checklist.md**, **Real Provider Adapter Interface added (normalizeScoutLiveProviderConfig: normalizes env/config into structured provider config with hasApiKey boolean, timeout/retry clamp; createScoutRealProviderAdapterInterface: returns disabled-by-default adapter interface, suggest() safe-fails with PROVIDER_UNAVAILABLE/CONFIG_MISSING, no API key value returned, no SDK no fetch no credentials). See functions/api/scout/live-provider-adapter.js**, **Disabled-Mode Endpoint Contract added (endpoint live mode branch uses createScoutRealProviderAdapterInterface: DISABLED→PROVIDER_UNAVAILABLE, CONFIG_MISSING→CONFIG_MISSING, READY_FOR_ADAPTER→safe-fail PROVIDER_UNAVAILABLE, default stub unchanged, existing createScoutLiveProviderAdapter export preserved, no real call). See functions/api/scout/suggest.js**, **Mock Executor Integration added (createScoutRealProviderAdapterInterface accepts injected executor/logger/requestId; READY_FOR_ADAPTER+executor routes through createScoutLiveProviderAdapter mock pipeline: prompt builder→executor→timeout/retry→validator→safety filter→sanitized logging; no executor→safe-fail; DISABLED/CONFIG_MISSING→no executor call; API key value never reaches pipeline/result/logs). See functions/api/scout/live-provider-adapter.js**, **Post-Mock Integration Readiness Audit added (blocker inventory, gates, updated verdict). See tests/contracts/scout-live-provider-post-mock-readiness-audit-contract.test.cjs**, **Staging Rollout Contract added (rollout modes, kill switch, rollback, opt-in, monitoring policies). See tests/contracts/scout-live-provider-staging-rollout-contract.test.cjs**, **Auth/Rate-Limit Persistence Boundary added (Firebase auth enforcement, persistent storage requirements, quota policy). See tests/contracts/scout-live-provider-auth-rate-limit-boundary.test.cjs**, **Cost/Quota Abuse Monitoring Contract added (cost caps, quota budget, abuse monitoring, provider failure accounting). See tests/contracts/scout-live-provider-cost-quota-abuse-monitoring-contract.test.cjs**, **Secret Rotation and Incident Runbook Contract added (secret storage/rotation, emergency revocation, incident response, compromise handling). See tests/contracts/scout-live-provider-secret-incident-runbook-contract.test.cjs**
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
