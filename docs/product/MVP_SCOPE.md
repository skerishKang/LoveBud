# Lovetree MVP Scope

## Goal
초기 MVP의 목표는 **"입덕의 첫 순간"을 빠르고 쉽게 기록**하고, 그것을 연결해서 **러브트리를 시각화**하는 것입니다. 문서에서 말한 "지엽적인 것이 아니라 가장 중요한 것을 먼저 만드는 것"이라는 원칙을 따릅니다.

---

## MVP Definition
Lovetree MVP는 다음 6가지 경험이 원활하게 이루어지는 것을 목표로 합니다.

1. **영상 시점 기록**: 유튜브 영상의 특정 시점(Timestamp)을 메모와 함께 기록
2. **감정 메모 작성**: 왜 이 시점이 좋았는지 감정 메모 남기기
3. **러브트리 시각화**: 기록된 순간들을 나뭇가지처럼 연결하여 나무로 보기
4. **비공개/공개 관리**: 기본 비공개로 시작, 선택적 공유
5. **트리 관리**: 트리 생성, 편집, 삭제 기본 기능
6. **커뮤니티 감상**: 공유된 러브트리 둘러보고 감상하기

> 이 6단계가 원활하면 다른 기능을 추가합니다.

## In Scope

### 1. Auth
- Firebase Auth 기반 로그인/세션
- 소셜 로그인 (Google)
- 최소 사용자 정보만 저장

### 2. Tree (러브트리)
- 러브트리 생성
- 러브트리 목록 보기
- 트리 제목, 공개 범위, 기본 정보 관리
- 트리 삭제 / 비공개 전환 / 공유 기본 기능

### 3. Memory Node (순간 기록)
- 영상 URL 등록
- 특정 시점(timestamp) 등록
- 짧은 제목 등록
- 감정 태그 등록
- 짧은 메모 등록
- 트리 노드에 노드 연결

### 4. Viewing
- 데스크톱에서 완성된 러브트리 보기
- 모바일에 최적화된 트리 형태 보기
- 감정 메모 상세 보기
- 타임라인 / 시간순 감상

### 5. Sharing
- 러브트리 링크 공유
- 공개/비공개 링크 공유 범위 설정
- 공유된 트리其他人 자유 감상

### 6. Community Minimum
- 공유된 러브트리 둘러보기
- 공감 / 댓글 / 저장 최소 반응
- 게시판이 아닌 러브트리 감상 중심 구조

## Out of Scope For MVP

다음 항목은 비용 대비 가치가 낮거나 MVP 이후 고려합니다:

- 굿즈 / 공연 / 구독 / 채널 / 모임 관련
- 프리미엄 과금 계정
- 고급 분석 기능
- 복잡한 추천 알고리즘
- AI 자동 태깅 고도화
- 고급 팀업 기능
- 다중 트리 템플릿 시스템
- 영상 클립 자동 수집 기능

## Page Priority

제품 가치를 가장 빠르게 검증할 수 있는 순서:

1. `editor-desktop` - 핵심 에디터
2. `mobile-add-memory` - 빠른 기록
3. `mobile-tree` - 트리 보기
4. `memory-detail` - 메모 상세
5. `my-trees` - 내 트리 목록
6. `home` - 홈
7. `community-tree-detail` - 커뮤니티 상세
8. `community` - 커뮤니티 탐색
9. `settings` - 설정
10. `login` - 로그인

> 여기서 핵심은 "입덕의 첫 순간"과 "그 순간이 쌓여 만들어지는 경로"입니다.

## Must-Have Data

MVP 구현에 반드시 필요한 데이터 구조입니다:

- `tree.id`
- `tree.title`
- `tree.ownerId`
- `tree.visibility`
- `tree.updatedAt`
- `memory.id`
- `memory.treeId`
- `memory.sourceUrl`
- `memory.sourceType`
- `memory.timestamp`
- `memory.title`
- `memory.memo`
- `memory.emotionTags`
- `memory.parentId`

> 이 기본 데이터 구조로 CRUD가 가능해야 합니다

## Must-Have UI States

다음 상태는 반드시 고려합니다:

- 트리 빈 상태
- 트리 성장 상태
- 메모 작성 중
- 메모 선택됨
- 공유하기 유효
- 로그인됨 / 로그인 안됨

## Quality Bar Before Real Integration

실제 기능 개발기에 진입하기 전에 다음 조건을 만족해야 합니다:

1. 핵심 4개 페이지 문구가 자연스럽고 임팩트 있다
2. 모바일 / 데스크톱 레이아웃 구분 명확하다
3. 러브트리가 "기술 플로우차트"처럼 보이지 않는다
4. 첫 순간 기록 화면에서 가이드가 명확하다
5. 공유 화면에서 "영상 하나"만이 아니라 "감정 경로 체계"가 보인다

## Handoff Rule

개발 업무를 AI 모델에게 맡기기 전에 확인하는 문서 순서:

1. `docs/product/PRODUCT_IDENTITY.md` - 제품 철학
2. `docs/product/MVP_SCOPE.md` - MVP 범위
3. 필요시 `docs/product/USER_FLOW.md` - 사용자 흐름
4. 그 다음 음성만 구현 프롬프트 개발 문서가 바로 구현 프롬프트인지 확인합니다

## Data Access Rules

| 환경 | 공식 진입점 | 사용법 |
|------|------------|--------|
| 브라우저 | `src/postgres-client-browser.js` | `window.postgresDB` 사용 |
| 서버 | `netlify/functions/_lib/db-api.js` | `db-api.js` 내부 함수 사용 |

- ✅ `src/postgres-client-browser.js` 로드 후 `window.postgresDB` 사용
- ⚠️ 레거시: `firebase.firestore()`는 shim이 가로채어 PostgreSQL로 연결 (작동은 함, 신규 코드에서 사용 금지)
- ❌ `src/firebase-firestore-compat.js` 직접 참조 금지
- ❌ 신규 코드에서 함수명/주석에 "Firestore" 추가 금지