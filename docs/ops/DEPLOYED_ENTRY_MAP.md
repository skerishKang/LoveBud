# LoveBud 실운영 엔트리 맵

이 문서는 현재 실운영 진입 경로를 **Cloudflare Pages 기준**으로 정리합니다.

## 1. 루트 주소

- **공식 주소**: `https://lovebud.pages.dev/`
- **Deprecated transitional fallback under audit**: `https://lovebud.vercel.app/`
- **Legacy artifact / not current production backend**: `https://lovebud.netlify.app/`, `netlify/functions/*`

주의:
- 문서와 운영 안내에서 `lovebud.vercel.app`, `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.
- `netlify/functions/*`는 현재 `lovebud.pages.dev` production/test slot의 active backend가 아닙니다.
- 새 backend 정책 구현은 Netlify runtime 재활성화가 명시 승인되지 않는 한 `netlify/functions/*`에 추가하지 않습니다.

## 2. URL 노출 경로 (Cloudflare Pages)

실서비스는 Cloudflare Pages가 사용자-facing 주소를 제공합니다.

- `/intro.html`
- `/login.html`
- `/search.html`
- `/detail.html`
- `/editor.html`
- `/my-trees.html`

## 3. API runtime source of truth

현재 production / test1 / test2 / test3 route matrix 실측 기준:

- `/api/trees`: `x-lovebud-upstream: modal`
- `/api/memories`: `x-lovebud-upstream: modal`
- `modal-function-call-id` 존재
- `server: cloudflare`
- `cf-cache-status: DYNAMIC`
- Netlify Functions 호출 흔적 없음

현재 API runtime 경로:

```text
Cloudflare Pages same-origin /api/*
→ Cloudflare Pages Functions under functions/api/*
→ Modal
```

## 4. API 엔드포인트 맵 (`/api/*`)

모든 브라우저 API 호출은 Cloudflare Pages same-origin 경로를 먼저 탑니다.

| 엔드포인트 | 처리 핸들러 | 현재 우선순위 / 동작 |
| :--- | :--- | :--- |
| `/api/trees` | `functions/api/trees.js` | Route-specific Cloudflare Function -> `GET`/`POST` -> Modal `/modal/private/trees`; response marker `x-lovebud-upstream: modal` |
| `/api/memories` | `functions/api/memories.js` | Route-specific Cloudflare Function -> `GET`/`POST` -> Modal `/modal/private/memories`; response marker `x-lovebud-upstream: modal` |
| `/api/community/trees` | `functions/api/[[path]].js` | Catch-all Cloudflare Function -> Modal browse/community route where recognized |
| `/api/community/memories` | `functions/api/[[path]].js` | Catch-all Cloudflare Function -> Modal community memories route where recognized |
| `/api/trees/*` | `functions/api/trees/[id].js` 또는 `functions/api/[[path]].js` | Cloudflare Function -> Modal private/public tree detail path where recognized |
| `/api/memories/*` | `functions/api/[[path]].js` | Cloudflare Function -> Modal memory detail path where recognized |
| 기타 `/api/*` | `functions/api/[[path]].js` | route-specific function이 없는 요청의 catch-all 처리. recognized route가 아니면 Cloudflare 404/405 계열 응답 |

## 5. 계층 역할 요약

### Modal
- active API/backend target
- private tree/memory owner routes
- public/community read routes
- browse summary
- representative snapshot / preview 계산

### Cloudflare Pages
- 공식 프런트 엔트리
- static asset 서빙
- same-origin API router
- production/test slot runtime entry

### Vercel
- deprecated transitional fallback under audit
- primary production runtime으로 취급하지 않음
- production route matrix가 의존성 없음 또는 대체 경로 확정을 증명하기 전 제거 금지

### Netlify / `netlify/functions/*`
- legacy artifact only
- current production backend for `lovebud.pages.dev`가 아님
- production/test slot API route matrix에서 호출 흔적 없음
- Netlify runtime을 명시 재활성화하지 않는 한 신규 backend 정책 구현 위치가 아님

## 6. PR #38 기록

PR #38은 active Cloudflare/Modal runtime이 아니라 legacy `netlify/functions/*`를 대상으로 backend 정책을 구현했기 때문에 close되었습니다.

해당 close는 Netlify Functions 코드를 즉시 삭제하거나 archive했다는 뜻이 아닙니다. 현재 판단은 다음과 같습니다.

- active runtime 구현 대상: `functions/api/*` + Modal
- legacy reference: `netlify/functions/*`
- archive: 이 PR에서 수행하지 않음
- archive 전제: tests/docs reference transition 완료 후 별도 승인 필요

## 7. 실제 자산 로드 기준

- static 자산은 `https://lovebud.pages.dev/` 환경에서 직접 서빙됩니다.
- 핵심 프런트 자산 예시:
  - `/css/global.css`
  - `/js/api/base-api-fetch.js`
  - `/js/postgres-client.js`
  - `/js/search.js`

## 8. 운영 메모

현재 구조는 완전 제거 상태가 아니라 전이기 구조입니다.

- 공식 주소는 Cloudflare Pages
- `/api/trees`, `/api/memories`의 `GET`/`POST`는 route-specific Cloudflare Function을 통해 Modal private endpoint로 전달
- same-origin entry는 Cloudflare Pages
- `functions/api/[[path]].js`는 route-specific function이 없는 `/api/*` 요청의 catch-all handler
- Vercel은 deprecated transitional fallback under audit
- Netlify Functions는 legacy artifact이며 active production backend가 아님
- detail route, community route, PATCH/DELETE 계열은 active route matrix 기준으로 계속 검증 필요
