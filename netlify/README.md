# Netlify (Legacy Artifact)

## 역할

이 폴더는 lovebud.pages.dev의 active production backend가 아닙니다.

## 상태

- **Legacy artifact**
- 현재 Cloudflare Pages + Modal 구조로 migration 완료
- CTO 승인 없이 삭제/이동/재활성화 금지
- `netlify/functions/*`는 active production fallback이 아님
- local 또는 CI harness에서만 참고용으로 사용

## 기존 구조

- `functions/`: Netlify Functions (legacy)
- `sql/`: Netlify SQL schema/seed (legacy)

## Migration 상태

모든 routes는 현재 Cloudflare Pages Functions → Modal로 연결됩니다.

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
- `netlify/functions/README.md`
- `netlify/sql/README.md`
