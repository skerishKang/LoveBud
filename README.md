# LoveBud

LoveBud는 팬이 사랑에 빠진 첫 순간부터 이어진 감정의 흐름을 기록하고, 감상하고, 트리처럼 키워가는 서비스입니다.

실서비스 프론트 주소는 `https://lovebud.pages.dev/` 입니다.

---

## 서비스 개요

LoveBud / LoveTree는 일반 북마크 정리 앱이나 관리자 도구가 아닙니다.

이 저장소는 아래 경험을 현재 기준 제품 루프로 다룹니다.

- 공개 러브트리 둘러보기
- 내 러브트리 관리
- 첫 순간 생성 및 다음 순간 이어가기
- 감정 메모와 트리 흐름 편집

### 사용자 시나리오

예상 사용자는 어떤 노래, 장면, 무대, 대사, 이미지, 글을 계기로 팬이 된 첫 순간을 하나의 공개 또는 비공개 기억으로 저장합니다.

그 뒤 사용자는 이어지는 감정 메모와 대표 순간을 같은 러브트리에 추가하면서, 단순한 목록이 아니라 시간과 감정의 흐름을 가진 트리형 스크랩북으로 키워갑니다.

다른 사용자는 공개된 러브트리를 둘러보며 누군가의 입덕 첫 순간, 이어진 기억, 대표 순간을 감상할 수 있습니다.

제품/브랜드 판단의 최상위 기준은 아래 문서입니다.

- `docs/product/PRODUCT_IDENTITY.md`
- `docs/product/BRAND_EXPERIENCE.md`
- `docs/design/UI_DESIGN_SYSTEM.md`

---

## 이름과 용어 기준

- **LoveBud**: 저장소명, 운영 프로젝트명, 내부 문서/이슈/PR의 기본 프로젝트명
- **LoveTree**: 사용자-facing 제품 경험, 공개/개인 트리, 브랜드 카피에서 사용하는 서비스 경험명
- **search**: 현재 실제 파일/페이지 경로명 (`pages/search.html`)
- **browse / 둘러보기**: 사용자-facing 제품 경험 표현

사용 기준:

- 저장소, 브랜치, PR, Issue, 운영 보고에서는 기본적으로 **LoveBud**를 사용합니다.
- UI 카피, 브랜드 경험, 공개 트리 설명, 사용자 도움말에서는 문맥상 **LoveTree**를 사용할 수 있습니다.
- 파일 경로와 코드 식별자는 실제 저장소 경로를 우선하므로 `search`를 유지할 수 있습니다.
- 사용자-facing 문구에서는 `browse`, `둘러보기`, `감상 허브` 계열 표현을 우선합니다.

즉, 구현 경로명은 `search`를 유지할 수 있지만, 제품 카피와 문서 설명에서는 `browse`, `둘러보기`, `감상 허브` 계열 표현을 우선합니다.

---

## 현재 인프라 우선순위

현재 운영 기준 인프라는 **Cloudflare Pages + Modal**입니다.

1. **Cloudflare Pages** — 실서비스 프론트, same-origin `/api`, 공식 사용자-facing 배포 진입점
2. **Modal** — active API/backend target, browse summary, private/community read/write compute
3. **Firebase** — Auth 및 client bootstrap 용도
4. **Vercel / Netlify** — 현재 active deployment 또는 active fallback이 아님. 남아 있는 설정과 코드는 legacy artifact / removal audit 대상

핵심 원칙:

- 사용자 브라우저는 가능하면 **same-origin `/api`**만 사용합니다.
- 공식 사용자-facing 주소는 **`https://lovebud.pages.dev/`** 입니다.
- active runtime은 **Cloudflare Pages + Modal** 입니다.
- active API path는 **browser → same-origin `/api/*` → Cloudflare Pages Functions → Modal → Neon** 입니다.
- Firebase Auth는 client-side에서 ID token을 발급합니다. Cloudflare Pages Functions는 same-origin `/api/*` 요청의 Authorization header를 Modal backend로 전달하며, token verification과 private route authorization은 Modal backend에서 수행합니다.
- Firebase Web `apiKey`는 client bootstrap용이며, 단독 노출만으로는 security blocker가 아닙니다. 실제 보안 경계는 authorized domains, backend token verification, owner authorization, Security Rules/App Check 적용 여부 등으로 판단합니다.
- 현재 기준으로 이 프로젝트는 bundler를 사용하지 않으며, `pages/*.html` 독립 진입점과 script-order / window namespace 기반 로딩 모델을 사용합니다.
- Vercel/Netlify 관련 설정 파일은 legacy artifact이며, 현재 active runtime은 Cloudflare Pages + Modal입니다.
- Vercel은 현재 active deployment 또는 active fallback이 아닙니다. `vercel.json`은 legacy artifact / removal audit 대상으로만 봅니다.
- Netlify는 현재 active deployment 또는 active fallback이 아닙니다. `netlify.toml`과 `netlify/functions/**`는 legacy artifact / removal audit 대상으로만 봅니다.
- `_redirects`는 Cloudflare Pages에서도 사용할 수 있으므로 Netlify 전용 파일로 단정하지 않습니다.
- 이번 문서 정리는 설정 파일 삭제를 포함하지 않습니다. `netlify.toml`, `vercel.json`, `_redirects`, `netlify/functions/**`는 이 PR에서 삭제하지 않습니다.
- 신규 backend/API 구현은 **Cloudflare Pages Functions + Modal** 기준으로만 진행합니다.
- browse display filter와 publication guard는 **다른 개념**으로 취급합니다.

운영 상세는 아래 문서를 먼저 봅니다.

- `docs/ops/OPERATIONS.md`
- `docs/ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/engineering/REVIEW_GUARDRAILS.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`

---

## 리뷰 시 주의할 점

LoveBud는 저장소 구조와 운영 계약에 프로젝트 고유 전제가 많습니다.

따라서 리뷰 시에는 아래를 먼저 확인해야 합니다.

- `AGENTS.md`
- `docs/doc_index.md`
- `docs/engineering/REVIEW_GUARDRAILS.md`

특히 아래 항목은 generic 지적을 자동으로 반복하지 않도록 주의합니다.

- Firebase Web `apiKey`는 즉시 blocker로 단정하지 않기
- `vercel.json`을 자동 삭제 후보로 보지 않기
- `_redirects`를 Netlify 전용 파일로 단정하지 않기
- browse / search, display filter / publication guard 혼동하지 않기
- 파일 크기나 번들러 부재만으로 심각 판정하지 않기
- `netlify/functions/**`를 active backend 구현 위치로 보지 않기

---

## 개발 / 배포 진입점

### 서비스 진입점

문서의 페이지 경로 표기는 실제 저장소 파일 경로를 기준으로 합니다.

- `index.html`
- `pages/intro.html`
- `pages/search.html`
- `pages/detail.html`
- `pages/editor.html`
- `pages/my-trees.html`
- `pages/login.html`

Cloudflare Pages에서는 위 경로가 사용자-facing 주소로 노출됩니다.

- `/intro.html`
- `/search.html`
- `/detail.html`
- `/editor.html`
- `/my-trees.html`
- `/login.html`

### 프론트 API 원칙

브라우저 코드는 `window.apiClient` → `js/api/base-api-fetch.js` → same-origin `/api/...` 경로를 사용합니다.

### 현재 배포 구조

- **Cloudflare Pages**: 공식 프론트 및 same-origin `/api` 엔트리
- **Cloudflare Pages Functions**: browser-facing `/api/*` gateway
- **Modal**: active backend/API target, browse / summary / private-community compute
- **Neon**: active database target behind Modal
- **Firebase**: Auth 및 client bootstrap 용도
- **Vercel**: 현재 active deployment/fallback이 아니며, 남은 설정은 legacy artifact / removal audit 대상
- **Netlify**: 현재 active deployment/fallback이 아니며, 남은 설정과 `netlify/functions/**`는 legacy artifact / removal audit 대상

신규 backend/API 구현은 Cloudflare Pages Functions + Modal 기준으로만 진행합니다. Vercel/Netlify 설정 파일 삭제는 별도 audit와 CTO 승인 후에만 다룹니다.

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
7. `docs/ops/NETLIFY_LEGACY_ARTIFACT_AUDIT.md`
8. `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
9. `docs/engineering/API_CONTRACT.md`
10. `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
11. `docs/engineering/REVIEW_GUARDRAILS.md`

### 대화 복원이 필요할 때

12. `docs/conversation/summary/summary_index.md`
13. 최신 summary 문서

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
