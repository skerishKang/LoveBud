# LoveBud 실운영 엔트리 맵

이 문서는 현재 실운영 진입 경로를 **Cloudflare Pages 기준**으로 정리합니다.

## 1. 루트 주소

- **공식 주소**: `https://lovebud.pages.dev/`
- **Deprecated transitional fallback under audit**: `https://lovebud.vercel.app/`
- **Legacy fallback pending audit**: `https://lovebud.netlify.app/`

주의:
- 문서와 운영 안내에서 `lovebud.vercel.app`, `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.

## 2. URL 노출 경로 (Cloudflare Pages)

실서비스는 Cloudflare Pages가 사용자-facing 주소를 제공합니다.

- `/intro.html`
- `/login.html`
- `/search.html`
- `/detail.html`
- `/editor.html`
- `/my-trees.html`

## 3. API 엔드포인트 맵 (`/api/*`)

모든 브라우저 API 호출은 Cloudflare Pages same-origin 경로를 먼저 탑니다.

| 엔드포인트 | 처리 핸들러 | 현재 우선순위 / 동작 |
| :--- | :--- | :--- |
| `/api/trees` | `functions/api/trees.js` | Route-specific Cloudflare Function -> `GET`/`POST` -> Modal `/modal/private/trees`; response marker `x-lovebud-upstream: modal` |
| `/api/memories` | `functions/api/memories.js` | Route-specific Cloudflare Function -> `GET`/`POST` -> Modal `/modal/private/memories`; response marker `x-lovebud-upstream: modal` |
| `/api/community/trees` | `functions/api/[[path]].js` | Catch-all fallback; 일부 Modal read route 가능 -> Vercel deprecated transitional fallback under audit |
| `/api/community/memories` | `functions/api/[[path]].js` | Catch-all fallback; 일부 Modal read route 가능 -> Vercel deprecated transitional fallback under audit |
| `/api/trees/*` | `functions/api/trees/[id].js` 또는 `functions/api/[[path]].js` | `GET` detail route 일부 확인; non-GET/PATCH/DELETE는 production route matrix pending |
| `/api/memories/*` | `functions/api/[[path]].js` | detail route 및 non-GET/PATCH/DELETE는 production route matrix pending |
| 기타 `/api/*` | `functions/api/[[path]].js` | route-specific function이 없는 요청의 catch-all fallback; Vercel deprecated transitional fallback 위험 audit 중 |

## 4. 계층 역할 요약

### Modal
- browse summary
- public/community/private read
- representative snapshot / preview 계산

### Cloudflare Pages
- 공식 프런트 엔트리
- static asset 서빙
- same-origin API router

### Vercel
- deprecated transitional fallback under audit
- primary production runtime으로 취급하지 않음
- production route matrix가 의존성 없음 또는 대체 경로 확정을 증명하기 전 제거 금지

### Netlify
- legacy fallback pending audit
- 일부 기존 CRUD / legacy 경로 보존/폐기 판단 필요

## 5. 실제 자산 로드 기준

- static 자산은 `https://lovebud.pages.dev/` 환경에서 직접 서빙됩니다.
- 핵심 프런트 자산 예시:
  - `/css/global.css`
  - `/js/api/base-api-fetch.js`
  - `/js/postgres-client.js`
  - `/js/search.js`

## 6. 운영 메모

현재 구조는 완전 제거 상태가 아니라 전이기 구조입니다.

- 공식 주소는 Cloudflare Pages
- `/api/trees`, `/api/memories`의 `GET`/`POST`는 route-specific Cloudflare Function을 통해 Modal private endpoint로 전달
- same-origin entry는 Cloudflare Pages
- `functions/api/[[path]].js`는 route-specific function이 없는 `/api/*` 요청의 catch-all fallback
- Vercel은 deprecated transitional fallback under audit
- Netlify는 legacy fallback pending audit
- detail route, community route, PATCH/DELETE 계열은 production route matrix 완료 전까지 pending
