# Netlify SQL (Legacy Schema)

## 역할

이 폴더는 legacy schema/seed artifact입니다.

## 상태

- **Active migration source of truth가 아님**
- 현재 Modal PostgreSQL을 사용 중
- CTO 승인 없이 삭제/이동/재활성화 금지

## 기존 구조

- `001_initial_schema.sql`: Initial database schema (legacy)
- `002_add_payload_columns.sql`: Payload columns migration (legacy)
- `002_seed_demo_data.sql`: Demo data seed (legacy)

## Migration 상태

데이터베이스는 현재 Modal PostgreSQL로 migration 완료되었습니다.

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
