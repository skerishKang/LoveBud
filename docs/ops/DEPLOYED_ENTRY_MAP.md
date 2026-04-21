# LoveBud 실운영 엔트리 맵

이 문서는 **Vercel 기반 Same-Origin API 구조**에서의 실제 진입 경로와 자산 로드 흐름을 정의합니다.

## 1. 루트 상시 주소
- **Primary**: [https://lovebud.vercel.app/](https://lovebud.vercel.app/) (Vercel)
- **Fallback**: https://lovebud.netlify.app/ (Netlify)

## 2. URL 리라우팅 (Vercel Internal)
- /intro.html -> /pages/intro.html
- /login.html -> /pages/login.html
- /search.html -> /pages/search.html
- /detail.html -> /pages/detail.html
- /editor.html -> /pages/editor.html
- /my-trees.html -> /pages/my-trees.html

## 3. API 엔드포인트 맵 (/api/*)
모든 API 호출은 동일 오리진(lovebud.vercel.app) 내 대리자(Vercel Functions)를 거칩니다.

| 엔드포인트 | 처리 핸들러 | 우선순위 / 동작 |
| :--- | :--- | :--- |
| /api/community/trees | api/community/trees.js | **Modal (view=summary)** > Netlify Fallback |
| /api/community/memories | api/community/memories.js | Vercel Native Proxy to Netlify |
| /api/trees/* | api/[...path].js | Catch-all Proxy to Netlify |
| /api/memories/* | api/[...path].js | Catch-all Proxy to Netlify |

## 4. 실제 운영 자산 (Assets)
- 모든 static 자산(JS/CSS/Image)은 lovebud.vercel.app 환경에서 직접 서빙됩니다.
- 핵심 공통 CSS: /css/global.css
- 핵심 공통 JS: /js/api/base-api-fetch.js, /js/postgres-client.js