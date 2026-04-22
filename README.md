# LoveBud

LoveBud는 팬이 사랑에 빠진 첫 순간부터 이어진 감정의 흐름을 기록하고, 감상하고, 트리처럼 키워가는 서비스입니다.

실서비스 프론트 주소는 `https://lovebud.vercel.app/` 입니다.

---

## 서비스 개요

LoveBud / LoveTree는 일반 북마크 정리 앱이나 관리자 도구가 아닙니다.

이 저장소는 아래 경험을 현재 기준 제품 루프로 다룹니다.

- 공개 러브트리 감상
- 내 러브트리 관리
- 첫 순간 생성 및 다음 순간 이어가기
- 감정 메모와 트리 흐름 편집

제품/브랜드 판단의 최상위 기준은 아래 문서입니다.

- `docs/product/PRODUCT_IDENTITY.md`
- `docs/product/BRAND_EXPERIENCE.md`
- `docs/design/UI_DESIGN_SYSTEM.md`

---

## 현재 인프라 우선순위

현재 운영 기준 인프라 우선순위는 아래와 같습니다.

1. **Modal** — browse summary, 복합 계산, read-heavy compute 우선
2. **Vercel** — 실서비스 프론트, same-origin `/api`, 배포 진입점
3. **Netlify** — fallback 또는 단계적 제거 대상 레거시 경로

핵심 원칙:

- 사용자 브라우저는 가능하면 **same-origin `/api`** 만 사용합니다.
- Netlify는 주경로가 아니라 **fallback / migration 대상**입니다.
- browse의 display filter와 publication guard는 **다른 개념**으로 취급합니다.

운영 상세는 아래 문서를 먼저 봅니다.

- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

---

## 개발 / 배포 진입점

### 서비스 진입점

- `/intro.html`
- `/search.html`
- `/detail.html`
- `/editor.html`
- `/my-trees.html`
- `/login.html`

Vercel에서는 위 경로가 `pages/*.html`로 rewrite 됩니다.

### 프론트 API 원칙

브라우저 코드는 `window.apiClient` → `js/api/base-api-fetch.js` → same-origin `/api/...` 경로를 사용합니다.

### 현재 배포 구조

- **Vercel**: 프론트 및 `/api` 엔트리
- **Modal**: browse / summary 가속 및 compute
- **Netlify**: 일부 레거시 CRUD upstream fallback

---

## 문서 읽는 순서

### 가장 먼저

1. `AGENTS.md`
2. `docs/doc_index.md`
3. `docs/product/PRODUCT_IDENTITY.md`
4. `docs/product/BRAND_EXPERIENCE.md`
5. `docs/design/UI_DESIGN_SYSTEM.md`

### 구현 / 운영 판단이 필요할 때

6. `docs/ops/OPERATIONS.md`
7. `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
8. `docs/engineering/API_CONTRACT.md`
9. `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

### 대화 복원이 필요할 때

10. `docs/conversation/summary/summary_index.md`
11. 최신 summary 문서

---

## 문서 인덱스

전체 문서 구조와 읽기 순서는 아래 인덱스를 기준으로 합니다.

- `docs/doc_index.md`

---

## 작업 원칙 요약

- 반드시 현재 `main` 기준으로 먼저 확인
- 추정 금지
- 최소 수정 원칙 유지
- 코드/문서 작업 범위를 혼합하지 않기
- source of truth 문서와 충돌하는 판단 금지

세부 협업 규칙은 `AGENTS.md`를 따릅니다.
