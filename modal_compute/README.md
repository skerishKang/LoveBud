# Modal Compute Runtime

## 역할

이 폴더는 LoveBud의 현재 active compute/runtime priority 계층입니다.

## 핵심 구조

- `app.py`: Modal FastAPI application (main entry)
- `browse_latest.py`: Browse summary cache handler
- `requirements.txt`: Python dependencies

## Runtime Priority

Browse/community/private read-heavy route는 기본적으로 Modal 우선:

- Browse summary (`/api/community/trees?view=summary`)
- Growing trees (`/api/community/growing-trees`)
- Community memories (`/api/community/memories`)
- Private trees (`/api/trees`)
- Private memories (`/api/memories`)
- Memory detail (`/api/memories/{id}`)
- Tree detail (`/api/trees/{id}`)

## Deploy 가이드

Modal deploy는 별도 승인 필요:

1. CTO 승인 후 deploy
2. Secrets 출력/커밋 금지
3. Production deploy 전 staging test

## 관련 문서

- `docs/ops/OPERATIONS.md`
- `docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
