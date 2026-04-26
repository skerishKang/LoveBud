# Cloudflare Pages Functions API Entry

## 역할

이 폴더는 Cloudflare Pages의 same-origin `/api/*` 진입점입니다.

## 핵심 구조

- `[[path]].js`: Cloudflare Pages Functions의 catch-all route handler
  - 사용자 브라우저는 `https://lovebud.pages.dev/api/*`로만 접근
  - approved routes만 Modal 또는 fallback으로 연결
  - route 추가 시 contract test 필요

## Approved Routes

현재 Modal로 연결되는 GET routes:

- `/api/community/trees?view=summary` → Modal browse summary
- `/api/community/growing-trees` → Modal growing trees
- `/api/community/memories` → Modal community memories
- `/api/trees` → Modal private trees
- `/api/memories` → Modal private memories
- `/api/memories/{id}` → Modal memory detail
- `/api/trees/{id}` → Modal tree detail (public/private 분기)

## Route 추가 가이드

새 route를 추가할 때:

1. `[[path]].js`에 route mapping 추가
2. Modal endpoint 존재 확인
3. `tests/contracts/api-route-mapping.test.js`에 contract test 추가
4. CTO 승인 후 merge

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/engineering/API_CONTRACT.md`
