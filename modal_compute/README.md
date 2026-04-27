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

## Runtime / security contract

상세 정책은 이 README에 중복 서술하지 않습니다. Active Modal runtime 및 security contract는 아래 문서를 기준으로 확인합니다.

- `../docs/engineering/API_CONTRACT.md`
- `../docs/ops/MODAL_BROWSE_RUNTIME.md`

## Deploy 가이드

Modal deploy는 별도 승인 필요:

1. CTO 승인 후 deploy
2. Secrets 출력/커밋 금지
3. Production deploy 전 staging test

## 관련 문서

- `../docs/engineering/API_CONTRACT.md`
- `../docs/ops/MODAL_BROWSE_RUNTIME.md`
- `../docs/ops/OPERATIONS.md`
- `../docs/migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`
