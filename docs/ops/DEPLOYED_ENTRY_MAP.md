# LoveBud 실운영 엔트리 맵

이 문서는 현재 실운영 진입 경로를 **Vercel 기준**으로 정리합니다.

## 1. 루트 주소

- **공식 주소**: `https://lovebud.vercel.app/`
- **보조/Fallback 주소**: `https://lovebud.netlify.app/`

주의:
- 문서와 운영 안내에서 `lovebud.netlify.app`를 주서비스처럼 설명하지 않습니다.

## 2. URL 리라우팅 (Vercel)

`vercel.json` 기준:

- `/intro.html` -> `/pages/intro.html`
- `/login.html` -> `/pages/login.html`
- `/search.html` -> `/pages/search.html`
- `/detail.html` -> `/pages/detail.html`
- `/editor.html` -> `/pages/editor.html`
- `/my-trees.html` -> `/pages/my-trees.html`

## 3. API 엔드포인트 맵 (`/api/*`)

모든 브라우저 API 호출은 Vercel same-origin 경로를 먼저 탑니다.

| 엔드포인트 | 처리 핸들러 | 현재 우선순위 / 동작 |
| :--- | :--- | :--- |
| `/api/community/trees` | `api/community/trees.js` | **Modal (summary)** -> Netlify fallback |
| `/api/community/memories` | `api/community/memories.js` | **Modal representative preview 우선** -> Netlify fallback |
| `/api/trees/*` | `api/[...path].js` | Vercel catch-all -> `LOVEBUD_UPSTREAM_API_BASE` |
| `/api/memories/*` | `api/[...path].js` | Vercel catch-all -> `LOVEBUD_UPSTREAM_API_BASE` |

## 4. 계층 역할 요약

### Modal
- browse summary
- public read aggregation
- representative snapshot / preview 계산

### Vercel
- 공식 프런트 엔트리
- static asset 서빙
- same-origin API router

### Netlify
- fallback / legacy upstream
- 일부 기존 CRUD / community upstream 유지

## 5. 실제 자산 로드 기준

- static 자산은 `https://lovebud.vercel.app/` 환경에서 직접 서빙됩니다.
- 핵심 프런트 자산 예시:
  - `/css/global.css`
  - `/js/api/base-api-fetch.js`
  - `/js/postgres-client.js`
  - `/js/search.js`

## 6. 운영 메모

현재 구조는 완전 제거 상태가 아니라 전이기 구조입니다.

- 공식 주소는 Vercel
- browse summary 1순위는 Modal
- preview hydrate도 Modal representative preview를 먼저 시도
- Netlify는 fallback / legacy
