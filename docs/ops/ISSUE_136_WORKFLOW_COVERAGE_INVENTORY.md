# Issue #136 — Production Workflow Coverage Inventory

**Status:** Draft — open for review  
**Source:** Production browser exploration (no login, no mutation)  
**Production URL:** https://lovebud.pages.dev/  
**Date explored:** 2026-04-29  
**Issue:** [#136](https://github.com/skerishKang/LoveBud/issues/136)  

> This document must NOT close Issue #136. It is a foundation reference for converting exploration results into smoke coverage candidates.

---

## 1. Purpose

- Issue #136의 current workflow coverage inventory를 기록합니다.
- Production browser exploration 결과를 smoke coverage 후보로 전환하기 위한 기초 자료를 제공합니다.
- 후속 작업(static smoke workflow PoC, API/Auth smoke design, manual gate docs)의 입력 문서로 사용됩니다.

---

## 2. Scope

| 항목 | 값 |
|------|----|
| 대상 환경 | Production only (`https://lovebud.pages.dev/`) |
| 로그인 | No |
| Mutation | Skipped (no create/update/delete 수행 없음) |
| Code/Runtime 수정 | No |
| Issue closure | No (Issue #136 open 유지) |
| Static server 검증 | `/api/*`, auth-gated pages, data-loaded pages 불가 |

---

## 3. Pages Explored

| URL | 관찰 목적 | Coverage 의미 |
|-----|-----------|---------------|
| `/` | Landing 진입점, CTA 버튼, 네비게이션 확인 | Public entry flow의 시작점 |
| `/pages/intro.html` | 서비스 소개 흐름, Intro → Search CTA | P0 퍼블릭 워크플로우 2단계 |
| `/pages/search.html` | 커뮤니티 트리 목록, 필터/정렬/pagination, 카드 렌더링 | 핵심 browse flow + API endpoint 확인 |
| `/pages/my-trees.html` | 인증 게이팅 상태 확인, 새 트리 버튼 | Auth boundary 및 private tree flow 시작점 |
| `/pages/login.html` | Google/email 로그인 UI 가시성 확인 | Auth entry point 확인 |
| `/pages/editor.html` | Canvas placeholder, preview panel, auth redirect 확인 | Editor boot + auth boundary |
| `/pages/detail.html` | 트리 상세 보기 UI, API 오류 콘솔 관찰 | Detail view + runtime/API 오류 패턴 |

---

## 4. Public Workflow Coverage Candidates

### P0 — Critical Path

**Landing → Intro → Search browse → Tree cards → Preview hub**

| 단계 | URL | 관찰 내용 |
|------|-----|----------|
| 1. Landing | `/` | 로고, 주요 CTA("러브트리 탐색하기"), 네비게이션 렌더링 확인 |
| 2. Intro | `/pages/intro.html` | 서비스 소개 콘텐츠, Search로 이동하는 CTA 확인 |
| 3. Search browse | `/pages/search.html` | 커뮤니티 트리 카드 목록 로드, `/api/community/trees` 호출 관찰 |
| 4. Tree cards | `/pages/search.html` | 개별 카드 렌더링(제목, 썸네일, 메타데이터) 확인 |
| 5. Preview hub | `/pages/search.html` | 카드 선택 시 preview hub 패널 표시 확인 |

### P1 — Filter / Sort / Pagination

| 후보 | 설명 |
|------|------|
| Category filters | 카테고리 필터 토글 동작 |
| Sort controls | popular / latest 정렬 전환 |
| 더 보기 pagination | 추가 항목 로드 |

### P2 — Optional / Edge States

| 후보 | 설명 |
|------|------|
| Preview hub empty state | 선택 항목 없을 때의 빈 상태 |
| Search textbox empty result | 검색어 입력 후 결과 없음 상태 |
| Editor boot placeholder | editor.html 진입 후 auth redirect 전 placeholder 표시 |

---

## 5. Auth Boundary Coverage Candidates

| 후보 | URL | 관찰 내용 |
|------|-----|----------|
| 내 러브트리 시작하기 CTA | `/` 또는 `/pages/intro.html` | `login.html?redirect=my-trees.html`로 이동 확인 |
| my-trees auth loading state | `/pages/my-trees.html` | 비로그인 상태에서 로딩 상태 → redirect 흐름 |
| editor auth boundary | `/pages/editor.html` | 비로그인 접근 시 auth redirect 발생 확인 |
| login flow visibility | `/pages/login.html` | Google OAuth / email 로그인 UI 렌더링 확인 (mutation 없음) |

> **주의:** Auth boundary smoke는 visibility/redirect만 확인합니다. 실제 로그인 시도(credential 입력, OAuth 완료)는 이 문서의 scope 밖입니다.

---

## 6. Search/Browse Coverage Candidates

| 후보 | 세부 내용 |
|------|-----------|
| API endpoint | `/api/community/trees?view=summary&sort={popular\|latest}&limit=N` |
| Tree card rendering | 카드 컴포넌트 렌더링 (제목, 카테고리 태그, 썸네일, 메타) |
| Search textbox filtering | 검색어 입력 → 필터 결과 반영 |
| Category filter | 카테고리 선택 → 목록 필터링 |
| Sort controls | popular / latest 전환 → 목록 재정렬 |
| 더 보기 pagination | 추가 페이지 로드 |
| Preview hub empty state | 트리 미선택 상태에서 preview 영역 빈 상태 표시 |

---

## 7. Runtime/API Coverage Candidates

### Public Endpoints

| Endpoint | 접근 유형 | smoke 가능 여부 |
|----------|----------|----------------|
| `/api/community/trees` | Public browse (no auth) | ✅ Static smoke 가능 |
| `/api/trees/:id` (public tree) | Public detail (no auth, is_public=true) | ✅ 조건부 가능 |

### Private Endpoints

| Endpoint | 접근 유형 | smoke 가능 여부 |
|----------|----------|----------------|
| `/api/trees` | Private (auth required) | ❌ Auth smoke 설계 필요 |
| `/api/memories` | Private (auth required) | ❌ Auth smoke 설계 필요 |
| `/api/memories/:id` | Private (auth required) | ❌ Auth smoke 설계 필요 |

### Local Static Server 제한

- `/api/*` 엔드포인트는 local static server에서 검증 불가
- Auth-gated pages는 local static server에서 데이터 로드 불가
- Data-loaded pages(트리 카드, 메모리 목록)는 local static server에서 확인 불가

### Console 관찰 (detail.html)

```
[editor] API getMemoriesByTree failed — expected/no auth
```

- `detail.html` 진입 시 비인증 상태에서 `/api/memories/:id` 호출 → 실패 로그 발생
- **평가:** 비인증 접근에서 예상된 동작이며, fatal error 아님. network blocker 없음.

---

## 8. Mobile/Layout Coverage Candidates

| 후보 | 관찰 내용 |
|------|-----------|
| Hamburger nav | 모바일 뷰포트에서 햄버거 메뉴 렌더링 및 토글 동작 |
| Stacked cards | 카드 목록 단일 컬럼 스택 레이아웃 |
| Preview hub placement | 모바일에서 preview hub 위치 (카드 목록 하단) |
| No horizontal overflow | 수평 스크롤 없음 관찰 (전 페이지 확인) |

---

## 9. Recommended Smoke Priority

| Priority | Coverage 후보 | 이유 |
|----------|--------------|------|
| **P0** | Landing → Intro → Search browse → Tree cards → Preview hub | 핵심 퍼블릭 유저 경로 |
| **P0** | `/api/community/trees` 응답 확인 | browse 기능 전체의 의존성 |
| **P0** | Auth redirect: 내 러브트리 시작하기 → login.html | Auth gate 존재 확인 |
| **P1** | Category filter / sort / 더 보기 pagination | 주요 UX 기능 |
| **P1** | my-trees auth loading state | Private flow 진입 확인 |
| **P1** | Mobile hamburger / stacked cards / no overflow | 모바일 레이아웃 회귀 방지 |
| **P2** | Preview hub empty state | Edge case |
| **P2** | Editor boot placeholder (pre-auth) | Auth redirect 이전 상태 |
| **P2** | detail.html console warning (API 오류 예상 동작) | 알려진 동작 문서화 |

---

## 10. Follow-up

다음 항목은 Issue #136 하위 작업 또는 별도 이슈로 추적합니다.

| 항목 | 상태 |
|------|------|
| Fixed-slot manual gate docs | Open |
| Static smoke workflow PoC | Open |
| API/Auth smoke design | Open |
| **Issue #136** | **반드시 Open 유지** |

> Issue #136은 이 문서가 완성되어도 close하지 않습니다.
> 후속 smoke coverage 설계/구현 작업이 완료될 때까지 open 상태를 유지합니다.
