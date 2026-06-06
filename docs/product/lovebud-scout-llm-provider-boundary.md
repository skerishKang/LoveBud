# LoveBud Scout LLM Provider Boundary Audit

## Baseline

- **current main HEAD**: `06ce3b67`
- **related PRs**: #2203-2225 inclusive (Scout Draft MVP through live config boundary)
- **related issues**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP), #1661 (DB/API: Add tree-level social counts for Browse sorting)
- **current Scout capabilities**: Manual draft entry with user-provided source URL, excerpt, memo, emotion tags → save to LoveTree via existing add-memory flow

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

---

## Document Metadata

- **Created**: 2026-06-05
- **Author**: Audit follow-up for #1882
- **Status**: Phase A (audit) complete, Phase B (stub contract) implemented, **Phase D prep (endpoint skeleton) implemented**, **Auth/RL contract added (placeholder enforcement)**, **Live Config boundary added (CONFIG_MISSING fallback)**, **Endpt Client boundary added (disabled by default)**, **Source Selector boundary added (local_stub default, endpoint_client requires feature flag)**, **Endpoint opt-in QA scenario added (default local_stub, endpoint_client behind explicit flag only)**, **MVP Readiness Audit completed (ready for next boundary planning, not ready for default live usage)**, **Prompt/Response Contract completed (Product Prompt safety note, English/Korean). See lovebud-scout-live-provider-prompt-response-contract.md**, **Live Provider Adapter Skeleton added (prompt builder + response validator + adapter interface, no real provider call). See functions/api/scout/live-provider-adapter.js**, **Endpoint Adapter Wiring added (endpoint recognizes adapter skeleton, live mode safe-fails with CONFIG_MISSING, default stub preserved). See tests/contracts/scout-endpoint-adapter-skeleton-wiring-contract.test.cjs**, **Mock Execution Contract added (adapter accepts injected executor, runs prompt builder → executor → response validator, network-free, no real provider call). See tests/contracts/scout-live-provider-mock-execution-contract.test.cjs**, **Logging Boundary added (safe observability helpers: createScoutLiveProviderLogEvent + sanitizeScoutLiveProviderLogPayload, allowed/prohibited log fields, optional injected logger with safe swallow, no prompt/excerpt/sourceUrl/API key/PII logging). See tests/contracts/scout-live-provider-logging-boundary-contract.test.cjs**, **Timeout/Retry Boundary added (timeout/retry policy constants, runScoutLiveProviderExecutorWithTimeout helper, executor throw/timeout retry with safe clamping, retry exhaustion → PROVIDER_ERROR, malformed output no retry, sanitized retryCount/maxRetries logging). See tests/contracts/scout-live-provider-timeout-retry-boundary-contract.test.cjs**, **Output Safety Filter added (SCOUT_LIVE_PROVIDER_OUTPUT_SAFETY_LIMITS + filterScoutLiveProviderOutput integrated into validator: strips metadata fields, blocks credential patterns, blocks excessive/full excerpt reproduction, blocks sourceUrl raw repetition, clamps text fields, unsafe → PROVIDER_ERROR). See tests/contracts/scout-live-provider-output-safety-filter-contract.test.cjs**
- **Next Review**: After Phase D implementation decision