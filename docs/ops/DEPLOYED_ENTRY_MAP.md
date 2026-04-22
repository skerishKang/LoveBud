# LoveBud 실운영 엔트리 맵

이 문서는 현재 실운영 진입 경로를 **Cloudflare Pages 기준**으로 정리합니다.

## 1. 루트 주소

- **공식 주소**: `https://lovebud.pages.dev/`
- **보조/Upstream 주소**: `https://lovebud.vercel.app/`
- **보조/Fallback 주소**: `https://lovebud.netlify.app/`

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
| `/api/community/trees` | `functions/api/[[path]].js` | **Modal (summary)** -> Vercel fallback |
| `/api/community/memories` | `functions/api/[[path]].js` | **Modal 우선** -> Vercel fallback |
| `/api/trees/*` | `functions/api/[[path]].js` | Cloudflare Pages catch-all -> Modal private read / Vercel fallback |
| `/api/memories/*` | `functions/api/[[path]].js` | Cloudflare Pages catch-all -> Modal private read / Vercel fallback |

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
- upstream / secondary entry
- fallback origin

### Netlify
- fallback / legacy upstream
- 일부 기존 CRUD / legacy 경로 유지

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
- browse summary 1순위는 Modal
- same-origin entry는 Cloudflare Pages
- Vercel은 upstream / secondary entry
- Netlify는 fallback / legacy
