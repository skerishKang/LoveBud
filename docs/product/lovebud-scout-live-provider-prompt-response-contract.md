# LoveBud Scout Live Provider Prompt and Response Contract

> **Product Prompt (safety · copyright · boundary) — A formal contract that defines how a future Scout live provider must behave: what it may receive, what it may emit, and where the safety line is drawn. No real provider is implemented; this document locks the contract for the next slice.**

## Baseline

- **current main HEAD**: `43ce5b7b`
- **related issue**: #1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)
- **current readiness audit**: [lovebud-scout-ai-suggestion-mvp-readiness.md](lovebud-scout-ai-suggestion-mvp-readiness.md) — verdict: ready for next boundary planning, not ready for default live usage
- **current default suggestion source**: `local_stub`
- **live provider**: NOT IMPLEMENTED — this document defines the contract for a future live provider adapter

---

## Contract Purpose

- This document defines the **prompt input boundary**, **response contract**, **copyright policy**, and **safety constraints** for a future Scout live-provider suggestion adapter.
- It is a **product contract** that the future live provider implementation must satisfy.
- It does **not** implement any provider call, API key, or runtime behavior change.
- Provider-specific API calls remain explicitly out of scope.

---

## Allowed Prompt Inputs

| Input | Allowed? | Notes |
|---|---|---|
| `user-entered excerpt` | ✅ Yes | 사용자가 직접 입력한 발췌 텍스트 (trimmed, bounded) |
| `user-entered summary` | ✅ Yes | Optional, pre-computed 요약 |
| `user memo` | ✅ Yes | Optional, 사용자 메모 |
| `source URL string` | ✅ Yes | Attribution string only — never fetched by provider layer |
| `requested language` | ✅ Yes | `ko` / `en` enum, default `ko` |
| `desired tone` | ✅ Yes | `casual` / `polite` / `emotional`, default `polite` |
| `max output length` | ✅ Yes | Bounded integer, clamped to [50, 500] |

All prompt inputs must be **trimmed and bounded** before being assembled into any prompt sent to a live provider. Empty optional fields must be represented as safe empty strings.

---

## Prohibited Prompt Inputs

| Input | Status | Rationale |
|---|---|---|
| API keys | 🚫 Prohibited | Never in frontend; never in prompt |
| Auth / session tokens | 🚫 Prohibited | Never sent to provider |
| Hidden user profile / PII | 🚫 Prohibited | Beyond user-entered text |
| Unrelated LoveTree / tree data | 🚫 Prohibited | Scout scope only |
| Private messages not in Scout Draft | 🚫 Prohibited | User did not enter them |
| Automatically fetched full article text | 🚫 Prohibited | No crawling |
| Paywalled / private content | 🚫 Prohibited | Copyright compliance |
| Raw browser storage / cookies | 🚫 Prohibited | Security boundary |
| Firebase credentials | 🚫 Prohibited | Auth handled by endpoint only |
| Database records not selected by user | 🚫 Prohibited | No implicit data access |

---

## Prompt Assembly Rules

1. Provider prompt must be built **only from normalized, allowed input fields**.
2. `sourceUrl` is **attribution only** — it must never be fetched, crawled, or resolved.
3. `excerpt` must be bounded by a maximum input length (e.g., 5000 chars).
4. Empty optional fields (`summary`, `memo`, `sourceUrl`) must be represented as safe empty strings, never omitted in a way that changes prompt structure.
5. Provider prompt must include an instruction **not to reproduce full copyrighted text**.
6. Provider prompt must request **structured JSON only** as output format.
7. Provider prompt must state that the output is a **suggestion**, not final saved content.
8. The prompt assembly function must be testable in isolation with no network dependency.

---

## Copyright Boundary

| Principle | Status |
|---|---|
| User-provided text only | ✅ Enforced |
| No automatic article retrieval | ✅ Sealed |
| No paywalled/private content processing | ✅ Sealed |
| No full-text reproduction | ✅ Sealed |
| No long verbatim copying | ✅ Sealed |
| Summary must be **transformative** (not copy-paste) | ✅ Required |
| Translation operates only on user-provided excerpt | ✅ Required |
| Output must remain editable suggestion | ✅ Required |
| User review required before save | ✅ Required |

The live provider's prompt must instruct the model to produce **transformative summaries only** and never reproduce large blocks of the input text verbatim. The output schema should naturally constrain full-text reproduction by its length limits.

---

## Safety Boundary

| Principle | Status |
|---|---|
| No hidden data inference | ✅ Required |
| No credential handling in prompt | ✅ Required |
| No identity/PII expansion beyond user input | ✅ Required |
| No instruction to bypass copyright | ✅ Required |
| No source impersonation ("I read the article") | ✅ Required |
| No claim that source was read beyond user-provided excerpt | ✅ Required |
| `safetyNote` field required in every response | ✅ Required |
| Unsafe/missing config returns structured error, not partial save | ✅ Required |

---

## Response Schema

The live provider must return a JSON object matching exactly this schema after normalization:

```js
{
  titleSuggestion: string,       // max 50 chars
  summarySuggestion: string,     // max 200 chars
  translationSuggestion: string, // max 500 chars (may be empty if not requested)
  emotionTags: string[],         // max 4 items, each max 20 chars
  memoSuggestion: string,        // max 500 chars
  safetyNote: string             // always required
}
```

All six fields are **required after normalization** — missing fields must be filled with safe defaults or error.

---

## Response Validation Rules

1. All six text fields must be strings after normalization. Non-string values must be coerced or rejected.
2. `emotionTags` must be an array of strings. Non-array values become `[]`.
3. `emotionTags` max **4 items**. Excess items are truncated.
4. Each emotion tag max **20 characters**. Longer tags are truncated.
5. `titleSuggestion` max **50 characters**. Longer values are truncated.
6. `summarySuggestion` max **200 characters**. Longer values are truncated.
7. `translationSuggestion` max **500 characters**. Longer values are truncated.
8. `memoSuggestion` max **500 characters**. Longer values are truncated.
9. `safetyNote` must always be present. Missing values use a safe default.
10. **Raw model response must never be applied directly to UI without validation.** All responses pass through `normalizeScoutSuggestionOutput` (or equivalent) first.
11. Invalid/unsafe provider responses map to **`PROVIDER_ERROR`** — never partial save.
12. `CONFIG_MISSING` maps to safe error — never exposes config details.

---

## Language and Tone Rules

| Rule | Description |
|---|---|
| `requestedLanguage` guidance | `"ko"` → summary/translation in Korean; `"en"` → summary/translation in English |
| `desiredTone` guidance | `"casual"` / `"polite"` / `"emotional"` — guides memo/title style |
| Unsupported language | If not `"ko"` or `"en"`, fall back safely to `"ko"` |
| Unsupported tone | If not one of the three allowed values, fall back safely to `"polite"` |
| No invented facts | Provider must not invent facts about the source beyond what the user entered |
| `translationSuggestion` optional | May be empty if translation was not requested (e.g., same-language suggestion) |
| `summarySuggestion` concise | Should be editable, not a final sentence |
| Emotion tags | Based on excerpt content only, not external knowledge |

---

## Product Prompt (Safety Note)

The Product Prompt's safety note is the **non-negotiable instructions** that must appear in any live provider's prompt. The `safetyNote` returned in every response is the **echo of these instructions back to the user**, ensuring transparency about what the provider was told to do (and not do).

### Required safety note content (English canonical)

```
This is an AI-generated suggestion. The provider was instructed to:
- Use only the user-entered excerpt/memo text (no fetching, no inference)
- Produce a transformative summary, not a verbatim reproduction
- Return short, editable suggestions, not final saved content
- Refuse to invent facts about the source beyond the user's text
- Refuse to handle credentials, tokens, API keys, or PII
- Refuse to bypass copyright or claim the source was fully read
Always review the suggestion before saving it to your LoveTree.
```

### Required safety note content (Korean canonical)

```
이 제안은 AI가 생성한 초안입니다. 다음 사항이 provider에 지시되었습니다:
- 사용자가 직접 입력한 발췌/메모 텍스트만 사용 (자동 fetch 금지)
- 원문 복제가 아닌 변형된(transformative) 요약만 생성
- 짧고 편집 가능한 제안을 반환하며 최종 저장 콘텐츠가 아님
- 사용자 입력 외의 사실/정보를 임의로 만들어내지 않음
- 자격증명, 토큰, API key, PII는 절대 처리하지 않음
- 저작권 우회 또는 원문을 모두 읽었다는 주장은 하지 않음
LoveTree에 저장하기 전 반드시 제안 내용을 직접 검토해 주세요.
```

### Safety note invariants

1. The safety note must be present in **every** provider response — not only on error.
2. The safety note must not be empty, and must not be replaced with marketing copy.
3. The safety note must contain at least one of: "review", "검토", or equivalent in the request language.
4. The safety note must not contain any credential, API key, or environment variable name.
5. The safety note language should match `requestedLanguage` when possible (`ko` → Korean, `en` → English).
6. If the provider returns a response without a safety note, the adapter must inject the canonical safety note from this contract (never silently drop it).
7. The safety note is the **only** part of the response that the user can rely on for transparency — it must accurately reflect what the provider was told.

---

## Prompt Template Sketch

> This is a **neutral contract sketch**, not a production prompt tuned for any specific provider.
> The actual prompt for each provider will be refined in the adapter implementation layer.

```text
You are helping draft a LoveBud Scout suggestion from user-provided text only.
Do not fetch or infer from the source URL.
Return JSON only with these fields:
  titleSuggestion (string, max 50 chars),
  summarySuggestion (string, max 200 chars),
  translationSuggestion (string, max 500 chars),
  emotionTags (array of strings, max 4, each max 20 chars),
  memoSuggestion (string, max 500 chars),
  safetyNote (string, always required).
Do not reproduce long copyrighted passages verbatim.
Keep output concise, editable, and review-required.
Language: {requestedLanguage}. Tone: {desiredTone}.
Max output length: {maxOutputLength} tokens.
```

**Key constraints embedded in the sketch:**
- No source URL fetching or inference
- JSON-only output
- Structured field constraints (max lengths, array bounds)
- Copyright caution (no verbatim reproduction)
- Language/tone/control parameters

---

## Failure Mapping

| Failure | Error Code | HTTP Status | Behavior |
|---|---|---|---|
| Missing live provider config | `CONFIG_MISSING` | 503 | Safe error, no config details leaked |
| Provider returns malformed JSON | `PROVIDER_ERROR` | 502 | Safe error, fallback to manual save |
| Provider timeout | `PROVIDER_ERROR` | 502 | Safe error, fallback to manual save |
| Provider returns unsafe content | `PROVIDER_ERROR` | 502 | Safe error, never partial save |
| Validation failure | `VALIDATION_ERROR` | 400 | Safe error, clear description |
| Rate limited | `RATE_LIMITED` | 429 | Safe error, retry-after info |
| Network error (endpoint → provider) | `PROVIDER_UNAVAILABLE` | 503 | Safe error, fallback to stub if available |

**All failure responses must:**
- Never expose API keys, provider URLs, or internal config in error messages
- Never trigger auto-save
- Never clear user input
- Keep the manual save path available

---

## UI Application Boundary

- Provider output may fill **editable fields only** after validation.
- User must still click **"저장" (Save)** to persist.
- **No auto-save** is triggered by suggestion response.
- Manual save (`handleSave()`) remains available even when suggestion fails.
- Fallback from provider error must **not clear user input**.
- Source selector default remains **`local_stub`**.
- If suggestion fails or is unavailable, the user can still write fields manually and save.

---

## Non-goals

- ❌ No live provider implementation
- ❌ No API keys or environment variables added
- ❌ No endpoint runtime behavior change
- ❌ No external URL fetch
- ❌ No crawler or metadata extraction
- ❌ No default endpoint client enablement
- ❌ No auto-save
- ❌ No DB/schema migration
- ❌ No Browse #1661 work

---

## Recommended Next Slice

**Primary recommendation:**

```text
[TECH] Add Scout live provider adapter skeleton
```

This slice would implement:
- Live provider adapter interface (implements `createScoutSuggestionProvider`)
- Prompt builder function (normalizes inputs, assembles prompt from allowed fields)
- Response validator function (validates provider output before UI delivery)
- Default stub path remains active — live adapter returns `CONFIG_MISSING` when config absent
- Contract tests for prompt builder and response validator

**Caution:** The skeleton must still **not** make any real provider call. It should return a safe `CONFIG_MISSING` or `PROVIDER_UNAVAILABLE` response when the live provider is not configured.

**Adopted as implemented:** Live provider adapter skeleton (`functions/api/scout/live-provider-adapter.js`) added. Includes prompt builder (`buildScoutLiveProviderPrompt`), response validator (`validateScoutLiveProviderResponse`), and adapter interface (`createScoutLiveProviderAdapter`) — no real provider call, no SDK, no fetch, no secrets. Default source remains `local_stub`.

**Endpoint wiring:** `functions/api/scout/suggest.js` now imports the adapter skeleton. Live mode calls `adapter.suggest()` but still safe-fails with `CONFIG_MISSING` — no real provider call. Default stub path is preserved unchanged.

**Mock execution contract:** `createScoutLiveProviderAdapter()` accepts an injected `executor` option (test-only). When an executor is provided, `adapter.suggest()` runs `prompt builder → executor → response validator`. When absent, returns `CONFIG_MISSING` safe-fail. No real provider call, no SDK, no fetch, no secrets. See `tests/contracts/scout-live-provider-mock-execution-contract.test.cjs`.

**Logging boundary:** Safe observability helpers `createScoutLiveProviderLogEvent` and `sanitizeScoutLiveProviderLogPayload` added. Allowed log fields: `requestId`, `providerMode`, `status`, `errorCode`, `latencyMs`, `inputLength`, `outputFieldCount`, `emotionTagCount`, `hasSourceUrl`, `language`, `tone`. Prohibited: `prompt`, `excerpt`, `summary`, `memo`, `sourceUrl` raw value, suggestion text fields, API keys, auth tokens, cookies, PII. Optional injected logger receives sanitized events only; logger throw is safely swallowed. No real provider call, no SDK, no fetch, no secrets. See `tests/contracts/scout-live-provider-logging-boundary-contract.test.cjs`.

**Timeout/retry boundary:** `SCOUT_LIVE_PROVIDER_TIMEOUT_RETRY_POLICY` constants added (default `timeoutMs: 8000`, `maxRetries: 0`, `maxAllowedRetries: 1`). `runScoutLiveProviderExecutorWithTimeout` helper wraps mock executor with timeout/retry. `createScoutLiveProviderAdapter()` accepts `timeoutMs`/`maxRetries` config — executor throw/timeout triggers retry; retry exhaustion maps to `PROVIDER_ERROR`. Malformed output does not retry (validation failure). Values are safe-clamped. Sanitized logging includes `retryCount`/`maxRetries` in event. No real provider call. See `tests/contracts/scout-live-provider-timeout-retry-boundary-contract.test.cjs`.

**Alternatives (independent order):**

- `[TECH] Add Scout prompt builder contract`
- `[TECH] Add Scout provider response validator contract`
- `[TECH] Add Scout Firebase auth verification boundary`
- `[TECH] Add Scout rate-limit persistence boundary`

---

## Final Decision

```
The prompt and response contract is ready to guide a future live-provider adapter skeleton,
but live provider calls remain out of scope.
```
