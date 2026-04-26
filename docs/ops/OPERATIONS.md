# LoveBud Operations Strategy (운영 전략)

## 1. 운영 우선순위

LoveBud의 현재 운영 우선순위는 아래와 같습니다.

> **Hierarchy: Cloudflare Pages Entry + Modal Runtime > Vercel Transitional Fallback > Netlify Legacy Artifact**

| 계층 | 역할 | 현재 책임 범위 | 상태 |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages** | **Primary Entry / API Router** | 실서비스 진입점, 정적 프런트 서빙, same-origin `/api/*` 라우팅, `functions/api/*` 실행 | 1순위 |
| **Modal** | **Active API / Backend Target** | `/api/trees`, `/api/memories`, browse/community/private read/write target, 대표 카드 계산 | 1순위 |
| **Vercel** | **Deprecated Transitional Fallback** | 일부 fallback / 전이기 보조 계층 | audit 중 |
| **Netlify** | **Legacy Artifact Only / Removal Candidate** | `netlify/functions/*`, `netlify.toml` historical/reference purpose. 현재 `lovebud.pages.dev` production/test slot active backend 또는 active fallback 아님 | 신규 구현 금지 |

핵심 원칙:
- 실서비스 주소는 **반드시 `https://lovebud.pages.dev/`** 기준으로 본다.
- browser-facing API entry는 **Cloudflare Pages same-origin `/api/*`** 기준으로 본다.
- active backend target은 **Cloudflare Pages Functions → Modal** 경로 기준으로 본다.
- `netlify/functions/*`는 현재 active production backend가 아니며, Netlify runtime 재활성화가 명시 승인되지 않는 한 신규 backend 정책 구현 대상이 아니다.
- Netlify route gap은 즉시 blocker가 아니며, Issue #119 runtime routing audit에서 제거/보존 여부를 판단한다.

---

## 2. 실서비스 운영 정보

- **공식 서비스 주소**: `https://lovebud.pages.dev/`
- **Cloudflare Pages 프로젝트(운영 기준)**: `lovebud.pages.dev`
- **Modal 앱**: `lovebud-browse-snapshot`
- **Vercel 주소(Deprecated transitional fallback)**: `https://lovebud.vercel.app/`
- **Netlify 주소 / Functions(Legacy artifact only / Removal Candidate)**: `https://lovebud.netlify.app/`, `netlify/functions/*`

주의:
- Vercel과 Netlify 주소는 현재 공식 사용자-facing 대표 주소가 아닙니다.
- 운영 문서에서 `lovebud.vercel.app`, `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.
- Netlify Functions를 현재 `lovebud.pages.dev` production/test slot backend나 active fallback처럼 설명하지 않습니다.

---

## 3. 실제 요청 경로

### 3.1 `/api/trees`

현재 production/test slot route matrix 실측 기준:

1. 브라우저 → `https://lovebud.pages.dev/api/trees`
2. Cloudflare Pages `functions/api/trees.js`
3. Modal `/modal/private/trees`
4. 응답 marker: `x-lovebud-upstream: modal`
5. `modal-function-call-id` 존재
6. `server: cloudflare`, `cf-cache-status: DYNAMIC`

### 3.2 `/api/memories`

현재 production/test slot route matrix 실측 기준:

1. 브라우저 → `https://lovebud.pages.dev/api/memories`
2. Cloudflare Pages `functions/api/memories.js`
3. Modal `/modal/private/memories`
4. 응답 marker: `x-lovebud-upstream: modal`
5. `modal-function-call-id` 존재
6. `server: cloudflare`, `cf-cache-status: DYNAMIC`

### 3.3 브라우즈 summary

현재 browse summary의 주경로는 아래입니다.

1. 브라우저 → `https://lovebud.pages.dev/api/community/trees?view=summary&sort=latest&limit=3`
2. Cloudflare Pages `functions/api/[[path]].js`
3. `MODAL_BASE_URL` 기준 Modal `/modal/browse/latest?limit=3` 우선 호출
4. recognized route는 Modal 응답을 기준으로 처리

### 3.4 브라우즈 memories hydrate

현재 preview hydrate 경로는 아래입니다.

1. 브라우저 → `https://lovebud.pages.dev/api/community/memories?treeId=<id>`
2. Cloudflare Pages `functions/api/[[path]].js`
3. Modal `/modal/community/memories` 우선 호출

### 3.5 기타 `/api/*`

기타 `/api/*` 경로는 Cloudflare Pages `functions/api/[[path]].js`가 recognized route를 Modal로 전달하거나, unhandled route에 대해 Cloudflare 404/405 계열 응답을 반환합니다.

---

## 4. 환경 변수 운영 원칙

### 4.1 Cloudflare Pages

현재 Cloudflare Pages 라우터가 직접 참조하는 핵심 변수:

- `MODAL_BASE_URL`
  - browse summary 및 private/community read/write 계열 Modal upstream
- `LOVEBUD_UPSTREAM_ORIGIN`
  - deprecated fallback 계층 audit 중인 origin

기본 원칙:
- `MODAL_BASE_URL`는 **반드시 실제 live Modal 배포 주소**를 가리켜야 한다.
- `/api/trees`, `/api/memories` active path는 Cloudflare Pages Functions가 Modal로 전달한다.

### 4.2 Modal

Modal runtime 핵심 변수:

- `DATABASE_URL`
  - Modal secret `lovebud-db`에서 주입
- `CORS_ALLOWED_ORIGINS`
  - 필요 시 명시 설정
  - 기본 허용 origin에는 `https://lovebud.pages.dev`, `https://lovebud.vercel.app`, `https://lovebud.netlify.app` 포함 가능

### 4.3 Vercel / Netlify

Vercel은 deprecated transitional fallback입니다.
Netlify Functions는 Legacy Artifact Only / Removal Candidate입니다.

운영 설명에서는 두 계층 모두 **주경로**로 표현하지 않습니다.
Netlify는 active fallback 구현 대상이 아니며, removal audit 완료 전까지 historical/reference purpose로만 남습니다.

---

## 5. Degraded response / transitional fallback 운영 원칙

- Modal browse summary가 실패해도 browse 전체가 멈추면 안 된다.
- fallback이라는 표현은 Vercel deprecated transitional fallback 또는 Modal 실패 시 degraded response에 한정한다.
- Netlify Functions는 active fallback이 아니다.
- Netlify artifacts는 removal audit 완료 전까지 historical/reference purpose로만 남는다.
- CTO가 Netlify runtime 재활성화를 명시 승인하지 않는 한, `netlify.toml` 또는 `netlify/functions/*`에 신규 route parity, backend policy, feature parity를 추가하지 않는다.
- Netlify route gap은 고쳐서 유지할 문제가 아니라 Issue #119 runtime routing audit에서 제거/보존 여부를 판단한다.

---

## 6. 단계적 제거 원칙

현재 구조는 완전 제거가 아니라 **전이기 구조**다.

정리 순서:
1. 실서비스 주소는 Cloudflare Pages로 고정
2. Cloudflare Pages same-origin `/api/*`를 runtime entry로 고정
3. `/api/trees`, `/api/memories`는 Cloudflare Pages Functions → Modal로 고정
4. browse summary는 Modal 우선으로 고정
5. Vercel은 deprecated transitional fallback으로 축소
6. Netlify Functions는 Legacy Artifact Only / Removal Candidate로 축소
7. tests/docs reference transition 완료 후 Issue #119 audit에서 Netlify archive 여부를 별도 승인한다

---

## 7. PR #38 운영 기록

PR #38은 active runtime이 아닌 `netlify/functions/*`에 backend 정책을 구현했기 때문에 close되었습니다.

해당 판단은 다음 기준을 따른다.

- active production/test slot runtime: Cloudflare Pages Functions → Modal
- legacy artifact / removal candidate: `netlify/functions/*`
- archive: 이번 문서 정리 PR에서 수행하지 않음
- Netlify runtime 재활성화가 명시 승인되지 않는 한 신규 backend policy를 `netlify/functions/*`에 구현하지 않음

---

## 8. 운영 체크포인트

- `https://lovebud.pages.dev/`가 공식 주소로 안내되고 있는가
- `/api/trees` 응답에 `x-lovebud-upstream: modal`이 있는가
- `/api/memories` 응답에 `x-lovebud-upstream: modal`이 있는가
- Modal 응답에 `modal-function-call-id`가 있는가
- 응답 server가 Cloudflare인지 확인했는가
- Cloudflare Pages env에 `MODAL_BASE_URL`이 설정되어 있는가
- Modal `/modal/health`가 정상 응답하는가
- `netlify/functions/*`를 새 backend 구현 대상이나 active fallback 구현 대상으로 오해하지 않았는가
- Netlify route gap을 Issue #119 audit 대상으로 분리했는가

---

## 9. 관리자 운영 메모

확인용 핵심 URL:
- 메인: `https://lovebud.pages.dev/`
- 검색/브라우즈: `https://lovebud.pages.dev/search.html`
- 로그인: `https://lovebud.pages.dev/login.html`
- 에디터: `https://lovebud.pages.dev/editor.html`
- 내 트리: `https://lovebud.pages.dev/my-trees.html`
