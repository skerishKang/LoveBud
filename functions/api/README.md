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

## Public viewer tree-read cache

- 대상: 익명 GET `/api/trees/{id}` 요청만 캐싱 (Authorization 요청은 bypass)
- 조건: verified public JSON 200 응답만 캐시에 저장
- TTL: 30초
- stale serving 없음 (must-revalidate 적용, expired cache fallback 금지)
- 특징: title/memory/visibility/delete 변경은 최대 30초 이내에 반영되는 bounded freshness 정책을 가짐
- Cache Status Header: `x-lovebud-public-tree-cache`
- Private/owner read는 캐시 대상이 아님

## Route 추가 가이드

새 route를 추가할 때:

1. `[[path]].js`에 route mapping 추가
2. Modal endpoint 존재 확인
3. `tests/contracts/api-route-mapping.test.js`에 contract test 추가
4. CTO 승인 후 merge

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/engineering/API_CONTRACT.md`
