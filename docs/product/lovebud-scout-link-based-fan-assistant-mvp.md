# LoveBud Scout — 링크 기반 팬 어시스턴트 MVP 제품 정의

> **Issue**: [#1882 (PRODUCT: Explore LoveBud Scout link-based fan assistant MVP)](https://github.com/skerishKang/LoveBud/issues/1882)
> **상태 문서 기준**: 2026-07-02
> **최종 업데이트**: 본 문서 생성일
> **영역**: Scout · 링크 기반 팬 어시스턴트 MVP 전반

---

## 목차

1. [제품 개요 및 포지셔닝](#1-제품-개요-및-포지셔닝)
2. [MVP 스코프 정의](#2-mvp-스코프-정의)
3. [구현 현황 평가](#3-구현-현황-평가)
4. [Acceptance Criteria 완료 상태](#4-acceptance-criteria-완료-상태)
5. [미완료 Acceptance Criteria 상세](#5-미완료-acceptance-criteria-상세)
6. [확인된 갭 (Gap Analysis)](#6-확인된-갭-gap-analysis)
7. [의사결정 기록](#7-의사결정-기록)
8. [참조 문서](#8-참조-문서)

---

## 1. 제품 개요 및 포지셔닝

### 1.1 한 줄 정의

> **팬이 공개 링크를 붙여넣으면, AI가 요약·번역·감정 태그를 제안하고, 사용자가 검토 후 LoveTree 순간으로 저장할 수 있는 LoveBud 네이티브 팬 어시스턴트.**

### 1.2 포지셔닝

| 레이어 | 역할 |
|--------|------|
| **LoveBud** | 팬 감정·기억 아카이브 |
| **LoveBud Scout** | 새 공개 팬 콘텐츠를 LoveTree 순간으로 전환하는 어시스턴트 |
| **Namu Lookup Skill** | Scout가 wiki 정보를 조회·요약·제안하는 Hermes Agent 스킬 |
| **Namu Lookup Harness** | 스킬 출력을 Scout Draft 제안으로 변환하는 조정 레이어 |

**Scout은 기존 수동 저널링 플로우를 대체하지 않으며, 보완합니다.**

### 1.3 Why Scout fits LoveBud

- LoveBud는 이미 감정 태그, 제목, 자유 텍스트 메모를 가진 순간(moment)을 저장함
- 팬들은 컴백 발표, 투어 소식, 인터뷰 등 외부 콘텐츠에 대한 반응을 기록하고 싶어함
- Scout entrypoint는 수동 저널링 사이에 팬이 돌아올 실용적인 이유를 제공
- 출력은 **LoveTree moment draft**이며, 독립형 아티클이나 번역이 아님

### 1.4 MVP 사용자 플로우

```
1. 사용자가 공개 URL을 붙여넣음
        ↓
2. Scout가 링크의 fetch 가능 여부 확인
        ↓
3. 콘텐츠 fetch (메타데이터 + user-visible text)
        ↓
4. Scout가 생성:
   - 짧은 요약 (summary)
   - 번역 (사용자 언어와 다를 경우)
   - 팬 관련 컨텍스트/하이라이트
   - 추천 감정 태그
        ↓
5. 사용자가 초안 검토 및 편집
        ↓
6. 사용자가 LoveTree 순간으로 저장
        ↓
7. 원본 소스 링크 저장 및 표시
```

### 1.5 현재 Phase 상태

| Phase | 이름 | 상태 |
|-------|------|------|
| **Phase 0** | Boundary, policy, scope definition | ✅ **완료** — `lovebud-scout-mvp-boundary.md` |
| **Phase 1** | Manual Link + User-Entered Text MVP | 🟡 **부분 완료** — Draft UI/validation/save-flow는 구현됨, 단 persistence 미연결 |
| **Phase 2** | Metadata Extraction (Fetch Provider) | ❌ **미구현** — 외부 URL fetch provider 없음 |
| **Phase 3** | AI Summary / Tag Suggestion | 🟡 **부분 완료** — Provider adapter skeleton, prompt contract, stub provider 완료. 실제 live provider 없음 |
| **Phase 4** | Save-to-LoveTree Integration | 🟡 **부분 완료** — UI 및 payload 변환은 구현됨. `onDraftSave` 미연결으로 실제 저장 없음 |

---

## 2. MVP 스코프 정의

### 2.1 포함 (In-Scope)

| 항목 | 설명 | 상태 |
|------|------|------|
| **수동 URL 입력** | 사용자가 공개 URL을 Scout Draft에 직접 입력 | ✅ 구현됨 |
| **수동 excerpt 입력** | 사용자가 직접 발췌/요약 텍스트 입력 | ✅ 구현됨 |
| **AI 제안 (local_stub)** | Local stub provider가 제안 생성 (실제 AI 아님) | ✅ 구현됨 |
| **AI 제안 엔드포인트** | Serverless endpoint skeleton (`/api/scout/suggest.js`) | ✅ 구현됨 |
| **Draft UI (모달)** | Scout draft 모달: URL, excerpt, memo, emotion tags | ✅ 구현됨 |
| **Payload → Memory 변환** | Draft를 LoveTree memory payload로 변환 | ✅ 구현됨 |
| **감정 태그** | 최대 4개, 각 20자 이내 | ✅ 구현됨 |
| **소스 URL 저장** | 원본 URL을 moment에 저장 (`sourceUrl` 필드) | ✅ 구현됨 |
| **Feature flag** | Scout behind feature flag, off by default | ✅ 구현됨 |
| **Namu Lookup 연동** | Artist wiki 정보 조회 → Draft 제안 | ✅ 계약 완료 (lovebud-scout-namu-lookup-harness-contract.md) |

### 2.2 제외 (Out-of-Scope for MVP)

| 항목 | 사유 |
|------|------|
| 자동 크롤링/모니터링/알림 | Phase 1 범위 밖, 수동 URL 입력만 |
| 전문(full-text) 저장 | 저작권 정책 위반 |
| 팬클럽 전용/유료 콘텐츠 | 접근 권한 정책 위반 |
| Weverse/Instagram/X/TikTok scraping | 플랫폼 정책 준수, 허용된 접근 경로 외 금지 |
| 실시간 번역 앱 | Papago/DeepL/Google Translate 경쟁 아님 |
| K-pop 전반 모니터링 대시보드 | 범위 밖 |
| 공식 파트너십/보증 claims | 범위 밖 |
| 기존 "add memory" 플로우 대체 | Scout는 추가적(Additive) 기능 |

---

## 3. 구현 현황 평가

### 3.1 구현된 기능 (✅ Complete)

| # | Capability | 관련 PR | 상태 |
|---|-----------|---------|------|
| 1 | Scout Draft Manual MVP (Draft UI, validation, entrypoint) | #2203, #2205, #2209, #2211 | ✅ |
| 2 | Scout suggestion provider abstraction | #2213 | ✅ |
| 3 | Deterministic local stub suggestion provider | #2213, #2215 | ✅ |
| 4 | Scout Draft modal "AI 제안 받기" button → stub provider | #2215 | ✅ |
| 5 | Unavailable/pending configuration boundary | #2217 | ✅ |
| 6 | Serverless endpoint skeleton (`functions/api/scout/suggest.js`) | #2221 | ✅ |
| 7 | Endpoint auth/rate-limit contract (placeholder enforcement) | #2223 | ✅ |
| 8 | Endpoint live-provider configuration boundary (`CONFIG_MISSING` fallback) | #2225 | ✅ |
| 9 | Endpoint client wrapper (`js/scout/scout-suggestion-endpoint-client.js`, disabled by default) | #2227 | ✅ |
| 10 | Suggestion source selector boundary (`local_stub` default, `endpoint_client` requires feature flag) | #2229 | ✅ |
| 11 | Endpoint suggestion opt-in QA scenario (23 contract tests) | #2231 | ✅ |
| 12 | Live-provider prompt/response contract (with Product Prompt safety note) | #2235 | ✅ |
| 13 | Provider-specific adapter skeleton | #2238, #2272 | ✅ |
| 14 | Provider-specific adapter selection boundary | #2272 | ✅ |
| 15 | Mock executor integration for provider adapter | #2257 | ✅ |
| 16 | Logging boundary for provider adapter | #2243 | ✅ |
| 17 | Timeout/retry boundary for provider adapter | #2245 | ✅ |
| 18 | Output safety filter for provider adapter | #2247 | ✅ |
| 19 | Live provider readiness audit | #2249 | ✅ |
| 20 | Post-mock integration readiness audit | #2259 | ✅ |
| 21 | Staging rollout contract | #2261 | ✅ |
| 22 | Auth/rate-limit persistence boundary | #2263 | ✅ |
| 23 | Cost/quota abuse monitoring contract | #2265 | ✅ |
| 24 | Secret rotation and incident runbook contract | #2267 | ✅ |
| 25 | Production readiness gates audit | ✅ | ✅ |
| 26 | Endpoint error readiness audit + taxonomy contract | ✅ | ✅ |
| 27 | Endpoint live auth/rate-limit readiness audit | ✅ | ✅ |
| 28 | Auth/rate-limit runtime boundary skeleton | ✅ | ✅ |
| 29 | Endpoint live endpoint error readiness audit + taxonomy | ✅ | ✅ |
| 30 | Scout save flow boundary audit | #2205 | ✅ |
| 31 | Scout storage key hashing allowlist contract | ✅ | ✅ |
| 32 | Scout storage hash helper + namespace policy | ✅ | ✅ |
| 33 | Scout staging smoke tests + API key smoke runbook | ✅ | ✅ |
| 34 | Scout namu-lookup harness contract | #3155 | ✅ |
| 35 | Scout MVP boundary definition | #2200 | ✅ |

### 3.2 미구현/차단된 기능 (❌ Blocked / 🟡 Partial)

| # | Capability | 상태 | 차단 사유 |
|---|-----------|------|----------|
| 1 | **실제 persistence (onDraftSave wiring)** | ❌ 미연결 | Draft UI에서 저장 버튼 클릭 시 toast만 표시, 실제 API 호출 또는 tree 업데이트 없음 |
| 2 | **실제 Firebase Auth token verification** | ❌ Placeholder | `verifyScoutFirebaseToken()`은 TODO 주석 상태, 실제 Firebase Admin SDK 미연동 |
| 3 | **실제 rate-limit persistence** | ❌ Placeholder | `checkScoutRateLimit()`은 TODO 주석 상태, KV/Durable Objects/D1 미연동 |
| 4 | **Live AI provider 통합** | ❌ 미구현 | Adapter skeleton만 존재, 실제 provider API 호출 없음 |
| 5 | **외부 URL fetch provider** | ❌ 미구현 | Phase 2로 정의됨, Metadata extraction 미구현 |
| 6 | **Abuse handling / structured logging** | ❌ 미구현 | Observability 계획만 있음, 실제 metric/logging 미연동 |
| 7 | **Staging feature flag deployment pipeline** | ❌ 미정의 | `endpointClientEnabled`는 코드 레벨 flag, 배포 파이프라인 연동 없음 |
| 8 | **emotionTags API/model support** | 🟡 미확인 | Scout Draft는 emotion tags를 포함하지만, backend API가 이 필드를 수용하는지 미확인 |
| 9 | **sourceType 'scout' enum 지원** | 🟡 미확인 | API validation이 'scout' sourceType을 허용하는지 미확인 |
| 10 | **sourceUrl semantic alignment** | 🟡 불일치 | Scout는 원본 URL 저장, 기존은 YouTube embed URL 저장 — API가 원본 URL을 보존하는지 미확인 |
| 11 | **Read-only tree visibility guard** | ❌ 미구현 | Scout action이 읽기 전용 트리에서도 dropdown에 표시됨 |
| 12 | **심리스 저장 UX** | 🟡 부분 | Payload 빌드는 완료, `onDraftSave` 콜백만 연결 필요 |

---

## 4. Acceptance Criteria 완료 상태

### 4.1 MVP Boundary Acceptance Criteria (`lovebud-scout-mvp-boundary.md` Section 8)

Phase 0에서 정의된, Phase 1 구현 시작 전 확인되어야 할 Acceptance Criteria:

| # | Criteria | 상태 | 근거 |
|---|----------|------|------|
| AC-1 | **MVP scope confirmed** — Phase 1은 "manual paste, AI suggestion, edit, save". No fetch provider yet. | ✅ **완료** | `lovebud-scout-mvp-boundary.md` 및 `lovebud-scout-ai-suggestion-mvp-readiness.md`에서 명확히 정의됨 |
| AC-2 | **Prohibited sources confirmed** — Explicit list of domains/content types that Scout will never fetch. | 🟡 **부분 완료** | MVP boundary doc Section 4.1에 Allowed/Prohibited 표가 있음. 그러나 **금지 도메인의 기계 판독 가능 목록(machine-readable blocklist)은 정의되지 않음** — 코드 레벨 prohibit domain list가 없음 |
| AC-3 | **Storage policy confirmed** — What is stored, what is not stored, retention policy for drafts. | ✅ **완료** | MVP boundary doc Section 4.2에 상세 정의됨. Content storage policy table 명확함 |
| AC-4 | **UI entrypoint confirmed** — Where in the editor the Scout button/paste zone appears. | ✅ **완료** | Editor floating toolbar "..." → dropdown → "Scout로 순간 저장" (`scout-draft-ui.js`). 또한 Scout Draft modal UI 구현 완료 |
| AC-5 | **API boundary confirmed** — Use existing moment creation API, no new endpoints needed for Phase 1. | 🟡 **부분 완료** | 기존 `createMemory` API 사용 계획은 있으나, **실제 `onDraftSave`가 이 API를 호출하도록 wiring되지 않음**. 또한 `emotionTags`, `sourceType: 'scout'`, `sourceUrl` 호환성 미확인 |
| AC-6 | **Feature flag confirmed** — Scout is behind a feature flag, off by default for Phase 1 testing. | ✅ **완료** | `endpointClientEnabled` config flag, `local_stub` default, `resolveScoutSuggestionSource()` opt-in only |
| AC-7 | **Implementation sub-issues created** — One issue per Phase, each scoped to a single deployable PR. | 🟡 **부분 완료** | PR #2203–#2270에서 세분화된 slice 단위 구현 완료. 그러나 **Phase 2-4에 해당하는 sub-issues가 명시적으로 생성되지 않음** — implementation은 granular slice로 진행되었으나, Phase 단위 이슈 트래킹 부재 |

### 4.2 AI Suggestion MVP Readiness Acceptance Criteria (`lovebud-scout-ai-suggestion-mvp-readiness.md`)

| # | Criteria | 상태 | 근거 |
|---|----------|------|------|
| AC-8 | **No frontend API key** | ✅ **Pass** | `scout-suggestion-endpoint-client.js` no key injection; contract tests verify |
| AC-9 | **No default endpoint call** | ✅ **Pass** | `isScoutSuggestionEndpointClientEnabled()` defaults to `false` |
| AC-10 | **Default source is `local_stub`** | ✅ **Pass** | `resolveScoutSuggestionSource({})` returns `local_stub` |
| AC-11 | **Endpoint client opt-in only** | ✅ **Pass** | `endpoint_client` resolved only when explicit opt-in; 1/"1"/"yes" rejected |
| AC-12 | **No real provider call** | ✅ **Pass** | `suggest.js` returns deterministic stub; live provider has `TODO` |
| AC-13 | **No external source fetch** | ✅ **Pass** | `sourceUrl` is request body field only, never fetched |
| AC-14 | **No auto-save** | ✅ **Pass** | No `addMemoryFromForm()` or `.save()` in Scout suggestion modules |
| AC-15 | **Manual save preserved** | ✅ **Pass** | Draft save flow independent of suggestion flow |
| AC-16 | **CONFIG_MISSING safe fallback** | ✅ **Pass** | Returns safe `503` with no secret/env leakage |
| AC-17 | **No DB/schema migration** | ✅ **Pass** | No database, KV, Durable Object, or D1 schema changes |

### 4.3 Save Flow Acceptance Criteria (`lovebud-scout-save-flow-boundary.md`)

| # | Criteria | 상태 | 근거 |
|---|----------|------|------|
| AC-18 | **No AI provider integration** | ✅ **Pass** | No AI imports, no provider calls |
| AC-19 | **No external URL fetching** | ✅ **Pass** | Only URL validation via `new URL()` |
| AC-20 | **No metadata extraction** | ✅ **Pass** | No OpenGraph, no YouTube API |
| AC-21 | **No backend/schema migration** | ✅ **Pass** | No DB changes |
| AC-22 | **No copyrighted full-text automation** | ✅ **Pass** | User manually enters excerpt/memo |
| AC-23 | **No innerHTML XSS exception** | ✅ **Pass** | `scout-draft-ui.js` uses `createElement` + `textContent` |
| AC-24 | **URL protocol restricted to HTTP/HTTPS** | ✅ **Pass** | `validateSourceUrl` rejects others |
| AC-25 | **Target=_blank with rel=noopener** | ✅ **Pass** | Preview link uses `rel="noopener"` |
| AC-26 | **Actual persistence via `onDraftSave`** | ❌ **Fail** | `onDraftSave` callback is **not wired** — toast only, no actual save |

---

## 5. 미완료 Acceptance Criteria 상세

### AC-2: Prohibited Sources Machine-Readable Blocklist

**상태**: 🟡 부분 완료 (정의만 있음, 구현 없음)

**갭 설명**:
- `lovebud-scout-mvp-boundary.md` Section 4.1에 Allowed/Prohibited 표가 있음
- **그러나 코드 레벨의 기계 판독 가능한 금지 도메인 목록이 없음**
- `lovebud-scout-storage-key-hashing-allowlist-contract.md`와 같은 allowlist 계약은 존재하지만, Scout fetch source domain blocklist는 없음
- Phase 2 (Fetch Provider) 구현 전에 반드시 필요

**완료 조건**:
- [ ] Machine-readable prohibited domain list 정의 (JSON 또는 config 파일)
- [ ] Runtime fetch 전 해당 도메인 체크하는 guard 구현
- [ ] Contract test로 blocklist enforcement 검증
- [ ] MVP boundary doc의 prohibited sources 표와 코드 blocklist 간 alignment 확인

---

### AC-5: API Boundary — Actual Save Wiring

**상태**: 🟡 부분 완료 (계획만 있음, 실제 wiring 없음)

**갭 설명**:
- Scout Draft UI는 payload 생성까지 완료 (`convertDraftToMemoryPayload()`)
- **그러나 `onDraftSave` 콜백이 어디에도 연결되지 않음** (`scout-draft-ui.js:206-211`)
- "저장됨" toast만 표시되고 실제 API 호출 없음
- `emotionTags` API/model compatibility 미확인
- `sourceType: 'scout'` enum API validation 통과 여부 미확인
- `sourceUrl` 원본 URL 보존 여부 미확인 (현재 API는 YouTube embed URL 기준)

**완료 조건**:
- [ ] `onDraftSave`를 `addMemoryFromForm()` 또는 직접 `createMemory` API 호출에 wiring
- [ ] `emotionTags` 필드가 API `createMemory`에서 수용되는지 확인 (안 되면 schema migration 또는 fallback)
- [ ] `sourceType: 'scout'`이 API validation을 통과하는지 확인
- [ ] `sourceUrl` 원본 URL이 저장 후 moment detail에서 정확히 표시되는지 확인
- [ ] Contract test로 save flow end-to-end 검증

---

### AC-7: Implementation Sub-Issues per Phase

**상태**: 🟡 부분 완료 (granular slice는 있음, Phase 단위 이슈 부재)

**갭 설명**:
- PR #2203–#2270에서 30+ granular slice 구현 완료
- **그러나 Phase 2, 3, 4에 해당하는 명시적 GitHub Issues/sub-issues가 생성되지 않음**
- Phase 단위 이슈가 없으면 진행 상황 추적 및 의사결정이 어려움
- #1882 하나의 이슈에 모든 것이 집중되어 있어 세부 트래킹 부재

**완료 조건**:
- [ ] Phase 2 (Metadata Extraction) sub-issue 생성
- [ ] Phase 3 (AI Suggestion) sub-issue 생성 (기존 PR 참조)
- [ ] Phase 4 (Save-to-LoveTree Integration) sub-issue 생성
- [ ] 각 sub-issue에 명확한 Acceptance Criteria 정의
- [ ] #1882를 Epic으로 설정하고 sub-issues를 연결

---

### AC-26: Actual Persistence via `onDraftSave`

**상태**: ❌ 미완료 (가장 중요한 단일 갭)

**갭 설명**:
- Scout Draft UI는 `onDraftSave`를 injection 받지만, **현재 consumer에서 제공하지 않음**
- 저장 버튼 클릭 시 `showToast("저장됨")`만 실행
- 실제 `createMemory` API 호출 또는 tree 업데이트 발생하지 않음
- 사용자 입장에서 "저장됨" 메시지를 보았지만 실제로 저장되지 않는 UX 버그

**완료 조건**:
- [ ] `onDraftSave`를 `addMemoryFromForm()` (기존 메모리 저장 함수)에 wiring
- [ ] 또는 Scout 전용 save handler 구현 (기존 API 재사용)
- [ ] 저장 후 canvas/tree 새로고침
- [ ] 저장 실패 시 에러 처리 및 사용자 피드백
- [ ] Contract test로 end-to-end 저장 검증

---

### 미완료 기술 블로커 (Scout AI Suggestion Readiness 문서 기준)

| # | Blocker | 상태 | 설명 |
|---|---------|------|------|
| B-1 | **Firebase auth verification** | ❌ Placeholder | `verifyScoutFirebaseToken()`은 TODO, 실제 Firebase Admin SDK 없음 |
| B-2 | **Rate-limit persistence** | ❌ Placeholder | `checkScoutRateLimit()`은 TODO, KV/DO/D1 없음 |
| B-3 | **Abuse handling / structured logging** | ❌ 미구현 | Observability 계획만 있고 metric/logging 미연동 |
| B-4 | **Staging feature flag deployment pipeline** | ❌ 미정의 | `endpointClientEnabled`는 코드 레벨 flag, 배포 파이프라인 연동 없음 |
| B-5 | **Live provider network-free test policy** | 🟡 미정의 | CI 테스트가 network-free여야 한다는 원칙은 있으나 enforcement 정책 미문서화 |

---

## 6. 확인된 갭 (Gap Analysis)

### 6.1 제품 갭

| 갭 | 심각도 | 설명 |
|----|--------|------|
| **실제 저장 미연결** | 🔴 Critical | Scout Draft → LoveTree moment 저장이 작동하지 않음 |
| **emotionTags API 호환성** | 🟡 High | Backend API가 Scout의 `emotionTags` 필드를 수용하는지 미확인 |
| **sourceType enum mismatch** | 🟡 High | `'scout'` sourceType이 API validation에서 거부될 가능성 |
| **sourceUrl semantic mismatch** | 🟡 High | 원본 URL이 embed URL로 대체될 가능성 (payload 변환 시) |
| **Read-only tree guard** | 🟡 Medium | 읽기 전용 트리에서 Scout action이 보여서는 안 됨 (현재 표시됨) |
| **Phase 단위 이슈 부재** | 🟡 Medium | 진행 상황 추적 및 의사결정을 위한 sub-issues 없음 |
| **fetch provider 부재** | 🟡 Medium | Phase 2 (Metadata extraction) 지연 — 사용자가 수동으로 excerpt 입력 필요 |
| **실제 AI provider 부재** | 🟡 Low | Phase 3 (AI suggestion)는 stub만 있음 — live AI 제안 없음 |
| **기계 판독 가능 blocklist 부재** | 🟡 Low | Fetch provider 구현 전 필요하나 당장 blocker는 아님 |

### 6.2 계약/문서 갭

| 갭 | 설명 |
|----|------|
| **Scout → 기존 Memory Save flow 통합 계약 부재** | `onDraftSave`가 기존 `addMemoryFromForm()`을 재사용할지, Scout 전용 save handler를 만들지 결정되지 않음 |
| **emotionTags backend schema 문서 부재** | API가 이 필드를 수용하는지 확인하는 공식 계약/테스트 없음 |
| **Scout-specific feature flag 배포 정책 문서 부재** | Staging vs production flag 활성화 정책 없음 |
| **Scout rollback/kill-switch runbook 부재** | Scout 기능 장애 시 복구 계획 없음 (다른 runbook 문서는 존재) |
| **Cross-browser/device UX 검증 계획 부재** | Scout Draft modal이 mobile/desktop에서 일관된 경험을 제공하는지 미확인 |

### 6.3 기술 부채 (Deferred Work)

| 항목 | 우선순위 | 상태 |
|------|---------|------|
| Firebase auth verification (real Admin SDK) | 🔴 High | 차단됨 |
| Rate-limit persistence (KV/D1/DO) | 🔴 High | 차단됨 |
| `onDraftSave` wiring (actual persistence) | 🔴 High | 미연결 |
| emotionTags schema compatibility | 🟡 Medium | 미확인 |
| sourceType 'scout' enum compat | 🟡 Medium | 미확인 |
| Read-only tree visibility guard | 🟡 Medium | 미구현 |
| Staging flag deployment pipeline | 🟡 Medium | 미정의 |
| Abuse/logging/metrics | 🟡 Medium | 미구현 |
| Fetch provider (Phase 2) | 🟢 Low | Phase 2 |
| Live AI provider (Phase 3) | 🟢 Low | Phase 3 |
| Machine-readable blocklist | 🟢 Low | Phase 2 전 |

---

## 7. 의사결정 기록

### D-1: Phase 진행 방식

**결정**: Phase 0 완료 후, Phase 1-4를 순차적이 아닌 **granular slice 단위**로 진행.
**근거**: PR #2203–#2270에서 30+ slice로 세분화하여 점진적 구현 완료.
**날짜**: 2026-06-07 ~ 2026-06-18
**참조**: `lovebud-scout-ai-suggestion-mvp-readiness.md`

### D-2: Scout 저장 방식

**결정**: Scout Draft를 기존 `createMemory` API를 통해 LoveTree moment로 저장. 별도 Scout 전용 테이블 없음.
**근거**: 기존 schema와의 정합성, 최소 migration.
**날짜**: MVP Boundary 문서
**참조**: `lovebud-scout-mvp-boundary.md` Section 5.5, 6

### D-3: AI Provider 접근 방식

**결정**: 실제 AI provider 통합 전에 adapter skeleton + prompt contract + stub provider로 guardrail 확보.
**근거**: 보안/저작권/비용 위험 최소화, opt-in only.
**날짜**: #2213–#2270
**참조**: `lovebud-scout-live-provider-prompt-response-contract.md`

### D-4: 금지 영역 해제

**결정**: 박사님(Chulwon Kang)이 Scout/Neon/API/DB/Cloudflare/env 전면 해제. 모든 영역 자유 구현 가능.
**날짜**: 2026-07-02
**참조**: `lovebud-scout-namu-lookup-harness-contract.md`, Hermes Memory

---

## 8. 참조 문서

### 제품 정의

| 문서 | 설명 |
|------|------|
| [lovebud-scout-mvp-boundary.md](lovebud-scout-mvp-boundary.md) | Scout MVP 범위, 정책, 기술 경계 정의 |
| [lovebud-scout-ai-suggestion-mvp-readiness.md](lovebud-scout-ai-suggestion-mvp-readiness.md) | AI Suggestion MVP Readiness Audit |
| [lovebud-scout-save-flow-boundary.md](lovebud-scout-save-flow-boundary.md) | Save flow boundary audit & gap analysis |
| [lovebud-scout-live-provider-prompt-response-contract.md](lovebud-scout-live-provider-prompt-response-contract.md) | Live provider prompt/response product contract |
| [lovebud-scout-namu-lookup-harness-contract.md](lovebud-scout-namu-lookup-harness-contract.md) | Scout Namu Lookup skill harness product contract |
| [lovebud-scout-production-activation-checklist.md](lovebud-scout-production-activation-checklist.md) | Production activation checklist |
| [lovebud-scout-staging-soak-readiness-audit.md](lovebud-scout-staging-soak-readiness-audit.md) | Staging soak readiness audit |
| [lovebud-scout-live-provider-readiness-audit.md](lovebud-scout-live-provider-readiness-audit.md) | Live provider readiness audit |
| [lovebud-scout-post-readiness-implementation-sequence.md](lovebud-scout-post-readiness-implementation-sequence.md) | Post-readiness implementation sequence |
| [lovebud-scout-serverless-endpoint-boundary.md](lovebud-scout-serverless-endpoint-boundary.md) | Serverless endpoint boundary |
| [lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md](lovebud-scout-runtime-firebase-auth-verifier-implementation-plan.md) | Firebase auth verifier implementation plan |
| [lovebud-scout-llm-provider-boundary.md](lovebud-scout-llm-provider-boundary.md) | LLM provider boundary |

### LoveBud 전체

| 문서 | 설명 |
|------|------|
| [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md) | 제품 철학과 핵심 가치 |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | 현재 실행 기준 제품 개요 |
| [MVP_SCOPE.md](MVP_SCOPE.md) | LoveBud 전체 MVP 범위 |
| [product_index.md](product_index.md) | 제품 문서 인덱스 |

### 구현 참조

| 항목 | 설명 |
|------|------|
| [#1882](https://github.com/skerishKang/LoveBud/issues/1882) | 원본 제품 이슈 (Scout MVP) |
| [#2200](https://github.com/skerishKang/LoveBud/issues/2200) | MVP boundary audit sub-issue |
| PR #2203–#2270 | Scout Draft MVP implementation PRs |
| PR #3155 | Namu Lookup harness contract |

---

## 부록 A: Acceptance Criteria 완료 요약

| AC ID | 기준 | 상태 |
|-------|------|------|
| AC-1 | MVP scope confirmed | ✅ |
| AC-2 | Prohibited sources confirmed (machine-readable list) | 🟡 |
| AC-3 | Storage policy confirmed | ✅ |
| AC-4 | UI entrypoint confirmed | ✅ |
| AC-5 | API boundary + actual save wiring | 🟡 |
| AC-6 | Feature flag confirmed | ✅ |
| AC-7 | Implementation sub-issues created per Phase | 🟡 |
| AC-8 | No frontend API key | ✅ |
| AC-9 | No default endpoint call | ✅ |
| AC-10 | Default source is local_stub | ✅ |
| AC-11 | Endpoint client opt-in only | ✅ |
| AC-12 | No real provider call | ✅ |
| AC-13 | No external source fetch | ✅ |
| AC-14 | No auto-save | ✅ |
| AC-15 | Manual save preserved | ✅ |
| AC-16 | CONFIG_MISSING safe fallback | ✅ |
| AC-17 | No DB/schema migration | ✅ |
| AC-18 | No AI provider integration (save flow) | ✅ |
| AC-19 | No external URL fetching (save flow) | ✅ |
| AC-20 | No metadata extraction (save flow) | ✅ |
| AC-21 | No backend/schema migration (save flow) | ✅ |
| AC-22 | No copyrighted full-text automation | ✅ |
| AC-23 | No innerHTML XSS exception | ✅ |
| AC-24 | URL protocol restricted to HTTP/HTTPS | ✅ |
| AC-25 | Target=_blank with rel=noopener | ✅ |
| AC-26 | Actual persistence via onDraftSave | ❌ |

**요약**: 26개 AC 중 **22개 ✅ 완료**, **3개 🟡 부분 완료**, **1개 ❌ 미완료**

---

## 부록 B: 다음 실행 권장 사항 (Recommended Next Steps)

### 우선순위 1 — 🔴 Critical (MVP 동작을 위해 필수)

1. **`onDraftSave` wiring** — Scout Draft → 실제 LoveTree moment 저장 연결
   - 기존 `addMemoryFromForm()` 재사용 또는 Scout 전용 save handler 구현
   - 저장 후 canvas/tree refresh

2. **`emotionTags` API compatibility 확인 및 필요시 schema 조정**
   - Backend API `createMemory`가 `emotionTags` 필드를 수용하는지 확인
   - 실패 시 fallback 또는 schema migration 계획 수립

3. **`sourceType: 'scout'` API validation 확인**
   - API가 `'scout'` sourceType을 수용하는지 확인
   - 거부될 경우 API validation 업데이트 또는 payload 변환 로직 조정

4. **`sourceUrl` 원본 URL 보존 확인**
   - Scout에서 전달한 원본 URL이 저장 후에도 유지되는지 end-to-end 테스트

### 우선순위 2 — 🟡 High (프로덕션 품질을 위해 필요)

5. **Read-only tree visibility guard** — 읽기 전용 트리에서 Scout action 숨김
6. **Phase 2/3/4 sub-issues 생성** — #1882를 Epic으로 설정하고 세부 이슈 연결
7. **Machine-readable prohibited domain blocklist 정의** — Fetch provider 전 준비

### 우선순위 3 — 🟢 Low (후순위)

8. **Feature flag deployment pipeline 정의** — Staging vs production flag 정책 문서화
9. **Abuse handling / structured logging 구현**
10. **Scout rollback/kill-switch runbook 작성**

---

*이 문서는 #1882 Scout 팬 어시스턴트 MVP의 현재 상태를 종합 평가하고, Acceptance Criteria 완료 현황을 식별합니다. 실제 코드를 변경하지 않고 제품 정의 문서 수준에서 완료되었습니다.*
