# Contract: Scout Namuwiki-Style Lookup Skill/Harness (#3155)
v20260702-namu-lookup-contract-1

> **영역 해제 완료**: 박사님(Chulwon Kang)이 Scout/Neon/API/DB/Cloudflare/env 전면 해제. 모든 영역 자유 구현 가능.
> **관련 이슈**: #1882 (Scout fan assistant MVP), #3155 (본 계약)
> **기준**: 컴2 (lovebud-repo 작업 사본)

---

## 1. 목적 및 배경

### 1.1 문제 정의

팬덤 활동의 초기 단계에서 사용자는 다음과 같은 행동 패턴을 보인다:

> "이름도 모르고 아무것도 모르는 경우에 먼저 영상부터 찾아보고 그 다음 나무위키나 기획사 사이트 등을 보면서 이름과 나이를 외우게 됨."

즉, 팬이 새로운 아티스트/아이돌을 발견했을 때:
1. 영상/사진에서 첫인상을 얻고
2. **나무위키/기획사 사이트에서 기본 정보를 조회**하며
3. 다시 영상/사진으로 돌아와 경험을 확인/기록함

현재 LoveBud Scout Draft는 **URL + 수동 excerpt 입력**만 지원한다. 사용자가 아티스트의 기본 정보(프로필, 데뷔일, 그룹 구성원, 디스코그래피 등)를 확인하려면 별도 브라우저 탭에서 나무위키를 직접 방문해야 한다.

### 1.2 목표

Scout이 Hermes Agent의 **namuwiki-style lookup skill**을 harness하여, 사용자가 Scout Draft를 작성할 때 아티스트/아이돌에 대한 wiki 정보를 **자동 조회·요약·제안**할 수 있게 한다. 이는:

- **사용자 경험**: 별도 탭 전환 없이 Scout Draft 내에서 wiki 정보를 즉시 확인
- **Hermes Agent Skill**: Agent가 namuwiki-style 조회를 수행할 수 있는 재사용 가능한 스킬
- **Harness**: 스킬과 LoveBud Scout Draft UI/API를 연결하는 조정 레이어

### 1.3 포지셔닝

```
LoveBud Scout = 팬의 감정·기억 아카이브 어시스턴트
Namu Lookup Skill = Scout가 wiki 정보를 조회·요약·제안하는 Hermes Agent 스킬
Namu Lookup Harness = 스킬 출력을 Scout Draft 제안으로 변환하는 조정 레이어
```

| 레이어 | 역할 | 위치 |
|--------|------|------|
| **Namu Skill** | wiki 소스에서 아티스트 정보 조회/요약 | Hermes Agent skill (`.hermes/skills/`) |
| **Namu Harness** | Skill + Scout Draft 연결, 추천 로직, 캐싱 | `functions/api/scout/` |
| **Scout Draft UI** | 사용자에게 wiki 정보 표시/적용 | `js/scout/` (기존) |
| **등록소 (Registry)** | 아티스트-식별자 매핑 DB | Neon DB (신규) |

---

## 2. 범위 (Scope)

### 2.1 포함 (In-Scope)

| 항목 | 설명 |
|------|------|
| **아티스트 기본 정보 조회** | 이름, 그룹, 데뷔일, 소속사, 멤버 구성, 팬클럽명 등 |
| **디스코그래피 요약** | 앨범명, 발매일, 타이틀곡, 수록곡 수 등 |
| **프로필 이미지/로고 URL** | 위키 소스에서 추출 가능한 공개 이미지 URL |
| **Hermes Agent Namu Skill** | Agent가 직접 namuwiki/wiki 조회를 수행하는 SKILL.md 정의 |
| **Harness API** | Scout Draft에서 호출할 수 있는 조회/제안 엔드포인트 |
| **조회 결과 → Draft 제안 변환** | wiki 정보를 Scout suggestion 형식으로 매핑 |
| **아티스트 식별자 매핑 (Registry)** | 이름/별칭 → 정규화된 아티스트 ID 매핑 |
| **결과 캐싱 (TTL 기반)** | 동일 아티스트 반복 조회 시 캐시 히트 |
| **에러 처리 / fallback** | 소스 불가, 미발견, 타임아웃 시 안전한 기본값 반환 |

### 2.2 제외 (Out-of-Scope)

| 항목 | 사유 |
|------|------|
| **나무위키 크롤링 자동화** | 로봇 배제 정책 위험. 대신 공개 API / 허용된 소스만 사용 |
| **전문(full-text) 저장** | 계약 정책: metadata + 요약만 저장, 원문 미저장 |
| **팬클럽 전용/유료 콘텐츠** | 접근 권한 정책 위반 |
| **실시간 알림/모니터링** | #3155 범위 외, 추후 고려 |
| **여러 나무위키 언어 버전 동시 지원** | 초기: 한국어 나무위키 + 영어 Wikipedia 병행 |
| **AI가 생성한 wiki 콘텐츠** | 기존 wiki 콘텐츠 요약만 수행, 생성은 하지 않음 |
| **Scout Draft 외부에서의 독립 실행** | 초기에는 Scout Draft 컨텍스트 내에서만 동작 |
| **기획사 공식 API 직접 연동** | 별도 계약/인증 필요 시 추후 단계로 |

### 2.3 데이터 소스 후보 (Source Candidates)

| 소스 | 타입 | 접근 방식 | 우선순위 | 비고 |
|------|------|-----------|----------|------|
| **나무위키 (namu.wiki)** | 한국어 wiki | 공식 API / parse | P0 | 핵심 소스 |
| **Wikipedia (EN/KO)** | 다국어 wiki | Wikimedia API | P1 | 영문 정보 보조 |
| **Kpop Wiki (kpop.fandom.com)** | K-pop 전용 wiki | Fandom API | P2 | K-pop 특화 정보 |
| **멜론 (Melon) API** | 음원 차트/정보 | 공식 API (인증 필요) | P3 | 디스코그래피 정합성 |
| **기획사 공식 사이트** | 공식 프로필 | 구조화 데이터 추출 | P4 | 사이트별 개별 작업 필요 |

**P0-P1 우선 구현, P2-P4는 추후 확장.**

---

## 3. 데이터 모델 (Data Model)

### 3.1 Hermes Namu Skill 출력 스키마

```
Skill Input:
{
  "artistName": string,        // 검색할 아티스트 이름 (필수)
  "sources": string[],         // 우선 조회 소스 목록 (선택, 기본: ["namu", "wikipedia"])
  "lang": string,              // 선호 언어 (선택, 기본: "ko")
  "maxSummaryLength": number,  // 요약 최대 길이 (선택, 기본: 500)
  "includeDetails": string[]   // 포함할 세부 정보 카테고리 (선택)
}

Skill Output:
{
  "artist": {
    "name": string,            // 정규화된 아티스트 이름
    "groupName": string|null,  // 그룹명 (솔로면 null)
    "label": string|null,      // 소속사
    "debutDate": string|null,  // 데뷔일 (ISO 8601)
    "fandomName": string|null, // 팬클럽명
    "members": string[],       // 그룹 멤버 목록
    "birthDate": string|null,  // 생년월일
    "nationality": string|null // 국적
  },
  "discography": [
    {
      "title": string,         // 앨범/싱글명
      "releaseDate": string,   // 발매일
      "type": string,          // 앨범/싱글/미니
      "titleTrack": string|null, // 타이틀곡
      "trackCount": number     // 수록곡 수
    }
  ],
  "summary": string,           // 소스 기반 요약 텍스트
  "sources": [
    {
      "name": string,          // 소스명 (예: "나무위키")
      "url": string,           // 소스 URL
      "fetchedAt": string      // 조회 일시 (ISO 8601)
    }
  ],
  "meta": {
    "lookupDurationMs": number,
    "sourcesQueried": number,
    "sourcesSucceeded": number,
    "cacheHit": boolean,
    "errors": string[]         // 소스별 오류 메시지
  }
}
```

### 3.2 Harness → Scout 변환 스키마

Harness는 Skill 출력을 받아 Scout Suggestion 형식으로 변환한다:

```
Harness Input:
{
  "artistName": string,           // 사용자가 Scout Draft에서 입력/선택한 아티스트명
  "contextExcerpt": string|null,  // 현재 Draft의 excerpt (선택, 컨텍스트 보강용)
  "lang": string                  // 언어 설정 (기본: "ko")
}

Harness Output (Scout Suggestion compatible):
{
  "titleSuggestion": string,      // 예: "아이브(IVE) - 프로필 및 디스코그래피"
  "summarySuggestion": string,    // wiki 요약문 (max 200자)
  "translationSuggestion": string,// 번역문 (lang=en인 경우)
  "emotionTags": string[],        // 아티스트 관련 추천 태그
  "memoSuggestion": string,       // wiki 정보 + Scout 컨텍스트 결합 제안문
  "sourceInfo": {
    "artistName": string,         // 정규화된 아티스트명
    "artistUrl": string,          // 위키 URL
    "sources": [ ... ]            // 조회된 소스 목록
  },
  "safetyNote": string,           // 안전 주의문
  "meta": {
    "provider": "namu-lookup-harness-v1",
    "lookupDurationMs": number,
    "cacheHit": boolean
  }
}
```

### 3.3 아티스트 등록소 (Artist Registry)

Neon DB에 아티스트 식별자 매핑 테이블을 신규 생성한다.

**Table: `artist_registry`**

| 필드명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| `artist_id` | UUID (PK) | 아티스트 고유 식별자 | 자동 생성 |
| `canonical_name` | VARCHAR(200) | 정규화된 아티스트명 | 인덱스 |
| `aliases` | JSONB | `["별칭1", "별명2", ...]` | 검색 지원 |
| `group_id` | UUID (FK → self) | 그룹 아티스트의 경우 부모 그룹 ID | NULL 허용 |
| `group_role` | VARCHAR(50) | `'leader'`, `'member'`, `'solo'`, `'group'` | |
| `source_links` | JSONB | `{ "namu": "url", "wikipedia": "url" }` | 소스별 URL |
| `thumbnail_url` | TEXT | 대표 이미지 URL | |
| `is_active` | BOOLEAN | 활동 여부 | 기본: true |
| `created_at` | TIMESTAMPTZ | 등록 일시 | |
| `updated_at` | TIMESTAMPTZ | 마지막 갱신 일시 | |

**인덱스:**
- `canonical_name` unique index
- GIN index on `aliases` (JSONB array contains)
- GIN index on `source_links` (JSONB path exists)

### 3.4 Lookup 캐시 (Cache)

**Table: `namu_lookup_cache`** (또는 KV 스토리지)

| 필드명 | 타입 | 설명 | 비고 |
|:---|:---|:---|:---|
| `cache_key` | VARCHAR(500) (PK) | `namu:lookup:{artistId}:{lang}` | |
| `response_json` | JSONB | Skill 출력 전체 | |
| `ttl_seconds` | INTEGER | TTL (초) | 기본: 86400 (24h) |
| `created_at` | TIMESTAMPTZ | | |
| `expires_at` | TIMESTAMPTZ | 만료 시점 | 인덱스, 자동 삭제 대상 |

**TTL 정책:**
- 일반 조회: 24시간
- 오류 응답: 300초 (5분, 빠른 재시도 허용)
- 수동 갱신: TTL 리셋
- 캐시 미스 시에만 새 조회 수행

---

## 4. 아키텍처 / 조정 흐름 (Harness Architecture)

### 4.1 전체 흐름

```
사용자 Scout Draft
    │ "아이브" 입력 → "wiki 정보 조회" 버튼 클릭
    ▼
Scout Draft UI (js/scout/)
    │ POST /api/scout/namu-lookup { artistName, contextExcerpt, lang }
    ▼
Namu Lookup Harness (functions/api/scout/namu-lookup/)
    │ 1. Artist Registry 조회 → 정규화된 artistId 획득
    │ 2. Cache 확인 → hit 시 즉시 반환
    │ 3. Hermes Namu Skill 호출 (내부 실행)
    │    ├─ namu.wiki API 질의
    │    ├─ Wikipedia API 질의 (fallback/보강)
    │    └─ 결과 병합 + 요약 생성
    │ 4. 결과 → Scout Suggestion 형식 변환
    │ 5. Cache 저장
    │ 6. Scout Draft UI로 응답
    ▼
Scout Draft UI
    │ wiki 정보 표시 → 사용자 검토
    │ → "Draft에 적용" → excerpt/tags/memo 자동 채움
    ▼
사용자 검토 후 저장 → LoveTree Moment
```

### 4.2 Hermes Agent Namu Skill 정의

**스킬명**: `namu-lookup`
**위치**: `.hermes/skills/namu-lookup/SKILL.md`
**카테고리**: `productivity` / `research`

#### SKILL.md 핵심 구조 (설계안)

```markdown
# Namu Wiki Lookup

## 언제 사용하나?

- Scout Draft에서 아티스트/그룹의 기본 정보가 필요할 때
- 사용자가 특정 아티스트에 대한 wiki 정보를 요청할 때
- Draft 작성 중 디스코그래피/프로필 정보를 자동 채우고 싶을 때

## 입력

| 항목 | 필수 | 설명 |
|------|------|------|
| artistName | 필수 | 조회할 아티스트명 (원문, 별칭 가능) |
| sources | 선택 | 조회 소스 우선순위 (기본: namu, wikipedia) |
| lang | 선택 | 응답 언어 (기본: ko) |

## 출력

정규화된 아티스트 프로필 + 디스코그래피 요약 + 소스 URL 목록.

## 동작 방식

1. 입력된 아티스트명으로 artist_registry에서 정규화
2. namu.wiki + Wikipedia API 순차 질의
3. 결과 병합, 중복 제거, 요약 생성
4. 캐시 저장 후 반환

## 소스별 접근 방식

| 소스 | 방식 | API 키 필요 | 비고 |
|------|------|-----------|------|
| namu.wiki | 공개 HTML parse (허용 경로) | 없음 | robots.txt 준수 |
| Wikipedia | REST API `action=query` | 없음 | 공개 API |

## 제약

- 소스별 rate-limit 준수
- 원문 전문 저장 금지
- 저작권 있는 콘텐츠 재생산 금지
- 조회 실패 시 graceful degradation
```

### 4.3 Harness API 엔드포인트

**HTTP 인터페이스**

| 속성 | 값 |
|------|-----|
| **Method** | `POST` |
| **Path** | `/api/scout/namu-lookup` |
| **Content-Type** | `application/json` |
| **Auth** | Firebase ID token (기존 Scout auth 재사용) |
| **Rate Limit** | 20 req/min per user |
| **Timeout** | 15s (client), 12s (server) |

**Request Schema**

```json
{
  "artistName": "아이브",
  "contextExcerpt": "IVE - HEYA 뮤비 반응...",
  "lang": "ko",
  "includeDetails": ["profile", "discography"]
}
```

**Response Schema (Success: 200)**

```json
{
  "titleSuggestion": "IVE (아이브) — 프로필 및 디스코그래피",
  "summarySuggestion": "아이브(IVE)는 스타쉽엔터테인먼트 소속 6인조 걸그룹으로, 2021년 12월 1일 싱글 'ELEVEN'으로 데뷔했다.",
  "emotionTags": ["궁금해요", "알아가요"],
  "memoSuggestion": "[아이브 wiki 정보]\n- 데뷔: 2021.12.01\n- 소속: 스타쉽엔터테인먼트\n- 멤버: 안유진, 가을, 레이, 장원영, 리즈, 이서\n- 팬클럽명: DIVE\n\n[최근 앨범]\n- IVE SWITCH (2024.04.29) - 타이틀: HEYA\n- I'VE MINE (2023.10.13)",
  "sourceInfo": {
    "artistName": "IVE",
    "artistUrl": "https://namu.wiki/w/IVE",
    "sources": [
      { "name": "나무위키", "url": "https://namu.wiki/w/IVE", "fetchedAt": "2026-07-02T20:00:00Z" }
    ]
  },
  "safetyNote": "위키 정보는 참고용입니다. 데뷔일/멤버 정보는 공식 프로필과 다를 수 있습니다.",
  "meta": {
    "provider": "namu-lookup-harness-v1",
    "lookupDurationMs": 1234,
    "cacheHit": false
  }
}
```

**Error Codes** (기존 Scout error taxonomy 확장)

| Code | HTTP | 의미 |
|------|------|------|
| `ARTIST_NOT_FOUND` | 404 | 등록소에 없는 아티스트명 |
| `LOOKUP_SOURCE_UNAVAILABLE` | 503 | 모든 wiki 소스 조회 실패 |
| `LOOKUP_TIMEOUT` | 504 | 소스 응답 시간 초과 |
| `LOOKUP_CONFIG_MISSING` | 503 | Harness 설정 누락 |

---

## 5. 핵심 동작 규칙 (Core Rules)

### 5.1 소스 질의 순서 및 폴백

1. **등록소(Registry) 우선**: `artist_registry`에서 canonical_name 또는 alias로 매칭
2. **등록소 히트 → 캐시 확인**: 24h TTL 내 캐시 데이터 반환
3. **캐시 미스 → 소스 질의**:
   - 1순위: namu.wiki (공개 페이지 fetch/parse)
   - 2순위: Wikipedia (REST API)
   - 3순위: Kpop Wiki (Fandom API) — 추후
4. **모든 소스 실패**: `LOOKUP_SOURCE_UNAVAILABLE` 에러 + 부분 정보라도 있으면 반환
5. **부분 성공**: 일부 소스만 성공해도 결과 반환, `meta.errors`에 실패 소스 기록

### 5.2 아티스트 식별 추론

입력된 `artistName`이 등록소에 없는 경우:
1. **철자 변형 처리**: 대소문자 무시, 공백 정규화
2. **별칭 추론**: "아이브" ↔ "IVE" ↔ "ive" 자동 매핑 (Levenshtein distance 기반 fuzzy matching)
3. **미매칭 시**: 등록소에 제안 등록 요청 기록 → 관리자(또는 자동) 승인 후 등록
4. **Fallback**: 등록소 없이 직접 wiki 검색 (정확도 저하 감수)

### 5.3 내용 정제 규칙

| 규칙 | 설명 |
|------|------|
| **최대 길이 제한** | summary 500자, discography 최근 5개 |
| **날짜 정규화** | 모든 날짜 ISO 8601로 통일 |
| **URL 정규화** | 상대 경로 → 절대 경로, 불필요한 쿼리 파라미터 제거 |
| **중복 제거** | 여러 소스에서 동일 정보 병합 |
| **민감 정보 필터** | 생년월일은 연도+월까지만, 구체적 주소/연락처 제거 |
| **저작권 경계** | 원문 문장 그대로 복사 금지, 요약/재구성만 저장 |
| **투명성** | 모든 정보의 출처 URL 표시 |

### 5.4 Draft 적용 규칙

사용자가 "Draft에 적용" 버튼을 클릭했을 때:

1. **Title**: `"{artistName} — wiki 프로필"` 형식 자동 생성
2. **Excerpt**: summarySuggestion 내용으로 채움 (사용자 편집 가능)
3. **Emotion Tags**: 기본 태그 `["궁금해요", "알아가요"]` 제안 (사용자 수정 가능)
4. **Memo**: 프로필 정보 + 디스코그래피 포맷팅하여 채움
5. **Source URL**: `sourceInfo.artistUrl`을 자동 저장 (원본 출처)

사용자는 모든 필드를 자유롭게 수정 가능하며, 적용 전 반드시 검토 화면을 거친다.

### 5.5 Rate Limit 정책

| 티어 | 요청/윈도우 | 윈도우 | Burst |
|------|-----------|--------|-------|
| 인증 사용자 | 20 | 1분 | 5 |
| 신규 사용자 (첫 24h) | 5 | 1분 | 2 |
| 프리미엄 (추후) | 50 | 1분 | 10 |

Rate-limit 초과 시 `429 LOOKUP_RATE_LIMITED` + `Retry-After` 헤더.

---

## 6. Hermes Agent Skill 상세 정의

### 6.1 Skill 파일 구조

```
.hermes/skills/namu-lookup/
├── SKILL.md              # 스킬 정의서
├── harness/
│   ├── registry.js       # Artist Registry 조회/매핑
│   ├── fetcher-namu.js   # namu.wiki fetcher
│   ├── fetcher-wikipedia.js  # Wikipedia fetcher
│   ├── merger.js         # 소스 결과 병합
│   ├── summarizer.js     # 요약 생성
│   ├── cache.js          # 캐시 계층
│   └── index.js          # Harness 진입점 (unified orchestrator)
└── tests/
    ├── registry.test.js
    ├── fetcher-namu.test.js
    ├── merger.test.js
    └── harness.test.js
```

### 6.2 Skill 사용 예시 (Hermes Agent Context)

```
User: "아이브 프로필 좀 찾아줘"

Agent (Hermes, with namu-lookup skill):
→ invoke namu-lookup skill with { artistName: "아이브" }
→ skill returns:
  {
    artist: { name: "IVE", groupName: null, members: ["안유진", ...], ... },
    discography: [...],
    summary: "...",
    sources: [{ name: "나무위키", url: "..." }]
  }
→ Agent presents formatted result to user
```

```
User: [Scout Draft에서 "IVE" 입력 후 wiki 조회 클릭]

Scout Draft UI:
→ POST /api/scout/namu-lookup { artistName: "IVE", lang: "ko" }
→ Harness internally calls same skill
→ Returns Scout-compatible suggestion
→ UI shows wiki info panel → user reviews → applies to draft
```

### 6.3 스킬 확장 포인트

| 확장 포인트 | 설명 | 우선순위 |
|-----------|------|----------|
| **새 wiki 소스 추가** | `fetcher-{source}.js` 패턴으로 플러그인 가능 | P1 |
| **다국어 지원** | 각 소스별 언어 파라미터 전달 | P1 |
| **아티스트 유사도 검색** | 등록소에 없는 아티스트 유사 추천 | P2 |
| **디스코그래피 상세** | 트랙리스트, 작사/작곡가 정보 | P3 |
| **SNS/공식 채널 링크** | Instagram, X, YouTube 채널 자동 조회 | P3 |

---

## 7. 보안 및 정책 경계 (Safety & Policy)

### 7.1 콘텐츠 정책

| 항목 | 정책 |
|------|------|
| **원문 전문 저장** | ❌ 금지. 요약/메타데이터만 저장 |
| **이미지 저장** | ❌ 금지. URL 참조만 저장 |
| **저작권 있는 콘텐츠 재생산** | ❌ 금지. 재구성/요약만 허용 |
| **출처 표시** | ✅ 필수. 모든 정보의 wiki URL 표시 |
| **로봇 배제 정책** | ✅ `robots.txt` 준수, `Crawl-Delay` 존중 |
| **비공개/로그인 필요 콘텐츠** | ❌ 금지. 공개 페이지만 접근 |

### 7.2 기술 보안

| 항목 | 정책 |
|------|------|
| **API Key** | Hermes Agent env에만 존재, 절대 frontend 미전달 |
| **Auth** | Firebase token (기존 Scout auth 재사용) |
| **로그** | wiki 조회 URL만 로그, 원문 excerpt 미로그 |
| **Rate Limit** | 사용자별/IP별 이중 제한 |
| **입력 검증** | `artistName` 길이 제한, XSS 방지, 인젝션 방지 |
| **출력 검증** | HTML escape, 스키마 준수 검증 |

### 7.3 운영 정책

| 항목 | 정책 |
|------|------|
| **wiki 소스 변경 모니터링** | 주간 정합성 확인 |
| **등록소 갱신 주기** | 신규 아티스트: 수동 등록 (초기) → 자동 수집 (확장) |
| **장애 대응** | 소스 unavailable → fallback 소스로 자동 전환 |
| **사용자 신고** | 부정확한 정보 신고 채널 |

---

## 8. 수락 기준 (Acceptance Criteria)

### 8.1 Skill 수락 기준

- [ ] **아티스트 조회**: `namu-lookup` 스킬이 아티스트명 입력 → 정규화된 프로필 반환
- [ ] **다중 소스**: 2개 이상 wiki 소스 질의 및 결과 병합
- [ ] **오류 내성**: 일부 소스 실패 시에도 부분 결과 반환
- [ ] **캐싱**: 동일 아티스트 반복 조회 시 캐시 히트 (24h TTL)
- [ ] **등록소 매핑**: 별칭/철자 변형에도 정확한 아티스트 식별
- [ ] **요약 생성**: 500자 이내 wiki 정보 요약
- [ ] **SKILL.md 문서화**: 사용 조건, 입력/출력, 제약 사항 명시

### 8.2 Harness 수락 기준

- [ ] **API 동작**: `POST /api/scout/namu-lookup` 정상 응답
- [ ] **Scout Suggestion 호환**: Harness 출력이 기존 Scout suggestion 스키마와 호환
- [ ] **Draft 적용**: wiki 정보 → Draft 필드 자동 채움
- [ ] **Rate Limit**: 사용자별 제한 초과 시 `429` 응답
- [ ] **인증**: 유효하지 않은 Firebase token → `401` 응답
- [ ] **Fallback**: 아티스트 미발견 시 명확한 에러 + 수동 입력 유도
- [ ] **에러 코드**: `ARTIST_NOT_FOUND`, `LOOKUP_SOURCE_UNAVAILABLE`, `LOOKUP_TIMEOUT` 정상 반환

### 8.3 통합 수락 기준

- [ ] **종단간 흐름**: Scout Draft → wiki 조회 → 정보 표시 → Draft 적용 → 저장
- [ ] **기존 Scout guardrail 유지**: AI provider 미호출, sourceUrl 미페치, 자동저장 없음
- [ ] **성능**: lookup 95% 3초 이내 (캐시 히트 시 50ms 이내)
- [ ] **기존 테스트 통과**: 기존 Scout contract tests 100% 통과
- [ ] **CI 네트워크 프리**: 기본 테스트는 mock/stub으로 실행, 실 API 호출은 opt-in

---

## 9. 구현 제약 (Implementation Constraints)

| 제약 | 이유 |
|------|------|
| **wiki 소스 fetch는 server-side 전용** | CORS, rate-limit, API key 보호 |
| **원문 전문 저장 금지** | 저작권 정책 준수 |
| **AI 요약/생성 금지 (Phase 1)** | wiki 정보는 있는 그대로 요약, 생성적 해석 금지 |
| **CI는 mock 소스로만 테스트** | 외부 의존성 없는 테스트 보장 |
| **기능 플래그 기본 OFF** | Scout namu-lookup은 opt-in, staging에서만 활성화 |
| **등록소 데이터는 수동 시드 (초기)** | 초기 100개 아티스트 수동 등록 후 점진 확대 |

---

## 10. 구현 순서 (Implementation Sequence)

| 단계 | 범위 | 산출물 | 선행 조건 |
|------|------|--------|----------|
| **Step 1: Contract 완료** | 본 문서 + SKILL.md 초안 | `lovebud-scout-namu-lookup-harness-contract.md` | 없음 (본 PR) |
| **Step 2: 등록소 스키마** | Neon 마이그레이션 + 시드 데이터 | `artist_registry` 테이블, 초기 시드 | Step 1 |
| **Step 3: Cache 스키마** | Cache 테이블 또는 KV 바인딩 | `namu_lookup_cache` | Step 2 |
| **Step 4: Harness Core** | 조정 로직 + fetcher 구현 | `functions/api/scout/namu-lookup/` | Step 3 |
| **Step 5: Skill 정의** | `SKILL.md` + Agent skill 등록 | `.hermes/skills/namu-lookup/SKILL.md` | Step 4 |
| **Step 6: UI 연동** | Scout Draft에 wiki lookup 버튼/패널 | `js/scout/namu-lookup-ui.js` | Step 5 |
| **Step 7: 테스트** | Contract/integration 테스트 | `tests/contracts/namu-lookup-*.test.cjs` | Step 6 |
| **Step 8: Staging 배포** | Staging 환경 활성화 + smoke test | 배포 체크리스트 | Step 7 |

---

## 11. 비목표 (Non-goals)

- ❌ **AI 생성 wiki 콘텐츠**: wiki 정보는 fetch + 요약만, 생성은 하지 않음
- ❌ **자동 아티스트 발견**: 사용자가 명시적으로 요청한 lookup만 수행
- ❌ **실시간 알림/모니터링**: 아티스트 정보 변경 알림 기능
- ❌ **다국어 wiki 동시 지원**: 초기 한국어/영어만, 확장은 추후
- ❌ **소셜 미디어 연동**: Instagram/X 게시물 자동 조회
- ❌ **음원 스트리밍 연동**: Spotify/Apple Music API
- ❌ **커뮤니티 기능**: 다른 사용자의 wiki 조회 공유
- ❌ **기존 Scout Draft 수동 입력 대체**: wiki lookup은 보조 기능, 수동 입력은 항상 가능

---

## 12. 참고 자료 (References)

- [#3155 원본 이슈](https://github.com/skerishKang/LoveBud/issues/3155)
- [#1882 Scout fan assistant MVP](https://github.com/skerishKang/LoveBud/issues/1882)
- [#3061 감상 순서 가이드 계약](lovebud-appreciation-order-contract.md)
- [Scout MVP Boundary](lovebud-scout-mvp-boundary.md)
- [Scout Save Flow Boundary](lovebud-scout-save-flow-boundary.md)
- [Scout Live Provider Post-Mock Readiness Audit](lovebud-scout-live-provider-post-mock-readiness-audit.md)
- [Scout Serverless Endpoint Boundary](lovebud-scout-serverless-endpoint-boundary.md)
- [Hermes Agent 문서 - Skills](https://hermes-agent.nousresearch.com/docs/skills)
- [나무위키](https://namu.wiki)
- [Wikimedia API](https://www.mediawiki.org/wiki/API:Main_page)

---

## Document Metadata

- **Created**: 2026-07-02
- **Author**: #3155 Contract definition
- **Version**: v20260702-namu-lookup-contract-1
- **Status**: Draft → Plan → Implement
- **Next Step**: Step 2 (등록소 스키마 + 시드 데이터)
- **Reviewer**: Chulwon Kang (박사님)
