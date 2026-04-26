# Netlify Functions (Legacy)

## 역할

이 폴더는 lovebud.pages.dev의 active production backend가 아닙니다.

## 상태

- **Legacy/fallback/artifact**
- 현재 Cloudflare Pages + Modal 구조로 migration 완료
- CTO 승인 없이 삭제/이동/재활성화 금지

## 기존 구조

- `community-memories.js`: Community memories endpoint (legacy)
- `community-trees.js`: Community trees endpoint (legacy)
- `memories.js`: Private memories endpoint (legacy)
- `memory-detail.js`: Memory detail endpoint (legacy)
- `tree-detail.js`: Tree detail endpoint (legacy)
- `trees.js`: Private trees endpoint (legacy)
- `_lib/`: Shared utility functions

## Migration 상태

모든 routes는 현재 Cloudflare Pages Functions → Modal로 연결됩니다.

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
