# Cloudflare Pages Functions

## 역할

이 폴더는 Cloudflare Pages의 same-origin `/api/*` 진입점입니다.

## 핵심 구조

- `api/[[path]].js`: Cloudflare Pages Functions의 catch-all route handler
  - 사용자 브라우저는 `https://lovebud.pages.dev/api/*`로만 접근
  - approved routes만 Modal 또는 fallback으로 연결
  - route 추가 시 `functions/api/README.md`의 contract test 기준을 따라야 함
  - approved route mapping 없이 새 production route 추가 금지

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/engineering/API_CONTRACT.md`
- `functions/api/README.md`
