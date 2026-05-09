# LoveBud Roadmap

> 기준: 2026-04-17 | 컴2 (작업 사본)

## 현재 MVP 상태 요약

**6개 핵심 경험 중 5개 구현 완료**

| 경험 | 상태 |
|------|------|
| 영상 시점 기록 | ✅ 구현됨 |
| 감정 메모 작성 | ✅ 구현됨 |
| 러브트리 시각화 | ✅ 구현됨 |
| 비공개/공개 관리 | ✅ 구현됨 |
| 트리 관리 | ✅ 구현됨 |
| 커뮤니티 감상 | ✅ 구현됨 |

---

## 현재 핵심 루프 상태

### ✅ my-trees (내 트리)

- 비공개 트리 목록/생성/선택
- 캐시 우선 + background API refresh
- Auth 가드 적용

### ✅ editor (에디터)

- memory 추가 (YouTube URL → thumbnail 자동 생성)
- 트리 시각화 (tree structure rendering)
- null fallback 처리
- 로컬 fallback

### ✅ search (둘러보기)

- public tree 탐색
- stage 필터 (입덕/성장/최애)
- 키워드 검색
- 캐시 + background refresh

### ✅ detail (상세 보기)

- tree 상세 정보
- memory 목록
- 외부 링크 (YouTube embed)

### ✅ login (로그인)

- Firebase Auth
- Session 관리

---

## 남은 우선순위

### 높음

| 항목 | 현재 상태 | 다음 액션 |
|------|----------|----------|
| Editor memory 편집 | 미구현 | 기능 구현 필요 |
| Editor memory 삭제 | 미구현 | 기능 구현 필요 |
| Home (landing) | 미구현 | 첫 트리 생성 전 경로 필요 |

### 중간

| 항목 | 현재 상태 | 다음 액션 |
|------|----------|----------|
| UI 상태 문서화 | 부분 | docs로 정리 필요 |
| Empty state UX | 부분 | 개선 여지 |
| 에러 처리 UX | 부분 | 개선 여지 |

### 낮음

| 항목 | 현재 상태 | 다음 액션 |
|------|----------|----------|
| DB Schema 문서 | 없음 | 문서화 필요 |
| API Contract 문서 | 없음 | 문서화 필요 |
| 공유 기능 고도화 | 기본 구현만 | phase 2에서 |

---

## Blocker

| blocker | 상태 |メモ|
|---------|------|-----|
| Netlify DB 환경 | 미확인 | Dashboard env 설정 확인 필요 |
| Firebase | 설정됨 |정상|

---

## 다음 구현/문서화 순서

1. **Editor 편집/삭제** → `js/editor.js` 개선
2. **Home (landing)** → `index.html` 개편 또는 새 페이지
3. **UI 상태 문서화** → `docs/product/UI_STATES.md`
4. **기술 문서** → `docs/tech/DB_SCHEMA.md`, `docs/tech/API_CONTRACT.md`

---

## 연결된 문서

- **프론트엔드 구현 상세**: `../plans/FRONTEND_ROADMAP.md` — 품질 기준 및 빌드 큐
- **페이지 문서**: `../pages/`
- **상위 문서**: `../product/PRODUCT_BRIEF.md`
- **스킬**: `../skills/page-doc-writer/`, `../skills/project-doc-sync/`

##Metadata
updated: 2026-04-17